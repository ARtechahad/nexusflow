import type { Request, Response, NextFunction } from 'express';
import { verifyApiKey, ApiScope } from '../services/outreach/apiKeys';
import { getOutreachPool } from '../services/outreach/schema';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      apiKeyId?: string;
      tenantId?: string;
      permissions?: string[];
      isApiKeyAuth?: boolean;
    }
  }
}

/**
 * Middleware that authenticates requests using an Outreach API key (lf_...)
 * and enforces the required scope.
 */
export function requireApiKeyScope(
  requiredScope: ApiScope = '*',
  options: { isWrite?: boolean; isBulk?: boolean } = {}
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization || '';
    const customHeader = (req.headers['x-api-key'] as string) || '';

    let rawKey = '';
    if (authHeader.startsWith('Bearer lf_')) {
      rawKey = authHeader.replace(/^Bearer\s+/i, '').trim();
    } else if (customHeader.startsWith('lf_')) {
      rawKey = customHeader.trim();
    } else if (authHeader.startsWith('lf_')) {
      rawKey = authHeader.trim();
    }

    if (!rawKey) {
      res.status(401).json({
        error: 'unauthorized',
        code: 'missing_api_key',
        message: 'Outreach API key required in Authorization: Bearer lf_... header.'
      });
      return;
    }

    const verification = await verifyApiKey(rawKey, {
      requiredScope,
      isWrite: options.isWrite ?? ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method),
      isBulk: options.isBulk ?? req.path.includes('/bulk')
    });

    if (!verification.valid) {
      if (verification.error === 'rate_limited') {
        if (verification.retryAfterSeconds) {
          res.setHeader('Retry-After', verification.retryAfterSeconds);
        }
        res.status(429).json({
          error: 'rate_limited',
          code: 'rate_limited',
          message: verification.message,
          retry_after_seconds: verification.retryAfterSeconds
        });
        return;
      }

      if (verification.error === 'insufficient_scope') {
        res.status(403).json({
          error: 'insufficient_scope',
          code: 'insufficient_scope',
          message: verification.message,
          required_scope: requiredScope
        });
        return;
      }

      res.status(401).json({
        error: 'unauthorized',
        code: verification.code || 'invalid_api_key',
        message: verification.message || 'Invalid or revoked API key.'
      });
      return;
    }

    req.tenantId = verification.tenantId;
    req.apiKeyId = verification.keyId;
    req.permissions = verification.permissions;
    req.isApiKeyAuth = true;

    next();
  };
}

/**
 * Idempotency Key Middleware for REST POST requests
 * Caches and returns stored responses for 24h when matching Idempotency-Key header is supplied.
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const idempotencyKey = (req.headers['idempotency-key'] as string)?.trim();
  if (!idempotencyKey || req.method !== 'POST') {
    return next();
  }

  const pool = getOutreachPool();
  if (!pool) {
    return next();
  }

  const tenantId = req.tenantId || (req as any).user?.tenant_id || (req as any).user?.tenantId || 'tenant-global';

  try {
    const existing = await pool.query(
      `SELECT status_code, response_body
       FROM ox_idempotency_keys
       WHERE tenant_id = $1 AND key = $2 AND expires_at > NOW()
       LIMIT 1`,
      [tenantId, idempotencyKey]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      res.setHeader('X-Cache-Lookup', 'HIT');
      res.setHeader('X-Idempotent-Replay', 'true');
      res.status(row.status_code).json(
        typeof row.response_body === 'string' ? JSON.parse(row.response_body) : row.response_body
      );
      return;
    }
  } catch {
    // Proceed if idempotency check fails
  }

  // Intercept response to store result
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    // Asynchronously cache response for 24 hours
    pool.query(
      `INSERT INTO ox_idempotency_keys (key, tenant_id, status_code, response_body, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours', NOW())
       ON CONFLICT (tenant_id, key) DO UPDATE
       SET status_code = EXCLUDED.status_code,
           response_body = EXCLUDED.response_body,
           expires_at = NOW() + INTERVAL '24 hours'`,
      [idempotencyKey, tenantId, res.statusCode || 200, JSON.stringify(body)]
    ).catch(() => {});

    return originalJson(body);
  };

  next();
}
