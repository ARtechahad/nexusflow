import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../../middlewares/auth';
import { getOutreachPool } from '../../services/outreach/schema';
import {
  testMailboxConnection,
  createMailbox,
  listMailboxes,
  updateMailbox,
  deleteMailboxSafely,
  bulkImportMailboxes,
  PROVIDER_PRESETS
} from '../../services/outreach/mailboxService';
import { checkDomainDns } from '../../services/outreach/dnsCheck';
import { logger } from '../../logger';

export const mailboxesRouter = Router();

// Zod Schemas
const testConnectionSchema = z.object({
  email: z.string().email('Valid email address required'),
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpUser: z.string().min(1, 'SMTP user is required'),
  imapHost: z.string().min(1, 'IMAP host is required'),
  imapPort: z.coerce.number().int().min(1).max(65535),
  imapUser: z.string().optional(),
  password: z.string().min(1, 'Password is required')
});

const createMailboxSchema = z.object({
  email: z.string().email('Valid email address required'),
  sender_name: z.string().min(1, 'Display sender name is required'),
  provider: z.string().optional(),
  smtp_host: z.string().min(1, 'SMTP host is required'),
  smtp_port: z.coerce.number().int().min(1).max(65535),
  smtp_user: z.string().min(1, 'SMTP user is required'),
  imap_host: z.string().min(1, 'IMAP host is required'),
  imap_port: z.coerce.number().int().min(1).max(65535),
  imap_user: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
  daily_cap: z.coerce.number().int().min(1).max(120).optional(),
  send_interval_sec: z.coerce.number().int().min(30).optional(),
  signature: z.string().optional()
});

const updateMailboxSchema = z.object({
  daily_cap: z.coerce.number().int().min(1).max(120).optional(),
  send_interval_sec: z.coerce.number().int().min(30).optional(),
  status: z.enum(['active', 'paused']).optional(),
  sender_name: z.string().optional(),
  signature: z.string().optional(),
  smtp_host: z.string().optional(),
  smtp_port: z.coerce.number().int().min(1).max(65535).optional(),
  smtp_user: z.string().optional(),
  imap_host: z.string().optional(),
  imap_port: z.coerce.number().int().min(1).max(65535).optional(),
  imap_user: z.string().optional(),
  password: z.string().optional()
});

const bulkImportSchema = z.object({
  csvText: z.string().min(1, 'CSV content is required')
});

/**
 * GET /api/outreach/mailboxes/presets
 * Returns static provider configurations & setup hints
 */
mailboxesRouter.get(['/mailboxes/presets', '/presets'], (req, res: Response) => {
  res.json({
    success: true,
    data: PROVIDER_PRESETS
  });
});

/**
 * POST /api/outreach/mailboxes/test
 * Tests live SMTP & IMAP credentials without storing anything
 */
mailboxesRouter.post(
  ['/mailboxes/test', '/test'],
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head', 'sales']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = testConnectionSchema.safeParse(req.body);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        return res.status(400).json({ success: false, error: errorMsg });
      }

      const result = await testMailboxConnection(parsed.data);
      return res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      logger.error('Mailbox test connection error', { details: err?.message });
      return res.status(500).json({
        success: false,
        error: err?.message || 'Connection test failed unexpectedly'
      });
    }
  }
);

/**
 * POST /api/outreach/mailboxes
 * Connects, tests, encrypts password, and stores new mailbox
 */
mailboxesRouter.post(
  ['/mailboxes', '/'],
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head', 'sales']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getOutreachPool();
      if (!pool) {
        return res.status(503).json({
          success: false,
          error: 'PostgreSQL required: Cannot create mailboxes without an active database.'
        });
      }

      const parsed = createMailboxSchema.safeParse(req.body);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        return res.status(400).json({ success: false, error: errorMsg });
      }

      const tenantId = req.user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
      const mailbox = await createMailbox(pool, tenantId, parsed.data);

      return res.status(201).json({
        success: true,
        data: mailbox
      });
    } catch (err: any) {
      logger.error('Failed to create mailbox', { details: err?.message });
      return res.status(400).json({
        success: false,
        error: err?.message || 'Failed to create mailbox'
      });
    }
  }
);

/**
 * GET /api/outreach/mailboxes
 * Lists all connected mailboxes with delivery health and telemetry
 */
mailboxesRouter.get(
  ['/mailboxes', '/'],
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'developer']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getOutreachPool();
      if (!pool) {
        return res.status(503).json({
          success: false,
          error: 'PostgreSQL required: Cannot list mailboxes without an active database.'
        });
      }

      const tenantId = req.user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
      const mailboxes = await listMailboxes(pool, tenantId);

      return res.json({
        success: true,
        data: mailboxes
      });
    } catch (err: any) {
      logger.error('Failed to list mailboxes', { details: err?.message });
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to list mailboxes'
      });
    }
  }
);

/**
 * PATCH /api/outreach/mailboxes/:id
 * Updates sending cap, interval, status, display name, signature or credentials
 */
mailboxesRouter.patch(
  ['/mailboxes/:id', '/:id'],
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head', 'sales']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getOutreachPool();
      if (!pool) {
        return res.status(503).json({
          success: false,
          error: 'PostgreSQL required'
        });
      }

      const parsed = updateMailboxSchema.safeParse(req.body);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        return res.status(400).json({ success: false, error: errorMsg });
      }

      const tenantId = req.user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
      const updated = await updateMailbox(pool, tenantId, req.params.id, parsed.data);

      return res.json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      logger.error('Failed to update mailbox', { details: err?.message });
      return res.status(400).json({
        success: false,
        error: err?.message || 'Failed to update mailbox'
      });
    }
  }
);

/**
 * DELETE /api/outreach/mailboxes/:id
 * Refuses deletion if mailbox is in an active campaign, otherwise soft-disables
 */
mailboxesRouter.delete(
  ['/mailboxes/:id', '/:id'],
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head', 'sales']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getOutreachPool();
      if (!pool) {
        return res.status(503).json({ success: false, error: 'PostgreSQL required' });
      }

      const tenantId = req.user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
      const result = await deleteMailboxSafely(pool, tenantId, req.params.id);

      if (!result.success) {
        return res.status(409).json({
          success: false,
          error: 'Cannot delete mailbox: currently assigned to running campaigns.',
          campaigns: result.inUseCampaigns
        });
      }

      return res.json({
        success: true,
        message: 'Mailbox successfully disconnected and disabled.'
      });
    } catch (err: any) {
      logger.error('Failed to delete mailbox', { details: err?.message });
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to delete mailbox'
      });
    }
  }
);

/**
 * POST /api/outreach/mailboxes/bulk-import
 * Ingests CSV list of mailboxes with row-level validation
 */
mailboxesRouter.post(
  ['/mailboxes/bulk-import', '/bulk-import'],
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getOutreachPool();
      if (!pool) {
        return res.status(503).json({ success: false, error: 'PostgreSQL required' });
      }

      const parsed = bulkImportSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, error: 'Valid CSV text is required' });
      }

      const tenantId = req.user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
      const report = await bulkImportMailboxes(pool, tenantId, parsed.data.csvText);

      return res.json({
        success: true,
        data: report
      });
    } catch (err: any) {
      logger.error('Bulk mailbox import error', { details: err?.message });
      return res.status(400).json({
        success: false,
        error: err?.message || 'Bulk import failed'
      });
    }
  }
);

/**
 * GET /api/outreach/domains
 * Lists sending domains for the tenant
 */
mailboxesRouter.get(
  '/domains',
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'developer']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getOutreachPool();
      if (!pool) {
        return res.status(503).json({ success: false, error: 'PostgreSQL required' });
      }

      const tenantId = req.user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
      const query = `
        SELECT 
          d.id,
          d.tenant_id,
          d.domain,
          d.spf_status,
          d.dkim_status,
          d.dmarc_status,
          d.mx_status,
          d.custom_tracking_domain,
          d.verified_at,
          d.dns_records,
          d.fix_instructions,
          d.created_at,
          d.updated_at,
          COUNT(m.id)::int as mailbox_count
        FROM ox_domains d
        LEFT JOIN ox_mailboxes m ON d.id = m.domain_id AND m.is_deleted = false
        WHERE d.tenant_id = $1
        GROUP BY d.id
        ORDER BY d.domain ASC;
      `;

      const resDb = await pool.query(query, [tenantId]);
      return res.json({
        success: true,
        data: resDb.rows
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message });
    }
  }
);

/**
 * POST /api/outreach/domains/:id/check-dns
 * Checks MX, SPF, DKIM, and DMARC DNS records and saves fix instructions
 */
mailboxesRouter.post(
  '/domains/:id/check-dns',
  authenticateToken,
  requireRole(['admin', 'ceo', 'bd_head', 'sales']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pool = getOutreachPool();
      if (!pool) {
        return res.status(503).json({ success: false, error: 'PostgreSQL required' });
      }

      const tenantId = req.user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
      const domainRes = await pool.query(
        `SELECT id, domain FROM ox_domains WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [req.params.id, tenantId]
      );

      if (domainRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Domain not found' });
      }

      const domainName = domainRes.rows[0].domain;
      const dnsResult = await checkDomainDns(domainName);

      // Store in ox_domains
      await pool.query(
        `UPDATE ox_domains
         SET spf_status = $1,
             dkim_status = $2,
             dmarc_status = $3,
             mx_status = $4,
             verified_at = NOW(),
             dns_records = $5,
             fix_instructions = $6,
             updated_at = NOW()
         WHERE id = $7 AND tenant_id = $8`,
        [
          dnsResult.spf.status,
          dnsResult.dkim.status,
          dnsResult.dmarc.status,
          dnsResult.mx.status,
          JSON.stringify({
            mx: dnsResult.mx,
            spf: dnsResult.spf,
            dkim: dnsResult.dkim,
            dmarc: dnsResult.dmarc
          }),
          JSON.stringify(dnsResult.fixInstructions),
          req.params.id,
          tenantId
        ]
      );

      return res.json({
        success: true,
        data: dnsResult
      });
    } catch (err: any) {
      logger.error('DNS verification check failed', { details: err?.message });
      return res.status(500).json({
        success: false,
        error: err?.message || 'DNS check failed'
      });
    }
  }
);
