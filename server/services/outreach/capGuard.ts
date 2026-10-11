import pg from 'pg';
import crypto from 'node:crypto';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';

export interface CapGuardParams {
  tenantId: string;
  mailboxId: string;
  campaignId?: string;
  prospectEmail?: string;
  kind: 'campaign' | 'warmup';
  pool?: pg.Pool;
}

export interface CapGuardResult {
  allowed: boolean;
  reason?: string;
  retryAt?: Date;
  details?: Record<string, any>;
}

/**
 * Computes a random jitter between 0 and 30 minutes in milliseconds.
 */
export function getJitterMs(): number {
  return Math.floor(Math.random() * 30 * 60 * 1000);
}

/**
 * Helper to check whether current UTC time falls within campaign sending window and weekdays.
 */
export function isWithinSendingWindow(
  schedule: any,
  nowUtc: Date = new Date()
): { inWindow: boolean; nextWindowStart?: Date; reason?: string } {
  if (!schedule) {
    return { inWindow: true };
  }

  const timezone = schedule.timezone || 'UTC';
  const windows = schedule.windows || [{ start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }];

  // Convert current UTC time to target timezone representation
  let targetTimeStr: string;
  let currentDay: number;
  let currentMinutes: number;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    const parts = formatter.formatToParts(nowUtc);
    const hourPart = parts.find((p) => p.type === 'hour')?.value || '00';
    const minPart = parts.find((p) => p.type === 'minute')?.value || '00';
    const weekdayPart = parts.find((p) => p.type === 'weekday')?.value || 'Mon';

    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6
    };
    currentDay = dayMap[weekdayPart] ?? nowUtc.getUTCDay();
    currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minPart, 10);
    targetTimeStr = `${hourPart}:${minPart}`;
  } catch {
    currentDay = nowUtc.getUTCDay();
    currentMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
    targetTimeStr = `${nowUtc.getUTCHours().toString().padStart(2, '0')}:${nowUtc.getUTCMinutes().toString().padStart(2, '0')}`;
  }

  for (const win of windows) {
    const days: number[] = win.days || [1, 2, 3, 4, 5];
    if (!days.includes(currentDay)) {
      continue;
    }

    const [startH, startM] = (win.start || '09:00').split(':').map((v: string) => parseInt(v, 10));
    const [endH, endM] = (win.end || '17:00').split(':').map((v: string) => parseInt(v, 10));

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
      return { inWindow: true };
    }
  }

  // Next window calculation: approximate next send in 1 to 4 hours + jitter
  const deferMs = (60 + Math.floor(Math.random() * 120)) * 60 * 1000 + getJitterMs();
  return {
    inWindow: false,
    reason: `Outside sending schedule window (${targetTimeStr} in ${timezone})`,
    nextWindowStart: new Date(nowUtc.getTime() + deferMs)
  };
}

/**
 * Exactly ONE component decides whether an email send may proceed: the Cap Guard.
 *
 * Evaluation order:
 * 1. Mailbox existence, status ('active'), not deleted, health != 'error'
 * 2. Suppression list check for recipient prospect email
 * 3. Tenant plan monthly email quota
 * 4. Domain daily total (sum across domain's mailboxes <= domain cap, default 150)
 * 5. Campaign sending window / timezone / weekdays
 * 6. Minimum interval since last mailbox send (send_interval_sec)
 * 7. Mailbox daily cap (warmup + campaign share ONE budget in ox_mailbox_daily)
 *
 * Reservation must be ATOMIC: performed inside a transaction with a conditional update
 * on ox_mailbox_daily and updating ox_mailboxes.last_sent_at so concurrent workers
 * cannot exceed the cap.
 */
export async function checkAndReserve(params: CapGuardParams): Promise<CapGuardResult> {
  const pool = params.pool || getOutreachPool();
  if (!pool) {
    return {
      allowed: false,
      reason: 'PostgreSQL pool not available for Cap Guard evaluation'
    };
  }

  const client = await pool.connect();
  const now = new Date();
  const todayUtc = now.toISOString().slice(0, 10); // 'YYYY-MM-DD' UTC

  try {
    await client.query('BEGIN');

    // 1. Mailbox existence, status, health & send interval
    const mbxRes = await client.query(
      `SELECT id, tenant_id, domain_id, email, status, health_status, daily_cap, daily_limit,
              send_interval_sec, last_sent_at, is_deleted
       FROM ox_mailboxes
       WHERE id = $1 AND tenant_id = $2
       FOR UPDATE`,
      [params.mailboxId, params.tenantId]
    );

    if (mbxRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return { allowed: false, reason: 'Mailbox not found or tenant mismatch' };
    }

    const mbx = mbxRes.rows[0];
    if (mbx.is_deleted) {
      await client.query('ROLLBACK');
      return { allowed: false, reason: 'Mailbox has been deleted' };
    }

    if (mbx.status !== 'active') {
      await client.query('ROLLBACK');
      return {
        allowed: false,
        reason: `Mailbox is currently ${mbx.status}`,
        retryAt: new Date(now.getTime() + 15 * 60 * 1000 + getJitterMs())
      };
    }

    if (mbx.health_status === 'error') {
      await client.query('ROLLBACK');
      return {
        allowed: false,
        reason: 'Mailbox health status is in error',
        retryAt: new Date(now.getTime() + 30 * 60 * 1000 + getJitterMs())
      };
    }

    // 2. Suppression Check
    if (params.prospectEmail) {
      const suppRes = await client.query(
        `SELECT id, reason FROM ox_suppressions WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
        [params.tenantId, params.prospectEmail.trim()]
      );
      if (suppRes.rowCount && suppRes.rowCount > 0) {
        await client.query('ROLLBACK');
        return {
          allowed: false,
          reason: `Recipient ${params.prospectEmail} is suppressed (${suppRes.rows[0].reason})`
        };
      }
    }

    // 3. Tenant Plan Monthly Email Quota
    const planRes = await client.query(
      `SELECT COALESCE(p.monthly_send_limit, 5000) as monthly_limit,
              COALESCE(p.daily_send_limit, 500) as daily_limit
       FROM ox_plans p
       LIMIT 1`
    );
    const monthlyLimit = planRes.rows[0]?.monthly_limit ?? 5000;

    // Monthly sent count for tenant
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthSentRes = await client.query(
      `SELECT COUNT(*)::int as count FROM ox_sent_emails WHERE tenant_id = $1 AND sent_at >= $2`,
      [params.tenantId, monthStart]
    );
    const monthSent = monthSentRes.rows[0]?.count ?? 0;
    if (monthSent >= monthlyLimit) {
      await client.query('ROLLBACK');
      return {
        allowed: false,
        reason: `Tenant plan monthly email quota reached (${monthSent}/${monthlyLimit})`,
        retryAt: new Date(now.getTime() + 24 * 60 * 60 * 1000 + getJitterMs())
      };
    }

    // 4. Domain Daily Total (sum across all mailboxes for domain <= 150 default)
    if (mbx.domain_id) {
      const domainSentRes = await client.query(
        `SELECT COALESCE(SUM(d.campaign_sent_count + d.warmup_sent_count), 0)::int as total
         FROM ox_mailbox_daily d
         JOIN ox_mailboxes m ON d.mailbox_id = m.id
         WHERE m.domain_id = $1 AND d.date_utc = $2`,
        [mbx.domain_id, todayUtc]
      );
      const domainSentToday = domainSentRes.rows[0]?.total ?? 0;
      const DOMAIN_DAILY_CEILING = 150;
      if (domainSentToday >= DOMAIN_DAILY_CEILING) {
        await client.query('ROLLBACK');
        // Retry tomorrow UTC
        const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 1, 0));
        return {
          allowed: false,
          reason: `Domain daily total limit reached (${domainSentToday}/${DOMAIN_DAILY_CEILING})`,
          retryAt: new Date(tomorrowUtc.getTime() + getJitterMs())
        };
      }
    }

    // 5. Campaign Schedule Window
    if (params.campaignId) {
      const campRes = await client.query(
        `SELECT id, status, schedule, daily_limit FROM ox_campaigns WHERE id = $1 AND tenant_id = $2`,
        [params.campaignId, params.tenantId]
      );
      if (campRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return { allowed: false, reason: 'Campaign not found' };
      }
      const camp = campRes.rows[0];
      if (camp.status !== 'active') {
        await client.query('ROLLBACK');
        return { allowed: false, reason: `Campaign status is ${camp.status}` };
      }

      const windowCheck = isWithinSendingWindow(camp.schedule, now);
      if (!windowCheck.inWindow) {
        await client.query('ROLLBACK');
        return {
          allowed: false,
          reason: windowCheck.reason || 'Outside campaign sending window',
          retryAt: windowCheck.nextWindowStart || new Date(now.getTime() + 60 * 60 * 1000 + getJitterMs())
        };
      }
    }

    // 6. Minimum Interval Since Last Mailbox Send
    const minIntervalSec = mbx.send_interval_sec || 120;
    if (mbx.last_sent_at) {
      const lastSentTime = new Date(mbx.last_sent_at).getTime();
      const diffSec = (now.getTime() - lastSentTime) / 1000;
      if (diffSec < minIntervalSec) {
        await client.query('ROLLBACK');
        const waitMs = Math.ceil((minIntervalSec - diffSec) * 1000) + Math.floor(Math.random() * 5000);
        return {
          allowed: false,
          reason: `Mailbox throttle interval (${Math.ceil(diffSec)}s < ${minIntervalSec}s)`,
          retryAt: new Date(now.getTime() + waitMs)
        };
      }
    }

    // 7. Mailbox Daily Cap (Warmup + Campaign share ONE budget via ox_mailbox_daily)
    const effectiveCap = mbx.daily_cap || mbx.daily_limit || 30;

    // Ensure daily counter row exists for today UTC
    const counterId = `mbxd_${mbx.id}_${todayUtc.replace(/-/g, '')}`;
    await client.query(
      `INSERT INTO ox_mailbox_daily (id, tenant_id, mailbox_id, date_utc, campaign_sent_count, warmup_sent_count, updated_at)
       VALUES ($1, $2, $3, $4, 0, 0, NOW())
       ON CONFLICT (mailbox_id, date_utc) DO NOTHING`,
      [counterId, params.tenantId, mbx.id, todayUtc]
    );

    // Conditional atomic increment matching kind: returns 1 row ONLY if sum < effectiveCap
    const updateColumn = params.kind === 'campaign' ? 'campaign_sent_count' : 'warmup_sent_count';
    const reserveQuery = `
      UPDATE ox_mailbox_daily
      SET ${updateColumn} = ${updateColumn} + 1,
          updated_at = NOW()
      WHERE mailbox_id = $1
        AND date_utc = $2
        AND (campaign_sent_count + warmup_sent_count) < $3
      RETURNING campaign_sent_count, warmup_sent_count;
    `;

    const reserveRes = await client.query(reserveQuery, [mbx.id, todayUtc, effectiveCap]);

    if (reserveRes.rowCount === 0) {
      // Cap was exceeded atomically
      await client.query('ROLLBACK');
      const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
      return {
        allowed: false,
        reason: `Mailbox daily cap reached (${effectiveCap} emails/day)`,
        retryAt: new Date(tomorrowUtc.getTime() + getJitterMs())
      };
    }

    // Update mailbox last_sent_at timestamp atomically
    await client.query(`UPDATE ox_mailboxes SET last_sent_at = NOW(), updated_at = NOW() WHERE id = $1`, [mbx.id]);

    await client.query('COMMIT');

    const counts = reserveRes.rows[0];
    return {
      allowed: true,
      details: {
        mailboxId: mbx.id,
        email: mbx.email,
        campaignSentToday: counts.campaign_sent_count,
        warmupSentToday: counts.warmup_sent_count,
        dailyCap: effectiveCap
      }
    };
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Cap Guard checkAndReserve evaluation error', {
      context: 'CapGuard',
      details: {
        mailboxId: params.mailboxId,
        error: err?.message
      }
    });
    return {
      allowed: false,
      reason: `Cap Guard evaluation failed: ${err?.message}`,
      retryAt: new Date(now.getTime() + 60 * 1000 + getJitterMs())
    };
  } finally {
    client.release();
  }
}
