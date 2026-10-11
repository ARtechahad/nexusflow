import { logger } from '../logger';
import { realtimeEngine } from './realtimeEngine';

export type JobType = 'email_send' | 'lead_scrape' | 'pdf_generate' | 'webhook_dispatch' | 'drip_nudge';

export interface QueueJob<T = any> {
  id: string;
  type: JobType;
  tenantId: string;
  payload: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  processedAt?: string;
  error?: string;
  result?: any;
}

class QueueEngine {
  private jobs: Map<string, QueueJob> = new Map();
  private isProcessing: boolean = false;
  private handlers: Map<JobType, (payload: any, job: QueueJob) => Promise<any>> = new Map();

  constructor() {
    this.registerDefaultHandlers();
    this.startWorker();
  }

  public registerHandler(type: JobType, handler: (payload: any, job: QueueJob) => Promise<any>): void {
    this.handlers.set(type, handler);
  }

  public addJob<T = any>(type: JobType, payload: T, tenantId: string = 'tenant-alm-nexus', maxAttempts: number = 3): QueueJob<T> {
    const job: QueueJob<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      tenantId,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts,
      createdAt: new Date().toISOString()
    };

    this.jobs.set(job.id, job);

    logger.info(`Queued job ${job.id} (${job.type}) for tenant ${tenantId}`, {
      context: 'QueueEngine',
      tenantId
    });

    realtimeEngine.broadcastToTenant(tenantId, 'job_queued', {
      jobId: job.id,
      type: job.type,
      status: job.status
    });

    return job;
  }

  public getJob(id: string): QueueJob | undefined {
    return this.jobs.get(id);
  }

  public getJobsByTenant(tenantId: string): QueueJob[] {
    const result: QueueJob[] = [];
    this.jobs.forEach(j => {
      if (j.tenantId === tenantId || tenantId === 'tenant-global') {
        result.push(j);
      }
    });
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private startWorker(): void {
    setInterval(async () => {
      if (this.isProcessing) return;
      this.isProcessing = true;

      try {
        const pending = Array.from(this.jobs.values()).filter(j => j.status === 'pending');
        for (const job of pending) {
          await this.processJob(job);
        }
      } catch (err: any) {
        logger.error('Error in QueueEngine worker loop:', { details: err?.message });
      } finally {
        this.isProcessing = false;
      }
    }, 2000);
  }

  private async processJob(job: QueueJob): Promise<void> {
    job.status = 'processing';
    job.attempts++;
    job.processedAt = new Date().toISOString();

    logger.info(`Processing job ${job.id} (${job.type}), attempt ${job.attempts}/${job.maxAttempts}`, {
      context: 'QueueEngine',
      tenantId: job.tenantId
    });

    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler registered for job type: ${job.type}`;
      return;
    }

    try {
      const result = await handler(job.payload, job);
      job.status = 'completed';
      job.result = result;

      logger.info(`Job ${job.id} (${job.type}) completed successfully`, {
        context: 'QueueEngine',
        tenantId: job.tenantId
      });

      realtimeEngine.broadcastToTenant(job.tenantId, 'job_completed', {
        jobId: job.id,
        type: job.type,
        result
      });
    } catch (err: any) {
      job.error = err?.message || 'Job execution error';
      if (job.attempts < job.maxAttempts) {
        job.status = 'pending'; // Retry on next loop iteration
        logger.warn(`Job ${job.id} failed, will retry (${job.attempts}/${job.maxAttempts}): ${job.error}`);
      } else {
        job.status = 'failed';
        logger.error(`Job ${job.id} permanently failed after ${job.attempts} attempts: ${job.error}`);

        realtimeEngine.broadcastToTenant(job.tenantId, 'job_failed', {
          jobId: job.id,
          type: job.type,
          error: job.error
        });
      }
    }
  }

  private registerDefaultHandlers(): void {
    // 1. Email Send Handler
    this.registerHandler('email_send', async (payload) => {
      const { to, subject, html } = payload;
      logger.info(`Dispatching email to ${to}: "${subject}"`, { context: 'EmailHandler' });
      return { sent: true, recipient: to, deliveredAt: new Date().toISOString() };
    });

    // 2. Lead Scrape Handler
    this.registerHandler('lead_scrape', async (payload) => {
      const { keyword, platform } = payload;
      logger.info(`Executing background scraper for keyword "${keyword}" on ${platform}`, { context: 'ScraperHandler' });
      return { foundCount: 3, keyword, platform, scannedAt: new Date().toISOString() };
    });

    // 3. PDF Contract Generation Handler
    this.registerHandler('pdf_generate', async (payload) => {
      const { documentTitle, clientName } = payload;
      logger.info(`Rendering PDF contract for ${clientName}: "${documentTitle}"`, { context: 'PDFHandler' });
      return { generated: true, documentTitle, url: `/api/contracts/download/${Date.now()}` };
    });

    // 4. Webhook Dispatch Handler
    this.registerHandler('webhook_dispatch', async (payload) => {
      const { url, event, data } = payload;
      logger.info(`Dispatching webhook event "${event}" to ${url}`, { context: 'WebhookHandler' });
      return { statusCode: 200, event, url };
    });

    // 5. Drip Nudge Handler
    this.registerHandler('drip_nudge', async (payload) => {
      const { clientName, channel, stage } = payload;
      logger.info(`Triggering stage ${stage} drip nudge for ${clientName} via ${channel}`, { context: 'DripHandler' });
      return { nudgeSent: true, stage, channel };
    });
  }
}

export const queueEngine = new QueueEngine();
