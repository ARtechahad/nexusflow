import pg from 'pg';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';

import { OUTREACH_PLANS, type OutreachPlan } from '../../../src/data/outreachPlans';
export { OUTREACH_PLANS };
export type { OutreachPlan };

export interface TenantPlanDetails {
  tenantId: string;
  plan: OutreachPlan;
  billingInterval: 'monthly' | 'annual';
  billingCycleStart: Date;
  billingCycleEnd: Date;
  status: 'active' | 'past_due' | 'canceled';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  isTestMode: boolean;
}

/**
 * Retrieves the active plan for a tenant. Defaults to 'growth' for development.
 */
export async function getTenantPlan(tenantId: string, pool?: pg.Pool): Promise<TenantPlanDetails> {
  const targetPool = pool || getOutreachPool();
  const defaultPlan = OUTREACH_PLANS.growth;
  const now = new Date();
  const defaultCycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (!targetPool) {
    return {
      tenantId,
      plan: defaultPlan,
      billingInterval: 'monthly',
      billingCycleStart: now,
      billingCycleEnd: defaultCycleEnd,
      status: 'active',
      isTestMode: true
    };
  }

  try {
    const res = await targetPool.query(
      `SELECT * FROM ox_tenant_plans WHERE tenant_id = $1`,
      [tenantId]
    );

    if (res.rows.length === 0) {
      // Seed default plan into ox_tenant_plans
      await targetPool.query(
        `INSERT INTO ox_tenant_plans (
           tenant_id, plan_id, billing_interval, billing_cycle_start, billing_cycle_end, status
         ) VALUES ($1, 'growth', 'monthly', NOW(), NOW() + INTERVAL '30 days', 'active')
         ON CONFLICT (tenant_id) DO NOTHING`,
        [tenantId]
      );
      return {
        tenantId,
        plan: OUTREACH_PLANS.growth,
        billingInterval: 'monthly',
        billingCycleStart: now,
        billingCycleEnd: defaultCycleEnd,
        status: 'active',
        isTestMode: !Boolean(process.env.STRIPE_SECRET_KEY)
      };
    }

    const row = res.rows[0];
    const planKey = (row.plan_id || 'growth').toLowerCase();
    let plan = OUTREACH_PLANS[planKey];

    if (!plan) {
      try {
        const dbPlanRes = await targetPool.query(`SELECT * FROM ox_plans WHERE id = $1`, [row.plan_id]);
        if (dbPlanRes.rows.length > 0) {
          const dp = dbPlanRes.rows[0];
          let featuresObj = {
            warmup: true,
            a_b_testing: true,
            conditional_branching: true,
            auto_optimize: true,
            dedicated_tracking_domain: true,
            advanced_analytics: true,
            priority_support: true
          };
          if (dp.features) {
            try {
              const parsed = typeof dp.features === 'string' ? JSON.parse(dp.features) : dp.features;
              if (parsed && typeof parsed === 'object') {
                featuresObj = { ...featuresObj, ...parsed };
              }
            } catch {}
          }
          plan = {
            id: dp.id,
            name: dp.name || dp.id,
            tier: dp.id,
            monthlyPriceUsd: dp.monthly_price ?? 0,
            annualPriceUsd: dp.annual_price ?? 0,
            mailboxLimit: dp.mailbox_limit ?? 5,
            dailySendLimit: dp.daily_send_limit ?? 500,
            monthlySendLimit: dp.monthly_send_limit ?? 5000,
            verificationQuota: dp.verification_quota ?? 1000,
            features: featuresObj
          };
        } else {
          plan = OUTREACH_PLANS.growth;
        }
      } catch {
        plan = OUTREACH_PLANS.growth;
      }
    }

    return {
      tenantId,
      plan,
      billingInterval: row.billing_interval || 'monthly',
      billingCycleStart: row.billing_cycle_start ? new Date(row.billing_cycle_start) : now,
      billingCycleEnd: row.billing_cycle_end ? new Date(row.billing_cycle_end) : defaultCycleEnd,
      status: row.status || 'active',
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeCustomerId: row.stripe_customer_id,
      isTestMode: !Boolean(process.env.STRIPE_SECRET_KEY)
    };
  } catch (err: any) {
    logger.warn('Failed to query tenant plan from DB, using Growth default', {
      context: 'Plans',
      details: err?.message
    });
    return {
      tenantId,
      plan: defaultPlan,
      billingInterval: 'monthly',
      billingCycleStart: now,
      billingCycleEnd: defaultCycleEnd,
      status: 'active',
      isTestMode: true
    };
  }
}

/**
 * Sets or upgrades a tenant's plan directly (used by Stripe webhooks and admin test mode).
 */
export async function setTenantPlan(
  tenantId: string,
  planId: string,
  options?: {
    billingInterval?: 'monthly' | 'annual';
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    status?: string;
    pool?: pg.Pool;
  }
): Promise<TenantPlanDetails> {
  const targetPool = options?.pool || getOutreachPool();
  const cleanPlanId = (planId || 'growth').toLowerCase();
  const plan = OUTREACH_PLANS[cleanPlanId] || OUTREACH_PLANS.growth;
  const interval = options?.billingInterval || 'monthly';
  const status = options?.status || 'active';

  if (!targetPool) {
    throw new Error('Database pool unavailable to update plan');
  }

  const daysAhead = interval === 'annual' ? 365 : 30;

  await targetPool.query(
    `INSERT INTO ox_tenant_plans (
       tenant_id, plan_id, billing_interval, billing_cycle_start, billing_cycle_end,
       stripe_customer_id, stripe_subscription_id, status, updated_at
     ) VALUES (
       $1, $2, $3, NOW(), NOW() + ($4 || ' days')::interval, $5, $6, $7, NOW()
     )
     ON CONFLICT (tenant_id) DO UPDATE
     SET plan_id = EXCLUDED.plan_id,
         billing_interval = EXCLUDED.billing_interval,
         billing_cycle_start = NOW(),
         billing_cycle_end = NOW() + ($4 || ' days')::interval,
         stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, ox_tenant_plans.stripe_customer_id),
         stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, ox_tenant_plans.stripe_subscription_id),
         status = EXCLUDED.status,
         updated_at = NOW()`,
    [
      tenantId,
      plan.id,
      interval,
      String(daysAhead),
      options?.stripeCustomerId || null,
      options?.stripeSubscriptionId || null,
      status
    ]
  );

  // Sync with global ox_plans table row
  await targetPool.query(
    `INSERT INTO ox_plans (id, name, mailbox_limit, daily_send_limit, monthly_send_limit, verification_quota, features, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name,
         mailbox_limit = EXCLUDED.mailbox_limit,
         daily_send_limit = EXCLUDED.daily_send_limit,
         monthly_send_limit = EXCLUDED.monthly_send_limit,
         verification_quota = EXCLUDED.verification_quota,
         features = EXCLUDED.features,
         updated_at = NOW()`,
    [
      plan.id,
      plan.name,
      plan.mailboxLimit,
      plan.dailySendLimit,
      plan.monthlySendLimit,
      plan.verificationQuota,
      JSON.stringify(plan.features)
    ]
  );

  return getTenantPlan(tenantId, targetPool);
}

/**
 * Fetches usage metrics for the active billing cycle
 */
export async function getTenantUsageSummary(tenantId: string, pool?: pg.Pool): Promise<{
  plan: OutreachPlan;
  billingCycleStart: string;
  billingCycleEnd: string;
  billingInterval: string;
  emailsSent: number;
  emailsLimit: number;
  emailsRemaining: number;
  mailboxesUsed: number;
  mailboxesLimit: number;
  verificationsUsed: number;
  verificationsLimit: number;
  isUpgradeRequired: boolean;
  isTestMode: boolean;
}> {
  const targetPool = pool || getOutreachPool();
  const planDetails = await getTenantPlan(tenantId, targetPool);
  const plan = planDetails.plan;

  if (!targetPool) {
    return {
      plan,
      billingCycleStart: planDetails.billingCycleStart.toISOString(),
      billingCycleEnd: planDetails.billingCycleEnd.toISOString(),
      billingInterval: planDetails.billingInterval,
      emailsSent: 0,
      emailsLimit: plan.monthlySendLimit,
      emailsRemaining: plan.monthlySendLimit,
      mailboxesUsed: 0,
      mailboxesLimit: plan.mailboxLimit,
      verificationsUsed: 0,
      verificationsLimit: plan.verificationQuota,
      isUpgradeRequired: false,
      isTestMode: planDetails.isTestMode
    };
  }

  // 1. Emails sent this billing cycle
  const emailsRes = await targetPool.query(
    `SELECT COUNT(*)::int as count FROM ox_sent_emails
     WHERE tenant_id = $1 AND sent_at >= $2`,
    [tenantId, planDetails.billingCycleStart]
  );
  const emailsSent = emailsRes.rows[0]?.count ?? 0;

  // 2. Active mailboxes
  const mbxRes = await targetPool.query(
    `SELECT COUNT(*)::int as count FROM ox_mailboxes
     WHERE tenant_id = $1 AND (is_deleted IS NULL OR is_deleted = false) AND status = 'active'`,
    [tenantId]
  );
  const mailboxesUsed = mbxRes.rows[0]?.count ?? 0;

  // 3. Verifications used this month
  const now = new Date();
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const verifRes = await targetPool.query(
    `SELECT verification_count FROM ox_verification_usage
     WHERE tenant_id = $1 AND year_month = $2`,
    [tenantId, yearMonth]
  );
  const verificationsUsed = verifRes.rows[0]?.verification_count ?? 0;

  const isUpgradeRequired = emailsSent >= plan.monthlySendLimit;

  return {
    plan,
    billingCycleStart: planDetails.billingCycleStart.toISOString(),
    billingCycleEnd: planDetails.billingCycleEnd.toISOString(),
    billingInterval: planDetails.billingInterval,
    emailsSent,
    emailsLimit: plan.monthlySendLimit,
    emailsRemaining: Math.max(0, plan.monthlySendLimit - emailsSent),
    mailboxesUsed,
    mailboxesLimit: plan.mailboxLimit,
    verificationsUsed,
    verificationsLimit: plan.verificationQuota,
    isUpgradeRequired,
    isTestMode: planDetails.isTestMode
  };
}
