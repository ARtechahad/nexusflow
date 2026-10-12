import crypto from 'node:crypto';
import pg from 'pg';
import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';
import { checkAndReserve } from './capGuard';
import { decryptSecret } from './crypto';
import { enqueue, registerHandler } from './queue';
import {
  assembleWarmupMessage,
  assembleWarmupReply
} from './warmupContent';

// ============================================================================
// CONFIGURATION & TYPES
// ============================================================================

export type WarmupMode = 'new_domain' | 'new_mailbox' | 'dormant' | 'maintenance' | 'recovery';
export type WarmupSpeed = 'conservative' | 'normal' | 'aggressive';

export interface ModeConfig {
  start: number;
  ceiling: number;
}

export const MODE_CONFIGS: Record<WarmupMode, ModeConfig> = {
  new_domain: { start: 1, ceiling: 40 },
  new_mailbox: { start: 3, ceiling: 60 },
  dormant: { start: 3, ceiling: 40 },
  maintenance: { start: 15, ceiling: 30 },
  recovery: { start: 5, ceiling: 30 }
};

export const SPEED_INCREMENTS: Record<WarmupSpeed, number> = {
  conservative: 0.5,
  normal: 1.0,
  aggressive: 1.5
};

export interface DailyTargetMetrics {
  warmupAgeDays: number;
  sendingDays: number;
  spamRate7d: number;      // e.g. 1.5 for 1.5%
  bounceRate7d: number;    // e.g. 0.5 for 0.5%
  campaignSentToday: number;
  sharedMailboxCap: number;
  hasSpf: boolean;
  hasDkim: boolean;
  hasDmarc?: boolean;
  domainMailboxCount: number;
  userDesiredTarget?: number;
  spamRecoveryDays?: number;
}

export interface DailyTargetResult {
  target: number;
  baseRamp: number;
  ceiling: number;
  sendingDays: number;
  warmupAgeDays: number;
  unlockedFullTarget: boolean;
  poolExcluded: boolean;
  poolExcludedReason?: string;
  reasons: string[];
  metrics: DailyTargetMetrics;
}

export interface HealthScoreMetrics {
  spamRate: number;      // percentage, e.g. 2.5
  bounceRate: number;    // percentage, e.g. 1.0
  spfMissing: boolean;
  dkimMissing: boolean;
  dmarcMissing: boolean;
}

// ============================================================================
// 1. HEALTH SCORE CALCULATION
// Formula: 100 − min(60, spam% × 4) − min(25, bounce% × 10) − 10 if SPF missing − 10 if DKIM missing − 5 if DMARC missing, clamp 0–100
// ============================================================================
export function calculateHealthScore(metrics: HealthScoreMetrics): number {
  const spamDeduction = Math.min(60, Math.max(0, metrics.spamRate) * 4);
  const bounceDeduction = Math.min(25, Math.max(0, metrics.bounceRate) * 10);
  const spfDeduction = metrics.spfMissing ? 10 : 0;
  const dkimDeduction = metrics.dkimMissing ? 10 : 0;
  const dmarcDeduction = metrics.dmarcMissing ? 5 : 0;

  const rawScore = 100 - spamDeduction - bounceDeduction - spfDeduction - dkimDeduction - dmarcDeduction;
  return Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));
}

// ============================================================================
// 2. DAILY TARGET CALCULATION (PURE FUNCTION FOR TESTS & ENGINE)
// ============================================================================
export function computeDailyTargetSync(
  mailbox: {
    warmup_mode?: WarmupMode;
    warmup_speed?: WarmupSpeed;
    warmup_target?: number;
    daily_cap?: number;
    daily_limit?: number;
    pool_excluded?: boolean;
    pool_excluded_reason?: string;
  },
  metrics: DailyTargetMetrics
): DailyTargetResult {
  const reasons: string[] = [];
  const mode: WarmupMode = (mailbox.warmup_mode as WarmupMode) || 'new_mailbox';
  const speed: WarmupSpeed = (mailbox.warmup_speed as WarmupSpeed) || 'normal';
  const modeConfig = MODE_CONFIGS[mode] || MODE_CONFIGS.new_mailbox;
  const speedIncr = SPEED_INCREMENTS[speed] ?? 1.0;

  const sendingDays = Math.max(1, metrics.sendingDays || 1);
  const warmupAgeDays = Math.max(0, metrics.warmupAgeDays || 0);
  const ceiling = modeConfig.ceiling;

  // 1. Ramp calculation: counts SENDING days, not calendar days.
  // Day 1 = start. Each subsequent sending day adds speedIncr, rounded to whole emails.
  const rawRamp = modeConfig.start + Math.round((sendingDays - 1) * speedIncr);
  const baseRamp = Math.min(rawRamp, ceiling);

  // 2. Check full user target unlock:
  // Unlocked ONLY if warmup age >= 14 days, >= 7 sending days, spam < 2% and bounce < 1% over last 7 days.
  const meetsAge = warmupAgeDays >= 14;
  const meetsSendingDays = sendingDays >= 7;
  const meetsSpam = metrics.spamRate7d < 2.0;
  const meetsBounce = metrics.bounceRate7d < 1.0;
  const unlockedFullTarget = meetsAge && meetsSendingDays && meetsSpam && meetsBounce;

  const userTarget = Math.min(
    120,
    Math.max(1, mailbox.warmup_target ?? metrics.userDesiredTarget ?? ceiling)
  );

  let target: number;
  if (unlockedFullTarget) {
    target = Math.min(120, Math.max(baseRamp, userTarget));
  } else {
    target = Math.min(baseRamp, userTarget, ceiling, 120);
    if (userTarget > target) {
      reasons.push(
        `User target of ${userTarget}/day is locked during warmup ramp (requires age >= 14d, >= 7 sending days, spam < 2%, bounce < 1%). Current ramp allows ${target}/day.`
      );
    }
  }

  // 3. Pool exclusion for spam >= 15%
  let poolExcluded = mailbox.pool_excluded || false;
  let poolExcludedReason = mailbox.pool_excluded_reason;

  if (metrics.spamRate7d >= 15.0) {
    poolExcluded = true;
    poolExcludedReason = `Spam rate (${metrics.spamRate7d.toFixed(1)}%) is >= 15% over rolling 7 days`;
    reasons.push(`Mailbox excluded from warmup pool: ${poolExcludedReason}`);
    return {
      target: 0,
      baseRamp,
      ceiling,
      sendingDays,
      warmupAgeDays,
      unlockedFullTarget,
      poolExcluded: true,
      poolExcludedReason,
      reasons,
      metrics
    };
  }

  // If mailbox was previously excluded, check recovery (below 5% for 3 days)
  if (poolExcluded) {
    if ((metrics.spamRecoveryDays || 0) >= 3 && metrics.spamRate7d < 5.0) {
      poolExcluded = false;
      poolExcludedReason = undefined;
      reasons.push('Mailbox restored to warmup pool after 3 consecutive days with spam rate < 5%.');
    } else {
      reasons.push(
        `Mailbox remains excluded from warmup pool until spam rate stays below 5% for 3 days (currently ${metrics.spamRecoveryDays || 0}/3 days).`
      );
      return {
        target: 0,
        baseRamp,
        ceiling,
        sendingDays,
        warmupAgeDays,
        unlockedFullTarget,
        poolExcluded: true,
        poolExcludedReason: poolExcludedReason || 'Excluded from pool pending spam recovery',
        reasons,
        metrics
      };
    }
  }

  // 4. Halve volume if spam >= 5% over last 7 days
  if (metrics.spamRate7d >= 5.0) {
    const preHalve = target;
    target = Math.floor(target / 2);
    reasons.push(
      `Elevated spam rate (${metrics.spamRate7d.toFixed(1)}% >= 5%) over rolling 7 days halved daily warmup target from ${preHalve} to ${target}.`
    );
  }

  // 5. Cap at 5/day if SPF or DKIM missing
  if (!metrics.hasSpf || !metrics.hasDkim) {
    if (target > 5) {
      target = 5;
    }
    const missingRecords = [!metrics.hasSpf && 'SPF', !metrics.hasDkim && 'DKIM']
      .filter(Boolean)
      .join(' & ');
    reasons.push(
      `Missing ${missingRecords} DNS authentication caps daily warmup sending at 5 emails/day.`
    );
  }

  // 6. Split domain volume across multiple mailboxes on the same domain
  const DOMAIN_DAILY_CEILING = 150;
  if (metrics.domainMailboxCount > 1) {
    const domainShare = Math.floor(DOMAIN_DAILY_CEILING / metrics.domainMailboxCount);
    if (target > domainShare) {
      target = domainShare;
      reasons.push(
        `Shared domain limit (${DOMAIN_DAILY_CEILING}/day) split across ${metrics.domainMailboxCount} mailboxes caps this mailbox at ${domainShare}/day.`
      );
    }
  }

  // 7. Subtract campaign sends already used today from shared mailbox cap
  const sharedCap = metrics.sharedMailboxCap || mailbox.daily_cap || mailbox.daily_limit || 30;
  const remainingMailboxBudget = Math.max(0, sharedCap - (metrics.campaignSentToday || 0));

  if (target > remainingMailboxBudget) {
    const originalTarget = target;
    target = remainingMailboxBudget;
    reasons.push(
      `Shared mailbox cap of ${sharedCap} emails/day throttles warmup: ${metrics.campaignSentToday} campaign sends already used today, leaving ${remainingMailboxBudget} for warmup.`
    );
  }

  // Absolute maximum 120/day clamp
  target = Math.max(0, Math.min(120, target));

  return {
    target,
    baseRamp,
    ceiling,
    sendingDays,
    warmupAgeDays,
    unlockedFullTarget,
    poolExcluded: false,
    reasons,
    metrics
  };
}

/**
 * Computes daily target reading live DB telemetry for a mailbox.
 */
export async function computeDailyTarget(
  mailboxIdOrObject: string | any,
  today: Date = new Date(),
  options?: { pool?: pg.Pool }
): Promise<DailyTargetResult> {
  const pool = options?.pool || getOutreachPool();
  if (!pool) {
    throw new Error('Database pool unavailable for computeDailyTarget');
  }

  let mailbox = mailboxIdOrObject;
  if (typeof mailboxIdOrObject === 'string') {
    const mbxRes = await pool.query(
      `SELECT m.*, d.spf_status, d.dkim_status, d.dmarc_status
       FROM ox_mailboxes m
       LEFT JOIN ox_domains d ON m.domain_id = d.id
       WHERE m.id = $1`,
      [mailboxIdOrObject]
    );
    if (mbxRes.rowCount === 0) {
      throw new Error(`Mailbox not found: ${mailboxIdOrObject}`);
    }
    mailbox = mbxRes.rows[0];
  }

  const todayUtc = today.toISOString().slice(0, 10);

  // 1. Calculate Warmup Age (days since created_at or warmup enabled)
  const createdAt = mailbox.created_at ? new Date(mailbox.created_at) : new Date();
  const warmupAgeDays = Math.max(0, Math.floor((today.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)));

  // 2. Count distinct sending days (days with warmup_sent_count > 0)
  const sendingDaysRes = await pool.query(
    `SELECT COUNT(DISTINCT date_utc)::int as count
     FROM ox_mailbox_daily
     WHERE mailbox_id = $1 AND warmup_sent_count > 0`,
    [mailbox.id]
  );
  // Default to at least 1 sending day (today is sending day 1 if starting)
  const pastSendingDays = sendingDaysRes.rows[0]?.count ?? 0;
  const sendingDays = Math.max(1, pastSendingDays + 1);

  // 3. Rolling 7-day stats for spam & bounce rates
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rollingStatsRes = await pool.query(
    `SELECT
       COALESCE(SUM(warmup_sent_count), 0)::int as total_sent,
       COALESCE(SUM(warmup_spam_count), 0)::int as total_spam,
       COALESCE(SUM(bounced_count), 0)::int as total_bounce
     FROM ox_mailbox_daily
     WHERE mailbox_id = $1 AND date_utc >= $2 AND date_utc <= $3`,
    [mailbox.id, sevenDaysAgo, todayUtc]
  );
  const totalSent7d = rollingStatsRes.rows[0]?.total_sent ?? 0;
  const totalSpam7d = rollingStatsRes.rows[0]?.total_spam ?? 0;
  const totalBounce7d = rollingStatsRes.rows[0]?.total_bounce ?? 0;

  const spamRate7d = totalSent7d > 0 ? (totalSpam7d / totalSent7d) * 100 : 0.0;
  const bounceRate7d = totalSent7d > 0 ? (totalBounce7d / totalSent7d) * 100 : 0.0;

  // 4. Campaign sends already used today
  const dailyRes = await pool.query(
    `SELECT campaign_sent_count, warmup_sent_count
     FROM ox_mailbox_daily
     WHERE mailbox_id = $1 AND date_utc = $2`,
    [mailbox.id, todayUtc]
  );
  const campaignSentToday = dailyRes.rows[0]?.campaign_sent_count ?? 0;

  // 5. Count active mailboxes on the same domain
  let domainMailboxCount = 1;
  if (mailbox.domain_id) {
    const domainMbxsRes = await pool.query(
      `SELECT COUNT(*)::int as count
       FROM ox_mailboxes
       WHERE domain_id = $1 AND status = 'active' AND is_deleted = false`,
      [mailbox.domain_id]
    );
    domainMailboxCount = Math.max(1, domainMbxsRes.rows[0]?.count ?? 1);
  }

  // 6. SPF / DKIM verification status
  const hasSpf = mailbox.spf_status === 'valid' || mailbox.spf_status === 'verified';
  const hasDkim = mailbox.dkim_status === 'valid' || mailbox.dkim_status === 'verified';
  const hasDmarc = mailbox.dmarc_status === 'valid' || mailbox.dmarc_status === 'verified';

  const metrics: DailyTargetMetrics = {
    warmupAgeDays,
    sendingDays,
    spamRate7d,
    bounceRate7d,
    campaignSentToday,
    sharedMailboxCap: mailbox.daily_cap || mailbox.daily_limit || 30,
    hasSpf,
    hasDkim,
    hasDmarc,
    domainMailboxCount,
    userDesiredTarget: mailbox.warmup_target || 30,
    spamRecoveryDays: mailbox.spam_recovery_days || 0
  };

  const result = computeDailyTargetSync(mailbox, metrics);

  // If pool_excluded state changed, persist to DB
  if (result.poolExcluded !== Boolean(mailbox.pool_excluded)) {
    await pool.query(
      `UPDATE ox_mailboxes
       SET pool_excluded = $1, pool_excluded_reason = $2, updated_at = NOW()
       WHERE id = $3`,
      [result.poolExcluded, result.poolExcludedReason || null, mailbox.id]
    );
  }

  return result;
}

// ============================================================================
// 3. PAIRING ENGINE (STRICT PEER-TO-PEER NETWORK RULES)
// ============================================================================

export interface PairCandidate {
  recipientMailbox: any;
  reason?: string;
}

/**
 * Chooses an eligible recipient from the warmup pool adhering to:
 * - ox_mailboxes.warmup_enabled = true
 * - owner accepted "Warmup network participation" (warmup_terms_accepted = true)
 * - status = 'active' AND is_deleted = false AND pool_excluded = false
 * - DIFFERENT domain than sender
 * - Prefer DIFFERENT provider
 * - Avoid same pair twice in 24 hours
 * - Never same tenant domain
 * - Returns null with 'pool_too_small' if fewer than 2 eligible mailboxes exist
 */
export async function pairWarmupRecipient(
  senderMailbox: any,
  pool: pg.Pool
): Promise<PairCandidate | null> {
  const senderDomain = senderMailbox.email.split('@')[1]?.toLowerCase();

  // Find all active opt-in pool mailboxes
  const candidatesQuery = `
    SELECT m.id, m.tenant_id, m.domain_id, m.email, m.sender_name, m.provider,
           d.domain as domain_name
    FROM ox_mailboxes m
    LEFT JOIN ox_domains d ON m.domain_id = d.id
    WHERE m.status = 'active'
      AND (m.is_deleted IS NULL OR m.is_deleted = false)
      AND m.warmup_enabled = true
      AND m.warmup_terms_accepted = true
      AND (m.pool_excluded IS NULL OR m.pool_excluded = false)
      AND (m.warmup_paused IS NULL OR m.warmup_paused = false)
      AND m.id != $1
  `;
  const candidatesRes = await pool.query(candidatesQuery, [senderMailbox.id]);

  // If the total pool (including sender) is too small (< 2), report explicitly
  if (candidatesRes.rows.length === 0) {
    return null; // pool too small
  }

  // Filter out mailboxes on the same domain or same tenant domain
  const eligibleCandidates: any[] = [];
  for (const candidate of candidatesRes.rows) {
    const candidateDomain = (candidate.domain_name || candidate.email.split('@')[1] || '').toLowerCase();
    if (candidateDomain === senderDomain) {
      continue; // Must be DIFFERENT domain
    }
    // Also avoid same tenant if tenant has same domain
    if (candidate.tenant_id === senderMailbox.tenant_id && candidateDomain === senderDomain) {
      continue;
    }
    eligibleCandidates.push({
      ...candidate,
      candidateDomain
    });
  }

  if (eligibleCandidates.length === 0) {
    return null; // No candidate on a different domain
  }

  // Avoid the same pair sent within the last 24 hours
  const recentPairsRes = await pool.query(
    `SELECT recipient_mailbox_id
     FROM ox_warmup_messages
     WHERE sender_mailbox_id = $1
       AND sent_at >= NOW() - INTERVAL '24 hours'`,
    [senderMailbox.id]
  );
  const recentRecipientIds = new Set(recentPairsRes.rows.map(r => r.recipient_mailbox_id));

  let availableCandidates = eligibleCandidates.filter(c => !recentRecipientIds.has(c.id));
  if (availableCandidates.length === 0) {
    // If all candidates were paired in last 24h, fallback to eligibleCandidates
    availableCandidates = eligibleCandidates;
  }

  // Prefer different provider (e.g. gmail vs outlook vs smtp)
  const differentProviderCandidates = availableCandidates.filter(
    c => (c.provider || 'smtp').toLowerCase() !== (senderMailbox.provider || 'smtp').toLowerCase()
  );

  const finalPool = differentProviderCandidates.length > 0
    ? differentProviderCandidates
    : availableCandidates;

  // Pick random candidate from best pool
  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];
  return {
    recipientMailbox: chosen
  };
}

// ============================================================================
// 4. PLANNER (CREATES SEND_WARMUP_EMAIL JOBS SPREAD ACROSS THE DAY)
// ============================================================================

export interface PlanWarmupResult {
  mailboxesProcessed: number;
  createdJobs: number;
  poolTooSmall: boolean;
  poolSize: number;
}

/**
 * Daily job at 00:05 UTC (and on mailbox enable) that creates send_warmup_email jobs
 * spread across the mailbox's day with random jitter (no two sends closer than 4 minutes).
 */
export async function planDailyWarmupJobs(
  pool: pg.Pool,
  specificMailboxId?: string
): Promise<PlanWarmupResult> {
  // Query all eligible mailboxes
  const query = `
    SELECT m.*, d.domain as domain_name, d.spf_status, d.dkim_status, d.dmarc_status
    FROM ox_mailboxes m
    LEFT JOIN ox_domains d ON m.domain_id = d.id
    WHERE m.status = 'active'
      AND (m.is_deleted IS NULL OR m.is_deleted = false)
      AND m.warmup_enabled = true
      AND m.warmup_terms_accepted = true
      AND (m.pool_excluded IS NULL OR m.pool_excluded = false)
      AND (m.warmup_paused IS NULL OR m.warmup_paused = false)
      ${specificMailboxId ? 'AND m.id = $1' : ''}
  `;
  const params = specificMailboxId ? [specificMailboxId] : [];
  const mbxRes = await pool.query(query, params);

  const totalPoolQuery = `
    SELECT COUNT(*)::int as count
    FROM ox_mailboxes
    WHERE status = 'active'
      AND (is_deleted IS NULL OR is_deleted = false)
      AND warmup_enabled = true
      AND warmup_terms_accepted = true
      AND (pool_excluded IS NULL OR pool_excluded = false)
  `;
  const poolCountRes = await pool.query(totalPoolQuery);
  const poolSize = poolCountRes.rows[0]?.count ?? 0;

  if (poolSize < 2) {
    logger.info('Warmup planner skipped: pool too small (< 2 mailboxes)', {
      context: 'WarmupPlanner',
      details: { poolSize }
    });
    return {
      mailboxesProcessed: 0,
      createdJobs: 0,
      poolTooSmall: true,
      poolSize
    };
  }

  let createdJobs = 0;
  const now = new Date();

  for (const mailbox of mbxRes.rows) {
    try {
      const targetResult = await computeDailyTarget(mailbox, now, { pool });
      const targetCount = targetResult.target;

      if (targetCount <= 0) {
        continue;
      }

      // Check how many warmup sends were already executed or planned today
      const todayUtc = now.toISOString().slice(0, 10);
      const existingSentRes = await pool.query(
        `SELECT warmup_sent_count FROM ox_mailbox_daily WHERE mailbox_id = $1 AND date_utc = $2`,
        [mailbox.id, todayUtc]
      );
      const sentToday = existingSentRes.rows[0]?.warmup_sent_count ?? 0;

      const remainingToSend = Math.max(0, targetCount - sentToday);
      if (remainingToSend <= 0) {
        continue;
      }

      // Distribute jobs across the remaining day hours (minimum 4 minutes apart)
      const currentHour = now.getUTCHours();
      const endHour = 23;
      const hoursRemaining = Math.max(1, endHour - currentHour);
      const totalMinutesAvailable = hoursRemaining * 60;

      // Ensure interval is at least 4 minutes
      const averageIntervalMin = Math.max(4, Math.floor(totalMinutesAvailable / remainingToSend));

      let cumulativeMinutes = 2; // start 2 minutes from now
      for (let i = 0; i < remainingToSend; i++) {
        // Jitter between -1 and +2 minutes, maintaining >= 4 min separation
        const jitter = Math.floor(Math.random() * 3) - 1;
        cumulativeMinutes += Math.max(4, averageIntervalMin + jitter);

        const scheduledRunAt = new Date(now.getTime() + cumulativeMinutes * 60 * 1000);

        const payload: SendWarmupEmailPayload = {
          senderMailboxId: mailbox.id,
          depth: 1
        };

        await enqueue('send_warmup_email', payload, {
          tenantId: mailbox.tenant_id,
          runAt: scheduledRunAt,
          pool
        });

        createdJobs++;
      }
    } catch (err: any) {
      logger.error(`Failed to plan warmup for mailbox ${mailbox.email}: ${err?.message}`, {
        context: 'WarmupPlanner'
      });
    }
  }

  logger.info(`Planned ${createdJobs} warmup jobs across ${mbxRes.rows.length} mailboxes`, {
    context: 'WarmupPlanner'
  });

  return {
    mailboxesProcessed: mbxRes.rows.length,
    createdJobs,
    poolTooSmall: false,
    poolSize
  };
}

// ============================================================================
// 5. SEND WARMUP EMAIL HANDLER
// ============================================================================

export interface SendWarmupEmailPayload {
  senderMailboxId: string;
  recipientMailboxId?: string;
  recipientEmail?: string;
  threadId?: string;
  parentMessageId?: string;
  parentSubject?: string;
  depth?: number;
  tag?: string;
}

/**
 * Transporter cache for warmup sends
 */
const warmupTransporters = new Map<string, Transporter>();

function getWarmupTransporter(mailbox: any, decryptedPassword: string): Transporter {
  const cacheKey = `${mailbox.id}_${mailbox.smtp_host}_${mailbox.smtp_port}_${mailbox.smtp_user}`;
  const existing = warmupTransporters.get(cacheKey);
  if (existing) return existing;

  const transporter = nodemailer.createTransport({
    host: mailbox.smtp_host,
    port: mailbox.smtp_port || 587,
    secure: mailbox.smtp_port === 465,
    auth: {
      user: mailbox.smtp_user || mailbox.email,
      pass: decryptedPassword
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2'
    },
    connectionTimeout: 15000
  });

  warmupTransporters.set(cacheKey, transporter);
  return transporter;
}

/**
 * Worker handler for 'send_warmup_email'
 */
export async function handleSendWarmupEmailJob(
  payload: SendWarmupEmailPayload,
  tenantId: string
): Promise<void> {
  const pool = getOutreachPool();
  if (!pool) throw new Error('Database pool unavailable');

  // Fetch sender mailbox
  const senderRes = await pool.query(
    `SELECT m.*, d.domain as domain_name
     FROM ox_mailboxes m
     LEFT JOIN ox_domains d ON m.domain_id = d.id
     WHERE m.id = $1`,
    [payload.senderMailboxId]
  );
  if (senderRes.rowCount === 0) {
    logger.warn(`Sender mailbox ${payload.senderMailboxId} not found, aborting warmup send`);
    return;
  }
  const sender = senderRes.rows[0];

  // Must still be active & opted in
  if (sender.status !== 'active' || !sender.warmup_enabled || !sender.warmup_terms_accepted || sender.pool_excluded) {
    logger.info(`Mailbox ${sender.email} is ineligible for warmup sends at this time`);
    return;
  }

  // 1. Cap Guard reservation (kind: 'warmup')
  const capCheck = await checkAndReserve({
    tenantId: sender.tenant_id,
    mailboxId: sender.id,
    kind: 'warmup',
    pool
  });

  if (!capCheck.allowed) {
    logger.info(`Warmup send skipped for ${sender.email}: ${capCheck.reason}`);
    return;
  }

  // 2. Select Recipient from pool if not already set (e.g. for reply)
  let recipientMailbox: any = null;
  let recipientEmail = payload.recipientEmail;

  if (payload.recipientMailboxId) {
    const recRes = await pool.query(`SELECT * FROM ox_mailboxes WHERE id = $1`, [payload.recipientMailboxId]);
    if (recRes.rowCount && recRes.rowCount > 0) {
      recipientMailbox = recRes.rows[0];
      recipientEmail = recipientMailbox.email;
    }
  }

  if (!recipientMailbox) {
    const pairResult = await pairWarmupRecipient(sender, pool);
    if (!pairResult) {
      logger.info(`Warmup pairing skipped for ${sender.email}: pool too small or no eligible different-domain peer`);
      return;
    }
    recipientMailbox = pairResult.recipientMailbox;
    recipientEmail = recipientMailbox.email;
  }

  if (!recipientEmail) {
    logger.warn('No recipient email available for warmup send');
    return;
  }

  // 3. Assemble content (initial message vs reply)
  const depth = payload.depth || 1;
  const tag = payload.tag || crypto.randomUUID();
  const shortTag = tag.slice(0, 8);
  const threadId = payload.threadId || `wt_${crypto.randomUUID()}`;

  let subject: string;
  let bodyText: string;
  let bodyHtml: string;

  if (payload.parentSubject) {
    const replyContent = await assembleWarmupReply(
      payload.parentSubject,
      recipientMailbox.sender_name || recipientEmail.split('@')[0],
      pool
    );
    subject = replyContent.subject;
    bodyText = replyContent.bodyText;
    bodyHtml = replyContent.bodyHtml;
  } else {
    const messageContent = await assembleWarmupMessage(
      recipientMailbox.sender_name || recipientEmail.split('@')[0],
      pool
    );
    subject = `${messageContent.subject} [WT-${shortTag}]`;
    bodyText = messageContent.bodyText;
    bodyHtml = messageContent.bodyHtml;
  }

  // 4. Send via Nodemailer (with X-Warmup-Tag and thread headers)
  let decryptedPassword = '';
  try {
    decryptedPassword = decryptSecret(sender.smtp_pass_encrypted);
  } catch (err: any) {
    logger.error(`Failed to decrypt SMTP credentials for ${sender.email}: ${err?.message}`);
    return;
  }

  const transporter = getWarmupTransporter(sender, decryptedPassword);

  const headers: Record<string, string> = {
    'X-Warmup-Tag': tag,
    'X-Warmup-Id': tag,
    'X-Warmup-Depth': String(depth),
    'X-Warmup-Thread': threadId
  };

  if (payload.parentMessageId) {
    headers['In-Reply-To'] = payload.parentMessageId;
    headers['References'] = payload.parentMessageId;
  }

  const mailOptions: SendMailOptions = {
    from: `"${sender.sender_name}" <${sender.email}>`,
    to: recipientEmail,
    subject,
    text: bodyText,
    html: bodyHtml,
    headers
  };

  let info: any;
  try {
    info = await transporter.sendMail(mailOptions);
  } catch (sendErr: any) {
    logger.warn(`Warmup email dispatch failed from ${sender.email} to ${recipientEmail}: ${sendErr?.message}`);
    return;
  }

  const messageIdHeader = info?.messageId || `<${tag}@warmup.internal>`;

  // 5. Record to ox_warmup_messages
  const warmupMsgId = `wmsg_${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO ox_warmup_messages (
       id, tenant_id, sender_mailbox_id, recipient_mailbox_id, recipient_email,
       thread_id, message_id_header, subject, body_snippet, status,
       inbox_landed, replied, tag, depth, placement, rescued, created_at, sent_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, $8, $9, 'sent',
       false, false, $10, $11, 'unknown', false, NOW(), NOW()
     )`,
    [
      warmupMsgId,
      sender.tenant_id,
      sender.id,
      recipientMailbox.id || null,
      recipientEmail,
      threadId,
      messageIdHeader,
      subject,
      bodyText.slice(0, 200),
      tag,
      depth
    ]
  );

  logger.info(`Warmup message successfully sent from ${sender.email} to ${recipientEmail} [tag: ${shortTag}]`, {
    context: 'WarmupEngine',
    details: { messageId: messageIdHeader, depth }
  });
}

// ============================================================================
// 6. RECEIVER WORKER (INBOX SYNC INTEGRATION, RESCUE & 40% REPLY UP TO DEPTH 5)
// ============================================================================

export interface InboundWarmupResult {
  handled: boolean;
  rescued: boolean;
  scheduledReply: boolean;
  tag?: string;
  placement: 'inbox' | 'spam';
}

/**
 * Handles incoming email carrying X-Warmup-Tag:
 * - Records placement ('inbox' or 'spam')
 * - If in Spam: moves to INBOX (rescue), sets \Seen & \Flagged, sets rescued = true
 * - With 40% probability, schedules a reply 5–90 minutes later, up to depth 5
 * - Strictly excluded from campaign analytics, unified inbox, and webhooks
 */
export async function handleWarmupInboundMessage(
  parsed: any,
  mailbox: any,
  pool: pg.Pool,
  folderName: string = 'INBOX',
  imapClient?: any,
  uid?: number
): Promise<InboundWarmupResult> {
  const getHeader = (name: string): string => {
    if (!parsed?.headers) return '';
    if (typeof parsed.headers.get === 'function') {
      return String(parsed.headers.get(name.toLowerCase()) || '');
    }
    return String((parsed.headers as any)[name.toLowerCase()] || (parsed.headers as any)[name] || '');
  };

  const tag =
    getHeader('x-warmup-tag') ||
    getHeader('x-warmup-id') ||
    (parsed.subject || '').match(/\[WT-([a-zA-Z0-9_-]+)\]/)?.[1] ||
    '';

  if (!tag) {
    return { handled: false, rescued: false, scheduledReply: false, placement: 'inbox' };
  }

  const isSpam =
    folderName.toUpperCase().includes('SPAM') ||
    folderName.toUpperCase().includes('JUNK');
  const placement: 'inbox' | 'spam' = isSpam ? 'spam' : 'inbox';

  let rescued = false;

  // If in Spam, attempt rescue via IMAP
  if (isSpam && imapClient && uid) {
    try {
      // Move message to INBOX
      await imapClient.messageMove(String(uid), 'INBOX');
      // Mark as seen and flagged in INBOX
      await imapClient.messageFlagsAdd(String(uid), ['\\Seen', '\\Flagged']);
      rescued = true;
      logger.info(`Rescued warmup email from ${folderName} to INBOX for ${mailbox.email}`, {
        context: 'WarmupEngine',
        details: { tag, uid }
      });
    } catch (rescueErr: any) {
      logger.warn(`Failed to rescue warmup email from spam on ${mailbox.email}: ${rescueErr?.message}`, {
        context: 'WarmupEngine'
      });
    }
  }

  // Update ox_warmup_messages record matching the tag
  const todayUtc = new Date().toISOString().slice(0, 10);
  const updateRes = await pool.query(
    `UPDATE ox_warmup_messages
     SET placement = $1,
         inbox_landed = $2,
         rescued = $3,
         folder_name = $4
     WHERE tag = $5 OR tag LIKE $6
     RETURNING id, sender_mailbox_id, thread_id, depth, subject, message_id_header`,
    [placement, !isSpam || rescued, rescued, folderName, tag, `${tag}%`]
  );

  const matchedMessage = updateRes.rows[0];

  // Update recipient daily stats counter
  const counterId = `mbxd_${mailbox.id}_${todayUtc.replace(/-/g, '')}`;
  await pool.query(
    `INSERT INTO ox_mailbox_daily (id, tenant_id, mailbox_id, date_utc, warmup_received_count, warmup_inbox_count, warmup_spam_count, warmup_rescued_count, updated_at)
     VALUES ($1, $2, $3, $4, 1, $5, $6, $7, NOW())
     ON CONFLICT (mailbox_id, date_utc) DO UPDATE
     SET warmup_received_count = ox_mailbox_daily.warmup_received_count + 1,
         warmup_inbox_count = ox_mailbox_daily.warmup_inbox_count + $5,
         warmup_spam_count = ox_mailbox_daily.warmup_spam_count + $6,
         warmup_rescued_count = ox_mailbox_daily.warmup_rescued_count + $7,
         updated_at = NOW()`,
    [
      counterId,
      mailbox.tenant_id,
      mailbox.id,
      todayUtc,
      placement === 'inbox' ? 1 : 0,
      placement === 'spam' ? 1 : 0,
      rescued ? 1 : 0
    ]
  );

  // 40% probability to schedule a reply up to depth 5
  let scheduledReply = false;
  const currentDepth = matchedMessage?.depth || 1;
  const senderMailboxId = matchedMessage?.sender_mailbox_id;

  if (senderMailboxId && currentDepth < 5) {
    const shouldReply = Math.random() < 0.40;
    if (shouldReply) {
      // Delay 5 to 90 minutes randomly
      const delayMinutes = 5 + Math.floor(Math.random() * 85);
      const replyRunAt = new Date(Date.now() + delayMinutes * 60 * 1000);

      const replyPayload: SendWarmupEmailPayload = {
        senderMailboxId: mailbox.id, // Current recipient becomes sender of reply
        recipientMailboxId: senderMailboxId,
        recipientEmail: parsed.from?.value?.[0]?.address || '',
        threadId: matchedMessage?.thread_id,
        parentMessageId: parsed.messageId || matchedMessage?.message_id_header,
        parentSubject: parsed.subject || matchedMessage?.subject,
        depth: currentDepth + 1,
        tag: crypto.randomUUID()
      };

      await enqueue('send_warmup_email', replyPayload, {
        tenantId: mailbox.tenant_id,
        runAt: replyRunAt,
        pool
      });

      // Mark replied = true on original message
      if (matchedMessage?.id) {
        await pool.query(
          `UPDATE ox_warmup_messages SET replied = true, replied_at = NOW() WHERE id = $1`,
          [matchedMessage.id]
        );
      }

      scheduledReply = true;
      logger.info(`Scheduled warmup reply from ${mailbox.email} in ${delayMinutes}m (depth: ${currentDepth + 1})`, {
        context: 'WarmupEngine'
      });
    }
  }

  return {
    handled: true,
    rescued,
    scheduledReply,
    tag,
    placement
  };
}

// ============================================================================
// 7. CHECK WARMUP PLACEMENT JOB (RUNS NEXT DAY FOR UNKNOWN MESSAGES -> 'missing')
// ============================================================================

export async function checkWarmupPlacementJob(pool: pg.Pool): Promise<{ checked: number; markedMissing: number }> {
  // Messages older than 24h that are still 'unknown'
  const res = await pool.query(
    `UPDATE ox_warmup_messages
     SET placement = 'missing'
     WHERE placement = 'unknown'
       AND sent_at <= NOW() - INTERVAL '24 hours'
     RETURNING id`
  );

  logger.info(`Warmup placement check completed: ${res.rowCount} messages marked 'missing'`, {
    context: 'WarmupEngine'
  });

  return {
    checked: res.rowCount || 0,
    markedMissing: res.rowCount || 0
  };
}

// ============================================================================
// 8. INITIALIZE WARMUP ENGINE BACKGROUND WORKERS & REGISTER QUEUE HANDLERS
// ============================================================================

let dailyPlannerTimer: NodeJS.Timeout | null = null;
let placementCheckTimer: NodeJS.Timeout | null = null;

export function initWarmupEngine(pool: pg.Pool): void {
  // 1. Register queue worker handler for 'send_warmup_email'
  registerHandler('send_warmup_email', async (job) => {
    await handleSendWarmupEmailJob(job.payload as SendWarmupEmailPayload, job.tenant_id);
  });

  // 2. Schedule daily planner at 00:05 UTC (runs every 15 minutes checking if hour=0, min >= 5)
  if (dailyPlannerTimer) clearInterval(dailyPlannerTimer);
  dailyPlannerTimer = setInterval(async () => {
    const now = new Date();
    // Run close to 00:05 UTC (within 00:00 - 00:15 window once per day)
    if (now.getUTCHours() === 0 && now.getUTCMinutes() >= 5 && now.getUTCMinutes() <= 20) {
      try {
        await planDailyWarmupJobs(pool);
      } catch (err: any) {
        logger.error('Error during daily 00:05 UTC warmup planner run: ' + err?.message, {
          context: 'WarmupEngine'
        });
      }
    }
  }, 15 * 60 * 1000);

  // 3. Schedule placement check daily
  if (placementCheckTimer) clearInterval(placementCheckTimer);
  placementCheckTimer = setInterval(async () => {
    try {
      await checkWarmupPlacementJob(pool);
    } catch (err: any) {
      logger.error('Error during warmup placement check job: ' + err?.message, {
        context: 'WarmupEngine'
      });
    }
  }, 60 * 60 * 1000); // Hourly check

  logger.info('Warmup engine initialized: job handler and background timers active.', {
    context: 'WarmupEngine'
  });
}
