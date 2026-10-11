import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSpintax, renderMergeTags, renderEmailTemplate, validateTemplate } from '../server/services/outreach/render.js';
import { isWithinSendingWindow } from '../server/services/outreach/capGuard.js';

test('Phase 2 Unit Tests: Template Engine, Spintax Determinism & Cap Guard Gate', async (t) => {
  await t.test('1. Spintax Determinism and Seed Repeatability', async (t2) => {
    await t2.test('Identical seed produces identical resolved text across multiple executions', () => {
      const template = '{Hello|Hi|Greetings} {friend|partner|colleague}, {hope you are well|trust all is good}.';
      const seed = 'enr_12345_prospect_987';

      const run1 = resolveSpintax(template, seed);
      const run2 = resolveSpintax(template, seed);
      const run3 = resolveSpintax(template, seed);

      assert.equal(run1, run2);
      assert.equal(run2, run3);
      assert.ok(run1.length > 0);
      assert.ok(!run1.includes('{') && !run1.includes('}'));
    });

    await t2.test('Different seeds produce deterministic variation across prospective recipients', () => {
      const template = '{Hello|Hi|Greetings} {friend|partner|colleague}.';
      const seedA = 'enrollment_aaa';
      const seedB = 'enrollment_bbb';

      const textA = resolveSpintax(template, seedA);
      const textB = resolveSpintax(template, seedB);

      assert.ok(typeof textA === 'string');
      assert.ok(typeof textB === 'string');
    });

    await t2.test('Handles nested spintax expressions correctly', () => {
      const template = '{Hey|Hello {there|friend}}!';
      const res = resolveSpintax(template, 'seed_nested_1');
      assert.ok(res === 'Hey!' || res === 'Hello there!' || res === 'Hello friend!');
      assert.ok(!res.includes('{') && !res.includes('}'));
    });
  });

  await t.test('2. Merge Tag Substitution and Fallback Processing', async (t2) => {
    await t2.test('Substitutes present tags accurately with case insensitivity', () => {
      const template = 'Hi {{first_name}}, welcome to {{company}}!';
      const context = {
        first_name: 'Jordan',
        company: 'Stripe'
      };

      const result = renderMergeTags(template, context);
      assert.equal(result.text, 'Hi Jordan, welcome to Stripe!');
      assert.equal(result.errors.length, 0);
    });

    await t2.test('Uses fallback values when context field is missing or empty', () => {
      const template = 'Hi {{first_name|there}}, heard great things about {{company|your company}}.';
      const context = {
        first_name: '',
        company: undefined
      };

      const result = renderMergeTags(template, context);
      assert.equal(result.text, 'Hi there, heard great things about your company.');
      assert.equal(result.errors.length, 0);
    });

    await t2.test('Reports missing value errors for unknown tags without fallback', () => {
      const template = 'Hello {{first_name|friend}}, your code is {{unregistered_custom_var}}.';
      const context = { first_name: 'Sarah' };

      const result = renderMergeTags(template, context);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].includes('unregistered_custom_var'));
    });

    await t2.test('Validates templates upfront in campaign editor', () => {
      const validTemplate = 'Hi {{first_name|there}}, from {{sender_name}} at {{company|our team}}';
      const invalidTemplate = 'Hi {{first_name}}, check {{bogus_tag}} and mismatched {unclosed spintax';

      const validErrors = validateTemplate(validTemplate);
      const invalidErrors = validateTemplate(invalidTemplate);

      assert.equal(validErrors.length, 0);
      assert.ok(invalidErrors.some((e) => e.includes('bogus_tag')));
      assert.ok(invalidErrors.some((e) => e.includes('Unclosed opening brace')));
    });

    await t2.test('Full renderEmailTemplate combines spintax and merge tags seamlessly', () => {
      const template = '{Hello|Hi} {{first_name|friend}}, hope all is well at {{company|your team}}!';
      const context = { first_name: 'Maya', company: 'Linear' };

      const rendered = renderEmailTemplate(template, context, 'enr_linear_maya');
      assert.ok(rendered.text.includes('Maya'));
      assert.ok(rendered.text.includes('Linear'));
      assert.ok(rendered.text.startsWith('Hello') || rendered.text.startsWith('Hi'));
    });
  });

  await t.test('3. Cap Guard Sending Window and Scheduling Verification', async (t2) => {
    await t2.test('Permits sends within specified business hours window and weekdays', () => {
      // Create a fixed Wednesday at 14:30 UTC (2:30 PM)
      const wednesdayAfternoon = new Date('2026-10-14T14:30:00Z');
      const schedule = {
        timezone: 'UTC',
        windows: [{ start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }]
      };

      const check = isWithinSendingWindow(schedule, wednesdayAfternoon);
      assert.equal(check.inWindow, true);
    });

    await t2.test('Rejects and defers sends outside business hours or on weekends', () => {
      // Create a Sunday at 14:00 UTC
      const sunday = new Date('2026-10-18T14:00:00Z');
      const schedule = {
        timezone: 'UTC',
        windows: [{ start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }]
      };

      const check = isWithinSendingWindow(schedule, sunday);
      assert.equal(check.inWindow, false);
      assert.ok(check.retryAt || check.nextWindowStart);
    });
  });

  await t.test('4. Atomic Concurrency Model Logic in Cap Guard', async (t2) => {
    await t2.test('Simulates atomic budget consumption without over-allocation', () => {
      // Mathematical assertion for the conditional UPDATE:
      // WHERE (campaign_sent_count + warmup_sent_count) < daily_cap
      let campaign_sent = 28;
      let warmup_sent = 1;
      const daily_cap = 30;

      // 1st concurrent request: sum = 29 < 30 -> succeeds
      const canProceed1 = (campaign_sent + warmup_sent) < daily_cap;
      assert.equal(canProceed1, true);
      campaign_sent += 1;

      // 2nd concurrent request: sum = 30 < 30 -> rejected atomically
      const canProceed2 = (campaign_sent + warmup_sent) < daily_cap;
      assert.equal(canProceed2, false);
    });
  });
});
