import crypto from 'node:crypto';
import pg from 'pg';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';

export interface OutreachJob {
  id: string;
  tenant_id: string;
  type: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  run_at: Date;
  locked_at: Date | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export type JobHandler = (job: OutreachJob) => Promise<void>;

const jobHandlers = new Map<string, JobHandler>();

let workerIntervalId: NodeJS.Timeout | null = null;
let isWorkerRunning = false;
let isProcessingTick = false;

/**
 * Register a handler function for an outreach queue job type.
 */
export function registerHandler(type: string, fn: JobHandler): void {
  jobHandlers.set(type, fn);
  logger.info(`Registered outreach job handler for type "${type}"`, {
    context: 'OutreachQueue'
  });
}

/**
 * Enqueues a new background job into the durable PostgreSQL ox_jobs table.
 */
export async function enqueue(
  type: string,
  payload: any,
  options: {
    tenantId: string;
    runAt?: Date;
    maxAttempts?: number;
    pool?: pg.Pool;
  }
): Promise<string> {
  const targetPool = options.pool || getOutreachPool();
  if (!targetPool) {
    throw new Error('Cannot enqueue job: PostgreSQL connection pool is not available.');
  }

  const id = `job_${crypto.randomUUID()}`;
  const runAt = options.runAt || new Date();
  const maxAttempts = options.maxAttempts ?? 5;

  const query = `
    INSERT INTO ox_jobs (id, tenant_id, type, payload, status, run_at, max_attempts, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW(), NOW())
    RETURNING id;
  `;

  const values = [
    id,
    options.tenantId,
    type,
    JSON.stringify(payload || {}),
    runAt,
    maxAttempts
  ];

  await targetPool.query(query, values);
  return id;
}

/**
 * Recovers stuck jobs in 'processing' status whose lock has expired (> 10 minutes).
 */
export async function recoverStuckJobs(pool: pg.Pool): Promise<number> {
  const query = `
    UPDATE ox_jobs
    SET status = 'pending', locked_at = NULL, updated_at = NOW()
    WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '10 minutes'
    RETURNING id;
  `;
  try {
    const res = await pool.query(query);
    if (res.rowCount && res.rowCount > 0) {
      logger.warn(`Recovered ${res.rowCount} stuck outreach jobs back to pending.`, {
        context: 'OutreachQueue',
        details: { recoveredCount: res.rowCount }
      });
      return res.rowCount;
    }
  } catch (err: any) {
    logger.error('Error recovering stuck outreach jobs', {
      context: 'OutreachQueue',
      details: err?.message
    });
  }
  return 0;
}

/**
 * Claims and executes a batch of pending due jobs using FOR UPDATE SKIP LOCKED.
 */
export async function processQueueTick(pool: pg.Pool, batchSize: number = 10): Promise<void> {
  if (isProcessingTick) return;
  isProcessingTick = true;

  try {
    // 1. Recover any stale locks
    await recoverStuckJobs(pool);

    // 2. Claim up to N due jobs atomically
    const claimQuery = `
      UPDATE ox_jobs
      SET status = 'processing', locked_at = NOW(), attempts = attempts + 1, updated_at = NOW()
      WHERE id IN (
        SELECT id FROM ox_jobs
        WHERE status = 'pending' AND run_at <= NOW()
        ORDER BY run_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      )
      RETURNING *;
    `;

    const result = await pool.query(claimQuery, [batchSize]);
    const claimedJobs: OutreachJob[] = result.rows;

    if (!claimedJobs || claimedJobs.length === 0) {
      return;
    }

    // 3. Process claimed jobs concurrently
    await Promise.allSettled(
      claimedJobs.map(async (job) => {
        const handler = jobHandlers.get(job.type);

        if (!handler) {
          logger.error(`No handler registered for outreach job type "${job.type}"`, {
            context: 'OutreachQueue',
            details: { jobId: job.id, type: job.type }
          });

          await pool.query(
            `UPDATE ox_jobs
             SET status = 'failed', locked_at = NULL, last_error = $2, updated_at = NOW()
             WHERE id = $1`,
            [job.id, `No handler registered for type "${job.type}"`]
          );
          return;
        }

        try {
          // Parse JSON payload if string
          const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
          await handler({ ...job, payload });

          // Success: Mark completed
          await pool.query(
            `UPDATE ox_jobs
             SET status = 'completed', locked_at = NULL, updated_at = NOW()
             WHERE id = $1`,
            [job.id]
          );
        } catch (jobErr: any) {
          const errorMessage = jobErr?.message || String(jobErr);
          const currentAttempts = job.attempts;
          const maxAttempts = job.max_attempts;

          logger.warn(`Outreach job failed on attempt ${currentAttempts}/${maxAttempts}`, {
            context: 'OutreachQueue',
            details: { jobId: job.id, type: job.type, error: errorMessage }
          });

          if (currentAttempts >= maxAttempts) {
            // Max attempts exhausted: Mark failed
            await pool.query(
              `UPDATE ox_jobs
               SET status = 'failed', locked_at = NULL, last_error = $2, updated_at = NOW()
               WHERE id = $1`,
              [job.id, errorMessage]
            );
          } else {
            // Exponential backoff: 30s * 2^(attempts-1), capped at 3600 seconds (1 hour)
            const backoffSeconds = Math.min(3600, 30 * Math.pow(2, Math.max(0, currentAttempts - 1)));
            const nextRunAt = new Date(Date.now() + backoffSeconds * 1000);

            await pool.query(
              `UPDATE ox_jobs
               SET status = 'pending', locked_at = NULL, run_at = $2, last_error = $3, updated_at = NOW()
               WHERE id = $1`,
              [job.id, nextRunAt, errorMessage]
            );
          }
        }
      })
    );
  } catch (tickErr: any) {
    logger.error('Error during outreach queue tick', {
      context: 'OutreachQueue',
      details: tickErr?.message
    });
  } finally {
    isProcessingTick = false;
  }
}

/**
 * Starts the durable PostgreSQL background queue worker loop.
 */
export function startQueueWorker(pool: pg.Pool): void {
  if (isWorkerRunning) {
    return;
  }

  const intervalMs = parseInt(process.env.OUTREACH_WORKER_INTERVAL_MS || '5000', 10);
  const batchSize = parseInt(process.env.OUTREACH_WORKER_BATCH_SIZE || '10', 10);

  isWorkerRunning = true;
  logger.info(`Starting Outreach Suite durable queue worker (interval: ${intervalMs}ms, batchSize: ${batchSize})`, {
    context: 'OutreachQueue'
  });

  // Execute first tick immediately
  processQueueTick(pool, batchSize).catch(() => {});

  workerIntervalId = setInterval(() => {
    processQueueTick(pool, batchSize).catch(() => {});
  }, intervalMs);

  if (workerIntervalId.unref) {
    workerIntervalId.unref();
  }
}

/**
 * Stops the queue worker loop cleanly.
 */
export function stopQueueWorker(): void {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
  }
  isWorkerRunning = false;
  logger.info('Outreach Suite queue worker stopped.', { context: 'OutreachQueue' });
}

export function isQueueRunning(): boolean {
  return isWorkerRunning;
}

/**
 * Returns aggregated queue stats by status and type.
 */
export async function getQueueStats(
  pool: pg.Pool,
  tenantId?: string
): Promise<{
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  total: number;
}> {
  const whereClause = tenantId ? 'WHERE tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];

  const [statusRes, typeRes] = await Promise.all([
    pool.query(
      `SELECT status, COUNT(*)::int as count FROM ox_jobs ${whereClause} GROUP BY status`,
      params
    ),
    pool.query(
      `SELECT type, COUNT(*)::int as count FROM ox_jobs ${whereClause} GROUP BY type`,
      params
    )
  ]);

  const byStatus: Record<string, number> = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };
  let total = 0;

  for (const row of statusRes.rows) {
    byStatus[row.status] = row.count;
    total += row.count;
  }

  const byType: Record<string, number> = {};
  for (const row of typeRes.rows) {
    byType[row.type] = row.count;
  }

  return { byStatus, byType, total };
}

// Register built-in test job handler for Phase 0 verification & health checks
registerHandler('system.test_job', async (job) => {
  const { shouldFail, reason } = job.payload || {};
  if (shouldFail) {
    throw new Error(reason || 'Simulated failure for retry verification');
  }
  logger.info(`Executed test job ${job.id} successfully.`, {
    context: 'OutreachQueue',
    details: { payload: job.payload }
  });
});

// Register periodic mailbox sync job
registerHandler('sync_mailbox_status', async (job) => {
  const pool = getOutreachPool();
  if (pool) {
    const { syncAllMailboxesStatus } = await import('./mailboxService');
    await syncAllMailboxesStatus(pool);
  }
});

