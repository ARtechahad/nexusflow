import crypto from 'node:crypto';
import pg from 'pg';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';

export const SUPPORTED_WEBHOOK_EVENTS = [
  'email.sent',
  'email.opened',
  'email.clicked',
  'reply.received',
  'email.bounced',
  'lead.unsubscribed',
  'campaign.completed'
] as const;

export type WebhookEvent = typeof SUPPORTED_WEBHOOK_EVENTS[number] | '*';

export interface WebhookEndpoint {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryRecord {
  id: string;
  tenant_id: string;
  webhook_id: string;
  event: string;
  payload: any;
  status_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  attempt: number;
  max_attempts: number;
  next_retry_at: string | null;
  status: 'delivered' | 'retrying' | 'failed';
  created_at: string;
}

/**
 * SSRF Protection: Checks destination URL against private IP blocks and internal metadata services.
 */
export function validateWebhookUrl(urlString: string): { isValid: boolean; error?: string } {
  try {
    const parsed = new URL(urlString);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: 'Webhook URL must use http or https protocol.' };
    }

    const host = parsed.hostname.toLowerCase();

    // Loopback, localhost, and internal hostnames
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return { isValid: false, error: 'Destination URL points to a forbidden local address (SSRF protection).' };
    }

    // Cloud metadata services
    if (host === '169.254.169.254' || host === 'metadata.google.internal' || host.includes('metadata')) {
      return { isValid: false, error: 'Destination URL points to cloud metadata services (SSRF protection).' };
    }

    // RFC1918 Private IP ranges
    const parts = host.split('.').map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      const [p0, p1] = parts;
      if (
        p0 === 10 || // 10.0.0.0/8
        (p0 === 172 && p1 >= 16 && p1 <= 31) || // 172.16.0.0/12
        (p0 === 192 && p1 === 168) || // 192.168.0.0/16
        (p0 === 169 && p1 === 254) // 169.254.0.0/16
      ) {
        return { isValid: false, error: 'Destination URL points to a private network address (SSRF protection).' };
      }
    }

    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: `Invalid URL format: ${err?.message}` };
  }
}

/**
 * Signs a webhook payload using HMAC-SHA256.
 * Header format: X-LeadFlow-Signature: t=<unix_timestamp>,v1=<hex_signature>
 * Signature string: `${timestamp}.${body}`
 */
export function signWebhookPayload(
  secret: string,
  payload: any,
  timestamp: number = Math.floor(Date.now() / 1000)
): { signatureHeader: string; timestamp: number; signature: string } {
  const bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signPayload = `${timestamp}.${bodyString}`;
  const signature = crypto.createHmac('sha256', secret).update(signPayload).digest('hex');

  return {
    signatureHeader: `t=${timestamp},v1=${signature}`,
    timestamp,
    signature
  };
}

/**
 * Standard signature verification helper (used by consumers, tests, and documentation).
 */
export function verifyWebhookSignature(
  signatureHeader: string,
  rawBody: string | Buffer,
  secret: string,
  toleranceSeconds: number = 300
): { isValid: boolean; error?: string } {
  if (!signatureHeader || !secret) {
    return { isValid: false, error: 'Missing signature header or secret' };
  }

  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, pair) => {
    const [k, v] = pair.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const timestampStr = parts['t'];
  const expectedSig = parts['v1'];

  if (!timestampStr || !expectedSig) {
    return { isValid: false, error: 'Invalid signature header format, must contain t= and v1=' };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { isValid: false, error: 'Invalid timestamp in signature' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (toleranceSeconds > 0 && Math.abs(now - timestamp) > toleranceSeconds) {
    return { isValid: false, error: `Webhook timestamp outside allowed tolerance of ${toleranceSeconds} seconds` };
  }

  const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
  const computedSig = crypto.createHmac('sha256', secret).update(`${timestamp}.${bodyString}`).digest('hex');

  // Timing safe comparison to prevent timing attacks
  const bufExpected = Buffer.from(expectedSig, 'hex');
  const bufComputed = Buffer.from(computedSig, 'hex');

  if (bufExpected.length !== bufComputed.length || !crypto.timingSafeEqual(bufExpected, bufComputed)) {
    return { isValid: false, error: 'Signature mismatch' };
  }

  return { isValid: true };
}

/**
 * Creates a new webhook endpoint.
 */
export async function createWebhookEndpoint(
  tenantId: string,
  data: { url: string; events?: string[]; secret?: string },
  pool?: pg.Pool
): Promise<WebhookEndpoint> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) {
    throw new Error('Database pool unavailable to create webhook');
  }

  const ssrfCheck = validateWebhookUrl(data.url);
  if (!ssrfCheck.isValid) {
    throw new Error(ssrfCheck.error || 'Invalid webhook destination URL');
  }

  const id = `wh_${crypto.randomUUID()}`;
  const secret = data.secret?.trim() || `whsec_${crypto.randomBytes(24).toString('hex')}`;
  const events = Array.isArray(data.events) && data.events.length > 0 ? data.events : ['*'];

  await targetPool.query(
    `INSERT INTO ox_webhooks (id, tenant_id, url, secret, events, is_active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
    [id, tenantId, data.url.trim(), secret, JSON.stringify(events)]
  );

  return {
    id,
    tenant_id: tenantId,
    url: data.url.trim(),
    secret,
    events,
    is_active: true,
    last_triggered_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * Lists all registered webhook endpoints for a tenant.
 */
export async function listWebhookEndpoints(tenantId: string, pool?: pg.Pool): Promise<WebhookEndpoint[]> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) return [];

  const res = await targetPool.query(
    `SELECT id, tenant_id, url, secret, events, is_active, last_triggered_at, created_at, updated_at
     FROM ox_webhooks
     WHERE tenant_id = $1
     ORDER BY created_at DESC`,
    [tenantId]
  );

  return res.rows.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    url: r.url,
    secret: r.secret,
    events: typeof r.events === 'string' ? JSON.parse(r.events) : r.events,
    is_active: r.is_active,
    last_triggered_at: r.last_triggered_at ? new Date(r.last_triggered_at).toISOString() : null,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString()
  }));
}

/**
 * Deletes a webhook endpoint.
 */
export async function deleteWebhookEndpoint(tenantId: string, webhookId: string, pool?: pg.Pool): Promise<boolean> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) return false;

  const res = await targetPool.query(
    `DELETE FROM ox_webhooks WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [webhookId, tenantId]
  );

  return (res.rowCount ?? 0) > 0;
}

/**
 * Performs a single HTTP delivery of a webhook event with SSRF check, HMAC signing, and delivery logging.
 */
export async function deliverWebhook(
  webhook: WebhookEndpoint,
  event: string,
  payload: any,
  attempt: number = 1,
  pool?: pg.Pool
): Promise<{ success: boolean; statusCode: number | null; error?: string; deliveryId: string }> {
  const targetPool = pool || getOutreachPool();
  const deliveryId = `del_${crypto.randomUUID()}`;

  const envelope = {
    id: `evt_${crypto.randomUUID()}`,
    event,
    timestamp: new Date().toISOString(),
    tenant_id: webhook.tenant_id,
    data: payload
  };

  const bodyStr = JSON.stringify(envelope);
  const { signatureHeader } = signWebhookPayload(webhook.secret, bodyStr);

  const startTime = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let isSuccess = false;

  try {
    const ssrfCheck = validateWebhookUrl(webhook.url);
    if (!ssrfCheck.isValid) {
      throw new Error(`SSRF Block: ${ssrfCheck.error}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LeadFlow-Outreach-Webhooks/1.0',
        'X-LeadFlow-Signature': signatureHeader,
        'X-LeadFlow-Event': event,
        'X-LeadFlow-Delivery': deliveryId
      },
      body: bodyStr,
      signal: controller.signal
    });

    clearTimeout(timeout);
    statusCode = res.status;
    const text = await res.text();
    responseBody = text.slice(0, 2000); // Truncate response
    isSuccess = res.status >= 200 && res.status < 300;
  } catch (err: any) {
    statusCode = null;
    responseBody = err?.message || 'Network request failed';
    isSuccess = false;
  }

  const durationMs = Date.now() - startTime;
  const status = isSuccess ? 'delivered' : (attempt >= 5 ? 'failed' : 'retrying');

  // Compute exponential backoff retry time
  // Retry 1: +1m, Retry 2: +5m, Retry 3: +30m, Retry 4: +2h
  const backoffDelaysMs = [60_000, 300_000, 1800_000, 7200_000];
  const nextRetryAt = !isSuccess && attempt < 5
    ? new Date(Date.now() + (backoffDelaysMs[attempt - 1] || 14400_000))
    : null;

  if (targetPool) {
    try {
      await targetPool.query(
        `INSERT INTO ox_webhook_deliveries (
           id, tenant_id, webhook_id, event, payload, status_code,
           response_body, duration_ms, attempt, max_attempts, next_retry_at, status, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 5, $10, $11, NOW())`,
        [
          deliveryId,
          webhook.tenant_id,
          webhook.id,
          event,
          JSON.stringify(envelope),
          statusCode,
          responseBody,
          durationMs,
          attempt,
          nextRetryAt,
          status
        ]
      );

      // Update webhook last_triggered_at
      await targetPool.query(
        `UPDATE ox_webhooks SET last_triggered_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [webhook.id]
      );
    } catch (dbErr: any) {
      logger.warn('[Webhooks] Failed to record delivery record to DB', { details: dbErr?.message });
    }
  }

  return {
    success: isSuccess,
    statusCode,
    error: isSuccess ? undefined : responseBody || 'Delivery failed',
    deliveryId
  };
}

/**
 * Dispatches a webhook event to all subscribed endpoints for a tenant.
 */
export async function dispatchWebhookEvent(
  tenantId: string,
  event: string,
  payload: any,
  pool?: pg.Pool
): Promise<number> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) return 0;

  const res = await targetPool.query(
    `SELECT * FROM ox_webhooks WHERE tenant_id = $1 AND is_active = true`,
    [tenantId]
  );

  let deliveredCount = 0;
  for (const row of res.rows) {
    const events: string[] = typeof row.events === 'string' ? JSON.parse(row.events) : row.events;
    if (events.includes('*') || events.includes(event)) {
      const hook: WebhookEndpoint = {
        id: row.id,
        tenant_id: row.tenant_id,
        url: row.url,
        secret: row.secret,
        events,
        is_active: row.is_active,
        last_triggered_at: row.last_triggered_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      };

      // Deliver asynchronously
      deliverWebhook(hook, event, payload, 1, targetPool).catch((err) => {
        logger.warn(`[Webhooks] Delivery error for hook ${hook.id}`, { details: err?.message });
      });
      deliveredCount++;
    }
  }

  return deliveredCount;
}

/**
 * Replays a previous webhook delivery.
 */
export async function replayWebhookDelivery(
  tenantId: string,
  deliveryId: string,
  pool?: pg.Pool
): Promise<{ success: boolean; result: any }> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) throw new Error('Database pool unavailable');

  const delRes = await targetPool.query(
    `SELECT d.*, w.url, w.secret, w.events, w.is_active
     FROM ox_webhook_deliveries d
     JOIN ox_webhooks w ON d.webhook_id = w.id
     WHERE d.id = $1 AND d.tenant_id = $2`,
    [deliveryId, tenantId]
  );

  if (delRes.rows.length === 0) {
    throw new Error('Delivery record not found');
  }

  const row = delRes.rows[0];
  const hook: WebhookEndpoint = {
    id: row.webhook_id,
    tenant_id: row.tenant_id,
    url: row.url,
    secret: row.secret,
    events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events,
    is_active: row.is_active,
    last_triggered_at: null,
    created_at: row.created_at,
    updated_at: row.created_at
  };

  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  const deliveryResult = await deliverWebhook(hook, row.event, payload.data || payload, row.attempt + 1, targetPool);

  return {
    success: deliveryResult.success,
    result: deliveryResult
  };
}

/**
 * Lists delivery logs for a webhook.
 */
export async function listWebhookDeliveries(
  tenantId: string,
  webhookId?: string,
  limit: number = 50,
  pool?: pg.Pool
): Promise<WebhookDeliveryRecord[]> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) return [];

  let query = `SELECT * FROM ox_webhook_deliveries WHERE tenant_id = $1`;
  const params: any[] = [tenantId];

  if (webhookId) {
    query += ` AND webhook_id = $2`;
    params.push(webhookId);
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const res = await targetPool.query(query, params);

  return res.rows.map((r) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    webhook_id: r.webhook_id,
    event: r.event,
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
    status_code: r.status_code,
    response_body: r.response_body,
    duration_ms: r.duration_ms,
    attempt: r.attempt,
    max_attempts: r.max_attempts,
    next_retry_at: r.next_retry_at ? new Date(r.next_retry_at).toISOString() : null,
    status: r.status,
    created_at: new Date(r.created_at).toISOString()
  }));
}
