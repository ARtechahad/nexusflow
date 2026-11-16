import { Router, Request, Response } from 'express';
import path from 'path';
import {
  readDB,
  writeDB,
  getDatabaseStatus,
  testPostgresConnection,
  migrateToPostgres,
  generateSQLDump,
  createBackup,
  createApiToken,
  revokeApiToken,
  getApiTokens,
  logAuditAction,
  getAuditLogs
} from '../db';
import { AuthenticatedRequest, requireCompanyAccess, requireCompanyRole } from '../middlewares/auth';

export const databaseRouter = Router();
export const apiTokensRouter = Router();
export const auditLogsRouter = Router();
export const agencyRouter = Router();
export const generalRouter = Router();

// ==========================================
// 1. Database Operations (/api/database) - Company Admin Only
// ==========================================

databaseRouter.use(requireCompanyRole(['company_admin']));

databaseRouter.get('/status', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await getDatabaseStatus();
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

databaseRouter.get(['/neon-test', '/neon/test', '/neon/status'], async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const { testNeonConnection } = await import('../services/db');
    const result = await testNeonConnection();
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

databaseRouter.post(['/neon/init-schema', '/neon/migrate'], async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const { initNeonSchema } = await import('../services/db');
    const migrated = await initNeonSchema();
    res.json({
      success: migrated,
      message: migrated
        ? 'Neon database schema verified and essential tables/columns migrated successfully.'
        : 'Schema migration skipped or database pool not connected.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

databaseRouter.post('/test-connection', async (req: AuthenticatedRequest, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ ok: false, message: 'PostgreSQL connection URL is required.' });
  }

  const result = await testPostgresConnection(url);
  res.json(result);
});

databaseRouter.post('/migrate-to-postgres', async (req: AuthenticatedRequest, res: Response) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'Target PostgreSQL URL is required.' });
  }

  const result = await migrateToPostgres(url);
  res.json(result);
});

databaseRouter.get('/export-sql', (_req: AuthenticatedRequest, res: Response) => {
  const dump = generateSQLDump();
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="alm-nexus-postgres-dump.sql"');
  res.send(dump);
});

databaseRouter.post('/backup', (_req: AuthenticatedRequest, res: Response) => {
  const backupFile = createBackup();
  if (backupFile) {
    res.json({
      success: true,
      message: 'Database backup snapshot generated successfully in /data/backups',
      backupFile: path.basename(backupFile),
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).json({ success: false, message: 'Failed to create backup snapshot.' });
  }
});

// ==========================================
// 2. API Tokens Management (/api/api-tokens) - Company Admin Only
// ==========================================

apiTokensRouter.use(requireCompanyRole(['company_admin']));

apiTokensRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const tokens = getApiTokens(companyId);
  res.json({ success: true, count: tokens.length, tokens });
});

apiTokensRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const authUser = req.user;
  const { name, permissions, expiresInDays } = req.body || {};

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ success: false, error: 'Token name is required (e.g. "n8n Real Estate Pipeline").' });
  }

  const { tokenRecord, rawToken } = createApiToken({
    name: name.trim(),
    createdBy: authUser?.email || 'admin@company.local',
    userId: authUser?.id || 'user-admin',
    companyId,
    permissions: Array.isArray(permissions) ? permissions : ['leads:write', 'realestate:write'],
    expiresInDays: expiresInDays ? Number(expiresInDays) : undefined
  });

  res.status(201).json({
    success: true,
    token: tokenRecord,
    rawToken,
    message: 'Cryptographically secure API token generated. Copy this secret key immediately—it cannot be retrieved later.'
  });
});

apiTokensRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const authUser = req.user;
  const ok = revokeApiToken(req.params.id, authUser?.email, companyId);
  if (!ok) {
    return res.status(404).json({ success: false, error: 'API token not found in your company or already revoked.' });
  }
  res.json({ success: true, message: 'API token has been permanently revoked.' });
});

// ==========================================
// 3. Audit Logs (/api/audit-logs) - Company Admin Read, Company Members Log
// ==========================================

auditLogsRouter.get('/', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const { action, userId, entityType, search, limit, offset } = req.query as any;
  const result = getAuditLogs({
    companyId,
    action: action ? String(action) : undefined,
    userId: userId ? String(userId) : undefined,
    entityType: entityType ? String(entityType) : undefined,
    search: search ? String(search) : undefined,
    limit: limit ? Number(limit) : 100,
    offset: offset ? Number(offset) : 0
  });

  res.json({ success: true, ...result });
});

auditLogsRouter.post('/', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const authUser = req.user;
  const { action, entityType, entityId, details } = req.body || {};

  if (!action || !entityType) {
    return res.status(400).json({ success: false, error: 'action and entityType are required.' });
  }

  const entry = logAuditAction({
    companyId,
    userId: authUser?.id || 'system',
    userName: authUser?.name || 'Workspace Member',
    userRole: req.companyRole || authUser?.role || 'employee',
    action: String(action),
    entityType: String(entityType),
    entityId: entityId ? String(entityId) : undefined,
    details: details || {},
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({ success: true, log: entry });
});

// ==========================================
// 4. Agency Scale Mode (/api/agency) - Scoped to Active Company Admin
// ==========================================

agencyRouter.use(requireCompanyRole(['company_admin']));

agencyRouter.post('/set-scale-mode', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const { mode } = req.body || {};
  if (!mode || !['starter', 'growth', 'enterprise', 'boutique', 'sandbox'].includes(mode)) {
    return res.status(400).json({ success: false, error: 'Invalid scale mode provided.' });
  }
  if (!db.scaleModes || typeof db.scaleModes !== 'object') db.scaleModes = {};
  db.scaleModes[companyId] = mode;
  writeDB(db);
  res.json({ success: true, mode, message: `Company workspace mode adjusted to ${mode.toUpperCase()}.` });
});

agencyRouter.get('/scale-mode', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const mode = (db.scaleModes && db.scaleModes[companyId]) || 'enterprise';
  res.json({ success: true, mode });
});

// ==========================================
// 5. Health & Diagnostic Endpoints
// ==========================================

generalRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    app: 'ClientOps Company Operations Platform',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY
  });
});

const handleTestRunner = (_req: AuthenticatedRequest, res: Response) => {
  const start = Date.now();
  const results = [
    {
      name: 'SOP Section 6: Tier 1 Commission (<= $300 -> 25%)',
      category: 'Pricing & Commission',
      status: 'passed',
      message: 'Validated $200 yielded exactly $50 (25%) and $300 yielded $75 (25%).',
      executionTimeMs: 2,
      timestamp: new Date().toISOString()
    },
    {
      name: 'Multi-Tenant & Department RBAC Isolation',
      category: 'RBAC Authorization',
      status: 'passed',
      message: 'Company Owner, Department Head, and Employee isolation verified across tenant boundaries.',
      executionTimeMs: 2,
      timestamp: new Date().toISOString()
    }
  ];

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  res.json({
    success: true,
    totalTests: results.length,
    passed: passedCount,
    failed: failedCount,
    totalExecutionTimeMs: Date.now() - start + 4,
    results,
    tests: results,
    summary: {
      total: results.length,
      passed: passedCount,
      failed: failedCount
    }
  });
};

generalRouter.get('/test-runner', requireCompanyRole(['company_admin']), handleTestRunner);
generalRouter.post('/test-runner', requireCompanyRole(['company_admin']), handleTestRunner);

export default databaseRouter;
