import { Router, Response } from 'express';
import crypto from 'crypto';
import {
  getDB,
  saveDB,
  DEFAULT_ACTIVITY_FEED,
  DEFAULT_WIKI_DOCS,
  DEFAULT_DEPARTMENTAL_PROGRESS,
  logAuditAction
} from '../db';
import {
  AuthenticatedRequest,
  CompanyRole,
  getUserCompaniesSummary,
  requireAuth,
  requireCompanyAccess,
  requireCompanyRole
} from '../middlewares/auth';
import { resendService, DEFAULT_EMAIL_FROM } from '../services/resendService';

const router = Router();

// List ONLY tenants/companies that the authenticated user belongs to
router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { companies } = getUserCompaniesSummary(req.user!.id, req.user!.email);
  res.json({
    success: true,
    tenants: companies
  });
});

// Get specific tenant (strictly verified membership; NEVER fall back to tenants[0])
router.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { companies } = getUserCompaniesSummary(req.user!.id, req.user!.email);
  const tenant = companies.find((t: any) => t.id === id || t.slug === id);

  if (!tenant) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Tenant not found or you do not have membership access.'
    });
  }

  return res.json({
    success: true,
    tenant
  });
});

// Register / Onboard an additional company for the authenticated user
router.post('/onboard', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { companyName, logoUrl, branding, businessInfo, integrations } = req.body || {};
  const cleanName = typeof companyName === 'string' ? companyName.trim() : '';

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Company Name is required for onboarding.'
    });
  }

  const db = getDB();
  if (!Array.isArray(db.tenants)) db.tenants = [];
  if (!Array.isArray(db.departments)) db.departments = [];
  if (!Array.isArray(db.companyMemberships)) db.companyMemberships = [];
  if (!Array.isArray(db.activityFeed)) db.activityFeed = [...DEFAULT_ACTIVITY_FEED];

  const cleanSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  const suffix = crypto.randomBytes(3).toString('hex');
  const tenantId = `comp-${cleanSlug}-${suffix}`;
  const now = new Date().toISOString();

  const newTenant = {
    id: tenantId,
    name: cleanName,
    slug: `${cleanSlug}-${suffix}`,
    ownerUserId: req.user!.id,
    logoUrl: logoUrl || '/icon.svg',
    branding: {
      primaryColor: branding?.primaryColor || '#4f46e5',
      accentColor: branding?.accentColor || '#06b6d4',
      theme: branding?.theme || 'light',
      geometricStyle: branding?.geometricStyle || 'enterprise_clean',
      logoPreset: branding?.logoPreset || 'hexagon_nexus'
    },
    businessInfo: {
      industry: businessInfo?.industry || 'B2B Digital Services',
      companySize: businessInfo?.companySize || '1-10',
      description: businessInfo?.description || `${cleanName} company operations workspace.`,
      website: businessInfo?.website || '',
      targetRevenueUSD: businessInfo?.targetRevenueUSD || 0,
      coreObjectives: businessInfo?.coreObjectives || [
        'Departmental coordination & delivery',
        'Unified client inbox & pipeline',
        'Financial & commission tracking'
      ]
    },
    integrations: {
      linkedIn: {
        connected: Boolean(integrations?.linkedIn?.connected),
        accountHandle: integrations?.linkedIn?.accountHandle || '',
        organizationName: integrations?.linkedIn?.organizationName || cleanName,
        syncIntervalMinutes: integrations?.linkedIn?.syncIntervalMinutes || 15,
        autoOutreachEnabled: Boolean(integrations?.linkedIn?.autoOutreachEnabled),
        messagesSyncedCount: 0
      },
      gmail: {
        connected: Boolean(integrations?.gmail?.connected),
        accountEmail: integrations?.gmail?.accountEmail || req.user!.email,
        threadTracking: Boolean(integrations?.gmail?.threadTracking ?? true),
        autoDraftReplies: Boolean(integrations?.gmail?.autoDraftReplies ?? true),
        emailsSyncedCount: 0
      },
      stripe: {
        connected: Boolean(integrations?.stripe?.connected),
        liveMode: Boolean(integrations?.stripe?.liveMode ?? false),
        currency: integrations?.stripe?.currency || 'USD',
        mrrUSD: 0
      }
    },
    rolesConfig: {
      admin: {
        role: 'admin',
        title: 'Company Owner / Admin',
        department: 'executive',
        dashboardLayout: 'executive_macro',
        permissions: ['all']
      }
    },
    settings: {
      enableEmailOutreach: false,
      enableClientInbox: false,
      enableFinancials: false,
      enableDealsPipeline: false
    },
    activeMembersCount: 1,
    createdAt: now,
    updatedAt: now
  };

  const starterDepts = ['Operations', 'Engineering'].map((deptName, idx) => ({
    id: `dept-${deptName.toLowerCase()}-${suffix}-${idx + 1}`,
    companyId: tenantId,
    name: deptName,
    slug: deptName.toLowerCase(),
    description: `${deptName} department for ${cleanName}.`,
    allowed_modules: ['operations', 'chat'],
    createdBy: req.user!.id,
    createdAt: now
  }));

  const ownerMembership = {
    id: `mem-${tenantId}-${req.user!.id}`,
    companyId: tenantId,
    userId: req.user!.id,
    role: 'company_admin' as CompanyRole,
    departmentIds: starterDepts.map((d) => d.id),
    designation: 'Company Owner',
    joinedAt: now
  };

  db.tenants.unshift(newTenant);
  db.departments.push(...starterDepts);
  db.companyMemberships.push(ownerMembership);
  db.activityFeed.unshift({
    id: `act-${Date.now()}`,
    tenantId,
    companyId: tenantId,
    type: 'system_alert',
    title: `Workspace "${cleanName}" Provisioned`,
    description: `${req.user!.name} created isolated company workspace ${cleanName}.`,
    actorName: req.user!.name,
    actorRole: 'Company Owner',
    sourceChannel: 'system',
    timestamp: now,
    isRead: false
  });

  saveDB(db);

  resendService
    .sendEmail({
      to: req.user!.email,
      from: process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM_ADDRESS || DEFAULT_EMAIL_FROM,
      subject: `Workspace "${cleanName}" Created on ClientOps`,
      text: `Hello ${req.user!.name}, your company workspace "${cleanName}" is now live with isolated departments and team roles.`,
      tenantId,
      template: 'tenant_onboarded'
    })
    .catch(() => {});

  logAuditAction({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: 'company_admin',
    action: 'TENANT_ONBOARDED',
    entityType: 'tenant',
    entityId: tenantId,
    details: { companyName: cleanName },
    ipAddress: req.ip || '127.0.0.1'
  });

  const { companies } = getUserCompaniesSummary(req.user!.id, req.user!.email);
  return res.json({
    success: true,
    message: `Company "${cleanName}" created successfully.`,
    tenant: {
      ...newTenant,
      myRole: 'company_admin',
      myDepartmentIds: ownerMembership.departmentIds,
      myDesignation: ownerMembership.designation
    },
    tenants: companies
  });
});

// Update Tenant Settings & Integrations (Company Owner / Admin only)
router.put('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const membership = (db.companyMemberships || []).find(
    (m: any) => m.companyId === id && m.userId === req.user!.id
  );
  if (!membership || membership.role !== 'company_admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Only Company Owners / Admins can modify company settings.'
    });
  }

  const tenants = db.tenants || [];
  const idx = tenants.findIndex((t: any) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Tenant not found.' });
  }

  const updates = req.body || {};
  const updatedTenant = {
    ...tenants[idx],
    ...updates,
    id: tenants[idx].id,
    branding: { ...tenants[idx].branding, ...(updates.branding || {}) },
    businessInfo: { ...tenants[idx].businessInfo, ...(updates.businessInfo || {}) },
    settings: { ...(tenants[idx].settings || {}), ...(updates.settings || {}) },
    integrations: {
      ...tenants[idx].integrations,
      ...(updates.integrations || {}),
      linkedIn: { ...tenants[idx].integrations?.linkedIn, ...(updates.integrations?.linkedIn || {}) },
      gmail: { ...tenants[idx].integrations?.gmail, ...(updates.integrations?.gmail || {}) },
      stripe: { ...tenants[idx].integrations?.stripe, ...(updates.integrations?.stripe || {}) }
    },
    updatedAt: new Date().toISOString()
  };

  tenants[idx] = updatedTenant;
  db.tenants = tenants;
  saveDB(db);

  return res.json({
    success: true,
    message: 'Company workspace settings updated.',
    tenant: updatedTenant
  });
});

// Departmental metrics strictly scoped to verified company membership
router.get('/:id/departmental', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const membership = (db.companyMemberships || []).find((m: any) => m.companyId === id && m.userId === req.user!.id);
  if (!membership) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant access denied.' });
  }
  const storedDepartmental = (db.departmentalProgress || DEFAULT_DEPARTMENTAL_PROGRESS).filter(
    (d: any) => d.companyId === id || d.tenantId === id
  );
  if (storedDepartmental.length > 0) {
    return res.json({ success: true, departments: storedDepartmental });
  }

  // Compute live departmental progress from the company's real departments, memberships & tasks
  const companyDepts = (db.departments || []).filter((d: any) => d.companyId === id);
  const companyTasks = (db.departmentTasks || []).filter((t: any) => t.companyId === id);
  const companyMembers = (db.companyMemberships || []).filter((m: any) => m.companyId === id);

  const computedDepartmental = companyDepts.map((dept: any) => {
    const deptTasks = companyTasks.filter((t: any) => t.departmentId === dept.id);
    const completedCount = deptTasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length;
    const totalCount = deptTasks.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const membersInDept = companyMembers.filter(
      (m: any) => Array.isArray(m.departmentIds) && m.departmentIds.includes(dept.id)
    ).length;

    return {
      id: dept.id,
      companyId: id,
      department: dept.name,
      departmentId: dept.id,
      progressPercent,
      activeTasks: totalCount - completedCount,
      completedTasks: completedCount,
      membersCount: membersInDept,
      metrics: {
        tasksCompleted: completedCount,
        totalTasks: totalCount,
        membersActive: membersInDept
      }
    };
  });

  return res.json({ success: true, departments: computedDepartmental });
});

router.put('/:id/departmental/:dept', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { id, dept } = req.params;
  if (req.companyId !== id) {
    return res.status(403).json({ success: false, error: 'Forbidden.' });
  }
  const updates = req.body || {};
  const db = getDB();
  const list = db.departmentalProgress || [];
  const idx = list.findIndex((d: any) => d.department === dept && (d.companyId === id || d.tenantId === id));
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Department not found.' });
  }

  list[idx] = {
    ...list[idx],
    ...updates,
    metrics: { ...list[idx].metrics, ...(updates.metrics || {}) }
  };
  db.departmentalProgress = list;
  saveDB(db);

  return res.json({ success: true, department: list[idx] });
});

// Activity Feed strictly scoped to companyId (ZERO cross-tenant fallback)
router.get('/:id/activity', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const membership = (db.companyMemberships || []).find((m: any) => m.companyId === id && m.userId === req.user!.id);
  if (!membership) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant access denied.' });
  }

  const allFeed = db.activityFeed || DEFAULT_ACTIVITY_FEED;
  const filtered = allFeed.filter((item: any) => item.companyId === id || item.tenantId === id);

  return res.json({
    success: true,
    activity: filtered
  });
});

router.post('/:id/activity', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const membership = (db.companyMemberships || []).find((m: any) => m.companyId === id && m.userId === req.user!.id);
  if (!membership) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant access denied.' });
  }

  const { type, title, description, actorName, actorRole, sourceChannel } = req.body || {};
  if (!title) {
    return res.status(400).json({ success: false, message: 'Activity title is required.' });
  }

  const newActivity = {
    id: `act-${Date.now()}`,
    tenantId: id,
    companyId: id,
    type: type || 'system_alert',
    title,
    description: description || '',
    actorName: actorName || req.user!.name,
    actorRole: actorRole || membership.role,
    sourceChannel: sourceChannel || 'system',
    timestamp: new Date().toISOString(),
    isRead: false
  };

  db.activityFeed = [newActivity, ...(db.activityFeed || [])];
  saveDB(db);

  return res.json({ success: true, activityItem: newActivity });
});

// Company Wiki strictly scoped to companyId (ZERO cross-tenant fallback)
router.get('/:id/wiki', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const membership = (db.companyMemberships || []).find((m: any) => m.companyId === id && m.userId === req.user!.id);
  if (!membership) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant access denied.' });
  }

  const docs = Array.isArray(db.wikiDocs) ? db.wikiDocs : [];
  const filtered = docs.filter((d: any) => d.companyId === id || d.tenantId === id);

  return res.json({
    success: true,
    wikiDocs: filtered
  });
});

router.post('/:id/wiki', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const membership = (db.companyMemberships || []).find((m: any) => m.companyId === id && m.userId === req.user!.id);
  if (!membership) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cross-tenant access denied.' });
  }

  const { title, category, description, content, author, tags } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Title and content are required.' });
  }

  const newDoc = {
    id: `wiki-${Date.now()}`,
    tenantId: id,
    companyId: id,
    title,
    category: category || 'outreach_scripts',
    description: description || '',
    content,
    author: author || req.user!.name,
    updatedAt: new Date().toISOString(),
    tags: Array.isArray(tags) ? tags : ['sop', 'general']
  };

  db.wikiDocs = [newDoc, ...(db.wikiDocs || [])];
  saveDB(db);

  return res.json({ success: true, doc: newDoc });
});

export default router;
