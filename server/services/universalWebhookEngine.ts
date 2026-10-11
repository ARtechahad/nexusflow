import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { readDB, writeDB } from '../db';
import { logger } from '../logger';
import { requireRole } from '../middlewares/auth';
import { queueEngine } from './queueEngine';

export interface WebhookRegistration {
  id: string;
  tenantId: string;
  name: string;
  targetUrl: string;
  events: string[]; // e.g. ['lead.created', 'payment.cleared', 'project.transferred']
  secret: string;
  isActive: boolean;
  createdAt: string;
  lastTriggeredAt?: string;
}

export function generateHMACSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export class UniversalWebhookService {
  public static registerWebhook(
    tenantId: string,
    name: string,
    targetUrl: string,
    events: string[]
  ): WebhookRegistration {
    const db = readDB();
    if (!Array.isArray(db.registeredWebhooks)) db.registeredWebhooks = [];

    const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;
    const webhook: WebhookRegistration = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tenantId: tenantId || 'tenant-alm-nexus',
      name: name.trim(),
      targetUrl: targetUrl.trim(),
      events,
      secret,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    db.registeredWebhooks.push(webhook as any);
    writeDB(db);

    logger.info(`Registered external webhook "${name}" -> ${targetUrl} for events: ${events.join(', ')}`, {
      context: 'UniversalWebhook',
      tenantId
    });

    return webhook;
  }

  public static dispatchEvent(tenantId: string, eventName: string, data: any): void {
    const db = readDB();
    const webhooks = (db.registeredWebhooks || []) as WebhookRegistration[];

    const matching = webhooks.filter(
      w => w.isActive && (w.tenantId === tenantId || w.tenantId === 'tenant-global') && (w.events.includes('*') || w.events.includes(eventName))
    );

    matching.forEach(wh => {
      const payloadStr = JSON.stringify({
        event: eventName,
        tenantId,
        timestamp: new Date().toISOString(),
        data
      });

      const signature = generateHMACSignature(payloadStr, wh.secret);

      // Queue async webhook delivery with retries
      queueEngine.addJob(
        'webhook_dispatch',
        {
          url: wh.targetUrl,
          event: eventName,
          signature,
          payload: JSON.parse(payloadStr)
        },
        tenantId
      );

      wh.lastTriggeredAt = new Date().toISOString();
    });

    if (matching.length > 0) writeDB(db);
  }
}

export const universalWebhookRouter = Router();

// GET /api/webhooks/register - List registered webhooks
universalWebhookRouter.get('/register', requireRole(['admin', 'bd_head']), (req: Request, res: Response) => {
  const db = readDB();
  const tenantId = (req as any).tenant_id || 'tenant-alm-nexus';
  const list = ((db.registeredWebhooks || []) as WebhookRegistration[]).filter(
    w => !w.tenantId || w.tenantId === tenantId || w.tenantId === 'tenant-global'
  );

  res.json({
    success: true,
    data: list
  });
});

// POST /api/webhooks/register - Register new webhook subscriber
universalWebhookRouter.post('/register', requireRole(['admin', 'bd_head']), (req: Request, res: Response) => {
  const { name, targetUrl, events } = req.body || {};
  if (!name || !targetUrl) {
    return res.status(400).json({ success: false, error: 'Name and targetUrl are required.' });
  }

  const tenantId = (req as any).tenant_id || 'tenant-alm-nexus';
  const activeEvents = Array.isArray(events) && events.length > 0 ? events : ['*'];

  const record = UniversalWebhookService.registerWebhook(tenantId, name, targetUrl, activeEvents);

  res.json({
    success: true,
    message: `Webhook subscription "${name}" registered successfully.`,
    data: record
  });
});

// POST /api/webhooks/dispatch - Test manual event dispatch
universalWebhookRouter.post('/dispatch', requireRole(['admin', 'bd_head']), (req: Request, res: Response) => {
  const { eventName, payload } = req.body || {};
  const tenantId = (req as any).tenant_id || 'tenant-alm-nexus';

  UniversalWebhookService.dispatchEvent(tenantId, eventName || 'test.ping', payload || { ping: true });

  res.json({
    success: true,
    message: `Webhook event "${eventName || 'test.ping'}" dispatched to all active subscribers.`
  });
});
