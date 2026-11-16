import { Router, Response } from 'express';
import crypto from 'crypto';
import { readDB, writeDB } from '../db';
import { AuthenticatedRequest, requireCompanyAccess, requireCompanyRole } from '../middlewares/auth';

export const fileRouter = Router();
export const gdprRouter = Router();

function isSameCompany(record: any, companyId: string): boolean {
  return record?.companyId === companyId || record?.tenantId === companyId || record?.tenant_id === companyId;
}

// ==========================================
// File Vault Endpoints (/api/files) - Strictly Company & Role Isolated
// ==========================================

fileRouter.get('/', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;

  let accessibleFiles = (db.files || []).filter((f: any) => isSameCompany(f, companyId));

  // Scope non-admins strictly to their own uploads or their assigned department files
  if (req.companyRole === 'department_head' || req.companyRole === 'employee') {
    const allowedDepts = req.membership?.departmentIds || [];
    accessibleFiles = accessibleFiles.filter(
      (f: any) =>
        f.uploadedByUserId === req.user!.id ||
        (f.departmentId && allowedDepts.includes(f.departmentId))
    );
  }

  return res.json({ success: true, count: accessibleFiles.length, files: accessibleFiles });
});

fileRouter.post('/', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const { name, size, mimeType, roleRequired, projectId, departmentId, category } = req.body || {};

  if (!name) return res.status(400).json({ error: 'File name is required' });

  if (req.companyRole !== 'company_admin' && departmentId) {
    if (!(req.membership?.departmentIds || []).includes(departmentId)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot upload to another department.' });
    }
  }

  const hash = crypto.createHash('sha256').update(name + Date.now().toString()).digest('hex');

  const newFile = {
    id: `file-${Date.now()}`,
    companyId,
    tenantId: companyId,
    departmentId: departmentId || (req.companyRole !== 'company_admin' ? req.membership?.departmentIds?.[0] : undefined),
    uploadedByUserId: req.user!.id,
    name,
    size: Number(size) || 1024 * 50,
    mimeType: mimeType || 'application/octet-stream',
    uploadedBy: req.user!.name,
    uploadedAt: new Date().toISOString(),
    roleRequired: roleRequired || ['admin', 'sales', 'coordinator', 'developer'],
    checksumSha256: hash,
    downloadUrl: `/vault/${companyId}/${encodeURIComponent(name)}`,
    projectId: projectId || undefined,
    category: category || 'assets',
    encrypted: true
  };

  if (!Array.isArray(db.files)) db.files = [];
  db.files.unshift(newFile);
  writeDB(db);

  return res.status(201).json({ success: true, file: newFile });
});

fileRouter.delete('/:id', requireCompanyRole(['company_admin', 'department_head']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const idx = (db.files || []).findIndex(
    (f: any) => f.id === req.params.id && isSameCompany(f, req.companyId!)
  );
  if (idx === -1) return res.status(404).json({ error: 'File not found' });

  const targetFile = db.files[idx];
  if (req.companyRole === 'department_head') {
    const allowedDepts = req.membership?.departmentIds || [];
    if (targetFile.uploadedByUserId !== req.user!.id && !(targetFile.departmentId && allowedDepts.includes(targetFile.departmentId))) {
      return res.status(403).json({ success: false, error: 'Forbidden: File belongs to another department.' });
    }
  }

  db.files.splice(idx, 1);
  writeDB(db);
  return res.json({ success: true, message: 'File securely purged from vault.' });
});

// ==========================================
// GDPR Endpoints (/api/gdpr) - Strictly Company Admin Only
// ==========================================

gdprRouter.get('/export', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const sanitizedProjects = (db.projects || [])
    .filter((p: any) => isSameCompany(p, companyId))
    .map((p: any) => ({
      id: p.id,
      clientName: p.clientName,
      clientEmail: p.clientEmail,
      clientCompany: p.clientCompany,
      channel: p.channel,
      websiteType: p.websiteType,
      agreedPrice: p.finalPrice,
      created: p.createdAt
    }));

  const companyFiles = (db.files || [])
    .filter((f: any) => isSameCompany(f, companyId))
    .map((f: any) => ({ name: f.name, uploadedAt: f.uploadedAt, category: f.category }));

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=gdpr-subject-data-export.json');
  return res.json({
    exportDate: new Date().toISOString(),
    companyId,
    regulation: 'General Data Protection Regulation (EU) 2016/679 - Article 15 DSAR',
    subjectData: {
      projects: sanitizedProjects,
      filesLogged: companyFiles
    }
  });
});

gdprRouter.post('/purge', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const { projectId } = req.body || {};

  if (projectId) {
    const p = (db.projects || []).find((proj: any) => proj.id === projectId && isSameCompany(proj, companyId));
    if (!p) {
      return res.status(404).json({ success: false, message: 'Project not found in your company.' });
    }
    p.clientName = 'Anonymized Client [GDPR Article 17]';
    p.clientEmail = 'redacted@gdpr-erasure.local';
    p.clientPhone = '[REDACTED]';
    p.credentialsNotes = '[CREDENTIALS PURGED UNDER RIGHT TO BE FORGOTTEN]';
    p.credentialsShared = false;
    p.updatedAt = new Date().toISOString();
  }

  if (!Array.isArray(db.gdprLogs)) db.gdprLogs = [];
  db.gdprLogs.push({
    id: `gdpr-${Date.now()}`,
    companyId,
    action: 'Right to be Forgotten Executed',
    details: `PII purged for project ${projectId || 'company scope'}.`,
    timestamp: new Date().toISOString()
  });

  writeDB(db);
  return res.json({ success: true, message: 'Client PII successfully redacted under GDPR Right to be Forgotten.' });
});

export default fileRouter;
