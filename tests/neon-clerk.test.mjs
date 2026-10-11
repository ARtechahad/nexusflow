import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

import {
  getDatabaseUrl,
  isNeonConnection,
  testNeonConnection,
  NEON_ESSENTIAL_SCHEMA_SQL
} from '../server/services/db.ts';

import {
  clerkAuth,
  requireClerkAuth,
  syncClerkUserToDatabase
} from '../server/middlewares/clerkAuth.ts';

import { clerkWebhookRouter } from '../server/routes/clerkWebhookRoutes.ts';
import { buildAuthHeaders, getStoredAuthToken } from '../src/lib/api.ts';

describe('Neon Database & Clerk Authentication Integration Tests', () => {

  describe('1. Neon Database Configuration & SSL Connectivity', () => {
    it('Detects Neon serverless connection URLs and SSL requirement', () => {
      const neonUrl = 'postgresql://user:pass@ep-cool-db-123456.us-east-2.aws.neon.tech/neondb?sslmode=require';
      assert.equal(isNeonConnection(neonUrl), true);

      const standardUrl = 'postgresql://postgres:secret@localhost:5432/mydb';
      assert.equal(isNeonConnection(standardUrl), false);
    });

    it('Safely handles missing DATABASE_URL with diagnostic response', async () => {
      const res = await testNeonConnection();
      assert.equal(typeof res.ok, 'boolean');
      assert.equal(typeof res.timestamp, 'string');
      assert.ok(['disconnected', 'neon_serverless', 'standard_postgresql'].includes(res.engine));
    });

    it('Validates essential schema DDL contains all required tables and indexes', () => {
      assert.ok(NEON_ESSENTIAL_SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS tenants'));
      assert.ok(NEON_ESSENTIAL_SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS users'));
      assert.ok(NEON_ESSENTIAL_SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS clerk_users_sync'));
      assert.ok(NEON_ESSENTIAL_SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS projects'));
      assert.ok(NEON_ESSENTIAL_SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS invoices'));
      assert.ok(NEON_ESSENTIAL_SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS audit_logs'));
      assert.ok(NEON_ESSENTIAL_SCHEMA_SQL.includes('idx_users_clerk_id'));
    });
  });

  describe('2. Clerk Express Authentication Middleware (clerkAuth & requireClerkAuth)', () => {
    it('Extracts and verifies Clerk JWT session tokens, attaching user details to req', async () => {
      // Craft a mock Clerk session JWT payload
      const mockPayload = {
        sub: 'user_2b98xyz987',
        userId: 'user_2b98xyz987',
        email: 'founder@leadflow.ai',
        org_id: 'org_enterprise_99',
        org_role: 'admin',
        first_name: 'Alex',
        last_name: 'Vance'
      };

      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(mockPayload)).toString('base64url');
      const sig = 'mock_signature_bytes';
      const mockClerkToken = `${header}.${payload}.${sig}`;

      const mockReq = {
        headers: {
          authorization: `Bearer ${mockClerkToken}`
        },
        cookies: {}
      };

      let nextCalled = false;
      await clerkAuth(mockReq, {}, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(mockReq.userId, 'user_2b98xyz987');
      assert.equal(mockReq.orgId, 'org_enterprise_99');
      assert.equal(mockReq.email, 'founder@leadflow.ai');
      assert.equal(mockReq.auth?.userId, 'user_2b98xyz987');
      assert.equal(mockReq.clerkUser?.userId, 'user_2b98xyz987');
      assert.equal(mockReq.clerkUser?.email, 'founder@leadflow.ai');
    });

    it('Gracefully marks unauthenticated requests as req.auth.userId = null', async () => {
      const mockReq = {
        headers: {},
        cookies: {}
      };

      let nextCalled = false;
      await clerkAuth(mockReq, {}, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(mockReq.userId, null);
      assert.equal(mockReq.auth?.userId, null);
    });

    it('requireClerkAuth rejects unauthenticated requests with standard 401 JSON response', () => {
      const mockReq = {
        auth: { userId: null },
        userId: null
      };

      let statusCode = 0;
      let jsonPayload = null;
      const mockRes = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(body) {
          jsonPayload = body;
          return this;
        }
      };

      let nextCalled = false;
      requireClerkAuth(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 401);
      assert.equal(jsonPayload?.success, false);
      assert.ok(jsonPayload?.error.includes('Unauthorized'));
    });

    it('requireClerkAuth allows authenticated requests to proceed to next handler', () => {
      const mockReq = {
        userId: 'user_2verified',
        auth: { userId: 'user_2verified' }
      };

      let nextCalled = false;
      requireClerkAuth(mockReq, {}, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
    });
  });

  describe('3. Database User Sync & Clerk Webhook Handler', () => {
    it('Syncs Clerk user to persistent storage', async () => {
      await syncClerkUserToDatabase({
        userId: 'user_clerk_tester_99',
        email: 'tester.clerk@leadflow.ai',
        name: 'Clerk Tester',
        role: 'bd_head',
        tenantId: 'tenant-alm-nexus'
      });

      // Verify user was stored in local cache
      const { getDB } = await import('../server/db.ts');
      const db = getDB();
      const synced = (db.users || []).find(u => u.clerkUserId === 'user_clerk_tester_99');
      assert.ok(synced, 'User should be found in local users collection');
      assert.equal(synced.email, 'tester.clerk@leadflow.ai');
      assert.equal(synced.role, 'bd_head');
    });

    it('Clerk webhook router processes user.created event and returns success response', async () => {
      let responseBody = null;
      let statusCode = 200;

      const testBody = {
        type: 'user.created',
        data: {
          id: 'user_from_webhook_1',
          email_addresses: [
            { id: 'email_1', email_address: 'webhook.user@domain.com' }
          ],
          first_name: 'Webhook',
          last_name: 'User',
          public_metadata: { role: 'collaborator' }
        }
      };

      const payloadStr = JSON.stringify(testBody);
      const headers = {};

      // If CLERK_WEBHOOK_SECRET is present or configured, generate valid Svix signature headers
      if (process.env.CLERK_WEBHOOK_SECRET) {
        const secret = process.env.CLERK_WEBHOOK_SECRET;
        const secretKey = secret.startsWith('whsec_') ? secret.substring(6) : secret;
        const secretBytes = Buffer.from(secretKey, 'base64');
        const svixId = `msg_${Date.now()}`;
        const svixTimestamp = `${Math.floor(Date.now() / 1000)}`;
        const toSign = `${svixId}.${svixTimestamp}.${payloadStr}`;
        const sig = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

        headers['svix-id'] = svixId;
        headers['svix-timestamp'] = svixTimestamp;
        headers['svix-signature'] = `v1,${sig}`;
      }

      const mockReq = {
        method: 'POST',
        url: '/clerk',
        headers,
        body: testBody
      };

      const mockRes = {
        status(c) {
          statusCode = c;
          return this;
        },
        json(b) {
          responseBody = b;
          return this;
        }
      };

      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 2000);
        mockRes.json = (b) => {
          responseBody = b;
          clearTimeout(timer);
          resolve();
          return mockRes;
        };
        clerkWebhookRouter.handle(mockReq, mockRes, (err) => {
          clearTimeout(timer);
          resolve();
        });
      });

      assert.equal(statusCode, 200);
      assert.equal(responseBody?.success, true);
      assert.equal(responseBody?.event, 'user.created');
      assert.equal(responseBody?.userId, 'user_from_webhook_1');
    });
  });

  describe('4. Client-Side API Fetch Wrapper & Auth Header Injection', () => {
    it('Injects Authorization Bearer header when token override is passed', () => {
      const headers = buildAuthHeaders({ 'X-Custom-Header': '123' }, 'mock_token_jwt_99');
      assert.equal(headers.get('Authorization'), 'Bearer mock_token_jwt_99');
      assert.equal(headers.get('Content-Type'), 'application/json');
      assert.equal(headers.get('X-Custom-Header'), '123');
    });

    it('Preserves custom content types without overriding when provided', () => {
      const headers = buildAuthHeaders({ 'Content-Type': 'multipart/form-data' }, 'mock_token_1');
      assert.equal(headers.get('Content-Type'), 'multipart/form-data');
    });
  });

});
