import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDB, saveDB, logAuditAction, hashPassword, verifyPassword, DEFAULT_USERS } from '../db';
import {
  AuthenticatedRequest,
  AvailabilityStatus,
  CompanyRole,
  DEFAULT_DEPARTMENT_MODULES,
  getDepartmentAllowedModules,
  getUserCompaniesSummary,
  hasDepartmentAccess,
  hasDepartmentModuleAccess,
  requireAuth,
  requireCompanyAccess,
  requireCompanyRole,
  sanitizeAllowedModules,
  signToken
} from '../middlewares/auth';
import { resendService, DEFAULT_EMAIL_FROM } from '../services/resendService';
import { realtimeEngine } from '../services/realtimeEngine';

export const companyRouter = Router();
export const invitePublicRouter = Router();

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const VALID_AVAILABILITY: AvailabilityStatus[] = ['Available', 'In a Meeting', 'Busy', 'Offline'];
const VALID_TASK_STATUSES = ['todo', 'in_progress', 'review', 'completed'] as const;
const VALID_TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

function slugify(val: string): string {
  return (val || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

function getBaseOrigin(req: Request): string {
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string' && originHeader.startsWith('http')) {
    return originHeader.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

function ensureDeptAccess(
  req: AuthenticatedRequest,
  res: Response,
  companyId: string,
  deptId: string,
  requiredModule?: 'operations'
): any | null {
  const db = getDB();
  const dept = (db.departments || []).find((d: any) => d.id === deptId && d.companyId === companyId);
  if (!dept) {
    res.status(404).json({ success: false, message: 'Department not found in this company.' });
    return null;
  }
  if (!hasDepartmentAccess(req.membership, deptId)) {
    res.status(403).json({
      success: false,
      error: 'Forbidden: You do not belong to this department.'
    });
    return null;
  }
  if (requiredModule && !hasDepartmentModuleAccess(req, requiredModule, deptId)) {
    res.status(403).json({
      success: false,
      code: 'MODULE_ACCESS_DENIED',
      module: requiredModule,
      error: 'Forbidden: The "Department Operations" module is not enabled for your department.'
    });
    return null;
  }
  return dept;
}

function pushCompanyActivity(
  db: any,
  entry: {
    companyId: string;
    type: string;
    title: string;
    description: string;
    actorName: string;
    actorRole: string;
  }
) {
  if (!Array.isArray(db.activityFeed)) db.activityFeed = [];
  db.activityFeed.unshift({
    id: `act-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    tenantId: entry.companyId,
    companyId: entry.companyId,
    type: entry.type,
    title: entry.title,
    description: entry.description,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    sourceChannel: 'workspace',
    timestamp: new Date().toISOString(),
    isRead: false
  });
  if (db.activityFeed.length > 500) {
    db.activityFeed = db.activityFeed.slice(0, 500);
  }
}

// ==========================================
// 1. MULTI-COMPANY MANAGEMENT (/api/companies)
// ==========================================

companyRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const summary = getUserCompaniesSummary(req.user!.id, req.user!.email);
  return res.json({
    success: true,
    companies: summary.companies,
    tenants: summary.companies,
    memberships: summary.memberships,
    pendingInvites: summary.pendingInvites
  });
});

companyRouter.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name, industry, size, description, initialDepartments } = req.body || {};
  const companyName = typeof name === 'string' ? name.trim() : '';

  if (!companyName || companyName.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Company Name (at least 2 characters) is required.'
    });
  }

  const db = getDB();
  if (!Array.isArray(db.tenants)) db.tenants = [];
  if (!Array.isArray(db.departments)) db.departments = [];
  if (!Array.isArray(db.companyMemberships)) db.companyMemberships = [];
  if (!Array.isArray(db.activityFeed)) db.activityFeed = [];

  const cleanSlug = slugify(companyName);
  const suffix = crypto.randomBytes(3).toString('hex');
  const companyId = `comp-${cleanSlug}-${suffix}`;
  const now = new Date().toISOString();

  const newCompany = {
    id: companyId,
    name: companyName,
    slug: `${cleanSlug}-${suffix}`,
    ownerUserId: req.user!.id,
    logoUrl: '/icon.svg',
    branding: {
      primaryColor: '#4f46e5',
      accentColor: '#06b6d4',
      theme: 'light' as const,
      geometricStyle: 'enterprise_clean' as const,
      logoPreset: 'hexagon_nexus'
    },
    businessInfo: {
      industry: (typeof industry === 'string' && industry.trim()) || 'B2B Services & Operations',
      companySize: (typeof size === 'string' && size.trim()) || '1-10',
      description:
        (typeof description === 'string' && description.trim()) ||
        `${companyName} company operations & department workspace.`,
      website: '',
      targetRevenueUSD: 0,
      coreObjectives: [
        'Departmental task and team coordination',
        'Connected mailbox & client inbox management',
        'Deals pipeline & commission tracking'
      ]
    },
    integrations: {
      linkedIn: {
        connected: false,
        accountHandle: '',
        organizationName: companyName,
        syncIntervalMinutes: 15,
        autoOutreachEnabled: false,
        messagesSyncedCount: 0
      },
      gmail: {
        connected: false,
        accountEmail: req.user!.email,
        threadTracking: true,
        autoDraftReplies: true,
        emailsSyncedCount: 0
      },
      stripe: {
        connected: false,
        liveMode: false,
        currency: 'USD',
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

  // Create starter departments (defaulting allowed_modules to ['operations', 'chat'])
  const rawDeptEntries: any[] = Array.isArray(initialDepartments) && initialDepartments.length > 0
    ? initialDepartments
    : ['Operations', 'Engineering'];

  const createdDepts = rawDeptEntries
    .map((entry: any, idx: number) => {
      const deptName = typeof entry === 'string' ? entry.trim() : String(entry?.name || '').trim();
      if (!deptName) return null;
      const customModules =
        typeof entry === 'object' && entry !== null
          ? entry.allowed_modules ?? entry.allowedModules
          : undefined;
      return {
        id: `dept-${slugify(deptName)}-${suffix}-${idx + 1}`,
        companyId,
        name: deptName,
        slug: slugify(deptName),
        description:
          (typeof entry === 'object' && entry?.description) ||
          `${deptName} department workspace for ${companyName}.`,
        allowed_modules: sanitizeAllowedModules(customModules, DEFAULT_DEPARTMENT_MODULES),
        createdBy: req.user!.id,
        createdAt: now
      };
    })
    .filter(Boolean) as any[];

  const ownerMembership = {
    id: `mem-${companyId}-${req.user!.id}`,
    companyId,
    userId: req.user!.id,
    role: 'company_admin' as CompanyRole,
    departmentIds: createdDepts.map((d) => d.id),
    designation: 'Company Owner',
    joinedAt: now
  };

  db.tenants.unshift(newCompany);
  db.departments.push(...createdDepts);
  db.companyMemberships.push(ownerMembership);
  db.activityFeed.unshift({
    id: `act-${Date.now()}`,
    tenantId: companyId,
    companyId,
    type: 'system_alert',
    title: `Company "${companyName}" Registered`,
    description: `${req.user!.name} initialized ${companyName} with ${createdDepts.length} department(s).`,
    actorName: req.user!.name,
    actorRole: 'Company Owner',
    sourceChannel: 'system',
    timestamp: now,
    isRead: false
  });

  saveDB(db);

  logAuditAction({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: 'company_admin',
    action: 'COMPANY_CREATED',
    entityType: 'company',
    entityId: companyId,
    details: { companyName, industry: newCompany.businessInfo.industry, size: newCompany.businessInfo.companySize },
    ipAddress: req.ip || '127.0.0.1'
  });

  const summary = getUserCompaniesSummary(req.user!.id, req.user!.email);
  return res.status(201).json({
    success: true,
    message: `Company "${companyName}" created successfully.`,
    company: {
      ...newCompany,
      myRole: 'company_admin',
      myDepartmentIds: ownerMembership.departmentIds,
      myDesignation: ownerMembership.designation,
      departmentsCount: createdDepts.length
    },
    tenant: newCompany,
    membership: ownerMembership,
    departments: createdDepts,
    companies: summary.companies
  });
});

companyRouter.get('/:companyId', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const company = (db.tenants || []).find((t: any) => t.id === req.companyId);
  if (!company) {
    return res.status(404).json({ success: false, message: 'Company not found.' });
  }
  return res.json({
    success: true,
    company: {
      ...company,
      myRole: req.membership?.role,
      myDepartmentIds: req.membership?.departmentIds || [],
      myDesignation: req.membership?.designation || ''
    }
  });
});

companyRouter.put('/:companyId', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const idx = (db.tenants || []).findIndex((t: any) => t.id === req.companyId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Company not found.' });
  }
  const updates = req.body || {};
  const current = db.tenants[idx];
  const updated = {
    ...current,
    ...updates,
    id: current.id,
    ownerUserId: current.ownerUserId,
    branding: { ...current.branding, ...(updates.branding || {}) },
    businessInfo: { ...current.businessInfo, ...(updates.businessInfo || {}) },
    settings: {
      enableEmailOutreach: false,
      enableClientInbox: false,
      enableFinancials: false,
      enableDealsPipeline: false,
      ...(current.settings || {}),
      ...(updates.settings || {})
    },
    integrations: {
      ...current.integrations,
      ...(updates.integrations || {}),
      linkedIn: { ...current.integrations?.linkedIn, ...(updates.integrations?.linkedIn || {}) },
      gmail: { ...current.integrations?.gmail, ...(updates.integrations?.gmail || {}) },
      stripe: { ...current.integrations?.stripe, ...(updates.integrations?.stripe || {}) }
    },
    updatedAt: new Date().toISOString()
  };
  db.tenants[idx] = updated;
  saveDB(db);
  const summary = getUserCompaniesSummary(req.user!.id, req.user!.email);
  const enrichedCompany =
    summary.companies.find((c: any) => c.id === updated.id) || {
      ...updated,
      myRole: req.membership?.role,
      myDepartmentIds: req.membership?.departmentIds || [],
      myDesignation: req.membership?.designation || ''
    };
  return res.json({ success: true, company: enrichedCompany, tenant: enrichedCompany, companies: summary.companies });
});

companyRouter.get('/:companyId/overview', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const companyId = req.companyId!;
  const company = (db.tenants || []).find((t: any) => t.id === companyId);
  if (!company) {
    return res.status(404).json({ success: false, message: 'Company not found.' });
  }

  const allDepts = (db.departments || []).filter((d: any) => d.companyId === companyId);
  const visibleDepts =
    req.companyRole === 'company_admin'
      ? allDepts
      : allDepts.filter((d: any) => (req.membership?.departmentIds || []).includes(d.id));

  const memberships = (db.companyMemberships || []).filter((m: any) => m.companyId === companyId);
  const users = Array.isArray(db.users) ? db.users : [];
  const tasks = (db.departmentTasks || []).filter((t: any) => t.companyId === companyId);
  const invites = (db.companyInvites || []).filter(
    (inv: any) =>
      inv.companyId === companyId &&
      inv.status === 'pending' &&
      (!inv.expiresAt || new Date(inv.expiresAt).getTime() > Date.now())
  );

  const availableMembersCount = memberships.filter((m: any) => {
    const u = users.find((user: any) => user.id === m.userId);
    return (u?.availabilityStatus || 'Available') === 'Available';
  }).length;

  const tasksOpen = tasks.filter((t: any) => t.status !== 'completed').length;
  const tasksTodo = tasks.filter((t: any) => t.status === 'todo').length;
  const tasksInProgress = tasks.filter((t: any) => t.status === 'in_progress' || t.status === 'review').length;
  const tasksCompleted = tasks.filter((t: any) => t.status === 'completed').length;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const tasksCompletedThisWeek = tasks.filter((t: any) => {
    if (t.status !== 'completed') return false;
    const ts = new Date(t.completedAt || t.updatedAt || t.createdAt || 0).getTime();
    return Number.isFinite(ts) && ts >= sevenDaysAgo;
  }).length;

  const emailAccounts = (db.emailAccounts || []).filter((a: any) => a.companyId === companyId);
  const emailCampaigns = (db.emailCampaigns || []).filter((c: any) => c.companyId === companyId);
  const emailLogs = (db.emailDeliveryLogs || []).filter((l: any) => l.companyId === companyId);

  const emailOutreachEnabled =
    Boolean(company.settings?.enableEmailOutreach) ||
    allDepts.some((d: any) => getDepartmentAllowedModules(d).includes('email_hub'));

  const enrichedDepts = visibleDepts.map((dept: any) => {
    const deptMembers = memberships.filter(
      (m: any) => Array.isArray(m.departmentIds) && m.departmentIds.includes(dept.id)
    );
    const deptTasks = tasks.filter((t: any) => t.departmentId === dept.id);
    const completed = deptTasks.filter((t: any) => t.status === 'completed').length;
    const openCount = deptTasks.filter((t: any) => t.status !== 'completed').length;
    return {
      ...dept,
      allowed_modules: getDepartmentAllowedModules(dept),
      memberCount: deptMembers.length,
      tasksTotal: deptTasks.length,
      tasksOpen: openCount,
      tasksCompleted: completed,
      tasksInProgress: deptTasks.filter((t: any) => t.status === 'in_progress' || t.status === 'review').length
    };
  });

  const membersSummary = memberships
    .map((m: any) => {
      const u = users.find((user: any) => user.id === m.userId);
      if (!u) return null;
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: m.role,
        designation: m.designation || 'Team Member',
        departmentIds: m.departmentIds || [],
        availabilityStatus: u.availabilityStatus || 'Available'
      };
    })
    .filter(Boolean);

  const recentActivity = (Array.isArray(db.activityFeed) ? db.activityFeed : [])
    .filter((item: any) => item && (item.companyId === companyId || item.tenantId === companyId))
    .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 8);

  return res.json({
    success: true,
    company: {
      id: company.id,
      name: company.name,
      industry: company.businessInfo?.industry || '',
      companySize: company.businessInfo?.companySize || '',
      settings: {
        enableEmailOutreach: false,
        enableClientInbox: false,
        enableFinancials: false,
        enableDealsPipeline: false,
        ...(company.settings || {})
      },
      createdAt: company.createdAt
    },
    counts: {
      departments: allDepts.length,
      members: memberships.length,
      availableMembers: availableMembersCount,
      pendingInvites: invites.length,
      tasksTotal: tasks.length,
      tasksOpen,
      tasksTodo,
      tasksInProgress,
      tasksCompleted,
      tasksCompletedThisWeek,
      emailAccounts: emailAccounts.length,
      campaignsSent: emailCampaigns.length,
      emailsDelivered: emailLogs.filter((l: any) => l.status === 'sent').length
    },
    onboardingSteps: {
      hasDepartments: allDepts.length > 0,
      hasTeamMembers: memberships.length > 1 || invites.length > 0,
      hasTasks: tasks.length > 0
    },
    emailOutreachEnabled,
    departments: enrichedDepts,
    members: membersSummary,
    recentActivity
  });
});

// ==========================================
// 2. DEPARTMENTS CRUD (/api/companies/:companyId/departments)
// ==========================================

companyRouter.get('/:companyId/departments', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const companyId = req.companyId!;
  const allDepts = (db.departments || []).filter((d: any) => d.companyId === companyId);
  const memberships = (db.companyMemberships || []).filter((m: any) => m.companyId === companyId);
  const users = db.users || [];
  const tasks = (db.departmentTasks || []).filter((t: any) => t.companyId === companyId);

  const visibleDepts =
    req.companyRole === 'company_admin'
      ? allDepts
      : allDepts.filter((d: any) => (req.membership?.departmentIds || []).includes(d.id));

  const enriched = visibleDepts.map((dept: any) => {
    const deptMembers = memberships.filter((m: any) => Array.isArray(m.departmentIds) && m.departmentIds.includes(dept.id));
    const heads = deptMembers
      .filter((m: any) => m.role === 'department_head' || m.role === 'company_admin')
      .map((m: any) => users.find((u: any) => u.id === m.userId)?.name)
      .filter(Boolean);
    const deptTasks = tasks.filter((t: any) => t.departmentId === dept.id);
    const completedCount = deptTasks.filter((t: any) => t.status === 'completed').length;
    const inProgressCount = deptTasks.filter((t: any) => t.status === 'in_progress').length;

    return {
      ...dept,
      allowed_modules: getDepartmentAllowedModules(dept),
      memberCount: deptMembers.length,
      headNames: heads,
      tasksTotal: deptTasks.length,
      tasksCompleted: completedCount,
      tasksInProgress: inProgressCount
    };
  });

  return res.json({ success: true, departments: enriched });
});

companyRouter.post('/:companyId/departments', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { name, description, allowed_modules, allowedModules } = req.body || {};
  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ success: false, message: 'Department name is required.' });
  }

  const db = getDB();
  const companyId = req.companyId!;
  if (!Array.isArray(db.departments)) db.departments = [];

  const duplicate = db.departments.some(
    (d: any) => d.companyId === companyId && d.name.toLowerCase() === cleanName.toLowerCase()
  );
  if (duplicate) {
    return res.status(409).json({ success: false, message: `Department "${cleanName}" already exists in this company.` });
  }

  const now = new Date().toISOString();
  const deptId = `dept-${slugify(cleanName)}-${crypto.randomBytes(3).toString('hex')}`;
  const resolvedModules = sanitizeAllowedModules(
    allowed_modules !== undefined ? allowed_modules : allowedModules,
    DEFAULT_DEPARTMENT_MODULES
  );

  const newDept = {
    id: deptId,
    companyId,
    name: cleanName,
    slug: slugify(cleanName),
    description: typeof description === 'string' ? description.trim() : '',
    allowed_modules: resolvedModules,
    createdBy: req.user!.id,
    createdAt: now
  };

  db.departments.push(newDept);

  // Grant company_admin memberships automatic access to new department
  (db.companyMemberships || []).forEach((m: any) => {
    if (m.companyId === companyId && m.role === 'company_admin') {
      if (!Array.isArray(m.departmentIds)) m.departmentIds = [];
      if (!m.departmentIds.includes(deptId)) m.departmentIds.push(deptId);
    }
  });

  pushCompanyActivity(db, {
    companyId,
    type: 'department_created',
    title: `Department "${cleanName}" created`,
    description: `${req.user!.name} added the ${cleanName} department.`,
    actorName: req.user!.name,
    actorRole: 'Company Owner'
  });

  saveDB(db);
  realtimeEngine.broadcastToCompany(companyId, 'department:updated', { companyId, action: 'created', department: newDept });

  return res.status(201).json({
    success: true,
    message: `Department "${cleanName}" created.`,
    department: {
      ...newDept,
      memberCount: (db.companyMemberships || []).filter((m: any) => m.companyId === companyId && m.departmentIds?.includes(deptId)).length,
      headNames: [req.user!.name],
      tasksTotal: 0,
      tasksCompleted: 0,
      tasksInProgress: 0
    }
  });
});

companyRouter.patch('/:companyId/departments/:deptId', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { deptId } = req.params;
  const companyId = req.companyId!;
  const db = getDB();

  const dept = (db.departments || []).find((d: any) => d.id === deptId && d.companyId === companyId);
  if (!dept) {
    return res.status(404).json({ success: false, message: 'Department not found.' });
  }

  const { name, description, allowed_modules, allowedModules } = req.body || {};

  if (name !== undefined) {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (cleanName.length < 2) {
      return res.status(400).json({ success: false, message: 'Department name must be at least 2 characters.' });
    }
    const duplicate = (db.departments || []).some(
      (d: any) => d.companyId === companyId && d.id !== deptId && d.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: `Department "${cleanName}" already exists in this company.` });
    }
    dept.name = cleanName;
    dept.slug = slugify(cleanName);
  }

  if (description !== undefined) {
    dept.description = typeof description === 'string' ? description.trim() : '';
  }

  const rawModules = allowed_modules !== undefined ? allowed_modules : allowedModules;
  if (rawModules !== undefined) {
    if (!Array.isArray(rawModules)) {
      return res.status(400).json({ success: false, message: 'allowed_modules must be an array of module keys.' });
    }
    dept.allowed_modules = sanitizeAllowedModules(rawModules, []);
  } else {
    dept.allowed_modules = getDepartmentAllowedModules(dept);
  }

  dept.updatedAt = new Date().toISOString();
  saveDB(db);

  const memberships = (db.companyMemberships || []).filter((m: any) => m.companyId === companyId);
  const deptMembers = memberships.filter((m: any) => Array.isArray(m.departmentIds) && m.departmentIds.includes(dept.id));
  const users = db.users || [];
  const heads = deptMembers
    .filter((m: any) => m.role === 'department_head' || m.role === 'company_admin')
    .map((m: any) => users.find((u: any) => u.id === m.userId)?.name)
    .filter(Boolean);
  const deptTasks = (db.departmentTasks || []).filter((t: any) => t.companyId === companyId && t.departmentId === dept.id);

  const enrichedDept = {
    ...dept,
    allowed_modules: getDepartmentAllowedModules(dept),
    memberCount: deptMembers.length,
    headNames: heads,
    tasksTotal: deptTasks.length,
    tasksCompleted: deptTasks.filter((t: any) => t.status === 'completed').length,
    tasksInProgress: deptTasks.filter((t: any) => t.status === 'in_progress').length
  };

  realtimeEngine.broadcastToCompany(companyId, 'department:updated', {
    companyId,
    departmentId: deptId,
    action: 'permissions_updated',
    department: enrichedDept
  });

  return res.json({
    success: true,
    message: `Department "${dept.name}" permissions updated.`,
    department: enrichedDept
  });
});

companyRouter.delete('/:companyId/departments/:deptId', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { deptId } = req.params;
  const companyId = req.companyId!;
  const db = getDB();

  const idx = (db.departments || []).findIndex((d: any) => d.id === deptId && d.companyId === companyId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Department not found.' });
  }

  const removed = db.departments.splice(idx, 1)[0];

  // Clean department references from memberships, tasks, invites, and chat messages
  (db.companyMemberships || []).forEach((m: any) => {
    if (m.companyId === companyId && Array.isArray(m.departmentIds)) {
      m.departmentIds = m.departmentIds.filter((id: string) => id !== deptId);
    }
  });
  db.departmentTasks = (db.departmentTasks || []).filter(
    (t: any) => !(t.companyId === companyId && t.departmentId === deptId)
  );
  db.companyInvites = (db.companyInvites || []).filter(
    (inv: any) => !(inv.companyId === companyId && inv.departmentId === deptId && inv.status === 'pending')
  );
  db.chatMessages = (db.chatMessages || []).filter(
    (msg: any) => !((msg.companyId === companyId || msg.tenantId === companyId) && msg.departmentId === deptId)
  );

  saveDB(db);
  realtimeEngine.broadcastToCompany(companyId, 'department:updated', { companyId, action: 'deleted', departmentId: deptId });

  return res.json({ success: true, message: `Department "${removed.name}" deleted.` });
});

// ==========================================
// 3. TEAM INVITATIONS (7-DAY RESEND LINKS)
// ==========================================

companyRouter.get('/:companyId/invites', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  if (req.companyRole === 'employee') {
    return res.status(403).json({ success: false, error: 'Forbidden: Employees cannot view invitation records.' });
  }

  const db = getDB();
  const companyId = req.companyId!;
  const departments = db.departments || [];
  let invites = (db.companyInvites || []).filter((inv: any) => inv.companyId === companyId);

  if (req.companyRole === 'department_head') {
    const allowedDepts = req.membership?.departmentIds || [];
    invites = invites.filter((inv: any) => allowedDepts.includes(inv.departmentId));
  }

  const now = Date.now();
  const enriched = invites.map((inv: any) => {
    const dept = departments.find((d: any) => d.id === inv.departmentId);
    const isExpired = inv.status === 'pending' && inv.expiresAt && new Date(inv.expiresAt).getTime() < now;
    return {
      ...inv,
      departmentName: dept?.name || inv.departmentName || 'Department',
      effectiveStatus: isExpired ? 'expired' : inv.status
    };
  });

  return res.json({ success: true, invites: enriched });
});

companyRouter.post('/:companyId/invites', requireCompanyAccess, async (req: AuthenticatedRequest, res: Response) => {
  if (req.companyRole === 'employee') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Only Company Owners or Department Heads can invite team members.'
    });
  }

  const { email, departmentId, role, designation } = req.body || {};
  const targetEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const targetRole: CompanyRole = role === 'department_head' ? 'department_head' : 'employee';
  const targetDesignation = typeof designation === 'string' && designation.trim()
    ? designation.trim()
    : targetRole === 'department_head'
    ? 'Department Head'
    : 'Team Member';

  if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return res.status(400).json({ success: false, message: 'A valid recipient email address is required.' });
  }
  if (!departmentId) {
    return res.status(400).json({ success: false, message: 'Target department is required.' });
  }

  // Enforce strict hierarchy rules
  if (req.companyRole === 'department_head') {
    if (targetRole !== 'employee') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Department Heads can only invite employees into their own department.'
      });
    }
    if (!(req.membership?.departmentIds || []).includes(departmentId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only invite employees into a department you lead.'
      });
    }
  }

  const db = getDB();
  const companyId = req.companyId!;
  const company = (db.tenants || []).find((t: any) => t.id === companyId);
  const dept = (db.departments || []).find((d: any) => d.id === departmentId && d.companyId === companyId);
  if (!company || !dept) {
    return res.status(404).json({ success: false, message: 'Company or department not found.' });
  }

  if (!Array.isArray(db.companyInvites)) db.companyInvites = [];

  // Revoke any previous pending invite to the same email+department to keep tokens clean
  db.companyInvites.forEach((inv: any) => {
    if (
      inv.companyId === companyId &&
      inv.departmentId === departmentId &&
      (inv.email || '').toLowerCase() === targetEmail &&
      inv.status === 'pending'
    ) {
      inv.status = 'superseded';
    }
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS).toISOString();
  const token = crypto.randomBytes(24).toString('hex');
  const inviteId = `inv-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const origin = getBaseOrigin(req);
  const inviteUrl = `${origin}/?invite=${token}`;

  const inviteRecord = {
    id: inviteId,
    token,
    companyId,
    companyName: company.name,
    departmentId,
    departmentName: dept.name,
    email: targetEmail,
    role: targetRole,
    designation: targetDesignation,
    invitedByUserId: req.user!.id,
    invitedByName: req.user!.name,
    status: 'pending',
    expiresAt,
    createdAt: now.toISOString(),
    inviteUrl
  };

  db.companyInvites.unshift(inviteRecord);
  saveDB(db);

  const fromAddress = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM_ADDRESS || DEFAULT_EMAIL_FROM;
  const roleLabel = targetRole === 'department_head' ? 'Department Head' : 'Employee';
  const escapedCompany = company.name.replace(/[<>&"]/g, '');
  const escapedDept = dept.name.replace(/[<>&"]/g, '');
  const escapedInviter = req.user!.name.replace(/[<>&"]/g, '');
  const escapedDesignation = targetDesignation.replace(/[<>&"]/g, '');

  const emailResult = await resendService.sendEmail({
    to: targetEmail,
    from: fromAddress,
    subject: `Invitation: Join ${company.name} (${dept.name}) on ClientOps`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #f8fafc; color: #0f172a;">
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;">
          <div style="font-size: 12px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px;">
            ClientOps Team Invitation
          </div>
          <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0f172a;">
            You're invited to join ${escapedCompany}
          </h1>
          <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
            <strong>${escapedInviter}</strong> has invited you to join the <strong>${escapedDept}</strong> department as <strong>${roleLabel}</strong> (${escapedDesignation}).
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 13px; color: #334155;">
            <div><strong>Company:</strong> ${escapedCompany}</div>
            <div style="margin-top: 6px;"><strong>Department:</strong> ${escapedDept}</div>
            <div style="margin-top: 6px;"><strong>Role & Designation:</strong> ${roleLabel} · ${escapedDesignation}</div>
          </div>
          <a href="${inviteUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 10px;">
            Accept Invitation &amp; Join Workspace
          </a>
          <p style="margin: 20px 0 0 0; font-size: 12px; color: #64748b;">
            This invitation link expires in 7 days. If the button does not work, copy this URL:<br/>
            <span style="word-break: break-all; color: #4f46e5;">${inviteUrl}</span>
          </p>
        </div>
      </div>
    `,
    text: `You're invited to join ${company.name} (${dept.name}) as ${roleLabel} (${targetDesignation}) by ${req.user!.name}.\n\nAccept invitation (valid for 7 days): ${inviteUrl}`,
    tenantId: companyId,
    template: 'team_invitation',
    metadata: { inviteId, departmentId, role: targetRole }
  });

  logAuditAction({
    userId: req.user!.id,
    userName: req.user!.name,
    userRole: req.companyRole,
    action: 'COMPANY_INVITE_SENT',
    entityType: 'invite',
    entityId: inviteId,
    details: { companyId, departmentId, email: targetEmail, role: targetRole, designation: targetDesignation },
    ipAddress: req.ip || '127.0.0.1'
  });

  return res.status(201).json({
    success: true,
    message: emailResult.success
      ? `Invitation email sent to ${targetEmail}.`
      : `Invitation link generated for ${targetEmail}.`,
    invite: inviteRecord,
    deliveryProvider: emailResult.provider
  });
});

companyRouter.delete('/:companyId/invites/:inviteId', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  if (req.companyRole === 'employee') {
    return res.status(403).json({ success: false, error: 'Forbidden.' });
  }
  const db = getDB();
  const inv = (db.companyInvites || []).find(
    (i: any) => i.id === req.params.inviteId && i.companyId === req.companyId
  );
  if (!inv) {
    return res.status(404).json({ success: false, message: 'Invite not found.' });
  }
  if (req.companyRole === 'department_head' && !(req.membership?.departmentIds || []).includes(inv.departmentId)) {
    return res.status(403).json({ success: false, error: 'Forbidden: Cannot revoke invites for another department.' });
  }
  inv.status = 'revoked';
  saveDB(db);
  return res.json({ success: true, message: 'Invitation revoked.' });
});

// Public / Semi-public Invite Inspection & Authenticated Acceptance (/api/invites)
invitePublicRouter.get('/:token', (req: Request, res: Response) => {
  const db = getDB();
  const inv = (db.companyInvites || []).find((i: any) => i.token === req.params.token);
  if (!inv) {
    return res.status(404).json({ success: false, message: 'Invitation link not found or invalid.' });
  }

  const isExpired = inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now();
  const company = (db.tenants || []).find((t: any) => t.id === inv.companyId);
  const dept = (db.departments || []).find((d: any) => d.id === inv.departmentId);
  const userExists = Boolean(
    (db.users || []).some((u: any) => (u.email || '').trim().toLowerCase() === (inv.email || '').trim().toLowerCase())
  );

  return res.json({
    success: true,
    invite: {
      id: inv.id,
      companyId: inv.companyId,
      companyName: company?.name || inv.companyName,
      departmentId: inv.departmentId,
      departmentName: dept?.name || inv.departmentName,
      email: inv.email,
      role: inv.role,
      designation: inv.designation,
      invitedByName: inv.invitedByName,
      status: isExpired && inv.status === 'pending' ? 'expired' : inv.status,
      expiresAt: inv.expiresAt,
      userExists
    }
  });
});

// Dedicated Invited User "Complete Your Profile" Onboarding Endpoint
invitePublicRouter.post('/:token/complete-onboarding', (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const inv = (db.companyInvites || []).find((i: any) => i.token === req.params.token);
  if (!inv) {
    return res.status(404).json({ success: false, message: 'Invitation link not found or invalid.' });
  }
  if (inv.status !== 'pending') {
    return res.status(400).json({ success: false, message: `This invitation is already ${inv.status}.` });
  }
  if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) {
    inv.status = 'expired';
    saveDB(db);
    return res.status(400).json({ success: false, message: 'This invitation link has expired (7-day limit).' });
  }

  const { fullName, name, password, phone, title, bio } = req.body || {};
  const cleanName = typeof (fullName ?? name) === 'string' ? String(fullName ?? name).trim() : '';
  const cleanPassword = typeof password === 'string' ? password : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  const cleanTitle = typeof title === 'string' && title.trim() ? title.trim() : inv.designation || (inv.role === 'department_head' ? 'Department Head' : 'Team Member');
  const cleanBio = typeof bio === 'string' ? bio.trim().slice(0, 500) : '';

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ success: false, message: 'Full Name (at least 2 characters) is required.' });
  }

  if (!Array.isArray(db.users)) db.users = [...DEFAULT_USERS];
  const invEmail = (inv.email || '').trim().toLowerCase();
  let targetUser = db.users.find((u: any) => (u.email || '').trim().toLowerCase() === invEmail);
  const now = new Date().toISOString();

  if (!targetUser) {
    if (!cleanPassword || cleanPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password (minimum 6 characters) is required.' });
    }
    if (!cleanPhone || cleanPhone.length < 3) {
      return res.status(400).json({ success: false, message: 'Phone Number is required to complete your profile.' });
    }

    targetUser = {
      id: `user-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      name: cleanName,
      email: invEmail,
      passwordHash: hashPassword(cleanPassword),
      emailVerified: true,
      emailVerifiedAt: now,
      role: 'team_member',
      title: cleanTitle,
      phone: cleanPhone,
      bio: cleanBio,
      avatar: '',
      availabilityStatus: 'Available' as AvailabilityStatus,
      availabilityUpdatedAt: now,
      permissions: ['workspace:member'],
      createdAt: now,
      updatedAt: now
    };
    db.users.push(targetUser);
  } else {
    const isSameSignedInUser = req.user?.id && req.user.id === targetUser.id;
    if (!isSameSignedInUser) {
      if (!cleanPassword) {
        return res.status(401).json({
          success: false,
          code: 'EXISTING_ACCOUNT_PASSWORD_REQUIRED',
          message: `An account already exists for ${inv.email}. Enter your password to verify and join.`
        });
      }
      const check = verifyPassword(cleanPassword, targetUser.passwordHash);
      if (!check.valid) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password for this existing account.'
        });
      }
    }

    targetUser.name = cleanName;
    if (cleanPhone) targetUser.phone = cleanPhone;
    if (cleanTitle) targetUser.title = cleanTitle;
    if (typeof bio === 'string') targetUser.bio = cleanBio;
    targetUser.updatedAt = now;
  }

  if (!Array.isArray(db.companyMemberships)) db.companyMemberships = [];
  let membership = db.companyMemberships.find(
    (m: any) => m.companyId === inv.companyId && m.userId === targetUser.id
  );

  if (membership) {
    if (!Array.isArray(membership.departmentIds)) membership.departmentIds = [];
    if (!membership.departmentIds.includes(inv.departmentId)) {
      membership.departmentIds.push(inv.departmentId);
    }
    if (membership.role === 'employee' && inv.role === 'department_head') {
      membership.role = 'department_head';
    }
    if (inv.designation) {
      membership.designation = inv.designation;
    }
  } else {
    membership = {
      id: `mem-${inv.companyId}-${targetUser.id}-${crypto.randomBytes(2).toString('hex')}`,
      companyId: inv.companyId,
      userId: targetUser.id,
      role: inv.role === 'department_head' ? 'department_head' : 'employee',
      departmentIds: [inv.departmentId],
      designation: inv.designation || cleanTitle,
      joinedAt: now
    };
    db.companyMemberships.push(membership);
  }

  inv.status = 'accepted';
  inv.acceptedAt = now;
  inv.acceptedByUserId = targetUser.id;

  const company = (db.tenants || []).find((t: any) => t.id === inv.companyId);
  if (company) {
    company.activeMembersCount = db.companyMemberships.filter((m: any) => m.companyId === inv.companyId).length;
  }

  pushCompanyActivity(db, {
    companyId: inv.companyId,
    type: 'member_joined',
    title: `${targetUser.name} joined ${inv.departmentName}`,
    description: `Accepted ${inv.role === 'department_head' ? 'Department Head' : 'Team Member'} invitation.`,
    actorName: targetUser.name,
    actorRole: inv.role === 'department_head' ? 'Department Head' : 'Employee'
  });

  saveDB(db);
  realtimeEngine.updateClientMembership(targetUser.id, inv.companyId, membership.role, membership.departmentIds);
  realtimeEngine.broadcastToDepartment(inv.companyId, inv.departmentId, 'department:updated', {
    companyId: inv.companyId,
    departmentId: inv.departmentId,
    action: 'member_joined',
    userId: targetUser.id
  });

  const token = signToken({
    id: targetUser.id,
    email: targetUser.email,
    role: targetUser.role || 'team_member',
    name: targetUser.name,
    title: targetUser.title || cleanTitle,
    permissions: targetUser.permissions || ['workspace:member'],
    tenant_id: inv.companyId,
    tenantId: inv.companyId
  });

  res.cookie('alm_nexus_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  logAuditAction({
    userId: targetUser.id,
    userName: targetUser.name,
    userRole: membership.role,
    action: 'INVITE_ONBOARDING_COMPLETED',
    entityType: 'invite',
    entityId: inv.id,
    details: { companyId: inv.companyId, departmentId: inv.departmentId, role: membership.role },
    ipAddress: req.ip || '127.0.0.1'
  });

  const summary = getUserCompaniesSummary(targetUser.id, targetUser.email);
  return res.json({
    success: true,
    message: `Profile saved! Welcome to ${inv.companyName} · ${inv.departmentName}.`,
    token,
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role || 'team_member',
      title: targetUser.title || cleanTitle,
      phone: targetUser.phone || '',
      bio: targetUser.bio || '',
      avatar: targetUser.avatar || '',
      availabilityStatus: targetUser.availabilityStatus || 'Available',
      availabilityUpdatedAt: targetUser.availabilityUpdatedAt || now,
      permissions: targetUser.permissions || []
    },
    companyId: inv.companyId,
    departmentId: inv.departmentId,
    membership,
    companies: summary.companies,
    pendingInvites: summary.pendingInvites
  });
});

invitePublicRouter.post('/:token/accept', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const inv = (db.companyInvites || []).find((i: any) => i.token === req.params.token);
  if (!inv) {
    return res.status(404).json({ success: false, message: 'Invitation link not found.' });
  }

  if (inv.status !== 'pending') {
    return res.status(400).json({ success: false, message: `This invitation is already ${inv.status}.` });
  }

  if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) {
    inv.status = 'expired';
    saveDB(db);
    return res.status(400).json({ success: false, message: 'This invitation link has expired (7-day limit).' });
  }

  const userEmail = (req.user!.email || '').trim().toLowerCase();
  if (userEmail !== (inv.email || '').trim().toLowerCase()) {
    return res.status(403).json({
      success: false,
      message: `This invitation was issued to ${inv.email}. Please sign in with that email address to accept.`
    });
  }

  if (!Array.isArray(db.companyMemberships)) db.companyMemberships = [];
  let membership = db.companyMemberships.find(
    (m: any) => m.companyId === inv.companyId && m.userId === req.user!.id
  );

  const now = new Date().toISOString();
  if (membership) {
    if (!Array.isArray(membership.departmentIds)) membership.departmentIds = [];
    if (!membership.departmentIds.includes(inv.departmentId)) {
      membership.departmentIds.push(inv.departmentId);
    }
    // Elevate role if invited as department_head while currently employee (never downgrade company_admin)
    if (membership.role === 'employee' && inv.role === 'department_head') {
      membership.role = 'department_head';
    }
    if (inv.designation) {
      membership.designation = inv.designation;
    }
  } else {
    membership = {
      id: `mem-${inv.companyId}-${req.user!.id}-${crypto.randomBytes(2).toString('hex')}`,
      companyId: inv.companyId,
      userId: req.user!.id,
      role: inv.role === 'department_head' ? 'department_head' : 'employee',
      departmentIds: [inv.departmentId],
      designation: inv.designation || (inv.role === 'department_head' ? 'Department Head' : 'Team Member'),
      joinedAt: now
    };
    db.companyMemberships.push(membership);
  }

  inv.status = 'accepted';
  inv.acceptedAt = now;
  inv.acceptedByUserId = req.user!.id;

  const company = (db.tenants || []).find((t: any) => t.id === inv.companyId);
  if (company) {
    company.activeMembersCount = db.companyMemberships.filter((m: any) => m.companyId === inv.companyId).length;
  }

  pushCompanyActivity(db, {
    companyId: inv.companyId,
    type: 'member_joined',
    title: `${req.user!.name || req.user!.email} joined ${inv.departmentName}`,
    description: `Accepted ${inv.role === 'department_head' ? 'Department Head' : 'Team Member'} invitation.`,
    actorName: req.user!.name || req.user!.email,
    actorRole: inv.role === 'department_head' ? 'Department Head' : 'Employee'
  });

  saveDB(db);
  realtimeEngine.updateClientMembership(req.user!.id, inv.companyId, membership.role, membership.departmentIds);
  realtimeEngine.broadcastToDepartment(inv.companyId, inv.departmentId, 'department:updated', {
    companyId: inv.companyId,
    departmentId: inv.departmentId,
    action: 'member_joined',
    userId: req.user!.id
  });

  const summary = getUserCompaniesSummary(req.user!.id, req.user!.email);
  return res.json({
    success: true,
    message: `Joined ${inv.companyName} · ${inv.departmentName}.`,
    companyId: inv.companyId,
    departmentId: inv.departmentId,
    membership,
    companies: summary.companies,
    pendingInvites: summary.pendingInvites
  });
});

// ==========================================
// 4. DEPARTMENT MEMBERS, DESIGNATIONS, REMOVAL & AVAILABILITY
// ==========================================

companyRouter.get(
  '/:companyId/departments/:deptId/members',
  requireCompanyAccess,
  (req: AuthenticatedRequest, res: Response) => {
    const companyId = req.companyId!;
    const { deptId } = req.params;
    const dept = ensureDeptAccess(req, res, companyId, deptId, 'operations');
    if (!dept) return;

    const db = getDB();
    const users = db.users || [];
    const memberships = (db.companyMemberships || []).filter(
      (m: any) => m.companyId === companyId && Array.isArray(m.departmentIds) && m.departmentIds.includes(deptId)
    );
    const deptTasks = (db.departmentTasks || []).filter(
      (t: any) => t.companyId === companyId && t.departmentId === deptId
    );

    const members = memberships
      .map((m: any) => {
        const user = users.find((u: any) => u.id === m.userId);
        if (!user) return null;
        const memberTasks = deptTasks.filter((t: any) => t.assigneeUserId === user.id);
        const completed = memberTasks.filter((t: any) => t.status === 'completed').length;
        const inProgress = memberTasks.filter((t: any) => t.status === 'in_progress').length;
        const completionPercent = memberTasks.length > 0 ? Math.round((completed / memberTasks.length) * 100) : 0;

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar || '',
          role: m.role,
          designation: m.designation || (m.role === 'company_admin' ? 'Company Owner' : m.role === 'department_head' ? 'Department Head' : 'Team Member'),
          availabilityStatus: user.availabilityStatus || 'Available',
          availabilityUpdatedAt: user.availabilityUpdatedAt || user.createdAt,
          departmentIds: m.departmentIds || [],
          joinedAt: m.joinedAt,
          tasksAssigned: memberTasks.length,
          tasksCompleted: completed,
          tasksInProgress: inProgress,
          completionPercent
        };
      })
      .filter(Boolean);

    return res.json({ success: true, department: dept, members });
  }
);

companyRouter.patch(
  '/:companyId/departments/:deptId/members/:userId',
  requireCompanyAccess,
  (req: AuthenticatedRequest, res: Response) => {
    const companyId = req.companyId!;
    const { deptId, userId } = req.params;
    const dept = ensureDeptAccess(req, res, companyId, deptId);
    if (!dept) return;

    const { designation, role, availabilityStatus } = req.body || {};
    const db = getDB();
    const targetMembership = (db.companyMemberships || []).find(
      (m: any) => m.companyId === companyId && m.userId === userId && Array.isArray(m.departmentIds) && m.departmentIds.includes(deptId)
    );
    const targetUser = (db.users || []).find((u: any) => u.id === userId);

    if (!targetMembership || !targetUser) {
      return res.status(404).json({ success: false, message: 'Member not found in this department.' });
    }

    const isSelf = req.user!.id === userId;
    const isAdmin = req.companyRole === 'company_admin';
    const isDeptHead = req.companyRole === 'department_head' && (req.membership?.departmentIds || []).includes(deptId);

    // Availability update (allowed for self or company_admin)
    if (availabilityStatus !== undefined) {
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only update your own availability status.' });
      }
      if (!VALID_AVAILABILITY.includes(availabilityStatus)) {
        return res.status(400).json({ success: false, message: `Invalid availability status. Allowed: ${VALID_AVAILABILITY.join(', ')}` });
      }
      targetUser.availabilityStatus = availabilityStatus;
      targetUser.availabilityUpdatedAt = new Date().toISOString();
      realtimeEngine.broadcastToDepartment(companyId, deptId, 'availability:updated', {
        companyId,
        departmentId: deptId,
        userId,
        name: targetUser.name,
        availabilityStatus,
        availabilityUpdatedAt: targetUser.availabilityUpdatedAt
      });
    }

    // Designation update (allowed for company_admin or department_head for non-admins)
    if (designation !== undefined) {
      if (!isAdmin && !isDeptHead) {
        return res.status(403).json({ success: false, error: 'Forbidden: Only Company Owners or Department Heads can edit designations.' });
      }
      if (!isAdmin && targetMembership.role === 'company_admin') {
        return res.status(403).json({ success: false, error: 'Forbidden: Cannot modify Company Owner designation.' });
      }
      targetMembership.designation = String(designation).trim() || targetMembership.designation;
    }

    // Role change inside company (company_admin only, cannot demote self if only admin)
    if (role !== undefined && role !== targetMembership.role) {
      if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: Only Company Owners can change member roles.' });
      }
      if (targetMembership.role === 'company_admin') {
        return res.status(400).json({ success: false, message: 'Company Owner role cannot be downgraded here.' });
      }
      if (role === 'department_head' || role === 'employee') {
        targetMembership.role = role;
      }
    }

    saveDB(db);
    realtimeEngine.updateClientMembership(userId, companyId, targetMembership.role, targetMembership.departmentIds);
    realtimeEngine.broadcastToDepartment(companyId, deptId, 'department:updated', {
      companyId,
      departmentId: deptId,
      action: 'member_updated',
      userId
    });

    return res.json({
      success: true,
      member: {
        userId: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetMembership.role,
        designation: targetMembership.designation,
        availabilityStatus: targetUser.availabilityStatus || 'Available',
        availabilityUpdatedAt: targetUser.availabilityUpdatedAt
      }
    });
  }
);

companyRouter.delete(
  '/:companyId/departments/:deptId/members/:userId',
  requireCompanyAccess,
  (req: AuthenticatedRequest, res: Response) => {
    const companyId = req.companyId!;
    const { deptId, userId } = req.params;
    const dept = ensureDeptAccess(req, res, companyId, deptId);
    if (!dept) return;

    if (req.companyRole === 'employee') {
      return res.status(403).json({ success: false, error: 'Forbidden: Employees cannot remove department members.' });
    }

    const db = getDB();
    const memIdx = (db.companyMemberships || []).findIndex(
      (m: any) => m.companyId === companyId && m.userId === userId
    );
    if (memIdx === -1) {
      return res.status(404).json({ success: false, message: 'Membership not found.' });
    }

    const targetMembership = db.companyMemberships[memIdx];
    if (targetMembership.role === 'company_admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot remove the Company Owner.' });
    }
    if (req.companyRole === 'department_head' && targetMembership.role === 'department_head' && userId !== req.user!.id) {
      return res.status(403).json({ success: false, error: 'Forbidden: Department Heads cannot remove other Department Heads.' });
    }

    targetMembership.departmentIds = (targetMembership.departmentIds || []).filter((id: string) => id !== deptId);
    if (targetMembership.departmentIds.length === 0) {
      db.companyMemberships.splice(memIdx, 1);
    }

    const company = (db.tenants || []).find((t: any) => t.id === companyId);
    if (company) {
      company.activeMembersCount = (db.companyMemberships || []).filter((m: any) => m.companyId === companyId).length;
    }

    saveDB(db);
    realtimeEngine.broadcastToDepartment(companyId, deptId, 'department:updated', {
      companyId,
      departmentId: deptId,
      action: 'member_removed',
      userId
    });

    return res.json({ success: true, message: 'Member removed from department.' });
  }
);

// ==========================================
// 5. DEPARTMENT WORK & PROGRESS TASKS
// ==========================================

companyRouter.get(
  '/:companyId/departments/:deptId/tasks',
  requireCompanyAccess,
  (req: AuthenticatedRequest, res: Response) => {
    const companyId = req.companyId!;
    const { deptId } = req.params;
    const dept = ensureDeptAccess(req, res, companyId, deptId, 'operations');
    if (!dept) return;

    const db = getDB();
    let tasks = (db.departmentTasks || []).filter(
      (t: any) => t.companyId === companyId && t.departmentId === deptId
    );

    if (req.companyRole === 'employee') {
      tasks = tasks.filter((t: any) => t.assigneeUserId === req.user!.id);
    }

    const completed = tasks.filter((t: any) => t.status === 'completed').length;
    const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
    const review = tasks.filter((t: any) => t.status === 'review').length;
    const todo = tasks.filter((t: any) => t.status === 'todo').length;

    return res.json({
      success: true,
      department: dept,
      tasks,
      summary: {
        total: tasks.length,
        todo,
        inProgress,
        review,
        completed,
        completionPercent: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0
      }
    });
  }
);

companyRouter.post(
  '/:companyId/departments/:deptId/tasks',
  requireCompanyAccess,
  (req: AuthenticatedRequest, res: Response) => {
    const companyId = req.companyId!;
    const { deptId } = req.params;
    const dept = ensureDeptAccess(req, res, companyId, deptId, 'operations');
    if (!dept) return;

    if (req.companyRole === 'employee') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only Company Owners or Department Heads can assign department tasks.'
      });
    }

    const { title, description, status, priority, assigneeUserId, dueDate } = req.body || {};
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    if (!cleanTitle) {
      return res.status(400).json({ success: false, message: 'Task title is required.' });
    }

    const db = getDB();
    if (!Array.isArray(db.departmentTasks)) db.departmentTasks = [];

    const resolvedAssigneeId = assigneeUserId || req.user!.id;
    const assigneeUser = (db.users || []).find((u: any) => u.id === resolvedAssigneeId);
    const assigneeMem = (db.companyMemberships || []).find(
      (m: any) => m.companyId === companyId && m.userId === resolvedAssigneeId && m.departmentIds?.includes(deptId)
    );

    if (assigneeUserId && !assigneeMem) {
      return res.status(400).json({
        success: false,
        message: 'Assignee must belong to this department.'
      });
    }

    const now = new Date().toISOString();
    const taskStatus = VALID_TASK_STATUSES.includes(status) ? status : 'todo';
    const taskPriority = VALID_TASK_PRIORITIES.includes(priority) ? priority : 'medium';

    const newTask = {
      id: `dtask-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      companyId,
      departmentId: deptId,
      title: cleanTitle,
      description: typeof description === 'string' ? description.trim() : '',
      status: taskStatus,
      priority: taskPriority,
      assigneeUserId: assigneeUser?.id || req.user!.id,
      assigneeName: assigneeUser?.name || req.user!.name,
      assigneeDesignation: assigneeMem?.designation || 'Team Member',
      createdByUserId: req.user!.id,
      createdByName: req.user!.name,
      dueDate: dueDate || '',
      createdAt: now,
      updatedAt: now,
      completedAt: taskStatus === 'completed' ? now : undefined
    };

    db.departmentTasks.unshift(newTask);
    pushCompanyActivity(db, {
      companyId,
      type: 'task_created',
      title: `Task created: ${cleanTitle}`,
      description: `Assigned to ${newTask.assigneeName} in ${dept.name}.`,
      actorName: req.user!.name,
      actorRole: req.companyRole === 'company_admin' ? 'Company Owner' : 'Department Head'
    });
    saveDB(db);

    realtimeEngine.broadcastToDepartment(companyId, deptId, 'task:updated', {
      companyId,
      departmentId: deptId,
      action: 'created',
      task: newTask
    });

    return res.status(201).json({ success: true, task: newTask });
  }
);

companyRouter.patch(
  '/:companyId/departments/:deptId/tasks/:taskId',
  requireCompanyAccess,
  (req: AuthenticatedRequest, res: Response) => {
    const companyId = req.companyId!;
    const { deptId, taskId } = req.params;
    const dept = ensureDeptAccess(req, res, companyId, deptId, 'operations');
    if (!dept) return;

    const db = getDB();
    const task = (db.departmentTasks || []).find(
      (t: any) => t.id === taskId && t.companyId === companyId && t.departmentId === deptId
    );
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found in this department.' });
    }

    const { title, description, status, priority, assigneeUserId, dueDate } = req.body || {};

    if (req.companyRole === 'employee') {
      if (task.assigneeUserId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Employees can only update status on their own assigned tasks.'
        });
      }
      if (status !== undefined && VALID_TASK_STATUSES.includes(status)) {
        task.status = status;
        task.completedAt = status === 'completed' ? new Date().toISOString() : undefined;
      }
      task.updatedAt = new Date().toISOString();
      saveDB(db);

      realtimeEngine.broadcastToDepartment(companyId, deptId, 'task:updated', {
        companyId,
        departmentId: deptId,
        action: 'updated',
        task
      });
      return res.json({ success: true, task });
    }

    if (title !== undefined && String(title).trim()) task.title = String(title).trim();
    if (description !== undefined) task.description = String(description).trim();
    if (status !== undefined && VALID_TASK_STATUSES.includes(status)) {
      task.status = status;
      task.completedAt = status === 'completed' ? new Date().toISOString() : undefined;
    }
    if (priority !== undefined && VALID_TASK_PRIORITIES.includes(priority)) {
      task.priority = priority;
    }
    if (dueDate !== undefined) task.dueDate = dueDate;

    if (assigneeUserId !== undefined) {
      const assigneeUser = (db.users || []).find((u: any) => u.id === assigneeUserId);
      const assigneeMem = (db.companyMemberships || []).find(
        (m: any) => m.companyId === companyId && m.userId === assigneeUserId && m.departmentIds?.includes(deptId)
      );
      if (!assigneeUser || !assigneeMem) {
        return res.status(400).json({ success: false, message: 'Assignee must belong to this department.' });
      }
      task.assigneeUserId = assigneeUser.id;
      task.assigneeName = assigneeUser.name;
      task.assigneeDesignation = assigneeMem.designation || 'Team Member';
    }

    task.updatedAt = new Date().toISOString();
    if (status === 'completed') {
      pushCompanyActivity(db, {
        companyId,
        type: 'task_completed',
        title: `Completed: ${task.title}`,
        description: `Marked complete in ${dept.name}.`,
        actorName: req.user!.name,
        actorRole: req.companyRole === 'company_admin' ? 'Company Owner' : 'Department Head'
      });
    }
    saveDB(db);

    realtimeEngine.broadcastToDepartment(companyId, deptId, 'task:updated', {
      companyId,
      departmentId: deptId,
      action: 'updated',
      task
    });

    return res.json({ success: true, task });
  }
);

companyRouter.delete(
  '/:companyId/departments/:deptId/tasks/:taskId',
  requireCompanyAccess,
  (req: AuthenticatedRequest, res: Response) => {
    const companyId = req.companyId!;
    const { deptId, taskId } = req.params;
    const dept = ensureDeptAccess(req, res, companyId, deptId, 'operations');
    if (!dept) return;

    if (req.companyRole === 'employee') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only Company Owners or Department Heads can delete tasks.' });
    }

    const db = getDB();
    const idx = (db.departmentTasks || []).findIndex(
      (t: any) => t.id === taskId && t.companyId === companyId && t.departmentId === deptId
    );
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    db.departmentTasks.splice(idx, 1);
    saveDB(db);

    realtimeEngine.broadcastToDepartment(companyId, deptId, 'task:updated', {
      companyId,
      departmentId: deptId,
      action: 'deleted',
      taskId
    });

    return res.json({ success: true, message: 'Task deleted.' });
  }
);
