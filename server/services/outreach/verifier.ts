import dns from 'node:dns';
import net from 'node:net';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';
import { registerHandler, enqueue } from './queue';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type VerificationStatus = 'valid' | 'risky' | 'invalid' | 'unknown';

export interface VerificationChecks {
  syntax: boolean;
  disposable: boolean;
  role: boolean;
  mx: boolean;
  hasArecordFallback?: boolean;
  smtp?: boolean | 'unknown';
  catchAll?: boolean | 'unknown';
}

export interface VerificationResult {
  email: string;
  status: VerificationStatus;
  reason: string;
  checks: VerificationChecks;
  typoSuggestion?: string;
  mxRecords?: string[];
  processedAt: string;
}

export interface VerificationBatchResult {
  id: string;
  tenantId: string;
  total: number;
  processed: number;
  valid: number;
  risky: number;
  invalid: number;
  unknown: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: VerificationResult[];
}

// ============================================================================
// 1. DISPOSABLE DOMAIN LIST & ADMIN UPDATES
// ============================================================================

const disposableDomainSet = new Set<string>();

/**
 * Initializes the disposable domains set from JSON file and PostgreSQL database
 */
export function loadDisposableDomains(): void {
  try {
    const jsonPath = path.resolve(process.cwd(), 'server/data/disposableDomains.json');
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const d of list) {
          if (typeof d === 'string' && d.trim()) {
            disposableDomainSet.add(d.trim().toLowerCase());
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn('Failed to load disposableDomains.json file: ' + err?.message, {
      context: 'Verifier'
    });
  }

  // Common fallbacks
  const fallbacks = [
    'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'tempmail.com',
    'throwawaymail.com', 'yopmail.com', 'sharklasers.com', 'trashmail.com',
    'dispostable.com', 'fakeinbox.com', 'getairmail.com', 'mytrashmail.com'
  ];
  for (const f of fallbacks) {
    disposableDomainSet.add(f);
  }
}

// Initial sync on boot
loadDisposableDomains();

/**
 * Adds custom disposable domains to DB and active set (admin operation)
 */
export async function addDisposableDomain(domain: string, pool?: pg.Pool): Promise<void> {
  const clean = domain.trim().toLowerCase();
  disposableDomainSet.add(clean);
  const targetPool = pool || getOutreachPool();
  if (targetPool) {
    await targetPool.query(
      `INSERT INTO ox_disposable_domains (domain, source, created_at)
       VALUES ($1, 'admin', NOW())
       ON CONFLICT (domain) DO NOTHING`,
      [clean]
    );
  }
}

// ============================================================================
// 2. ROLE ADDRESS PREFIXES & TYPO SUGGESTIONS
// ============================================================================

export const ROLE_PREFIXES = new Set([
  'admin', 'administrator', 'info', 'support', 'sales', 'contact', 'hello',
  'help', 'billing', 'office', 'team', 'jobs', 'careers', 'press', 'marketing',
  'security', 'privacy', 'legal', 'compliance', 'media', 'inquiries', 'feedback',
  'postmaster', 'hostmaster', 'webmaster', 'abuse', 'noreply', 'no-reply'
]);

export const TYPO_DOMAIN_MAP: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlokk.com': 'outlook.com',
  'iclod.com': 'icloud.com',
  'icoud.com': 'icloud.com'
};

export function suggestEmailTypo(email: string): string | undefined {
  const parts = email.toLowerCase().split('@');
  if (parts.length !== 2) return undefined;
  const domain = parts[1];
  const suggestedDomain = TYPO_DOMAIN_MAP[domain];
  if (suggestedDomain) {
    return `${parts[0]}@${suggestedDomain}`;
  }
  return undefined;
}

// ============================================================================
// 3. 24-HOUR DOMAIN MX / CATCH-ALL CACHE & RATE LIMITER
// ============================================================================

interface DomainCacheEntry {
  hasMx: boolean;
  mxRecords: string[];
  hasA: boolean;
  isCatchAll?: boolean;
  cachedAt: number;
}

const domainCache = new Map<string, DomainCacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiter per target domain: track last probe timestamp (minimum 1000ms separation)
const domainProbeTimestamps = new Map<string, number>();

async function throttleDomainProbe(domain: string): Promise<void> {
  const lastTime = domainProbeTimestamps.get(domain) || 0;
  const now = Date.now();
  const diff = now - lastTime;
  if (diff < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - diff));
  }
  domainProbeTimestamps.set(domain, Date.now());
}

// ============================================================================
// 4. DNS MX LOOKUP WITH A-RECORD FALLBACK
// ============================================================================

export async function lookupDomainDns(domain: string): Promise<{
  hasMx: boolean;
  mxRecords: string[];
  hasA: boolean;
}> {
  const cleanDomain = domain.toLowerCase().trim();
  const cached = domainCache.get(cleanDomain);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return {
      hasMx: cached.hasMx,
      mxRecords: cached.mxRecords,
      hasA: cached.hasA
    };
  }

  let hasMx = false;
  let mxRecords: string[] = [];
  let hasA = false;

  try {
    const records = await dns.promises.resolveMx(cleanDomain);
    if (records && records.length > 0) {
      hasMx = true;
      // Sort by priority ascending
      records.sort((a, b) => a.priority - b.priority);
      mxRecords = records.map((r) => r.exchange);
    }
  } catch (err: any) {
    // MX lookup failed, try A record fallback per RFC
    hasMx = false;
  }

  // RFC A-record fallback check if no MX
  if (!hasMx) {
    try {
      const aRecords = await dns.promises.resolve4(cleanDomain);
      if (aRecords && aRecords.length > 0) {
        hasA = true;
        mxRecords = [cleanDomain]; // Fallback mail host
      }
    } catch {
      hasA = false;
    }
  }

  domainCache.set(cleanDomain, {
    hasMx,
    mxRecords,
    hasA,
    cachedAt: Date.now()
  });

  return { hasMx, mxRecords, hasA };
}

// ============================================================================
// 5. OPTIONAL SMTP RCPT TO PROBE & CATCH-ALL DETECTION
// Feature-flagged. On port 25 block/timeout, ALWAYS returns 'unknown', NEVER 'invalid'.
// ============================================================================

export async function probeSmtpMailbox(
  email: string,
  mxHost: string,
  heloDomain: string = 'verifier.leadflow.internal'
): Promise<{ success: boolean | 'unknown'; isCatchAll?: boolean; reason?: string }> {
  // Feature flag check
  if (process.env.ENABLE_SMTP_PROBE !== 'true') {
    return { success: 'unknown', reason: 'smtp_probe_disabled' };
  }

  const domain = email.split('@')[1];
  await throttleDomainProbe(domain);

  return new Promise((resolve) => {
    let resolved = false;
    const socket = new net.Socket();
    const timeoutMs = 8000;

    const finish = (result: { success: boolean | 'unknown'; isCatchAll?: boolean; reason?: string }) => {
      if (resolved) return;
      resolved = true;
      try {
        socket.destroy();
      } catch {}
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      // Host blocks port 25 or timed out -> return 'unknown', never 'invalid'
      finish({ success: 'unknown', reason: 'smtp_timeout_port25_blocked' });
    });

    socket.on('error', (err) => {
      // Connection refused, firewall, or port 25 blocked -> return 'unknown', never 'invalid'
      finish({ success: 'unknown', reason: `smtp_connection_failed: ${err?.message}` });
    });

    let step = 0;
    let buffer = '';

    socket.connect(25, mxHost, () => {
      // Connected to port 25
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const code = parseInt(line.slice(0, 3), 10);
        if (isNaN(code)) continue;

        if (step === 0 && (code === 220 || code === 250)) {
          // Send HELO
          step = 1;
          socket.write(`HELO ${heloDomain}\r\n`);
        } else if (step === 1 && (code === 250 || code === 220)) {
          // Send MAIL FROM
          step = 2;
          socket.write(`MAIL FROM:<check@${heloDomain}>\r\n`);
        } else if (step === 2 && code === 250) {
          // Send RCPT TO
          step = 3;
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (step === 3) {
          // Evaluate recipient response
          if (code === 250) {
            finish({ success: true, reason: 'smtp_recipient_accepted' });
          } else if (code >= 500 && code <= 599) {
            finish({ success: false, reason: 'smtp_mailbox_not_found' });
          } else {
            finish({ success: 'unknown', reason: `smtp_code_${code}` });
          }
        }
      }
    });
  });
}

/**
 * Probes for catch-all domain by testing a random non-existent address
 */
export async function detectCatchAll(
  domain: string,
  mxHost: string
): Promise<boolean | 'unknown'> {
  const cached = domainCache.get(domain);
  if (cached && cached.isCatchAll !== undefined) {
    return cached.isCatchAll;
  }

  if (process.env.ENABLE_SMTP_PROBE !== 'true') {
    return 'unknown';
  }

  const randomAddress = `probe-nonexistent-${crypto.randomUUID().slice(0, 8)}@${domain}`;
  const probe = await probeSmtpMailbox(randomAddress, mxHost);

  if (probe.success === true) {
    // If random address accepted, domain is catch-all
    if (cached) cached.isCatchAll = true;
    return true;
  } else if (probe.success === false) {
    if (cached) cached.isCatchAll = false;
    return false;
  }

  return 'unknown';
}

// ============================================================================
// 6. MONTHLY VERIFICATION QUOTA MANAGEMENT
// ============================================================================

export async function checkAndIncrementVerificationQuota(
  tenantId: string,
  count: number = 1,
  pool?: pg.Pool
): Promise<{ allowed: boolean; used: number; quota: number; remaining: number }> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) {
    return { allowed: true, used: 0, quota: 1000, remaining: 1000 };
  }

  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

  // 1. Fetch quota from ox_tenant_plans or fallback ox_plans
  const tenantPlanRes = await targetPool.query(
    `SELECT COALESCE(p.verification_quota, 1000)::int as quota
     FROM ox_tenant_plans tp
     JOIN ox_plans p ON tp.plan_id = p.id
     WHERE tp.tenant_id = $1`,
    [tenantId]
  );
  let quota = tenantPlanRes.rows[0]?.quota;
  if (!quota) {
    const planRes = await targetPool.query(
      `SELECT COALESCE(verification_quota, 1000)::int as quota FROM ox_plans LIMIT 1`
    );
    quota = planRes.rows[0]?.quota ?? 1000;
  }

  // 2. Fetch current usage for this month
  const usageRes = await targetPool.query(
    `SELECT verification_count FROM ox_verification_usage
     WHERE tenant_id = $1 AND year_month = $2`,
    [tenantId, yearMonth]
  );
  const currentUsed = usageRes.rows[0]?.verification_count ?? 0;

  if (currentUsed + count > quota) {
    return {
      allowed: false,
      used: currentUsed,
      quota,
      remaining: Math.max(0, quota - currentUsed)
    };
  }

  // 3. Increment usage atomically
  const usageId = `vusg_${tenantId}_${yearMonth.replace('-', '')}`;
  await targetPool.query(
    `INSERT INTO ox_verification_usage (id, tenant_id, year_month, verification_count, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tenant_id, year_month) DO UPDATE
     SET verification_count = ox_verification_usage.verification_count + $4,
         updated_at = NOW()`,
    [usageId, tenantId, yearMonth, count]
  );

  return {
    allowed: true,
    used: currentUsed + count,
    quota,
    remaining: quota - (currentUsed + count)
  };
}

// ============================================================================
// 7. CORE SINGLE EMAIL VERIFICATION PIPELINE
// Layers: Syntax -> Typo -> Disposable -> Role -> MX/A-record -> SMTP/Catch-all
// ============================================================================

export async function verifySingleEmail(
  rawEmail: string,
  options?: {
    pool?: pg.Pool;
    tenantId?: string;
    bypassQuota?: boolean;
  }
): Promise<VerificationResult> {
  const processedAt = new Date().toISOString();
  const email = (rawEmail || '').trim().toLowerCase();

  // Quota enforcement
  if (options?.tenantId && !options.bypassQuota) {
    const quotaCheck = await checkAndIncrementVerificationQuota(options.tenantId, 1, options.pool);
    if (!quotaCheck.allowed) {
      throw new Error(
        `Verification monthly quota reached (${quotaCheck.used}/${quotaCheck.quota}). Please upgrade your plan.`
      );
    }
  }

  // LAYER 1: Syntax Validation
  // RFC-practical constraints: <= 254 chars total, <= 64 chars local part
  if (!email || email.length > 254) {
    return {
      email,
      status: 'invalid',
      reason: 'syntax_too_long',
      checks: { syntax: false, disposable: false, role: false, mx: false },
      processedAt
    };
  }

  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      email,
      status: 'invalid',
      reason: 'syntax_invalid_format',
      checks: { syntax: false, disposable: false, role: false, mx: false },
      processedAt
    };
  }

  const [localPart, domain] = parts;
  if (localPart.length > 64 || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return {
      email,
      status: 'invalid',
      reason: 'syntax_invalid_local_part',
      checks: { syntax: false, disposable: false, role: false, mx: false },
      processedAt
    };
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) {
    return {
      email,
      status: 'invalid',
      reason: 'syntax_regex_mismatch',
      checks: { syntax: false, disposable: false, role: false, mx: false },
      processedAt
    };
  }

  // LAYER 2: Typo Suggestion
  const typoSuggestion = suggestEmailTypo(email);

  // LAYER 3: Disposable Domain Check
  const isDisposable = disposableDomainSet.has(domain);
  if (isDisposable) {
    return {
      email,
      status: 'invalid',
      reason: 'disposable_domain',
      checks: { syntax: true, disposable: true, role: false, mx: false },
      typoSuggestion,
      processedAt
    };
  }

  // LAYER 4: Role-based Address Check
  const isRole = ROLE_PREFIXES.has(localPart);

  // LAYER 5: MX / A-Record DNS Lookup
  const dnsResult = await lookupDomainDns(domain);
  if (!dnsResult.hasMx && !dnsResult.hasA) {
    return {
      email,
      status: 'invalid',
      reason: 'no_mx_or_a_record',
      checks: { syntax: true, disposable: false, role: isRole, mx: false },
      typoSuggestion,
      processedAt
    };
  }

  // LAYER 6: Optional SMTP Probe & Catch-All Detection
  let smtpCheck: boolean | 'unknown' = 'unknown';
  let catchAllCheck: boolean | 'unknown' = 'unknown';

  if (process.env.ENABLE_SMTP_PROBE === 'true' && dnsResult.mxRecords.length > 0) {
    const primaryMx = dnsResult.mxRecords[0];
    const probe = await probeSmtpMailbox(email, primaryMx);
    smtpCheck = probe.success;

    const catchAll = await detectCatchAll(domain, primaryMx);
    catchAllCheck = catchAll;

    if (catchAll === true) {
      return {
        email,
        status: 'risky',
        reason: 'catch_all_domain',
        checks: {
          syntax: true,
          disposable: false,
          role: isRole,
          mx: true,
          smtp: smtpCheck,
          catchAll: true
        },
        typoSuggestion,
        mxRecords: dnsResult.mxRecords,
        processedAt
      };
    }

    if (smtpCheck === false) {
      return {
        email,
        status: 'invalid',
        reason: 'smtp_mailbox_not_found',
        checks: {
          syntax: true,
          disposable: false,
          role: isRole,
          mx: true,
          smtp: false,
          catchAll: catchAllCheck
        },
        typoSuggestion,
        mxRecords: dnsResult.mxRecords,
        processedAt
      };
    }

    if (smtpCheck === 'unknown') {
      return {
        email,
        status: 'unknown',
        reason: probe.reason || 'smtp_unreachable_port25_blocked',
        checks: {
          syntax: true,
          disposable: false,
          role: isRole,
          mx: true,
          smtp: 'unknown',
          catchAll: catchAllCheck
        },
        typoSuggestion,
        mxRecords: dnsResult.mxRecords,
        processedAt
      };
    }
  }

  // Determine final status
  let finalStatus: VerificationStatus = 'valid';
  let finalReason = 'deliverable_mailbox';

  if (isRole) {
    finalStatus = 'risky';
    finalReason = 'role_based_address';
  } else if (dnsResult.hasA && !dnsResult.hasMx) {
    finalStatus = 'risky';
    finalReason = 'a_record_fallback_only';
  }

  return {
    email,
    status: finalStatus,
    reason: finalReason,
    checks: {
      syntax: true,
      disposable: false,
      role: isRole,
      mx: true,
      hasArecordFallback: dnsResult.hasA && !dnsResult.hasMx,
      smtp: smtpCheck,
      catchAll: catchAllCheck
    },
    typoSuggestion,
    mxRecords: dnsResult.mxRecords,
    processedAt
  };
}

// ============================================================================
// 8. BULK VERIFICATION PROCESSOR
// ============================================================================

export async function verifyBulkEmails(
  emails: string[],
  tenantId: string,
  pool: pg.Pool,
  batchId?: string
): Promise<VerificationBatchResult> {
  const id = batchId || `vbat_${crypto.randomUUID()}`;
  const total = emails.length;

  // Quota pre-check
  const quotaCheck = await checkAndIncrementVerificationQuota(tenantId, total, pool);
  if (!quotaCheck.allowed) {
    throw new Error(
      `Bulk verification exceeds monthly quota. Requested: ${total}, Remaining: ${quotaCheck.remaining} (Used: ${quotaCheck.used}/${quotaCheck.quota}).`
    );
  }

  // Create batch record in DB
  await pool.query(
    `INSERT INTO ox_verification_batches (id, tenant_id, total_count, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'processing', NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET status = 'processing', updated_at = NOW()`,
    [id, tenantId, total]
  );

  const results: VerificationResult[] = [];
  let validCount = 0;
  let riskyCount = 0;
  let invalidCount = 0;
  let unknownCount = 0;

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const res = await verifySingleEmail(email, { pool, bypassQuota: true });
    results.push(res);

    if (res.status === 'valid') validCount++;
    else if (res.status === 'risky') riskyCount++;
    else if (res.status === 'invalid') invalidCount++;
    else unknownCount++;

    // Update prospect record in ox_prospects if present
    await pool.query(
      `UPDATE ox_prospects
       SET verification_status = $1,
           verification_reason = $2,
           verified_at = NOW(),
           updated_at = NOW()
       WHERE tenant_id = $3 AND LOWER(email) = LOWER($4)`,
      [res.status, res.reason, tenantId, email.trim()]
    );
  }

  // Update batch in DB
  await pool.query(
    `UPDATE ox_verification_batches
     SET processed_count = $1,
         valid_count = $2,
         risky_count = $3,
         invalid_count = $4,
         unknown_count = $5,
         status = 'completed',
         results = $6,
         updated_at = NOW()
     WHERE id = $7`,
    [total, validCount, riskyCount, invalidCount, unknownCount, JSON.stringify(results), id]
  );

  return {
    id,
    tenantId,
    total,
    processed: total,
    valid: validCount,
    risky: riskyCount,
    invalid: invalidCount,
    unknown: unknownCount,
    status: 'completed',
    results
  };
}

/**
 * Enqueue a bulk verification background job via ox_jobs
 */
export async function enqueueVerificationBatch(
  emails: string[],
  tenantId: string,
  pool?: pg.Pool
): Promise<{ batchId: string; total: number; status: string; message: string }> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) {
    throw new Error('Database pool not available for verification queue');
  }

  const total = emails.length;
  const batchId = `vbat_${crypto.randomUUID()}`;

  // Pre-check monthly quota
  const quotaCheck = await checkAndIncrementVerificationQuota(tenantId, total, targetPool);
  if (!quotaCheck.allowed) {
    throw new Error(
      `Bulk verification exceeds monthly quota. Requested: ${total}, Remaining: ${quotaCheck.remaining} (Used: ${quotaCheck.used}/${quotaCheck.quota}).`
    );
  }

  // Create batch record in ox_verification_batches
  await targetPool.query(
    `INSERT INTO ox_verification_batches (id, tenant_id, total_count, processed_count, status, created_at, updated_at)
     VALUES ($1, $2, $3, 0, 'processing', NOW(), NOW())`,
    [batchId, tenantId, total]
  );

  // Enqueue background job
  await enqueue(
    'verify_email',
    { batchId, tenantId, emails },
    { tenantId, pool: targetPool }
  );

  return {
    batchId,
    total,
    status: 'processing',
    message: 'Verification batch enqueued successfully'
  };
}

/**
 * Initialize verifier service, register job handler and ensure disposable domains are loaded
 */
export function initVerifier(pool?: pg.Pool): void {
  loadDisposableDomains();

  registerHandler('verify_email', async (job) => {
    const { batchId, tenantId, emails } = job.payload || {};
    const targetPool = pool || getOutreachPool();
    if (!targetPool) {
      logger.error('Database pool unavailable for verify_email worker', { context: 'VerifierWorker' });
      return;
    }

    if (!Array.isArray(emails) || emails.length === 0) {
      await targetPool.query(
        `UPDATE ox_verification_batches SET status = 'completed', updated_at = NOW() WHERE id = $1`,
        [batchId]
      );
      return;
    }

    try {
      // Process emails in chunks or sequentially
      const total = emails.length;
      const results: VerificationResult[] = [];
      let validCount = 0;
      let riskyCount = 0;
      let invalidCount = 0;
      let unknownCount = 0;

      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const res = await verifySingleEmail(email, { pool: targetPool, bypassQuota: true });
        results.push(res);

        if (res.status === 'valid') validCount++;
        else if (res.status === 'risky') riskyCount++;
        else if (res.status === 'invalid') invalidCount++;
        else unknownCount++;

        // Update prospect record in ox_prospects if present
        await targetPool.query(
          `UPDATE ox_prospects
           SET verification_status = $1,
               verification_reason = $2,
               verified_at = NOW(),
               updated_at = NOW()
           WHERE tenant_id = $3 AND LOWER(email) = LOWER($4)`,
          [res.status, res.reason, tenantId, email.trim()]
        );

        // Update batch progress periodically every 25 emails or on final
        if ((i + 1) % 25 === 0 || i === emails.length - 1) {
          await targetPool.query(
            `UPDATE ox_verification_batches
             SET processed_count = $1,
                 valid_count = $2,
                 risky_count = $3,
                 invalid_count = $4,
                 unknown_count = $5,
                 updated_at = NOW()
             WHERE id = $6`,
            [i + 1, validCount, riskyCount, invalidCount, unknownCount, batchId]
          );
        }
      }

      await targetPool.query(
        `UPDATE ox_verification_batches
         SET processed_count = $1,
             valid_count = $2,
             risky_count = $3,
             invalid_count = $4,
             unknown_count = $5,
             status = 'completed',
             results = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [total, validCount, riskyCount, invalidCount, unknownCount, JSON.stringify(results), batchId]
      );

      logger.info(`Completed verify_email job for batch ${batchId}`, {
        context: 'VerifierWorker',
        details: { batchId, total, validCount, invalidCount, riskyCount, unknownCount }
      });
    } catch (err: any) {
      logger.error(`Error processing verify_email job ${batchId}`, {
        context: 'VerifierWorker',
        details: { error: err?.message, batchId }
      });
      await targetPool.query(
        `UPDATE ox_verification_batches SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [batchId]
      );
      throw err;
    }
  });

  logger.info('Outreach Email Verifier initialized and worker registered', {
    context: 'Verifier'
  });
}

