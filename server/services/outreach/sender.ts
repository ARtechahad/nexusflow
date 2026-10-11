import pg from 'pg';
import crypto from 'node:crypto';
import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';
import { decryptSecret, signToken } from './crypto';
import { checkAndReserve } from './capGuard';
import { renderEmailTemplate } from './render';
import { realtimeEngine } from '../realtimeEngine';

// Cache nodemailer transporters per mailbox to reuse connection pools
const transporterPool = new Map<string, { transporter: Transporter; cachedAt: number }>();

function getPooledTransporter(mailbox: any, decryptedPassword: string): Transporter {
  const cacheKey = `${mailbox.id}_${mailbox.smtp_host}_${mailbox.smtp_port}_${mailbox.smtp_user}`;
  const existing = transporterPool.get(cacheKey);

  if (existing && Date.now() - existing.cachedAt < 30 * 60 * 1000) {
    return existing.transporter;
  }

  const isSecure = mailbox.smtp_port === 465;

  const transporter = nodemailer.createTransport({
    host: mailbox.smtp_host,
    port: mailbox.smtp_port,
    secure: isSecure,
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
    auth: {
      user: mailbox.smtp_user,
      pass: decryptedPassword
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });

  transporterPool.set(cacheKey, { transporter, cachedAt: Date.now() });
  return transporter;
}

export interface SendCampaignEmailPayload {
  enrollmentId: string;
  campaignId: string;
  stepId: string;
  variantId?: string;
  mailboxId: string;
  isTest?: boolean;
  testRecipient?: string;
}

/**
 * Handles job type 'send_campaign_email':
 * 1. Loads enrollment, campaign, step, variant, prospect, mailbox
 * 2. Checks tenant postal address (blocked if missing)
 * 3. Calls Cap Guard (returns allowed or retryAt deferral)
 * 4. Renders subject and body with deterministic spintax and merge tags
 * 5. Builds RFC 5322 email with List-Unsubscribe, Message-ID, unsubscribe footer
 * 6. Sends via pooled TLS nodemailer transporter
 * 7. Records ox_sent_emails, ox_events
 * 8. Classifies errors (SMTP 5xx -> hard bounce, add suppression, stop enrollment; 4xx -> retry)
 */
export async function handleSendCampaignEmailJob(jobPayload: SendCampaignEmailPayload, tenantId: string): Promise<void> {
  const pool = getOutreachPool();
  if (!pool) {
    throw new Error('Database pool unavailable for email sending');
  }

  const { enrollmentId, campaignId, stepId, mailboxId, isTest, testRecipient } = jobPayload;

  // 1. Fetch Campaign and Tenant Postal Address
  const campRes = await pool.query(
    `SELECT c.id, c.name, c.status, c.postal_address, c.tracking_settings, c.stop_on_reply,
            t.postal_address as tenant_postal_address
     FROM ox_campaigns c
     LEFT JOIN ox_tenant_settings t ON t.tenant_id = c.tenant_id
     WHERE c.id = $1 AND c.tenant_id = $2`,
    [campaignId, tenantId]
  );

  if (campRes.rowCount === 0) {
    logger.warn(`Campaign ${campaignId} not found for job`, { context: 'Sender' });
    return;
  }

  const campaign = campRes.rows[0];
  const postalAddress = (campaign.postal_address || campaign.tenant_postal_address || process.env.OUTREACH_POSTAL_ADDRESS || '').trim();

  if (!postalAddress && !isTest) {
    const errorMsg = 'Sending blocked: Physical sender postal address is required for CAN-SPAM compliance.';
    logger.error(errorMsg, { context: 'Sender', details: { campaignId } });
    throw new Error(errorMsg);
  }

  // 2. Fetch Enrollment and Prospect
  let prospect: any;
  let enrollment: any;

  if (isTest && testRecipient) {
    prospect = {
      id: 'test_prospect',
      email: testRecipient,
      first_name: 'Test',
      last_name: 'Recipient',
      company: 'Test Co',
      title: 'Tester',
      custom_attributes: {}
    };
    enrollment = {
      id: `test_enr_${Date.now()}`,
      status: 'active'
    };
  } else {
    const enrRes = await pool.query(
      `SELECT e.id, e.status, e.current_step_id, e.completed_steps,
              p.id as prospect_id, p.email, p.first_name, p.last_name, p.company, p.title, p.custom_attributes
       FROM ox_enrollments e
       JOIN ox_prospects p ON e.prospect_id = p.id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      [enrollmentId, tenantId]
    );

    if (enrRes.rowCount === 0) {
      logger.warn(`Enrollment ${enrollmentId} not found`, { context: 'Sender' });
      return;
    }

    enrollment = enrRes.rows[0];
    if (enrollment.status !== 'active') {
      logger.info(`Enrollment ${enrollmentId} is not active (status: ${enrollment.status}). Skipping send.`, {
        context: 'Sender'
      });
      return;
    }

    prospect = {
      id: enrollment.prospect_id,
      email: enrollment.email,
      first_name: enrollment.first_name,
      last_name: enrollment.last_name,
      company: enrollment.company,
      title: enrollment.title,
      custom_attributes: enrollment.custom_attributes || {}
    };
  }

  // 3. Fetch Mailbox & Decrypt SMTP Password
  const mbxRes = await pool.query(
    `SELECT id, tenant_id, domain_id, email, sender_name, smtp_host, smtp_port, smtp_user,
            smtp_pass_encrypted, status, health_status, signature, daily_cap
     FROM ox_mailboxes
     WHERE id = $1 AND tenant_id = $2`,
    [mailboxId, tenantId]
  );

  if (mbxRes.rowCount === 0) {
    throw new Error(`Mailbox ${mailboxId} not found`);
  }

  const mailbox = mbxRes.rows[0];
  if (!mailbox.smtp_pass_encrypted) {
    throw new Error(`Mailbox ${mailbox.email} is missing encrypted SMTP credentials`);
  }

  const smtpPassword = decryptSecret(mailbox.smtp_pass_encrypted);

  // 4. Fetch Step and Variant
  const stepRes = await pool.query(
    `SELECT s.id, s.step_number, s.delay_hours, s.delay_days
     FROM ox_steps s
     WHERE s.id = $1 AND s.campaign_id = $2`,
    [stepId, campaignId]
  );

  if (stepRes.rowCount === 0) {
    throw new Error(`Step ${stepId} not found in campaign ${campaignId}`);
  }
  const step = stepRes.rows[0];

  // Pick variant: specified, or weighted random, or first
  let variant: any;
  if (jobPayload.variantId) {
    const varRes = await pool.query(`SELECT * FROM ox_step_variants WHERE id = $1`, [jobPayload.variantId]);
    variant = varRes.rows[0];
  }

  if (!variant) {
    const varRes = await pool.query(
      `SELECT * FROM ox_step_variants WHERE step_id = $1 ORDER BY weight DESC, created_at ASC`,
      [stepId]
    );
    if (varRes.rowCount === 0) {
      throw new Error(`Step ${stepId} has no message variants`);
    }
    variant = varRes.rows[0];
  }

  // 5. CAP GUARD: Exactly ONE gate decides whether send may proceed
  const capCheck = await checkAndReserve({
    tenantId,
    mailboxId: mailbox.id,
    campaignId,
    prospectEmail: prospect.email,
    kind: 'campaign',
    pool
  });

  if (!capCheck.allowed) {
    logger.info(`Cap Guard deferred send for enrollment ${enrollment.id}: ${capCheck.reason}`, {
      context: 'Sender',
      details: { retryAt: capCheck.retryAt }
    });

    if (!isTest) {
      // Record defer reason on enrollment and schedule retry
      const retryDate = capCheck.retryAt || new Date(Date.now() + 15 * 60 * 1000);
      await pool.query(
        `UPDATE ox_enrollments
         SET next_send_at = $1, defer_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [retryDate, capCheck.reason, enrollment.id]
      );
    }
    return;
  }

  // 6. RENDER SUBJECT & BODY (deterministic seeded spintax and merge tags)
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  // Generate unique sentEmailId upfront for token tracking
  const sentEmailId = `sent_${crypto.randomUUID()}`;

  // Check custom tracking domain on mailbox domain if verified
  let trackingBaseUrl = appUrl;
  if (mailbox.domain_id) {
    const domRes = await pool.query(
      `SELECT tracking_domain, tracking_verified FROM ox_domains WHERE id = $1`,
      [mailbox.domain_id]
    );
    if (domRes.rowCount && domRes.rows[0].tracking_verified && domRes.rows[0].tracking_domain) {
      trackingBaseUrl = `https://${domRes.rows[0].tracking_domain}`;
    }
  }

  // Generate signed unsubscribe token
  const unsubToken = signToken({
    tenantId,
    campaignId,
    enrollmentId: enrollment.id,
    email: prospect.email
  });

  const unsubUrl = `${appUrl}/api/outreach/u/${unsubToken}`;

  const renderContext = {
    first_name: prospect.first_name || '',
    last_name: prospect.last_name || '',
    name: `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim() || prospect.email,
    company: prospect.company || '',
    title: prospect.title || '',
    email: prospect.email,
    sender_name: mailbox.sender_name || 'Outreach Specialist',
    sender_email: mailbox.email,
    unsubscribe_url: unsubUrl,
    postal_address: postalAddress,
    ...(prospect.custom_attributes || {})
  };

  const seed = enrollment.id || prospect.email;
  const renderedSubjectResult = renderEmailTemplate(variant.subject, renderContext, `${seed}_subj`);
  const renderedBodyResult = renderEmailTemplate(
    variant.body_html || variant.body_text || '',
    renderContext,
    `${seed}_body`
  );

  const subject = renderedSubjectResult.text;
  let bodyHtml = renderedBodyResult.text;

  // Append mailbox signature if configured
  if (mailbox.signature) {
    bodyHtml += `<br><br>${mailbox.signature}`;
  }

  // Append compliant CAN-SPAM footer
  const footerHtml = `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.5;">
      <p style="margin: 0 0 6px 0;">${postalAddress ? `${postalAddress}` : ''}</p>
      <p style="margin: 0;">
        If you'd prefer not to hear from us again, you can <a href="${unsubUrl}" style="color: #6366f1; text-decoration: underline;">unsubscribe here</a>.
      </p>
    </div>
  `;
  bodyHtml += footerHtml;

  // Tracking settings configuration
  const trackClicks = campaign.tracking_settings?.track_clicks !== false;
  const trackOpens = campaign.tracking_settings?.track_opens !== false;

  // Rewrite links if track_clicks enabled
  if (trackClicks) {
    bodyHtml = bodyHtml.replace(/<a\s+([^>]*?)href=(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi, (match, prefix, quote, url, suffix) => {
      if (url.includes('/api/outreach/u/')) {
        return match;
      }
      const clickToken = signToken({
        tenantId,
        campaignId,
        enrollmentId: enrollment.id,
        sentEmailId,
        email: prospect.email,
        url,
        type: 'click'
      });
      const trackingClickUrl = `${trackingBaseUrl}/api/outreach/t/c/${clickToken}`;
      return `<a ${prefix}href="${trackingClickUrl}"${suffix}>`;
    });
  }

  // Append open tracking pixel if track_opens enabled
  if (trackOpens) {
    const openToken = signToken({
      tenantId,
      campaignId,
      enrollmentId: enrollment.id,
      sentEmailId,
      email: prospect.email,
      type: 'open'
    });
    const trackingPixelUrl = `${trackingBaseUrl}/api/outreach/t/o/${openToken}.gif`;
    bodyHtml += `<img src="${trackingPixelUrl}" alt="" width="1" height="1" style="display:none;width:1px;height:1px;border:0;outline:none;" />`;
  }

  // Plain text fallback
  const bodyText = (variant.body_text || bodyHtml.replace(/<[^>]+>/g, ' ')) + `\n\nUnsubscribe: ${unsubUrl}\n${postalAddress}`;

  // 7. BUILD RFC 5322 MESSAGE & HEADERS
  const messageIdHeader = `<${crypto.randomUUID()}@${mailbox.email.split('@')[1] || 'domain.com'}>`;
  const trackingHash = crypto.createHash('sha256').update(`${enrollment.id}_${step.id}_${Date.now()}`).digest('hex').slice(0, 32);

  const mailOptions: SendMailOptions = {
    from: `"${mailbox.sender_name}" <${mailbox.email}>`,
    to: prospect.email,
    replyTo: mailbox.email,
    subject,
    text: bodyText,
    html: bodyHtml,
    messageId: messageIdHeader,
    headers: {
      'List-Unsubscribe': `<${unsubUrl}>, <mailto:${mailbox.email}?subject=Unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-LeadFlow-Campaign': campaignId,
      'X-LeadFlow-Enrollment': enrollment.id,
      'X-LeadFlow-Tracking': trackingHash
    }
  };

  // 8. SEND VIA NODEMAILER POOLED TRANSPORTER WITH ERROR CLASSIFICATION
  const transporter = getPooledTransporter(mailbox, smtpPassword);

  try {
    const sendInfo = await transporter.sendMail(mailOptions);
    logger.info(`Campaign email sent successfully to ${prospect.email}`, {
      context: 'Sender',
      details: {
        campaignId,
        mailbox: mailbox.email,
        messageId: sendInfo.messageId || messageIdHeader
      }
    });

    if (!isTest) {
      // Record sent email in ox_sent_emails using pre-assigned sentEmailId
      await pool.query(
        `INSERT INTO ox_sent_emails
         (id, tenant_id, campaign_id, step_id, variant_id, enrollment_id, mailbox_id,
          recipient_email, subject, message_id_header, tracking_hash, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'sent', NOW())`,
        [
          sentEmailId,
          tenantId,
          campaignId,
          step.id,
          variant.id,
          enrollment.id,
          mailbox.id,
          prospect.email,
          subject,
          sendInfo.messageId || messageIdHeader,
          trackingHash
        ]
      );

      // Record telemetry event in ox_events
      await pool.query(
        `INSERT INTO ox_events (id, tenant_id, sent_email_id, type, metadata, occurred_at)
         VALUES ($1, $2, $3, 'email_sent', $4, NOW())`,
        [
          `evt_${crypto.randomUUID()}`,
          tenantId,
          sentEmailId,
          JSON.stringify({
            stepNumber: step.step_number,
            mailboxId: mailbox.id,
            email: prospect.email,
            variantLabel: variant.variant_label
          })
        ]
      );

      // Advance Enrollment: find next step in sequence
      const nextStepRes = await pool.query(
        `SELECT id, step_number, delay_hours, delay_days
         FROM ox_steps
         WHERE campaign_id = $1 AND step_number > $2
         ORDER BY step_number ASC
         LIMIT 1`,
        [campaignId, step.step_number]
      );

      if (nextStepRes.rowCount && nextStepRes.rowCount > 0) {
        const nextStep = nextStepRes.rows[0];
        const delayHoursTotal = (nextStep.delay_days || 0) * 24 + (nextStep.delay_hours || 0);
        const nextSendAt = new Date(Date.now() + Math.max(1, delayHoursTotal) * 60 * 60 * 1000);

        await pool.query(
          `UPDATE ox_enrollments
           SET current_step_id = $1,
               completed_steps = completed_steps + 1,
               last_sent_at = NOW(),
               next_send_at = $2,
               defer_reason = NULL,
               updated_at = NOW()
           WHERE id = $3`,
          [nextStep.id, nextSendAt, enrollment.id]
        );
      } else {
        // Sequence completed!
        await pool.query(
          `UPDATE ox_enrollments
           SET current_step_id = NULL,
               completed_steps = completed_steps + 1,
               status = 'completed',
               last_sent_at = NOW(),
               next_send_at = NULL,
               defer_reason = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [enrollment.id]
        );
      }

      // Emit SSE telemetry event
      realtimeEngine.broadcastToTenant(tenantId, 'campaign_sent', {
        type: 'CAMPAIGN_EMAIL_SENT',
        campaignId,
        recipient: prospect.email,
        mailbox: mailbox.email,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err: any) {
    const errorString = String(err?.message || err);
    const smtpCode = err?.responseCode || (err?.response ? parseInt(err.response.slice(0, 3), 10) : 0);

    logger.error(`Error sending email to ${prospect.email}: ${errorString}`, {
      context: 'Sender',
      details: {
        smtpCode,
        campaignId,
        mailboxId
      }
    });

    // Check for SMTP 5xx permanent failure -> Hard bounce
    if (smtpCode >= 500 && smtpCode < 600) {
      if (!isTest) {
        // Add prospect to suppression list
        await pool.query(
          `INSERT INTO ox_suppressions (id, tenant_id, email, reason, source, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (tenant_id, email) DO NOTHING`,
          [`supp_${crypto.randomUUID()}`, tenantId, prospect.email.toLowerCase(), `Hard Bounce (${smtpCode})`, 'smtp_delivery']
        );

        // Mark enrollment bounced and stopped
        await pool.query(
          `UPDATE ox_enrollments
           SET status = 'bounced', defer_reason = $1, next_send_at = NULL, updated_at = NOW()
           WHERE id = $2`,
          [`Hard Bounce: ${errorString.slice(0, 200)}`, enrollment.id]
        );
      }
      return;
    }

    // Transient failure (4xx or network) -> Throw to allow queue worker exponential backoff retry
    throw err;
  }
}
