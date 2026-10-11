import crypto from 'node:crypto';
import pg from 'pg';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { logger } from '../../logger';
import { encryptSecret, decryptSecret } from './crypto';
import { realtimeEngine } from '../realtimeEngine';

export interface ProviderPreset {
  id: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  hint: string;
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  gmail: {
    id: 'gmail',
    name: 'Google Gmail (Personal)',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    hint: 'Google requires 2-Step Verification enabled and a 16-character App Password generated in Google Account Settings (Security > 2-Step Verification > App Passwords).'
  },
  google_workspace: {
    id: 'google_workspace',
    name: 'Google Workspace (Custom Domain)',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    hint: 'Requires 2-Step Verification and an App Password. Ensure your Google Workspace Super Admin allows Less Secure Apps / App Passwords under Security policies.'
  },
  outlook_365: {
    id: 'outlook_365',
    name: 'Microsoft 365 / Outlook',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    hint: 'Microsoft 365 requires SMTP AUTH to be enabled in Microsoft 365 Admin Center (Users > Active Users > Mail > Manage email apps > Authenticated SMTP). For personal Outlook, use an App Password.'
  },
  zoho: {
    id: 'zoho',
    name: 'Zoho Mail',
    smtpHost: 'smtp.zoho.com',
    smtpPort: 465,
    smtpSecure: true,
    imapHost: 'imap.zoho.com',
    imapPort: 993,
    imapSecure: true,
    hint: 'If Two-Factor Authentication (TFA) is enabled, generate an Application-Specific Password in Zoho Accounts (Security > App Passwords).'
  },
  yahoo: {
    id: 'yahoo',
    name: 'Yahoo Mail',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 465,
    smtpSecure: true,
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecure: true,
    hint: 'Yahoo requires an App Password generated under Yahoo Account Security settings.'
  },
  fastmail: {
    id: 'fastmail',
    name: 'Fastmail',
    smtpHost: 'smtp.fastmail.com',
    smtpPort: 465,
    smtpSecure: true,
    imapHost: 'imap.fastmail.com',
    imapPort: 993,
    imapSecure: true,
    hint: 'Generate an App Password in Fastmail Settings > Password & Security > New App Password.'
  },
  custom: {
    id: 'custom',
    name: 'Custom SMTP / IMAP Server',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
    hint: 'Enter the SMTP and IMAP connection settings provided by your email server or web hosting provider.'
  }
};

export interface ConnectionTestParams {
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  imapHost: string;
  imapPort: number;
  imapUser?: string;
  password: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  smtp: {
    ok: boolean;
    error?: string;
    hint?: string;
  };
  imap: {
    ok: boolean;
    folders?: string[];
    hasSpamFolder?: boolean;
    error?: string;
    hint?: string;
  };
}

function resolveFriendlyError(err: any, host: string): { message: string; hint?: string } {
  const msg = err?.message || String(err);
  const lowerMsg = msg.toLowerCase();
  const lowerHost = host.toLowerCase();

  // Authentication error
  if (
    lowerMsg.includes('invalid login') ||
    lowerMsg.includes('authentication') ||
    lowerMsg.includes('auth') ||
    lowerMsg.includes('535') ||
    lowerMsg.includes('bad credentials') ||
    lowerMsg.includes('username and password not accepted')
  ) {
    if (lowerHost.includes('google') || lowerHost.includes('gmail')) {
      return {
        message: 'Authentication failed. Username or password rejected by Google.',
        hint: 'Gmail and Google Workspace require 2-Step Verification and a dedicated 16-character App Password (not your primary password).'
      };
    }
    if (lowerHost.includes('outlook') || lowerHost.includes('office365')) {
      return {
        message: 'Authentication failed. Username or password rejected by Microsoft.',
        hint: 'Microsoft 365 requires your Admin to enable "Authenticated SMTP" under Active Users > Mail > Manage email apps.'
      };
    }
    return {
      message: 'Authentication failed. Please verify your username and password.',
      hint: 'Ensure that your account does not require an App Password or Two-Factor Authentication token.'
    };
  }

  // Timeout error
  if (lowerMsg.includes('timeout') || lowerMsg.includes('timed out') || lowerMsg.includes('etimedout')) {
    return {
      message: 'Connection timed out after 15 seconds.',
      hint: 'Verify the hostname and port. Check if your mail server or firewall is blocking outbound connections on this port.'
    };
  }

  // TLS / Certificate errors
  if (lowerMsg.includes('tls') || lowerMsg.includes('ssl') || lowerMsg.includes('certificate') || lowerMsg.includes('eproto')) {
    return {
      message: 'SSL/TLS negotiation error.',
      hint: 'Verify your port and encryption mode: Port 465 requires SSL/TLS, while port 587 uses STARTTLS.'
    };
  }

  return { message: msg };
}

/**
 * Tests real SMTP and IMAP connectivity with a 15-second cap and friendly guidance
 */
export async function testMailboxConnection(params: ConnectionTestParams): Promise<ConnectionTestResult> {
  const result: ConnectionTestResult = {
    ok: false,
    smtp: { ok: false },
    imap: { ok: false }
  };

  // 1. SMTP Test via Nodemailer
  try {
    const smtpTransporter = nodemailer.createTransport({
      host: params.smtpHost,
      port: params.smtpPort,
      secure: params.smtpPort === 465,
      auth: {
        user: params.smtpUser,
        pass: params.password
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000
    });

    const verifyPromise = smtpTransporter.verify();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('SMTP connection timed out after 15s')), 15000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);
    result.smtp = { ok: true };
  } catch (smtpErr: any) {
    const friendly = resolveFriendlyError(smtpErr, params.smtpHost);
    result.smtp = {
      ok: false,
      error: friendly.message,
      hint: friendly.hint
    };
  }

  // 2. IMAP Test via ImapFlow
  let imapClient: ImapFlow | null = null;
  try {
    imapClient = new ImapFlow({
      host: params.imapHost,
      port: params.imapPort,
      secure: params.imapPort === 993,
      auth: {
        user: params.imapUser || params.smtpUser || params.email,
        pass: params.password
      },
      logger: false,
      clientInfo: {
        name: 'LeadFlow Outreach',
        version: '1.0.0'
      }
    });

    const connectPromise = async () => {
      await imapClient!.connect();
      const mailboxes = await imapClient!.list();
      const folderPaths = mailboxes.map(mb => mb.path);
      const hasSpam = folderPaths.some(p =>
        /spam|junk|bulk/i.test(p)
      );
      await imapClient!.logout();
      return { folderPaths, hasSpam };
    };

    const timeoutPromise = new Promise<{ folderPaths: string[]; hasSpam: boolean }>((_, reject) =>
      setTimeout(() => reject(new Error('IMAP connection timed out after 15s')), 15000)
    );

    const { folderPaths, hasSpam } = await Promise.race([connectPromise(), timeoutPromise]);
    result.imap = {
      ok: true,
      folders: folderPaths.slice(0, 10),
      hasSpamFolder: hasSpam
    };
  } catch (imapErr: any) {
    if (imapClient) {
      try {
        await imapClient.logout();
      } catch {}
    }
    const friendly = resolveFriendlyError(imapErr, params.imapHost);
    result.imap = {
      ok: false,
      error: friendly.message,
      hint: friendly.hint
    };
  }

  result.ok = result.smtp.ok && result.imap.ok;
  return result;
}

/**
 * Reads the tenant mailbox limit from ox_plans (defaults to 5)
 */
export async function getTenantMailboxLimit(pool: pg.Pool, tenantId: string): Promise<number> {
  try {
    const res = await pool.query(
      `SELECT mailbox_limit FROM ox_plans WHERE id = $1 LIMIT 1`,
      ['starter']
    );
    if (res.rows.length > 0 && res.rows[0].mailbox_limit) {
      return res.rows[0].mailbox_limit;
    }
  } catch {}
  return 5; // Default limit
}

export interface MailboxCreateInput {
  email: string;
  sender_name: string;
  provider?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  imap_host: string;
  imap_port: number;
  imap_user?: string;
  password: string;
  daily_cap?: number;
  send_interval_sec?: number;
  signature?: string;
}

/**
 * Creates and stores a new mailbox with encrypted secrets and domain linkage
 */
export async function createMailbox(
  pool: pg.Pool,
  tenantId: string,
  input: MailboxCreateInput,
  skipLiveCheck: boolean = false
): Promise<any> {
  // 1. Enforce mailbox limit
  const limit = await getTenantMailboxLimit(pool, tenantId);
  const countRes = await pool.query(
    `SELECT COUNT(*)::int as count FROM ox_mailboxes WHERE tenant_id = $1 AND is_deleted = false`,
    [tenantId]
  );
  const currentCount = countRes.rows[0]?.count || 0;

  if (currentCount >= limit) {
    throw new Error(`Plan limit of ${limit} mailboxes reached. Upgrade your plan to connect additional accounts.`);
  }

  // 2. Validate live connection unless explicitly skipped
  if (!skipLiveCheck) {
    const testResult = await testMailboxConnection({
      email: input.email,
      smtpHost: input.smtp_host,
      smtpPort: input.smtp_port,
      smtpUser: input.smtp_user,
      imapHost: input.imap_host,
      imapPort: input.imap_port,
      imapUser: input.imap_user || input.smtp_user,
      password: input.password
    });

    if (!testResult.ok) {
      const errParts: string[] = [];
      if (!testResult.smtp.ok) errParts.push(`SMTP: ${testResult.smtp.error || 'Failed'}`);
      if (!testResult.imap.ok) errParts.push(`IMAP: ${testResult.imap.error || 'Failed'}`);
      throw new Error(`Connection verification failed: ${errParts.join(' | ')}`);
    }
  }

  // 3. Encrypt credentials
  const encryptedPass = encryptSecret(input.password);
  const domainPart = input.email.split('@')[1]?.toLowerCase().trim();
  if (!domainPart) {
    throw new Error('Invalid email format: missing domain.');
  }

  // 4. Ensure domain entry in ox_domains
  let domainId = `dom_${crypto.randomUUID()}`;
  const existingDomain = await pool.query(
    `SELECT id FROM ox_domains WHERE tenant_id = $1 AND domain = $2 LIMIT 1`,
    [tenantId, domainPart]
  );

  if (existingDomain.rows.length > 0) {
    domainId = existingDomain.rows[0].id;
  } else {
    await pool.query(
      `INSERT INTO ox_domains (id, tenant_id, domain, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (tenant_id, domain) DO NOTHING`,
      [domainId, tenantId, domainPart]
    );
  }

  // 5. Store in ox_mailboxes
  const mailboxId = `mbx_${crypto.randomUUID()}`;
  const dailyCap = input.daily_cap ?? 30;
  const sendInterval = input.send_interval_sec ?? 120;
  const signature = input.signature ?? '';

  const insertQuery = `
    INSERT INTO ox_mailboxes (
      id, tenant_id, domain_id, email, sender_name, provider,
      smtp_host, smtp_port, smtp_user, smtp_pass_encrypted,
      imap_host, imap_port, imap_user, imap_pass_encrypted,
      status, daily_limit, daily_cap, send_interval_sec, signature,
      reputation_score, health_status, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14,
      'active', $15, $15, $16, $17,
      100.00, 'good', NOW(), NOW()
    )
    RETURNING id, tenant_id, domain_id, email, sender_name, provider,
              smtp_host, smtp_port, smtp_user, imap_host, imap_port, imap_user,
              status, daily_cap, send_interval_sec, signature, reputation_score,
              health_status, created_at, updated_at;
  `;

  const res = await pool.query(insertQuery, [
    mailboxId,
    tenantId,
    domainId,
    input.email.toLowerCase().trim(),
    input.sender_name.trim(),
    input.provider || 'smtp',
    input.smtp_host.trim(),
    input.smtp_port,
    input.smtp_user.trim(),
    encryptedPass,
    input.imap_host.trim(),
    input.imap_port,
    (input.imap_user || input.smtp_user).trim(),
    encryptedPass,
    dailyCap,
    sendInterval,
    signature
  ]);

  return res.rows[0];
}

/**
 * Lists tenant mailboxes joined with domain and today's sent telemetry
 * (NEVER returns encrypted secrets)
 */
export async function listMailboxes(pool: pg.Pool, tenantId: string): Promise<any[]> {
  const query = `
    SELECT 
      m.id,
      m.tenant_id,
      m.domain_id,
      m.email,
      m.sender_name,
      m.provider,
      m.smtp_host,
      m.smtp_port,
      m.smtp_user,
      m.imap_host,
      m.imap_port,
      m.imap_user,
      m.status,
      COALESCE(m.daily_cap, m.daily_limit, 30) as daily_cap,
      COALESCE(m.send_interval_sec, 120) as send_interval_sec,
      m.signature,
      m.reputation_score,
      m.health_status,
      m.last_error,
      m.created_at,
      m.updated_at,
      d.domain,
      d.spf_status,
      d.dkim_status,
      d.dmarc_status,
      d.mx_status,
      COALESCE(daily.campaign_sent_count, 0) as today_campaign_sent,
      COALESCE(daily.warmup_sent_count, 0) as today_warmup_sent,
      COALESCE(daily.bounced_count, 0) as today_bounced
    FROM ox_mailboxes m
    LEFT JOIN ox_domains d ON m.domain_id = d.id
    LEFT JOIN ox_mailbox_daily daily ON m.id = daily.mailbox_id AND daily.date_utc = CURRENT_DATE
    WHERE m.tenant_id = $1 AND m.is_deleted = false
    ORDER BY m.created_at DESC;
  `;

  const res = await pool.query(query, [tenantId]);
  return res.rows;
}

/**
 * Updates mailbox parameters with strict limits and optional secret re-encryption
 */
export async function updateMailbox(
  pool: pg.Pool,
  tenantId: string,
  mailboxId: string,
  updates: {
    daily_cap?: number;
    send_interval_sec?: number;
    status?: 'active' | 'paused';
    sender_name?: string;
    signature?: string;
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    imap_host?: string;
    imap_port?: number;
    imap_user?: string;
    password?: string;
  }
): Promise<any> {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: any[] = [mailboxId, tenantId];
  let paramIndex = 3;

  if (updates.daily_cap !== undefined) {
    const cap = Math.max(1, Math.min(120, updates.daily_cap));
    setClauses.push(`daily_cap = $${paramIndex}`);
    setClauses.push(`daily_limit = $${paramIndex}`);
    values.push(cap);
    paramIndex++;
  }

  if (updates.send_interval_sec !== undefined) {
    const interval = Math.max(30, updates.send_interval_sec);
    setClauses.push(`send_interval_sec = $${paramIndex}`);
    values.push(interval);
    paramIndex++;
  }

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex}`);
    values.push(updates.status);
    paramIndex++;
  }

  if (updates.sender_name !== undefined) {
    setClauses.push(`sender_name = $${paramIndex}`);
    values.push(updates.sender_name.trim());
    paramIndex++;
  }

  if (updates.signature !== undefined) {
    setClauses.push(`signature = $${paramIndex}`);
    values.push(updates.signature);
    paramIndex++;
  }

  if (updates.smtp_host !== undefined) {
    setClauses.push(`smtp_host = $${paramIndex}`);
    values.push(updates.smtp_host.trim());
    paramIndex++;
  }

  if (updates.smtp_port !== undefined) {
    setClauses.push(`smtp_port = $${paramIndex}`);
    values.push(updates.smtp_port);
    paramIndex++;
  }

  if (updates.smtp_user !== undefined) {
    setClauses.push(`smtp_user = $${paramIndex}`);
    values.push(updates.smtp_user.trim());
    paramIndex++;
  }

  if (updates.imap_host !== undefined) {
    setClauses.push(`imap_host = $${paramIndex}`);
    values.push(updates.imap_host.trim());
    paramIndex++;
  }

  if (updates.imap_port !== undefined) {
    setClauses.push(`imap_port = $${paramIndex}`);
    values.push(updates.imap_port);
    paramIndex++;
  }

  if (updates.imap_user !== undefined) {
    setClauses.push(`imap_user = $${paramIndex}`);
    values.push(updates.imap_user.trim());
    paramIndex++;
  }

  if (updates.password && updates.password.trim().length > 0) {
    const encrypted = encryptSecret(updates.password.trim());
    setClauses.push(`smtp_pass_encrypted = $${paramIndex}`);
    setClauses.push(`imap_pass_encrypted = $${paramIndex}`);
    values.push(encrypted);
    paramIndex++;
  }

  const query = `
    UPDATE ox_mailboxes
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND tenant_id = $2 AND is_deleted = false
    RETURNING id, tenant_id, domain_id, email, sender_name, provider,
              smtp_host, smtp_port, smtp_user, imap_host, imap_port, imap_user,
              status, daily_cap, send_interval_sec, signature, reputation_score,
              health_status, created_at, updated_at;
  `;

  const res = await pool.query(query, values);
  if (res.rows.length === 0) {
    throw new Error('Mailbox not found or already deleted');
  }

  return res.rows[0];
}

/**
 * Checks whether mailbox is used by a running campaign before soft-deleting
 */
export async function deleteMailboxSafely(
  pool: pg.Pool,
  tenantId: string,
  mailboxId: string
): Promise<{ success: boolean; inUseCampaigns?: Array<{ id: string; name: string; status: string }> }> {
  // Check for active campaigns using this mailbox
  const campaignCheckQuery = `
    SELECT c.id, c.name, c.status
    FROM ox_campaigns c
    JOIN ox_campaign_mailboxes cm ON c.id = cm.campaign_id
    WHERE cm.mailbox_id = $1 AND c.tenant_id = $2 AND c.status = 'active';
  `;

  const inUse = await pool.query(campaignCheckQuery, [mailboxId, tenantId]);
  if (inUse.rows.length > 0) {
    return {
      success: false,
      inUseCampaigns: inUse.rows
    };
  }

  // Soft delete
  await pool.query(
    `UPDATE ox_mailboxes
     SET is_deleted = true, status = 'disabled', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [mailboxId, tenantId]
  );

  return { success: true };
}

/**
 * Bulk imports up to 200 mailboxes from CSV text
 */
export async function bulkImportMailboxes(
  pool: pg.Pool,
  tenantId: string,
  csvText: string
): Promise<{ total: number; imported: number; failed: number; results: any[] }> {
  const lines = csvText.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('CSV content is empty.');
  }

  // Parse header if present
  let dataLines = lines;
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes('email') && firstLine.includes('smtp')) {
    dataLines = lines.slice(1);
  }

  if (dataLines.length > 200) {
    throw new Error('Bulk import limit is 200 rows per request.');
  }

  const limit = await getTenantMailboxLimit(pool, tenantId);
  const countRes = await pool.query(
    `SELECT COUNT(*)::int as count FROM ox_mailboxes WHERE tenant_id = $1 AND is_deleted = false`,
    [tenantId]
  );
  let currentCount = countRes.rows[0]?.count || 0;

  const results: any[] = [];
  let importedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < dataLines.length; i++) {
    const rawLine = dataLines[i];
    const cols = rawLine.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));

    // Expected format: email,smtp_host,smtp_port,smtp_user,imap_host,imap_port,imap_user,password
    const [
      email,
      smtp_host,
      rawSmtpPort,
      smtp_user,
      imap_host,
      rawImapPort,
      imap_user,
      password
    ] = cols;

    if (!email || !smtp_host || !password) {
      failedCount++;
      results.push({ row: i + 1, email: email || 'Unknown', success: false, error: 'Missing required columns (email, smtp_host, password).' });
      continue;
    }

    if (currentCount >= limit) {
      failedCount++;
      results.push({ row: i + 1, email, success: false, error: `Plan limit of ${limit} mailboxes reached.` });
      continue;
    }

    try {
      const mailbox = await createMailbox(
        pool,
        tenantId,
        {
          email,
          sender_name: email.split('@')[0],
          smtp_host,
          smtp_port: parseInt(rawSmtpPort || '587', 10),
          smtp_user: smtp_user || email,
          imap_host: imap_host || smtp_host,
          imap_port: parseInt(rawImapPort || '993', 10),
          imap_user: imap_user || smtp_user || email,
          password
        },
        true // Skip slow live check during bulk ingest, queued sync will verify
      );

      currentCount++;
      importedCount++;
      results.push({ row: i + 1, email, success: true, id: mailbox.id });
    } catch (err: any) {
      failedCount++;
      results.push({ row: i + 1, email, success: false, error: err.message });
    }
  }

  return {
    total: dataLines.length,
    imported: importedCount,
    failed: failedCount,
    results
  };
}

/**
 * Periodic 15-minute background verification job: re-tests active mailboxes,
 * updates health status, and emits realtime SSE notifications.
 */
export async function syncAllMailboxesStatus(pool: pg.Pool): Promise<void> {
  try {
    const query = `
      SELECT id, tenant_id, email, smtp_host, smtp_port, smtp_user, smtp_pass_encrypted,
             imap_host, imap_port, imap_user, imap_pass_encrypted
      FROM ox_mailboxes
      WHERE is_deleted = false AND status = 'active'
      LIMIT 50;
    `;

    const res = await pool.query(query);
    for (const mbx of res.rows) {
      try {
        if (!mbx.smtp_pass_encrypted) continue;
        const pass = decryptSecret(mbx.smtp_pass_encrypted);

        const check = await testMailboxConnection({
          email: mbx.email,
          smtpHost: mbx.smtp_host,
          smtpPort: mbx.smtp_port,
          smtpUser: mbx.smtp_user,
          imapHost: mbx.imap_host,
          imapPort: mbx.imap_port,
          imapUser: mbx.imap_user,
          password: pass
        });

        if (check.ok) {
          await pool.query(
            `UPDATE ox_mailboxes SET health_status = 'good', last_error = NULL, updated_at = NOW() WHERE id = $1`,
            [mbx.id]
          );
        } else {
          const errText = check.smtp.error || check.imap.error || 'Verification check failed';
          await pool.query(
            `UPDATE ox_mailboxes SET health_status = 'error', last_error = $2, updated_at = NOW() WHERE id = $1`,
            [mbx.id, errText]
          );

          // Emit SSE event to tenant
          realtimeEngine.broadcastToTenant(mbx.tenant_id, 'mailbox_error', {
            type: 'OUTREACH_MAILBOX_ERROR',
            title: 'Mailbox Health Alert',
            message: `Mailbox ${mbx.email} encountered a connection error: ${errText}`,
            timestamp: new Date().toISOString(),
            mailboxId: mbx.id,
            email: mbx.email
          });
        }
      } catch (err: any) {
        logger.warn(`Failed to sync mailbox ${mbx.id} status`, { details: err?.message });
      }
    }
  } catch (err: any) {
    logger.error('Error during syncAllMailboxesStatus background task', { details: err?.message });
  }
}
