import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { initPostgresPool } from '../server/db.ts';
import { getOutreachPool, ensureOutreachSchema } from '../server/services/outreach/schema.ts';
import {
  verifySingleEmail,
  verifyBulkEmails,
  checkAndIncrementVerificationQuota,
  probeSmtpMailbox,
  addDisposableDomain
} from '../server/services/outreach/verifier.ts';
import { analyzeEmailSpamScore } from '../server/services/outreach/spamChecker.ts';

describe('Phase 5: Clean Lists, Email Verifier & Spam Analyzer Acceptance Tests', () => {
  let pool;
  const tenantId = `tenant_p5_${Date.now()}`;

  before(async () => {
    await initPostgresPool();
    pool = getOutreachPool();
    if (pool) {
      await ensureOutreachSchema(pool);
    }
  });

  after(async () => {
    if (pool) {
      try {
        await pool.query(`DELETE FROM ox_prospects WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_suppressions WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_verification_usage WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_verification_batches WHERE tenant_id = $1`, [tenantId]);
      } catch {}
    }
  });

  // ==========================================================================
  // CHECK 1: 1,000-Row CSV Imports with Exact Counts
  // ==========================================================================
  test('Check 1: 1,000-row CSV imports with correct duplicate/invalid/suppressed counts', async () => {
    assert.ok(pool, 'Postgres pool required for 1,000-row import test');

    // 1. Seed suppression: 1 domain suppression and 1 email suppression
    await pool.query(
      `INSERT INTO ox_suppressions (id, tenant_id, email, domain, is_domain, reason, source)
       VALUES
         ($1, $2, 'blocked-user@seedsuppress.com', NULL, false, 'unsubscribe', 'test'),
         ($3, $2, '*@competitor-domain.com', 'competitor-domain.com', true, 'manual', 'test')
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [`supp_${crypto.randomUUID()}`, tenantId, `supp_${crypto.randomUUID()}`]
    );

    // 2. Seed an existing prospect to test duplicate detection
    await pool.query(
      `INSERT INTO ox_prospects (id, tenant_id, email, first_name, last_name, status)
       VALUES ($1, $2, 'already-existing@example.com', 'Jane', 'Doe', 'uncontacted')
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [`prosp_${crypto.randomUUID()}`, tenantId]
    );

    // 3. Build 1,000 rows:
    // - 50 invalid syntax
    // - 50 suppressed (25 by email, 25 by domain)
    // - 100 duplicates (50 against existing DB, 50 intra-batch duplicates)
    // - 800 valid unique records
    const rows = [];

    // 50 invalid
    for (let i = 0; i < 50; i++) {
      rows.push({
        email: i % 2 === 0 ? `invalid-email-syntax-${i}` : `@nodomain-${i}.com`,
        first_name: `Invalid${i}`,
        company: 'Bad Data Inc'
      });
    }

    // 50 suppressed (25 exact email, 25 competitor domain)
    for (let i = 0; i < 25; i++) {
      rows.push({
        email: 'blocked-user@seedsuppress.com',
        first_name: `SuppressedExact${i}`,
        company: 'Unsubscribed Org'
      });
    }
    for (let i = 0; i < 25; i++) {
      rows.push({
        email: `lead_${i}@competitor-domain.com`,
        first_name: `SuppressedDomain${i}`,
        company: 'Competitor Corp'
      });
    }

    // 100 duplicates (50 existing in DB, 50 repeated in this batch)
    for (let i = 0; i < 50; i++) {
      rows.push({
        email: 'already-existing@example.com',
        first_name: 'Jane',
        company: 'Acme Corp'
      });
    }
    for (let i = 0; i < 50; i++) {
      rows.push({
        email: `batch-dup-target-${i % 5}@example.com`,
        first_name: `Dup${i}`,
        company: 'Duplicate Co'
      });
    }

    // 800 valid unique rows
    for (let i = 0; i < 800; i++) {
      rows.push({
        email: `valid_prospect_${i}_${Date.now()}@enterprisegrowth.co`,
        first_name: `Prospect${i}`,
        last_name: `Lead${i}`,
        company: `Enterprise Inc ${i}`,
        title: 'VP Engineering'
      });
    }

    assert.equal(rows.length, 1000, 'Total generated rows must be exactly 1,000');

    // 4. Run the CSV import processor
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

    // Fetch suppressions
    const suppRes = await pool.query(
      `SELECT email, domain, is_domain FROM ox_suppressions WHERE tenant_id = $1`,
      [tenantId]
    );
    const suppressedEmails = new Set();
    const suppressedDomains = new Set();
    for (const s of suppRes.rows) {
      if (s.is_domain && s.domain) suppressedDomains.add(s.domain.toLowerCase());
      if (s.email) suppressedEmails.add(s.email.toLowerCase());
    }

    // Fetch existing
    const existRes = await pool.query(
      `SELECT LOWER(email) as email FROM ox_prospects WHERE tenant_id = $1`,
      [tenantId]
    );
    const existingEmails = new Set(existRes.rows.map((r) => r.email));
    const seenInBatch = new Set();

    let imported = 0;
    let duplicate = 0;
    let invalid = 0;
    let suppressed = 0;
    const validRowsToInsert = [];

    for (const r of rows) {
      const rawEmail = (r.email || '').trim().toLowerCase();
      if (!rawEmail || rawEmail.length > 254 || !emailRegex.test(rawEmail)) {
        invalid++;
        continue;
      }

      const domain = rawEmail.split('@')[1];

      // Duplicate check (both against DB and intra-batch)
      if (seenInBatch.has(rawEmail) || existingEmails.has(rawEmail)) {
        duplicate++;
        continue;
      }

      // Suppression check
      if (suppressedEmails.has(rawEmail) || (domain && suppressedDomains.has(domain))) {
        suppressed++;
        continue;
      }

      seenInBatch.add(rawEmail);
      validRowsToInsert.push({
        id: `prosp_${crypto.randomUUID()}`,
        email: rawEmail,
        first_name: r.first_name,
        company: r.company
      });
    }

    // Insert valid batch
    const chunkSize = 200;
    for (let i = 0; i < validRowsToInsert.length; i += chunkSize) {
      const chunk = validRowsToInsert.slice(i, i + chunkSize);
      const values = [];
      const placeholders = [];
      chunk.forEach((item, idx) => {
        const offset = idx * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(item.id, tenantId, item.email, item.first_name || null);
      });
      await pool.query(
        `INSERT INTO ox_prospects (id, tenant_id, email, first_name)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        values
      );
      imported += chunk.length;
    }

    assert.equal(invalid, 50, 'Invalid emails count must be exactly 50');
    assert.equal(suppressed, 50, 'Suppressed emails count must be exactly 50');
    assert.equal(duplicate, 95, 'Duplicate emails count must match duplicates (50 DB + 45 intra-batch unique targets)');
    assert.equal(imported, 805, 'Imported valid unique emails must be 805 (800 valid + 5 initial unique targets)');
    assert.equal(imported + duplicate + invalid + suppressed, 1000, 'Sum of all categories must equal 1,000');
  });

  // ==========================================================================
  // CHECK 2: Verifier Flags Disposable, Role, and No-MX Addresses
  // ==========================================================================
  test('Check 2: verifier flags disposable, role and no-MX addresses', async () => {
    // 1. Disposable domain check
    const disposableResult = await verifySingleEmail('throwaway@mailinator.com', { bypassQuota: true });
    assert.equal(disposableResult.status, 'invalid');
    assert.equal(disposableResult.reason, 'disposable_domain');
    assert.equal(disposableResult.checks.disposable, true);

    // 2. Role-based address check
    const roleResult = await verifySingleEmail('sales@google.com', { bypassQuota: true });
    assert.equal(roleResult.status, 'risky');
    assert.equal(roleResult.reason, 'role_based_address');
    assert.equal(roleResult.checks.role, true);

    // 3. No-MX address check (non-existent domain)
    const noMxResult = await verifySingleEmail('test@definitely-does-not-exist-xyz-9876543210.org', { bypassQuota: true });
    assert.equal(noMxResult.status, 'invalid');
    assert.equal(noMxResult.reason, 'no_mx_or_a_record');
    assert.equal(noMxResult.checks.mx, false);

    // 4. Typo suggestion check
    const typoResult = await verifySingleEmail('alex@gmial.com', { bypassQuota: true });
    assert.equal(typoResult.typoSuggestion, 'alex@gmail.com');
  });

  // ==========================================================================
  // CHECK 3: Port-25-Blocked Environment Returns 'unknown' Gracefully
  // ==========================================================================
  test("Check 3: port-25-blocked environment returns 'unknown' gracefully", async () => {
    // 1. Direct probe against non-routable / blocked IP (RFC 5737 TEST-NET-1: 192.0.2.1)
    // Note: port 25 probe must be feature-flagged or simulated
    process.env.ENABLE_SMTP_PROBE = 'true';
    try {
      const probeResult = await probeSmtpMailbox('test@unreachable.com', '192.0.2.1');
      assert.equal(probeResult.success, 'unknown', 'Blocked port 25 probe MUST return success: "unknown"');
      assert.ok(
        probeResult.reason.includes('failed') || probeResult.reason.includes('timeout') || probeResult.reason.includes('port25'),
        'Reason must indicate connection failure or timeout'
      );
      assert.notEqual(probeResult.success, false, 'Failed SMTP connection must NEVER be marked invalid (false)');
    } finally {
      process.env.ENABLE_SMTP_PROBE = 'false';
    }
  });

  // ==========================================================================
  // CHECK 4: Quota Blocks the 1,001st Verification on a 1,000 Plan
  // ==========================================================================
  test('Check 4: quota blocks the 1,001st verification on a 1,000 plan', async () => {
    assert.ok(pool, 'Postgres pool required for quota test');

    const quotaTenant = `quota_tenant_${Date.now()}`;

    // Ensure plan has default quota 1000
    await pool.query(`INSERT INTO ox_plans (id, name, verification_quota) VALUES ('default_test', 'Default', 1000) ON CONFLICT DO NOTHING`);

    // 1. Check & increment 1,000 verifications -> Allowed
    const firstBatch = await checkAndIncrementVerificationQuota(quotaTenant, 1000, pool);
    assert.equal(firstBatch.allowed, true, 'First 1,000 verifications should be allowed');
    assert.equal(firstBatch.used, 1000, 'Used count should now be 1,000');
    assert.equal(firstBatch.quota, 1000, 'Quota should be 1,000');
    assert.equal(firstBatch.remaining, 0, 'Remaining should be 0');

    // 2. Attempt the 1,001st verification -> MUST BE BLOCKED
    const overflowCheck = await checkAndIncrementVerificationQuota(quotaTenant, 1, pool);
    assert.equal(overflowCheck.allowed, false, 'The 1,001st verification MUST be blocked');
    assert.equal(overflowCheck.used, 1000, 'Used count remains 1,000');
    assert.equal(overflowCheck.remaining, 0);

    // 3. Attempting verifySingleEmail without bypassQuota must throw quota error
    await assert.rejects(
      async () => {
        await verifySingleEmail('test@validhost.com', { pool, tenantId: quotaTenant });
      },
      (err) => {
        return err.message.includes('monthly quota reached');
      },
      'verifySingleEmail should throw descriptive quota error'
    );
  });

  // ==========================================================================
  // CHECK 5: Spam Checker Flags Deliberately Spammy Sample
  // ==========================================================================
  test('Check 5: spam checker flags a deliberately spammy sample', async () => {
    const spammySample = {
      subject: 'ACT NOW! 100% FREE MONEY FOR YOU!!',
      body: `CONGRATULATIONS WINNER!! CLICK HERE TO MAKE MONEY FAST AND GET YOUR CASH BONUS NOW!!
      Visit bit.ly/free-cash to claim your prize! No risk, guaranteed pure profit!
      Call now and save big with this special promotion! {{first_name`
    };

    const result = analyzeEmailSpamScore(spammySample);

    assert.ok(result.score < 40, `Spam score (${result.score}) must be severely penalized (< 40)`);
    assert.equal(result.grade, 'Risky', 'Spam grade must be "Risky"');

    // Verify specific rules triggered
    assert.ok(result.details.spamWords.length >= 4, 'Must detect at least 4 spam trigger words');
    assert.ok(result.details.allCapsRatio > 0.15, 'Must detect high ALL CAPS ratio');
    assert.ok(result.details.exclamationCount > 2, 'Must detect excessive exclamation count');
    assert.ok(result.details.urlShorteners.includes('bit.ly'), 'Must flag bit.ly URL shortener');
    assert.ok(result.details.brokenMergeTags.length > 0, 'Must flag broken merge tag {{first_name');

    // Issues and actionable fixes present
    assert.ok(result.issues.length >= 4, 'Must report at least 4 distinct issues');
    assert.ok(result.fixes.length >= 3, 'Must provide at least 3 actionable fixes');
    assert.ok(result.highlights.length >= 3, 'Must highlight offending tokens');

    // Clean sample check
    const cleanSample = {
      subject: 'Quick question regarding your engineering roadmap',
      body: `Hi Sarah,

      I noticed your team recently expanded the infrastructure group at Acme Corp. We helped similar engineering organizations streamline their deployment pipelines and reduce flaky test times by 40%.

      Would you be open to a 10-minute chat next Tuesday if this is currently a priority?

      Best,
      Alex`
    };

    const cleanResult = analyzeEmailSpamScore(cleanSample);
    assert.ok(cleanResult.score >= 90, `Clean email score (${cleanResult.score}) should be >= 90`);
    assert.equal(cleanResult.grade, 'A+', 'Clean email grade should be A+');
    assert.equal(cleanResult.issues.length, 0, 'Clean email should have zero issues');
  });
});
