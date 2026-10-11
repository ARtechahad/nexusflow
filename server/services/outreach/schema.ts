import pg from 'pg';
import { getPgPool } from '../../db';
import { logger } from '../../logger';

/**
 * Re-exports the PostgreSQL connection pool initialized by ALM Nexus persistence layer.
 */
export function getOutreachPool(): pg.Pool | null {
  return getPgPool();
}

export const OUTREACH_SCHEMA_SQL = `
-- 1. Tier Plans and Outreach Resource Caps
CREATE TABLE IF NOT EXISTS ox_plans (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  mailbox_limit INT NOT NULL DEFAULT 5,
  daily_send_limit INT NOT NULL DEFAULT 500,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sending Domains & DNS Deliverability Records
CREATE TABLE IF NOT EXISTS ox_domains (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  dkim_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  spf_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  dmarc_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  mx_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  custom_tracking_domain VARCHAR(255),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_domains_tenant ON ox_domains(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ox_domains_tenant_domain ON ox_domains(tenant_id, domain);

-- 3. Connected Mailboxes (SMTP / IMAP / Google / Outlook)
CREATE TABLE IF NOT EXISTS ox_mailboxes (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  domain_id VARCHAR(64) REFERENCES ox_domains(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  sender_name VARCHAR(128) NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'smtp',
  smtp_host VARCHAR(255),
  smtp_port INT DEFAULT 587,
  smtp_user VARCHAR(255),
  smtp_pass_encrypted BYTEA,
  imap_host VARCHAR(255),
  imap_port INT DEFAULT 993,
  imap_user VARCHAR(255),
  imap_pass_encrypted BYTEA,
  oauth_tokens_encrypted BYTEA,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  daily_limit INT NOT NULL DEFAULT 50,
  warmup_enabled BOOLEAN NOT NULL DEFAULT true,
  warmup_daily_limit INT NOT NULL DEFAULT 30,
  current_warmup_tier INT NOT NULL DEFAULT 1,
  reputation_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
  health_status VARCHAR(32) NOT NULL DEFAULT 'good',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_mailboxes_tenant ON ox_mailboxes(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ox_mailboxes_tenant_email ON ox_mailboxes(tenant_id, email);

-- 4. Daily Mailbox Counters (UTC Resets)
CREATE TABLE IF NOT EXISTS ox_mailbox_daily (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  mailbox_id VARCHAR(64) NOT NULL REFERENCES ox_mailboxes(id) ON DELETE CASCADE,
  date_utc DATE NOT NULL,
  campaign_sent_count INT NOT NULL DEFAULT 0,
  warmup_sent_count INT NOT NULL DEFAULT 0,
  warmup_received_count INT NOT NULL DEFAULT 0,
  bounced_count INT NOT NULL DEFAULT 0,
  spam_complaints INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ox_mailbox_daily UNIQUE (mailbox_id, date_utc)
);
CREATE INDEX IF NOT EXISTS idx_ox_mailbox_daily_tenant ON ox_mailbox_daily(tenant_id);

-- 5. Warmup Network Inter-Mailbox Messages
CREATE TABLE IF NOT EXISTS ox_warmup_messages (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  sender_mailbox_id VARCHAR(64) NOT NULL REFERENCES ox_mailboxes(id) ON DELETE CASCADE,
  recipient_mailbox_id VARCHAR(64) REFERENCES ox_mailboxes(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  thread_id VARCHAR(128),
  message_id_header VARCHAR(255),
  subject TEXT,
  body_snippet TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'sent',
  inbox_landed BOOLEAN NOT NULL DEFAULT true,
  replied BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_warmup_messages_tenant ON ox_warmup_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_warmup_messages_sender ON ox_warmup_messages(sender_mailbox_id);

-- 6. Prospect Directory
CREATE TABLE IF NOT EXISTS ox_prospects (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(128),
  last_name VARCHAR(128),
  full_name VARCHAR(255),
  company VARCHAR(255),
  title VARCHAR(128),
  linkedin_url TEXT,
  phone VARCHAR(64),
  custom_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'uncontacted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ox_prospects_tenant_email UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_ox_prospects_tenant ON ox_prospects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_prospects_status ON ox_prospects(status);

-- 7. Unsubscribe & Hard-Bounce Suppression List
CREATE TABLE IF NOT EXISTS ox_suppressions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(64) NOT NULL,
  source VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ox_suppressions_tenant_email UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_ox_suppressions_tenant ON ox_suppressions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_suppressions_email ON ox_suppressions(email);

-- 8. Campaigns
CREATE TABLE IF NOT EXISTS ox_campaigns (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  schedule JSONB NOT NULL DEFAULT '{"timezone":"UTC","windows":[{"start":"09:00","end":"17:00","days":[1,2,3,4,5]}]}'::jsonb,
  tracking_settings JSONB NOT NULL DEFAULT '{"track_opens":true,"track_clicks":true}'::jsonb,
  stop_on_reply BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_campaigns_tenant ON ox_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_campaigns_status ON ox_campaigns(status);

-- 9. Campaign Mailbox Rotation Mapping
CREATE TABLE IF NOT EXISTS ox_campaign_mailboxes (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  campaign_id VARCHAR(64) NOT NULL REFERENCES ox_campaigns(id) ON DELETE CASCADE,
  mailbox_id VARCHAR(64) NOT NULL REFERENCES ox_mailboxes(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ox_camp_mailbox UNIQUE (campaign_id, mailbox_id)
);
CREATE INDEX IF NOT EXISTS idx_ox_camp_mailboxes_tenant ON ox_campaign_mailboxes(tenant_id);

-- 10. Sequence Steps
CREATE TABLE IF NOT EXISTS ox_steps (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  campaign_id VARCHAR(64) NOT NULL REFERENCES ox_campaigns(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  channel VARCHAR(32) NOT NULL DEFAULT 'email',
  delay_days INT NOT NULL DEFAULT 1,
  delay_hours INT NOT NULL DEFAULT 0,
  wait_condition VARCHAR(32) NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ox_steps_camp_number UNIQUE (campaign_id, step_number)
);
CREATE INDEX IF NOT EXISTS idx_ox_steps_tenant ON ox_steps(tenant_id);

-- 11. Step A/B Variants
CREATE TABLE IF NOT EXISTS ox_step_variants (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  step_id VARCHAR(64) NOT NULL REFERENCES ox_steps(id) ON DELETE CASCADE,
  variant_label VARCHAR(8) NOT NULL DEFAULT 'A',
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  weight INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_step_variants_tenant ON ox_step_variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_step_variants_step ON ox_step_variants(step_id);

-- 12. Prospect Enrollments in Campaigns
CREATE TABLE IF NOT EXISTS ox_enrollments (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  campaign_id VARCHAR(64) NOT NULL REFERENCES ox_campaigns(id) ON DELETE CASCADE,
  prospect_id VARCHAR(64) NOT NULL REFERENCES ox_prospects(id) ON DELETE CASCADE,
  current_step_id VARCHAR(64) REFERENCES ox_steps(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  next_send_at TIMESTAMPTZ,
  completed_steps INT NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ox_enrollments_camp_prospect UNIQUE (campaign_id, prospect_id)
);
CREATE INDEX IF NOT EXISTS idx_ox_enrollments_tenant ON ox_enrollments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_enrollments_next_send_active ON ox_enrollments(next_send_at) WHERE status = 'active';

-- 13. Sent Emails Ledger
CREATE TABLE IF NOT EXISTS ox_sent_emails (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  campaign_id VARCHAR(64) REFERENCES ox_campaigns(id) ON DELETE SET NULL,
  step_id VARCHAR(64) REFERENCES ox_steps(id) ON DELETE SET NULL,
  variant_id VARCHAR(64) REFERENCES ox_step_variants(id) ON DELETE SET NULL,
  enrollment_id VARCHAR(64) REFERENCES ox_enrollments(id) ON DELETE SET NULL,
  mailbox_id VARCHAR(64) NOT NULL REFERENCES ox_mailboxes(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  message_id_header VARCHAR(255),
  tracking_hash VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_sent_emails_tenant ON ox_sent_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_sent_emails_tracking ON ox_sent_emails(tracking_hash);

-- 14. Outreach Telemetry & Activity Events
CREATE TABLE IF NOT EXISTS ox_events (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  sent_email_id VARCHAR(64) REFERENCES ox_sent_emails(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_events_tenant ON ox_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_events_sent_email_type ON ox_events(sent_email_id, type);

-- 15. Conversations & Threads
CREATE TABLE IF NOT EXISTS ox_threads (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  mailbox_id VARCHAR(64) NOT NULL REFERENCES ox_mailboxes(id) ON DELETE CASCADE,
  prospect_email VARCHAR(255) NOT NULL,
  subject TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  sentiment VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_threads_tenant ON ox_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_threads_prospect ON ox_threads(prospect_email);

-- 16. Thread Messages
CREATE TABLE IF NOT EXISTS ox_messages (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  thread_id VARCHAR(64) NOT NULL REFERENCES ox_threads(id) ON DELETE CASCADE,
  mailbox_id VARCHAR(64) NOT NULL REFERENCES ox_mailboxes(id) ON DELETE CASCADE,
  direction VARCHAR(16) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  message_id_header VARCHAR(255),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_messages_tenant ON ox_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_messages_thread ON ox_messages(thread_id);

-- 17. Durable Postgres Queue Jobs (FOR UPDATE SKIP LOCKED)
CREATE TABLE IF NOT EXISTS ox_jobs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_jobs_tenant ON ox_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_jobs_status_run_at ON ox_jobs(status, run_at);

-- 18. API Keys Scoped by Tenant
CREATE TABLE IF NOT EXISTS ox_api_keys (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_api_keys_tenant ON ox_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ox_api_keys_hash ON ox_api_keys(key_hash);

-- 19. Webhook Subscriptions
CREATE TABLE IF NOT EXISTS ox_webhooks (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  url TEXT NOT NULL,
  secret VARCHAR(128) NOT NULL,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ox_webhooks_tenant ON ox_webhooks(tenant_id);
`;

/**
 * Creates all Outreach Suite schema tables and indexes idempotently.
 */
export async function ensureOutreachSchema(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(OUTREACH_SCHEMA_SQL);
    // Phase 1 & Phase 2 column upgrades
    await client.query(`
      ALTER TABLE ox_mailboxes ADD COLUMN IF NOT EXISTS daily_cap INT DEFAULT 30;
      ALTER TABLE ox_mailboxes ADD COLUMN IF NOT EXISTS send_interval_sec INT DEFAULT 120;
      ALTER TABLE ox_mailboxes ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;
      ALTER TABLE ox_mailboxes ADD COLUMN IF NOT EXISTS signature TEXT DEFAULT '';
      ALTER TABLE ox_mailboxes ADD COLUMN IF NOT EXISTS last_error TEXT;
      ALTER TABLE ox_mailboxes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
      ALTER TABLE ox_domains ADD COLUMN IF NOT EXISTS dns_records JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE ox_domains ADD COLUMN IF NOT EXISTS fix_instructions JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE ox_campaigns ADD COLUMN IF NOT EXISTS daily_limit INT DEFAULT 100;
      ALTER TABLE ox_campaigns ADD COLUMN IF NOT EXISTS postal_address TEXT;
      ALTER TABLE ox_campaigns ADD COLUMN IF NOT EXISTS last_activity_log JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE ox_enrollments ADD COLUMN IF NOT EXISTS defer_reason TEXT;
      ALTER TABLE ox_plans ADD COLUMN IF NOT EXISTS monthly_send_limit INT DEFAULT 5000;

      -- Phase 3 column upgrades
      ALTER TABLE ox_domains ADD COLUMN IF NOT EXISTS tracking_domain VARCHAR(255);
      ALTER TABLE ox_domains ADD COLUMN IF NOT EXISTS tracking_verified BOOLEAN DEFAULT false;
      ALTER TABLE ox_threads ADD COLUMN IF NOT EXISTS label VARCHAR(32) DEFAULT 'question';
      ALTER TABLE ox_threads ADD COLUMN IF NOT EXISTS is_unread BOOLEAN DEFAULT true;
      ALTER TABLE ox_threads ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
      ALTER TABLE ox_threads ADD COLUMN IF NOT EXISTS campaign_id VARCHAR(64);
      ALTER TABLE ox_threads ADD COLUMN IF NOT EXISTS enrollment_id VARCHAR(64);
      ALTER TABLE ox_threads ADD COLUMN IF NOT EXISTS snippet TEXT;
      ALTER TABLE ox_messages ADD COLUMN IF NOT EXISTS in_reply_to_header VARCHAR(255);
      ALTER TABLE ox_messages ADD COLUMN IF NOT EXISTS references_header TEXT;
      ALTER TABLE ox_messages ADD COLUMN IF NOT EXISTS raw_headers JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE ox_sent_emails ADD COLUMN IF NOT EXISTS tracking_settings JSONB DEFAULT '{}'::jsonb;

      CREATE INDEX IF NOT EXISTS idx_ox_threads_label ON ox_threads(tenant_id, label);
      CREATE INDEX IF NOT EXISTS idx_ox_threads_unread ON ox_threads(tenant_id, is_unread);
      CREATE INDEX IF NOT EXISTS idx_ox_sent_emails_msg_id ON ox_sent_emails(message_id_header);

      -- Tenant settings table for postal address and tenant-wide settings
      CREATE TABLE IF NOT EXISTS ox_tenant_settings (
        tenant_id VARCHAR(64) PRIMARY KEY,
        postal_address TEXT,
        custom_tracking_domain VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query('COMMIT');
    logger.info('Outreach Suite schema & indexes verified in PostgreSQL.', {
      context: 'OutreachSchema'
    });
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Failed to create Outreach Suite PostgreSQL schema', {
      context: 'OutreachSchema',
      details: err?.message
    });
    throw err;
  } finally {
    client.release();
  }
}
