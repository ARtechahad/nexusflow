import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import pg from 'pg';
import { getOutreachPool } from './schema';
import { verifyApiKey } from './apiKeys';
import { getTenantPlan, getTenantUsageSummary } from './plans';
import { checkAndReserve } from './capGuard';
import { verifySingleEmail } from './verifier';
import { validateSequenceCycles } from './branching';
import { enqueueOutreachJob } from './queue';
import { logger } from '../../logger';

/**
 * Creates and registers tools on an MCP Server instance for a specific tenant and scope.
 */
export function createTenantMcpServer(tenantId: string, permissions: string[] = ['*']): Server {
  const server = new Server(
    {
      name: 'leadflow-outreach-mcp',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const hasScope = (scope: string) => {
    return permissions.includes('*') || permissions.includes(scope);
  };

  // 1. Tool Definitions
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // --- READ TOOLS ---
        {
          name: 'list_campaigns',
          description: 'List cold email outreach campaigns for the authenticated workspace.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['draft', 'active', 'paused', 'completed', 'archived'],
                description: 'Filter by campaign status'
              },
              limit: { type: 'number', description: 'Max number of campaigns to return (default 50)' }
            }
          }
        },
        {
          name: 'get_campaign',
          description: 'Get detailed information about a specific campaign, including sequence steps and variants.',
          inputSchema: {
            type: 'object',
            properties: {
              campaign_id: { type: 'string', description: 'The unique ID of the campaign' }
            },
            required: ['campaign_id']
          }
        },
        {
          name: 'list_prospects',
          description: 'List prospects/leads in the workspace with email, company, tags, and status.',
          inputSchema: {
            type: 'object',
            properties: {
              status: { type: 'string', description: 'Filter by status (e.g. uncontacted, active, replied, unsubscribed)' },
              tag: { type: 'string', description: 'Filter by tag' },
              limit: { type: 'number', description: 'Max prospects to return (default 50)' }
            }
          }
        },
        {
          name: 'list_mailboxes',
          description: 'List active sending mailboxes with deliverability status, daily caps, and reputation scores.',
          inputSchema: {
            type: 'object',
            properties: {
              status: { type: 'string', description: 'Filter by status (e.g. active, paused, error)' }
            }
          }
        },
        {
          name: 'get_mailbox_health',
          description: 'Retrieve deliverability health score, SPF/DKIM/DMARC/MX DNS verification, and bounce metrics for a mailbox.',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox_id: { type: 'string', description: 'The unique ID of the mailbox' }
            },
            required: ['mailbox_id']
          }
        },
        {
          name: 'get_warmup_stats',
          description: 'Get peer-to-peer warmup metrics, ramp progress, inbox vs spam placement rates, and rolling 7-day health trend.',
          inputSchema: {
            type: 'object',
            properties: {
              mailbox_id: { type: 'string', description: 'Optional mailbox ID to filter warmup statistics' }
            }
          }
        },
        {
          name: 'list_suppressions',
          description: 'List unsubscribed or blocked emails and excluded competitor domains.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Max suppressions to return (default 50)' }
            }
          }
        },
        {
          name: 'get_usage',
          description: 'Check workspace plan allowances, emails sent, active mailboxes, verifications used, and billing quota status.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },

        // --- WRITE TOOLS ---
        {
          name: 'create_prospect',
          description: 'Create a new prospect in the workspace with email, name, company, and custom fields.',
          inputSchema: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'Valid recipient email address' },
              first_name: { type: 'string', description: 'First name' },
              last_name: { type: 'string', description: 'Last name' },
              company: { type: 'string', description: 'Company name' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Tags for segmentation' },
              custom_fields: { type: 'object', description: 'Additional key-value metadata' },
              idempotency_key: { type: 'string', description: 'Optional unique key to ensure idempotent execution' }
            },
            required: ['email']
          }
        },
        {
          name: 'bulk_create_prospects',
          description: 'Import multiple prospects at once. Dedupes, skips suppressed addresses, and returns imported counts.',
          inputSchema: {
            type: 'object',
            properties: {
              prospects: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    first_name: { type: 'string' },
                    last_name: { type: 'string' },
                    company: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['email']
                },
                description: 'List of prospects to import'
              },
              idempotency_key: { type: 'string', description: 'Optional unique key to ensure idempotent execution' }
            },
            required: ['prospects']
          }
        },
        {
          name: 'create_campaign',
          description: 'Create a new outreach campaign in draft state.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the campaign' },
              daily_limit: { type: 'number', description: 'Max emails sent per day by this campaign (default 100)' },
              stop_on_reply: { type: 'boolean', description: 'Stop further sequence steps when prospect replies' },
              idempotency_key: { type: 'string', description: 'Optional idempotency key' }
            },
            required: ['name']
          }
        },
        {
          name: 'update_campaign',
          description: 'Update campaign metadata or sequence steps (validates DAG for no circular loops).',
          inputSchema: {
            type: 'object',
            properties: {
              campaign_id: { type: 'string', description: 'Campaign ID' },
              name: { type: 'string' },
              daily_limit: { type: 'number' },
              stop_on_reply: { type: 'boolean' },
              steps: { type: 'array', description: 'Sequence steps with delays, variants, or conditions' },
              idempotency_key: { type: 'string' }
            },
            required: ['campaign_id']
          }
        },
        {
          name: 'start_campaign',
          description: 'Activate an outreach campaign. Enqueues steps to the background scheduler and Cap Guard. Note: No emails are sent instantly; all sends are strictly paced by domain warmup & mailbox caps.',
          inputSchema: {
            type: 'object',
            properties: {
              campaign_id: { type: 'string', description: 'The campaign ID to launch' },
              idempotency_key: { type: 'string' }
            },
            required: ['campaign_id']
          }
        },
        {
          name: 'pause_campaign',
          description: 'Pause an active campaign. Halts scheduling of new sequence steps.',
          inputSchema: {
            type: 'object',
            properties: {
              campaign_id: { type: 'string', description: 'Campaign ID' },
              idempotency_key: { type: 'string' }
            },
            required: ['campaign_id']
          }
        },
        {
          name: 'resume_campaign',
          description: 'Resume a paused campaign.',
          inputSchema: {
            type: 'object',
            properties: {
              campaign_id: { type: 'string', description: 'Campaign ID' },
              idempotency_key: { type: 'string' }
            },
            required: ['campaign_id']
          }
        },
        {
          name: 'enroll_prospects',
          description: 'Enroll prospects into a campaign sequence to begin scheduled outreach.',
          inputSchema: {
            type: 'object',
            properties: {
              campaign_id: { type: 'string', description: 'Campaign ID' },
              prospect_ids: { type: 'array', items: { type: 'string' }, description: 'List of prospect IDs to enroll' },
              filter_tag: { type: 'string', description: 'Enroll all prospects matching this tag' },
              idempotency_key: { type: 'string' }
            },
            required: ['campaign_id']
          }
        },
        {
          name: 'add_to_suppression_list',
          description: 'Add an email address or entire domain to the workspace suppression list. Destructive action preventing any future emails to this target.',
          annotations: {
            audience: ['user', 'assistant'],
            priority: 1,
            destructive: true
          },
          inputSchema: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'Specific email to suppress' },
              domain: { type: 'string', description: 'Domain to suppress across all mailboxes' },
              reason: {
                type: 'string',
                enum: ['unsubscribe', 'hard_bounce', 'complaint', 'manual'],
                description: 'Reason for suppression (default: manual)'
              },
              idempotency_key: { type: 'string' }
            }
          }
        },
        {
          name: 'verify_email',
          description: 'Perform layered deliverability verification on an email address (syntax, disposable, role address, MX record, and catch-all detection).',
          inputSchema: {
            type: 'object',
            properties: {
              email: { type: 'string', description: 'Email address to verify' },
              idempotency_key: { type: 'string' }
            },
            required: ['email']
          }
        }
      ]
    };
  });

  // 2. Tool Execution Handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const pool = getOutreachPool();

    if (!pool) {
      throw new McpError(ErrorCode.InternalError, 'Database pool unavailable');
    }

    // Handle Idempotency Key
    const idempotencyKey = (args as any)?.idempotency_key;
    if (idempotencyKey) {
      try {
        const cached = await pool.query(
          `SELECT response_body FROM ox_idempotency_keys WHERE tenant_id = $1 AND key = $2 AND expires_at > NOW()`,
          [tenantId, idempotencyKey]
        );
        if (cached.rows.length > 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(cached.rows[0].response_body, null, 2)
              }
            ]
          };
        }
      } catch {}
    }

    const cacheResult = async (data: any) => {
      if (idempotencyKey) {
        pool.query(
          `INSERT INTO ox_idempotency_keys (key, tenant_id, status_code, response_body, expires_at, created_at)
           VALUES ($1, $2, 200, $3, NOW() + INTERVAL '24 hours', NOW())
           ON CONFLICT (tenant_id, key) DO UPDATE
           SET response_body = EXCLUDED.response_body, expires_at = NOW() + INTERVAL '24 hours'`,
          [idempotencyKey, tenantId, JSON.stringify(data)]
        ).catch(() => {});
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2)
          }
        ]
      };
    };

    try {
      switch (name) {
        // --- READ: list_campaigns ---
        case 'list_campaigns': {
          if (!hasScope('campaigns:read')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: campaigns:read');
          }
          const status = (args as any).status;
          const limit = Math.min(100, Math.max(1, Number((args as any).limit) || 50));
          let q = `SELECT id, name, status, daily_limit, stop_on_reply, created_at, updated_at FROM ox_campaigns WHERE tenant_id = $1`;
          const p: any[] = [tenantId];
          if (status) {
            q += ` AND status = $2`;
            p.push(status);
          }
          q += ` ORDER BY created_at DESC LIMIT $${p.length + 1}`;
          p.push(limit);
          const res = await pool.query(q, p);
          return cacheResult({ campaigns: res.rows });
        }

        // --- READ: get_campaign ---
        case 'get_campaign': {
          if (!hasScope('campaigns:read')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: campaigns:read');
          }
          const campaignId = (args as any).campaign_id;
          const campRes = await pool.query(
            `SELECT * FROM ox_campaigns WHERE id = $1 AND tenant_id = $2`,
            [campaignId, tenantId]
          );
          if (campRes.rows.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, `not_found: Campaign ${campaignId} not found`);
          }
          const stepsRes = await pool.query(
            `SELECT s.*,
                    COALESCE(json_agg(v.* ORDER BY v.variant_label ASC) FILTER (WHERE v.id IS NOT NULL), '[]'::json) as variants
             FROM ox_steps s
             LEFT JOIN ox_step_variants v ON s.id = v.step_id
             WHERE s.campaign_id = $1
             GROUP BY s.id
             ORDER BY s.step_number ASC`,
            [campaignId]
          );
          return cacheResult({
            campaign: campRes.rows[0],
            steps: stepsRes.rows
          });
        }

        // --- READ: list_prospects ---
        case 'list_prospects': {
          if (!hasScope('prospects:read')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: prospects:read');
          }
          const status = (args as any).status;
          const tag = (args as any).tag;
          const limit = Math.min(100, Math.max(1, Number((args as any).limit) || 50));
          let q = `SELECT id, email, first_name, last_name, company, status, tags, custom_fields, created_at FROM ox_prospects WHERE tenant_id = $1`;
          const p: any[] = [tenantId];
          if (status) {
            q += ` AND status = $${p.length + 1}`;
            p.push(status);
          }
          if (tag) {
            q += ` AND $${p.length + 1} = ANY(tags)`;
            p.push(tag);
          }
          q += ` ORDER BY created_at DESC LIMIT $${p.length + 1}`;
          p.push(limit);
          const res = await pool.query(q, p);
          return cacheResult({ prospects: res.rows });
        }

        // --- READ: list_mailboxes ---
        case 'list_mailboxes': {
          if (!hasScope('mailboxes:read')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: mailboxes:read');
          }
          const status = (args as any).status;
          let q = `SELECT id, email, sender_name, status, daily_cap, reputation_score, health_status, created_at FROM ox_mailboxes WHERE tenant_id = $1 AND (is_deleted IS NULL OR is_deleted = false)`;
          const p: any[] = [tenantId];
          if (status) {
            q += ` AND status = $2`;
            p.push(status);
          }
          q += ` ORDER BY email ASC`;
          const res = await pool.query(q, p);
          return cacheResult({ mailboxes: res.rows });
        }

        // --- READ: get_mailbox_health ---
        case 'get_mailbox_health': {
          if (!hasScope('mailboxes:read')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: mailboxes:read');
          }
          const mailboxId = (args as any).mailbox_id;
          const mbxRes = await pool.query(
            `SELECT m.*, d.domain, d.spf_status, d.dkim_status, d.dmarc_status, d.mx_status
             FROM ox_mailboxes m
             LEFT JOIN ox_domains d ON m.domain_id = d.id
             WHERE m.id = $1 AND m.tenant_id = $2`,
            [mailboxId, tenantId]
          );
          if (mbxRes.rows.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, `not_found: Mailbox ${mailboxId} not found`);
          }
          return cacheResult({ mailbox: mbxRes.rows[0] });
        }

        // --- READ: get_warmup_stats ---
        case 'get_warmup_stats': {
          if (!hasScope('warmup:read')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: warmup:read');
          }
          const mailboxId = (args as any).mailbox_id;
          let q = `SELECT SUM(warmup_sent_count)::int as total_warmup_sent,
                          SUM(warmup_received_count)::int as total_warmup_received,
                          SUM(spam_rescue_count)::int as total_rescued_from_spam
                   FROM ox_mailbox_daily WHERE tenant_id = $1`;
          const p: any[] = [tenantId];
          if (mailboxId) {
            q += ` AND mailbox_id = $2`;
            p.push(mailboxId);
          }
          const statsRes = await pool.query(q, p);
          return cacheResult({ warmup_stats: statsRes.rows[0] || {} });
        }

        // --- READ: list_suppressions ---
        case 'list_suppressions': {
          if (!hasScope('suppressions:read')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: suppressions:read');
          }
          const limit = Math.min(100, Math.max(1, Number((args as any).limit) || 50));
          const res = await pool.query(
            `SELECT id, email, domain, reason, created_at FROM ox_suppressions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
            [tenantId, limit]
          );
          return cacheResult({ suppressions: res.rows });
        }

        // --- READ: get_usage ---
        case 'get_usage': {
          const usage = await getTenantUsageSummary(tenantId, pool);
          return cacheResult({ usage });
        }

        // --- WRITE: create_prospect ---
        case 'create_prospect': {
          if (!hasScope('prospects:write')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: prospects:write');
          }
          const email = (args as any).email?.trim().toLowerCase();
          if (!email || !email.includes('@')) {
            throw new McpError(ErrorCode.InvalidParams, 'invalid_params: Valid email required');
          }
          const id = `prosp_${crypto.randomUUID()}`;
          const firstName = (args as any).first_name || null;
          const lastName = (args as any).last_name || null;
          const company = (args as any).company || null;
          const tags = Array.isArray((args as any).tags) ? (args as any).tags : [];
          const customFields = (args as any).custom_fields || {};

          await pool.query(
            `INSERT INTO ox_prospects (id, tenant_id, email, first_name, last_name, company, tags, custom_fields, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uncontacted', NOW(), NOW())
             ON CONFLICT (tenant_id, email) DO UPDATE
             SET first_name = COALESCE(EXCLUDED.first_name, ox_prospects.first_name),
                 last_name = COALESCE(EXCLUDED.last_name, ox_prospects.last_name),
                 company = COALESCE(EXCLUDED.company, ox_prospects.company),
                 tags = EXCLUDED.tags,
                 custom_fields = EXCLUDED.custom_fields,
                 updated_at = NOW()`,
            [id, tenantId, email, firstName, lastName, company, tags, JSON.stringify(customFields)]
          );
          return cacheResult({ success: true, prospect: { id, email, first_name: firstName, last_name: lastName, company, tags } });
        }

        // --- WRITE: bulk_create_prospects ---
        case 'bulk_create_prospects': {
          if (!hasScope('prospects:write')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: prospects:write');
          }
          const list = (args as any).prospects;
          if (!Array.isArray(list) || list.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, 'invalid_params: prospects array required');
          }
          let imported = 0;
          for (const item of list.slice(0, 500)) {
            const email = item.email?.trim().toLowerCase();
            if (email && email.includes('@')) {
              await pool.query(
                `INSERT INTO ox_prospects (id, tenant_id, email, first_name, last_name, company, tags, status, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'uncontacted', NOW(), NOW())
                 ON CONFLICT (tenant_id, email) DO NOTHING`,
                [`prosp_${crypto.randomUUID()}`, tenantId, email, item.first_name || null, item.last_name || null, item.company || null, item.tags || []]
              );
              imported++;
            }
          }
          return cacheResult({ success: true, imported, totalSubmitted: list.length });
        }

        // --- WRITE: create_campaign ---
        case 'create_campaign': {
          if (!hasScope('campaigns:write')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: campaigns:write');
          }
          const nameStr = (args as any).name?.trim();
          if (!nameStr) throw new McpError(ErrorCode.InvalidParams, 'invalid_params: name required');

          const campaignId = `camp_${crypto.randomUUID()}`;
          const dailyLimit = Number((args as any).daily_limit) || 100;
          const stopOnReply = (args as any).stop_on_reply !== false;

          await pool.query(
            `INSERT INTO ox_campaigns (id, tenant_id, name, status, daily_limit, stop_on_reply, created_at, updated_at)
             VALUES ($1, $2, $3, 'draft', $4, $5, NOW(), NOW())`,
            [campaignId, tenantId, nameStr, dailyLimit, stopOnReply]
          );

          return cacheResult({ success: true, campaign: { id: campaignId, name: nameStr, status: 'draft', daily_limit: dailyLimit } });
        }

        // --- WRITE: update_campaign ---
        case 'update_campaign': {
          if (!hasScope('campaigns:write')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: campaigns:write');
          }
          const campaignId = (args as any).campaign_id;
          const steps = (args as any).steps;

          if (steps && Array.isArray(steps)) {
            const cycleCheck = validateSequenceCycles(steps);
            if (!cycleCheck.isValid) {
              throw new McpError(ErrorCode.InvalidParams, `invalid_params: Cycle detected in steps: ${cycleCheck.error}`);
            }
          }

          if ((args as any).name) {
            await pool.query(`UPDATE ox_campaigns SET name = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`, [
              (args as any).name,
              campaignId,
              tenantId
            ]);
          }

          return cacheResult({ success: true, message: `Campaign ${campaignId} updated` });
        }

        // --- WRITE: start_campaign ---
        case 'start_campaign': {
          if (!hasScope('campaigns:write')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: campaigns:write');
          }
          const campaignId = (args as any).campaign_id;
          const campCheck = await pool.query(
            `SELECT id, status FROM ox_campaigns WHERE id = $1 AND tenant_id = $2`,
            [campaignId, tenantId]
          );
          if (campCheck.rows.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, `not_found: Campaign ${campaignId} not found`);
          }

          // Check plan limits
          const usage = await getTenantUsageSummary(tenantId, pool);
          if (usage.isUpgradeRequired) {
            throw new McpError(ErrorCode.InvalidRequest, 'plan_upgrade_required: Monthly email sending limit reached. Upgrade plan to start campaign.');
          }

          // Update status to active
          await pool.query(`UPDATE ox_campaigns SET status = 'active', updated_at = NOW() WHERE id = $1`, [campaignId]);

          // Enqueue pacing job to background scheduler (not direct send!)
          await enqueueOutreachJob(
            tenantId,
            'campaign.dispatch',
            { campaignId, mode: 'paced_by_capguard' },
            { pool }
          );

          logger.info(`MCP client activated campaign ${campaignId} for tenant ${tenantId}. Pacing handed to Cap Guard.`, {
            context: 'McpServer'
          });

          return cacheResult({
            success: true,
            status: 'active',
            message: 'Campaign activated. Sends are paced by background scheduler & Cap Guard.'
          });
        }

        // --- WRITE: pause_campaign ---
        case 'pause_campaign': {
          if (!hasScope('campaigns:write')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: campaigns:write');
          }
          const campaignId = (args as any).campaign_id;
          await pool.query(`UPDATE ox_campaigns SET status = 'paused', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [
            campaignId,
            tenantId
          ]);
          return cacheResult({ success: true, status: 'paused', message: `Campaign ${campaignId} paused` });
        }

        // --- WRITE: resume_campaign ---
        case 'resume_campaign': {
          if (!hasScope('campaigns:write')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: campaigns:write');
          }
          const campaignId = (args as any).campaign_id;
          await pool.query(`UPDATE ox_campaigns SET status = 'active', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [
            campaignId,
            tenantId
          ]);
          return cacheResult({ success: true, status: 'active', message: `Campaign ${campaignId} resumed` });
        }

        // --- WRITE: enroll_prospects ---
        case 'enroll_prospects': {
          if (!hasScope('enrollments:write')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: enrollments:write');
          }
          const campaignId = (args as any).campaign_id;
          const prospectIds = (args as any).prospect_ids;

          // Fetch step 1
          const s1Res = await pool.query(
            `SELECT id FROM ox_steps WHERE campaign_id = $1 ORDER BY step_number ASC LIMIT 1`,
            [campaignId]
          );
          const firstStepId = s1Res.rows[0]?.id || null;

          let count = 0;
          if (Array.isArray(prospectIds)) {
            for (const pid of prospectIds) {
              await pool.query(
                `INSERT INTO ox_enrollments (id, tenant_id, campaign_id, prospect_id, current_step_id, status, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, 'active', NOW(), NOW())
                 ON CONFLICT (tenant_id, campaign_id, prospect_id) DO NOTHING`,
                [`enr_${crypto.randomUUID()}`, tenantId, campaignId, pid, firstStepId]
              );
              count++;
            }
          }
          return cacheResult({ success: true, enrolled: count });
        }

        // --- WRITE: add_to_suppression_list ---
        case 'add_to_suppression_list': {
          if (!hasScope('suppressions:write')) {
            throw new McpError(ErrorCode.InvalidRequest, 'insufficient_scope: Missing required scope: suppressions:write');
          }
          const email = (args as any).email?.trim().toLowerCase();
          const domain = (args as any).domain?.trim().toLowerCase();
          const reason = (args as any).reason || 'manual';

          if (!email && !domain) {
            throw new McpError(ErrorCode.InvalidParams, 'invalid_params: email or domain required');
          }

          const id = `supp_${crypto.randomUUID()}`;
          await pool.query(
            `INSERT INTO ox_suppressions (id, tenant_id, email, domain, reason, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (tenant_id, email) DO NOTHING`,
            [id, tenantId, email || null, domain || null, reason]
          );

          return cacheResult({ success: true, suppression: { id, email, domain, reason } });
        }

        // --- WRITE: verify_email ---
        case 'verify_email': {
          const email = (args as any).email?.trim();
          if (!email) {
            throw new McpError(ErrorCode.InvalidParams, 'invalid_params: email required');
          }
          const verification = await verifySingleEmail(email, { tenantId, pool, probeSmtp: false });
          return cacheResult({ email, verification });
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
      }
    } catch (err: any) {
      if (err instanceof McpError) throw err;
      logger.error(`MCP Tool execution error for ${name}`, { details: err?.message });
      throw new McpError(ErrorCode.InternalError, err?.message || 'internal_error');
    }
  });

  return server;
}

// Active SSE transport sessions for MCP Streamable HTTP
const sseSessions = new Map<string, { transport: SSEServerTransport; server: Server }>();

/**
 * Express handler for GET /api/outreach/mcp (SSE stream connection)
 */
export async function handleMcpGet(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization || '';
  let rawKey = '';
  if (authHeader.startsWith('Bearer lf_')) {
    rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  } else if (authHeader.startsWith('lf_')) {
    rawKey = authHeader.trim();
  }

  if (!rawKey) {
    res.status(401).json({
      error: 'unauthorized',
      code: 'missing_api_key',
      message: 'Bearer API key required for MCP connection'
    });
    return;
  }

  const verification = await verifyApiKey(rawKey);
  if (!verification.valid || !verification.tenantId) {
    res.status(401).json({
      error: 'unauthorized',
      code: verification.code || 'invalid_api_key',
      message: verification.message || 'Invalid API key'
    });
    return;
  }

  const tenantId = verification.tenantId;
  const permissions = verification.permissions || ['*'];

  // Initialize MCP server and SSEServerTransport
  const server = createTenantMcpServer(tenantId, permissions);
  const transport = new SSEServerTransport('/api/outreach/mcp/messages', res);

  const sessionId = transport.sessionId;
  sseSessions.set(sessionId, { transport, server });

  req.on('close', () => {
    sseSessions.delete(sessionId);
    server.close().catch(() => {});
  });

  await server.connect(transport);
}

/**
 * Express handler for POST /api/outreach/mcp (Standard Streamable HTTP or direct JSON-RPC invocation)
 */
export async function handleMcpPost(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization || '';
  let rawKey = '';
  if (authHeader.startsWith('Bearer lf_')) {
    rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
  } else if (authHeader.startsWith('lf_')) {
    rawKey = authHeader.trim();
  }

  if (!rawKey) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'unauthorized: Missing Bearer API key' },
      id: req.body?.id || null
    });
    return;
  }

  const verification = await verifyApiKey(rawKey);
  if (!verification.valid || !verification.tenantId) {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: `${verification.error || 'unauthorized'}: ${verification.message}`
      },
      id: req.body?.id || null
    });
    return;
  }

  const tenantId = verification.tenantId;
  const permissions = verification.permissions || ['*'];

  // If sessionId is provided in query, route to active SSE transport
  const sessionId = req.query.sessionId as string;
  if (sessionId && sseSessions.has(sessionId)) {
    const session = sseSessions.get(sessionId)!;
    await (session.transport as any).handlePostMessage(req as any, res as any);
    return;
  }

  // Handle direct JSON-RPC POST (compatible with Cursor / standalone agent callers)
  const server = createTenantMcpServer(tenantId, permissions);
  const jsonRpcBody = req.body;

  if (jsonRpcBody?.method === 'tools/list') {
    // List tools
    const toolsResult = await (server as any)._requestHandlers?.get('tools/list')?.(jsonRpcBody, {});
    res.json({
      jsonrpc: '2.0',
      id: jsonRpcBody.id,
      result: toolsResult
    });
    return;
  }

  if (jsonRpcBody?.method === 'tools/call') {
    try {
      const callResult = await (server as any)._requestHandlers?.get('tools/call')?.(jsonRpcBody, {});
      res.json({
        jsonrpc: '2.0',
        id: jsonRpcBody.id,
        result: callResult
      });
    } catch (err: any) {
      res.status(err instanceof McpError && err.code === ErrorCode.InvalidParams ? 400 : 200).json({
        jsonrpc: '2.0',
        id: jsonRpcBody.id,
        error: {
          code: err?.code || -32603,
          message: err?.message || 'internal_error'
        }
      });
    }
    return;
  }

  // Default initialize handshake response
  if (jsonRpcBody?.method === 'initialize') {
    res.json({
      jsonrpc: '2.0',
      id: jsonRpcBody.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'leadflow-outreach-mcp', version: '1.0.0' }
      }
    });
    return;
  }

  // Ping method
  if (jsonRpcBody?.method === 'ping') {
    res.json({
      jsonrpc: '2.0',
      id: jsonRpcBody.id,
      result: {}
    });
    return;
  }

  res.status(400).json({
    jsonrpc: '2.0',
    id: jsonRpcBody?.id || null,
    error: { code: -32601, message: `Method '${jsonRpcBody?.method}' not supported` }
  });
}
