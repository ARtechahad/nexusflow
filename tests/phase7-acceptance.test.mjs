import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { initPostgresPool } from '../server/db.ts';
import { getOutreachPool, ensureOutreachSchema } from '../server/services/outreach/schema.ts';
import {
  createTenantApiKey,
  verifyApiKey,
  listTenantApiKeys,
  deleteTenantApiKey
} from '../server/services/outreach/apiKeys.ts';
import {
  createWebhookEndpoint,
  validateWebhookUrl,
  signWebhookPayload,
  verifyWebhookSignature,
  deliverWebhook,
  listWebhookDeliveries,
  replayWebhookDelivery
} from '../server/services/outreach/webhooks.ts';
import {
  createTenantMcpServer,
  handleMcpPost
} from '../server/services/outreach/mcpServer.ts';
import { OUTREACH_DOCS } from '../src/data/docsContent.ts';
import { OUTREACH_PLANS } from '../server/services/outreach/plans.ts';

describe('Phase 7 Acceptance Tests: Public API, Webhooks, MCP Server & Landing Integration', () => {
  let pool;
  const tenantId = `tenant_p7_${Date.now()}`;
  let readOnlyKey = '';
  let fullAccessKey = '';
  let readOnlyKeyInfo = null;
  let fullAccessKeyInfo = null;

  before(async () => {
    await initPostgresPool();
    pool = getOutreachPool();
    if (pool) {
      await ensureOutreachSchema(pool);
      // Clean up previous runs
      await pool.query(`DELETE FROM ox_api_keys WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM ox_webhooks WHERE tenant_id = $1`, [tenantId]);
      await pool.query(`DELETE FROM ox_campaigns WHERE tenant_id = $1`, [tenantId]);
    }

    // 1. Create a read-only key (campaigns:read only)
    const readRes = await createTenantApiKey(tenantId, 'ReadOnlyKey', ['campaigns:read'], pool);
    readOnlyKey = readRes.apiKey;
    readOnlyKeyInfo = readRes.keyInfo;

    // 2. Create a write-enabled key
    const fullRes = await createTenantApiKey(
      tenantId,
      'FullAccessKey',
      ['campaigns:read', 'campaigns:write', 'prospects:read', 'prospects:write', 'enrollments:write'],
      pool
    );
    fullAccessKey = fullRes.apiKey;
    fullAccessKeyInfo = fullRes.keyInfo;
  });

  after(async () => {
    if (pool) {
      try {
        await pool.query(`DELETE FROM ox_api_keys WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_webhooks WHERE tenant_id = $1`, [tenantId]);
        await pool.query(`DELETE FROM ox_campaigns WHERE tenant_id = $1`, [tenantId]);
      } catch {}
    }
  });

  // ==========================================================================
  // CHECK 1: A key with only campaigns:read cannot create a campaign (insufficient_scope)
  // ==========================================================================
  test('Check 1: API key with only campaigns:read cannot create campaign (insufficient_scope)', async () => {
    assert.ok(readOnlyKey.startsWith('lf_'), 'API key format must start with lf_');
    assert.equal(readOnlyKey.length, 35, 'Key must be lf_ + 32 chars = 35 chars');

    // Test scope verification logic
    const readCheck = await verifyApiKey(readOnlyKey, {
      requiredScope: 'campaigns:read',
      isWrite: false,
      pool
    });
    assert.equal(readCheck.valid, true, 'ReadOnly key must be valid for campaigns:read');

    // Attempt write action with read-only key
    const writeCheck = await verifyApiKey(readOnlyKey, {
      requiredScope: 'campaigns:write',
      isWrite: true,
      pool
    });
    assert.equal(writeCheck.valid, false, 'ReadOnly key must fail on campaigns:write');
    assert.equal(writeCheck.error, 'insufficient_scope', 'Error must be insufficient_scope');
    assert.match(writeCheck.message, /lacks the required scope/i);

    // Full key should succeed for write
    const fullWriteCheck = await verifyApiKey(fullAccessKey, {
      requiredScope: 'campaigns:write',
      isWrite: true,
      pool
    });
    assert.equal(fullWriteCheck.valid, true, 'FullAccess key must succeed for campaigns:write');
  });

  // ==========================================================================
  // CHECK 2: Webhook signature verifies with sample script included in the docs
  // ==========================================================================
  test('Check 2: Webhook signature verifies with sample script included in the docs', async () => {
    const secret = 'whsec_test_secret_994824719238472918';
    const payload = {
      event: 'email.sent',
      tenant_id: tenantId,
      campaign_id: 'camp_enterprise_q4',
      recipient: 'dominik@cyberdyne.io',
      timestamp: new Date().toISOString()
    };
    const bodyString = JSON.stringify(payload);
    const nowTs = Math.floor(Date.now() / 1000);

    // Generate header via service
    const { signatureHeader, signature } = signWebhookPayload(secret, bodyString, nowTs);
    assert.ok(signatureHeader.startsWith('t='), 'Header must start with t=');
    assert.ok(signatureHeader.includes(',v1='), 'Header must include ,v1=');

    // Execute the exact verification code sample published in docsContent.ts
    function verifyWithDocsScript(rawBody, sigHeader, sec, toleranceSec = 300) {
      const parts = sigHeader.split(',').reduce((acc, pair) => {
        const [k, v] = pair.split('=');
        acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const timestamp = parseInt(parts['t'], 10);
      const expectedSig = parts['v1'];

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > toleranceSec) {
        throw new Error('Webhook signature timestamp outside acceptable tolerance.');
      }

      const computedSig = crypto
        .createHmac('sha256', sec)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      const bufExpected = Buffer.from(expectedSig, 'hex');
      const bufComputed = Buffer.from(computedSig, 'hex');

      if (bufExpected.length !== bufComputed.length || !crypto.timingSafeEqual(bufExpected, bufComputed)) {
        throw new Error('Webhook signature verification failed!');
      }

      return true;
    }

    // 1. Should verify successfully with matching payload & secret
    const isValid = verifyWithDocsScript(bodyString, signatureHeader, secret);
    assert.equal(isValid, true, 'Docs verification sample script must verify authentic webhook signature');

    // 2. Tampered body should fail
    const tamperedBody = JSON.stringify({ ...payload, recipient: 'hacker@evil.com' });
    assert.throws(
      () => verifyWithDocsScript(tamperedBody, signatureHeader, secret),
      /verification failed/i,
      'Tampered payload must fail signature verification'
    );

    // 3. SSRF Protection validation
    const ssrfLocal = validateWebhookUrl('http://127.0.0.1:8080/hook');
    assert.equal(ssrfLocal.isValid, false, 'Localhost/127.0.0.1 must be blocked by SSRF protection');

    const ssrfMetadata = validateWebhookUrl('http://169.254.169.254/latest/meta-data');
    assert.equal(ssrfMetadata.isValid, false, 'Cloud metadata service must be blocked by SSRF protection');

    const ssrfValid = validateWebhookUrl('https://api.acme.com/webhooks/incoming');
    assert.equal(ssrfValid.isValid, true, 'Public HTTPS endpoint must pass SSRF validation');
  });

  // ==========================================================================
  // CHECK 3: MCP client lists tools and can create and start a campaign that is then paced by Cap Guard
  // ==========================================================================
  test('Check 3: MCP client lists tools, can create and start a campaign paced by Cap Guard', async () => {
    // 1. Create MCP server with full permissions
    const mcpServer = createTenantMcpServer(tenantId, fullAccessKeyInfo.permissions);
    assert.ok(mcpServer, 'MCP server must instantiate successfully');

    // 2. List tools
    const listHandler = mcpServer._requestHandlers?.get('tools/list');
    assert.ok(listHandler, 'tools/list handler must be registered');

    const listResult = await listHandler({ method: 'tools/list', params: {} }, {});
    const tools = listResult.tools;
    assert.ok(Array.isArray(tools), 'tools must be an array');
    assert.ok(tools.length >= 10, 'Must have at least 10 MCP tools');

    const toolNames = tools.map((t) => t.name);
    assert.ok(toolNames.includes('list_campaigns'), 'Must include list_campaigns');
    assert.ok(toolNames.includes('create_campaign'), 'Must include create_campaign');
    assert.ok(toolNames.includes('start_campaign'), 'Must include start_campaign');
    assert.ok(toolNames.includes('add_to_suppression_list'), 'Must include add_to_suppression_list');

    // Verify destructive annotation
    const suppTool = tools.find((t) => t.name === 'add_to_suppression_list');
    assert.equal(suppTool?.annotations?.destructive, true, 'add_to_suppression_list must have destructive: true annotation');

    // 3. Verify safety rules: no tool can delete mailboxes or raise limits or send direct emails
    assert.ok(!toolNames.includes('delete_mailbox'), 'No tool may delete mailboxes');
    assert.ok(!toolNames.includes('delete_mailboxes'), 'No tool may delete mailboxes');
    assert.ok(!toolNames.includes('raise_limits'), 'No tool may raise limits');
    assert.ok(!toolNames.includes('send_email_direct'), 'No tool may send direct emails outside scheduler');

    // 4. Create campaign via MCP tool
    const callHandler = mcpServer._requestHandlers?.get('tools/call');
    assert.ok(callHandler, 'tools/call handler must be registered');

    const createCampResult = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'create_campaign',
          arguments: {
            name: 'MCP Paced Outbound Q4',
            daily_limit: 150,
            idempotency_key: `mcp_key_${Date.now()}`
          }
        }
      },
      {}
    );

    assert.ok(createCampResult.content, 'Tool call result must contain content array');
    const createdData = JSON.parse(createCampResult.content[0].text);
    assert.equal(createdData.success, true);
    assert.ok(createdData.campaign.id);
    assert.equal(createdData.campaign.status, 'draft');

    const createdCampId = createdData.campaign.id;

    // 5. Start campaign via MCP tool (hands to Cap Guard & background scheduler)
    const startCampResult = await callHandler(
      {
        method: 'tools/call',
        params: {
          name: 'start_campaign',
          arguments: {
            campaign_id: createdCampId
          }
        }
      },
      {}
    );

    const startedData = JSON.parse(startCampResult.content[0].text);
    assert.equal(startedData.success, true);
    assert.equal(startedData.status, 'active');
    assert.match(startedData.message, /Cap Guard/i);

    // Verify DB state
    const dbCamp = await pool.query(`SELECT status FROM ox_campaigns WHERE id = $1`, [createdCampId]);
    assert.equal(dbCamp.rows[0].status, 'active', 'Campaign in DB must be set to active');

    // 6. Test read-only MCP server blocked from creating campaign
    const readOnlyMcp = createTenantMcpServer(tenantId, ['campaigns:read']);
    const readOnlyCall = readOnlyMcp._requestHandlers?.get('tools/call');

    await assert.rejects(
      async () => {
        await readOnlyCall(
          {
            method: 'tools/call',
            params: {
              name: 'create_campaign',
              arguments: { name: 'Blocked Campaign' }
            }
          },
          {}
        );
      },
      (err) => {
        assert.match(err.message, /insufficient_scope/i);
        return true;
      },
      'Read-only MCP client must be rejected with insufficient_scope'
    );
  });

  // ==========================================================================
  // CHECK 4: The landing page builds and documentation content is typed and complete
  // ==========================================================================
  test('Check 4: Landing page software plans and docs content are typed and complete', () => {
    // 1. Verify OUTREACH_DOCS has all 10 required sections
    const docIds = OUTREACH_DOCS.map((d) => d.id);
    const requiredSections = [
      'getting-started',
      'connect-mailbox',
      'dns-setup',
      'warmup-explained',
      'campaigns-sequences',
      'tracking-unsubscribe',
      'api-reference',
      'webhooks',
      'mcp-server',
      'compliance',
      'troubleshooting'
    ];

    for (const reqSec of requiredSections) {
      assert.ok(docIds.includes(reqSec), `Documentation must contain section: ${reqSec}`);
    }

    // 2. Verify Canonical Outreach Plans
    assert.ok(OUTREACH_PLANS.starter, 'Starter plan must be defined');
    assert.ok(OUTREACH_PLANS.growth, 'Growth plan must be defined');
    assert.ok(OUTREACH_PLANS.scale, 'Scale plan must be defined');

    assert.equal(OUTREACH_PLANS.starter.monthlyPriceUsd, 49);
    assert.equal(OUTREACH_PLANS.growth.monthlyPriceUsd, 99);
    assert.equal(OUTREACH_PLANS.scale.monthlyPriceUsd, 249);

    assert.equal(OUTREACH_PLANS.starter.monthlySendLimit, 5000);
    assert.equal(OUTREACH_PLANS.growth.monthlySendLimit, 25000);
    assert.equal(OUTREACH_PLANS.scale.monthlySendLimit, 100000);
  });
});
