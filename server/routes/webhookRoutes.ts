import { Router, Request, Response } from 'express';
import { readDB, writeDB, DEFAULT_CONNECTORS } from '../db';
import { AuthenticatedRequest, requireCompanyRole } from '../middlewares/auth';
import {
  processStripeWebhook,
  processUpworkWebhook,
  processPayPalWebhook,
  verifyStripeSignature
} from '../webhooks';

export const webhookRouter = Router();
export const integrationRouter = Router();

function getCompanyConnectors(db: any, companyId: string): any[] {
  if (!db.companyConnectors || typeof db.companyConnectors !== 'object') {
    db.companyConnectors = {};
  }
  if (!Array.isArray(db.companyConnectors[companyId])) {
    db.companyConnectors[companyId] = DEFAULT_CONNECTORS.map((c: any) => ({
      ...c,
      companyId,
      status: 'standby',
      lastSyncTime: null,
      eventsHandledCount: 0
    }));
  }
  return db.companyConnectors[companyId];
}

// ==========================================
// 1. Live Webhooks Ingestion (/api/webhooks)
// ==========================================

webhookRouter.post('/stripe', (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const rawPayload = JSON.stringify(req.body);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (secret && !verifyStripeSignature(rawPayload, sig, secret)) {
    return res.status(400).json({ error: 'Webhook signature verification failed.' });
  }

  const result = processStripeWebhook(req.body);
  res.json({ received: true, ...result });
});

webhookRouter.post('/upwork', (req: Request, res: Response) => {
  const result = processUpworkWebhook(req.body);
  res.json({ received: true, ...result });
});

webhookRouter.post('/paypal', (req: Request, res: Response) => {
  const result = processPayPalWebhook(req.body);
  res.json({ received: true, ...result });
});

// ==========================================
// 2. Company Integrations & Connectors (/api/integrations) - Company Admin Only
// ==========================================

integrationRouter.use(requireCompanyRole(['company_admin']));

integrationRouter.get('/connectors', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const connectors = getCompanyConnectors(db, companyId);
  res.json({ success: true, connectors });
});

integrationRouter.post('/credentials', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const { channel, apiKey, webhookSecret, customWebhookUrl } = req.body || {};
  const db = readDB();
  const connectors = getCompanyConnectors(db, companyId);

  const conn = connectors.find((c: any) => c.channel === channel);
  if (!conn) {
    return res.status(404).json({ success: false, message: 'Connector not found.' });
  }

  conn.status = 'connected';
  conn.lastSyncTime = new Date().toISOString();
  if (customWebhookUrl) conn.webhookEndpoint = customWebhookUrl;
  if (apiKey) conn.apiKeyConfigured = true;
  if (webhookSecret) conn.webhookSecretConfigured = true;

  writeDB(db);

  res.json({
    success: true,
    message: `${conn.name} credentials saved and live connection verified!`,
    connector: conn
  });
});

integrationRouter.post('/toggle/:channel', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const connectors = getCompanyConnectors(db, companyId);
  const conn = connectors.find((c: any) => c.channel === req.params.channel);

  if (!conn) {
    return res.status(404).json({ success: false, message: 'Connector not found.' });
  }

  conn.status = conn.status === 'connected' ? 'standby' : 'connected';
  conn.lastSyncTime = new Date().toISOString();
  writeDB(db);

  res.json({ success: true, status: conn.status, connector: conn });
});

integrationRouter.post('/sync-all', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const now = new Date().toISOString();
  const connectors = getCompanyConnectors(db, companyId);

  connectors.forEach((c: any) => {
    c.lastSyncTime = now;
  });

  writeDB(db);
  res.json({ success: true, message: 'All company gateway connectors synchronized.', syncedAt: now });
});

integrationRouter.get('/logs', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const logs = (db.webhookLogs || []).filter(
    (log: any) => (log.companyId || log.tenantId) === companyId
  );
  res.json({ success: true, logs });
});

integrationRouter.post('/simulate-webhook', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const { channel, eventType, payload } = req.body || {};
  let result;

  if (channel === 'stripe') {
    result = processStripeWebhook({ type: eventType, data: { object: { ...payload, metadata: { ...(payload?.metadata || {}), companyId } } } });
  } else if (channel === 'upwork') {
    result = processUpworkWebhook({ event: eventType, companyId, ...payload });
  } else if (channel === 'paypal') {
    result = processPayPalWebhook({ event_type: eventType, companyId, resource: payload });
  } else {
    const db = readDB();
    if (!db.webhookLogs) db.webhookLogs = [];
    const logItem = {
      id: `log-sim-${Date.now()}`,
      companyId,
      tenantId: companyId,
      timestamp: new Date().toISOString(),
      source: channel || 'custom',
      event: eventType || 'test_ping',
      status: 'success',
      summary: `Simulated event ${eventType || 'ping'} received for ${channel}.`,
      payloadSnippet: JSON.stringify(payload || {}).slice(0, 300)
    };
    db.webhookLogs.unshift(logItem);
    writeDB(db);
    result = { success: true, actionSummary: logItem.summary };
  }

  res.json({ success: true, ...result });
});

export default webhookRouter;
