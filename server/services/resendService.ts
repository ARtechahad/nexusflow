import { Resend } from 'resend';
import crypto from 'node:crypto';
import { logger } from '../logger';
import { getNeonPool, neonQuery } from './db';
import { getDB, saveDB, logAuditAction } from '../db';

/**
 * Default reliable Resend API Key fallback if process.env.RESEND_API_KEY is not defined.
 */
export const DEFAULT_RESEND_API_KEY = 're_LXiiEzAS_86mprrkSQfUGaJHZRK25Pp18';

/**
 * Standard default sender address conforming to Resend onboarding domain or custom env.
 */
export const DEFAULT_EMAIL_FROM = process.env.EMAIL_FROM_ADDRESS || 'ALM Nexus <onboarding@resend.dev>';

/**
 * Resend Email Attachment Contract
 */
export interface ResendAttachmentInput {
  filename: string;
  content?: string | Buffer;
  path?: string;
  contentType?: string;
}

/**
 * Resend Tracking Tag Contract
 */
export interface ResendTagInput {
  name: string;
  value: string;
}

/**
 * Email Dispatch Input Parameters
 */
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  fromName?: string;
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: ResendAttachmentInput[];
  tags?: ResendTagInput[];
  headers?: Record<string, string>;
  tenantId?: string;
  metadata?: Record<string, any>;
  template?: string;
}

/**
 * Normalized Email Dispatch Response
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  recipient: string;
  from: string;
  subject: string;
  provider: 'resend' | 'fallback_simulated';
  error?: string;
  timestamp: string;
  telemetryId?: string;
}

/**
 * Singleton Resend Client Manager
 */
class ResendServiceManager {
  private client: Resend | null = null;
  private currentApiKey: string = '';

  /**
   * Resolves active API Key from environment or fallback
   */
  public getApiKey(): string {
    return (process.env.RESEND_API_KEY || DEFAULT_RESEND_API_KEY).trim();
  }

  /**
   * Lazily instantiates and returns the official Resend client singleton
   */
  public getClient(): Resend {
    const key = this.getApiKey();
    if (!this.client || this.currentApiKey !== key) {
      this.currentApiKey = key;
      this.client = new Resend(key);
    }
    return this.client;
  }

  /**
   * Normalizes sender from name and address with safe defaults
   */
  public resolveFromAddress(customFrom?: string, fromName?: string): string {
    if (customFrom && customFrom.trim()) {
      const cleanFrom = customFrom.trim();
      // If already formatted like "Name <email@domain.com>", preserve it
      if (cleanFrom.includes('<') && cleanFrom.includes('>')) {
        return cleanFrom;
      }
      if (fromName && fromName.trim()) {
        return `"${fromName.trim()}" <${cleanFrom}>`;
      }
      return cleanFrom;
    }

    if (fromName && fromName.trim()) {
      const defaultAddr = DEFAULT_EMAIL_FROM.includes('<')
        ? DEFAULT_EMAIL_FROM.split('<')[1].replace('>', '')
        : 'onboarding@resend.dev';
      return `"${fromName.trim()}" <${defaultAddr}>`;
    }

    return DEFAULT_EMAIL_FROM;
  }

  /**
   * Dispatches an email via Resend with comprehensive retries, domain handling,
   * non-blocking resilience, and Neon Database telemetry persistence.
   */
  public async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const start = Date.now();
    const recipientStr = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    const initialFrom = this.resolveFromAddress(options.from, options.fromName);
    const tenantId = options.tenantId || 'tenant-alm-nexus';
    const telemetryId = `eml_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    logger.info(`[Resend Engine] Initiating email dispatch to ${recipientStr}: "${options.subject}"`, {
      context: 'ResendService',
      tenantId,
      details: {
        from: initialFrom,
        template: options.template || 'direct',
        hasHtml: Boolean(options.html),
        attachmentsCount: options.attachments?.length || 0
      }
    });

    const client = this.getClient();

    // Prepare payload for Resend SDK
    const basePayload: any = {
      from: initialFrom,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html || options.text || '<p></p>',
      text: options.text,
      replyTo: options.replyTo,
      cc: options.cc,
      bcc: options.bcc,
      headers: options.headers,
      tags: options.tags?.map(t => ({ name: t.name.slice(0, 256), value: t.value.slice(0, 256) }))
    };

    if (options.attachments && options.attachments.length > 0) {
      basePayload.attachments = options.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        path: att.path,
        content_type: att.contentType
      }));
    }

    let resendMessageId: string | undefined;
    let dispatchError: string | undefined;
    let actualFromUsed = initialFrom;

    try {
      // First attempt with specified from address
      const res = await client.emails.send(basePayload);

      if (res.error) {
        // If the error was domain verification (e.g., custom mailbox domain not yet verified in Resend dashboard),
        // gracefully fall back to onboarding@resend.dev with the original sender set as replyTo
        const errMsg = res.error.message || '';
        const isDomainError = errMsg.toLowerCase().includes('domain') || errMsg.toLowerCase().includes('verify');

        if (isDomainError && !initialFrom.includes('onboarding@resend.dev')) {
          logger.warn(`[Resend Engine] Sender domain not verified in Resend. Retrying with onboarding fallback...`, {
            context: 'ResendService',
            details: { originalFrom: initialFrom, error: errMsg }
          });

          const fallbackFrom = DEFAULT_EMAIL_FROM;
          actualFromUsed = fallbackFrom;

          const retryPayload = {
            ...basePayload,
            from: fallbackFrom,
            replyTo: options.replyTo || (options.from ? [options.from] : undefined)
          };

          const retryRes = await client.emails.send(retryPayload);

          if (retryRes.error) {
            dispatchError = retryRes.error.message;
          } else if (retryRes.data?.id) {
            resendMessageId = retryRes.data.id;
          }
        } else {
          dispatchError = res.error.message;
        }
      } else if (res.data?.id) {
        resendMessageId = res.data.id;
      }
    } catch (err: any) {
      logger.error(`[Resend Engine] Network or execution failure during email dispatch: ${err.message}`, {
        context: 'ResendService',
        details: err?.stack
      });
      dispatchError = err.message;
    }

    const duration = Date.now() - start;
    const isSuccessful = Boolean(resendMessageId);

    const result: SendEmailResult = {
      success: isSuccessful,
      messageId: resendMessageId || `sim_${Date.now()}`,
      recipient: recipientStr,
      from: actualFromUsed,
      subject: options.subject,
      provider: isSuccessful ? 'resend' : 'fallback_simulated',
      error: dispatchError,
      timestamp: new Date().toISOString(),
      telemetryId
    };

    if (isSuccessful) {
      logger.info(`[Resend Engine] Email delivered successfully in ${duration}ms! (Resend ID: ${resendMessageId})`, {
        context: 'ResendService',
        details: { to: recipientStr, messageId: resendMessageId }
      });
    } else {
      logger.warn(`[Resend Engine] Email delivery encountered issue: ${dispatchError}. Local state preserved.`, {
        context: 'ResendService',
        details: { to: recipientStr, error: dispatchError }
      });
    }

    // Telemetry: Persist to Neon PostgreSQL, cache, and audit logs
    try {
      await this.recordTelemetry({
        id: telemetryId,
        tenantId,
        resendId: resendMessageId,
        recipient: recipientStr,
        sender: actualFromUsed,
        subject: options.subject,
        status: isSuccessful ? 'sent' : 'failed',
        template: options.template || 'direct',
        metadata: options.metadata || {},
        errorMessage: dispatchError
      });
    } catch (recErr: any) {
      logger.debug(`[Resend Engine] Background telemetry logging note: ${recErr.message}`);
    }

    return result;
  }

  /**
   * Batch email dispatch with concurrency throttling
   */
  public async sendBatchEmails(emails: SendEmailOptions[], concurrency: number = 3): Promise<SendEmailResult[]> {
    const results: SendEmailResult[] = [];
    const queue = [...emails];

    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.all(batch.map(item => this.sendEmail(item)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Diagnostic connection test for health probes and UI setup diagnostics
   */
  public async testConnection(): Promise<{
    ok: boolean;
    message: string;
    apiKeyMasked: string;
    defaultFrom: string;
    timestamp: string;
  }> {
    const key = this.getApiKey();
    const masked = key.length > 8 ? `${key.substring(0, 6)}...${key.substring(key.length - 4)}` : '****';

    try {
      const client = this.getClient();
      // Test by querying domains or api key check
      const domains = await client.domains.list();
      if ((domains as any)?.error) {
        const err = (domains as any).error;
        if (err.name === 'restricted_api_key' || err.message?.includes('restricted')) {
          return {
            ok: true,
            message: 'Connected to Resend API (Sending Key verified & active).',
            apiKeyMasked: masked,
            defaultFrom: DEFAULT_EMAIL_FROM,
            timestamp: new Date().toISOString()
          };
        }
      }
      return {
        ok: true,
        message: `Successfully connected to Resend API. Active domains: ${domains.data?.data?.length ?? 0}.`,
        apiKeyMasked: masked,
        defaultFrom: DEFAULT_EMAIL_FROM,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      if (err?.name === 'restricted_api_key' || err?.message?.includes('restricted')) {
        return {
          ok: true,
          message: 'Connected to Resend API (Sending Key verified & active).',
          apiKeyMasked: masked,
          defaultFrom: DEFAULT_EMAIL_FROM,
          timestamp: new Date().toISOString()
        };
      }
      return {
        ok: false,
        message: `Resend connectivity check warning: ${err.message}`,
        apiKeyMasked: masked,
        defaultFrom: DEFAULT_EMAIL_FROM,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Records email dispatch telemetry safely into Neon Database and in-memory cache
   */
  private async recordTelemetry(record: {
    id: string;
    tenantId: string;
    resendId?: string;
    recipient: string;
    sender: string;
    subject: string;
    status: 'sent' | 'failed';
    template: string;
    metadata: Record<string, any>;
    errorMessage?: string;
  }): Promise<void> {
    const pool = getNeonPool();

    // 1. Persist to Neon Serverless PostgreSQL if connected
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO resend_email_logs
           (id, tenant_id, resend_id, recipient, sender, subject, status, template, metadata, error_message, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            record.id,
            record.tenantId,
            record.resendId || null,
            record.recipient,
            record.sender,
            record.subject,
            record.status,
            record.template,
            JSON.stringify(record.metadata),
            record.errorMessage || null
          ]
        );
      } catch (dbErr: any) {
        logger.debug(`[Resend Engine] Neon query notice during telemetry log: ${dbErr?.message}`);
      }
    }

    // 2. Also append to local memory / file DB cache for instant UI availability
    try {
      const db = getDB();
      if (!Array.isArray(db.resendEmailLogs)) {
        db.resendEmailLogs = [];
      }
      db.resendEmailLogs.unshift({
        id: record.id,
        tenantId: record.tenantId,
        resendId: record.resendId,
        recipient: record.recipient,
        sender: record.sender,
        subject: record.subject,
        status: record.status,
        template: record.template,
        metadata: record.metadata,
        errorMessage: record.errorMessage,
        createdAt: new Date().toISOString()
      });

      // Keep last 300 records
      if (db.resendEmailLogs.length > 300) {
        db.resendEmailLogs = db.resendEmailLogs.slice(0, 300);
      }
      saveDB(db);
    } catch {}

    // 3. Append to system audit log
    logAuditAction({
      userId: 'system-resend',
      userName: 'Resend Email Engine',
      userRole: 'service',
      action: record.status === 'sent' ? 'EMAIL_DISPATCHED' : 'EMAIL_DISPATCH_FAILED',
      entityType: 'email',
      entityId: record.resendId || record.id,
      details: {
        recipient: record.recipient,
        subject: record.subject,
        template: record.template,
        status: record.status
      }
    });
  }

  /**
   * Retrieves recent email dispatch logs filtered by tenant
   */
  public async getRecentLogs(tenantId: string = 'tenant-alm-nexus', limit: number = 50): Promise<any[]> {
    const pool = getNeonPool();
    if (pool) {
      try {
        const res = await pool.query(
          `SELECT * FROM resend_email_logs
           WHERE tenant_id = $1 OR tenant_id = 'tenant-global'
           ORDER BY created_at DESC
           LIMIT $2`,
          [tenantId, limit]
        );
        if (res.rows && res.rows.length > 0) {
          return res.rows;
        }
      } catch {}
    }

    const db = getDB();
    const logs = Array.isArray(db.resendEmailLogs) ? db.resendEmailLogs : [];
    return logs
      .filter((l: any) => l.tenantId === tenantId || l.tenantId === 'tenant-global' || tenantId === 'tenant-global')
      .slice(0, limit);
  }
}

export const resendService = new ResendServiceManager();

// Export convenience functions
export const sendEmail = (options: SendEmailOptions) => resendService.sendEmail(options);
export const testResendConnection = () => resendService.testConnection();
export const getResendClient = () => resendService.getClient();
