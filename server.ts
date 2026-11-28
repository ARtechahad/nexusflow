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
import { clerkAuth } from './server/middlewares/clerkAuth';
import { clerkWebhookRouter } from './server/routes/clerkWebhookRoutes';

// Modular Route Handlers
import authRoutes from './server/routes/authRoutes';
import tenantRouter from './server/routes/tenantRoutes';
import { companyRouter, invitePublicRouter } from './server/routes/companyRoutes';
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
import { emailOutreachRouter } from './server/routes/emailOutreachRoutes';
import publicRouter from './server/routes/publicRoutes';

// Outreach Suite Module
import { outreachSystemRouter } from './server/routes/outreach/systemRoutes';
import { mailboxesRouter } from './server/routes/outreach/mailboxes';
import { campaignsRouter } from './server/routes/outreach/campaigns';
import { trackingRouter } from './server/routes/outreach/tracking';
import { outreachInboxRouter } from './server/routes/outreach/inbox';
import { warmupRouter } from './server/routes/outreach/warmupRoutes';
import { prospectRoutes } from './server/routes/outreach/prospectRoutes';
import { analyticsRouter as outreachAnalyticsRouter } from './server/routes/outreach/analyticsRoutes';
import { billingRouter } from './server/routes/outreach/billingRoutes';
import { restV1Router } from './server/routes/outreach/v1/restRoutes';
import { handleMcpGet, handleMcpPost } from './server/services/outreach/mcpServer';
import { ensureOutreachSchema, getOutreachPool } from './server/services/outreach/schema';
import { startQueueWorker, stopQueueWorker } from './server/services/outreach/queue';
import { initSequencer } from './server/services/outreach/sequencer';
import { inboxSyncManager } from './server/services/outreach/inboxSync';
import { initWarmupEngine } from './server/services/outreach/warmupEngine';
import { initVerifier } from './server/services/outreach/verifier';

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

// Dev server must strictly bind to port 3000 as required by the AI Studio environment
const PORT: number =
  process.env.NODE_ENV === 'production' && !process.env.APPLET_ID && process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : 3000;

// Global Middleware Pipeline
app.use(securityHeaders);
app.use((_req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.removeHeader('Cross-Origin-Opener-Policy');
  next();
});
app.use(dynamicCors);

// Reverse proxy /engine/* -> local Python FastAPI engine (http://127.0.0.1:8000)
// Mounted before body-parsing middlewares so POST streams pass through intact.
app.use('/engine', (req: Request, res: Response) => {
  const targetPath = req.url && req.url.startsWith('/') ? req.url : `/${req.url || ''}`;
  const forwardedHeaders: http.OutgoingHttpHeaders = {};
  for (const [key, val] of Object.entries(req.headers)) {
    const lower = key.toLowerCase();
    if (
      lower === 'host' ||
      lower === 'connection' ||
      lower === 'keep-alive' ||
      lower === 'proxy-connection' ||
      lower === 'transfer-encoding' ||
      lower === 'upgrade'
    ) {
      continue;
    }
    if (val !== undefined) {
      forwardedHeaders[key] = val;
    }
  }
  forwardedHeaders.host = '127.0.0.1:8000';
  forwardedHeaders['x-forwarded-for'] = req.ip || req.socket.remoteAddress || '';
  forwardedHeaders['x-forwarded-proto'] = req.protocol || 'https';

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: 8000,
      path: targetPath,
      method: req.method,
      headers: forwardedHeaders,
      timeout: 60000
    },
    (proxyRes) => {
      const responseHeaders: http.OutgoingHttpHeaders = {};
      for (const [key, val] of Object.entries(proxyRes.headers)) {
        const lower = key.toLowerCase();
        if (lower === 'connection' || lower === 'keep-alive' || lower === 'transfer-encoding') {
          continue;
        }
        if (val !== undefined) {
          responseHeaders[key] = val;
        }
      }
      res.writeHead(proxyRes.statusCode || 502, responseHeaders);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('timeout', () => {
    proxyReq.destroy(new Error('Upstream FastAPI engine request timed out'));
  });

  proxyReq.on('error', (err) => {
    logger.warn(`Engine proxy error (${req.method} ${targetPath}): ${err.message}`, {
      context: 'EngineProxy'
    });
    if (!res.headersSent) {
      res.status(502).json({
        status: 'offline',
        detail: 'ALM Nexus FastAPI engine is unreachable on port 8000.'
      });
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  res.on('close', () => {
    if (!res.writableFinished && !proxyReq.destroyed) {
      proxyReq.destroy();
    }
  });

  req.pipe(proxyReq);
});

app.use(parseCookies);
app.use(compressionMiddleware);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(requestCorrelationMiddleware);
app.use(authenticateToken);
app.use(clerkAuth);

// Health & Observability Check Endpoints (Railway, Kubernetes & Load Balancers)
const handleHealthCheck = (req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    platform: process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID ? 'railway' : (process.env.PORT ? 'cloud' : 'ai-studio'),
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

// Authentication, Companies, Invites & Tenants
app.use('/api/inquiry', publicRouter);
app.use('/api/public', publicRouter);
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRouter);
app.use('/api/invites', invitePublicRouter);
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
app.use('/api/emails', emailRouter);
app.use('/api/email-outreach', emailOutreachRouter);

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
app.use('/api/webhooks/clerk', clerkWebhookRouter);
app.use('/api/webhooks', clerkWebhookRouter);
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
app.use('/api/outreach', trackingRouter);
app.use('/api/outreach', outreachInboxRouter);
app.use('/api/outreach', warmupRouter);
app.use('/api/outreach', prospectRoutes);
app.use('/api/outreach', outreachAnalyticsRouter);
app.use('/api/outreach', billingRouter);
app.use('/api/outreach/v1', restV1Router);
app.get('/api/outreach/mcp', handleMcpGet);
app.post('/api/outreach/mcp', handleMcpPost);
app.post('/api/outreach/mcp/messages', handleMcpPost);

// Aliases for direct /api endpoint paths (never mount API routers on non-API root paths)
app.use('/api', outreachInboxRouter);
app.use('/api', warmupRouter);
app.use('/api', prospectRoutes);
app.use('/api', outreachAnalyticsRouter);
app.use('/api', billingRouter);
app.use('/api/domains', trackingRouter);

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
        initWarmupEngine(outreachPool);
        initVerifier(outreachPool);
        inboxSyncManager.start().catch((syncErr: any) => {
          logger.warn(`InboxSyncManager background start warning: ${syncErr?.message}`, {
            context: 'InboxSync'
          });
        });
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
                 Boolean(distHtmlExists && process.env.NODE_ENV !== 'development' && !process.env.APPLET_ID);

  // Fallback handler for unmatched API routes in both dev and production
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.path}`
    });
  });

  // Serve SEO files directly with explicit Content-Type, bypassing any SPA catch-all HTML fallback
  const resolvePublicOrDistFile = (filename: string): string | null => {
    const candidates = [
      path.join(distPath, filename),
      path.join(process.cwd(), 'public', filename),
      path.resolve(appDirname, 'public', filename)
    ];
    return candidates.find((p) => fs.existsSync(p)) || null;
  };

  const PUBLIC_ROUTE_SET = new Set([
    '/',
    '/services',
    '/services/app-development',
    '/services/web-development',
    '/services/ai-automation',
    '/services/data-intelligence',
    '/services/cybersecurity',
    '/products',
    '/tools/web-data-engine',
    '/work',
    '/about',
    '/contact',
    '/privacy',
    '/terms'
  ]);

  const NOINDEX_PREFIXES = ['/docs', '/login', '/signup', '/app', '/workspace', '/portal'];

  const normalizeRoutePath = (rawPath: string): string => {
    const clean = rawPath.split('?')[0].split('#')[0] || '/';
    if (clean.length > 1 && clean.endsWith('/')) {
      return clean.slice(0, -1);
    }
    return clean;
  };

  const isNoIndexRoutePath = (normalized: string, query: Request['query']): boolean => {
    if (query && typeof query.invite === 'string' && query.invite.length > 0) {
      return true;
    }
    return NOINDEX_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    );
  };

  const isAssetOrInternalPath = (reqPath: string): boolean => {
    if (
      reqPath.startsWith('/@') ||
      reqPath.startsWith('/src/') ||
      reqPath.startsWith('/node_modules/') ||
      reqPath.startsWith('/assets/') ||
      reqPath.startsWith('/api/')
    ) {
      return true;
    }
    const lastSegment = reqPath.split('/').pop() || '';
    return lastSegment.includes('.');
  };

  app.get('/sitemap.xml', (_req: Request, res: Response) => {
    const filePath = resolvePublicOrDistFile('sitemap.xml');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    if (filePath) {
      return res.send(fs.readFileSync(filePath, 'utf8'));
    }
    const urls = Array.from(PUBLIC_ROUTE_SET)
      .map(
        (route) =>
          `  <url>\n    <loc>https://almnexus.tech${route}</loc>\n    <lastmod>2026-11-25</lastmod>\n  </url>`
      )
      .join('\n');
    return res
      .status(200)
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  });

  app.get('/robots.txt', (_req: Request, res: Response) => {
    const filePath = resolvePublicOrDistFile('robots.txt');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (filePath) {
      return res.send(fs.readFileSync(filePath, 'utf8'));
    }
    return res
      .status(200)
      .send(
        [
          'User-agent: Googlebot',
          'Allow: /',
          '',
          'User-agent: Bingbot',
          'Allow: /',
          '',
          'User-agent: OAI-SearchBot',
          'Allow: /',
          '',
          'User-agent: GPTBot',
          'Allow: /',
          '',
          'User-agent: PerplexityBot',
          'Allow: /',
          '',
          'User-agent: ClaudeBot',
          'Allow: /',
          '',
          'User-agent: Google-Extended',
          'Allow: /',
          '',
          'User-agent: *',
          'Allow: /',
          'Disallow: /api/',
          'Disallow: /engine/',
          'Disallow: /docs',
          'Disallow: /login',
          'Disallow: /signup',
          'Disallow: /app',
          'Disallow: /workspace',
          'Disallow: /portal',
          '',
          'Sitemap: https://almnexus.tech/sitemap.xml',
          ''
        ].join('\n')
      );
  });

  app.get('/llms.txt', (_req: Request, res: Response) => {
    const filePath = resolvePublicOrDistFile('llms.txt');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (filePath) {
      return res.send(fs.readFileSync(filePath, 'utf8'));
    }
    return res
      .status(200)
      .send(
        [
          '# ALM Nexus',
          '',
          '> Custom software engineering, AI automation, cybersecurity auditing, and B2B web data engineering agency at https://almnexus.tech.',
          '',
          '- Services: https://almnexus.tech/services',
          '- Mobile App Development: https://almnexus.tech/services/app-development',
          '- Web & SaaS Development: https://almnexus.tech/services/web-development',
          '- AI Agents & Automation: https://almnexus.tech/services/ai-automation',
          '- Data & Lead Engineering: https://almnexus.tech/services/data-intelligence',
          '- Cybersecurity & Audits: https://almnexus.tech/services/cybersecurity',
          '- Free AI Web Scraper: https://almnexus.tech/tools/web-data-engine',
          '- Contact: https://almnexus.tech/contact (contact@almnexus.tech)',
          ''
        ].join('\n')
      );
  });

  app.get('/llms-full.txt', (_req: Request, res: Response) => {
    const filePath = resolvePublicOrDistFile('llms-full.txt');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (filePath) {
      return res.send(fs.readFileSync(filePath, 'utf8'));
    }
    return res
      .status(200)
      .send(
        'ALM Nexus — AI, Web & Mobile Software Engineering Agency. Full technical capabilities: https://almnexus.tech/services | Proposal intake: https://almnexus.tech/contact (POST /api/inquiry) | Email: contact@almnexus.tech\n'
      );
  });

  app.get('/2cd0ffb4a91c4e6b816582f6f24d018b.txt', (_req: Request, res: Response) => {
    const filePath = resolvePublicOrDistFile('2cd0ffb4a91c4e6b816582f6f24d018b.txt');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    if (filePath) {
      return res.send(fs.readFileSync(filePath, 'utf8'));
    }
    return res.status(200).send('2cd0ffb4a91c4e6b816582f6f24d018b\n');
  });

  if (!isProd) {
    // Dynamic import of Vite ensures production builds never crash on missing Vite dependencies
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server }
      },
      appType: 'custom'
    });

    app.use(vite.middlewares);

    app.get('*', async (req: Request, res: Response, next) => {
      if (isAssetOrInternalPath(req.path)) {
        return next();
      }
      const normalized = normalizeRoutePath(req.path);
      try {
        const indexPath = path.join(process.cwd(), 'index.html');
        const rawTemplate = fs.readFileSync(indexPath, 'utf8');
        const template = await vite.transformIndexHtml(req.originalUrl, rawTemplate);
        const ssrMod = await vite.ssrLoadModule('/src/ssr/renderPublicRoute.tsx');

        if (isNoIndexRoutePath(normalized, req.query)) {
          const appHtml = ssrMod.renderNoIndexAppHtml(template, normalized);
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
          return res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(appHtml);
        }

        const { html, statusCode } = ssrMod.renderPublicRouteHtml(template, normalized);
        if (statusCode === 404) {
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        }
        return res.status(statusCode).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      } catch (err: any) {
        vite.ssrFixStacktrace(err);
        logger.error(`SSR render fallback on ${req.path}: ${err?.message}`, { context: 'SSR' });
        return next(err);
      }
    });
  } else {
    console.log(`[ClientOps] Serving production static assets from: ${distPath}`);
    app.use(express.static(distPath, { index: false, redirect: false }));

    app.get('*', (req: Request, res: Response) => {
      const normalized = normalizeRoutePath(req.path);

      if (isNoIndexRoutePath(normalized, req.query)) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        const appShellPath = path.join(distPath, 'app-shell.html');
        const fallbackIndex = path.join(distPath, 'index.html');
        if (fs.existsSync(appShellPath)) {
          let shellHtml = fs.readFileSync(appShellPath, 'utf8');
          shellHtml = shellHtml.replace(
            /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
            '<meta name="robots" content="noindex, nofollow" />'
          );
          shellHtml = shellHtml
            .replace('<!--SEO_JSON_LD-->', '')
            .replace('<!--SSR_OUTLET-->', '');
          return res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(shellHtml);
        }
        if (fs.existsSync(fallbackIndex)) {
          return res.status(200).sendFile(fallbackIndex);
        }
      }

      if (PUBLIC_ROUTE_SET.has(normalized)) {
        const routeFile =
          normalized === '/'
            ? path.join(distPath, 'index.html')
            : path.join(distPath, normalized.replace(/^\//, ''), 'index.html');
        if (fs.existsSync(routeFile)) {
          return res.status(200).sendFile(routeFile);
        }
      }

      // Real HTTP 404 for unknown routes
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      const notFoundPath = path.join(distPath, '404.html');
      if (fs.existsSync(notFoundPath)) {
        return res.status(404).sendFile(notFoundPath);
      }
      return res.status(404).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Page Not Found | ALM Nexus</title></head><body><h1>Page not found</h1><p><a href="/">Back to home</a></p></body></html>'
      );
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
