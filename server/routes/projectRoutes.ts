import { Router, Request, Response } from 'express';
import { readDB, writeDB, logAuditAction, calculateLeadScore } from '../db';
import {
  AuthenticatedRequest,
  requireCompanyAccess,
  requireCompanyRole
} from '../middlewares/auth';

export const projectRouter = Router();
export const portalRouter = Router();
export const leadScoreRouter = Router();

function isSameCompany(record: any, companyId: string): boolean {
  return (
    record?.companyId === companyId ||
    record?.tenantId === companyId ||
    record?.tenant_id === companyId
  );
}

// ==========================================
// 1. Projects / Deals Pipeline (/api/projects) - Strictly Company & Role Isolated
// ==========================================

projectRouter.get('/', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  if (req.companyRole === 'employee') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Company-wide deals pipeline is restricted to Company Owners and authorized Leads.'
    });
  }

  const db = readDB();
  const companyId = req.companyId!;
  const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';

  let projects = (Array.isArray(db.projects) ? [...db.projects] : []).filter((p: any) =>
    isSameCompany(p, companyId)
  );

  // Department heads only see deals scoped to their assigned departments or owned by them, without company-wide commission data
  if (req.companyRole === 'department_head') {
    const allowedDepts = req.membership?.departmentIds || [];
    projects = projects
      .filter((p: any) => (p.departmentId && allowedDepts.includes(p.departmentId)) || p.ownerId === req.user!.id)
      .map((p: any) => ({
        ...p,
        commissionAmount: undefined,
        commissionRate: undefined,
        commissionStatus: undefined
      }));
  }

  if (status && status !== 'all') {
    projects = projects.filter((p) => p.status === status);
  }
  if (search) {
    projects = projects.filter(
      (p) =>
        (p.clientName || '').toLowerCase().includes(search) ||
        (p.clientCompany || '').toLowerCase().includes(search) ||
        (p.purpose || '').toLowerCase().includes(search) ||
        (p.websiteType || '').toLowerCase().includes(search)
    );
  }

  return res.json({ success: true, count: projects.length, projects });
});

projectRouter.post('/', requireCompanyRole(['company_admin', 'department_head']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const body = req.body || {};

  if (!body.clientName || !body.websiteType) {
    return res.status(400).json({ error: 'Client name and website type are required.' });
  }

  if (req.companyRole === 'department_head' && body.departmentId) {
    if (!(req.membership?.departmentIds || []).includes(body.departmentId)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot create deals for another department.' });
    }
  }

  let estPrice = Number(body.estimatedPrice) || 0;
  if (!estPrice) {
    if (body.websiteType === 'landing') estPrice = 250;
    else if (body.websiteType === 'ecommerce') estPrice = 600;
    else if (body.websiteType === 'corporate') estPrice = 900;
    else estPrice = 500;
  }

  let rate = 25;
  if (estPrice <= 300) rate = 25;
  else if (estPrice <= 700) rate = 30;
  else rate = 35;
  if (body.hasHighPerformanceBonus) rate = Math.min(rate + 10, 45);

  const finalPrice = Number(body.finalPrice) || estPrice;
  const commissionAmount = Number(((finalPrice * rate) / 100).toFixed(2));

  const newProject = {
    id: body.id || `proj-${Date.now()}`,
    companyId,
    tenantId: companyId,
    tenant_id: companyId,
    departmentId: body.departmentId || (req.companyRole === 'department_head' ? req.membership?.departmentIds?.[0] : undefined),
    ownerId: req.user!.id,
    clientName: body.clientName,
    clientEmail: body.clientEmail || '',
    clientPhone: body.clientPhone || '',
    clientCompany: body.clientCompany || '',
    channel: body.channel || 'linkedin',
    websiteType: body.websiteType,
    purpose: body.purpose || 'Brand website and client services',
    inspirationUrls: body.inspirationUrls || [],
    hasLogo: Boolean(body.hasLogo),
    hasContent: Boolean(body.hasContent),
    hasImages: Boolean(body.hasImages),
    useStockPhotos: Boolean(body.useStockPhotos),
    needsContentWriting: Boolean(body.needsContentWriting),
    assetNotes: body.assetNotes || '',
    hostingStatus: body.hostingStatus || 'needs_both',
    hostingProvider: body.hostingProvider || '',
    credentialsShared: Boolean(body.credentialsShared),
    credentialsNotes: body.credentialsNotes || '',
    recommendedHost: body.recommendedHost || 'Hostinger',
    estimatedPrice: estPrice,
    finalPrice: finalPrice,
    advancePaid: Boolean(body.advancePaid),
    advanceAmount: Boolean(body.advancePaid) ? Number((finalPrice * 0.5).toFixed(2)) : 0,
    advanceTxId: body.advanceTxId || '',
    balancePaid: Boolean(body.balancePaid),
    balanceAmount: Boolean(body.balancePaid) ? Number((finalPrice * 0.5).toFixed(2)) : 0,
    balanceTxId: body.balanceTxId || '',
    paymentMethod: body.paymentMethod || 'paypal',
    currency: 'USD',
    assignedSalesperson: body.assignedSalesperson || req.user!.name,
    salespersonEmail: body.salespersonEmail || req.user!.email,
    commissionRate: rate,
    commissionAmount: commissionAmount,
    commissionStatus: 'pending',
    discordShared: Boolean(body.discordShared),
    stagingUrl: body.stagingUrl || '',
    internalQAPassed: false,
    clientApproved: false,
    domainTransferred: false,
    kickOffConfirmed: Boolean(body.advancePaid),
    trackerUrl: body.trackerUrl || '',
    timelineDays: Number(body.timelineDays) || 10,
    startDate: new Date().toISOString().split('T')[0],
    targetDeliveryDate: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    maintenanceOfferSent: false,
    maintenanceRetainer: false,
    monthlyRetainerFee: 99,
    referralEnrolled: false,
    status: (Boolean(body.advancePaid) ? 'advance_paid' : 'lead') as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!Array.isArray(db.projects)) db.projects = [];
  db.projects.unshift(newProject);
  writeDB(db);

  return res.status(201).json({ success: true, project: newProject });
});

projectRouter.get('/:id', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  if (req.companyRole === 'employee') {
    return res.status(403).json({ success: false, error: 'Forbidden.' });
  }
  const db = readDB();
  const project = (db.projects || []).find(
    (p: any) => p.id === req.params.id && isSameCompany(p, req.companyId!)
  );
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  if (req.companyRole === 'department_head') {
    const allowedDepts = req.membership?.departmentIds || [];
    if (!(project.departmentId && allowedDepts.includes(project.departmentId)) && project.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Deal belongs to another department.' });
    }
    return res.json({
      success: true,
      project: {
        ...project,
        commissionAmount: undefined,
        commissionRate: undefined,
        commissionStatus: undefined
      }
    });
  }

  return res.json({ success: true, project });
});

projectRouter.put('/:id', requireCompanyRole(['company_admin', 'department_head']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const index = (db.projects || []).findIndex(
    (p: any) => p.id === req.params.id && isSameCompany(p, req.companyId!)
  );
  if (index === -1) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const existing = db.projects[index];
  if (req.companyRole === 'department_head') {
    const allowedDepts = req.membership?.departmentIds || [];
    if (!(existing.departmentId && allowedDepts.includes(existing.departmentId)) && existing.ownerId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Deal belongs to another department.' });
    }
  }

  const updates = req.body || {};
  if (updates.finalPrice && updates.finalPrice !== existing.finalPrice) {
    let rate = existing.commissionRate;
    const p = Number(updates.finalPrice);
    if (p <= 300) rate = 25;
    else if (p <= 700) rate = 30;
    else rate = 35;
    updates.commissionRate = rate;
    updates.commissionAmount = Number(((p * rate) / 100).toFixed(2));
  }

  if (updates.advancePaid === true && !existing.advancePaid) {
    updates.advanceAmount = Number((existing.finalPrice * 0.5).toFixed(2));
    if (existing.status === 'lead' || existing.status === 'scoped') {
      updates.status = 'advance_paid';
    }
  }

  if (updates.balancePaid === true && !existing.balancePaid) {
    updates.balanceAmount = Number((existing.finalPrice * 0.5).toFixed(2));
  }

  db.projects[index] = {
    ...existing,
    ...updates,
    id: existing.id,
    companyId: req.companyId!,
    tenantId: req.companyId!,
    updatedAt: new Date().toISOString()
  };

  writeDB(db);
  return res.json({ success: true, project: db.projects[index] });
});

projectRouter.delete('/:id', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const index = (db.projects || []).findIndex(
    (p: any) => p.id === req.params.id && isSameCompany(p, req.companyId!)
  );
  if (index === -1) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const deleted = db.projects.splice(index, 1)[0];
  writeDB(db);

  logAuditAction({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: 'company_admin',
    action: 'PROJECT_DELETED',
    entityType: 'project',
    entityId: req.params.id,
    details: { clientName: deleted.clientName, clientCompany: deleted.clientCompany, companyId: req.companyId },
    ipAddress: req.ip || '127.0.0.1'
  });

  return res.json({ success: true, message: `Project ${deleted.clientName} removed successfully.` });
});

projectRouter.post('/:id/collaborator', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const project = (db.projects || []).find(
    (p: any) => p.id === req.params.id && isSameCompany(p, req.companyId!)
  );
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const { collaboratorId, collaboratorEmail, action = 'assign' } = req.body || {};
  const target = (collaboratorEmail || collaboratorId || '').trim();
  if (!target) {
    return res.status(400).json({ error: 'collaboratorEmail or collaboratorId is required.' });
  }

  if (!Array.isArray(project.assignedCollaborators)) project.assignedCollaborators = [];

  if (action === 'assign') {
    if (!project.assignedCollaborators.includes(target)) project.assignedCollaborators.push(target);
    project.isDealSheetShared = true;
  } else {
    project.assignedCollaborators = project.assignedCollaborators.filter((c: string) => c !== target);
    if (project.assignedCollaborators.length === 0) project.isDealSheetShared = false;
  }

  project.updatedAt = new Date().toISOString();
  writeDB(db);
  return res.json({ success: true, project, assignedCollaborators: project.assignedCollaborators });
});

projectRouter.post('/:id/evaluate', requireCompanyRole(['company_admin', 'department_head']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const project = (db.projects || []).find(
    (p: any) => p.id === req.params.id && isSameCompany(p, req.companyId!)
  );
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const { partnerEvaluationNotes, partnerEvaluationScore, partnerSignOff } = req.body || {};
  if (partnerEvaluationNotes !== undefined) project.partnerEvaluationNotes = String(partnerEvaluationNotes);
  if (partnerEvaluationScore !== undefined) project.partnerEvaluationScore = Number(partnerEvaluationScore);
  if (partnerSignOff !== undefined) {
    project.partnerSignOff = Boolean(partnerSignOff);
    if (project.partnerSignOff) project.partnerSignOffDate = new Date().toISOString();
  }

  project.updatedAt = new Date().toISOString();
  writeDB(db);
  return res.json({ success: true, project });
});

projectRouter.post('/:id/transfer', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const project = (db.projects || []).find((p: any) => p.id === req.params.id && isSameCompany(p, companyId));

  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  if (!project.advancePaid) {
    return res.status(403).json({
      error: 'TRANSFER REJECTED: Advance 50% payment was never confirmed.',
      gatePassed: false
    });
  }
  if (!project.balancePaid) {
    return res.status(403).json({
      error: 'TRANSFER REJECTED: Live website transfer is strictly prohibited until the remaining 50% balance payment is cleared.',
      gatePassed: false,
      balanceDue: project.finalPrice * 0.5
    });
  }
  if (!project.internalQAPassed) {
    return res.status(400).json({
      error: 'TRANSFER BLOCKED: Internal QA checklist has not been completed on staging domain.',
      gatePassed: false
    });
  }

  project.domainTransferred = true;
  project.transferCompletedAt = new Date().toISOString();
  project.status = 'transferred';
  project.updatedAt = new Date().toISOString();

  writeDB(db);
  return res.json({
    success: true,
    message: 'Domain transfer verified and executed securely.',
    gatePassed: true,
    project
  });
});

projectRouter.get('/:id/discord-export', requireCompanyRole(['company_admin', 'department_head']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const project = (db.projects || []).find(
    (p: any) => p.id === req.params.id && isSameCompany(p, req.companyId!)
  );
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const formatted = `NEW CLOSED CLIENT HANDOFF\nClient Name: ${project.clientName}\nWebsite Type: ${project.websiteType}\nPricing: $${project.finalPrice} USD`;
  return res.json({ success: true, formattedText: formatted, project });
});

// ==========================================
// 2. Lead Scoring & Intake Endpoints (/api/leads)
// ==========================================

leadScoreRouter.get('/', requireCompanyRole(['company_admin', 'department_head']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const leads = (Array.isArray(db.projects) ? [...db.projects] : []).filter((p: any) =>
    isSameCompany(p, companyId)
  );
  return res.json({ success: true, count: leads.length, data: leads });
});

leadScoreRouter.post('/', requireCompanyRole(['company_admin', 'department_head']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const body = req.body || {};

  if (!body.clientName && !body.name) {
    return res.status(400).json({ success: false, error: 'Prospect/Client Name is required.' });
  }

  const leadId = body.id || `lead-${Date.now()}`;
  const clientName = body.clientName || body.name || 'Anonymous Prospect';
  const clientEmail = body.clientEmail || body.email || '';
  const clientCompany = body.clientCompany || body.company || '';
  const channel = body.channel || 'linkedin';

  const newLead: any = {
    id: leadId,
    companyId,
    tenantId: companyId,
    tenant_id: companyId,
    ownerId: req.user!.id,
    clientName,
    clientEmail,
    clientCompany,
    clientPhone: body.clientPhone || body.phone || '',
    websiteUrl: body.websiteUrl || body.website || '',
    channel,
    websiteType: body.websiteType || 'landing',
    purpose: body.notes || body.purpose || 'Outbound strategy consultation',
    estimatedPrice: Number(body.estimatedPrice) || 2990,
    finalPrice: Number(body.finalPrice) || 2990,
    status: body.status || 'lead',
    source: body.source || 'leadflow_inbound',
    advancePaid: false,
    balancePaid: false,
    internalQAPassed: false,
    domainTransferred: false,
    assignedSalesperson: body.assignedSalesperson || req.user!.name,
    salespersonEmail: body.salespersonEmail || req.user!.email,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  newLead.leadScore = calculateLeadScore(newLead);

  if (!Array.isArray(db.projects)) db.projects = [];
  db.projects.unshift(newLead);
  writeDB(db);

  return res.status(201).json({
    success: true,
    data: newLead,
    message: 'Lead intake successfully captured and scored in CRM.'
  });
});

leadScoreRouter.post('/score/:id', requireCompanyRole(['company_admin', 'department_head']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const p: any = (db.projects || []).find(
    (proj: any) => proj.id === req.params.id && isSameCompany(proj, req.companyId!)
  );
  if (!p) {
    return res.status(404).json({ success: false, message: 'Project not found' });
  }

  const score = calculateLeadScore(p);
  p.leadScore = score;
  writeDB(db);
  return res.json({ success: true, leadScore: score, project: p });
});

leadScoreRouter.post('/score-all', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  let scoredCount = 0;
  (db.projects || []).forEach((p: any) => {
    if (isSameCompany(p, companyId)) {
      p.leadScore = calculateLeadScore(p);
      scoredCount++;
    }
  });
  writeDB(db);
  return res.json({ success: true, scoredCount, message: `Scored ${scoredCount} leads successfully` });
});

// ==========================================
// 3. Client Portal Endpoints (/api/portal) - Token Isolated Guest Portal
// ==========================================

portalRouter.get('/project/:projectId', (req: Request, res: Response) => {
  const db = readDB();
  const { projectId } = req.params;
  const token = typeof req.query.token === 'string' ? req.query.token : '';

  const p: any = (db.projects || []).find((proj: any) => proj.id === projectId);
  if (!p) {
    return res.status(404).json({ success: false, message: 'Project portal not found.' });
  }

  // Require valid portal token or authenticated company membership
  const authUser = (req as AuthenticatedRequest).user;
  const hasCompanyMembership =
    authUser &&
    (db.companyMemberships || []).some(
      (m: any) => m.userId === authUser.id && isSameCompany(p, m.companyId)
    );

  if (!hasCompanyMembership) {
    if (!p.clientPortalToken || !token || token !== p.clientPortalToken) {
      return res.status(403).json({ success: false, message: 'Invalid or missing Client Portal access token.' });
    }
  }

  const sanitizedPortalData = {
    id: p.id,
    clientName: p.clientName,
    clientCompany: p.clientCompany,
    websiteType: p.websiteType,
    purpose: p.purpose,
    status: p.status,
    startDate: p.startDate,
    targetDeliveryDate: p.targetDeliveryDate,
    timelineDays: p.timelineDays,
    stagingUrl: p.stagingUrl || 'https://staging-preview.clientops.internal',
    internalQAPassed: p.internalQAPassed,
    clientApproved: p.clientApproved,
    domainTransferred: p.domainTransferred,
    finalPrice: p.finalPrice,
    advancePaid: p.advancePaid,
    advanceAmount: p.advanceAmount || Number((p.finalPrice * 0.5).toFixed(2)),
    advanceTxId: p.advanceTxId,
    balancePaid: p.balancePaid,
    balanceAmount: p.balanceAmount || Number((p.finalPrice * 0.5).toFixed(2)),
    balanceTxId: p.balanceTxId,
    paymentMethod: p.paymentMethod,
    currency: p.currency || 'USD',
    feedback: p.clientFeedback || []
  };

  return res.json({ success: true, project: sanitizedPortalData });
});

portalRouter.post('/feedback/:projectId', (req: Request, res: Response) => {
  const db = readDB();
  const { projectId } = req.params;
  const { author, content, category, token } = req.body || {};

  const p: any = (db.projects || []).find((proj: any) => proj.id === projectId);
  if (!p) {
    return res.status(404).json({ success: false, message: 'Project not found.' });
  }

  const authUser = (req as AuthenticatedRequest).user;
  const hasCompanyMembership =
    authUser &&
    (db.companyMemberships || []).some(
      (m: any) => m.userId === authUser.id && isSameCompany(p, m.companyId)
    );

  if (!hasCompanyMembership && p.clientPortalToken && token !== p.clientPortalToken) {
    return res.status(403).json({ success: false, message: 'Unauthorized client portal token.' });
  }

  if (!p.clientFeedback) p.clientFeedback = [];
  const feedbackItem = {
    id: `fb-${Date.now()}`,
    author: author || p.clientName || 'Client',
    content,
    category: category || 'revision',
    createdAt: new Date().toISOString(),
    resolved: false
  };

  p.clientFeedback.push(feedbackItem);
  writeDB(db);

  return res.json({ success: true, message: 'Feedback submitted successfully.', feedbackItem });
});

portalRouter.post('/generate-link/:projectId', requireCompanyRole(['company_admin', 'department_head']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const { projectId } = req.params;
  const p: any = (db.projects || []).find(
    (proj: any) => proj.id === projectId && isSameCompany(proj, req.companyId!)
  );
  if (!p) {
    return res.status(404).json({ success: false, message: 'Project not found.' });
  }

  if (!p.clientPortalToken) {
    p.clientPortalToken = `portal-${p.id}-${Math.random().toString(36).substring(2, 10)}`;
    writeDB(db);
  }

  return res.json({
    success: true,
    projectId: p.id,
    token: p.clientPortalToken,
    guestUrl: `/?portal=${p.id}&token=${p.clientPortalToken}`
  });
});

portalRouter.post('/action/:projectId', (req: Request, res: Response) => {
  const db = readDB();
  const { projectId } = req.params;
  const { action, token, clientName, notes } = req.body || {};

  const p: any = (db.projects || []).find((proj: any) => proj.id === projectId);
  if (!p) {
    return res.status(404).json({ success: false, message: 'Project not found.' });
  }

  const authUser = (req as AuthenticatedRequest).user;
  const hasCompanyMembership =
    authUser &&
    (db.companyMemberships || []).some(
      (m: any) => m.userId === authUser.id && isSameCompany(p, m.companyId)
    );

  if (!hasCompanyMembership && p.clientPortalToken && token !== p.clientPortalToken) {
    return res.status(403).json({ success: false, message: 'Unauthorized client token.' });
  }

  if (action === 'approve_milestone') {
    p.clientApproved = true;
    p.clientApprovalDate = new Date().toISOString();
    p.clientRating = 5;
    if (p.status === 'staging_dev') p.status = 'client_review';
    if (!p.clientFeedback) p.clientFeedback = [];
    p.clientFeedback.push({
      id: `fb-appr-${Date.now()}`,
      author: clientName || p.clientName || 'Client',
      content: notes || 'Staging build formally approved by client via Self-Service Portal.',
      category: 'approval',
      createdAt: new Date().toISOString(),
      resolved: true
    });
    writeDB(db);
    return res.json({ success: true, message: 'Milestone sign-off recorded.', project: p });
  }

  if (action === 'request_meeting') {
    return res.json({
      success: true,
      message: 'Meeting request received. Your account manager will confirm the schedule shortly.'
    });
  }

  return res.status(400).json({ success: false, message: 'Unknown portal action.' });
});

export default projectRouter;
