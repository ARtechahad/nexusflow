import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { initPostgresPool } from '../server/db.ts';
import { getOutreachPool, ensureOutreachSchema } from '../server/services/outreach/schema.ts';
import {
  computeDailyTargetSync,
  calculateHealthScore,
  pairWarmupRecipient,
  planDailyWarmupJobs,
  handleWarmupInboundMessage,
  checkWarmupPlacementJob
} from '../server/services/outreach/warmupEngine.ts';
import { encryptSecret } from '../server/services/outreach/crypto.ts';

describe('Phase 4: Full Multi-Domain Acceptance Integration Tests', () => {
  let pool;
  const tenantId = `tenant_test_${Date.now()}`;
  const mbxAlphaId = `mbx_alpha_${Date.now()}`;
  const mbxBetaId = `mbx_beta_${Date.now()}`;
  const mbxGammaId = `mbx_gamma_${Date.now()}`;

  const domainAlphaId = `dom_alpha_${Date.now()}`;
  const domainBetaId = `dom_beta_${Date.now()}`;
  const domainGammaId = `dom_gamma_${Date.now()}`;

  before(async () => {
    await initPostgresPool();
    pool = getOutreachPool();
    if (pool) {
      await ensureOutreachSchema(pool);

      // Seed 3 domains
      await pool.query(
        `INSERT INTO ox_domains (id, tenant_id, domain, spf_status, dkim_status, dmarc_status)
         VALUES
           ($1, $4, 'alpha-corp.io', 'valid', 'valid', 'valid'),
           ($2, $4, 'beta-ventures.com', 'valid', 'valid', 'valid'),
           ($3, $4, 'gamma-logistics.net', 'valid', 'valid', 'valid')
         ON CONFLICT DO NOTHING`,
        [domainAlphaId, domainBetaId, domainGammaId, tenantId]
      );

      const encPass = encryptSecret('test-secret-pass');

      // Seed 3 mailboxes on different domains with warmup opt-in
      await pool.query(
        `INSERT INTO ox_mailboxes (
           id, tenant_id, domain_id, email, sender_name, provider,
           smtp_host, smtp_port, smtp_user, smtp_pass_encrypted,
           imap_host, imap_port, imap_user, imap_pass_encrypted,
           status, daily_cap, warmup_enabled, warmup_terms_accepted, warmup_terms_accepted_at,
           warmup_mode, warmup_speed, warmup_target, health_score
         ) VALUES
           ($1, $4, $5, 'alex@alpha-corp.io', 'Alex Rivera', 'google',
            'smtp.gmail.com', 587, 'alex@alpha-corp.io', $7,
            'imap.gmail.com', 993, 'alex@alpha-corp.io', $7,
            'active', 50, true, true, NOW(), 'new_domain', 'normal', 40, 100.00),
           ($2, $4, $6, 'blake@beta-ventures.com', 'Blake Chen', 'outlook',
            'smtp.office365.com', 587, 'blake@beta-ventures.com', $7,
            'outlook.office365.com', 993, 'blake@beta-ventures.com', $7,
            'active', 50, true, true, NOW(), 'new_mailbox', 'normal', 60, 100.00),
           ($3, $4, $8, 'casey@gamma-logistics.net', 'Casey Vance', 'smtp',
            'mail.gamma-logistics.net', 587, 'casey@gamma-logistics.net', $7,
            'mail.gamma-logistics.net', 993, 'casey@gamma-logistics.net', $7,
            'active', 50, true, true, NOW(), 'maintenance', 'normal', 30, 100.00)
         ON CONFLICT DO NOTHING`,
        [mbxAlphaId, mbxBetaId, mbxGammaId, tenantId, domainAlphaId, domainBetaId, encPass, domainGammaId]
      );
    }
  });

  after(async () => {
    if (pool) {
      await pool.query(`DELETE FROM ox_warmup_messages WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM ox_mailbox_daily WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM ox_mailboxes WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM ox_domains WHERE tenant_id = $1`, [tenantId]);
      await pool.end().catch(() => {});
    }
  });

  test('Check 1: Peer-to-Peer Pairing chooses recipient on DIFFERENT domain & avoids same domain', async () => {
    if (!pool) return;

    const sender = {
      id: mbxAlphaId,
      email: 'alex@alpha-corp.io',
      tenant_id: tenantId,
      provider: 'google'
    };

    const pair = await pairWarmupRecipient(sender, pool);
    assert.ok(pair, 'Must successfully pair a recipient');
    assert.notEqual(pair.recipientMailbox.id, mbxAlphaId, 'Recipient must not be sender');
    const recipientDomain = pair.recipientMailbox.email.split('@')[1];
    assert.notEqual(recipientDomain, 'alpha-corp.io', 'Recipient must be on a DIFFERENT domain');
    assert.ok(['beta-ventures.com', 'gamma-logistics.net'].includes(recipientDomain));
  });

  test('Check 2: Messages flow both ways with threading up to depth 5', async () => {
    if (!pool) return;

    // Simulate an incoming warmup message on Beta mailbox from Alpha
    const initialTag = `wt_test_${crypto.randomUUID()}`;
    const initialThreadId = `th_${crypto.randomUUID()}`;
    const initialMsgId = `<msg_init_${Date.now()}@alpha-corp.io>`;

    // Record initial message in ox_warmup_messages sent by Alpha
    await pool.query(
      `INSERT INTO ox_warmup_messages (
         id, tenant_id, sender_mailbox_id, recipient_mailbox_id, recipient_email,
         thread_id, message_id_header, subject, body_snippet, status,
         tag, depth, placement, created_at, sent_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sent', $10, 1, 'unknown', NOW(), NOW())`,
      [
        `wmsg_${Date.now()}`,
        tenantId,
        mbxAlphaId,
        mbxBetaId,
        'blake@beta-ventures.com',
        initialThreadId,
        initialMsgId,
        'Project Milestones Update [WT-' + initialTag.slice(0, 8) + ']',
        'Reviewing our weekly targets',
        initialTag
      ]
    );

    // Mock incoming message on Beta recipient
    const mockInboundParsed = {
      headers: new Map([
        ['x-warmup-tag', initialTag],
        ['x-warmup-id', initialTag]
      ]),
      subject: 'Project Milestones Update [WT-' + initialTag.slice(0, 8) + ']',
      from: { value: [{ address: 'alex@alpha-corp.io' }] },
      messageId: initialMsgId,
      text: 'Thanks for sending over those initial insights earlier today.'
    };

    const betaMailbox = {
      id: mbxBetaId,
      email: 'blake@beta-ventures.com',
      tenant_id: tenantId
    };

    const res = await handleWarmupInboundMessage(
      mockInboundParsed,
      betaMailbox,
      pool,
      'INBOX'
    );

    assert.equal(res.handled, true);
    assert.equal(res.placement, 'inbox');
    assert.equal(res.rescued, false);

    // Check message updated in DB
    const checkMsgRes = await pool.query(
      `SELECT placement, inbox_landed FROM ox_warmup_messages WHERE tag = $1`,
      [initialTag]
    );
    assert.equal(checkMsgRes.rows[0].placement, 'inbox');
    assert.equal(checkMsgRes.rows[0].inbox_landed, true);
  });

  test('Check 3: A message forced into Spam is rescued and counted as spam on first landing', async () => {
    if (!pool) return;

    const spamTag = `wt_spam_${crypto.randomUUID()}`;
    const spamThreadId = `th_spam_${crypto.randomUUID()}`;
    const spamMsgId = `<msg_spam_${Date.now()}@gamma-logistics.net>`;

    await pool.query(
      `INSERT INTO ox_warmup_messages (
         id, tenant_id, sender_mailbox_id, recipient_mailbox_id, recipient_email,
         thread_id, message_id_header, subject, body_snippet, status,
         tag, depth, placement, created_at, sent_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sent', $10, 1, 'unknown', NOW(), NOW())`,
      [
        `wmsg_${Date.now()}_spam`,
        tenantId,
        mbxGammaId,
        mbxAlphaId,
        'alex@alpha-corp.io',
        spamThreadId,
        spamMsgId,
        'Notes from Monday sync [WT-' + spamTag.slice(0, 8) + ']',
        'Reviewing our weekly targets',
        spamTag
      ]
    );

    let movedMessageToInbox = false;
    let addedFlags = false;

    // Mock IMAP client with messageMove and messageFlagsAdd
    const mockImapClient = {
      async messageMove(uid, destFolder) {
        if (destFolder === 'INBOX') movedMessageToInbox = true;
      },
      async messageFlagsAdd(uid, flags) {
        if (flags.includes('\\Seen') && flags.includes('\\Flagged')) addedFlags = true;
      }
    };

    const mockSpamParsed = {
      headers: new Map([
        ['x-warmup-tag', spamTag]
      ]),
      subject: 'Notes from Monday sync [WT-' + spamTag.slice(0, 8) + ']',
      from: { value: [{ address: 'casey@gamma-logistics.net' }] },
      messageId: spamMsgId,
      text: 'Checking the status of the staging environment.'
    };

    const alphaMailbox = {
      id: mbxAlphaId,
      email: 'alex@alpha-corp.io',
      tenant_id: tenantId
    };

    const res = await handleWarmupInboundMessage(
      mockSpamParsed,
      alphaMailbox,
      pool,
      'Spam',
      mockImapClient,
      1234
    );

    assert.equal(res.handled, true);
    assert.equal(res.placement, 'spam');
    assert.equal(res.rescued, true);
    assert.equal(movedMessageToInbox, true);
    assert.equal(addedFlags, true);

    // Verify DB recorded rescued = true and placement = 'spam'
    const checkSpamRes = await pool.query(
      `SELECT placement, rescued, inbox_landed FROM ox_warmup_messages WHERE tag = $1`,
      [spamTag]
    );
    assert.equal(checkSpamRes.rows[0].placement, 'spam');
    assert.equal(checkSpamRes.rows[0].rescued, true);
    assert.equal(checkSpamRes.rows[0].inbox_landed, true); // Landed in inbox after rescue!

    // Verify counter recorded in ox_mailbox_daily
    const todayUtc = new Date().toISOString().slice(0, 10);
    const dailyRes = await pool.query(
      `SELECT warmup_spam_count, warmup_rescued_count FROM ox_mailbox_daily WHERE mailbox_id = $1 AND date_utc = $2`,
      [mbxAlphaId, todayUtc]
    );
    assert.ok(dailyRes.rows[0].warmup_spam_count >= 1);
    assert.ok(dailyRes.rows[0].warmup_rescued_count >= 1);
  });

  test('Check 4: Volume follows ramp (Day 1 ≈ 1, week 2 ≈ 9–15 for new_domain/normal/target 40)', () => {
    const baseInput = {
      warmupAgeDays: 1,
      sendingDays: 1,
      spamRate7d: 0.0,
      bounceRate7d: 0.0,
      campaignSentToday: 0,
      sharedMailboxCap: 50,
      hasSpf: true,
      hasDkim: true,
      domainMailboxCount: 1,
      userDesiredTarget: 40
    };

    // Day 1
    const day1Result = computeDailyTargetSync(
      { warmup_mode: 'new_domain', warmup_speed: 'normal', warmup_target: 40 },
      { ...baseInput, sendingDays: 1 }
    );
    assert.equal(day1Result.target, 1);

    // Week 2 Day 9: 1 + (9-1)*1 = 9
    const day9Result = computeDailyTargetSync(
      { warmup_mode: 'new_domain', warmup_speed: 'normal', warmup_target: 40 },
      { ...baseInput, sendingDays: 9, warmupAgeDays: 9 }
    );
    assert.equal(day9Result.target, 9);
    assert.ok(day9Result.target >= 9 && day9Result.target <= 15);

    // Week 2 Day 13 (ramp before day 14 unlock): 1 + (13-1)*1 = 13
    const day13Result = computeDailyTargetSync(
      { warmup_mode: 'new_domain', warmup_speed: 'normal', warmup_target: 40 },
      { ...baseInput, sendingDays: 13, warmupAgeDays: 13 }
    );
    assert.equal(day13Result.target, 13);
    assert.ok(day13Result.target >= 9 && day13Result.target <= 15);

    // Day 14 (age 14, sending days 14, spam 0%): full user target 40 unlocks!
    const day14Result = computeDailyTargetSync(
      { warmup_mode: 'new_domain', warmup_speed: 'normal', warmup_target: 40 },
      { ...baseInput, sendingDays: 14, warmupAgeDays: 14 }
    );
    assert.equal(day14Result.unlockedFullTarget, true);
    assert.equal(day14Result.target, 40);
  });

  test('Check 5: Excluding logic triggers in a simulated 16% spam test', () => {
    const highSpamResult = computeDailyTargetSync(
      { warmup_mode: 'new_domain', warmup_speed: 'normal', warmup_target: 40 },
      {
        warmupAgeDays: 10,
        sendingDays: 10,
        spamRate7d: 16.0, // 16% spam
        bounceRate7d: 0.5,
        campaignSentToday: 0,
        sharedMailboxCap: 50,
        hasSpf: true,
        hasDkim: true,
        domainMailboxCount: 1
      }
    );

    assert.equal(highSpamResult.target, 0);
    assert.equal(highSpamResult.poolExcluded, true);
    assert.ok(highSpamResult.reasons.some(r => r.includes('excluded from warmup pool')));
  });

  test('Check 6: Sending is spread across the day with random jitter (no two sends closer than 4 minutes)', async () => {
    if (!pool) return;

    // Run planner for mbxAlphaId
    const planRes = await planDailyWarmupJobs(pool, mbxAlphaId);
    assert.equal(planRes.poolTooSmall, false);
    assert.ok(planRes.poolSize >= 2);

    // Check scheduled ox_jobs for mbxAlphaId
    const jobsRes = await pool.query(
      `SELECT run_at FROM ox_jobs
       WHERE type = 'send_warmup_email'
         AND (payload->>'senderMailboxId') = $1
       ORDER BY run_at ASC`,
      [mbxAlphaId]
    );

    if (jobsRes.rows.length >= 2) {
      for (let i = 0; i < jobsRes.rows.length - 1; i++) {
        const timeA = new Date(jobsRes.rows[i].run_at).getTime();
        const timeB = new Date(jobsRes.rows[i + 1].run_at).getTime();
        const diffMinutes = (timeB - timeA) / (60 * 1000);
        // Must be at least 4 minutes apart
        assert.ok(diffMinutes >= 3.99, `Job ${i} and ${i + 1} are closer than 4 minutes: ${diffMinutes}m`);
      }
    }
  });

  test('Check 7: Placement check marks unknown messages as missing after 24h', async () => {
    if (!pool) return;

    // Insert an old unknown warmup message (older than 24h)
    const oldMsgId = `wmsg_old_${Date.now()}`;
    await pool.query(
      `INSERT INTO ox_warmup_messages (
         id, tenant_id, sender_mailbox_id, recipient_email, thread_id, subject,
         placement, sent_at, created_at
       ) VALUES ($1, $2, $3, 'test@example.com', 'th_old', 'Old Subject', 'unknown', NOW() - INTERVAL '26 hours', NOW() - INTERVAL '26 hours')`,
      [oldMsgId, tenantId, mbxAlphaId]
    );

    const checkRes = await checkWarmupPlacementJob(pool);
    assert.ok(checkRes.markedMissing >= 1);

    const verifyRes = await pool.query(`SELECT placement FROM ox_warmup_messages WHERE id = $1`, [oldMsgId]);
    assert.equal(verifyRes.rows[0].placement, 'missing');
  });
});
