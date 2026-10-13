import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { initPostgresPool } from '../server/db.ts';
import { getOutreachPool, ensureOutreachSchema } from '../server/services/outreach/schema.ts';
import {
  evaluateStepCondition,
  assignStableVariant,
  autoOptimiseStepVariants,
  validateSequenceCycles
} from '../server/services/outreach/branching.ts';
import { checkAndReserve } from '../server/services/outreach/capGuard.ts';
import {
  OUTREACH_PLANS,
  getTenantPlan,
  setTenantPlan,
  getTenantUsageSummary
} from '../server/services/outreach/plans.ts';
import {
  getOutreachAnalytics,
  rollupDailyAnalytics
} from '../server/services/outreach/analytics.ts';

describe('Phase 6: Conditional Branching, A-Z Variants, Analytics & Plans Acceptance Tests', () => {
  let pool;
  const tenantId = `tenant_p6_${Date.now()}`;
  let sharedMailboxId = `mbx_shared_${Date.now()}`;

  before(async () => {
    await initPostgresPool();
    pool = getOutreachPool();
    if (pool) {
      await ensureOutreachSchema(pool);
      // Ensure sent email telemetry columns
      await pool.query(`
        ALTER TABLE ox_sent_emails ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
        ALTER TABLE ox_sent_emails ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
        ALTER TABLE ox_sent_emails ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
        ALTER TABLE ox_sent_emails ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
      `);

      // Create shared valid mailbox for tenant tests
      await pool.query(
        `INSERT INTO ox_mailboxes (id, tenant_id, email, sender_name, status, daily_cap, send_interval_sec)
         VALUES ($1, $2, 'shared-sender@mydomain.com', 'Sarah Jenkins', 'active', 100, 0)
         ON CONFLICT (id) DO NOTHING`,
        [sharedMailboxId, tenantId]
      );
    }
  });

  after(async () => {
    if (pool) {
      try {
        await pool.query(`DELETE FROM ox_sent_emails WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_events WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_enrollments WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_step_variants WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_steps WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_campaigns WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_mailboxes WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_tenant_plans WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_analytics_daily WHERE tenant_id = $1`, [tenantId]);
      } catch {}
    }
  });

  // ==========================================================================
  // CHECK 1: A branch sends different follow-ups to openers vs non-openers
  // ==========================================================================
  test('Check 1: a branch sends different follow-ups to openers vs non-openers', async () => {
    assert.ok(pool, 'Postgres pool required for branching test');

    const campaignId = `camp_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO ox_campaigns (id, tenant_id, name, status) VALUES ($1, $2, 'Branching Test Campaign', 'active')`,
      [campaignId, tenantId]
    );

    // Create Step 1 (Initial), Step 2 (Opener follow-up), Step 3 (Non-opener follow-up)
    const step1Id = `step_1_${crypto.randomUUID()}`;
    const step2OpenerId = `step_2_opener_${crypto.randomUUID()}`;
    const step3NonOpenerId = `step_3_non_opener_${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO ox_steps (id, tenant_id, campaign_id, step_number)
       VALUES
         ($1, $2, $3, 1),
         ($4, $2, $3, 2),
         ($5, $2, $3, 3)`,
      [step1Id, tenantId, campaignId, step2OpenerId, step3NonOpenerId]
    );

    // Create 2 Prospects and Enrollments
    const prospOpenerId = `prosp_open_${crypto.randomUUID()}`;
    const prospNonOpenerId = `prosp_non_open_${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO ox_prospects (id, tenant_id, email, status)
       VALUES
         ($1, $2, 'opener@targetdomain.com', 'contacted'),
         ($3, $2, 'nonopener@targetdomain.com', 'contacted')`,
      [prospOpenerId, tenantId, prospNonOpenerId]
    );

    const enrOpenerId = `enr_open_${crypto.randomUUID()}`;
    const enrNonOpenerId = `enr_non_open_${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO ox_enrollments (id, tenant_id, campaign_id, prospect_id, current_step_id, status)
       VALUES
         ($1, $2, $3, $4, $5, 'active'),
         ($6, $2, $3, $7, $5, 'active')`,
      [enrOpenerId, tenantId, campaignId, prospOpenerId, step1Id, enrNonOpenerId, prospNonOpenerId]
    );

    // Seed Step 1 sent email for Opener (has opened_at + event)
    const sentOpenerId = `sent_open_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO ox_sent_emails (id, tenant_id, campaign_id, step_id, enrollment_id, mailbox_id, recipient_email, subject, opened_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'opener@targetdomain.com', 'Initial Note', NOW() - INTERVAL '1 hour', 'opened')`,
      [sentOpenerId, tenantId, campaignId, step1Id, enrOpenerId, sharedMailboxId]
    );
    await pool.query(
      `INSERT INTO ox_events (id, tenant_id, sent_email_id, type, metadata, occurred_at)
       VALUES ($1, $2, $3, 'email_opened', '{"ip":"1.2.3.4"}', NOW() - INTERVAL '1 hour')`,
      [`ev_${crypto.randomUUID()}`, tenantId, sentOpenerId]
    );

    // Seed Step 1 sent email for Non-Opener (opened_at is NULL, no open event)
    const sentNonOpenerId = `sent_non_open_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO ox_sent_emails (id, tenant_id, campaign_id, step_id, enrollment_id, mailbox_id, recipient_email, subject, opened_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'nonopener@targetdomain.com', 'Initial Note', NULL, 'sent')`,
      [sentNonOpenerId, tenantId, campaignId, step1Id, enrNonOpenerId, sharedMailboxId]
    );

    // Define Step 1 Condition: if opened within 48h -> step2Opener, else -> step3NonOpener
    const step1Condition = {
      op: 'AND',
      rules: [
        {
          type: 'opened',
          stepRef: step1Id,
          withinHours: 48
        }
      ]
    };

    // 1. Evaluate for Opener
    const evalOpener = await evaluateStepCondition(enrOpenerId, step1Condition, {
      pool,
      tenantId,
      campaignId,
      onTrueStep: step2OpenerId,
      onFalseStep: step3NonOpenerId
    });

    assert.equal(evalOpener.hasCondition, true);
    assert.equal(evalOpener.isMatch, true, 'Opener prospect condition must evaluate to TRUE');
    assert.equal(evalOpener.branchTaken, 'true_branch');
    assert.equal(evalOpener.nextStepId, step2OpenerId, 'Opener MUST branch to step_2_opener');

    // 2. Evaluate for Non-Opener
    const evalNonOpener = await evaluateStepCondition(enrNonOpenerId, step1Condition, {
      pool,
      tenantId,
      campaignId,
      onTrueStep: step2OpenerId,
      onFalseStep: step3NonOpenerId
    });

    assert.equal(evalNonOpener.hasCondition, true);
    assert.equal(evalNonOpener.isMatch, false, 'Non-opener prospect condition must evaluate to FALSE');
    assert.equal(evalNonOpener.branchTaken, 'false_branch');
    assert.equal(evalNonOpener.nextStepId, step3NonOpenerId, 'Non-opener MUST branch to step_3_non_opener');

    // Confirm that opener and non-opener branched to DIFFERENT steps
    assert.notEqual(
      evalOpener.nextStepId,
      evalNonOpener.nextStepId,
      'A branch MUST send different follow-ups to openers vs non-openers'
    );
  });

  // ==========================================================================
  // CHECK 2: A-Z variants are distributed per weights and auto-optimise shifts weight only after minimum sample
  // ==========================================================================
  test('Check 2: A–Z variants are distributed per weights and auto-optimise shifts weight only after the minimum sample', async () => {
    assert.ok(pool, 'Postgres pool required for variant test');

    const campaignId = `camp_az_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO ox_campaigns (id, tenant_id, name, status) VALUES ($1, $2, 'A-Z Variant Test Campaign', 'active')`,
      [campaignId, tenantId]
    );

    const stepId = `step_az_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO ox_steps (id, tenant_id, campaign_id, step_number, auto_optimise)
       VALUES ($1, $2, $3, 1, true)`,
      [stepId, tenantId, campaignId]
    );

    // Create 3 variants: A (weight 60), B (weight 30), C (weight 10)
    const varAId = `var_a_${crypto.randomUUID()}`;
    const varBId = `var_b_${crypto.randomUUID()}`;
    const varCId = `var_c_${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO ox_step_variants (id, tenant_id, step_id, variant_label, subject, weight)
       VALUES
         ($1, $2, $3, 'A', 'Subject Variant A', 60),
         ($4, $2, $3, 'B', 'Subject Variant B', 30),
         ($5, $2, $3, 'C', 'Subject Variant C', 10)`,
      [varAId, tenantId, stepId, varBId, varCId]
    );

    // 1. Test Stable Assignment per Enrollment
    const prospectStableId = `prosp_stable_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO ox_prospects (id, tenant_id, email, status) VALUES ($1, $2, 'stable@domain.com', 'uncontacted')`,
      [prospectStableId, tenantId]
    );

    const enrId1 = `enr_test_stable_1_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO ox_enrollments (id, tenant_id, campaign_id, prospect_id, current_step_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [enrId1, tenantId, campaignId, prospectStableId, stepId]
    );

    const assignedFirst = await assignStableVariant(enrId1, stepId, pool);
    assert.ok(assignedFirst, 'Variant should be assigned');
    assert.ok(['A', 'B', 'C'].includes(assignedFirst.variant_label));

    // Second call on same enrollment MUST return exact same variant (Stable)
    const assignedSecond = await assignStableVariant(enrId1, stepId, pool);
    assert.equal(
      assignedFirst.id,
      assignedSecond.id,
      'Variant assignment MUST be stable per enrollment'
    );

    // 2. Test auto-optimise with INSUFFICIENT sample (< 100 sends)
    const preOpt = await autoOptimiseStepVariants(stepId, { pool, minSendsThreshold: 100 });
    assert.equal(
      preOpt.optimized,
      false,
      'Auto-optimise MUST NOT shift weights before reaching minimum sample (>= 100 sends)'
    );
    assert.ok(preOpt.reason.includes('Minimum sample threshold not reached'));

    // 3. Batched seed sample exceeding threshold (120 sends each)
    // Variant A: 120 sends, 6 replies (5% reply rate)
    // Variant B: 120 sends, 36 replies (30% reply rate) -> CLEAR WINNER
    // Variant C: 120 sends, 12 replies (10% reply rate)
    const seedSendsBatch = async (vId, count, replyCount) => {
      const rows = [];
      for (let i = 0; i < count; i++) {
        rows.push({
          id: `sent_seed_${crypto.randomUUID()}`,
          email: `seed_${i}@example.com`,
          repliedAt: i < replyCount ? new Date() : null
        });
      }
      const chunkSize = 40;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const placeholders = [];
        const values = [];
        chunk.forEach((r, idx) => {
          const offset = idx * 9;
          placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
          values.push(r.id, tenantId, campaignId, stepId, vId, sharedMailboxId, r.email, 'Variant Test Subject', r.repliedAt);
        });
        await pool.query(
          `INSERT INTO ox_sent_emails (id, tenant_id, campaign_id, step_id, variant_id, mailbox_id, recipient_email, subject, replied_at)
           VALUES ${placeholders.join(', ')}`,
          values
        );
      }
    };

    await seedSendsBatch(varAId, 120, 6);
    await seedSendsBatch(varBId, 120, 36);
    await seedSendsBatch(varCId, 120, 12);

    // 4. Run auto-optimise with sufficient sample
    const optResult = await autoOptimiseStepVariants(stepId, { pool, minSendsThreshold: 100 });
    assert.equal(optResult.optimized, true, 'Auto-optimise MUST optimize when >= 100 sends');
    assert.ok(
      optResult.reason.includes('Variant B'),
      'Decision must shift toward best performing variant (B)'
    );

    // Verify Bayesian shifted weights
    assert.ok(optResult.newWeights.B > optResult.newWeights.A, 'Variant B weight must exceed Variant A');
    assert.ok(optResult.newWeights.B > optResult.newWeights.C, 'Variant B weight must exceed Variant C');

    // Verify 5% minimum floor constraint: NO variant drops below 5%
    assert.ok(optResult.newWeights.A >= 5, 'Variant A must not drop below 5% floor');
    assert.ok(optResult.newWeights.B >= 5, 'Variant B must not drop below 5% floor');
    assert.ok(optResult.newWeights.C >= 5, 'Variant C must not drop below 5% floor');

    // Verify weights sum to 100
    const sumWeights = optResult.newWeights.A + optResult.newWeights.B + optResult.newWeights.C;
    assert.equal(sumWeights, 100, 'All variant weights must sum to exactly 100%');

    // Verify decision log recorded in DB
    const stepCheck = await pool.query(`SELECT optimization_log FROM ox_steps WHERE id = $1`, [stepId]);
    const log = typeof stepCheck.rows[0].optimization_log === 'string'
      ? JSON.parse(stepCheck.rows[0].optimization_log)
      : stepCheck.rows[0].optimization_log;
    assert.ok(Array.isArray(log) && log.length > 0, 'Decision log must be appended to ox_steps');
    assert.equal(log[0].bestVariant, 'B');
  });

  // ==========================================================================
  // CHECK 3: Monthly limit stops sending with a clear banner (plan_upgrade_required)
  // ==========================================================================
  test('Check 3: monthly limit stops sending with a clear banner', async () => {
    assert.ok(pool, 'Postgres pool required for monthly limit test');

    const limitTenant = `limit_tenant_${Date.now()}`;
    const mbxId = `mbx_limit_${Date.now()}`;

    // Set tenant on a custom tight plan with limit = 5
    await pool.query(
      `INSERT INTO ox_plans (id, name, mailbox_limit, daily_send_limit, monthly_send_limit, verification_quota)
       VALUES ('limit_test_plan', 'Limit Plan', 3, 100, 5, 500)
       ON CONFLICT (id) DO UPDATE SET monthly_send_limit = 5`
    );
    await pool.query(
      `INSERT INTO ox_tenant_plans (tenant_id, plan_id, billing_cycle_start, billing_cycle_end, status)
       VALUES ($1, 'limit_test_plan', NOW() - INTERVAL '1 day', NOW() + INTERVAL '29 days', 'active')
       ON CONFLICT (tenant_id) DO UPDATE SET plan_id = 'limit_test_plan'`,
      [limitTenant]
    );

    // Create active mailbox with sender_name
    await pool.query(
      `INSERT INTO ox_mailboxes (id, tenant_id, email, sender_name, status, daily_cap, send_interval_sec)
       VALUES ($1, $2, 'limit-sender@mydomain.com', 'Alex Limit', 'active', 50, 0)`,
      [mbxId, limitTenant]
    );

    // Seed 5 sent emails (exhausts quota)
    for (let i = 0; i < 5; i++) {
      await pool.query(
        `INSERT INTO ox_sent_emails (id, tenant_id, mailbox_id, recipient_email, subject, sent_at, status)
         VALUES ($1, $2, $3, $4, 'Quota Test', NOW(), 'sent')`,
        [`sent_lim_${crypto.randomUUID()}`, limitTenant, mbxId, `lim_${i}@prospect.com`]
      );
    }

    // Attempt to send 6th email through Cap Guard
    const guardRes = await checkAndReserve({
      tenantId: limitTenant,
      mailboxId: mbxId,
      prospectEmail: 'blocked-by-limit@target.com',
      kind: 'campaign',
      pool
    });

    assert.equal(guardRes.allowed, false, 'Send MUST be blocked when monthly quota is exhausted');
    assert.equal(
      guardRes.reason,
      'plan_upgrade_required',
      'Reason MUST return plan_upgrade_required to trigger clear banner'
    );
    assert.equal(guardRes.planUpgradeRequired, true);

    // Check usage summary reflects upgrade requirement
    const usageSummary = await getTenantUsageSummary(limitTenant, pool);
    assert.equal(usageSummary.isUpgradeRequired, true, 'isUpgradeRequired flag must be true');
    assert.equal(usageSummary.emailsRemaining, 0);
  });

  // ==========================================================================
  // CHECK 4: Stripe test-mode subscription upgrades limits immediately
  // ==========================================================================
  test('Check 4: Stripe test-mode subscription upgrades limits immediately', async () => {
    assert.ok(pool, 'Postgres pool required for stripe upgrade test');

    const upgradeTenant = `upg_tenant_${Date.now()}`;

    // 1. Initial plan: starter (5,000 emails, 3 mailboxes, 1,000 verifications)
    await setTenantPlan(upgradeTenant, 'starter', { pool, billingInterval: 'monthly' });
    const initialPlan = await getTenantPlan(upgradeTenant, pool);
    assert.equal(initialPlan.plan.id, 'starter');
    assert.equal(initialPlan.plan.monthlySendLimit, 5000);
    assert.equal(initialPlan.plan.mailboxLimit, 3);
    assert.equal(initialPlan.plan.verificationQuota, 1000);

    // 2. Perform test-mode upgrade to 'scale' (100,000 emails, 50 mailboxes, 25,000 verifications)
    const upgraded = await setTenantPlan(upgradeTenant, 'scale', {
      pool,
      billingInterval: 'annual',
      status: 'active'
    });

    assert.equal(upgraded.plan.id, 'scale', 'Plan tier must be scale');
    assert.equal(upgraded.billingInterval, 'annual');

    // 3. Verify immediate limit upgrades in DB
    const refreshed = await getTenantPlan(upgradeTenant, pool);
    assert.equal(refreshed.plan.id, 'scale');
    assert.equal(
      refreshed.plan.monthlySendLimit,
      100000,
      'Monthly send limit MUST immediately upgrade to 100,000'
    );
    assert.equal(
      refreshed.plan.mailboxLimit,
      50,
      'Mailbox limit MUST immediately upgrade to 50'
    );
    assert.equal(
      refreshed.plan.verificationQuota,
      25000,
      'Verification quota MUST immediately upgrade to 25,000'
    );

    // Verify usage summary reflects new scale limits immediately
    const usage = await getTenantUsageSummary(upgradeTenant, pool);
    assert.equal(usage.emailsLimit, 100000);
    assert.equal(usage.mailboxesLimit, 50);
    assert.equal(usage.verificationsLimit, 25000);
    assert.equal(usage.isUpgradeRequired, false);
  });

  // ==========================================================================
  // CHECK 5: Analytics numbers match raw ox_events counts in a SQL check
  // ==========================================================================
  test('Check 5: analytics numbers match raw ox_events counts in a SQL check', async () => {
    assert.ok(pool, 'Postgres pool required for analytics counts test');

    const sqlTenant = `analytics_sql_tenant_${Date.now()}`;
    const campId = `camp_analytics_${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO ox_campaigns (id, tenant_id, name, status) VALUES ($1, $2, 'Analytics SQL Verify Camp', 'active')`,
      [campId, sqlTenant]
    );

    // Seed known counts:
    // Total sent: 30
    // Delivered: 27
    // Bounced: 3
    // Opened: 15
    // Clicked: 9
    // Replied: 6
    // Positive Replied: 3
    for (let i = 0; i < 30; i++) {
      const emailId = `sent_stat_${i}_${crypto.randomUUID()}`;
      const isBounced = i >= 27; // 3 bounced
      const isOpened = !isBounced && i < 15; // 15 opened
      const isClicked = !isBounced && i < 9; // 9 clicked
      const isReplied = !isBounced && i < 6; // 6 replied
      const isPositive = !isBounced && i < 3; // 3 positive replies

      await pool.query(
        `INSERT INTO ox_sent_emails (id, tenant_id, campaign_id, mailbox_id, recipient_email, subject, status, opened_at, clicked_at, replied_at, bounced_at, sent_at)
         VALUES ($1, $2, $3, $4, $5, 'Stat Subject', $6, $7, $8, $9, $10, NOW())`,
        [
          emailId,
          sqlTenant,
          campId,
          sharedMailboxId,
          `target_${i}@domain.com`,
          isBounced ? 'bounced' : (isReplied ? 'replied' : (isOpened ? 'opened' : 'sent')),
          isOpened ? new Date() : null,
          isClicked ? new Date() : null,
          isReplied ? new Date() : null,
          isBounced ? new Date() : null
        ]
      );

      // Create matching raw ox_events rows
      if (isOpened) {
        await pool.query(
          `INSERT INTO ox_events (id, tenant_id, sent_email_id, type, metadata) VALUES ($1, $2, $3, 'email_opened', '{}')`,
          [`ev_open_${emailId}`, sqlTenant, emailId]
        );
      }
      if (isClicked) {
        await pool.query(
          `INSERT INTO ox_events (id, tenant_id, sent_email_id, type, metadata) VALUES ($1, $2, $3, 'email_clicked', '{"url":"https://acme.com"}')`,
          [`ev_click_${emailId}`, sqlTenant, emailId]
        );
      }
      if (isReplied) {
        await pool.query(
          `INSERT INTO ox_events (id, tenant_id, sent_email_id, type, metadata) VALUES ($1, $2, $3, 'email_replied', $4)`,
          [`ev_rep_${emailId}`, sqlTenant, emailId, isPositive ? '{"sentiment":"positive"}' : '{"sentiment":"neutral"}']
        );
      }
      if (isBounced) {
        await pool.query(
          `INSERT INTO ox_events (id, tenant_id, sent_email_id, type, metadata) VALUES ($1, $2, $3, 'email_bounced', '{"reason":"550 User unknown"}')`,
          [`ev_bnc_${emailId}`, sqlTenant, emailId]
        );
      }
    }

    // 1. Raw SQL counts check directly against ox_sent_emails & ox_events
    const rawSentRes = await pool.query(`SELECT COUNT(*)::int as c FROM ox_sent_emails WHERE tenant_id = $1`, [sqlTenant]);
    const rawOpenRes = await pool.query(`SELECT COUNT(*)::int as c FROM ox_events WHERE tenant_id = $1 AND type = 'email_opened'`, [sqlTenant]);
    const rawClickRes = await pool.query(`SELECT COUNT(*)::int as c FROM ox_events WHERE tenant_id = $1 AND type = 'email_clicked'`, [sqlTenant]);
    const rawReplyRes = await pool.query(`SELECT COUNT(*)::int as c FROM ox_events WHERE tenant_id = $1 AND type = 'email_replied'`, [sqlTenant]);
    const rawBounceRes = await pool.query(`SELECT COUNT(*)::int as c FROM ox_events WHERE tenant_id = $1 AND type = 'email_bounced'`, [sqlTenant]);

    assert.equal(rawSentRes.rows[0].c, 30);
    assert.equal(rawOpenRes.rows[0].c, 15);
    assert.equal(rawClickRes.rows[0].c, 9);
    assert.equal(rawReplyRes.rows[0].c, 6);
    assert.equal(rawBounceRes.rows[0].c, 3);

    // 2. Fetch analytics via getOutreachAnalytics service
    const analytics = await getOutreachAnalytics(sqlTenant, { dateRange: 'all' }, pool);

    // 3. Confirm exact match between analytics numbers and raw SQL event counts
    assert.equal(analytics.overview.sent, rawSentRes.rows[0].c, 'Analytics sent count must match raw SQL count (30)');
    assert.equal(analytics.overview.delivered, 27, 'Delivered count must be 27');
    assert.equal(analytics.overview.bounced, rawBounceRes.rows[0].c, 'Bounced count must match raw SQL count (3)');
    assert.equal(analytics.overview.opened, rawOpenRes.rows[0].c, 'Opened count must match raw SQL count (15)');
    assert.equal(analytics.overview.clicked, rawClickRes.rows[0].c, 'Clicked count must match raw SQL count (9)');
    assert.equal(analytics.overview.replied, rawReplyRes.rows[0].c, 'Replied count must match raw SQL count (6)');
    assert.equal(analytics.overview.positiveReplied, 3, 'Positive replied count must match raw count (3)');

    // Verify rate percentages
    assert.equal(analytics.overview.deliveryRate, 90.0, 'Delivery rate must be 90.0% (27/30)');
    assert.equal(analytics.overview.openRate, 55.6, 'Open rate must be 55.6% (15/27)');
    assert.equal(analytics.overview.clickRate, 33.3, 'Click rate must be 33.3% (9/27)');
    assert.equal(analytics.overview.replyRate, 22.2, 'Reply rate must be 22.2% (6/27)');
    assert.equal(analytics.overview.positiveReplyRate, 11.1, 'Positive reply rate must be 11.1% (3/27)');
    assert.equal(analytics.overview.bounceRate, 10.0, 'Bounce rate must be 10.0% (3/30)');

    // Verify disclaimer label
    assert.ok(
      analytics.overview.openRateDisclaimer.includes('Apple Mail Privacy Protection inflates opens'),
      'Must include the Apple Mail Privacy Protection open rate disclaimer'
    );

    // 4. Verify nightly rollup table sync
    const rollupResult = await rollupDailyAnalytics(sqlTenant, undefined, pool);
    assert.ok(rollupResult.rowsRolledUp > 0, 'Rollup rows must be generated');

    const rollupTableRes = await pool.query(
      `SELECT SUM(sent_count)::int as sent, SUM(delivered_count)::int as delivered,
              SUM(bounced_count)::int as bounced, SUM(opened_count)::int as opened,
              SUM(replied_count)::int as replied
       FROM ox_analytics_daily WHERE tenant_id = $1`,
      [sqlTenant]
    );

    assert.equal(rollupTableRes.rows[0].sent, 30, 'Rollup table sent count must match raw count (30)');
    assert.equal(rollupTableRes.rows[0].delivered, 27, 'Rollup table delivered count must match raw count (27)');
    assert.equal(rollupTableRes.rows[0].bounced, 3, 'Rollup table bounced count must match raw count (3)');
    assert.equal(rollupTableRes.rows[0].opened, 15, 'Rollup table opened count must match raw count (15)');
    assert.equal(rollupTableRes.rows[0].replied, 6, 'Rollup table replied count must match raw count (6)');
  });
});
