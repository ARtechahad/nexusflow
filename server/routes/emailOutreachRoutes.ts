import { Router, Response } from 'express';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { getDB, saveDB, logAuditAction } from '../db';
import {
  AuthenticatedRequest,
  requireAuth,
  requireCompanyAccess,
  requireDepartmentModule
} from '../middlewares/auth';
import { resendService, DEFAULT_EMAIL_FROM } from '../services/resendService';

export const emailOutreachRouter = Router();

// Derive a 32-byte AES-256-GCM key deterministically from ENCRYPTION_KEY / JWT_SECRET / fallback seed
function getCredentialKey(): Buffer {
  const seed =
    process.env.ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    'clientops-email-credential-cipher-seed';
  return crypto.createHash('sha256').update(seed).digest();
}

function encryptCredential(plain: string): string {
  const key = getCredentialKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptCredential(encoded: string): string {
  const parts = String(encoded || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Stored credential format is invalid.');
  }
  const key = getCredentialKey();
  const iv = Buffer.from(parts[1], 'base64');
  const authTag = Buffer.from(parts[2], 'base64');
  const ciphertext = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function sanitizeAccount(account: any) {
  if (!account) return null;
  const { encryptedPassword, password, ...safe } = account;
  return safe;
}

const connectSmtpSchema = z.object({
  provider: z.literal('smtp'),
  senderName: z.string().trim().min(2, 'Sender Name is required (min 2 characters).').max(120),
  email: z.string().trim().email('Valid email address is required.').max(255),
  smtpHost: z.string().trim().min(3, 'SMTP Host is required (e.g. smtp.gmail.com).').max(255),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().max(255).optional(),
  password: z.string().min(1, 'Password or App Password is required.').max(500)
});

const connectResendSchema = z.object({
  provider: z.literal('resend'),
  senderName: z.string().trim().min(2, 'Sender Name is required (min 2 characters).').max(120),
  email: z.string().trim().email('Valid verified domain email address is required.').max(255)
});

const connectAccountSchema = z.discriminatedUnion('provider', [connectSmtpSchema, connectResendSchema]);

const sendCampaignSchema = z.object({
  accountId: z.string().trim().min(1, 'Please select a connected business email account.'),
  recipientsRaw: z.string().trim().min(1, 'Please enter at least one recipient email address.'),
  subject: z.string().trim().min(1, 'Campaign subject is required.').max(300),
  body: z.string().trim().min(1, 'Campaign message body is required.').max(50000)
});

const EMAIL_VALIDATION_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ParsedRecipient {
  email: string;
  name: string;
}

function defaultNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'there';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'there';
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseRecipientsInput(raw: string): { valid: ParsedRecipient[]; invalid: string[] } {
  const lines = raw
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tokens: string[] = [];
  for (const line of lines) {
    // Support comma-separated list on a single line (or "email, Name" pair)
    const commaParts = line.split(',').map((p) => p.trim()).filter(Boolean);
    if (
      commaParts.length === 2 &&
      EMAIL_VALIDATION_REGEX.test(commaParts[0]) &&
      !commaParts[1].includes('@')
    ) {
      tokens.push(`${commaParts[1]} <${commaParts[0]}>`);
    } else {
      tokens.push(...commaParts);
    }
  }

  const seen = new Set<string>();
  const valid: ParsedRecipient[] = [];
  const invalid: string[] = [];

  for (const token of tokens) {
    // Format: "Alice Smith <alice@company.com>"
    const bracketMatch = token.match(/^"?([^"<]+?)"?\s*<([^>]+)>$/);
    if (bracketMatch) {
      const displayName = bracketMatch[1].trim();
      const emailAddr = bracketMatch[2].trim().toLowerCase();
      if (EMAIL_VALIDATION_REGEX.test(emailAddr)) {
        if (!seen.has(emailAddr)) {
          seen.add(emailAddr);
          valid.push({
            email: emailAddr,
            name: displayName || defaultNameFromEmail(emailAddr)
          });
        }
      } else {
        invalid.push(token);
      }
      continue;
    }

    const emailCandidate = token.trim().toLowerCase();
    if (EMAIL_VALIDATION_REGEX.test(emailCandidate)) {
      if (!seen.has(emailCandidate)) {
        seen.add(emailCandidate);
        valid.push({
          email: emailCandidate,
          name: defaultNameFromEmail(emailCandidate)
        });
      }
    } else {
      invalid.push(token);
    }
  }

  return { valid, invalid };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToCleanHtml(text: string): string {
  const escaped = escapeHtml(text);
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin: 0 0 14px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #0f172a;">${paragraphs}</div>`;
}

function interpolateTemplate(template: string, recipient: ParsedRecipient): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, recipient.name)
    .replace(/\{\{\s*email\s*\}\}/gi, recipient.email);
}

// All Email Outreach endpoints require authenticated session, company isolation, and 'email_hub' access
emailOutreachRouter.use(requireAuth, requireCompanyAccess, requireDepartmentModule('email_hub'));

/**
 * GET /api/email-outreach/accounts
 * List connected business email accounts for the active company (passwords stripped).
 */
emailOutreachRouter.get('/accounts', (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const companyId = req.companyId!;
  const accounts = (db.emailAccounts || [])
    .filter((a: any) => a.companyId === companyId)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(sanitizeAccount);

  return res.json({
    success: true,
    accounts,
    resendConfigured: resendService.isConfigured(),
    defaultResendFrom: DEFAULT_EMAIL_FROM
  });
});

/**
 * POST /api/email-outreach/accounts
 * Connect & verify a real SMTP / Gmail App Password account OR Company Domain via Resend.
 */
emailOutreachRouter.post('/accounts', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = connectAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstErr = parsed.error.issues[0]?.message || 'Invalid email account configuration.';
    return res.status(400).json({
      success: false,
      error: firstErr,
      message: firstErr
    });
  }

  const db = getDB();
  const companyId = req.companyId!;
  if (!Array.isArray(db.emailAccounts)) db.emailAccounts = [];

  const data = parsed.data;
  const normalizedEmail = data.email.toLowerCase();

  const duplicate = db.emailAccounts.find(
    (a: any) =>
      a.companyId === companyId &&
      String(a.email).toLowerCase() === normalizedEmail &&
      a.provider === data.provider
  );
  if (duplicate) {
    return res.status(409).json({
      success: false,
      error: `${normalizedEmail} (${data.provider.toUpperCase()}) is already connected to this company.`
    });
  }

  const now = new Date().toISOString();

  if (data.provider === 'smtp') {
    const smtpUsername = data.username?.trim() || normalizedEmail;
    const transporter = nodemailer.createTransport({
      host: data.smtpHost,
      port: data.smtpPort,
      secure: data.smtpPort === 465,
      auth: {
        user: smtpUsername,
        pass: data.password
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      transporter.close?.();
      const reason = verifyErr?.message || 'Unable to authenticate with SMTP server.';
      return res.status(400).json({
        success: false,
        code: 'SMTP_VERIFY_FAILED',
        error: `SMTP verification failed: ${reason}. Double-check your SMTP host, port, email, and App Password.`,
        message: `SMTP verification failed: ${reason}`
      });
    }
    transporter.close?.();

    const newAccount = {
      id: `eacc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      companyId,
      provider: 'smtp' as const,
      senderName: data.senderName,
      email: normalizedEmail,
      smtpHost: data.smtpHost,
      smtpPort: data.smtpPort,
      secure: data.smtpPort === 465,
      username: smtpUsername,
      encryptedPassword: encryptCredential(data.password),
      status: 'verified' as const,
      verifiedAt: now,
      createdByUserId: req.user!.id,
      createdByName: req.user!.name,
      createdAt: now
    };

    db.emailAccounts.unshift(newAccount);
    saveDB(db);

    logAuditAction({
      userId: req.user!.id,
      userName: req.user!.name,
      userRole: req.companyRole || 'company_admin',
      action: 'EMAIL_ACCOUNT_CONNECTED',
      entityType: 'email_account',
      entityId: newAccount.id,
      details: { companyId, provider: 'smtp', email: normalizedEmail, smtpHost: data.smtpHost },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.status(201).json({
      success: true,
      message: `SMTP account ${normalizedEmail} verified and connected.`,
      account: sanitizeAccount(newAccount)
    });
  }

  // Provider: Resend
  if (!resendService.isConfigured()) {
    return res.status(400).json({
      success: false,
      code: 'RESEND_NOT_CONFIGURED',
      error:
        'Resend API key is not configured on the server. Set a valid RESEND_API_KEY in environment variables or connect via SMTP / Gmail App Password.',
      message: 'Resend API key is not configured on the server.'
    });
  }

  const newResendAccount = {
    id: `eacc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    companyId,
    provider: 'resend' as const,
    senderName: data.senderName,
    email: normalizedEmail,
    status: 'verified' as const,
    verifiedAt: now,
    createdByUserId: req.user!.id,
    createdByName: req.user!.name,
    createdAt: now
  };

  db.emailAccounts.unshift(newResendAccount);
  saveDB(db);

  logAuditAction({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.companyRole || 'company_admin',
    action: 'EMAIL_ACCOUNT_CONNECTED',
    entityType: 'email_account',
    entityId: newResendAccount.id,
    details: { companyId, provider: 'resend', email: normalizedEmail },
    ipAddress: req.ip || '127.0.0.1'
  });

  return res.status(201).json({
    success: true,
    message: `Resend sender ${normalizedEmail} connected.`,
    account: sanitizeAccount(newResendAccount)
  });
});

/**
 * DELETE /api/email-outreach/accounts/:accountId
 */
emailOutreachRouter.delete('/accounts/:accountId', (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const companyId = req.companyId!;
  const { accountId } = req.params;

  if (!Array.isArray(db.emailAccounts)) db.emailAccounts = [];
  const idx = db.emailAccounts.findIndex(
    (a: any) => a.id === accountId && a.companyId === companyId
  );

  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Connected email account not found.' });
  }

  const [removed] = db.emailAccounts.splice(idx, 1);
  saveDB(db);

  return res.json({
    success: true,
    message: `Disconnected ${removed.email}.`
  });
});

/**
 * GET /api/email-outreach/campaigns
 * Returns real sent campaigns and per-recipient delivery logs for the active company.
 */
emailOutreachRouter.get('/campaigns', (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const companyId = req.companyId!;

  const logs = (db.emailDeliveryLogs || [])
    .filter((l: any) => l.companyId === companyId)
    .sort((a: any, b: any) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  const campaigns = (db.emailCampaigns || [])
    .filter((c: any) => c.companyId === companyId)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((c: any) => ({
      ...c,
      logs: logs.filter((l: any) => l.campaignId === c.id)
    }));

  const totalSent = logs.filter((l: any) => l.status === 'sent').length;
  const totalFailed = logs.filter((l: any) => l.status === 'failed').length;

  return res.json({
    success: true,
    campaigns,
    deliveryLogs: logs.slice(0, 200),
    summary: {
      totalCampaigns: campaigns.length,
      totalRecipients: logs.length,
      totalSent,
      totalFailed
    }
  });
});

/**
 * POST /api/email-outreach/campaigns/send
 * Dispatches real emails via the chosen SMTP or Resend account and logs each delivery outcome.
 */
emailOutreachRouter.post('/campaigns/send', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = sendCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstErr = parsed.error.issues[0]?.message || 'Invalid campaign payload.';
    return res.status(400).json({ success: false, error: firstErr, message: firstErr });
  }

  const db = getDB();
  const companyId = req.companyId!;
  const { accountId, recipientsRaw, subject, body } = parsed.data;

  const account = (db.emailAccounts || []).find(
    (a: any) => a.id === accountId && a.companyId === companyId
  );

  if (!account) {
    return res.status(404).json({
      success: false,
      error: 'Selected business email account not found in this company.'
    });
  }

  const { valid: recipients, invalid } = parseRecipientsInput(recipientsRaw);
  if (recipients.length === 0) {
    return res.status(400).json({
      success: false,
      error:
        invalid.length > 0
          ? `No valid recipient emails found. Invalid entries: ${invalid.slice(0, 3).join(', ')}`
          : 'Please enter at least one valid recipient email address.'
    });
  }

  if (!Array.isArray(db.emailCampaigns)) db.emailCampaigns = [];
  if (!Array.isArray(db.emailDeliveryLogs)) db.emailDeliveryLogs = [];

  const campaignId = `ecamp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();

  let smtpTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;
  if (account.provider === 'smtp') {
    try {
      const plainPassword = decryptCredential(account.encryptedPassword);
      smtpTransporter = nodemailer.createTransport({
        host: account.smtpHost,
        port: Number(account.smtpPort) || 587,
        secure: Boolean(account.secure ?? Number(account.smtpPort) === 465),
        auth: {
          user: account.username || account.email,
          pass: plainPassword
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000
      });
    } catch (decErr: any) {
      return res.status(500).json({
        success: false,
        error: `Could not initialize SMTP credentials: ${decErr?.message || 'Decryption error'}`
      });
    }
  }

  const campaignLogs: any[] = [];
  let sentCount = 0;
  let failedCount = 0;

  try {
    for (const recipient of recipients) {
      const personalizedSubject = interpolateTemplate(subject, recipient);
      const personalizedBody = interpolateTemplate(body, recipient);
      const htmlBody = textToCleanHtml(personalizedBody);
      const logTime = new Date().toISOString();

      let status: 'sent' | 'failed' = 'failed';
      let messageId: string | undefined;
      let errorReason: string | undefined;

      if (account.provider === 'smtp' && smtpTransporter) {
        try {
          const info = await smtpTransporter.sendMail({
            from: `"${account.senderName}" <${account.email}>`,
            to: recipient.email,
            subject: personalizedSubject,
            text: personalizedBody,
            html: htmlBody
          });
          status = 'sent';
          messageId = info.messageId;
        } catch (sendErr: any) {
          status = 'failed';
          errorReason = sendErr?.message || 'SMTP send failed';
        }
      } else if (account.provider === 'resend') {
        try {
          const result = await resendService.sendEmail({
            to: recipient.email,
            from: account.email,
            fromName: account.senderName,
            subject: personalizedSubject,
            text: personalizedBody,
            html: htmlBody,
            tenantId: companyId,
            template: 'email_outreach_campaign'
          });

          if (result.success && result.provider === 'resend') {
            status = 'sent';
            messageId = result.messageId;
          } else {
            status = 'failed';
            errorReason = result.error || 'Resend delivery rejected or API key not configured.';
          }
        } catch (resendErr: any) {
          status = 'failed';
          errorReason = resendErr?.message || 'Resend request error';
        }
      }

      if (status === 'sent') sentCount += 1;
      else failedCount += 1;

      const logEntry = {
        id: `elog-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        campaignId,
        companyId,
        accountId: account.id,
        provider: account.provider,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        subject: personalizedSubject,
        status,
        messageId: messageId || '',
        errorReason: errorReason || '',
        sentAt: logTime
      };
      campaignLogs.push(logEntry);
      db.emailDeliveryLogs.unshift(logEntry);
    }
  } finally {
    smtpTransporter?.close?.();
  }

  const campaignRecord = {
    id: campaignId,
    companyId,
    accountId: account.id,
    accountEmail: account.email,
    senderName: account.senderName,
    provider: account.provider,
    subject,
    body,
    totalRecipients: recipients.length,
    sentCount,
    failedCount,
    invalidSkipped: invalid,
    createdByUserId: req.user!.id,
    createdByName: req.user!.name,
    createdAt: now
  };

  db.emailCampaigns.unshift(campaignRecord);
  saveDB(db);

  logAuditAction({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.companyRole || 'company_admin',
    action: 'EMAIL_CAMPAIGN_DISPATCHED',
    entityType: 'email_campaign',
    entityId: campaignId,
    details: {
      companyId,
      provider: account.provider,
      from: account.email,
      totalRecipients: recipients.length,
      sentCount,
      failedCount
    },
    ipAddress: req.ip || '127.0.0.1'
  });

  return res.status(200).json({
    success: true,
    message:
      failedCount === 0
        ? `Campaign dispatched: ${sentCount} of ${recipients.length} email(s) sent successfully.`
        : `Campaign finished: ${sentCount} sent, ${failedCount} failed.`,
    campaign: {
      ...campaignRecord,
      logs: campaignLogs
    },
    deliveryLogs: campaignLogs,
    invalidSkipped: invalid
  });
});

export default emailOutreachRouter;
