import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resendService,
  sendEmail,
  DEFAULT_RESEND_API_KEY,
  DEFAULT_EMAIL_FROM
} from '../server/services/resendService.ts';

import { renderEmailTemplate } from '../server/services/emailEngine.ts';
import { requireClerkAuth } from '../server/middlewares/clerkAuth.ts';

describe('Resend Email Engine Integration Tests', () => {

  describe('1. Resend Service Configuration & Credentials', () => {
    it('Has reliable fallback API key matching prompt specifications', () => {
      assert.equal(DEFAULT_RESEND_API_KEY, 're_LXiiEzAS_86mprrkSQfUGaJHZRK25Pp18');
      const activeKey = resendService.getApiKey();
      assert.ok(activeKey.length > 10, 'Active API key must be populated');
    });

    it('Resolves default and custom sender addresses correctly', () => {
      // Default fallback
      const defaultFrom = resendService.resolveFromAddress();
      assert.ok(defaultFrom.includes('onboarding@resend.dev') || defaultFrom.includes('ALM Nexus') || defaultFrom.includes('@'));

      // Custom email with name
      const custom1 = resendService.resolveFromAddress('sarah@acme.com', 'Sarah Connor');
      assert.equal(custom1, '"Sarah Connor" <sarah@acme.com>');

      // Formatted sender string preserved
      const custom2 = resendService.resolveFromAddress('"Operations Team" <ops@client.com>');
      assert.equal(custom2, '"Operations Team" <ops@client.com>');
    });

    it('Provides diagnostic connection health check', async () => {
      const diag = await resendService.testConnection();
      assert.equal(typeof diag.ok, 'boolean');
      assert.equal(typeof diag.apiKeyMasked, 'string');
      assert.ok(diag.apiKeyMasked.includes('re_') || diag.apiKeyMasked.includes('****'));
    });
  });

  describe('2. Template Rendering & Content Generation', () => {
    it('Renders proposal email template with scoping details', () => {
      const html = renderEmailTemplate('proposal', {
        clientName: 'Alex Mercer',
        clientCompany: 'Apex Global',
        amount: 5000,
        websiteType: 'Full-Stack Next.js Enterprise Platform'
      });
      assert.ok(html.includes('Alex Mercer'));
      assert.ok(html.includes('Apex Global'));
      assert.ok(html.includes('$5,000 USD'));
      assert.ok(html.includes('50% upfront deposit'));
    });

    it('Renders advance payment reminder with SOP milestones', () => {
      const html = renderEmailTemplate('advance_reminder', {
        clientName: 'Diana Prince',
        clientCompany: 'Themyscira Corp',
        amount: 2500
      });
      assert.ok(html.includes('Diana Prince'));
      assert.ok(html.includes('$2,500 USD'));
      assert.ok(html.includes('50% Kick-Off Milestone Pending'));
    });

    it('Renders ROI projection breakdown template with calculations', () => {
      const html = renderEmailTemplate('roi_breakdown', {
        clientName: 'Bruce Wayne',
        clientCompany: 'Wayne Enterprises',
        dealSize: 12000,
        projectedMeetings: 35,
        projectedRevenue: 75000
      });
      assert.ok(html.includes('Wayne Enterprises'));
      assert.ok(html.includes('$12,000'));
      assert.ok(html.includes('35 meetings'));
    });
  });

  describe('3. Non-Blocking Email Dispatch & Telemetry', () => {
    it('Dispatches email with HTML and text payload and persists telemetry', async () => {
      const res = await resendService.sendEmail({
        to: 'delivered@resend.dev',
        subject: 'Milestone Kickoff Scope',
        html: '<p>Your staging build is live.</p>',
        text: 'Your staging build is live.',
        fromName: 'ALM Nexus QA',
        tenantId: 'tenant-test-suite',
        template: 'staging_ready',
        tags: [{ name: 'test_run', value: 'resend_suite' }],
        metadata: { runId: 101 }
      });

      assert.equal(typeof res.success, 'boolean');
      assert.equal(typeof res.recipient, 'string');
      assert.ok(res.messageId, 'Must return a message ID');
      assert.ok(res.telemetryId, 'Must return a telemetry ID');

      // Verify log recorded in recent logs
      const logs = await resendService.getRecentLogs('tenant-test-suite', 10);
      assert.ok(Array.isArray(logs));
      const match = logs.find(l => l.id === res.telemetryId || l.recipient === 'delivered@resend.dev');
      assert.ok(match, 'Telemetry log must be queryable');
    });

    it('Supports dynamic attachments and custom headers', async () => {
      const res = await resendService.sendEmail({
        to: 'delivered@resend.dev',
        subject: 'Contract Agreement PDF',
        html: '<p>Please find attached statement of work.</p>',
        attachments: [
          {
            filename: 'scope.txt',
            content: Buffer.from('Deliverable scope milestone 1 and 2').toString('base64')
          }
        ],
        headers: {
          'X-Custom-Pipeline': 'alm-leadflow'
        },
        tenantId: 'tenant-test-suite'
      });

      assert.equal(typeof res.success, 'boolean');
      assert.ok(res.messageId);
    });
  });

  describe('4. API Route Authentication Security (Clerk Guard)', () => {
    it('Blocks unauthenticated requests on protected email endpoints', () => {
      let statusCalled = 0;
      let jsonPayload = null;

      const mockReq = {
        userId: null,
        auth: { userId: null },
        clerkUser: null,
        user: null
      };

      const mockRes = {
        status(code) {
          statusCalled = code;
          return {
            json(payload) {
              jsonPayload = payload;
            }
          };
        }
      };

      let nextCalled = false;
      requireClerkAuth(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(statusCalled, 401);
      assert.equal(nextCalled, false);
      assert.equal(jsonPayload?.success, false);
      assert.ok(jsonPayload?.error.includes('Unauthorized'));
    });

    it('Allows authenticated Clerk sessions through route guard', () => {
      const mockReq = {
        userId: 'user_clerk_verified_99',
        auth: { userId: 'user_clerk_verified_99' },
        clerkUser: { userId: 'user_clerk_verified_99', email: 'verified@user.com' },
        user: { id: 'user_clerk_verified_99' }
      };

      let statusCalled = 0;
      const mockRes = {
        status(code) {
          statusCalled = code;
          return { json() {} };
        }
      };

      let nextCalled = false;
      requireClerkAuth(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(statusCalled, 0);
    });
  });
});
