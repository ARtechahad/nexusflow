import pg from 'pg';
import { logger } from '../logger';

const { Pool } = pg;

export interface NeonConnectionTestResult {
  ok: boolean;
  engine: 'neon_serverless' | 'standard_postgresql' | 'disconnected';
  latencyMs: number;
  database?: string;
  serverVersion?: string;
  host?: string;
  timestamp: string;
  error?: string;
}

// Global reference to the singleton Neon PG Pool
let neonPool: pg.Pool | null = null;
let isNeonConnecting = false;

/**
 * Resolves the target database connection string across common Neon and PostgreSQL env vars
 */
export function getDatabaseUrl(): string | null {
  const url =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;

  return url ? url.trim() : null;
}

/**
 * Determines whether the connection target is Neon Serverless
 */
export function isNeonConnection(url?: string): boolean {
  const target = url || getDatabaseUrl() || '';
  return target.includes('.neon.tech') || target.includes('neon') || target.includes('sslmode=require');
}

/**
 * Creates or retrieves the singleton Neon PostgreSQL pool with serverless-tuned settings
 */
export function getNeonPool(): pg.Pool | null {
  if (neonPool) {
    return neonPool;
  }

  const connString = getDatabaseUrl();
  if (!connString) {
    return null;
  }

  try {
    const isLocal = connString.includes('localhost') || connString.includes('127.0.0.1');
    const sslConfig = isLocal ? false : { rejectUnauthorized: false };

    neonPool = new Pool({
      connectionString: connString,
      ssl: sslConfig,
      max: 10, // Serverless-friendly concurrent pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });

    neonPool.on('error', (err: any) => {
      logger.warn('[Neon Database] Unexpected idle client error on pool:', {
        details: err?.message
      });
    });

    neonPool.on('connect', () => {
      logger.debug('[Neon Database] New client connected to pool');
    });

    return neonPool;
  } catch (err: any) {
    logger.error('[Neon Database] Failed to initialize connection pool:', {
      details: err?.message
    });
    return null;
  }
}

/**
 * Test database connectivity and measure latency to Neon
 */
export async function testNeonConnection(): Promise<NeonConnectionTestResult> {
  const pool = getNeonPool();
  const connString = getDatabaseUrl();

  if (!pool || !connString) {
    return {
      ok: false,
      engine: 'disconnected',
      latencyMs: 0,
      timestamp: new Date().toISOString(),
      error: 'DATABASE_URL or NEON_DATABASE_URL is not configured.'
    };
  }

  const start = Date.now();
  let client: pg.PoolClient | null = null;

  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT 
        NOW() as current_time, 
        version() as pg_version, 
        current_database() as db_name,
        inet_server_addr() as server_ip
    `);
    const latencyMs = Date.now() - start;

    const row = result.rows[0] || {};
    const isNeon = isNeonConnection(connString);

    let hostMasked = 'unknown';
    try {
      const parsed = new URL(connString.replace(/^postgresql:\/\//, 'http://'));
      hostMasked = parsed.host;
    } catch {}

    return {
      ok: true,
      engine: isNeon ? 'neon_serverless' : 'standard_postgresql',
      latencyMs,
      database: row.db_name,
      serverVersion: row.pg_version ? row.pg_version.split(' ')[0] + ' ' + row.pg_version.split(' ')[1] : undefined,
      host: hostMasked,
      timestamp: new Date().toISOString()
    };
  } catch (err: any) {
    return {
      ok: false,
      engine: isNeonConnection(connString) ? 'neon_serverless' : 'standard_postgresql',
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
      error: err?.message || 'Database connection test failed'
    };
  } finally {
    if (client) client.release();
  }
}

/**
 * Schema DDL for Neon Serverless database initialization and Clerk sync tables
 */
export const NEON_ESSENTIAL_SCHEMA_SQL = `
-- 1. Multi-Tenant Organization Registry
CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(128) UNIQUE NOT NULL,
  logo_url TEXT,
  branding JSONB NOT NULL DEFAULT '{}'::jsonb,
  business_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  integrations JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Core Users Table with Clerk Integration
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  clerk_user_id VARCHAR(128) UNIQUE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash TEXT,
  role VARCHAR(64) NOT NULL DEFAULT 'collaborator',
  title VARCHAR(128),
  avatar TEXT,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'tenant-alm-nexus',
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Clerk Real-Time Webhook Synchronization Ledger
CREATE TABLE IF NOT EXISTS clerk_users_sync (
  clerk_id VARCHAR(128) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(128),
  last_name VARCHAR(128),
  image_url TEXT,
  tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus',
  role VARCHAR(64) DEFAULT 'collaborator',
  raw_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Projects & Client Delivery Pipeline
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'tenant-alm-nexus',
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_company VARCHAR(255),
  client_phone VARCHAR(64),
  channel VARCHAR(64) DEFAULT 'linkedin',
  website_type VARCHAR(64) DEFAULT 'landing',
  purpose TEXT,
  estimated_price NUMERIC(10, 2) DEFAULT 0.00,
  final_price NUMERIC(10, 2) DEFAULT 0.00,
  advance_paid BOOLEAN DEFAULT false,
  advance_amount NUMERIC(10, 2) DEFAULT 0.00,
  advance_tx_id VARCHAR(128),
  balance_paid BOOLEAN DEFAULT false,
  balance_amount NUMERIC(10, 2) DEFAULT 0.00,
  status VARCHAR(64) DEFAULT 'discovery',
  lead_score INT DEFAULT 80,
  staging_url TEXT,
  internal_qa_passed BOOLEAN DEFAULT false,
  domain_transferred BOOLEAN DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Invoices & Billing
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'tenant-alm-nexus',
  project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number VARCHAR(64) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  milestone_type VARCHAR(64) DEFAULT 'advance_50',
  due_date DATE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. System Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus',
  user_id VARCHAR(64),
  user_name VARCHAR(255),
  action VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128),
  details JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Ensure All Columns Exist on Pre-existing Tables Before Indexing
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(128);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';
ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';
ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';
ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';
ALTER TABLE IF EXISTS clerk_users_sync ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';

-- 8. Essential Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clerk_users_sync_email ON clerk_users_sync(email);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
`;

/**
 * Run automatic schema migrations and ensure all tables & columns exist idempotently
 */
export async function initNeonSchema(customPool?: pg.Pool): Promise<boolean> {
  const pool = customPool || getNeonPool();
  if (!pool) {
    logger.info('[Neon Database] Skipping schema migration: No active database pool configured.');
    return false;
  }

  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // First ensure columns exist on any legacy pre-existing tables before running full DDL
    await client.query(`
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(128);
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';
      ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';
      ALTER TABLE IF EXISTS invoices ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';
      ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';
      ALTER TABLE IF EXISTS clerk_users_sync ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';
    `);

    // Run table creation and schema definitions
    await client.query(NEON_ESSENTIAL_SCHEMA_SQL);

    // Ensure default demo tenant exists
    await client.query(`
      INSERT INTO tenants (id, name, slug, created_at, updated_at)
      VALUES ('tenant-alm-nexus', 'ALM Nexus Enterprise', 'alm-nexus', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    await client.query('COMMIT');
    logger.info('[Neon Database] Schema verified & migrations completed successfully.');
    return true;
  } catch (err: any) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    logger.error('[Neon Database] Failed to initialize database schema:', {
      details: err?.message
    });
    return false;
  } finally {
    if (client) client.release();
  }
}

/**
 * Execute a query on the Neon Pool with automatic error capture and fallback resilience
 */
export async function neonQuery<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const pool = getNeonPool();
  if (!pool) {
    throw new Error('Neon database pool is not connected or DATABASE_URL is missing.');
  }

  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 1500) {
      logger.warn(`[Neon Database] Slow query (${duration}ms): ${text.slice(0, 100)}...`);
    }
    return res;
  } catch (err: any) {
    logger.error(`[Neon Database] Query execution error: ${err.message}`, {
      details: {
        query: text.slice(0, 150),
        params: params?.slice(0, 5)
      }
    });
    throw err;
  }
}
