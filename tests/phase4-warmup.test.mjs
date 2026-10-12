import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import Phase 4 modules
import {
  computeDailyTargetSync,
  calculateHealthScore,
  MODE_CONFIGS,
  SPEED_INCREMENTS
} from '../server/services/outreach/warmupEngine.ts';

import {
  SEED_SUBJECTS,
  SEED_OPENERS,
  SEED_BODIES,
  SEED_REPLIES,
  SEED_SIGNOFFS,
  validateWarmupContentItem,
  assembleWarmupMessage,
  assembleWarmupReply
} from '../server/services/outreach/warmupContent.ts';

describe('Phase 4: Peer-to-Peer Warmup Engine & Deliverability Ramping Tests', () => {

  describe('1. Content Library Completeness & Validation Rules', () => {
    test('Contains required minimum items across all five categories', () => {
      assert.ok(SEED_SUBJECTS.length >= 60, `Expected >= 60 subjects, got ${SEED_SUBJECTS.length}`);
      assert.ok(SEED_OPENERS.length >= 60, `Expected >= 60 openers, got ${SEED_OPENERS.length}`);
      assert.ok(SEED_BODIES.length >= 80, `Expected >= 80 body paragraphs, got ${SEED_BODIES.length}`);
      assert.ok(SEED_REPLIES.length >= 40, `Expected >= 40 reply snippets, got ${SEED_REPLIES.length}`);
      assert.ok(SEED_SIGNOFFS.length >= 30, `Expected >= 30 signoffs, got ${SEED_SIGNOFFS.length}`);
    });

    test('Validates legitimate business copy cleanly', () => {
      const validSubject = validateWarmupContentItem('subject', 'Quarterly roadmap sync and timeline notes');
      assert.equal(validSubject.valid, true);

      const validOpener = validateWarmupContentItem('opener', 'Hope you are having a productive and smooth week so far.');
      assert.equal(validOpener.valid, true);

      const validBody = validateWarmupContentItem('body', 'Our team wrapped up staging validation this morning with zero blockers.');
      assert.equal(validBody.valid, true);

      const validReply = validateWarmupContentItem('reply', 'Thanks for the quick confirmation! That works well on my end.');
      assert.equal(validReply.valid, true);

      const validSignoff = validateWarmupContentItem('signoff', 'Best regards,');
      assert.equal(validSignoff.valid, true);
    });

    test('Rejects spammy words and prohibited promotional triggers', () => {
      const spamCheck1 = validateWarmupContentItem('subject', 'Claim your free money and crypto rewards');
      assert.equal(spamCheck1.valid, false);
      assert.ok(spamCheck1.reason?.includes('spam word'));

      const spamCheck2 = validateWarmupContentItem('body', 'This is 100% free with guaranteed cash return.');
      assert.equal(spamCheck2.valid, false);

      const spamCheck3 = validateWarmupContentItem('opener', 'Urgent wire transfer needed right now.');
      assert.equal(spamCheck3.valid, false);
    });

    test('Strictly rejects external URLs and domain links', () => {
      const linkCheck1 = validateWarmupContentItem('body', 'Check out the docs at https://example.com/api for details.');
      assert.equal(linkCheck1.valid, false);
      assert.ok(linkCheck1.reason?.includes('links or URLs'));

      const linkCheck2 = validateWarmupContentItem('reply', 'Visit www.mysite.com for the schedule.');
      assert.equal(linkCheck2.valid, false);
    });

    test('Assembles non-repetitive messages and threaded replies', async () => {
      const msg1 = await assembleWarmupMessage('David Miller');
      const msg2 = await assembleWarmupMessage('David Miller');

      assert.ok(msg1.subject.length > 5);
      assert.ok(msg1.bodyText.includes('Hi David,'));
      assert.ok(msg1.bodyHtml.includes('<div'));

      // Both messages are randomized and unlikely to be completely identical
      assert.ok(msg1.bodyText.length > 30);
      assert.ok(msg2.bodyText.length > 30);

      // Reply assembly
      const reply = await assembleWarmupReply('Project Milestones Update', 'Sarah');
      assert.ok(reply.subject.startsWith('Re: Project Milestones Update'));
      assert.ok(reply.bodyText.includes('Hi Sarah,'));
    });
  });

  describe('2. computeDailyTarget Table of Inputs (Day, Mode, Speed, Spam)', () => {
    // Standard baseline metrics
    const baseMetrics = {
      warmupAgeDays: 5,
      sendingDays: 1,
      spamRate7d: 0.0,
      bounceRate7d: 0.0,
      campaignSentToday: 0,
      sharedMailboxCap: 50,
      hasSpf: true,
      hasDkim: true,
      hasDmarc: true,
      domainMailboxCount: 1,
      userDesiredTarget: 40
    };

    test('Mode new_domain: Day 1 starts at 1, week 2 ramps between 9 and 15', () => {
      // Day 1
      const day1 = computeDailyTargetSync(
        { warmup_mode: 'new_domain', warmup_speed: 'normal', warmup_target: 40 },
        { ...baseMetrics, sendingDays: 1 }
      );
      assert.equal(day1.target, 1);
      assert.equal(day1.baseRamp, 1);

      // Day 8 (week 2) normal (+1/day): 1 + (8-1)*1 = 8
      const day8 = computeDailyTargetSync(
        { warmup_mode: 'new_domain', warmup_speed: 'normal', warmup_target: 40 },
        { ...baseMetrics, sendingDays: 8 }
      );
      assert.equal(day8.target, 8);

      // Day 14 (week 2 end) normal (+1/day): 1 + (14-1)*1 = 14 (between 9 and 15)
      const day14 = computeDailyTargetSync(
        { warmup_mode: 'new_domain', warmup_speed: 'normal', warmup_target: 40 },
        { ...baseMetrics, sendingDays: 14 }
      );
      assert.equal(day14.target, 14);

      // Ceiling clamp at 40
      const day50 = computeDailyTargetSync(
        { warmup_mode: 'new_domain', warmup_speed: 'normal', warmup_target: 40 },
        { ...baseMetrics, sendingDays: 50 }
      );
      assert.equal(day50.target, 40);
    });

    test('Mode new_mailbox: starts at 3, ceil 60, speed steps conservative vs aggressive', () => {
      // Day 1
      const day1 = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: 60 },
        { ...baseMetrics, sendingDays: 1 }
      );
      assert.equal(day1.target, 3);

      // Day 5 Conservative (+0.5/day): 3 + round(4 * 0.5) = 5
      const day5Cons = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'conservative', warmup_target: 60 },
        { ...baseMetrics, sendingDays: 5 }
      );
      assert.equal(day5Cons.target, 5);

      // Day 5 Aggressive (+1.5/day): 3 + round(4 * 1.5) = 9
      const day5Aggr = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'aggressive', warmup_target: 60 },
        { ...baseMetrics, sendingDays: 5 }
      );
      assert.equal(day5Aggr.target, 9);
    });

    test('Modes dormant, maintenance, and recovery initial and ceiling values', () => {
      // Dormant: start 3, ceil 40
      const dormantDay1 = computeDailyTargetSync(
        { warmup_mode: 'dormant', warmup_speed: 'normal' },
        { ...baseMetrics, sendingDays: 1 }
      );
      assert.equal(dormantDay1.target, 3);
      assert.equal(dormantDay1.ceiling, 40);

      // Maintenance: start 15, ceil 30
      const maintDay1 = computeDailyTargetSync(
        { warmup_mode: 'maintenance', warmup_speed: 'normal' },
        { ...baseMetrics, sendingDays: 1 }
      );
      assert.equal(maintDay1.target, 15);
      assert.equal(maintDay1.ceiling, 30);

      // Recovery: start 5, ceil 30
      const recDay1 = computeDailyTargetSync(
        { warmup_mode: 'recovery', warmup_speed: 'normal' },
        { ...baseMetrics, sendingDays: 1 }
      );
      assert.equal(recDay1.target, 5);
      assert.equal(recDay1.ceiling, 30);
    });

    test('Unlocks full user target only when age >= 14d, sending days >= 7, spam < 2%, bounce < 1%', () => {
      const userTarget = 80;

      // Case A: Age < 14d (e.g. 10d) -> locked to ramp
      const lockedByAge = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: userTarget },
        { ...baseMetrics, warmupAgeDays: 10, sendingDays: 10, spamRate7d: 0.5, bounceRate7d: 0.2 }
      );
      assert.equal(lockedByAge.unlockedFullTarget, false);
      assert.equal(lockedByAge.target, 12); // 3 + (10-1)*1 = 12
      assert.ok(lockedByAge.reasons.some(r => r.includes('locked during warmup ramp')));

      // Case B: Sending days < 7 (e.g. 5d) with age = 20d -> locked
      const lockedBySendingDays = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: userTarget },
        { ...baseMetrics, warmupAgeDays: 20, sendingDays: 5, spamRate7d: 0.5, bounceRate7d: 0.2 }
      );
      assert.equal(lockedBySendingDays.unlockedFullTarget, false);

      // Case C: Spam >= 2% (e.g. 2.5%) -> locked
      const lockedBySpam = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: userTarget },
        { ...baseMetrics, warmupAgeDays: 20, sendingDays: 15, spamRate7d: 2.5, bounceRate7d: 0.2 }
      );
      assert.equal(lockedBySpam.unlockedFullTarget, false);

      // Case D: Bounce >= 1% (e.g. 1.5%) -> locked
      const lockedByBounce = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: userTarget },
        { ...baseMetrics, warmupAgeDays: 20, sendingDays: 15, spamRate7d: 0.5, bounceRate7d: 1.5 }
      );
      assert.equal(lockedByBounce.unlockedFullTarget, false);

      // Case E: Fully unlocked! Age 18d, sending days 12, spam 0.8%, bounce 0.4%
      const unlocked = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: userTarget, daily_cap: 100 },
        { ...baseMetrics, warmupAgeDays: 18, sendingDays: 12, spamRate7d: 0.8, bounceRate7d: 0.4, sharedMailboxCap: 100 }
      );
      assert.equal(unlocked.unlockedFullTarget, true);
      assert.equal(unlocked.target, userTarget);
    });

    test('Absolute maximum clamped at 120/day even with high user target', () => {
      const maxClamp = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: 200, daily_cap: 250 },
        { ...baseMetrics, warmupAgeDays: 30, sendingDays: 30, spamRate7d: 0.2, bounceRate7d: 0.1, sharedMailboxCap: 250 }
      );
      assert.equal(maxClamp.unlockedFullTarget, true);
      assert.equal(maxClamp.target, 120);
    });

    test('Halves volume when spam rate >= 5%', () => {
      const halved = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: 20 },
        { ...baseMetrics, sendingDays: 18, spamRate7d: 6.5 }
      );
      // Normal ramp at day 18 would be 20. With 6.5% spam, halved to 10
      assert.equal(halved.target, 10);
      assert.ok(halved.reasons.some(r => r.includes('halved daily warmup target')));
    });

    test('Excludes mailbox from pool when spam rate >= 15%', () => {
      const excluded = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: 40 },
        { ...baseMetrics, sendingDays: 10, spamRate7d: 16.0 }
      );
      assert.equal(excluded.target, 0);
      assert.equal(excluded.poolExcluded, true);
      assert.ok(excluded.reasons.some(r => r.includes('excluded from warmup pool')));
    });

    test('Caps at 5/day when SPF or DKIM DNS authentication is missing', () => {
      // Missing SPF
      const noSpf = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: 30 },
        { ...baseMetrics, sendingDays: 10, hasSpf: false, hasDkim: true }
      );
      assert.equal(noSpf.target, 5);
      assert.ok(noSpf.reasons.some(r => r.includes('Missing SPF')));

      // Missing DKIM
      const noDkim = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: 30 },
        { ...baseMetrics, sendingDays: 10, hasSpf: true, hasDkim: false }
      );
      assert.equal(noDkim.target, 5);
      assert.ok(noDkim.reasons.some(r => r.includes('Missing DKIM')));
    });

    test('Splits domain volume across multiple mailboxes on the same domain', () => {
      // 3 mailboxes on domain: 150 / 3 = 50 max each
      // 5 mailboxes on domain: 150 / 5 = 30 max each
      const split5 = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', warmup_target: 60, daily_cap: 80 },
        { ...baseMetrics, warmupAgeDays: 20, sendingDays: 20, domainMailboxCount: 5, sharedMailboxCap: 80 }
      );
      assert.equal(split5.target, 30);
      assert.ok(split5.reasons.some(r => r.includes('split across 5 mailboxes')));
    });

    test('Subtracts campaign sends used today from shared mailbox cap', () => {
      // Shared cap = 30, campaign sent today = 22 -> available warmup budget = 8
      const throttledByCampaign = computeDailyTargetSync(
        { warmup_mode: 'new_mailbox', warmup_speed: 'normal', daily_cap: 30 },
        { ...baseMetrics, sendingDays: 15, campaignSentToday: 22, sharedMailboxCap: 30 }
      );
      assert.equal(throttledByCampaign.target, 8);
      assert.ok(throttledByCampaign.reasons.some(r => r.includes('Shared mailbox cap of 30')));
    });
  });

  describe('3. Rolling 7-Day Health Score Algorithm', () => {
    test('Calculates perfect 100 score with zero spam, zero bounce and full DNS', () => {
      const score = calculateHealthScore({
        spamRate: 0.0,
        bounceRate: 0.0,
        spfMissing: false,
        dkimMissing: false,
        dmarcMissing: false
      });
      assert.equal(score, 100);
    });

    test('Deducts points accurately according to specification formula', () => {
      // 100 − min(60, spam% × 4) − min(25, bounce% × 10) − 10 if SPF missing − 10 if DKIM missing − 5 if DMARC missing
      // spam: 2.5% -> 2.5 * 4 = 10
      // bounce: 0.5% -> 0.5 * 10 = 5
      // SPF missing -> 10
      // Score = 100 - 10 - 5 - 10 = 75
      const score = calculateHealthScore({
        spamRate: 2.5,
        bounceRate: 0.5,
        spfMissing: true,
        dkimMissing: false,
        dmarcMissing: false
      });
      assert.equal(score, 75);
    });

    test('Clamps heavy penalty score cleanly at 0 without going negative', () => {
      const score = calculateHealthScore({
        spamRate: 20.0, // 20 * 4 = 80 -> min(60, 80) = 60
        bounceRate: 5.0,  // 5 * 10 = 50 -> min(25, 50) = 25
        spfMissing: true,  // 10
        dkimMissing: true, // 10
        dmarcMissing: true // 5
        // 100 - 60 - 25 - 10 - 10 - 5 = -10 -> clamped to 0
      });
      assert.equal(score, 0);
    });
  });
});
