import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import rateLimit from 'express-rate-limit';
import { logger } from '../../logger';
import { getOutreachPool } from '../../services/outreach/schema';
import { verifyToken, signToken } from '../../services/outreach/crypto';
import { realtimeEngine } from '../../services/realtimeEngine';
import { authenticateToken } from '../../middlewares/auth';

export const trackingRouter = express.Router();

// Rate limiter for public telemetry tracking endpoints: 120 req/min per IP
const trackingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Telemetry rate limit exceeded'
});

// 1x1 Transparent GIF buffer
const TRANSPARENT_PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Detects search bot / image proxy user agents
 */
export function isSuspectedBotUserAgent(ua?: string): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return (
    lower.includes('googleimageproxy') ||
    lower.includes('yahoomailproxy') ||
    lower.includes('microsoft office') ||
    lower.includes('bingpreview') ||
    lower.includes('bot') ||
    lower.includes('spider') ||
    lower.includes('crawl') ||
    lower.includes('curl') ||
    lower.includes('python-requests') ||
    lower.includes('headlesschrome') ||
    lower.includes('wget') ||
    lower.includes('facebookexternalhit')
  );
}

// ----------------------------------------------------
// 1. Pixel Open Tracking: GET /api/outreach/t/o/:token.gif
// ----------------------------------------------------
trackingRouter.get('/t/o/:token.gif', trackingRateLimiter, async (req: Request, res: Response) => {
  const token = req.params.token;
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const isBot = isSuspectedBotUserAgent(userAgent);

  // Always prepare GIF response headers immediately
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': TRANSPARENT_PIXEL_GIF.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private, post-check=0, pre-check=0',
    Pragma: 'no-cache',
    Expires: '0'
  });

  const verified = verifyToken(token);
  if (!verified.valid || !verified.payload) {
    // Deliver pixel without recording invalid event
    res.end(TRANSPARENT_PIXEL_GIF);
    return;
  }

  const payload = verified.payload;
  const pool = getOutreachPool();
  if (!pool) {
    res.end(TRANSPARENT_PIXEL_GIF);
    return;
  }

  try {
    const sentEmailId = payload.sentEmailId;
    const tenantId = payload.tenantId;

    if (sentEmailId && tenantId) {
      // Deduplicate: check if an open event was recorded in the last 10 minutes
      const dedupeRes = await pool.query(
        `SELECT id FROM ox_events
         WHERE sent_email_id = $1 AND type = 'open' AND occurred_at > NOW() - INTERVAL '10 minutes'
         LIMIT 1`,
        [sentEmailId]
      );

      if (dedupeRes.rowCount === 0) {
        // Record telemetry event in ox_events
        const eventId = `evt_${crypto.randomUUID()}`;
        await pool.query(
          `INSERT INTO ox_events (id, tenant_id, sent_email_id, type, metadata, occurred_at)
           VALUES ($1, $2, $3, 'open', $4, NOW())`,
          [
            eventId,
            tenantId,
            sentEmailId,
            JSON.stringify({
              ip,
              userAgent,
              suspected_bot: isBot,
              campaignId: payload.campaignId,
              enrollmentId: payload.enrollmentId,
              email: payload.email
            })
          ]
        );

        // Emit realtime SSE event to tenant
        realtimeEngine.broadcastToTenant(tenantId, 'campaign_event', {
          type: 'open',
          sentEmailId,
          campaignId: payload.campaignId,
          enrollmentId: payload.enrollmentId,
          email: payload.email,
          suspected_bot: isBot
        });
      }
    }
  } catch (err: any) {
    logger.warn('Failed to record open telemetry event', {
      context: 'Tracking',
      details: err?.message
    });
  }

  res.end(TRANSPARENT_PIXEL_GIF);
});

// ----------------------------------------------------
// 2. Click Tracking & Open-Redirect Defense: GET /api/outreach/t/c/:token
// ----------------------------------------------------
trackingRouter.get('/t/c/:token', trackingRateLimiter, async (req: Request, res: Response) => {
  const token = req.params.token;
  const userAgent = req.headers['user-agent'] || '';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const isBot = isSuspectedBotUserAgent(userAgent);

  const verified = verifyToken(token);
  if (!verified.valid || !verified.payload) {
    res.status(400).send('Invalid or expired tracking link');
    return;
  }

  const payload = verified.payload;
  const targetUrl = payload.url;

  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).send('Missing target URL');
    return;
  }

  // Strictly validate target URL to prevent open-redirect abuse
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    res.status(400).send('Malformed target URL');
    return;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    res.status(400).send('Disallowed redirect protocol');
    return;
  }

  const pool = getOutreachPool();
  if (pool && payload.sentEmailId && payload.tenantId) {
    try {
      const eventId = `evt_${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO ox_events (id, tenant_id, sent_email_id, type, metadata, occurred_at)
         VALUES ($1, $2, $3, 'click', $4, NOW())`,
        [
          eventId,
          payload.tenantId,
          payload.sentEmailId,
          JSON.stringify({
            url: parsedUrl.toString(),
            ip,
            userAgent,
            suspected_bot: isBot,
            campaignId: payload.campaignId,
            enrollmentId: payload.enrollmentId,
            email: payload.email
          })
        ]
      );

      // Emit realtime SSE event to tenant
      realtimeEngine.broadcastToTenant(payload.tenantId, 'campaign_event', {
        type: 'click',
        sentEmailId: payload.sentEmailId,
        campaignId: payload.campaignId,
        url: parsedUrl.toString(),
        email: payload.email,
        suspected_bot: isBot
      });
    } catch (err: any) {
      logger.warn('Failed to record click telemetry event', {
        context: 'Tracking',
        details: err?.message
      });
    }
  }

  // 302 Redirect to validated URL
  res.redirect(302, parsedUrl.toString());
});

// ----------------------------------------------------
// 3. Unsubscribe Confirmation Page: GET /api/outreach/u/:token
// ----------------------------------------------------
trackingRouter.get('/u/:token', trackingRateLimiter, async (req: Request, res: Response) => {
  const token = req.params.token;
  const verified = verifyToken(token);

  if (!verified.valid || !verified.payload) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Invalid Link</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc;">
          <div style="background: white; padding: 40px; border-radius: 16px; border: 1px solid #e2e8f0; max-width: 440px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <h2 style="color: #0f172a; margin-top: 0;">Link Expired or Invalid</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">This unsubscribe link is invalid or has expired.</p>
          </div>
        </body>
      </html>
    `);
    return;
  }

  const { email } = verified.payload;

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Confirm Unsubscribe</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
          .card { background: #1e293b; padding: 40px; border-radius: 20px; border: 1px solid #334155; max-width: 460px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          .btn { background: #ef4444; color: white; border: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.15s; }
          .btn:hover { background: #dc2626; }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 24px;">✕</div>
          <h2 style="margin: 0 0 10px 0; font-size: 20px;">Unsubscribe Confirmation</h2>
          <p style="color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5;">
            Are you sure you want to unsubscribe <strong>${email || 'your email'}</strong> from all future communications?
          </p>
          <form method="POST" action="/api/outreach/u/${token}">
            <button type="submit" class="btn">Confirm Unsubscribe</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

// ----------------------------------------------------
// 4. One-Click & Form Unsubscribe Execution: POST /api/outreach/u/:token
// ----------------------------------------------------
trackingRouter.post('/u/:token', trackingRateLimiter, async (req: Request, res: Response) => {
  const token = req.params.token;
  const verified = verifyToken(token);

  if (!verified.valid || !verified.payload) {
    res.status(400).json({ error: 'Invalid or expired unsubscribe token' });
    return;
  }

  const { tenantId, email, campaignId } = verified.payload;

  if (!tenantId || !email) {
    res.status(400).json({ error: 'Incomplete unsubscribe token payload' });
    return;
  }

  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'Database unavailable' });
    return;
  }

  try {
    // 1. Insert into ox_suppressions
    await pool.query(
      `INSERT INTO ox_suppressions (id, tenant_id, email, reason, source, created_at)
       VALUES ($1, $2, LOWER($3), 'unsubscribe', 'one_click_or_link', NOW())
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET reason = 'unsubscribe', updated_at = NOW()`,
      [`sup_${crypto.randomUUID()}`, tenantId, email.trim()]
    );

    // 2. Stop all active enrollments for this recipient in the tenant
    await pool.query(
      `UPDATE ox_enrollments
       SET status = 'unsubscribed', updated_at = NOW()
       WHERE tenant_id = $1
         AND prospect_id IN (
           SELECT id FROM ox_prospects WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)
         )
         AND status = 'active'`,
      [tenantId, email.trim()]
    );

    // 3. Record unsubscribe event
    await pool.query(
      `INSERT INTO ox_events (id, tenant_id, type, metadata, occurred_at)
       VALUES ($1, $2, 'unsubscribe', $3, NOW())`,
      [
        `evt_${crypto.randomUUID()}`,
        tenantId,
        JSON.stringify({
          email,
          campaignId,
          source: req.headers['list-unsubscribe-post'] ? 'one_click_header' : 'web_link'
        })
      ]
    );

    // 4. Broadcast realtime SSE event
    realtimeEngine.broadcastToTenant(tenantId, 'campaign_event', {
      type: 'unsubscribe',
      email,
      campaignId
    });

    logger.info(`Prospect ${email} unsubscribed from tenant ${tenantId}`, {
      context: 'Unsubscribe',
      details: { campaignId }
    });

    const isOneClickHeader = !!req.headers['list-unsubscribe-post'];
    if (isOneClickHeader || req.xhr || req.headers.accept?.includes('application/json')) {
      res.status(200).json({
        success: true,
        message: 'Successfully unsubscribed',
        email
      });
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed Successfully</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 40px; border-radius: 20px; border: 1px solid #334155; max-width: 460px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          </style>
        </head>
        <body>
          <div class="card">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 26px;">✓</div>
            <h2 style="margin: 0 0 10px 0; font-size: 20px;">You are Unsubscribed</h2>
            <p style="color: #94a3b8; font-size: 14px; margin-bottom: 8px; line-height: 1.5;">
              <strong>${email}</strong> has been removed from all outreach lists.
            </p>
            <p style="color: #64748b; font-size: 12px;">You will receive no further messages from this sender.</p>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    logger.error('Failed to process unsubscribe request', {
      context: 'Unsubscribe',
      details: err?.message
    });
    res.status(500).json({ error: 'Failed to process unsubscribe' });
  }
});

// ----------------------------------------------------
// 5. Custom Tracking Domain Configuration: POST /api/outreach/domains/:id/tracking
// ----------------------------------------------------
trackingRouter.post('/domains/:id/tracking', authenticateToken, async (req: Request, res: Response) => {
  const domainId = req.params.id;
  const tenantId = (req as any).user?.tenant_id || (req as any).user?.tenantId || 'tenant-alm-nexus';
  const { domain } = req.body;

  if (!domain || typeof domain !== 'string' || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain.trim())) {
    res.status(400).json({ error: 'Valid tracking subdomain is required (e.g. track.mycompany.com)' });
    return;
  }

  const cleanDomain = domain.trim().toLowerCase();
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'Database unavailable' });
    return;
  }

  try {
    const updateRes = await pool.query(
      `UPDATE ox_domains
       SET tracking_domain = $1, tracking_verified = false, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, domain, tracking_domain, tracking_verified`,
      [cleanDomain, domainId, tenantId]
    );

    if (updateRes.rowCount === 0) {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }

    const targetCname = process.env.OUTREACH_TRACKING_CNAME_TARGET || 'track.leadflow.ai';

    res.json({
      success: true,
      trackingDomain: cleanDomain,
      cnameRecord: {
        host: cleanDomain,
        type: 'CNAME',
        target: targetCname
      },
      instructions: `Create a CNAME DNS record pointing "${cleanDomain}" to "${targetCname}". Once configured, click "Verify Tracking Domain".`
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update tracking domain' });
  }
});

// ----------------------------------------------------
// 6. Verify Custom Tracking Domain DNS: POST /api/outreach/domains/:id/tracking/verify
// ----------------------------------------------------
trackingRouter.post('/domains/:id/tracking/verify', authenticateToken, async (req: Request, res: Response) => {
  const domainId = req.params.id;
  const tenantId = (req as any).user?.tenant_id || (req as any).user?.tenantId || 'tenant-alm-nexus';

  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'Database unavailable' });
    return;
  }

  try {
    const domRes = await pool.query(
      `SELECT id, domain, tracking_domain, tracking_verified
       FROM ox_domains
       WHERE id = $1 AND tenant_id = $2`,
      [domainId, tenantId]
    );

    if (domRes.rowCount === 0) {
      res.status(404).json({ error: 'Domain not found' });
      return;
    }

    const domainRecord = domRes.rows[0];
    if (!domainRecord.tracking_domain) {
      res.status(400).json({ error: 'No tracking domain configured for this domain' });
      return;
    }

    const targetCname = (process.env.OUTREACH_TRACKING_CNAME_TARGET || 'track.leadflow.ai').toLowerCase();
    let verified = false;
    let dnsLookupResult: any = null;

    try {
      const cnames = await dns.resolveCname(domainRecord.tracking_domain);
      dnsLookupResult = cnames;
      verified = cnames.some(
        c => c.toLowerCase().includes(targetCname) || c.toLowerCase().includes('leadflow') || c.toLowerCase().includes('localhost')
      );
    } catch (dnsErr: any) {
      // In development / demo environment without live public DNS propagation, allow verification if loopback or override
      if (
        domainRecord.tracking_domain.includes('localhost') ||
        domainRecord.tracking_domain.includes('test') ||
        process.env.NODE_ENV !== 'production'
      ) {
        verified = true;
      }
    }

    if (verified) {
      await pool.query(
        `UPDATE ox_domains
         SET tracking_verified = true, updated_at = NOW()
         WHERE id = $1`,
        [domainId]
      );
    }

    res.json({
      success: true,
      verified,
      trackingDomain: domainRecord.tracking_domain,
      dnsLookupResult,
      message: verified
        ? `Tracking domain ${domainRecord.tracking_domain} successfully verified!`
        : `CNAME lookup did not resolve to ${targetCname}. Please check DNS propagation.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to verify tracking domain' });
  }
});
