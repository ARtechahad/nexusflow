import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Setup test environment
const TEST_KEY_BYTES = crypto.randomBytes(32);
process.env.ENCRYPTION_KEY = TEST_KEY_BYTES.toString('base64');
process.env.NODE_ENV = 'test';

// Import Phase 3 modules under test
import {
  signToken,
  verifyToken
} from '../server/services/outreach/crypto.ts';

import {
  isDsnBounceMessage,
  isAutoReplyMessage,
  processInboundEmail
} from '../server/services/outreach/inboxSync.ts';

import {
  classifyReplyWithRules,
  classifyInboundReply
} from '../server/services/outreach/classifier.ts';

import {
  isSuspectedBotUserAgent
} from '../server/routes/outreach/tracking.ts';

describe('Phase 3: Telemetry, Tracking, DSN Bounce Parsing & Inbox Classification Tests', () => {

  describe('1. Token Cryptography & Verification', () => {
    test('Signs and verifies open tracking token with metadata payload', () => {
      const payload = {
        tenantId: 'tenant-alm-nexus',
        campaignId: 'camp_101',
        enrollmentId: 'enr_202',
        sentEmailId: 'sent_303',
        email: 'prospect@acmecorp.com',
        type: 'open'
      };

      const token = signToken(payload, 3600);
      assert.ok(typeof token === 'string');
      assert.ok(token.length > 30);

      const verified = verifyToken(token);
      assert.equal(verified.valid, true);
      assert.equal(verified.payload.tenantId, 'tenant-alm-nexus');
      assert.equal(verified.payload.sentEmailId, 'sent_303');
      assert.equal(verified.payload.email, 'prospect@acmecorp.com');
      assert.equal(verified.payload.type, 'open');
    });

    test('Signs and verifies click tracking token with original target URL', () => {
      const payload = {
        tenantId: 'tenant-alm-nexus',
        campaignId: 'camp_101',
        sentEmailId: 'sent_303',
        url: 'https://leadflow.ai/case-studies/fintech',
        type: 'click'
      };

      const token = signToken(payload);
      const verified = verifyToken(token);

      assert.equal(verified.valid, true);
      assert.equal(verified.payload.url, 'https://leadflow.ai/case-studies/fintech');
      assert.equal(verified.payload.type, 'click');
    });

    test('Rejects tampered tracking token signatures', () => {
      const payload = { tenantId: 'tenant-alm-nexus', email: 'user@test.com' };
      const token = signToken(payload);

      // Tamper with the token string
      const parts = token.split('.');
      const tampered = `${parts[0]}xyz.${parts[1]}`;

      const verified = verifyToken(tampered);
      assert.equal(verified.valid, false);
      assert.ok(!verified.payload);
      assert.ok(verified.error);
    });

    test('Rejects expired tracking tokens', () => {
      const token = signToken({ tenantId: 'tenant-alm-nexus', email: 'fast@expire.com' }, -10);
      const verified = verifyToken(token);
      assert.equal(verified.valid, false);
      assert.equal(verified.expired, true);
      assert.match(verified.error, /expired/i);
    });
  });

  describe('2. Open-Redirect Abuse Prevention & URL Validation', () => {
    function validateTargetUrl(targetUrl) {
      if (!targetUrl || typeof targetUrl !== 'string') {
        return { valid: false, error: 'Missing target URL' };
      }
      let parsed;
      try {
        parsed = new URL(targetUrl);
      } catch {
        return { valid: false, error: 'Malformed target URL' };
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, error: 'Disallowed redirect protocol' };
      }
      return { valid: true, url: parsed.toString() };
    }

    test('Accepts valid HTTPS and HTTP destination URLs', () => {
      assert.equal(validateTargetUrl('https://example.com/pricing').valid, true);
      assert.equal(validateTargetUrl('http://subdomain.company.org/demo?ref=email').valid, true);
    });

    test('Rejects dangerous javascript:, data:, and file: protocols', () => {
      assert.equal(validateTargetUrl('javascript:alert(document.cookie)').valid, false);
      assert.equal(validateTargetUrl('data:text/html,<script>steal()</script>').valid, false);
      assert.equal(validateTargetUrl('file:///etc/passwd').valid, false);
      assert.equal(validateTargetUrl('ftp://ftp.example.com/files').valid, false);
    });

    test('Rejects relative and malformed paths without protocol', () => {
      assert.equal(validateTargetUrl('/attacker-site.com').valid, false);
      assert.equal(validateTargetUrl('//attacker-site.com/exploit').valid, false);
      assert.equal(validateTargetUrl('not-a-valid-url').valid, false);
    });
  });

  describe('3. Telemetry Bot & Image-Proxy Detection', () => {
    test('Identifies Google Image Proxy and bot user agents', () => {
      assert.equal(isSuspectedBotUserAgent('GoogleImageProxy'), true);
      assert.equal(isSuspectedBotUserAgent('Mozilla/5.0 (Windows NT 10.0) YahooMailProxy'), true);
      assert.equal(isSuspectedBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
      assert.equal(isSuspectedBotUserAgent('curl/8.1.2'), true);
      assert.equal(isSuspectedBotUserAgent('python-requests/2.31.0'), true);
    });

    test('Identifies legitimate human browser user agents', () => {
      const chromeUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const safariUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
      assert.equal(isSuspectedBotUserAgent(chromeUA), false);
      assert.equal(isSuspectedBotUserAgent(safariUA), false);
    });
  });

  describe('4. DSN & Bounce Parsing with Sample Fixtures', () => {
    test('Fixture 1: Postfix RFC 3464 Delivery Status Notification (Permanent 5.1.1 Failure)', () => {
      const headers = {
        'content-type': 'multipart/report; report-type=delivery-status; boundary="boundary_123"',
        from: 'Mail Delivery System <MAILER-DAEMON@mail.example.com>',
        subject: 'Undelivered Mail Returned to Sender'
      };

      const bodyText = `This is the mail system at host mail.example.com.

I'm sorry to have to inform you that your message could not
be delivered to one or more recipients. It's attached below.

<nonexistent-ceo-user@targetcorp.com>: host aspmx.l.google.com[142.250.153.26] said:
    550-5.1.1 The email account that you tried to reach does not exist. Please try
    550-5.1.1 double-checking the recipient's email address for typos or
    550-5.1.1 unnecessary spaces. Learn more at
    550 5.1.1  https://support.google.com/mail/?p=NoSuchUser

Final-Recipient: rfc822; nonexistent-ceo-user@targetcorp.com
Action: failed
Status: 5.1.1
Diagnostic-Code: smtp; 550-5.1.1 The email account that you tried to reach does not exist.`;

      const result = isDsnBounceMessage(headers, headers.subject, headers.from, bodyText);

      assert.equal(result.isBounce, true);
      assert.equal(result.isHardBounce, true);
      assert.equal(result.bouncedEmail, 'nonexistent-ceo-user@targetcorp.com');
    });

    test('Fixture 2: Google Mail Delivery Subsystem Bounce Notification', () => {
      const headers = {
        'content-type': 'multipart/mixed; boundary="gmail_bound"',
        from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
        subject: 'Delivery Status Notification (Failure)'
      };

      const bodyText = `** Address not found **

Your message wasn't delivered to fake_lead_999@enterprise-cloud.io because the address couldn't be found, or is unable to receive mail.

The response from the remote server was:
550 5.1.1 User unknown

Original-Recipient: rfc822; fake_lead_999@enterprise-cloud.io`;

      const result = isDsnBounceMessage(headers, headers.subject, headers.from, bodyText);

      assert.equal(result.isBounce, true);
      assert.equal(result.isHardBounce, true);
      assert.equal(result.bouncedEmail, 'fake_lead_999@enterprise-cloud.io');
    });

    test('Fixture 3: Soft Bounce / Temporary Mailbox Full (4.2.2)', () => {
      const headers = {
        'content-type': 'multipart/report',
        from: 'postmaster@exchange.corp.net',
        subject: 'Delivery delayed: Temporary delivery failure'
      };

      const bodyText = `Delivery delayed to recipient alex@busyteam.com.
Action: delayed
Status: 4.2.2 (Mailbox full - temporary condition)`;

      const result = isDsnBounceMessage(headers, headers.subject, headers.from, bodyText);

      assert.equal(result.isBounce, true);
      assert.equal(result.isHardBounce, false);
    });

    test('Fixture 4: Normal human response is NOT classified as a bounce', () => {
      const headers = {
        'content-type': 'text/plain',
        from: 'sarah.connor@cyberdyne.com',
        subject: 'Re: Quick inquiry regarding your development backlog'
      };

      const bodyText = 'Hi Jordan, thanks for reaching out. Yes, we would be open to a 15-minute chat next week.';

      const result = isDsnBounceMessage(headers, headers.subject, headers.from, bodyText);

      assert.equal(result.isBounce, false);
      assert.equal(result.isHardBounce, false);
    });
  });

  describe('5. Auto-Reply & Out-of-Office Detection', () => {
    test('Detects standard Auto-Submitted: auto-replied RFC 3834 header', () => {
      const headers = {
        'auto-submitted': 'auto-replied',
        from: 'vacationer@acme.com',
        subject: 'Automatic reply: Away on leave'
      };
      assert.equal(isAutoReplyMessage(headers, headers.subject, 'I am out until Monday.'), true);
    });

    test('Detects X-Autoreply: yes header', () => {
      const headers = {
        'x-autoreply': 'yes',
        subject: 'Out of office response'
      };
      assert.equal(isAutoReplyMessage(headers, headers.subject, ''), true);
    });

    test('Detects out-of-office phrasing in subject line', () => {
      const headers = {};
      assert.equal(isAutoReplyMessage(headers, 'Out of office: Marcus Vance', 'Away from keyboard'), true);
      assert.equal(isAutoReplyMessage(headers, 'Automatic reply: Project status', ''), true);
    });

    test('Does not flag normal prospect inquiries as auto-replies', () => {
      const headers = {
        from: 'cto@startup.io',
        subject: 'Re: Cold outreach proposal'
      };
      const body = 'Thanks for the email. What are your pricing plans?';
      assert.equal(isAutoReplyMessage(headers, headers.subject, body), false);
    });
  });

  describe('6. Warmup Tag Isolation', () => {
    test('processInboundEmail ignores messages carrying X-Warmup-Tag', async () => {
      const dummyMailbox = {
        id: 'mbx_1',
        email: 'sender@leadflow.ai',
        tenant_id: 'tenant-alm-nexus'
      };

      const mockParsedMail = {
        headers: new Map([['x-warmup-tag', 'peer_pool_99']]),
        subject: 'Network verification check',
        from: { value: [{ address: 'peer@warmup-network.org' }] },
        text: 'Automated warmup exchange message'
      };

      const result = await processInboundEmail(mockParsedMail, dummyMailbox, null);
      assert.equal(result.handled, true);
      assert.equal(result.type, 'warmup_ignored');
    });

    test('processInboundEmail ignores messages with __WARMUP_TOKEN_ in subject', async () => {
      const dummyMailbox = { id: 'mbx_1', email: 'sender@leadflow.ai', tenant_id: 'tenant-alm-nexus' };
      const mockParsedMail = {
        headers: new Map(),
        subject: 'Verification __WARMUP_TOKEN_xyz123',
        from: { value: [{ address: 'node@warmup.org' }] },
        text: 'Warmup content'
      };

      const result = await processInboundEmail(mockParsedMail, dummyMailbox, null);
      assert.equal(result.handled, true);
      assert.equal(result.type, 'warmup_ignored');
    });
  });

  describe('7. Reply Classification Engine (Rules & Categorization)', () => {
    test('Classifies explicit unsubscribe / opt-out requests', () => {
      const bodies = [
        'Please unsubscribe me from your emails.',
        'Remove me from your mailing list immediately.',
        'Stop emailing me, do not contact again.',
        'Please take me off your contact list.'
      ];

      for (const body of bodies) {
        const res = classifyReplyWithRules(body, 'Re: Outreach');
        assert.equal(res.label, 'unsubscribe', `Expected unsubscribe for: "${body}"`);
        assert.ok(res.confidence >= 0.9);
      }
    });

    test('Classifies positive interested / meeting requests', () => {
      const bodies = [
        'Sounds great! Let us chat next Tuesday afternoon.',
        'I am interested in seeing a demo. Can you send over a calendar link?',
        'Sounds interesting. Let us hop on a quick call this week.',
        'Send over your pricing deck and case studies.'
      ];

      for (const body of bodies) {
        const res = classifyReplyWithRules(body, 'Re: Outreach');
        assert.equal(res.label, 'interested', `Expected interested for: "${body}"`);
      }
    });

    test('Classifies questions and pricing inquiries', () => {
      const bodies = [
        'How much does your service cost per month?',
        'Do you support custom CRM integrations with HubSpot?',
        'What is your delivery timeline for a 10-page portal?'
      ];

      for (const body of bodies) {
        const res = classifyReplyWithRules(body, 'Re: Cold email');
        assert.equal(res.label, 'question', `Expected question for: "${body}"`);
      }
    });

    test('Classifies polite and hard declines as not_interested', () => {
      const bodies = [
        'Not interested at this time, thank you.',
        'We already have an in-house development team and are not looking.',
        'No thanks, we will pass on this.'
      ];

      for (const body of bodies) {
        const res = classifyReplyWithRules(body, 'Re: Collaboration');
        assert.equal(res.label, 'not_interested', `Expected not_interested for: "${body}"`);
      }
    });

    test('Classifies wrong person / colleague referrals', () => {
      const bodies = [
        'I am the wrong person for this. You should reach out to Dave in Marketing.',
        'I no longer work at this company. Please contact contact@company.com instead.',
        'Not the right contact for engineering decisions, looping in Sarah.'
      ];

      for (const body of bodies) {
        const res = classifyReplyWithRules(body, 'Re: Outreach');
        assert.equal(res.label, 'wrong_person', `Expected wrong_person for: "${body}"`);
      }
    });

    test('Classifies out of office absence messages', () => {
      const bodies = [
        'I am currently out of the office on annual leave returning next Monday.',
        'Away from my desk until October 20th with limited email access.'
      ];

      for (const body of bodies) {
        const res = classifyReplyWithRules(body, 'Automatic reply: Out of office');
        assert.equal(res.label, 'out_of_office', `Expected out_of_office for: "${body}"`);
      }
    });
  });

  describe('8. Link Rewriting & Pixel Injection Safety Guarantees', () => {
    test('Rewrites standard HTTP/HTTPS links into signed tracking redirect URLs', () => {
      const originalHtml = '<p>Check out our <a href="https://mysite.com/pricing">pricing plans</a> and <a href="https://mysite.com/demo">live demo</a>.</p>';
      const trackingBase = 'https://track.mycompany.com';

      const rewritten = originalHtml.replace(
        /<a\s+([^>]*?)href=(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi,
        (match, prefix, quote, url, suffix) => {
          if (url.includes('/api/outreach/u/')) return match;
          const token = signToken({ url, type: 'click' });
          return `<a ${prefix}href="${trackingBase}/api/outreach/t/c/${token}"${suffix}>`;
        }
      );

      assert.ok(rewritten.includes(`${trackingBase}/api/outreach/t/c/`));
      assert.ok(!rewritten.includes('href="https://mysite.com/pricing"'));

      // Extract the generated token and verify it contains the original destination URL
      const match = rewritten.match(/\/api\/outreach\/t\/c\/([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/);
      assert.ok(match);
      const verified = verifyToken(match[1]);
      assert.equal(verified.valid, true);
      assert.equal(verified.payload.url, 'https://mysite.com/pricing');
    });

    test('Does not rewrite unsubscribe URLs to prevent double-hop redirects', () => {
      const unsubUrl = 'https://app.com/api/outreach/u/unsub_token_123';
      const html = `<p>Click here to <a href="${unsubUrl}">unsubscribe</a>.</p>`;

      const rewritten = html.replace(
        /<a\s+([^>]*?)href=(["'])(https?:\/\/[^"']+)\2([^>]*)>/gi,
        (match, prefix, quote, url, suffix) => {
          if (url.includes('/api/outreach/u/')) return match;
          return `<a ${prefix}href="https://track.com/t/c/token"${suffix}>`;
        }
      );

      assert.equal(rewritten, html);
    });

    test('Appends 1x1 transparent GIF tracking pixel with signed token', () => {
      let bodyHtml = '<p>Hello friend!</p>';
      const openToken = signToken({ sentEmailId: 'sent_777', type: 'open' });
      const pixelUrl = `https://track.agency.com/api/outreach/t/o/${openToken}.gif`;
      bodyHtml += `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:none;" />`;

      assert.ok(bodyHtml.includes('/api/outreach/t/o/'));
      assert.ok(bodyHtml.endsWith('.gif" alt="" width="1" height="1" style="display:none;" />'));

      const verified = verifyToken(openToken);
      assert.equal(verified.valid, true);
      assert.equal(verified.payload.sentEmailId, 'sent_777');
    });
  });

});
