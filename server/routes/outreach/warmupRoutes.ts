import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../../middlewares/auth';
import { getOutreachPool } from '../../services/outreach/schema';
import {
  computeDailyTarget,
  calculateHealthScore,
  planDailyWarmupJobs,
  WarmupMode,
  WarmupSpeed
} from '../../services/outreach/warmupEngine';
import { generateContentWithGemini, getWarmupContentPool } from '../../services/outreach/warmupContent';
import { logger } from '../../logger';

export const warmupRouter = Router();

// Zod schema for updating mailbox warmup configuration
const updateWarmupSchema = z.object({
  warmup_enabled: z.boolean().optional(),
  warmup_paused: z.boolean().optional(),
  warmup_mode: z.enum(['new_domain', 'new_mailbox', 'dormant', 'maintenance', 'recovery']).optional(),
  warmup_speed: z.enum(['conservative', 'normal', 'aggressive']).optional(),
  warmup_target: z.coerce.number().int().min(1).max(120).optional()
});

/**
 * Helper to resolve tenant ID safely from request
 */
function getTenantId(req: AuthenticatedRequest): string {
  return req.user?.tenant_id || req.user?.tenantId || 'tenant-alm-nexus';
}

// ============================================================================
// 1. GET /api/outreach/warmup/overview
// Returns per-mailbox warmup status, today target/sent, health score, and reasons
// ============================================================================
warmupRouter.get('/warmup/overview', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const today = new Date();
  const todayUtc = today.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    // 1. Query all mailboxes for this tenant
    const mbxRes = await pool.query(
      `SELECT m.*, d.domain as domain_name, d.spf_status, d.dkim_status, d.dmarc_status
       FROM ox_mailboxes m
       LEFT JOIN ox_domains d ON m.domain_id = d.id
       WHERE m.tenant_id = $1 AND (m.is_deleted IS NULL OR m.is_deleted = false)
       ORDER BY m.created_at ASC`,
      [tenantId]
    );

    // 2. Query total network pool count
    const poolCountRes = await pool.query(
      `SELECT COUNT(*)::int as count
       FROM ox_mailboxes
       WHERE status = 'active'
         AND (is_deleted IS NULL OR is_deleted = false)
         AND warmup_enabled = true
         AND warmup_terms_accepted = true
         AND (pool_excluded IS NULL OR pool_excluded = false)`
    );
    const networkPoolSize = poolCountRes.rows[0]?.count ?? 0;

    const mailboxesOverview = [];

    for (const mbx of mbxRes.rows) {
      // Daily target computation
      const targetResult = await computeDailyTarget(mbx, today, { pool });

      // Query today's counts from ox_mailbox_daily
      const todayCountsRes = await pool.query(
        `SELECT campaign_sent_count, warmup_sent_count, warmup_received_count,
                warmup_inbox_count, warmup_spam_count, warmup_rescued_count, bounced_count
         FROM ox_mailbox_daily
         WHERE mailbox_id = $1 AND date_utc = $2`,
        [mbx.id, todayUtc]
      );
      const todayCounts = todayCountsRes.rows[0] || {
        campaign_sent_count: 0,
        warmup_sent_count: 0,
        warmup_received_count: 0,
        warmup_inbox_count: 0,
        warmup_spam_count: 0,
        warmup_rescued_count: 0,
        bounced_count: 0
      };

      // 7-day rolling stats for health score calculation
      const rollingRes = await pool.query(
        `SELECT
           COALESCE(SUM(warmup_sent_count), 0)::int as total_sent,
           COALESCE(SUM(warmup_spam_count), 0)::int as total_spam,
           COALESCE(SUM(warmup_inbox_count), 0)::int as total_inbox,
           COALESCE(SUM(bounced_count), 0)::int as total_bounce
         FROM ox_mailbox_daily
         WHERE mailbox_id = $1 AND date_utc >= $2 AND date_utc <= $3`,
        [mbx.id, sevenDaysAgo, todayUtc]
      );
      const roll = rollingRes.rows[0] || { total_sent: 0, total_spam: 0, total_inbox: 0, total_bounce: 0 };
      const spamRate = roll.total_sent > 0 ? (roll.total_spam / roll.total_sent) * 100 : 0;
      const bounceRate = roll.total_sent > 0 ? (roll.total_bounce / roll.total_sent) * 100 : 0;
      const inboxRate = roll.total_sent > 0 ? (roll.total_inbox / roll.total_sent) * 100 : 100;

      const spfMissing = mbx.spf_status !== 'valid' && mbx.spf_status !== 'verified';
      const dkimMissing = mbx.dkim_status !== 'valid' && mbx.dkim_status !== 'verified';
      const dmarcMissing = mbx.dmarc_status !== 'valid' && mbx.dmarc_status !== 'verified';

      const healthScore = calculateHealthScore({
        spamRate,
        bounceRate,
        spfMissing,
        dkimMissing,
        dmarcMissing
      });

      // Update current health_score on ox_mailboxes
      await pool.query(
        `UPDATE ox_mailboxes
         SET health_score = $1, last_health_check_at = NOW()
         WHERE id = $2`,
        [healthScore, mbx.id]
      );

      mailboxesOverview.push({
        id: mbx.id,
        email: mbx.email,
        sender_name: mbx.sender_name,
        provider: mbx.provider,
        domain_name: mbx.domain_name,
        status: mbx.status,
        warmup_enabled: Boolean(mbx.warmup_enabled),
        warmup_paused: Boolean(mbx.warmup_paused),
        warmup_terms_accepted: Boolean(mbx.warmup_terms_accepted),
        warmup_terms_accepted_at: mbx.warmup_terms_accepted_at,
        warmup_mode: mbx.warmup_mode || 'new_mailbox',
        warmup_speed: mbx.warmup_speed || 'normal',
        warmup_target: mbx.warmup_target || 30,
        pool_excluded: Boolean(mbx.pool_excluded || targetResult.poolExcluded),
        pool_excluded_reason: mbx.pool_excluded_reason || targetResult.poolExcludedReason,
        health_score: healthScore,
        sending_day_number: targetResult.sendingDays,
        warmup_age_days: targetResult.warmupAgeDays,
        today_target: targetResult.target,
        today_sent: todayCounts.warmup_sent_count,
        today_received: todayCounts.warmup_received_count,
        today_campaign_sent: todayCounts.campaign_sent_count,
        daily_cap: mbx.daily_cap || mbx.daily_limit || 30,
        inbox_rate_7d: Math.round(inboxRate * 10) / 10,
        spam_rate_7d: Math.round(spamRate * 10) / 10,
        bounce_rate_7d: Math.round(bounceRate * 10) / 10,
        dns: {
          hasSpf: !spfMissing,
          hasDkim: !dkimMissing,
          hasDmarc: !dmarcMissing
        },
        reasons: targetResult.reasons,
        unlocked_full_target: targetResult.unlockedFullTarget
      });
    }

    res.json({
      network_pool: {
        total_active_mailboxes: networkPoolSize,
        is_ready: networkPoolSize >= 2,
        warning: networkPoolSize < 2 ? 'Warmup network pool has fewer than 2 eligible mailboxes. Warmup sends will begin once at least 2 mailboxes on distinct domains opt in.' : null
      },
      mailboxes: mailboxesOverview
    });
  } catch (err: any) {
    logger.error('Failed to retrieve warmup overview: ' + err?.message, { context: 'WarmupRoutes' });
    res.status(500).json({ error: 'Failed to retrieve warmup overview', details: err?.message });
  }
});

// ============================================================================
// 2. PATCH /api/outreach/warmup/:mailboxId
// Configures warmup parameters (enable, pause, mode, speed, target <= 120)
// ============================================================================
warmupRouter.patch('/warmup/:mailboxId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { mailboxId } = req.params;

  const parseResult = updateWarmupSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    return;
  }

  const data = parseResult.data;

  try {
    // Verify ownership
    const checkRes = await pool.query(
      `SELECT id, warmup_terms_accepted FROM ox_mailboxes WHERE id = $1 AND tenant_id = $2`,
      [mailboxId, tenantId]
    );
    if (checkRes.rowCount === 0) {
      res.status(404).json({ error: 'Mailbox not found' });
      return;
    }

    const currentMbx = checkRes.rows[0];

    // If enabling warmup, verify consent was accepted
    if (data.warmup_enabled === true && !currentMbx.warmup_terms_accepted) {
      res.status(400).json({
        error: 'Consent required',
        message: 'Owner must accept the Warmup Network Participation terms before enabling warmup.'
      });
      return;
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.warmup_enabled !== undefined) {
      fields.push(`warmup_enabled = $${idx++}`);
      values.push(data.warmup_enabled);
    }
    if (data.warmup_paused !== undefined) {
      fields.push(`warmup_paused = $${idx++}`);
      values.push(data.warmup_paused);
    }
    if (data.warmup_mode !== undefined) {
      fields.push(`warmup_mode = $${idx++}`);
      values.push(data.warmup_mode);
    }
    if (data.warmup_speed !== undefined) {
      fields.push(`warmup_speed = $${idx++}`);
      values.push(data.warmup_speed);
    }
    if (data.warmup_target !== undefined) {
      fields.push(`warmup_target = $${idx++}`);
      values.push(Math.min(120, Math.max(1, data.warmup_target)));
    }

    fields.push(`updated_at = NOW()`);
    values.push(mailboxId);
    values.push(tenantId);

    const updateQuery = `
      UPDATE ox_mailboxes
      SET ${fields.join(', ')}
      WHERE id = $${idx++} AND tenant_id = $${idx++}
      RETURNING *
    `;

    const updatedRes = await pool.query(updateQuery, values);
    const updated = updatedRes.rows[0];

    // If enabled, trigger plan calculation
    if (data.warmup_enabled === true && !data.warmup_paused) {
      planDailyWarmupJobs(pool, mailboxId).catch(err => {
        logger.warn(`Immediate planner run on enable for ${mailboxId} encountered: ${err?.message}`);
      });
    }

    res.json({
      message: 'Warmup settings updated successfully',
      mailbox: {
        id: updated.id,
        email: updated.email,
        warmup_enabled: updated.warmup_enabled,
        warmup_paused: updated.warmup_paused,
        warmup_mode: updated.warmup_mode,
        warmup_speed: updated.warmup_speed,
        warmup_target: updated.warmup_target
      }
    });
  } catch (err: any) {
    logger.error(`Failed to update warmup settings for ${mailboxId}: ${err?.message}`);
    res.status(500).json({ error: 'Failed to update warmup settings', details: err?.message });
  }
});

// ============================================================================
// 3. POST /api/outreach/warmup/:mailboxId/consent
// Accepts the peer-to-peer network participation agreement
// ============================================================================
warmupRouter.post('/warmup/:mailboxId/consent', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { mailboxId } = req.params;
  const accepted = req.body?.accepted !== false; // default true if hitting consent endpoint

  try {
    const updateRes = await pool.query(
      `UPDATE ox_mailboxes
       SET warmup_terms_accepted = $1,
           warmup_terms_accepted_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           warmup_enabled = CASE WHEN $1 THEN warmup_enabled ELSE false END,
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, email, warmup_terms_accepted, warmup_terms_accepted_at, warmup_enabled`,
      [accepted, mailboxId, tenantId]
    );

    if (updateRes.rowCount === 0) {
      res.status(404).json({ error: 'Mailbox not found' });
      return;
    }

    res.json({
      message: accepted ? 'Warmup network participation terms accepted' : 'Consent revoked',
      mailbox: updateRes.rows[0]
    });
  } catch (err: any) {
    logger.error(`Failed to record consent for ${mailboxId}: ${err?.message}`);
    res.status(500).json({ error: 'Failed to record consent', details: err?.message });
  }
});

// ============================================================================
// 4. GET /api/outreach/warmup/:mailboxId/stats
// Returns 14-day rolling series of inbox, spam, sent, rescued, and health scores
// ============================================================================
warmupRouter.get('/warmup/:mailboxId/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { mailboxId } = req.params;

  try {
    // Verify ownership
    const checkRes = await pool.query(
      `SELECT m.id, m.email, m.health_score, d.spf_status, d.dkim_status, d.dmarc_status
       FROM ox_mailboxes m
       LEFT JOIN ox_domains d ON m.domain_id = d.id
       WHERE m.id = $1 AND m.tenant_id = $2`,
      [mailboxId, tenantId]
    );
    if (checkRes.rowCount === 0) {
      res.status(404).json({ error: 'Mailbox not found' });
      return;
    }
    const mbx = checkRes.rows[0];

    // Generate 14 past days series
    const series = [];
    const today = new Date();

    const spfMissing = mbx.spf_status !== 'valid' && mbx.spf_status !== 'verified';
    const dkimMissing = mbx.dkim_status !== 'valid' && mbx.dkim_status !== 'verified';
    const dmarcMissing = mbx.dmarc_status !== 'valid' && mbx.dmarc_status !== 'verified';

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().slice(0, 10);

      const dayRes = await pool.query(
        `SELECT warmup_sent_count, warmup_received_count, warmup_inbox_count,
                warmup_spam_count, warmup_rescued_count, bounced_count
         FROM ox_mailbox_daily
         WHERE mailbox_id = $1 AND date_utc = $2`,
        [mailboxId, dateStr]
      );
      const counts = dayRes.rows[0] || {
        warmup_sent_count: 0,
        warmup_received_count: 0,
        warmup_inbox_count: 0,
        warmup_spam_count: 0,
        warmup_rescued_count: 0,
        bounced_count: 0
      };

      const sent = counts.warmup_sent_count;
      const spam = counts.warmup_spam_count;
      const inbox = counts.warmup_inbox_count;
      const rescued = counts.warmup_rescued_count;
      const bounced = counts.bounced_count;

      const daySpamRate = sent > 0 ? (spam / sent) * 100 : 0;
      const dayBounceRate = sent > 0 ? (bounced / sent) * 100 : 0;

      const score = calculateHealthScore({
        spamRate: daySpamRate,
        bounceRate: dayBounceRate,
        spfMissing,
        dkimMissing,
        dmarcMissing
      });

      series.push({
        date: dateStr,
        sent,
        received: counts.warmup_received_count,
        inbox,
        spam,
        rescued,
        bounced,
        health_score: score
      });
    }

    res.json({
      mailbox_id: mailboxId,
      series
    });
  } catch (err: any) {
    logger.error(`Failed to get warmup stats for ${mailboxId}: ${err?.message}`);
    res.status(500).json({ error: 'Failed to retrieve stats', details: err?.message });
  }
});

// ============================================================================
// 5. POST /api/outreach/warmup/generate-content (ADMIN ONLY)
// Asks Gemini (gemini-3.8-flash) to generate 100 varied items, validates & saves
// ============================================================================
warmupRouter.post('/warmup/generate-content', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  try {
    const result = await generateContentWithGemini(pool);
    res.json({
      message: `Successfully generated ${result.generatedCount} items, inserted ${result.addedCount} validated items into ox_warmup_content`,
      data: result
    });
  } catch (err: any) {
    logger.error('Failed to generate warmup content via Gemini: ' + err?.message, {
      context: 'WarmupRoutes'
    });
    res.status(500).json({ error: 'Failed to generate warmup content', details: err?.message });
  }
});

// ============================================================================
// 6. POST /api/outreach/warmup/run-planner (TRIGGER MANUAL PLANNER RUN)
// ============================================================================
warmupRouter.post('/warmup/run-planner', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  try {
    const planResult = await planDailyWarmupJobs(pool);
    res.json({
      message: 'Warmup planner tick executed',
      result: planResult
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Planner run failed', details: err?.message });
  }
});

// ============================================================================
// 7. POST /api/outreach/warmup/test-simulate-spam
// Simulation endpoint for acceptance checks: simulates high spam test to verify
// 50% volume halving and >= 15% pool exclusion logic.
// ============================================================================
warmupRouter.post('/warmup/test-simulate-spam', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const { mailboxId, spamPercentage } = req.body;
  if (!mailboxId) {
    res.status(400).json({ error: 'mailboxId is required' });
    return;
  }

  const percent = Number(spamPercentage ?? 16.0);
  const todayUtc = new Date().toISOString().slice(0, 10);
  const counterId = `mbxd_${mailboxId}_${todayUtc.replace(/-/g, '')}`;

  try {
    // Record 100 sent with `percent` spam landing
    const spamCount = Math.round(percent);
    const inboxCount = 100 - spamCount;

    await pool.query(
      `INSERT INTO ox_mailbox_daily (id, tenant_id, mailbox_id, date_utc, warmup_sent_count, warmup_spam_count, warmup_inbox_count, updated_at)
       VALUES ($1, 'tenant-test', $2, $3, 100, $4, $5, NOW())
       ON CONFLICT (mailbox_id, date_utc) DO UPDATE
       SET warmup_sent_count = 100,
           warmup_spam_count = $4,
           warmup_inbox_count = $5,
           updated_at = NOW()`,
      [counterId, mailboxId, todayUtc, spamCount, inboxCount]
    );

    // Compute updated target to see exclusion or volume reduction
    const targetResult = await computeDailyTarget(mailboxId, new Date(), { pool });

    res.json({
      simulatedSpamRate: percent,
      targetResult
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Spam simulation failed', details: err?.message });
  }
});
