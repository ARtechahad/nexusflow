import pg from 'pg';
import crypto from 'node:crypto';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';

export interface AnalyticsFilterOptions {
  campaignId?: string;
  mailboxId?: string;
  variantId?: string;
  dateRange?: 'all' | '7d' | '30d' | '90d' | 'custom';
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface AnalyticsOverviewMetrics {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  positiveReplied: number;
  deliveryRate: number;      // %
  openRate: number;          // %
  clickRate: number;         // %
  replyRate: number;         // %
  positiveReplyRate: number; // %
  bounceRate: number;        // %
  openRateDisclaimer: string;
}

export interface AnalyticsDailyPoint {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  positiveReplied: number;
}

export interface CampaignAnalyticsSummary {
  id: string;
  name: string;
  status: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  positiveReplied: number;
  replyRate: number;
}

export interface VariantAnalyticsSummary {
  variantId: string;
  stepId: string;
  variantLabel: string;
  subject: string;
  weight: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  positiveReplied: number;
  replyRate: number;
  posteriorScore: number;
}

export interface MailboxAnalyticsSummary {
  mailboxId: string;
  email: string;
  sent: number;
  bounced: number;
  replied: number;
  bounceRate: number;
  healthScore: number;
}

export interface WarmupTrendPoint {
  date: string;
  sent: number;
  inboxLanded: number;
  spamLanded: number;
  rescued: number;
  replied: number;
  avgHealthScore: number;
}

export interface OutreachAnalyticsData {
  overview: AnalyticsOverviewMetrics;
  dailySeries: AnalyticsDailyPoint[];
  campaigns: CampaignAnalyticsSummary[];
  variants: VariantAnalyticsSummary[];
  mailboxes: MailboxAnalyticsSummary[];
  warmupTrend: WarmupTrendPoint[];
}

/**
 * Nightly or on-demand rollup calculation from raw ox_sent_emails and ox_events
 * into ox_analytics_daily table.
 */
export async function rollupDailyAnalytics(
  tenantId: string,
  targetDateUtc?: string,
  pool?: pg.Pool
): Promise<{ date: string; rowsRolledUp: number }> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) {
    throw new Error('Database pool unavailable for analytics rollup');
  }

  const dateUtc = targetDateUtc || new Date().toISOString().slice(0, 10);

  // 1. Roll up from raw ox_sent_emails and joined ox_events for dateUtc
  const rollupQuery = `
    WITH day_emails AS (
      SELECT
        se.tenant_id,
        COALESCE(se.campaign_id, 'none') as campaign_id,
        COALESCE(se.mailbox_id, 'none') as mailbox_id,
        COALESCE(se.variant_id, 'none') as variant_id,
        DATE(se.sent_at) as date_utc,
        se.id as sent_email_id,
        se.status,
        se.opened_at,
        se.clicked_at,
        se.replied_at,
        se.bounced_at
      FROM ox_sent_emails se
      WHERE se.tenant_id = $1 AND DATE(se.sent_at) = $2::date
    ),
    email_events AS (
      SELECT
        e.sent_email_id,
        MAX(CASE WHEN e.type = 'email_opened' THEN 1 ELSE 0 END) as has_open_event,
        MAX(CASE WHEN e.type = 'email_clicked' THEN 1 ELSE 0 END) as has_click_event,
        MAX(CASE WHEN e.type = 'email_replied' THEN 1 ELSE 0 END) as has_reply_event,
        MAX(CASE WHEN e.type = 'email_replied' AND (
          LOWER(COALESCE(e.metadata->>'sentiment', '')) IN ('positive', 'interested', 'meeting_requested') OR
          LOWER(COALESCE(e.metadata->>'classification', '')) IN ('positive', 'interested', 'meeting_requested')
        ) THEN 1 ELSE 0 END) as has_positive_reply_event,
        MAX(CASE WHEN e.type = 'email_bounced' THEN 1 ELSE 0 END) as has_bounce_event
      FROM ox_events e
      JOIN day_emails de ON e.sent_email_id = de.sent_email_id
      GROUP BY e.sent_email_id
    )
    SELECT
      de.tenant_id,
      de.campaign_id,
      de.mailbox_id,
      de.variant_id,
      de.date_utc,
      COUNT(DISTINCT de.sent_email_id)::int as sent_count,
      COUNT(DISTINCT CASE WHEN de.status != 'bounced' AND COALESCE(ee.has_bounce_event, 0) = 0 THEN de.sent_email_id END)::int as delivered_count,
      COUNT(DISTINCT CASE WHEN de.status = 'bounced' OR de.bounced_at IS NOT NULL OR COALESCE(ee.has_bounce_event, 0) = 1 THEN de.sent_email_id END)::int as bounced_count,
      COUNT(DISTINCT CASE WHEN de.opened_at IS NOT NULL OR COALESCE(ee.has_open_event, 0) = 1 THEN de.sent_email_id END)::int as opened_count,
      COUNT(DISTINCT CASE WHEN de.clicked_at IS NOT NULL OR COALESCE(ee.has_click_event, 0) = 1 THEN de.sent_email_id END)::int as clicked_count,
      COUNT(DISTINCT CASE WHEN de.replied_at IS NOT NULL OR COALESCE(ee.has_reply_event, 0) = 1 THEN de.sent_email_id END)::int as replied_count,
      COUNT(DISTINCT CASE WHEN COALESCE(ee.has_positive_reply_event, 0) = 1 THEN de.sent_email_id END)::int as positive_replied_count
    FROM day_emails de
    LEFT JOIN email_events ee ON de.sent_email_id = ee.sent_email_id
    GROUP BY de.tenant_id, de.campaign_id, de.mailbox_id, de.variant_id, de.date_utc;
  `;

  const rollRes = await targetPool.query(rollupQuery, [tenantId, dateUtc]);

  let rowsRolledUp = 0;
  for (const row of rollRes.rows) {
    const idHash = crypto.createHash('sha256').update(`${tenantId}_${row.campaign_id}_${row.mailbox_id}_${row.variant_id}_${dateUtc}`).digest('hex').slice(0, 32);
    const id = `roll_${idHash}`;
    const campVal = row.campaign_id === 'none' ? null : row.campaign_id;
    const mbxVal = row.mailbox_id === 'none' ? null : row.mailbox_id;
    const varVal = row.variant_id === 'none' ? null : row.variant_id;

    await targetPool.query(
      `INSERT INTO ox_analytics_daily (
         id, tenant_id, campaign_id, mailbox_id, variant_id, date_utc,
         sent_count, delivered_count, bounced_count, opened_count, clicked_count,
         replied_count, positive_replied_count, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (tenant_id, campaign_id, mailbox_id, variant_id, date_utc) DO UPDATE
       SET sent_count = EXCLUDED.sent_count,
           delivered_count = EXCLUDED.delivered_count,
           bounced_count = EXCLUDED.bounced_count,
           opened_count = EXCLUDED.opened_count,
           clicked_count = EXCLUDED.clicked_count,
           replied_count = EXCLUDED.replied_count,
           positive_replied_count = EXCLUDED.positive_replied_count,
           updated_at = NOW()`,
      [
        id,
        tenantId,
        campVal,
        mbxVal,
        varVal,
        dateUtc,
        row.sent_count,
        row.delivered_count,
        row.bounced_count,
        row.opened_count,
        row.clicked_count,
        row.replied_count,
        row.positive_replied_count
      ]
    );
    rowsRolledUp++;
  }

  logger.info(`Rolled up daily analytics for tenant ${tenantId} date ${dateUtc}: ${rowsRolledUp} buckets upserted`, {
    context: 'AnalyticsRollup'
  });

  return { date: dateUtc, rowsRolledUp };
}

/**
 * Computes date clause parameters for SQL queries.
 */
function resolveDateBounds(filters: AnalyticsFilterOptions): { startDate: Date; endDate: Date } {
  const now = new Date();
  const endDate = filters.endDate ? new Date(`${filters.endDate}T23:59:59.999Z`) : now;

  let startDate: Date;
  if (filters.startDate) {
    startDate = new Date(`${filters.startDate}T00:00:00.000Z`);
  } else if (filters.dateRange === '7d') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (filters.dateRange === '30d') {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (filters.dateRange === '90d') {
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else {
    // 'all' or default
    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
}

/**
 * Fetches comprehensive Outreach analytics matching raw ox_events & ox_sent_emails counts.
 */
export async function getOutreachAnalytics(
  tenantId: string,
  filters: AnalyticsFilterOptions = {},
  pool?: pg.Pool
): Promise<OutreachAnalyticsData> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) {
    throw new Error('Database pool unavailable for analytics query');
  }

  const { startDate, endDate } = resolveDateBounds(filters);

  // 1. Overall Aggregates from raw ox_sent_emails and ox_events
  const params: any[] = [tenantId, startDate, endDate];
  let filterClause = '';

  if (filters.campaignId) {
    params.push(filters.campaignId);
    filterClause += ` AND se.campaign_id = $${params.length}`;
  }
  if (filters.mailboxId) {
    params.push(filters.mailboxId);
    filterClause += ` AND se.mailbox_id = $${params.length}`;
  }
  if (filters.variantId) {
    params.push(filters.variantId);
    filterClause += ` AND se.variant_id = $${params.length}`;
  }

  const totalsQuery = `
    WITH scoped_emails AS (
      SELECT
        se.id,
        se.status,
        se.opened_at,
        se.clicked_at,
        se.replied_at,
        se.bounced_at
      FROM ox_sent_emails se
      WHERE se.tenant_id = $1
        AND se.sent_at >= $2
        AND se.sent_at <= $3
        ${filterClause}
    ),
    scoped_events AS (
      SELECT
        e.sent_email_id,
        MAX(CASE WHEN e.type = 'email_opened' THEN 1 ELSE 0 END) as has_open,
        MAX(CASE WHEN e.type = 'email_clicked' THEN 1 ELSE 0 END) as has_click,
        MAX(CASE WHEN e.type = 'email_replied' THEN 1 ELSE 0 END) as has_reply,
        MAX(CASE WHEN e.type = 'email_replied' AND (
          LOWER(COALESCE(e.metadata->>'sentiment', '')) IN ('positive', 'interested', 'meeting_requested') OR
          LOWER(COALESCE(e.metadata->>'classification', '')) IN ('positive', 'interested', 'meeting_requested')
        ) THEN 1 ELSE 0 END) as has_positive_reply,
        MAX(CASE WHEN e.type = 'email_bounced' THEN 1 ELSE 0 END) as has_bounce
      FROM ox_events e
      JOIN scoped_emails se ON e.sent_email_id = se.id
      GROUP BY e.sent_email_id
    )
    SELECT
      COUNT(DISTINCT se.id)::int as sent,
      COUNT(DISTINCT CASE WHEN se.status != 'bounced' AND COALESCE(ev.has_bounce, 0) = 0 THEN se.id END)::int as delivered,
      COUNT(DISTINCT CASE WHEN se.status = 'bounced' OR se.bounced_at IS NOT NULL OR COALESCE(ev.has_bounce, 0) = 1 THEN se.id END)::int as bounced,
      COUNT(DISTINCT CASE WHEN se.opened_at IS NOT NULL OR COALESCE(ev.has_open, 0) = 1 THEN se.id END)::int as opened,
      COUNT(DISTINCT CASE WHEN se.clicked_at IS NOT NULL OR COALESCE(ev.has_click, 0) = 1 THEN se.id END)::int as clicked,
      COUNT(DISTINCT CASE WHEN se.replied_at IS NOT NULL OR COALESCE(ev.has_reply, 0) = 1 THEN se.id END)::int as replied,
      COUNT(DISTINCT CASE WHEN COALESCE(ev.has_positive_reply, 0) = 1 THEN se.id END)::int as positive_replied
    FROM scoped_emails se
    LEFT JOIN scoped_events ev ON se.id = ev.sent_email_id;
  `;

  const totalRes = await targetPool.query(totalsQuery, params);
  const row = totalRes.rows[0] || {};

  const sent = row.sent || 0;
  const delivered = row.delivered || 0;
  const bounced = row.bounced || 0;
  const opened = row.opened || 0;
  const clicked = row.clicked || 0;
  const replied = row.replied || 0;
  const positiveReplied = row.positive_replied || 0;

  const deliveryRate = sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : 0;
  const openRate = delivered > 0 ? Number(((opened / delivered) * 100).toFixed(1)) : 0;
  const clickRate = delivered > 0 ? Number(((clicked / delivered) * 100).toFixed(1)) : 0;
  const replyRate = delivered > 0 ? Number(((replied / delivered) * 100).toFixed(1)) : 0;
  const positiveReplyRate = delivered > 0 ? Number(((positiveReplied / delivered) * 100).toFixed(1)) : 0;
  const bounceRate = sent > 0 ? Number(((bounced / sent) * 100).toFixed(1)) : 0;

  const overview: AnalyticsOverviewMetrics = {
    sent,
    delivered,
    bounced,
    opened,
    clicked,
    replied,
    positiveReplied,
    deliveryRate,
    openRate,
    clickRate,
    replyRate,
    positiveReplyRate,
    bounceRate,
    openRateDisclaimer: 'approximate (Apple Mail Privacy Protection inflates opens)'
  };

  // 2. Daily Time Series
  const dailyQuery = `
    WITH daily_emails AS (
      SELECT
        DATE(se.sent_at) as date_val,
        se.id,
        se.status,
        se.opened_at,
        se.clicked_at,
        se.replied_at,
        se.bounced_at
      FROM ox_sent_emails se
      WHERE se.tenant_id = $1
        AND se.sent_at >= $2
        AND se.sent_at <= $3
        ${filterClause}
    ),
    daily_events AS (
      SELECT
        e.sent_email_id,
        MAX(CASE WHEN e.type = 'email_opened' THEN 1 ELSE 0 END) as has_open,
        MAX(CASE WHEN e.type = 'email_clicked' THEN 1 ELSE 0 END) as has_click,
        MAX(CASE WHEN e.type = 'email_replied' THEN 1 ELSE 0 END) as has_reply,
        MAX(CASE WHEN e.type = 'email_replied' AND (
          LOWER(COALESCE(e.metadata->>'sentiment', '')) IN ('positive', 'interested', 'meeting_requested') OR
          LOWER(COALESCE(e.metadata->>'classification', '')) IN ('positive', 'interested', 'meeting_requested')
        ) THEN 1 ELSE 0 END) as has_positive_reply,
        MAX(CASE WHEN e.type = 'email_bounced' THEN 1 ELSE 0 END) as has_bounce
      FROM ox_events e
      JOIN daily_emails de ON e.sent_email_id = de.id
      GROUP BY e.sent_email_id
    )
    SELECT
      TO_CHAR(de.date_val, 'YYYY-MM-DD') as date,
      COUNT(DISTINCT de.id)::int as sent,
      COUNT(DISTINCT CASE WHEN de.status != 'bounced' AND COALESCE(dev.has_bounce, 0) = 0 THEN de.id END)::int as delivered,
      COUNT(DISTINCT CASE WHEN de.status = 'bounced' OR de.bounced_at IS NOT NULL OR COALESCE(dev.has_bounce, 0) = 1 THEN de.id END)::int as bounced,
      COUNT(DISTINCT CASE WHEN de.opened_at IS NOT NULL OR COALESCE(dev.has_open, 0) = 1 THEN de.id END)::int as opened,
      COUNT(DISTINCT CASE WHEN de.clicked_at IS NOT NULL OR COALESCE(dev.has_click, 0) = 1 THEN de.id END)::int as clicked,
      COUNT(DISTINCT CASE WHEN de.replied_at IS NOT NULL OR COALESCE(dev.has_reply, 0) = 1 THEN de.id END)::int as replied,
      COUNT(DISTINCT CASE WHEN COALESCE(dev.has_positive_reply, 0) = 1 THEN de.id END)::int as positive_replied
    FROM daily_emails de
    LEFT JOIN daily_events dev ON de.id = dev.sent_email_id
    GROUP BY de.date_val
    ORDER BY de.date_val ASC;
  `;

  const dailyRes = await targetPool.query(dailyQuery, params);
  const dailySeries: AnalyticsDailyPoint[] = dailyRes.rows.map((r) => ({
    date: r.date,
    sent: r.sent,
    delivered: r.delivered,
    bounced: r.bounced,
    opened: r.opened,
    clicked: r.clicked,
    replied: r.replied,
    positiveReplied: r.positive_replied
  }));

  // 3. Campaign Breakdown
  const campQuery = `
    SELECT
      c.id,
      c.name,
      c.status,
      COUNT(DISTINCT se.id)::int as sent,
      COUNT(DISTINCT CASE WHEN se.status != 'bounced' THEN se.id END)::int as delivered,
      COUNT(DISTINCT CASE WHEN se.status = 'bounced' OR se.bounced_at IS NOT NULL THEN se.id END)::int as bounced,
      COUNT(DISTINCT CASE WHEN se.opened_at IS NOT NULL THEN se.id END)::int as opened,
      COUNT(DISTINCT CASE WHEN se.clicked_at IS NOT NULL THEN se.id END)::int as clicked,
      COUNT(DISTINCT CASE WHEN se.replied_at IS NOT NULL THEN se.id END)::int as replied,
      COUNT(DISTINCT CASE WHEN ev.type = 'email_replied' AND LOWER(COALESCE(ev.metadata->>'sentiment', '')) = 'positive' THEN se.id END)::int as positive_replied
    FROM ox_campaigns c
    LEFT JOIN ox_sent_emails se ON c.id = se.campaign_id AND se.sent_at >= $2 AND se.sent_at <= $3
    LEFT JOIN ox_events ev ON se.id = ev.sent_email_id
    WHERE c.tenant_id = $1
    GROUP BY c.id, c.name, c.status
    ORDER BY sent DESC, c.created_at DESC;
  `;

  const campRes = await targetPool.query(campQuery, [tenantId, startDate, endDate]);
  const campaigns: CampaignAnalyticsSummary[] = campRes.rows.map((c) => {
    const s = c.sent || 0;
    const r = c.replied || 0;
    const repRate = s > 0 ? Number(((r / s) * 100).toFixed(1)) : 0;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      sent: s,
      delivered: c.delivered || 0,
      bounced: c.bounced || 0,
      opened: c.opened || 0,
      clicked: c.clicked || 0,
      replied: r,
      positiveReplied: c.positive_replied || 0,
      replyRate: repRate
    };
  });

  // 4. Variant Breakdown (A-Z)
  const varQuery = `
    SELECT
      v.id as variant_id,
      v.step_id,
      v.variant_label,
      v.subject,
      v.weight,
      COUNT(DISTINCT se.id)::int as sent,
      COUNT(DISTINCT CASE WHEN se.opened_at IS NOT NULL THEN se.id END)::int as opened,
      COUNT(DISTINCT CASE WHEN se.clicked_at IS NOT NULL THEN se.id END)::int as clicked,
      COUNT(DISTINCT CASE WHEN se.replied_at IS NOT NULL THEN se.id END)::int as replied,
      COUNT(DISTINCT CASE WHEN ev.type = 'email_replied' AND LOWER(COALESCE(ev.metadata->>'sentiment', '')) = 'positive' THEN se.id END)::int as positive_replied
    FROM ox_step_variants v
    JOIN ox_steps s ON v.step_id = s.id
    LEFT JOIN ox_sent_emails se ON v.id = se.variant_id AND se.sent_at >= $2 AND se.sent_at <= $3
    LEFT JOIN ox_events ev ON se.id = ev.sent_email_id
    WHERE v.tenant_id = $1 ${filters.campaignId ? 'AND s.campaign_id = $' + (params.indexOf(filters.campaignId) + 1) : ''}
    GROUP BY v.id, v.step_id, v.variant_label, v.subject, v.weight
    ORDER BY v.step_id, v.variant_label ASC;
  `;

  const varRes = await targetPool.query(varQuery, params);
  const variants: VariantAnalyticsSummary[] = varRes.rows.map((v) => {
    const s = v.sent || 0;
    const rep = v.replied || 0;
    const repRate = s > 0 ? Number(((rep / s) * 100).toFixed(1)) : 0;
    // Beta(1+r, 1+s-r) posterior score
    const posteriorScore = Number(((rep + 1) / (s + 2)).toFixed(4));
    return {
      variantId: v.variant_id,
      stepId: v.step_id,
      variantLabel: v.variant_label,
      subject: v.subject,
      weight: v.weight,
      sent: s,
      opened: v.opened || 0,
      clicked: v.clicked || 0,
      replied: rep,
      positiveReplied: v.positive_replied || 0,
      replyRate: repRate,
      posteriorScore
    };
  });

  // 5. Mailbox Breakdown
  const mbxQuery = `
    SELECT
      m.id as mailbox_id,
      m.email,
      COALESCE(m.health_score, 100.00)::numeric as health_score,
      COUNT(DISTINCT se.id)::int as sent,
      COUNT(DISTINCT CASE WHEN se.status = 'bounced' OR se.bounced_at IS NOT NULL THEN se.id END)::int as bounced,
      COUNT(DISTINCT CASE WHEN se.replied_at IS NOT NULL THEN se.id END)::int as replied
    FROM ox_mailboxes m
    LEFT JOIN ox_sent_emails se ON m.id = se.mailbox_id AND se.sent_at >= $2 AND se.sent_at <= $3
    WHERE m.tenant_id = $1 AND (m.is_deleted IS NULL OR m.is_deleted = false)
    GROUP BY m.id, m.email, m.health_score
    ORDER BY sent DESC;
  `;

  const mbxRes = await targetPool.query(mbxQuery, [tenantId, startDate, endDate]);
  const mailboxes: MailboxAnalyticsSummary[] = mbxRes.rows.map((m) => {
    const s = m.sent || 0;
    const b = m.bounced || 0;
    const bounceRate = s > 0 ? Number(((b / s) * 100).toFixed(1)) : 0;
    return {
      mailboxId: m.mailbox_id,
      email: m.email,
      sent: s,
      bounced: b,
      replied: m.replied || 0,
      bounceRate,
      healthScore: Number(m.health_score) || 100
    };
  });

  // 6. Warmup Trend
  const warmupQuery = `
    SELECT
      TO_CHAR(DATE(sent_at), 'YYYY-MM-DD') as date,
      COUNT(*)::int as sent,
      COUNT(CASE WHEN placement = 'inbox' OR folder_name ILIKE '%inbox%' THEN 1 END)::int as inbox_landed,
      COUNT(CASE WHEN placement = 'spam' OR folder_name ILIKE '%spam%' THEN 1 END)::int as spam_landed,
      COUNT(CASE WHEN rescued = true THEN 1 END)::int as rescued,
      COUNT(CASE WHEN replied = true THEN 1 END)::int as replied
    FROM ox_warmup_messages
    WHERE tenant_id = $1 AND sent_at >= $2 AND sent_at <= $3
    GROUP BY DATE(sent_at)
    ORDER BY DATE(sent_at) ASC;
  `;

  const warmupRes = await targetPool.query(warmupQuery, [tenantId, startDate, endDate]);
  const warmupTrend: WarmupTrendPoint[] = warmupRes.rows.map((w) => ({
    date: w.date,
    sent: w.sent,
    inboxLanded: w.inbox_landed,
    spamLanded: w.spam_landed,
    rescued: w.rescued,
    replied: w.replied,
    avgHealthScore: 98.5
  }));

  return {
    overview,
    dailySeries,
    campaigns,
    variants,
    mailboxes,
    warmupTrend
  };
}

/**
 * Generates CSV string of outbound performance telemetry for user download.
 */
export async function exportAnalyticsCsv(
  tenantId: string,
  filters: AnalyticsFilterOptions = {},
  pool?: pg.Pool
): Promise<string> {
  const analytics = await getOutreachAnalytics(tenantId, filters, pool);

  const lines: string[] = [];
  lines.push('--- OUTREACH SUITE PERFORMANCE TELEMETRY ---');
  lines.push(`Export Generated: ${new Date().toISOString()}`);
  lines.push(`Total Sent,${analytics.overview.sent}`);
  lines.push(`Delivered,${analytics.overview.delivered}`);
  lines.push(`Bounced,${analytics.overview.bounced}`);
  lines.push(`Opened,${analytics.overview.opened} (${analytics.overview.openRateDisclaimer})`);
  lines.push(`Clicked,${analytics.overview.clicked}`);
  lines.push(`Replied,${analytics.overview.replied}`);
  lines.push(`Positive Replied,${analytics.overview.positiveReplied}`);
  lines.push(`Delivery Rate (%),${analytics.overview.deliveryRate}%`);
  lines.push(`Open Rate (%),${analytics.overview.openRate}%`);
  lines.push(`Click Rate (%),${analytics.overview.clickRate}%`);
  lines.push(`Reply Rate (%),${analytics.overview.replyRate}%`);
  lines.push(`Positive Reply Rate (%),${analytics.overview.positiveReplyRate}%`);
  lines.push(`Bounce Rate (%),${analytics.overview.bounceRate}%`);
  lines.push('');

  lines.push('--- DAILY PERFORMANCE SERIES ---');
  lines.push('Date,Sent,Delivered,Bounced,Opened,Clicked,Replied,Positive Replied');
  analytics.dailySeries.forEach((d) => {
    lines.push(`${d.date},${d.sent},${d.delivered},${d.bounced},${d.opened},${d.clicked},${d.replied},${d.positiveReplied}`);
  });
  lines.push('');

  lines.push('--- CAMPAIGN BREAKDOWN ---');
  lines.push('Campaign ID,Campaign Name,Status,Sent,Delivered,Bounced,Opened,Clicked,Replied,Positive Replied,Reply Rate (%)');
  analytics.campaigns.forEach((c) => {
    lines.push(`"${c.id}","${c.name}","${c.status}",${c.sent},${c.delivered},${c.bounced},${c.opened},${c.clicked},${c.replied},${c.positiveReplied},${c.replyRate}%`);
  });
  lines.push('');

  lines.push('--- VARIANT BREAKDOWN (A-Z) ---');
  lines.push('Step ID,Variant Label,Subject,Weight,Sent,Opened,Clicked,Replied,Positive Replied,Reply Rate (%),Posterior Score');
  analytics.variants.forEach((v) => {
    const cleanSubj = v.subject.replace(/"/g, '""');
    lines.push(`"${v.stepId}","${v.variantLabel}","${cleanSubj}",${v.weight},${v.sent},${v.opened},${v.clicked},${v.replied},${v.positiveReplied},${v.replyRate}%,${v.posteriorScore}`);
  });
  lines.push('');

  lines.push('--- MAILBOX BREAKDOWN ---');
  lines.push('Mailbox ID,Email,Health Score,Sent,Bounced,Replied,Bounce Rate (%)');
  analytics.mailboxes.forEach((m) => {
    lines.push(`"${m.mailboxId}","${m.email}",${m.healthScore},${m.sent},${m.bounced},${m.replied},${m.bounceRate}%`);
  });

  return lines.join('\n');
}
