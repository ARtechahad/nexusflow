import { Router, Response } from 'express';
import crypto from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../../middlewares/auth';
import { getOutreachPool } from '../../services/outreach/schema';
import {
  verifySingleEmail,
  enqueueVerificationBatch,
  addDisposableDomain,
  checkAndIncrementVerificationQuota
} from '../../services/outreach/verifier';
import { analyzeEmailSpamScore } from '../../services/outreach/spamChecker';
import { logger } from '../../logger';

export const prospectRoutes = Router();

function getTenantId(req: AuthenticatedRequest): string {
  return req.user?.tenant_id || req.user?.tenantId || 'tenant-alm-nexus';
}

// ============================================================================
// 1. TOOLS: EMAIL VERIFICATION
// ============================================================================

/**
 * POST /tools/verify-email (and /api/outreach/tools/verify-email)
 * Single email verification with quota enforcement
 */
prospectRoutes.post('/tools/verify-email', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { email } = req.body || {};

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email parameter is required' });
    return;
  }

  try {
    const result = await verifySingleEmail(email.trim(), { pool, tenantId });
    res.json({
      success: true,
      result
    });
  } catch (err: any) {
    const isQuota = err?.message?.includes('monthly quota reached');
    res.status(isQuota ? 429 : 500).json({
      success: false,
      error: err?.message || 'Verification failed'
    });
  }
});

/**
 * GET /verification/batches/:id
 * Retrieve bulk verification batch status and results
 */
prospectRoutes.get('/verification/batches/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { id } = req.params;

  try {
    const batchRes = await pool.query(
      `SELECT * FROM ox_verification_batches WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (batchRes.rows.length === 0) {
      res.status(404).json({ error: 'Verification batch not found' });
      return;
    }

    const row = batchRes.rows[0];
    res.json({
      success: true,
      batch: {
        id: row.id,
        tenantId: row.tenant_id,
        total: row.total_count,
        processed: row.processed_count,
        valid: row.valid_count,
        risky: row.risky_count,
        invalid: row.invalid_count,
        unknown: row.unknown_count,
        status: row.status,
        results: typeof row.results === 'string' ? JSON.parse(row.results) : (row.results || []),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch batch' });
  }
});

/**
 * GET /verification/quota
 * Get current verification quota and usage
 */
prospectRoutes.get('/verification/quota', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  try {
    const quotaInfo = await checkAndIncrementVerificationQuota(tenantId, 0, pool);
    res.json({
      success: true,
      quota: quotaInfo.quota,
      used: quotaInfo.used,
      remaining: quotaInfo.remaining
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to check quota' });
  }
});

/**
 * POST /tools/admin/disposable-domains
 * Add custom disposable domain to blacklist
 */
prospectRoutes.post('/tools/admin/disposable-domains', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  const { domain } = req.body || {};
  if (!domain || typeof domain !== 'string') {
    res.status(400).json({ error: 'Domain is required' });
    return;
  }

  try {
    await addDisposableDomain(domain, pool || undefined);
    res.json({ success: true, message: `Added ${domain} to disposable domains list` });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to add disposable domain' });
  }
});

// ============================================================================
// 2. TOOLS: SPAM CHECKER
// ============================================================================

/**
 * POST /tools/spam-check
 * High precision cold outreach spam score analyzer
 */
prospectRoutes.post('/tools/spam-check', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { subject, body, emailCopy, html, text } = req.body || {};
    const result = analyzeEmailSpamScore({
      subject,
      body,
      emailCopy,
      html,
      text
    });

    res.json({
      success: true,
      score: result.score,
      grade: result.grade,
      issues: result.issues,
      fixes: result.fixes,
      highlights: result.highlights,
      details: result.details
    });
  } catch (err: any) {
    logger.error('Error analyzing cold email spam score', { details: err?.message });
    res.status(500).json({ success: false, error: err?.message || 'Failed to analyze spam score' });
  }
});

// ============================================================================
// 3. PROSPECTS CRUD & BULK ACTIONS
// ============================================================================

/**
 * GET /prospects
 * List prospects with search, filter, tags, list_id, and pagination
 */
prospectRoutes.get('/prospects', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const verificationStatus = typeof req.query.verification_status === 'string' ? req.query.verification_status.trim() : '';
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
  const listId = typeof req.query.list_id === 'string' ? req.query.list_id.trim() : '';
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

  try {
    let whereClause = `WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (search) {
      whereClause += ` AND (email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR company ILIKE $${paramIndex} OR title ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (verificationStatus) {
      whereClause += ` AND verification_status = $${paramIndex}`;
      params.push(verificationStatus);
      paramIndex++;
    }

    if (listId) {
      whereClause += ` AND list_id = $${paramIndex}`;
      params.push(listId);
      paramIndex++;
    }

    if (tag) {
      whereClause += ` AND tags @> $${paramIndex}::jsonb`;
      params.push(JSON.stringify([tag]));
      paramIndex++;
    }

    // Total count query
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total FROM ox_prospects ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    // Data query
    const dataQuery = `
      SELECT id, tenant_id, email, first_name, last_name, full_name, company, title,
             linkedin_url, phone, custom_attributes, status, verification_status,
             verification_reason, verified_at, tags, list_id, created_at, updated_at
      FROM ox_prospects
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const dataRes = await pool.query(dataQuery, params);

    res.json({
      success: true,
      prospects: dataRes.rows,
      total,
      limit,
      offset
    });
  } catch (err: any) {
    logger.error('Error fetching prospects', { details: err?.message });
    res.status(500).json({ error: err?.message || 'Failed to fetch prospects' });
  }
});

/**
 * POST /prospects
 * Create a single prospect
 */
prospectRoutes.post('/prospects', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const {
    email,
    first_name,
    last_name,
    company,
    title,
    phone,
    linkedin_url,
    tags,
    list_id,
    custom_attributes
  } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email address is required' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const domain = cleanEmail.split('@')[1];

  try {
    // 1. Check if email or domain is suppressed
    const suppRes = await pool.query(
      `SELECT * FROM ox_suppressions
       WHERE tenant_id = $1 AND (LOWER(email) = $2 OR (is_domain = true AND LOWER(domain) = $3))`,
      [tenantId, cleanEmail, domain]
    );

    if (suppRes.rows.length > 0) {
      res.status(409).json({
        error: `Email ${cleanEmail} is currently on the suppression list (${suppRes.rows[0].reason})`,
        suppressed: true
      });
      return;
    }

    const id = `prosp_${crypto.randomUUID()}`;
    const fullName = [first_name, last_name].filter(Boolean).join(' ') || null;
    const tagArray = Array.isArray(tags) ? tags : [];
    const customJson = typeof custom_attributes === 'object' && custom_attributes !== null ? custom_attributes : {};

    const insertRes = await pool.query(
      `INSERT INTO ox_prospects (
         id, tenant_id, email, first_name, last_name, full_name, company, title,
         phone, linkedin_url, tags, list_id, custom_attributes, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'uncontacted', NOW(), NOW())
       ON CONFLICT (tenant_id, email) DO UPDATE
       SET first_name = COALESCE(EXCLUDED.first_name, ox_prospects.first_name),
           last_name = COALESCE(EXCLUDED.last_name, ox_prospects.last_name),
           full_name = COALESCE(EXCLUDED.full_name, ox_prospects.full_name),
           company = COALESCE(EXCLUDED.company, ox_prospects.company),
           title = COALESCE(EXCLUDED.title, ox_prospects.title),
           phone = COALESCE(EXCLUDED.phone, ox_prospects.phone),
           linkedin_url = COALESCE(EXCLUDED.linkedin_url, ox_prospects.linkedin_url),
           tags = COALESCE(EXCLUDED.tags, ox_prospects.tags),
           list_id = COALESCE(EXCLUDED.list_id, ox_prospects.list_id),
           custom_attributes = ox_prospects.custom_attributes || EXCLUDED.custom_attributes,
           updated_at = NOW()
       RETURNING *`,
      [
        id,
        tenantId,
        cleanEmail,
        first_name || null,
        last_name || null,
        fullName,
        company || null,
        title || null,
        phone || null,
        linkedin_url || null,
        JSON.stringify(tagArray),
        list_id || null,
        JSON.stringify(customJson)
      ]
    );

    res.status(201).json({
      success: true,
      prospect: insertRes.rows[0]
    });
  } catch (err: any) {
    logger.error('Error creating prospect', { details: err?.message });
    res.status(500).json({ error: err?.message || 'Failed to create prospect' });
  }
});

/**
 * GET /prospects/:id
 * Retrieve single prospect
 */
prospectRoutes.get('/prospects/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { id } = req.params;

  try {
    const pRes = await pool.query(
      `SELECT * FROM ox_prospects WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (pRes.rows.length === 0) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }

    res.json({ success: true, prospect: pRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch prospect' });
  }
});

/**
 * PATCH /prospects/:id
 * Update prospect fields
 */
prospectRoutes.patch('/prospects/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { id } = req.params;
  const {
    first_name,
    last_name,
    company,
    title,
    phone,
    linkedin_url,
    status,
    tags,
    list_id,
    custom_attributes
  } = req.body || {};

  try {
    const fullName = [first_name, last_name].filter(Boolean).join(' ') || undefined;

    const updateRes = await pool.query(
      `UPDATE ox_prospects
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           full_name = COALESCE($3, full_name),
           company = COALESCE($4, company),
           title = COALESCE($5, title),
           phone = COALESCE($6, phone),
           linkedin_url = COALESCE($7, linkedin_url),
           status = COALESCE($8, status),
           tags = CASE WHEN $9::jsonb IS NOT NULL THEN $9::jsonb ELSE tags END,
           list_id = COALESCE($10, list_id),
           custom_attributes = CASE WHEN $11::jsonb IS NOT NULL THEN custom_attributes || $11::jsonb ELSE custom_attributes END,
           updated_at = NOW()
       WHERE id = $12 AND tenant_id = $13
       RETURNING *`,
      [
        first_name ?? null,
        last_name ?? null,
        fullName ?? null,
        company ?? null,
        title ?? null,
        phone ?? null,
        linkedin_url ?? null,
        status ?? null,
        tags ? JSON.stringify(tags) : null,
        list_id ?? null,
        custom_attributes ? JSON.stringify(custom_attributes) : null,
        id,
        tenantId
      ]
    );

    if (updateRes.rows.length === 0) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }

    res.json({ success: true, prospect: updateRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update prospect' });
  }
});

/**
 * DELETE /prospects/:id
 * Delete prospect
 */
prospectRoutes.delete('/prospects/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { id } = req.params;

  try {
    const delRes = await pool.query(
      `DELETE FROM ox_prospects WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );

    if (delRes.rows.length === 0) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }

    res.json({ success: true, message: 'Prospect deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete prospect' });
  }
});

/**
 * POST /prospects/import-csv
 * CSV Bulk import with column mapping, syntax validation, suppression filtering & duplicate detection
 */
prospectRoutes.post('/prospects/import-csv', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { rows, mapping, list_id, tags } = req.body || {};

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'rows must be a non-empty array of objects' });
    return;
  }

  const total = rows.length;
  let imported = 0;
  let duplicate = 0;
  let invalid = 0;
  let suppressed = 0;
  const errors: string[] = [];

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  try {
    // 1. Fetch all suppressions for tenant in a single query for fast in-memory lookup
    const suppRes = await pool.query(
      `SELECT email, domain, is_domain FROM ox_suppressions WHERE tenant_id = $1`,
      [tenantId]
    );

    const suppressedEmails = new Set<string>();
    const suppressedDomains = new Set<string>();

    for (const s of suppRes.rows) {
      if (s.is_domain && s.domain) {
        suppressedDomains.add(s.domain.toLowerCase());
      }
      if (s.email) {
        suppressedEmails.add(s.email.toLowerCase());
      }
    }

    // 2. Fetch existing prospect emails for this tenant to identify duplicates
    const existRes = await pool.query(
      `SELECT LOWER(email) as email FROM ox_prospects WHERE tenant_id = $1`,
      [tenantId]
    );
    const existingEmails = new Set<string>(existRes.rows.map(r => r.email));

    // Also track duplicates within the imported file itself
    const seenInBatch = new Set<string>();

    // Prepare batch insert entries
    const validRowsToInsert: Array<{
      id: string;
      email: string;
      first_name?: string;
      last_name?: string;
      full_name?: string;
      company?: string;
      title?: string;
      phone?: string;
      linkedin_url?: string;
      custom_attributes: any;
    }> = [];

    const colMap = mapping || {};

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      if (!rawRow || typeof rawRow !== 'object') {
        invalid++;
        continue;
      }

      // Resolve mapped or direct columns
      const rawEmail = (
        rawRow[colMap.email || 'email'] ||
        rawRow['Email'] ||
        rawRow['EMAIL'] ||
        rawRow['email_address'] ||
        rawRow['work_email'] ||
        ''
      ).toString().trim();

      if (!rawEmail || rawEmail.length > 254 || !emailRegex.test(rawEmail)) {
        invalid++;
        continue;
      }

      const cleanEmail = rawEmail.toLowerCase();
      const domain = cleanEmail.split('@')[1];

      // Check duplicates
      if (seenInBatch.has(cleanEmail) || existingEmails.has(cleanEmail)) {
        duplicate++;
        continue;
      }

      // Check suppressions
      if (suppressedEmails.has(cleanEmail) || (domain && suppressedDomains.has(domain))) {
        suppressed++;
        continue;
      }

      seenInBatch.add(cleanEmail);

      const firstName = (rawRow[colMap.first_name || 'first_name'] || rawRow['First Name'] || rawRow['firstName'] || '')?.toString().trim();
      const lastName = (rawRow[colMap.last_name || 'last_name'] || rawRow['Last Name'] || rawRow['lastName'] || '')?.toString().trim();
      const company = (rawRow[colMap.company || 'company'] || rawRow['Company'] || rawRow['Organization'] || '')?.toString().trim();
      const title = (rawRow[colMap.title || 'title'] || rawRow['Title'] || rawRow['Job Title'] || '')?.toString().trim();
      const phone = (rawRow[colMap.phone || 'phone'] || rawRow['Phone'] || '')?.toString().trim();
      const linkedin = (rawRow[colMap.linkedin_url || 'linkedin_url'] || rawRow['LinkedIn'] || rawRow['linkedin'] || '')?.toString().trim();

      // Collect any unmapped attributes into custom_attributes
      const customAttrs: Record<string, any> = {};
      for (const [k, v] of Object.entries(rawRow)) {
        if (!['email', 'Email', 'EMAIL', 'first_name', 'firstName', 'First Name', 'last_name', 'lastName', 'Last Name', 'company', 'Company', 'title', 'Title', 'phone', 'Phone', 'linkedin', 'LinkedIn'].includes(k)) {
          customAttrs[k] = v;
        }
      }

      validRowsToInsert.push({
        id: `prosp_${crypto.randomUUID()}`,
        email: cleanEmail,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        full_name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
        company: company || undefined,
        title: title || undefined,
        phone: phone || undefined,
        linkedin_url: linkedin || undefined,
        custom_attributes: customAttrs
      });
    }

    // Insert in chunks of 200 for optimal Postgres performance
    const chunkSize = 200;
    const tagArray = Array.isArray(tags) ? tags : [];

    for (let i = 0; i < validRowsToInsert.length; i += chunkSize) {
      const chunk = validRowsToInsert.slice(i, i + chunkSize);
      const values: any[] = [];
      const rowPlaceholders: string[] = [];

      chunk.forEach((row, idx) => {
        const offset = idx * 12;
        rowPlaceholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12})`
        );
        values.push(
          row.id,
          tenantId,
          row.email,
          row.first_name || null,
          row.last_name || null,
          row.full_name || null,
          row.company || null,
          row.title || null,
          row.phone || null,
          row.linkedin_url || null,
          JSON.stringify(tagArray),
          list_id || null
        );
      });

      const insertQuery = `
        INSERT INTO ox_prospects (
          id, tenant_id, email, first_name, last_name, full_name, company, title,
          phone, linkedin_url, tags, list_id
        ) VALUES ${rowPlaceholders.join(', ')}
        ON CONFLICT (tenant_id, email) DO NOTHING
      `;

      await pool.query(insertQuery, values);
      imported += chunk.length;
    }

    res.json({
      success: true,
      report: {
        total,
        imported,
        duplicate,
        invalid,
        suppressed,
        errors
      }
    });
  } catch (err: any) {
    logger.error('Error importing prospects CSV', { details: err?.message });
    res.status(500).json({ error: err?.message || 'CSV import failed' });
  }
});

/**
 * GET /prospects/export-csv
 * Export prospects as CSV format
 */
prospectRoutes.get('/prospects/export-csv', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  try {
    const listRes = await pool.query(
      `SELECT email, first_name, last_name, company, title, phone, linkedin_url, status, verification_status, created_at
       FROM ox_prospects
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    const headers = ['Email', 'First Name', 'Last Name', 'Company', 'Title', 'Phone', 'LinkedIn', 'Status', 'Verification', 'Created At'];
    const lines = [headers.join(',')];

    for (const r of listRes.rows) {
      const escape = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;
      lines.push([
        escape(r.email),
        escape(r.first_name),
        escape(r.last_name),
        escape(r.company),
        escape(r.title),
        escape(r.phone),
        escape(r.linkedin_url),
        escape(r.status),
        escape(r.verification_status),
        escape(r.created_at)
      ].join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
    res.send(lines.join('\n'));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Export failed' });
  }
});

/**
 * POST /prospects/verify
 * Bulk prospect verification queued via ox_jobs
 */
prospectRoutes.post('/prospects/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { emails, prospectIds } = req.body || {};

  try {
    let targetEmails: string[] = [];

    if (Array.isArray(emails) && emails.length > 0) {
      targetEmails = emails.map((e: any) => String(e).trim().toLowerCase()).filter(Boolean);
    } else if (Array.isArray(prospectIds) && prospectIds.length > 0) {
      const pRes = await pool.query(
        `SELECT email FROM ox_prospects WHERE tenant_id = $1 AND id = ANY($2::varchar[])`,
        [tenantId, prospectIds]
      );
      targetEmails = pRes.rows.map(r => r.email.toLowerCase());
    } else {
      // If none specified, select all unverified prospects for this tenant
      const pRes = await pool.query(
        `SELECT email FROM ox_prospects
         WHERE tenant_id = $1 AND (verification_status IS NULL OR verification_status = 'unknown')
         LIMIT 500`,
        [tenantId]
      );
      targetEmails = pRes.rows.map(r => r.email.toLowerCase());
    }

    if (targetEmails.length === 0) {
      res.status(400).json({ error: 'No emails to verify' });
      return;
    }

    const batch = await enqueueVerificationBatch(targetEmails, tenantId, pool);
    res.json({
      success: true,
      batchId: batch.batchId,
      total: batch.total,
      status: batch.status,
      message: batch.message
    });
  } catch (err: any) {
    const isQuota = err?.message?.includes('monthly quota');
    res.status(isQuota ? 429 : 500).json({
      success: false,
      error: err?.message || 'Failed to queue verification batch'
    });
  }
});

/**
 * POST /prospects/find
 * Lead Sourcing Hook (Apollo / Hunter API integration)
 * Never scrapes LinkedIn. Returns clear error if neither key configured.
 */
prospectRoutes.post('/prospects/find', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { domain, company, title } = req.body || {};

  if (!domain && !company) {
    res.status(400).json({ error: 'domain or company name is required' });
    return;
  }

  const apolloKey = process.env.APOLLO_API_KEY;
  const hunterKey = process.env.HUNTER_API_KEY;

  if (!apolloKey && !hunterKey) {
    res.status(200).json({
      success: false,
      configured: false,
      error: 'Lead sourcing provider not configured. Please configure APOLLO_API_KEY or HUNTER_API_KEY in your environment to enable real-time company prospect discovery.',
      prospects: []
    });
    return;
  }

  try {
    // 1. Apollo API Provider
    if (apolloKey) {
      const apolloRes = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apolloKey
        },
        body: JSON.stringify({
          q_organization_domains: domain || undefined,
          q_organization_name: company || undefined,
          person_titles: title ? [title] : undefined,
          page: 1,
          per_page: 25
        })
      });

      if (!apolloRes.ok) {
        const errText = await apolloRes.text();
        throw new Error(`Apollo API returned HTTP ${apolloRes.status}: ${errText}`);
      }

      const data = await apolloRes.json();
      const rawPeople = data.people || [];
      const prospects = rawPeople.map((p: any) => ({
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        email: p.email || '',
        company: p.organization?.name || company || '',
        title: p.title || '',
        phone: p.sanitized_phone || '',
        linkedin_url: p.linkedin_url || ''
      }));

      res.json({
        success: true,
        provider: 'Apollo.io',
        configured: true,
        prospects
      });
      return;
    }

    // 2. Hunter API Provider
    if (hunterKey && domain) {
      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}&limit=25`;
      const hunterRes = await fetch(url);

      if (!hunterRes.ok) {
        const errText = await hunterRes.text();
        throw new Error(`Hunter API returned HTTP ${hunterRes.status}: ${errText}`);
      }

      const data = await hunterRes.json();
      const rawEmails = data.data?.emails || [];
      const prospects = rawEmails.map((e: any) => ({
        first_name: e.first_name || '',
        last_name: e.last_name || '',
        email: e.value || '',
        company: data.data?.organization || company || '',
        title: e.position || '',
        phone: e.phone_number || '',
        linkedin_url: e.linkedin || ''
      }));

      res.json({
        success: true,
        provider: 'Hunter.io',
        configured: true,
        prospects
      });
      return;
    }
  } catch (err: any) {
    logger.error('Error sourcing leads from external provider', { details: err?.message });
    res.status(502).json({
      success: false,
      error: `Lead sourcing provider error: ${err?.message}`,
      prospects: []
    });
  }
});

// ============================================================================
// 4. SUPPRESSION LIST CRUD
// ============================================================================

/**
 * GET /suppressions
 * List suppressions for tenant with pagination & search
 */
prospectRoutes.get('/suppressions', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);

  try {
    let whereClause = `WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (search) {
      whereClause += ` AND (email ILIKE $${paramIdx} OR domain ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total FROM ox_suppressions ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const dataQuery = `
      SELECT id, tenant_id, email, domain, is_domain, reason, source, created_at, updated_at
      FROM ox_suppressions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const dataRes = await pool.query(dataQuery, params);

    res.json({
      success: true,
      suppressions: dataRes.rows,
      total,
      limit,
      offset
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch suppressions' });
  }
});

/**
 * POST /suppressions
 * Add email or domain to suppression list
 */
prospectRoutes.post('/suppressions', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { email, domain, reason, is_domain, source } = req.body || {};

  const validReasons = ['unsubscribe', 'hard_bounce', 'complaint', 'manual'];
  const finalReason = validReasons.includes(reason) ? reason : 'manual';

  const isDomainTarget = Boolean(is_domain || domain);
  const targetDomain = domain ? domain.trim().toLowerCase() : (email && is_domain ? email.split('@')[1] : null);
  const targetEmail = !isDomainTarget && email ? email.trim().toLowerCase() : (targetDomain ? `*@${targetDomain}` : null);

  if (!targetEmail && !targetDomain) {
    res.status(400).json({ error: 'Either email or domain must be provided' });
    return;
  }

  try {
    const id = `supp_${crypto.randomUUID()}`;
    const insertRes = await pool.query(
      `INSERT INTO ox_suppressions (id, tenant_id, email, domain, is_domain, reason, source, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (tenant_id, email) DO UPDATE
       SET reason = EXCLUDED.reason,
           domain = EXCLUDED.domain,
           is_domain = EXCLUDED.is_domain,
           updated_at = NOW()
       RETURNING *`,
      [
        id,
        tenantId,
        targetEmail || `*@${targetDomain}`,
        targetDomain || null,
        isDomainTarget,
        finalReason,
        source || 'manual'
      ]
    );

    res.status(201).json({
      success: true,
      suppression: insertRes.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to add suppression' });
  }
});

/**
 * DELETE /suppressions/:id
 * Remove suppression entry
 */
prospectRoutes.delete('/suppressions/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { id } = req.params;

  try {
    const delRes = await pool.query(
      `DELETE FROM ox_suppressions WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );

    if (delRes.rows.length === 0) {
      res.status(404).json({ error: 'Suppression not found' });
      return;
    }

    res.json({ success: true, message: 'Suppression removed' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to remove suppression' });
  }
});

/**
 * POST /suppressions/import-csv
 * Import CSV of emails/domains to suppression list
 */
prospectRoutes.post('/suppressions/import-csv', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const pool = getOutreachPool();
  if (!pool) {
    res.status(503).json({ error: 'Database service unavailable' });
    return;
  }

  const tenantId = getTenantId(req);
  const { rows, reason, is_domain } = req.body || {};

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'rows must be a non-empty array' });
    return;
  }

  const finalReason = ['unsubscribe', 'hard_bounce', 'complaint', 'manual'].includes(reason) ? reason : 'manual';
  let imported = 0;
  let duplicate = 0;

  try {
    for (const r of rows) {
      const val = (typeof r === 'string' ? r : (r.email || r.domain || r.target || '')).toString().trim().toLowerCase();
      if (!val) continue;

      const isDomain = Boolean(is_domain || !val.includes('@'));
      const targetDomain = isDomain ? (val.startsWith('@') ? val.slice(1) : val) : null;
      const targetEmail = isDomain ? `*@${targetDomain}` : val;
      const id = `supp_${crypto.randomUUID()}`;

      const res = await pool.query(
        `INSERT INTO ox_suppressions (id, tenant_id, email, domain, is_domain, reason, source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'csv_import', NOW(), NOW())
         ON CONFLICT (tenant_id, email) DO NOTHING
         RETURNING id`,
        [id, tenantId, targetEmail, targetDomain, isDomain, finalReason]
      );

      if (res.rowCount && res.rowCount > 0) imported++;
      else duplicate++;
    }

    res.json({
      success: true,
      report: {
        total: rows.length,
        imported,
        duplicate
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to import suppressions' });
  }
});
