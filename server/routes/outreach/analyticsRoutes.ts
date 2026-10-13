import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../../middlewares/auth';
import { getOutreachPool } from '../../services/outreach/schema';
import {
  getOutreachAnalytics,
  rollupDailyAnalytics,
  exportAnalyticsCsv
} from '../../services/outreach/analytics';
import {
  autoOptimiseStepVariants,
  validateSequenceCycles
} from '../../services/outreach/branching';
import { logger } from '../../logger';

export const analyticsRouter = Router();

function getPoolOrThrow() {
  const pool = getOutreachPool();
  if (!pool) {
    throw new Error('PostgreSQL database required for Outreach Analytics');
  }
  return pool;
}

// 1. GET /api/outreach/analytics/overview
analyticsRouter.get('/analytics/overview', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();

    const { campaignId, mailboxId, variantId, dateRange, startDate, endDate } = req.query as Record<string, string>;

    const data = await getOutreachAnalytics(
      tenantId,
      {
        campaignId,
        mailboxId,
        variantId,
        dateRange: (dateRange as any) || '30d',
        startDate,
        endDate
      },
      pool
    );

    res.json({
      success: true,
      data
    });
  } catch (err: any) {
    logger.error('Failed to get outreach analytics overview', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. GET /api/outreach/analytics/export-csv
analyticsRouter.get('/analytics/export-csv', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();

    const { campaignId, mailboxId, variantId, dateRange, startDate, endDate } = req.query as Record<string, string>;

    const csvContent = await exportAnalyticsCsv(
      tenantId,
      {
        campaignId,
        mailboxId,
        variantId,
        dateRange: (dateRange as any) || '30d',
        startDate,
        endDate
      },
      pool
    );

    const filename = `outreach-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err: any) {
    logger.error('Failed to export analytics CSV', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/outreach/analytics/rollup - Trigger daily analytics rollup
analyticsRouter.post('/analytics/rollup', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();
    const { date } = req.body || {};

    const result = await rollupDailyAnalytics(tenantId, date, pool);

    res.json({
      success: true,
      message: `Analytics rollup complete for ${result.date}`,
      data: result
    });
  } catch (err: any) {
    logger.error('Failed to execute analytics rollup', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/outreach/campaigns/:id/steps/:stepId/auto-optimise
analyticsRouter.post(
  '/campaigns/:id/steps/:stepId/auto-optimise',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const pool = getPoolOrThrow();
      const { stepId } = req.params;
      const { minSendsThreshold } = req.body || {};

      const result = await autoOptimiseStepVariants(stepId, {
        pool,
        minSendsThreshold: typeof minSendsThreshold === 'number' ? minSendsThreshold : 100
      });

      res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      logger.error('Failed to auto-optimize step variants', { details: { error: err.message } });
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// 5. GET /api/outreach/campaigns/:id/steps/:stepId/optimisation-log
analyticsRouter.get(
  '/campaigns/:id/steps/:stepId/optimisation-log',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const pool = getPoolOrThrow();
      const { stepId } = req.params;

      const stepRes = await pool.query(
        `SELECT id, step_number, auto_optimise, optimization_log FROM ox_steps WHERE id = $1`,
        [stepId]
      );

      if (stepRes.rowCount === 0) {
        res.status(404).json({ success: false, error: 'Step not found' });
        return;
      }

      const log = stepRes.rows[0].optimization_log || [];
      res.json({
        success: true,
        data: {
          stepId,
          autoOptimise: stepRes.rows[0].auto_optimise,
          log: typeof log === 'string' ? JSON.parse(log) : log
        }
      });
    } catch (err: any) {
      logger.error('Failed to get step optimization log', { details: { error: err.message } });
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// 6. POST /api/outreach/sequences/validate - Check for circular loops
analyticsRouter.post('/sequences/validate', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { steps } = req.body || {};
    if (!Array.isArray(steps)) {
      res.status(400).json({ success: false, error: 'steps array is required' });
      return;
    }

    const validation = validateSequenceCycles(steps);
    res.json({
      success: true,
      data: validation
    });
  } catch (err: any) {
    logger.error('Failed to validate sequence cycles', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});
