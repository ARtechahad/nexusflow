import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Resolve __dirname and __filename across both ESM (tsx) and CJS (dist bundle)
const getFilename = () => {
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return typeof __filename !== 'undefined' ? __filename : '';
  }
};
const appFilename = getFilename();
const appDirname = appFilename ? path.dirname(appFilename) : process.cwd();

// Database & Persistence initialization
import { initPostgresPool, readDB, writeDB, INITIAL_DB } from './server/db';

// Logger & Security Pipeline
import { requestCorrelationMiddleware, logger } from './server/logger';
import {
  securityHeaders,
  dynamicCors,
  globalRateLimiter,
  compressionMiddleware,
  parseCookies
} from './server/middlewares/security';

// Middlewares
import { authenticateToken } from './server/middlewares/auth';

// Modular Route Handlers
import authRoutes from './server/routes/authRoutes';
import tenantRouter from './server/routes/tenantRoutes';
import { projectRouter, portalRouter, leadScoreRouter } from './server/routes/projectRoutes';
import chatRouter from './server/routes/chatRoutes';
import { fileRouter, gdprRouter } from './server/routes/fileRoutes';
import { aiRouter, inboxRouter } from './server/routes/aiRoutes';
import { scraperRouter, ingestRouter } from './server/routes/scraperRoutes';
import { dripRouter, nudgeRouter } from './server/routes/dripRoutes';
import { invoiceRouter, commissionRouter, analyticsRouter } from './server/routes/invoiceRoutes';
import { webhookRouter, integrationRouter } from './server/routes/webhookRoutes';
import {
  databaseRouter,
  apiTokensRouter,
  auditLogsRouter,
  agencyRouter,
  generalRouter
} from './server/routes/databaseRoutes';

// Upgraded Functional Engine Handlers
import { eventsRouter } from './server/services/realtimeEngine';
import { contractRouter } from './server/services/contractPdfEngine';
import { universalWebhookRouter } from './server/services/universalWebhookEngine';
import { rateCardRouter } from './server/services/rateCardEngine';
import { offlineSyncRouter } from './server/routes/offlineSyncRoutes';
import { emailRouter } from './server/services/emailEngine';
import { gtmToolsRouter } from './server/routes/gtmToolsRoutes';
import { checkoutRouter } from './server/routes/checkoutRoutes';

// Outreach Suite Module
import { outreachSystemRouter } from './server/routes/outreach/systemRoutes';
import { mailboxesRouter } from './server/routes/outreach/mailboxes';
import { campaignsRouter } from './server/routes/outreach/campaigns';
import { ensureOutreachSchema, getOutreachPool } from './server/services/outreach/schema';
import { startQueueWorker, stopQueueWorker } from './server/services/outreach/queue';
import { initSequencer } from './server/services/outreach/sequencer';

dotenv.config();

// Global crash resilience for production deployments
process.on('unhandledRejection', (reason, promise) => {
  logger.warn(`Unhandled Rejection at: ${promise}`, { details: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { details: error.stack });
});

const app = express();

// Trust reverse proxies (Cloud Run, Container Nginx, Railway) for express-rate-limit and X-Forwarded-For IP resolution
app.set('trust proxy', 1);

// Detect AI Studio container preview environment vs external hosting platforms (Railway, Render, Cloud Run, etc.)
const isRailwayOrExternal = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.RAILWAY_SERVICE_ID ||
  process.env.RAILWAY_STATIC_URL ||
  process.env.RENDER ||
  (!process.env.APPLET_ID && process.env.PORT)
);

// In external platforms like Railway, Render, or Docker, strictly read PORT from process.env.PORT (e.g., 8080 or dynamic port).
// In AI Studio preview environment, Node dev server listens on port 3000.
const PORT: number = isRailwayOrExternal
  ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000)
  : 3000;

// Global Middleware Pipeline
app.use(securityHeaders);
app.use(dynamicCors);
app.use(parseCookies);
app.use(compressionMiddleware);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(requestCorrelationMiddleware);
app.use(authenticateToken);

// Health & Observability Check Endpoints (Railway, Kubernetes & Load Balancers)
const handleHealthCheck = (req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    port: PORT,
    platform: process.env.RAILWAY_ENVIRONMENT ? 'railway' : (isRailwayOrExternal ? 'external-cloud' : 'ai-studio'),
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024)
    }
  });
};

app.get('/health', handleHealthCheck);
app.get('/healthz', handleHealthCheck);
app.get('/readyz', handleHealthCheck);
app.get('/livez', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

// Apply rate limiting to API routes
app.use('/api/', globalRateLimiter);

// ==========================================
// MOUNT MODULAR API ROUTERS
// ==========================================

// Authentication & Tenants
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRouter);

// Real-Time Event Streaming & Server-Sent Events (SSE)
app.use('/api/events', eventsRouter);

// Dynamic Contracts & Document Generation
app.use('/api/contracts', contractRouter);

// Server-Side Rate Card & Commission Matrix Engine
app.use('/api/rate-card', rateCardRouter);

// Offline-First Conflict-Free Batched Sync
app.use('/api/offline', offlineSyncRouter);

// Transactional Email & Notifications Engine
app.use('/api/email', emailRouter);

// Universal Webhooks Subscription Engine
app.use('/api/webhooks/v2', universalWebhookRouter);

// Projects, SOP Transfer Gate, Collaborators, & Leads Scoring
app.use('/api/projects', projectRouter);
app.use('/api/portal', portalRouter);
app.use('/api/leads', leadScoreRouter);

// Team Chat & Messages
app.use('/api/chat', chatRouter);

// File Vault & GDPR Compliance
app.use('/api/files', fileRouter);
app.use('/api/gdpr', gdprRouter);

// AI Assistant & Unified Communications Inbox
app.use('/api/ai', aiRouter);
app.use('/api/inbox', inboxRouter);

// Free Outbound & GTM Tools (Email & Mobile Finder, Spam Checker, Hook Generator)
app.use('/api/gtm', gtmToolsRouter);
app.use('/api/tools', gtmToolsRouter);

// Stripe Checkout & Payment Gateway Sessions
app.use('/api/checkout', checkoutRouter);

// Agent-Reach Scraper & External Inbound Ingest (n8n, Python)
app.use('/api/scraper', scraperRouter);
app.use('/api/v1/leads', ingestRouter);

// Smart Drip Campaigns & Automated Nudges
app.use('/api/drip', dripRouter);
app.use('/api/nudges', nudgeRouter);

// Invoices, Commission Ledger & Executive Analytics
app.use('/api/invoices', invoiceRouter);
app.use('/api/commissions', commissionRouter);
app.use('/api/analytics', analyticsRouter);

// Webhooks & Gateway Connectors
app.use('/api/webhooks', webhookRouter);
app.use('/api/integrations', integrationRouter);

// Database Operations, API Tokens, Audit Logs, Agency Mode, Health & Test Runner
app.use('/api/database', databaseRouter);
app.use('/api/api-tokens', apiTokensRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/agency', agencyRouter);
app.use('/api', generalRouter);

// LeadFlow Outreach Suite Module (Mounted under /api/outreach)
app.use('/api/outreach/system', outreachSystemRouter);
app.use('/api/outreach', mailboxesRouter);
app.use('/api/outreach', campaignsRouter);

// Export shared database functions for any legacy external bindings
export { readDB, writeDB, INITIAL_DB };

// ==========================================
// VITE DEV SERVER & PRODUCTION STATIC SERVING
// ==========================================
async function startServer() {
  // Initialize PostgreSQL pool if DATABASE_URL configured
  try {
    await initPostgresPool();
  } catch (err: any) {
    console.warn(`[Database Engine] Initial pool setup warning: ${err.message}. Continuing with local fallback.`);
  }

  // Initialize Outreach Suite schema & background queue worker when PostgreSQL is available
  try {
    const outreachPool = getOutreachPool();
    if (outreachPool) {
      await ensureOutreachSchema(outreachPool);
      if (process.env.OUTREACH_WORKER !== 'off') {
        startQueueWorker(outreachPool);
        initSequencer(outreachPool);
      }
    } else {
      logger.info('Outreach Suite: PostgreSQL not configured. Operating in PostgreSQL-required mode.', {
        context: 'OutreachInit'
      });
    }
  } catch (outreachErr: any) {
    logger.error('Failed to initialize Outreach Suite schema or worker', {
      context: 'OutreachInit',
      details: outreachErr?.message
    });
  }

  const server = http.createServer(app);
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';

  // Resolve production static dist path with comprehensive fallbacks
  const candidatePaths = [
    path.join(process.cwd(), 'dist'),
    path.resolve(appDirname, 'dist'),
    path.resolve(appDirname, '../dist'),
    appDirname,
    process.cwd()
  ];
  const distPath = candidatePaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || candidatePaths[0];
  const distHtmlExists = fs.existsSync(path.join(distPath, 'index.html'));
  const isCompiledBundle = Boolean(appFilename && (appFilename.endsWith('.cjs') || appDirname.includes('dist')));

  // Production detection:
  // 1. Explicit NODE_ENV === 'production'
  // 2. Railway environment variables (RAILWAY_ENVIRONMENT, RAILWAY_SERVICE_ID, etc.)
  // 3. Render / Heroku environments
  // 4. Running compiled bundle (dist/server.cjs) and dist/index.html is found
  // 5. Outside AI Studio sandbox and dist/index.html is found
  const isProd = process.env.NODE_ENV === 'production' ||
                 Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID || process.env.RAILWAY_STATIC_URL || process.env.RENDER) ||
                 (isCompiledBundle && distHtmlExists) ||
                 (isRailwayOrExternal && distHtmlExists);

  if (!isProd) {
    // Dynamic import of Vite ensures production builds never crash on missing Vite dependencies
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server }
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    console.log(`[AgencyOps] Serving production static assets from: ${distPath}`);
    app.use(express.static(distPath, { index: false }));

    // Fallback handler for unmatched API routes in production
    app.all('/api/*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: `API route not found: ${req.method} ${req.path}`
      });
    });

    // SPA client-side routing fallback
    app.get('*', (req: Request, res: Response) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send('Production build not found. Please ensure `npm run build` completed.');
      }
    });
  }

  const httpServer = server.listen(PORT, '0.0.0.0', () => {
    logger.info(`[AgencyOps] Server listening on port ${PORT} at http://0.0.0.0:${PORT} (${isProd ? 'Production' : 'Development'})`, {
      context: 'ServerBootstrap',
      durationMs: 0
    });
  });

  // Graceful Shutdown Handlers for Railway, Render & Container Lifecycles
  const handleShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`, { context: 'GracefulShutdown' });
    stopQueueWorker();
    httpServer.close(() => {
      logger.info('HTTP server closed. Exiting process cleanly.', { context: 'GracefulShutdown' });
      process.exit(0);
    });

    // Force exit if connections don't drain within 10s
    setTimeout(() => {
      logger.warn('Forcing process termination after 10s timeout.', { context: 'GracefulShutdown' });
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();
