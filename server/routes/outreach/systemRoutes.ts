import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middlewares/auth';
import { getOutreachPool } from '../../services/outreach/schema';
import { getQueueStats, enqueue, isQueueRunning } from '../../services/outreach/queue';
import { isEncryptionConfigured } from '../../services/outreach/crypto';
import { logger } from '../../logger';

export const outreachSystemRouter = Router();

// Zod Schema for test job trigger
const testJobSchema = z.object({
  shouldFail: z.boolean().optional(),
  reason: z.string().max(255).optional(),
  type: z.string().max(64).optional()
});

/**
 * GET /api/outreach/system/health
 * Public or authenticated probe for Outreach Suite database & worker status.
 */
outreachSystemRouter.get('/health', (req, res: Response) => {
  const pool = getOutreachPool();
  const postgresConnected = Boolean(pool);
  const queueRunning = isQueueRunning();
  const encryptionConfigured = isEncryptionConfigured();

  res.json({
    success: true,
    data: {
      module: 'LeadFlow Outreach Suite',
      postgresConnected,
      queueRunning,
      encryptionConfigured,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/outreach/system/queue
 * Admin-only endpoint returning queue counts by status and type.
 */
outreachSystemRouter.get(
  '/queue',
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getOutreachPool();
      if (!pool) {
        return res.status(503).json({
          success: false,
          error: 'PostgreSQL required: Queue engine requires an active PostgreSQL connection.'
        });
      }

      const tenantId = req.user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
      const stats = await getQueueStats(pool, tenantId);

      return res.json({
        success: true,
        data: {
          tenantId,
          workerRunning: isQueueRunning(),
          stats
        }
      });
    } catch (err: any) {
      logger.error('Failed to retrieve outreach queue stats', { details: err?.message });
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to retrieve queue statistics'
      });
    }
  }
);

/**
 * POST /api/outreach/system/queue/test-job
 * Admin-only temporary test endpoint to enqueue a test job and verify queue execution & retries.
 */
outreachSystemRouter.post(
  '/queue/test-job',
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = testJobSchema.safeParse(req.body);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        return res.status(400).json({
          success: false,
          error: errorMsg
        });
      }

      const pool = getOutreachPool();
      if (!pool) {
        return res.status(503).json({
          success: false,
          error: 'PostgreSQL required: Cannot enqueue jobs without an active PostgreSQL database.'
        });
      }

      const tenantId = req.user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
      const { shouldFail = false, reason = 'Simulated test failure', type = 'system.test_job' } = parsed.data;

      const jobId = await enqueue(
        type,
        {
          shouldFail,
          reason,
          enqueuedAt: new Date().toISOString(),
          requestedBy: req.user?.id || 'admin'
        },
        {
          tenantId,
          pool,
          maxAttempts: shouldFail ? 3 : 5
        }
      );

      return res.json({
        success: true,
        data: {
          jobId,
          tenantId,
          type,
          shouldFail,
          status: 'pending',
          message: shouldFail
            ? 'Test job enqueued with deliberate failure to test retry backoff.'
            : 'Test job enqueued for immediate execution.'
        }
      });
    } catch (err: any) {
      logger.error('Failed to enqueue test job', { details: err?.message });
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to enqueue test job'
      });
    }
  }
);
