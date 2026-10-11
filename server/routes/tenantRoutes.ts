import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { 
  getDB, 
  saveDB, 
  DEFAULT_TENANTS, 
  DEFAULT_ACTIVITY_FEED, 
  DEFAULT_WIKI_DOCS, 
  DEFAULT_DEPARTMENTAL_PROGRESS,
  hashPassword,
  logAuditAction
} from '../db';
import { signToken, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// ==========================================
// TENANT OPERATIONS
// ==========================================

// List all tenants
router.get('/', (req: Request, res: Response) => {
  const db = getDB();
  const tenants = db.tenants || DEFAULT_TENANTS;
  res.json({
    success: true,
    tenants
  });
});

// Get current active or specific tenant
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const tenants = db.tenants || DEFAULT_TENANTS;
  const tenant = tenants.find((t: any) => t.id === id || t.slug === id) || tenants[0];
  
  if (!tenant) {
    return res.status(404).json({ success: false, message: 'Tenant not found.' });
  }

  res.json({
    success: true,
    tenant
  });
});

// Structured Multi-Step Onboarding & Tenant Setup
router.post('/onboard', (req: Request, res: Response) => {
  const {
    companyName,
    logoUrl,
    branding,
    businessInfo,
    adminUser,
    rolesConfig,
    integrations
  } = req.body || {};

  if (!companyName || !adminUser?.email || !adminUser?.name) {
    return res.status(400).json({
      success: false,
      message: 'Company Name, Admin Name, and Admin Email are required for onboarding.'
    });
  }

  const db = getDB();
  const tenants = db.tenants || DEFAULT_TENANTS;
  const users = db.users || [];

  // Generate clean slug and tenant ID
  const cleanSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  const tenantId = `tenant-${cleanSlug}-${Date.now().toString().slice(-4)}`;

  // Create new Tenant entity
  const newTenant = {
    id: tenantId,
    name: companyName,
    slug: cleanSlug,
    logoUrl: logoUrl || '/icon.svg',
    branding: {
      primaryColor: branding?.primaryColor || '#6366f1',
      accentColor: branding?.accentColor || '#06b6d4',
      theme: branding?.theme || 'dark',
      geometricStyle: branding?.geometricStyle || 'cyber_glass',
      logoPreset: branding?.logoPreset || 'hexagon_nexus'
    },
    businessInfo: {
      industry: businessInfo?.industry || 'B2B Digital Services',
      description: businessInfo?.description || 'Growth operations and automated client handling suite.',
      website: businessInfo?.website || '',
      targetRevenueUSD: businessInfo?.targetRevenueUSD || 100000,
      coreObjectives: businessInfo?.coreObjectives || [
        'LinkedIn & Gmail automated pipeline',
        'Stripe financial escrow milestone management',
        'Cross-departmental team progress oversight'
      ]
    },
    integrations: {
      linkedIn: {
        connected: Boolean(integrations?.linkedIn?.connected),
        accountHandle: integrations?.linkedIn?.accountHandle || '',
        organizationName: integrations?.linkedIn?.organizationName || companyName,
        syncIntervalMinutes: integrations?.linkedIn?.syncIntervalMinutes || 15,
        autoOutreachEnabled: Boolean(integrations?.linkedIn?.autoOutreachEnabled),
        lastSync: integrations?.linkedIn?.connected ? new Date().toISOString() : undefined,
        messagesSyncedCount: integrations?.linkedIn?.connected ? 12 : 0
      },
      gmail: {
        connected: Boolean(integrations?.gmail?.connected),
        accountEmail: integrations?.gmail?.accountEmail || adminUser.email,
        threadTracking: Boolean(integrations?.gmail?.threadTracking ?? true),
        autoDraftReplies: Boolean(integrations?.gmail?.autoDraftReplies ?? true),
        lastSync: integrations?.gmail?.connected ? new Date().toISOString() : undefined,
        emailsSyncedCount: integrations?.gmail?.connected ? 35 : 0
      },
      stripe: {
        connected: Boolean(integrations?.stripe?.connected),
        liveMode: Boolean(integrations?.stripe?.liveMode ?? true),
        publishableKeyMasked: integrations?.stripe?.publishableKeyMasked || (integrations?.stripe?.connected ? 'pk_live_...vault' : undefined),
        currency: integrations?.stripe?.currency || 'USD',
        lastSync: integrations?.stripe?.connected ? new Date().toISOString() : undefined,
        mrrUSD: integrations?.stripe?.connected ? 5000 : 0
      }
    },
    rolesConfig: rolesConfig || {
      admin: {
        role: 'admin',
        title: 'Master Administrator & CEO',
        department: 'executive',
        dashboardLayout: 'executive_macro',
        permissions: ['all']
      }
    },
    activeMembersCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Register or link master Admin user
  const adminPassword = adminUser.password || 'Admin@12345';
  const newUserId = `user-${cleanSlug}-ceo-${Date.now().toString().slice(-4)}`;
  const registeredAdmin = {
    id: newUserId,
    name: adminUser.name,
    email: adminUser.email,
    passwordHash: hashPassword(adminPassword),
    role: 'admin',
    title: adminUser.title || `${companyName} CEO & Managing Director`,
    avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
    tenantId: tenantId,
    permissions: [
      'admin:all',
      'tenant:manage',
      'projects:read',
      'projects:write',
      'commissions:approve',
      'database:manage',
      'integrations:manage'
    ],
    createdAt: new Date().toISOString()
  };

  // Seed initial starter project lead for this tenant
  const starterProject = {
    id: `proj-${cleanSlug}-1`,
    tenantId: tenantId,
    clientName: 'Sarah Jenkins',
    clientEmail: 'sarah.j@crestview-consulting.com',
    clientCompany: 'Crestview Capital UK',
    channel: 'linkedin',
    websiteType: 'corporate',
    purpose: 'Flagship enterprise client portal & interactive proposal booking',
    inspirationUrls: ['https://stripe.com', 'https://linear.app'],
    hasLogo: true,
    hasContent: true,
    hasImages: true,
    useStockPhotos: false,
    needsContentWriting: false,
    hostingStatus: 'has_both',
    hostingProvider: 'Cloudflare Pages & Workers',
    credentialsShared: true,
    estimatedPrice: 1500,
    finalPrice: 1500,
    advancePaid: true,
    advanceAmount: 750,
    advanceTxId: 'STRIPE-TX-99014',
    balancePaid: false,
    balanceAmount: 750,
    paymentMethod: 'stripe',
    currency: 'USD',
    assignedSalesperson: adminUser.name,
    salespersonEmail: adminUser.email,
    commissionRate: 35,
    commissionAmount: 525,
    commissionStatus: 'pending',
    discordShared: true,
    internalQAPassed: true,
    clientApproved: false,
    domainTransferred: false,
    kickOffConfirmed: true,
    timelineDays: 10,
    startDate: new Date().toISOString().split('T')[0],
    targetDeliveryDate: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    maintenanceOfferSent: false,
    maintenanceRetainer: false,
    referralEnrolled: false,
    status: 'staging_dev',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Activity log for onboarding
  const onboardingActivity = {
    id: `act-${Date.now()}`,
    tenantId: tenantId,
    type: 'system_alert',
    title: `Workspace "${companyName}" Successfully Provisioned`,
    description: `Master CEO account configured for ${adminUser.name}. Multi-tenant isolation active.`,
    actorName: adminUser.name,
    actorRole: 'Master Admin / CEO',
    sourceChannel: 'system',
    timestamp: new Date().toISOString(),
    isRead: false
  };

  // Persist into database
  db.tenants = [newTenant, ...tenants];
  db.users = [registeredAdmin, ...users];
  db.projects = [starterProject, ...(db.projects || [])];
  db.activityFeed = [onboardingActivity, ...(db.activityFeed || DEFAULT_ACTIVITY_FEED)];

  saveDB(db);

  // Sign JWT session token for instant authenticated onboarding experience
  const token = signToken({
    id: registeredAdmin.id,
    email: registeredAdmin.email,
    role: registeredAdmin.role,
    name: registeredAdmin.name,
    title: registeredAdmin.title,
    permissions: registeredAdmin.permissions
  });

  logAuditAction({
    userId: registeredAdmin.id,
    userName: registeredAdmin.name,
    userRole: registeredAdmin.role,
    action: 'TENANT_ONBOARDED',
    entityType: 'tenant',
    entityId: tenantId,
    details: { companyName, slug: cleanSlug, email: adminUser.email },
    ipAddress: req.ip || '127.0.0.1'
  });

  return res.json({
    success: true,
    message: `Tenant "${companyName}" successfully established! Welcome to ALM Nexus Enterprise.`,
    tenant: newTenant,
    user: {
      id: registeredAdmin.id,
      name: registeredAdmin.name,
      email: registeredAdmin.email,
      role: registeredAdmin.role,
      title: registeredAdmin.title,
      avatar: registeredAdmin.avatar,
      permissions: registeredAdmin.permissions,
      tenantId: tenantId
    },
    token
  });
});

// Update Tenant Settings & Integrations
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body || {};
  const db = getDB();
  const tenants = db.tenants || DEFAULT_TENANTS;
  const idx = tenants.findIndex((t: any) => t.id === id || t.slug === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Tenant not found.' });
  }

  const updatedTenant = {
    ...tenants[idx],
    ...updates,
    branding: { ...tenants[idx].branding, ...(updates.branding || {}) },
    businessInfo: { ...tenants[idx].businessInfo, ...(updates.businessInfo || {}) },
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

  res.json({
    success: true,
    message: 'Tenant workspace settings updated.',
    tenant: updatedTenant
  });
});

// ==========================================
// DEPARTMENTAL PROGRESS & REAL-TIME TRACKING
// ==========================================

router.get('/:id/departmental', (req: Request, res: Response) => {
  const db = getDB();
  const departmental = db.departmentalProgress || DEFAULT_DEPARTMENTAL_PROGRESS;
  res.json({
    success: true,
    departments: departmental
  });
});

router.put('/:id/departmental/:dept', (req: Request, res: Response) => {
  const { dept } = req.params;
  const updates = req.body || {};
  const db = getDB();
  const list = db.departmentalProgress || DEFAULT_DEPARTMENTAL_PROGRESS;
  const idx = list.findIndex((d: any) => d.department === dept);

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

  res.json({
    success: true,
    department: list[idx]
  });
});

// ==========================================
// ACTIVITY FEED STREAM & SYSTEM ALERTS
// ==========================================

router.get('/:id/activity', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const allFeed = db.activityFeed || DEFAULT_ACTIVITY_FEED;
  const filtered = allFeed.filter((item: any) => !item.tenantId || item.tenantId === id || id === 'all');

  res.json({
    success: true,
    activity: filtered.length > 0 ? filtered : allFeed
  });
});

router.post('/:id/activity', (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, title, description, actorName, actorRole, sourceChannel } = req.body || {};

  if (!title) {
    return res.status(400).json({ success: false, message: 'Activity title is required.' });
  }

  const db = getDB();
  const newActivity = {
    id: `act-${Date.now()}`,
    tenantId: id,
    type: type || 'system_alert',
    title,
    description: description || '',
    actorName: actorName || 'System Automated Bot',
    actorRole: actorRole || 'Automation Engine',
    sourceChannel: sourceChannel || 'system',
    timestamp: new Date().toISOString(),
    isRead: false
  };

  db.activityFeed = [newActivity, ...(db.activityFeed || DEFAULT_ACTIVITY_FEED)];
  saveDB(db);

  res.json({
    success: true,
    activityItem: newActivity
  });
});

// ==========================================
// GLOBAL COMPANY WIKI / KNOWLEDGE BASE
// ==========================================

router.get('/:id/wiki', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDB();
  const docs = db.wikiDocs || DEFAULT_WIKI_DOCS;
  const filtered = docs.filter((d: any) => !d.tenantId || d.tenantId === id || id === 'all');

  res.json({
    success: true,
    wikiDocs: filtered.length > 0 ? filtered : docs
  });
});

router.post('/:id/wiki', (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, category, description, content, author, tags } = req.body || {};

  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'Title and content are required.' });
  }

  const db = getDB();
  const newDoc = {
    id: `wiki-${Date.now()}`,
    tenantId: id,
    title,
    category: category || 'outreach_scripts',
    description: description || '',
    content,
    author: author || 'Team Member',
    updatedAt: new Date().toISOString(),
    tags: Array.isArray(tags) ? tags : ['sop', 'general']
  };

  db.wikiDocs = [newDoc, ...(db.wikiDocs || DEFAULT_WIKI_DOCS)];
  saveDB(db);

  res.json({
    success: true,
    doc: newDoc
  });
});

export default router;
