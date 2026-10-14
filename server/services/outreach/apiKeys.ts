import crypto from 'node:crypto';
import pg from 'pg';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';
import { getTenantPlan } from './plans';

export const VALID_API_SCOPES = [
  'campaigns:read',
  'campaigns:write',
  'prospects:read',
  'prospects:write',
  'mailboxes:read',
  'warmup:read',
  'warmup:write',
  'enrollments:write',
  'suppressions:read',
  'suppressions:write',
  'inbox:read',
  'jobs:read'
] as const;

export type ApiScope = typeof VALID_API_SCOPES[number] | '*';

export interface ApiKeyRecord {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  created_at: string;
}

export interface CreatedApiKeyResult {
  apiKey: string; // The plaintext secret key, shown ONCE
  keyInfo: ApiKeyRecord;
}

// In-memory sliding window rate limiter per API key
interface RateLimitBucket {
  readWindowStart: number;
  readCount: number;
  writeWindowStart: number;
  writeCount: number;
  bulkWindowStart: number;
  bulkCount: number;
}

const rateLimitMap = new Map<string, RateLimitBucket>();

// Clean rate limit map every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [keyId, bucket] of rateLimitMap.entries()) {
      if (now - bucket.readWindowStart > 120_000 && now - bucket.writeWindowStart > 120_000) {
        rateLimitMap.delete(keyId);
      }
    }
  }, 5 * 60 * 1000).unref();
}

/**
 * Creates a new API key for a tenant.
 * Key format: lf_<32 random alphanumeric/hex characters>
 * The plaintext key is returned ONCE and never stored; only SHA-256 hash is saved.
 */
export async function createTenantApiKey(
  tenantId: string,
  name: string,
  permissions: string[] = ['*'],
  pool?: pg.Pool
): Promise<CreatedApiKeyResult> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) {
    throw new Error('Database pool unavailable to create API key');
  }

  // Generate 32 random characters (16 bytes hex = 32 chars)
  const randomSuffix = crypto.randomBytes(16).toString('hex');
  const rawKey = `lf_${randomSuffix}`;
  const keyPrefix = rawKey.slice(0, 10); // e.g. "lf_a1b2c3d4"
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyId = `key_${crypto.randomUUID()}`;

  // Validate scopes
  const validPermissions = permissions.includes('*')
    ? ['*']
    : permissions.filter((p) => VALID_API_SCOPES.includes(p as any));

  const finalPermissions = validPermissions.length > 0 ? validPermissions : ['*'];

  await targetPool.query(
    `INSERT INTO ox_api_keys (id, tenant_id, name, key_hash, key_prefix, permissions, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [keyId, tenantId, name.trim() || 'Default API Key', keyHash, keyPrefix, JSON.stringify(finalPermissions)]
  );

  logger.info(`Created new outreach API key ${keyPrefix}... for tenant ${tenantId}`, {
    context: 'ApiKeys',
    details: { keyId, name, scopes: finalPermissions }
  });

  return {
    apiKey: rawKey,
    keyInfo: {
      id: keyId,
      tenant_id: tenantId,
      name: name.trim() || 'Default API Key',
      key_prefix: keyPrefix,
      permissions: finalPermissions,
      last_used_at: null,
      created_at: new Date().toISOString()
    }
  };
}

/**
 * Lists all API keys for a tenant (without sensitive hashes).
 */
export async function listTenantApiKeys(tenantId: string, pool?: pg.Pool): Promise<ApiKeyRecord[]> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) return [];

  const res = await targetPool.query(
    `SELECT id, tenant_id, name, key_prefix, permissions, last_used_at, created_at
     FROM ox_api_keys
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );

  return res.rows.map((row) => ({
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    key_prefix: row.key_prefix,
    permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
    last_used_at: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
    created_at: new Date(row.created_at).toISOString()
  }));
}

/**
 * Revokes/deletes an API key.
 */
export async function deleteTenantApiKey(
  tenantId: string,
  keyId: string,
  pool?: pg.Pool
): Promise<boolean> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) return false;

  const res = await targetPool.query(
    `DELETE FROM ox_api_keys WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [keyId, tenantId]
  );

  return (res.rowCount ?? 0) > 0;
}

export interface VerifyApiKeyResult {
  valid: boolean;
  error?: 'invalid_api_key' | 'insufficient_scope' | 'rate_limited';
  code?: string;
  message?: string;
  tenantId?: string;
  keyId?: string;
  permissions?: string[];
  retryAfterSeconds?: number;
}

/**
 * Verifies an incoming API key, checks required scope, tracks last_used_at, and enforces per-key rate limits.
 */
export async function verifyApiKey(
  rawKey: string,
  options?: {
    requiredScope?: ApiScope;
    isWrite?: boolean;
    isBulk?: boolean;
    pool?: pg.Pool;
  }
): Promise<VerifyApiKeyResult> {
  if (!rawKey || !rawKey.startsWith('lf_')) {
    return {
      valid: false,
      error: 'invalid_api_key',
      code: 'invalid_api_key',
      message: 'Invalid API key format. Keys must start with lf_.'
    };
  }

  const targetPool = options?.pool || getOutreachPool();
  if (!targetPool) {
    return {
      valid: false,
      error: 'invalid_api_key',
      code: 'internal_error',
      message: 'Database temporarily unavailable'
    };
  }

  const keyHash = crypto.createHash('sha256').update(rawKey.trim()).digest('hex');

  const res = await targetPool.query(
    `SELECT id, tenant_id, name, permissions, last_used_at FROM ox_api_keys WHERE key_hash = $1 LIMIT 1`,
    [keyHash]
  );

  if (res.rows.length === 0) {
    return {
      valid: false,
      error: 'invalid_api_key',
      code: 'invalid_api_key',
      message: 'API key not recognized or has been revoked.'
    };
  }

  const row = res.rows[0];
  const permissions: string[] = typeof row.permissions === 'string'
    ? JSON.parse(row.permissions)
    : row.permissions || ['*'];

  // Check Scope
  if (options?.requiredScope && options.requiredScope !== '*') {
    const hasScope = permissions.includes('*') || permissions.includes(options.requiredScope);
    if (!hasScope) {
      return {
        valid: false,
        error: 'insufficient_scope',
        code: 'insufficient_scope',
        message: `API key lacks the required scope: '${options.requiredScope}'. Required scopes: ${options.requiredScope}`
      };
    }
  }

  // Rate Limiting Logic:
  // Default limits: read 60/min, write 15/min, bulk 3/min. Higher on Growth/Scale plans.
  const now = Date.now();
  let bucket = rateLimitMap.get(row.id);
  if (!bucket) {
    bucket = {
      readWindowStart: now,
      readCount: 0,
      writeWindowStart: now,
      writeCount: 0,
      bulkWindowStart: now,
      bulkCount: 0
    };
    rateLimitMap.set(row.id, bucket);
  }

  // Fetch plan tier multiplier
  let readLimit = 60;
  let writeLimit = 15;
  let bulkLimit = 3;

  try {
    const tenantPlan = await getTenantPlan(row.tenant_id, targetPool);
    if (tenantPlan.plan.id === 'growth') {
      readLimit = 180;
      writeLimit = 45;
      bulkLimit = 10;
    } else if (tenantPlan.plan.id === 'scale') {
      readLimit = 600;
      writeLimit = 150;
      bulkLimit = 30;
    }
  } catch {}

  const isBulk = options?.isBulk;
  const isWrite = options?.isWrite;

  if (isBulk) {
    if (now - bucket.bulkWindowStart > 60_000) {
      bucket.bulkWindowStart = now;
      bucket.bulkCount = 1;
    } else {
      bucket.bulkCount += 1;
      if (bucket.bulkCount > bulkLimit) {
        const retryAfterSeconds = Math.ceil((60_000 - (now - bucket.bulkWindowStart)) / 1000);
        return {
          valid: false,
          error: 'rate_limited',
          code: 'rate_limited',
          message: `Bulk API rate limit exceeded (${bulkLimit}/min). Retry in ${retryAfterSeconds}s.`,
          retryAfterSeconds
        };
      }
    }
  } else if (isWrite) {
    if (now - bucket.writeWindowStart > 60_000) {
      bucket.writeWindowStart = now;
      bucket.writeCount = 1;
    } else {
      bucket.writeCount += 1;
      if (bucket.writeCount > writeLimit) {
        const retryAfterSeconds = Math.ceil((60_000 - (now - bucket.writeWindowStart)) / 1000);
        return {
          valid: false,
          error: 'rate_limited',
          code: 'rate_limited',
          message: `Write API rate limit exceeded (${writeLimit}/min). Retry in ${retryAfterSeconds}s.`,
          retryAfterSeconds
        };
      }
    }
  } else {
    // Read request
    if (now - bucket.readWindowStart > 60_000) {
      bucket.readWindowStart = now;
      bucket.readCount = 1;
    } else {
      bucket.readCount += 1;
      if (bucket.readCount > readLimit) {
        const retryAfterSeconds = Math.ceil((60_000 - (now - bucket.readWindowStart)) / 1000);
        return {
          valid: false,
          error: 'rate_limited',
          code: 'rate_limited',
          message: `Read API rate limit exceeded (${readLimit}/min). Retry in ${retryAfterSeconds}s.`,
          retryAfterSeconds
        };
      }
    }
  }

  // Update last_used_at asynchronously
  targetPool.query(`UPDATE ox_api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]).catch(() => {});

  return {
    valid: true,
    tenantId: row.tenant_id,
    keyId: row.id,
    permissions
  };
}
