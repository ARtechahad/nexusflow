import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { resendService } from '../services/resendService';
import { getDB, saveDB } from '../db';
import { logger } from '../logger';

const publicRouter = Router();

export const ALLOWED_INQUIRY_CATEGORIES = [
  'Web / Mobile App',
  'Unity Game Development',
  'AI Bot / Model Fine-Tuning',
  'Data Scraping & Lead Gen',
  'Cybersecurity & Audit',
  'NexusFlow SaaS'
] as const;

const ALLOWED_BUDGET_RANGES = [
  'Under $5,000',
  '$5,000 - $15,000',
  '$15,000 - $35,000',
  '$35,000+',
  'Scope first / Not sure yet'
] as const;

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
    error: 'Too many requests from this network. Email contact@almnexus.tech directly or try again shortly.'
  }
});

const inquirySchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter your name (at least 2 characters).').max(120),
    email: z.string().trim().email('Please enter a valid work email address.').max(200),
    company: z.string().trim().max(250).optional().default(''),
    companyWebsite: z.string().trim().max(250).optional().default(''),
    category: z.enum(ALLOWED_INQUIRY_CATEGORIES).optional(),
    focus: z.string().trim().min(2).max(160).optional(),
    budget: z.string().trim().max(80).optional().default(''),
    message: z.string().trim().max(3000).optional(),
    notes: z.string().trim().max(3000).optional(),
    honeypot: z.string().max(200).optional().default(''),
    source: z.enum(['landing_inline', 'landing_modal', 'contact_page']).optional().default('contact_page')
  })
  .superRefine((data, ctx) => {
    const bodyText = (data.message || data.notes || '').trim();
    if (bodyText.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['message'],
        message: 'Please describe what you want built (at least 10 characters).'
      });
    }
    if (!data.category && !data.focus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'Please select a valid project category.'
      });
    }
    if (data.budget && data.budget.length > 0 && !(ALLOWED_BUDGET_RANGES as readonly string[]).includes(data.budget)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['budget'],
        message: 'Please select a valid budget option.'
      });
    }
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

function sanitizeCompanyField(raw: string): string {
  const cleaned = stripHeaderControls(raw);
  if (!cleaned) return '';
  if (/^(javascript|data|vbscript):/i.test(cleaned)) {
    return '';
  }
  return cleaned;
}

const handleInquirySubmission = async (req: Request, res: Response) => {
  // Silent success for bot honeypot traps before validation or persistence
  const rawBody = req.body && typeof req.body === 'object' ? req.body : {};
  const honeypotRaw =
    typeof rawBody.honeypot === 'string'
      ? rawBody.honeypot
      : typeof rawBody._gotcha === 'string'
        ? rawBody._gotcha
        : '';

  if (honeypotRaw.trim().length > 0) {
    return res.status(200).json({
      success: true,
      message: 'Your inquiry has been received.'
    });
  }

  const parsed = inquirySchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || 'Please check your form fields and try again.';
    return res.status(400).json({
      success: false,
      error: firstIssue
    });
  }

  const name = stripHeaderControls(parsed.data.name);
  const email = stripHeaderControls(parsed.data.email).toLowerCase();
  const company = sanitizeCompanyField(parsed.data.company || parsed.data.companyWebsite || '');
  const category = stripHeaderControls(parsed.data.category || parsed.data.focus || 'Web / Mobile App');
  const budget = stripHeaderControls(parsed.data.budget || '');
  const messageBody = (parsed.data.message || parsed.data.notes || '').trim();
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
      company: company || 'Not specified',
      companyWebsite: company || 'Not specified',
      category,
      focus: category,
      budget: budget || 'Not specified',
      notes: messageBody,
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
  const subject = `[almnexus.tech] [${category}] ${company || name}`;
  const textBody = [
    `ALM Nexus Project Inquiry (${referenceId})`,
    `Submitted At: ${submittedAt}`,
    `Source: ${source}`,
    `Name: ${name}`,
    `Work Email: ${email}`,
    `Company: ${company || 'Not specified'}`,
    `Category: ${category}`,
    `Budget Range: ${budget || 'Not specified'}`,
    '',
    'Project Brief:',
    messageBody
  ].join('\n');

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
      <div style="border-bottom: 1px solid #E2E8F0; padding-bottom: 14px; margin-bottom: 18px;">
        <p style="margin: 0; font-size: 12px; color: #2563EB; font-weight: 600;">ALM NEXUS · ALMNEXUS.TECH</p>
        <h2 style="margin: 6px 0 0; font-size: 18px; color: #0F172A;">New Project Inquiry</h2>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #475569; width: 170px;">Reference ID</td><td style="padding: 6px 0; font-family: monospace; font-weight: 600;">${escapeHtml(referenceId)}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569;">Name</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569;">Email</td><td style="padding: 6px 0;">${escapeHtml(email)}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569;">Company</td><td style="padding: 6px 0;">${escapeHtml(company || 'Not specified')}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569;">Category</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(category)}</td></tr>
        <tr><td style="padding: 6px 0; color: #475569;">Budget Range</td><td style="padding: 6px 0;">${escapeHtml(budget || 'Not specified')}</td></tr>
      </table>
      <div style="margin-top: 18px; padding: 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px;">
        <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px;">Project Brief</div>
        <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(messageBody)}</div>
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
        template: 'public_studio_inquiry',
        metadata: {
          referenceId,
          source,
          category,
          budget,
          company
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
    category,
    deliveryMode,
    apiKeyConfigured: hasResendKey,
    from: fromAddress,
    recipient: recipientAddress,
    fallbackMailto,
    message:
      deliveryMode === 'resend'
        ? 'Your inquiry was sent to contact@almnexus.tech. We reply within 1-2 business days.'
        : 'Automated email dispatch is inactive in this environment. Use the direct mailto:contact@almnexus.tech link below to send your brief.'
  });
};

publicRouter.post('/', inquiryRateLimiter, handleInquirySubmission);
publicRouter.post('/inquiry', inquiryRateLimiter, handleInquirySubmission);

export default publicRouter;
