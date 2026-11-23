import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { resendService } from '../services/resendService';
import { getDB, saveDB } from '../db';
import { logger } from '../logger';

const publicRouter = Router();

const inquiryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    default: false
  },
  keyGenerator: (req) => {
    const rawForwarded = req.headers['x-forwarded-for'];
    if (typeof rawForwarded === 'string' && rawForwarded.length > 0) {
      return rawForwarded.split(',')[0].trim();
    }
    return req.ip || '127.0.0.1';
  },
  message: {
    success: false,
    error: 'Too many consultation requests from this network. Please email contact@almnexus.tech directly or try again shortly.'
  }
});

const inquirySchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name (at least 2 characters).').max(120),
  email: z.string().trim().email('Please enter a valid work email address.').max(200),
  companyWebsite: z.string().trim().max(250).optional().default(''),
  focus: z.string().trim().min(2).max(160),
  notes: z.string().trim().min(10, 'Please outline your target ICP, industry, or outbound goals (at least 10 characters).').max(3000),
  source: z.enum(['landing_inline', 'landing_modal']).optional().default('landing_inline')
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHeaderControls(input: string): string {
  return input.replace(/[\r\n\t]+/g, ' ').trim();
}

function sanitizeCompanyWebsite(raw: string): string {
  const cleaned = stripHeaderControls(raw);
  if (!cleaned) return '';
  if (/^(javascript|data|vbscript):/i.test(cleaned)) {
    return '';
  }
  return cleaned;
}

const handleInquirySubmission = async (req: Request, res: Response) => {
  const parsed = inquirySchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || 'Please check your inquiry fields and try again.';
    return res.status(400).json({
      success: false,
      error: firstIssue
    });
  }

  const name = stripHeaderControls(parsed.data.name);
  const email = stripHeaderControls(parsed.data.email).toLowerCase();
  const companyWebsite = sanitizeCompanyWebsite(parsed.data.companyWebsite || '');
  const focus = stripHeaderControls(parsed.data.focus);
  const notes = parsed.data.notes.trim();
  const source = parsed.data.source;
  const referenceId = `inq_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const submittedAt = new Date().toISOString();

  // Persist inquiry cleanly to application store
  try {
    const db = getDB();
    if (!Array.isArray(db.publicInquiries)) {
      db.publicInquiries = [];
    }
    db.publicInquiries.unshift({
      id: referenceId,
      name,
      email,
      companyWebsite: companyWebsite || 'Not specified',
      focus,
      notes,
      source,
      submittedAt
    });
    if (db.publicInquiries.length > 500) {
      db.publicInquiries = db.publicInquiries.slice(0, 500);
    }
    saveDB(db);
  } catch (dbErr: any) {
    logger.warn(`[PublicInquiry] Local store persistence note: ${dbErr?.message}`, { context: 'PublicInquiry' });
  }

  const fromAddress = 'ALM Nexus Website <info@almnexus.tech>';
  const recipientAddress = 'contact@almnexus.tech';
  const subject = `[almnexus.tech] ${focus} — ${companyWebsite || name}`;
  const textBody = [
    `ALM Nexus Strategy Call / Data Sample Request (${referenceId})`,
    `Submitted At: ${submittedAt}`,
    `Source: ${source}`,
    `Name: ${name}`,
    `Work Email: ${email}`,
    `Company Website: ${companyWebsite || 'Not specified'}`,
    `Service / Engagement Model: ${focus}`,
    '',
    'Target ICP & Notes:',
    notes
  ].join('\n');

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0B2545; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px;">
      <div style="border-bottom: 1px solid #E2E8F0; padding-bottom: 14px; margin-bottom: 18px;">
        <p style="margin: 0; font-size: 12px; color: #005B9F; font-weight: 700; letter-spacing: 0.04em;">ALM NEXUS · ALMNEXUS.TECH</p>
        <h2 style="margin: 6px 0 0; font-size: 18px; color: #0B2545;">New Strategy Call / Custom Data Sample Request</h2>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #64748B; width: 170px;">Reference ID</td><td style="padding: 6px 0; font-family: monospace; font-weight: 600;">${escapeHtml(referenceId)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Full Name</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Work Email</td><td style="padding: 6px 0;">${escapeHtml(email)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Company Website</td><td style="padding: 6px 0;">${escapeHtml(companyWebsite || 'Not specified')}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748B;">Engagement Scope</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(focus)}</td></tr>
      </table>
      <div style="margin-top: 18px; padding: 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;">
        <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 6px;">Target ICP &amp; Notes</div>
        <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(notes)}</div>
      </div>
    </div>
  `;

  const fallbackMailto = `mailto:${recipientAddress}?cc=ahad@almnexus.tech&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;
  const hasResendKey = resendService.isConfigured();
  let deliveryMode: 'resend' | 'mailto_fallback' = 'mailto_fallback';

  if (hasResendKey) {
    try {
      const emailResult = await resendService.sendEmail({
        from: fromAddress,
        to: [recipientAddress],
        cc: ['ahad@almnexus.tech'],
        replyTo: email,
        subject,
        text: textBody,
        html: htmlBody,
        tenantId: 'public-almnexus',
        template: 'public_strategy_inquiry',
        metadata: {
          referenceId,
          source,
          focus,
          companyWebsite
        }
      });
      if (emailResult.success && emailResult.provider === 'resend') {
        deliveryMode = 'resend';
      }
    } catch (mailErr: any) {
      logger.warn(`[PublicInquiry] Resend dispatch fallback to mailto: ${mailErr?.message}`, { context: 'PublicInquiry' });
    }
  }

  return res.status(200).json({
    success: true,
    referenceId,
    deliveryMode,
    apiKeyConfigured: hasResendKey,
    from: fromAddress,
    recipient: recipientAddress,
    fallbackMailto,
    message:
      deliveryMode === 'resend'
        ? 'Your strategy brief has been delivered straight to contact@almnexus.tech.'
        : 'Automated email dispatch is not active on this environment (RESEND_API_KEY not configured). Use the direct mailto:contact@almnexus.tech link below to send your pre-filled brief immediately.'
  });
};

publicRouter.post('/', inquiryRateLimiter, handleInquirySubmission);
publicRouter.post('/inquiry', inquiryRateLimiter, handleInquirySubmission);

export default publicRouter;
