import express, { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { authenticateToken } from '../../middlewares/auth';
import { getOutreachPool } from '../../services/outreach/schema';
import { logger } from '../../logger';
import { validateTemplate } from '../../services/outreach/render';
import { handleSendCampaignEmailJob } from '../../services/outreach/sender';
import { verifyToken } from '../../services/outreach/crypto';

export const campaignsRouter = express.Router();

// Helper to ensure database pool
function getPoolOrThrow() {
  const pool = getOutreachPool();
  if (!pool) {
    throw new Error('PostgreSQL database is required for Outreach Suite');
  }
  return pool;
}

// Validation schemas
const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255),
  daily_limit: z.number().int().min(1).max(5000).optional().default(100),
  postal_address: z.string().optional().default(''),
  schedule: z
    .object({
      timezone: z.string().default('UTC'),
      windows: z
        .array(
          z.object({
            start: z.string(),
            end: z.string(),
            days: z.array(z.number())
          })
        )
        .default([{ start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }])
    })
    .optional(),
  tracking_settings: z
    .object({
      track_opens: z.boolean().default(true),
      track_clicks: z.boolean().default(true)
    })
    .optional(),
  stop_on_reply: z.boolean().optional().default(true),
  mailboxIds: z.array(z.string()).optional().default([])
});

const UpdateStepsSchema = z.object({
  steps: z
    .array(
      z.object({
        step_number: z.number().int().min(1),
        delay_days: z.number().int().min(0).default(0),
        delay_hours: z.number().int().min(0).default(0),
        variants: z
          .array(
            z.object({
              variant_label: z.string().default('A'),
              subject: z.string().min(1, 'Subject line is required'),
              body_html: z.string().optional().default(''),
              body_text: z.string().optional().default(''),
              weight: z.number().int().min(1).max(100).default(100)
            })
          )
          .min(1, 'Each step requires at least 1 variant')
      })
    )
    .min(1, 'At least 1 step is required')
});

const EnrollProspectsSchema = z.object({
  prospectIds: z.array(z.string()).optional(),
  csvRows: z
    .array(
      z.object({
        email: z.string().email(),
        first_name: z.string().optional(),
        last_name: z.string().optional(),
        company: z.string().optional(),
        title: z.string().optional()
      })
    )
    .optional()
});

const TestSendSchema = z.object({
  recipientEmail: z.string().email(),
  stepIndex: z.number().int().min(0).default(0),
  mailboxId: z.string().min(1, 'Mailbox ID is required')
});

// 1. GET /api/outreach/campaigns - List campaigns with mailbox count & enrollment stats
campaignsRouter.get('/campaigns', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const pool = getPoolOrThrow();

    const query = `
      SELECT c.*,
             COUNT(DISTINCT cm.mailbox_id)::int as mailbox_count,
             COUNT(DISTINCT s.id)::int as step_count,
             COUNT(DISTINCT e.id)::int as enrolled_count,
             COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.id END)::int as active_enrolled,
             COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END)::int as completed_enrolled,
             COUNT(DISTINCT CASE WHEN e.status = 'bounced' THEN e.id END)::int as bounced_enrolled
      FROM ox_campaigns c
      LEFT JOIN ox_campaign_mailboxes cm ON cm.campaign_id = c.id AND cm.is_active = true
      LEFT JOIN ox_steps s ON s.campaign_id = c.id
      LEFT JOIN ox_enrollments e ON e.campaign_id = c.id
      WHERE c.tenant_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC;
    `;

    const result = await pool.query(query, [tenantId]);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    logger.error('Failed to list campaigns', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. POST /api/outreach/campaigns - Create campaign
campaignsRouter.post('/campaigns', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const userId = (req as any).user?.id;
    const pool = getPoolOrThrow();

    const parsed = CreateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Validation error' });
      return;
    }

    const { name, daily_limit, postal_address, schedule, tracking_settings, stop_on_reply, mailboxIds } = parsed.data;
    const campaignId = `camp_${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO ox_campaigns
       (id, tenant_id, name, status, daily_limit, postal_address, schedule, tracking_settings, stop_on_reply, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [
        campaignId,
        tenantId,
        name,
        daily_limit,
        postal_address,
        JSON.stringify(schedule || {}),
        JSON.stringify(tracking_settings || {}),
        stop_on_reply,
        userId
      ]
    );

    // Associate mailboxes
    if (mailboxIds && mailboxIds.length > 0) {
      for (const mId of mailboxIds) {
        await pool.query(
          `INSERT INTO ox_campaign_mailboxes (id, tenant_id, campaign_id, mailbox_id, is_active)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (campaign_id, mailbox_id) DO NOTHING`,
          [`cm_${crypto.randomUUID()}`, tenantId, campaignId, mId]
        );
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: campaignId,
        name,
        status: 'draft',
        daily_limit,
        mailboxIds
      }
    });
  } catch (err: any) {
    logger.error('Failed to create campaign', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. GET /api/outreach/campaigns/:id - Get single campaign with steps, variants & mailboxes
campaignsRouter.get('/campaigns/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const { id } = req.params;
    const pool = getPoolOrThrow();

    const campRes = await pool.query(`SELECT * FROM ox_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (campRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }
    const campaign = campRes.rows[0];

    // Steps & Variants
    const stepsRes = await pool.query(
      `SELECT s.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', v.id,
                    'variant_label', v.variant_label,
                    'subject', v.subject,
                    'body_html', v.body_html,
                    'body_text', v.body_text,
                    'weight', v.weight
                  ) ORDER BY v.variant_label
                ) FILTER (WHERE v.id IS NOT NULL), '[]'::json
              ) as variants
       FROM ox_steps s
       LEFT JOIN ox_step_variants v ON v.step_id = s.id
       WHERE s.campaign_id = $1 AND s.tenant_id = $2
       GROUP BY s.id
       ORDER BY s.step_number ASC`,
      [id, tenantId]
    );

    // Associated Mailboxes
    const mbxRes = await pool.query(
      `SELECT m.id, m.email, m.sender_name, m.status, m.health_status, m.daily_cap
       FROM ox_campaign_mailboxes cm
       JOIN ox_mailboxes m ON cm.mailbox_id = m.id
       WHERE cm.campaign_id = $1 AND cm.is_active = true`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...campaign,
        steps: stepsRes.rows,
        mailboxes: mbxRes.rows
      }
    });
  } catch (err: any) {
    logger.error('Failed to get campaign', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. PUT /api/outreach/campaigns/:id/steps - Replace/update sequence steps and variants
campaignsRouter.put('/campaigns/:id/steps', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const pool = getPoolOrThrow();
  const client = await pool.connect();
  try {
    const tenantId = (req as any).user?.tenant_id;
    const { id: campaignId } = req.params;

    const parsed = UpdateStepsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Validation error' });
      return;
    }

    const { steps } = parsed.data;

    // Validate templates for unknown tags
    const templateErrors: string[] = [];
    steps.forEach((step, sIdx) => {
      step.variants.forEach((variant) => {
        const subjErrors = validateTemplate(variant.subject);
        if (subjErrors.length > 0) {
          templateErrors.push(`Step ${sIdx + 1} Variant ${variant.variant_label} Subject: ${subjErrors.join(', ')}`);
        }
        const bodyErrors = validateTemplate(variant.body_html || variant.body_text || '');
        if (bodyErrors.length > 0) {
          templateErrors.push(`Step ${sIdx + 1} Variant ${variant.variant_label} Body: ${bodyErrors.join(', ')}`);
        }
      });
    });

    if (templateErrors.length > 0) {
      res.status(400).json({ success: false, error: templateErrors.join('; ') });
      return;
    }

    await client.query('BEGIN');

    // Verify campaign ownership
    const campCheck = await client.query(`SELECT id FROM ox_campaigns WHERE id = $1 AND tenant_id = $2`, [
      campaignId,
      tenantId
    ]);
    if (campCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    // Delete existing steps and cascade variants
    await client.query(`DELETE FROM ox_steps WHERE campaign_id = $1`, [campaignId]);

    // Insert new steps and variants
    for (const step of steps) {
      const stepId = `step_${crypto.randomUUID()}`;
      await client.query(
        `INSERT INTO ox_steps (id, tenant_id, campaign_id, step_number, delay_days, delay_hours, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [stepId, tenantId, campaignId, step.step_number, step.delay_days, step.delay_hours]
      );

      for (const variant of step.variants) {
        const variantId = `var_${crypto.randomUUID()}`;
        await client.query(
          `INSERT INTO ox_step_variants (id, tenant_id, step_id, variant_label, subject, body_html, body_text, weight, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            variantId,
            tenantId,
            stepId,
            variant.variant_label || 'A',
            variant.subject,
            variant.body_html || '',
            variant.body_text || '',
            variant.weight || 100
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: `Successfully updated ${steps.length} sequence steps` });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Failed to update campaign steps', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 5. POST /api/outreach/campaigns/:id/enroll - Enroll prospects or batch CSV rows
campaignsRouter.post('/campaigns/:id/enroll', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const pool = getPoolOrThrow();
  const client = await pool.connect();
  try {
    const tenantId = (req as any).user?.tenant_id;
    const { id: campaignId } = req.params;

    const parsed = EnrollProspectsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Validation error' });
      return;
    }

    const { prospectIds, csvRows } = parsed.data;

    // Check campaign
    const campRes = await client.query(`SELECT id, status FROM ox_campaigns WHERE id = $1 AND tenant_id = $2`, [
      campaignId,
      tenantId
    ]);
    if (campRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }

    // Get first step of campaign
    const firstStepRes = await client.query(
      `SELECT id FROM ox_steps WHERE campaign_id = $1 ORDER BY step_number ASC LIMIT 1`,
      [campaignId]
    );
    const firstStepId = firstStepRes.rows[0]?.id || null;

    let enrolledCount = 0;
    let skippedSuppressed = 0;
    await client.query('BEGIN');

    const targetProspectIds: string[] = [];

    // If prospectIds provided
    if (prospectIds && prospectIds.length > 0) {
      targetProspectIds.push(...prospectIds);
    }

    // If csvRows provided, insert into ox_prospects first
    if (csvRows && csvRows.length > 0) {
      for (const row of csvRows) {
        const cleanEmail = row.email.toLowerCase().trim();
        const pId = `prosp_${crypto.randomUUID()}`;
        const pRes = await client.query(
          `INSERT INTO ox_prospects (id, tenant_id, email, first_name, last_name, company, title)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (tenant_id, email) DO UPDATE
           SET first_name = COALESCE(EXCLUDED.first_name, ox_prospects.first_name),
               last_name = COALESCE(EXCLUDED.last_name, ox_prospects.last_name),
               company = COALESCE(EXCLUDED.company, ox_prospects.company),
               title = COALESCE(EXCLUDED.title, ox_prospects.title)
           RETURNING id`,
          [pId, tenantId, cleanEmail, row.first_name || '', row.last_name || '', row.company || '', row.title || '']
        );
        targetProspectIds.push(pRes.rows[0].id);
      }
    }

    // Enroll unique prospects, skipping suppressed ones
    for (const pId of targetProspectIds) {
      // Check suppression
      const suppCheck = await client.query(
        `SELECT s.id FROM ox_suppressions s
         JOIN ox_prospects p ON LOWER(p.email) = LOWER(s.email)
         WHERE s.tenant_id = $1 AND p.id = $2`,
        [tenantId, pId]
      );
      if (suppCheck.rowCount && suppCheck.rowCount > 0) {
        skippedSuppressed++;
        continue;
      }

      const enrId = `enr_${crypto.randomUUID()}`;
      const enrRes = await client.query(
        `INSERT INTO ox_enrollments
         (id, tenant_id, campaign_id, prospect_id, current_step_id, status, next_send_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW(), NOW())
         ON CONFLICT (campaign_id, prospect_id) DO NOTHING
         RETURNING id`,
        [enrId, tenantId, campaignId, pId, firstStepId]
      );

      if (enrRes.rowCount && enrRes.rowCount > 0) {
        enrolledCount++;
      }
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      data: {
        enrolled: enrolledCount,
        skippedSuppressed
      }
    });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Failed to enroll prospects', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 6. POST /api/outreach/campaigns/:id/start - Start campaign with validation checklist
campaignsRouter.post('/campaigns/:id/start', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const { id } = req.params;
    const { acknowledgeRisk } = req.body || {};
    const pool = getPoolOrThrow();

    // Fetch campaign
    const campRes = await pool.query(`SELECT * FROM ox_campaigns WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (campRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Campaign not found' });
      return;
    }
    const camp = campRes.rows[0];

    // Checklist 1: Postal address CAN-SPAM requirement
    const tenantSettingRes = await pool.query(`SELECT postal_address FROM ox_tenant_settings WHERE tenant_id = $1`, [
      tenantId
    ]);
    const postalAddress = (camp.postal_address || tenantSettingRes.rows[0]?.postal_address || process.env.OUTREACH_POSTAL_ADDRESS || '').trim();
    if (!postalAddress) {
      res.status(400).json({
        success: false,
        error: 'Cannot start campaign: A physical sender postal address is required in campaign settings or tenant settings for CAN-SPAM compliance.'
      });
      return;
    }

    // Checklist 2: At least 1 step
    const stepsRes = await pool.query(`SELECT id FROM ox_steps WHERE campaign_id = $1`, [id]);
    if (stepsRes.rowCount === 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot start campaign: The campaign must have at least one sequence step.'
      });
      return;
    }

    // Checklist 3: At least 1 mailbox and all mailboxes active
    const mbxRes = await pool.query(
      `SELECT m.id, m.email, m.status, m.health_status, m.reputation_score, m.warmup_enabled
       FROM ox_campaign_mailboxes cm
       JOIN ox_mailboxes m ON cm.mailbox_id = m.id
       WHERE cm.campaign_id = $1 AND cm.is_active = true AND m.is_deleted = false`,
      [id]
    );

    if (mbxRes.rowCount === 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot start campaign: At least one connected mailbox must be assigned to this campaign.'
      });
      return;
    }

    const inactiveMbx = mbxRes.rows.find((m) => m.status !== 'active');
    if (inactiveMbx) {
      res.status(400).json({
        success: false,
        error: `Cannot start campaign: Assigned mailbox ${inactiveMbx.email} is currently ${inactiveMbx.status}.`
      });
      return;
    }

    // Checklist 4: Warmup health check (if reputation < 70, require acknowledgeRisk)
    const lowHealthMbx = mbxRes.rows.find((m) => parseFloat(m.reputation_score) < 70);
    if (lowHealthMbx && !acknowledgeRisk) {
      res.status(400).json({
        success: false,
        requiresConfirmation: true,
        warning: `Mailbox ${lowHealthMbx.email} has a deliverability health score of ${lowHealthMbx.reputation_score}% (below 70%). Sending cold emails now may harm your domain reputation. Pass 'acknowledgeRisk: true' to override.`
      });
      return;
    }

    // Set campaign status to active
    await pool.query(`UPDATE ox_campaigns SET status = 'active', updated_at = NOW() WHERE id = $1`, [id]);

    res.json({
      success: true,
      message: 'Campaign started successfully. Sequencer will process active enrollments.',
      data: { status: 'active' }
    });
  } catch (err: any) {
    logger.error('Failed to start campaign', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. POST /api/outreach/campaigns/:id/pause - Pause campaign
campaignsRouter.post('/campaigns/:id/pause', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const { id } = req.params;
    const pool = getPoolOrThrow();

    await pool.query(`UPDATE ox_campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [
      id,
      tenantId
    ]);

    res.json({ success: true, message: 'Campaign paused.', data: { status: 'paused' } });
  } catch (err: any) {
    logger.error('Failed to pause campaign', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. GET /api/outreach/campaigns/:id/stats - Campaign performance analytics
campaignsRouter.get('/campaigns/:id/stats', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const { id } = req.params;
    const pool = getPoolOrThrow();

    const todayUtc = new Date().toISOString().slice(0, 10);

    const statsRes = await pool.query(
      `SELECT
         COUNT(DISTINCT e.id)::int as total_enrolled,
         COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.id END)::int as active,
         COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END)::int as completed,
         COUNT(DISTINCT CASE WHEN e.status = 'bounced' THEN e.id END)::int as bounced,
         COUNT(DISTINCT se.id)::int as total_sent,
         COUNT(DISTINCT CASE WHEN se.sent_at >= $3::date THEN se.id END)::int as sent_today,
         COUNT(DISTINCT CASE WHEN ev.type = 'email_opened' THEN se.id END)::int as opened_count,
         COUNT(DISTINCT CASE WHEN ev.type = 'link_clicked' THEN se.id END)::int as clicked_count,
         COUNT(DISTINCT CASE WHEN ev.type = 'reply_received' THEN se.id END)::int as replied_count
       FROM ox_campaigns c
       LEFT JOIN ox_enrollments e ON e.campaign_id = c.id
       LEFT JOIN ox_sent_emails se ON se.campaign_id = c.id
       LEFT JOIN ox_events ev ON ev.sent_email_id = se.id
       WHERE c.id = $1 AND c.tenant_id = $2
       GROUP BY c.id`,
      [id, tenantId, todayUtc]
    );

    const activityRes = await pool.query(
      `SELECT e.id, e.defer_reason, e.updated_at, p.email
       FROM ox_enrollments e
       JOIN ox_prospects p ON e.prospect_id = p.id
       WHERE e.campaign_id = $1 AND e.defer_reason IS NOT NULL
       ORDER BY e.updated_at DESC
       LIMIT 10`,
      [id]
    );

    const data = statsRes.rows[0] || {
      total_enrolled: 0,
      active: 0,
      completed: 0,
      bounced: 0,
      total_sent: 0,
      sent_today: 0,
      opened_count: 0,
      clicked_count: 0,
      replied_count: 0
    };

    res.json({
      success: true,
      data: {
        ...data,
        deferActivity: activityRes.rows
      }
    });
  } catch (err: any) {
    logger.error('Failed to get campaign stats', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. POST /api/outreach/campaigns/:id/test-send - Test send rendered step through Cap Guard & sender
campaignsRouter.post('/campaigns/:id/test-send', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id;
    const { id: campaignId } = req.params;

    const parsed = TestSendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Validation error' });
      return;
    }

    const { recipientEmail, stepIndex, mailboxId } = parsed.data;
    const pool = getPoolOrThrow();

    // Fetch step
    const stepRes = await pool.query(
      `SELECT id FROM ox_steps WHERE campaign_id = $1 ORDER BY step_number ASC OFFSET $2 LIMIT 1`,
      [campaignId, stepIndex]
    );

    if (stepRes.rowCount === 0) {
      res.status(404).json({ success: false, error: 'Step not found for test send' });
      return;
    }

    const stepId = stepRes.rows[0].id;

    // Send rendered email directly using the standard sender handler
    await handleSendCampaignEmailJob(
      {
        enrollmentId: `test_enr_${Date.now()}`,
        campaignId,
        stepId,
        mailboxId,
        isTest: true,
        testRecipient: recipientEmail
      },
      tenantId
    );

    res.json({
      success: true,
      message: `Test email rendered and dispatched to ${recipientEmail}`
    });
  } catch (err: any) {
    logger.error('Test send failed', { details: { error: err.message } });
    res.status(400).json({ success: false, error: `Test send failed: ${err.message}` });
  }
});

// 10. GET /api/outreach/u/:token - One-Click Unsubscribe Handler
campaignsRouter.get('/u/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const pool = getPoolOrThrow();

    const verification = verifyToken(token);
    if (!verification.valid || !verification.payload) {
      res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 48px;">
            <h2>Invalid or Expired Link</h2>
            <p>This unsubscribe link is invalid or has expired.</p>
          </body>
        </html>
      `);
      return;
    }

    const { tenantId, campaignId, enrollmentId, email } = verification.payload;

    if (email) {
      // Add to ox_suppressions
      await pool.query(
        `INSERT INTO ox_suppressions (id, tenant_id, email, reason, source, created_at)
         VALUES ($1, $2, $3, 'Recipient Unsubscribed', 'one_click_link', NOW())
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [`supp_${crypto.randomUUID()}`, tenantId, email.toLowerCase()]
      );

      // Stop enrollment
      if (enrollmentId) {
        await pool.query(
          `UPDATE ox_enrollments SET status = 'unsubscribed', next_send_at = NULL, updated_at = NOW() WHERE id = $1`,
          [enrollmentId]
        );
      }
    }

    res.send(`
      <html>
        <head><title>Unsubscribed Successfully</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc;">
          <div style="background: white; border-radius: 16px; padding: 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
            <div style="width: 48px; height: 48px; background: #ecfdf5; color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 24px;">✓</div>
            <h2 style="color: #0f172a; margin-top: 0;">You have been unsubscribed</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.5;">You will no longer receive emails from this sender. Your preferences have been saved immediately.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send('An error occurred while processing your unsubscribe request.');
  }
});
