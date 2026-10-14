import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import {
  createTenantApiKey,
  listTenantApiKeys,
  deleteTenantApiKey,
  ApiScope
} from '../../../services/outreach/apiKeys';
import {
  createWebhookEndpoint,
  listWebhookEndpoints,
  deleteWebhookEndpoint,
  listWebhookDeliveries,
  replayWebhookDelivery,
  deliverWebhook
} from '../../../services/outreach/webhooks';
import { requireApiKeyScope, idempotencyMiddleware } from '../../../middlewares/apiKeyAuth';
import { authenticateToken } from '../../../middlewares/auth';
import { getOutreachPool } from '../../../services/outreach/schema';
import { getTenantUsageSummary, getTenantPlan } from '../../../services/outreach/plans';
import { verifySingleEmail } from '../../../services/outreach/verifier';
import { checkDomainDnsStatus } from '../../../services/outreach/dnsCheck';
import { validateSequenceCycles } from '../../../services/outreach/branching';
import { enqueueOutreachJob } from '../../../services/outreach/queue';

export const restV1Router = express.Router();

// Helper to support both API Key (lf_...) and UI Session Token
function flexAuth(requiredScope: ApiScope = '*', options: { isWrite?: boolean; isBulk?: boolean } = {}) {
  const apiKeyMiddleware = requireApiKeyScope(requiredScope, options);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization || '';
    const customKey = (req.headers['x-api-key'] as string) || '';

    if (authHeader.startsWith('Bearer lf_') || customKey.startsWith('lf_') || authHeader.startsWith('lf_')) {
      return apiKeyMiddleware(req, res, next);
    }

    // Fall back to UI session authentication
    authenticateToken(req, res, () => {
      const u = (req as any).user;
      req.tenantId = u?.tenant_id || u?.tenantId || 'tenant-alm-nexus';
      next();
    });
  };
}

// Global Idempotency middleware for POST requests
restV1Router.use(idempotencyMiddleware);

// ============================================================================
// 1. API KEYS ENDPOINTS
// ============================================================================

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional()
});

restV1Router.post('/api-keys', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = CreateApiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_params', details: parsed.error.issues });
      return;
    }
    const tenantId = req.tenantId || 'tenant-alm-nexus';
    const perms = parsed.data.scopes || parsed.data.permissions || ['*'];
    const result = await createTenantApiKey(tenantId, parsed.data.name, perms);
    res.status(201).json({
      success: true,
      apiKey: result.apiKey,
      keyInfo: result.keyInfo,
      message: 'Store this API key securely. It will never be displayed again.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});

restV1Router.get('/api-keys', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId || 'tenant-alm-nexus';
    const keys = await listTenantApiKeys(tenantId);
    res.json({ success: true, keys });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});

restV1Router.delete('/api-keys/:id', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId || 'tenant-alm-nexus';
    const success = await deleteTenantApiKey(tenantId, req.params.id);
    if (!success) {
      res.status(404).json({ error: 'not_found', message: 'API key not found' });
      return;
    }
    res.json({ success: true, message: 'API key revoked' });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});

// ============================================================================
// 2. WEBHOOKS ENDPOINTS
// ============================================================================

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).optional(),
  secret: z.string().optional()
});

restV1Router.post('/webhooks', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = CreateWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_params', details: parsed.error.issues });
      return;
    }
    const tenantId = req.tenantId || 'tenant-alm-nexus';
    const hook = await createWebhookEndpoint(tenantId, parsed.data);
    res.status(201).json({ success: true, webhook: hook });
  } catch (err: any) {
    res.status(400).json({ error: 'invalid_params', message: err?.message });
  }
});

restV1Router.get('/webhooks', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId || 'tenant-alm-nexus';
    const hooks = await listWebhookEndpoints(tenantId);
    res.json({ success: true, webhooks: hooks });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});

restV1Router.delete('/webhooks/:id', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId || 'tenant-alm-nexus';
    const success = await deleteWebhookEndpoint(tenantId, req.params.id);
    if (!success) {
      res.status(404).json({ error: 'not_found', message: 'Webhook not found' });
      return;
    }
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});

restV1Router.get('/webhooks/deliveries', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId || 'tenant-alm-nexus';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const deliveries = await listWebhookDeliveries(tenantId, undefined, limit);
    res.json({ success: true, deliveries });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});

restV1Router.get('/webhooks/:id/deliveries', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId || 'tenant-alm-nexus';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const webhookId = req.params.id === 'all' ? undefined : req.params.id;
    const deliveries = await listWebhookDeliveries(tenantId, webhookId, limit);
    res.json({ success: true, deliveries });
  } catch (err: any) {
    res.status(500).json({ error: 'internal_error', message: err?.message });
  }
});

restV1Router.post('/webhooks/deliveries/:deliveryId/replay', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenantId || 'tenant-alm-nexus';
    const replayed = await replayWebhookDelivery(tenantId, req.params.deliveryId);
    res.json({ success: true, replayed });
  } catch (err: any) {
    res.status(404).json({ error: 'not_found', message: err?.message });
  }
});

// ============================================================================
// 3. CAMPAIGNS REST SURFACE
// ============================================================================

restV1Router.get('/campaigns', flexAuth('campaigns:read'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const status = req.query.status as string;
  let q = `SELECT * FROM ox_campaigns WHERE tenant_id = $1`;
  const p: any[] = [tenantId];
  if (status) {
    q += ` AND status = $2`;
    p.push(status);
  }
  q += ` ORDER BY created_at DESC`;
  const campRes = await pool.query(q, p);
  res.json({ success: true, campaigns: campRes.rows });
});

restV1Router.post('/campaigns', flexAuth('campaigns:write'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const name = req.body?.name?.trim();
  if (!name) {
    res.status(400).json({ error: 'invalid_params', message: 'Campaign name is required' });
    return;
  }
  const id = `camp_${crypto.randomUUID()}`;
  const dailyLimit = Number(req.body.daily_limit) || 100;
  const stopOnReply = req.body.stop_on_reply !== false;

  await pool.query(
    `INSERT INTO ox_campaigns (id, tenant_id, name, status, daily_limit, stop_on_reply, created_at, updated_at)
     VALUES ($1, $2, $3, 'draft', $4, $5, NOW(), NOW())`,
    [id, tenantId, name, dailyLimit, stopOnReply]
  );
  res.status(201).json({ success: true, campaign: { id, name, status: 'draft', daily_limit: dailyLimit } });
});

restV1Router.get('/campaigns/:id', flexAuth('campaigns:read'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const campRes = await pool.query(`SELECT * FROM ox_campaigns WHERE id = $1 AND tenant_id = $2`, [
    req.params.id,
    tenantId
  ]);
  if (campRes.rows.length === 0) {
    res.status(404).json({ error: 'not_found', message: 'Campaign not found' });
    return;
  }
  const stepsRes = await pool.query(
    `SELECT s.*, COALESCE(json_agg(v.* ORDER BY v.variant_label ASC) FILTER (WHERE v.id IS NOT NULL), '[]'::json) as variants
     FROM ox_steps s
     LEFT JOIN ox_step_variants v ON s.id = v.step_id
     WHERE s.campaign_id = $1
     GROUP BY s.id
     ORDER BY s.step_number ASC`,
    [req.params.id]
  );
  res.json({ success: true, campaign: campRes.rows[0], steps: stepsRes.rows });
});

restV1Router.post('/campaigns/:id/start', flexAuth('campaigns:write'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const usage = await getTenantUsageSummary(tenantId, pool);
  if (usage.isUpgradeRequired) {
    res.status(403).json({
      error: 'plan_upgrade_required',
      message: 'Monthly email quota reached. Please upgrade your plan to start outreach campaigns.'
    });
    return;
  }

  await pool.query(`UPDATE ox_campaigns SET status = 'active', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [
    req.params.id,
    tenantId
  ]);

  // Enqueue job for background scheduler (not direct send!)
  await enqueueOutreachJob(tenantId, 'campaign.dispatch', { campaignId: req.params.id, mode: 'paced' }, { pool });

  res.json({ success: true, status: 'active', message: 'Campaign activated and queued with Cap Guard pacing.' });
});

restV1Router.post('/campaigns/:id/pause', flexAuth('campaigns:write'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  await pool.query(`UPDATE ox_campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [
    req.params.id,
    tenantId
  ]);
  res.json({ success: true, status: 'paused', message: 'Campaign paused' });
});

restV1Router.post('/campaigns/:id/resume', flexAuth('campaigns:write'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  await pool.query(`UPDATE ox_campaigns SET status = 'active', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [
    req.params.id,
    tenantId
  ]);
  res.json({ success: true, status: 'active', message: 'Campaign resumed' });
});

restV1Router.post('/campaigns/:id/enroll', flexAuth('enrollments:write'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const campaignId = req.params.id;
  const prospectIds: string[] = req.body.prospect_ids || [];

  const s1 = await pool.query(`SELECT id FROM ox_steps WHERE campaign_id = $1 ORDER BY step_number ASC LIMIT 1`, [campaignId]);
  const step1Id = s1.rows[0]?.id || null;

  let enrolled = 0;
  for (const pid of prospectIds) {
    await pool.query(
      `INSERT INTO ox_enrollments (id, tenant_id, campaign_id, prospect_id, current_step_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
       ON CONFLICT (tenant_id, campaign_id, prospect_id) DO NOTHING`,
      [`enr_${crypto.randomUUID()}`, tenantId, campaignId, pid, step1Id]
    );
    enrolled++;
  }
  res.json({ success: true, enrolled });
});

// ============================================================================
// 4. PROSPECTS & VERIFICATION ENDPOINTS
// ============================================================================

restV1Router.get('/prospects', flexAuth('prospects:read'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const resP = await pool.query(
    `SELECT * FROM ox_prospects WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit]
  );
  res.json({ success: true, prospects: resP.rows });
});

restV1Router.post('/prospects', flexAuth('prospects:write'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const email = req.body?.email?.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'invalid_params', message: 'Valid email is required' });
    return;
  }

  const id = `prosp_${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO ox_prospects (id, tenant_id, email, first_name, last_name, company, tags, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'uncontacted', NOW(), NOW())
     ON CONFLICT (tenant_id, email) DO UPDATE
     SET first_name = COALESCE(EXCLUDED.first_name, ox_prospects.first_name),
         last_name = COALESCE(EXCLUDED.last_name, ox_prospects.last_name),
         company = COALESCE(EXCLUDED.company, ox_prospects.company),
         tags = EXCLUDED.tags,
         updated_at = NOW()`,
    [id, tenantId, email, req.body.first_name || null, req.body.last_name || null, req.body.company || null, req.body.tags || []]
  );
  res.status(201).json({ success: true, prospect: { id, email, first_name: req.body.first_name, company: req.body.company } });
});

restV1Router.post('/prospects/bulk', flexAuth('prospects:write', { isBulk: true }), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const list = req.body.prospects;
  if (!Array.isArray(list) || list.length === 0) {
    res.status(400).json({ error: 'invalid_params', message: 'Array of prospects is required' });
    return;
  }

  let imported = 0;
  for (const item of list.slice(0, 1000)) {
    const email = item.email?.trim().toLowerCase();
    if (email && email.includes('@')) {
      await pool.query(
        `INSERT INTO ox_prospects (id, tenant_id, email, first_name, last_name, company, tags, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'uncontacted', NOW(), NOW())
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [`prosp_${crypto.randomUUID()}`, tenantId, email, item.first_name || null, item.last_name || null, item.company || null, item.tags || []]
      );
      imported++;
    }
  }
  res.status(201).json({ success: true, imported, totalSubmitted: list.length });
});

restV1Router.post('/verify', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const email = req.body?.email?.trim();
  if (!email) {
    res.status(400).json({ error: 'invalid_params', message: 'Email address required' });
    return;
  }
  const verification = await verifySingleEmail(email, { tenantId, pool: pool || undefined });
  res.json({ success: true, email, verification });
});

// ============================================================================
// 5. MAILBOXES, WARMUP, SUPPRESSIONS & USAGE
// ============================================================================

restV1Router.get('/mailboxes', flexAuth('mailboxes:read'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const resM = await pool.query(
    `SELECT id, email, sender_name, status, daily_cap, reputation_score, health_status, created_at
     FROM ox_mailboxes WHERE tenant_id = $1 AND (is_deleted IS NULL OR is_deleted = false)`,
    [tenantId]
  );
  res.json({ success: true, mailboxes: resM.rows });
});

restV1Router.get('/mailboxes/:id/health', flexAuth('mailboxes:read'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const resM = await pool.query(
    `SELECT m.*, d.domain, d.spf_status, d.dkim_status, d.dmarc_status, d.mx_status
     FROM ox_mailboxes m
     LEFT JOIN ox_domains d ON m.domain_id = d.id
     WHERE m.id = $1 AND m.tenant_id = $2`,
    [req.params.id, tenantId]
  );
  if (resM.rows.length === 0) {
    res.status(404).json({ error: 'not_found', message: 'Mailbox not found' });
    return;
  }
  res.json({ success: true, mailbox: resM.rows[0] });
});

restV1Router.get('/warmup/stats', flexAuth('warmup:read'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const statsRes = await pool.query(
    `SELECT SUM(warmup_sent_count)::int as sent, SUM(warmup_received_count)::int as received, SUM(spam_rescue_count)::int as rescued
     FROM ox_mailbox_daily WHERE tenant_id = $1`,
    [tenantId]
  );
  res.json({ success: true, stats: statsRes.rows[0] });
});

restV1Router.get('/suppressions', flexAuth('suppressions:read'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const resS = await pool.query(
    `SELECT * FROM ox_suppressions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, limit]
  );
  res.json({ success: true, suppressions: resS.rows });
});

restV1Router.post('/suppressions', flexAuth('suppressions:write'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'internal_error', message: 'DB unavailable' });
    return;
  }
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const email = req.body?.email?.trim().toLowerCase();
  const domain = req.body?.domain?.trim().toLowerCase();
  const reason = req.body?.reason || 'manual';

  if (!email && !domain) {
    res.status(400).json({ error: 'invalid_params', message: 'email or domain required' });
    return;
  }

  const id = `supp_${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO ox_suppressions (id, tenant_id, email, domain, reason, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (tenant_id, email) DO NOTHING`,
    [id, tenantId, email || null, domain || null, reason]
  );
  res.status(201).json({ success: true, suppression: { id, email, domain, reason } });
});

restV1Router.get('/usage', flexAuth('*'), async (req: Request, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  const tenantId = req.tenantId || 'tenant-alm-nexus';
  const usage = await getTenantUsageSummary(tenantId, pool || undefined);
  res.json({ success: true, usage });
});

// ============================================================================
// 6. PUBLIC FREE TOOLS (Rate-limited, no signup required)
// ============================================================================

// Simple in-memory IP rate limiter for public free tools (max 20 requests per hour per IP)
const publicToolRateLimit = new Map<string, { count: number; windowStart: number }>();

function publicRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let item = publicToolRateLimit.get(ip);
  if (!item || now - item.windowStart > 3600_000) {
    item = { count: 1, windowStart: now };
    publicToolRateLimit.set(ip, item);
  } else {
    item.count++;
    if (item.count > 25) {
      res.status(429).json({
        error: 'rate_limited',
        message: 'Public tool limit reached (25 checks/hour). Sign up for unlimited verifications.'
      });
      return;
    }
  }
  next();
}

restV1Router.post('/public/verify-email', publicRateLimit, async (req: Request, res: Response): Promise<void> => {
  const email = req.body?.email?.trim();
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'invalid_email', message: 'Valid email address required' });
    return;
  }
  const pool = getOutreachPool();
  const verification = await verifySingleEmail(email, { tenantId: 'public_visitor', pool: pool || undefined, probeSmtp: false });
  res.json({ success: true, email, verification });
});

restV1Router.post('/public/dns-check', publicRateLimit, async (req: Request, res: Response): Promise<void> => {
  let domain = req.body?.domain?.trim().toLowerCase();
  if (!domain) {
    res.status(400).json({ error: 'invalid_domain', message: 'Domain name required' });
    return;
  }
  // Strip http:// or https:// if provided
  domain = domain.replace(/^https?:\/\//i, '').split('/')[0];
  const dnsReport = await checkDomainDnsStatus(domain);
  res.json({ success: true, domain, dnsReport });
});
