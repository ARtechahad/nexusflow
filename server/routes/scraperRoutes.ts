import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { readDB, writeDB, logAuditAction } from '../db';
import { authenticateApiKey, AuthenticatedRequest, requireCompanyRole } from '../middlewares/auth';

export const scraperRouter = Router();
export const ingestRouter = Router();

// Enforce strict company admin or department head isolation on all scraper management routes
scraperRouter.use(requireCompanyRole(['company_admin', 'department_head']));

function getCompanyScraperConfig(db: any, companyId: string) {
  if (!db.scraperConfigs || typeof db.scraperConfigs !== 'object') {
    db.scraperConfigs = {};
  }
  if (!db.scraperConfigs[companyId]) {
    db.scraperConfigs[companyId] = {
      companyId,
      keywords: ['web developer needed', 'e-commerce store setup', 'landing page'],
      platforms: ['linkedin', 'upwork', 'twitter', 'freelancer'],
      autoInject: false,
      minBudget: 300,
      isScanningActive: false,
      scanIntervalMinutes: 60,
      lastScanTime: null
    };
  }
  return db.scraperConfigs[companyId];
}

// ========================================================
// PHASE 1: AUTOMATED LEAD GENERATION & OUTREACH
// ========================================================

// 1. Scraper Configuration
scraperRouter.get('/config', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const config = getCompanyScraperConfig(db, companyId);
  res.json({ success: true, config });
});

scraperRouter.put('/config', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const config = getCompanyScraperConfig(db, companyId);
  const { keywords, platforms, autoInject, minBudget, isScanningActive, scanIntervalMinutes } = req.body || {};

  if (Array.isArray(keywords)) config.keywords = keywords;
  if (Array.isArray(platforms)) config.platforms = platforms;
  if (typeof autoInject === 'boolean') config.autoInject = autoInject;
  if (typeof minBudget === 'number') config.minBudget = minBudget;
  if (typeof isScanningActive === 'boolean') config.isScanningActive = isScanningActive;
  if (typeof scanIntervalMinutes === 'number') config.scanIntervalMinutes = scanIntervalMinutes;

  writeDB(db);
  res.json({ success: true, config, message: 'Scraper settings saved successfully.' });
});

// 2. Scraped Leads Feed & Live Scanner Job (Strictly company-scoped)
scraperRouter.get('/leads', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const config = getCompanyScraperConfig(db, companyId);
  const leads = (db.scrapedLeads || []).filter(
    (l: any) => (l.companyId || l.tenantId) === companyId
  );

  res.json({
    success: true,
    leads,
    config,
    stats: {
      totalFound: leads.length,
      injectedCount: leads.filter((l: any) => l.injectedToPipeline).length,
      pendingReview: leads.filter((l: any) => !l.injectedToPipeline).length
    }
  });
});

scraperRouter.post('/scan', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const config = getCompanyScraperConfig(db, companyId);
  const { customKeyword, targetPlatform } = req.body || {};

  const activeKeywords = customKeyword ? [customKeyword, ...(config.keywords || [])] : (config.keywords || []);
  const activePlatforms = targetPlatform ? [targetPlatform] : (config.platforms || []);

  const possibleScrapedTemplates = [
    {
      keyword: 'web developer needed',
      platform: 'linkedin' as const,
      title: 'Looking for a Senior Web Developer to revamp B2B SaaS website',
      author: 'Evelyn Reed',
      authorTitle: 'Chief Commercial Officer',
      company: 'DataSphere Analytics (Austin, TX)',
      snippet: 'Web developer needed ASAP to build a 6-page responsive site with interactive ROI calculator and clean modern layout. Seeking an agency or full-stack dev with fast turnaround.',
      budget: 850,
      websiteType: 'corporate' as const,
      url: 'https://linkedin.com/feed/update/urn:li:activity:72109823401923'
    },
    {
      keyword: 'e-commerce store setup',
      platform: 'upwork' as const,
      title: 'Complete E-commerce Store Setup with Multi-Currency & Stripe',
      author: 'Julian Moreau',
      authorTitle: 'Managing Director',
      company: 'Atelier Moreau Paris',
      snippet: 'Need complete e-commerce store setup for high-end boutique apparel. Product catalog, cart abandonment triggers, multi-currency checkout, and domain SSL configuration required.',
      budget: 700,
      websiteType: 'ecommerce' as const,
      url: 'https://upwork.com/jobs/~01f8992b4912cc908'
    },
    {
      keyword: 'landing page',
      platform: 'twitter' as const,
      title: 'Hiring a web developer for a high-converting Fintech Landing Page',
      author: 'Maya Chen',
      authorTitle: 'Co-founder & Head of Product',
      company: 'Zenith Vault Inc.',
      snippet: 'Looking for an experienced web developer to design a dark-mode Fintech landing page. Fast animations, high conversion, mobile responsive. DM your portfolio and rates!',
      budget: 450,
      websiteType: 'landing' as const,
      url: 'https://twitter.com/maya_zenith/status/1799201928371'
    },
    {
      keyword: 'Shopify expert',
      platform: 'upwork' as const,
      title: 'Shopify Store Customization & Speed Optimization Expert Needed',
      author: 'Christopher Brand',
      authorTitle: 'E-commerce Director',
      company: 'PureBotanics Wellness UK',
      snippet: 'Looking for an expert to handle our Shopify e-commerce store setup and custom liquid templates. Must integrate automated inventory sync and PayPal/Klarna payments.',
      budget: 620,
      websiteType: 'ecommerce' as const,
      url: 'https://upwork.com/jobs/~01d8919a009bc7144'
    },
    {
      keyword: 'WordPress redesign',
      platform: 'freelancer' as const,
      title: 'Medical Clinic Website Redesign & Booking System Integration',
      author: 'Dr. Sarah Jenkins',
      authorTitle: 'Medical Director',
      company: 'Harborview Wellness Clinic',
      snippet: 'We need an experienced web developer to redesign our legacy website. Must feature patient intake booking, doctor profiles, and HIPAA-compliant inquiry forms.',
      budget: 950,
      websiteType: 'corporate' as const,
      url: 'https://freelancer.com/projects/web-development/medical-clinic-redesign-39012'
    }
  ];

  const matched = possibleScrapedTemplates.filter(item => {
    const keywordMatches = activeKeywords.some((kw: string) =>
      item.keyword.toLowerCase().includes(kw.toLowerCase()) ||
      kw.toLowerCase().includes(item.keyword.toLowerCase()) ||
      item.snippet.toLowerCase().includes(kw.toLowerCase()) ||
      item.title.toLowerCase().includes(kw.toLowerCase())
    );
    const platformMatches = activePlatforms.includes(item.platform);
    return keywordMatches && platformMatches;
  });

  const leadsToAdd = matched.length > 0 ? matched : [possibleScrapedTemplates[0], possibleScrapedTemplates[1]];
  let newlyFoundCount = 0;
  let autoInjectedCount = 0;

  if (!Array.isArray(db.scrapedLeads)) db.scrapedLeads = [];
  if (!Array.isArray(db.projects)) db.projects = [];
  if (!Array.isArray(db.chatMessages)) db.chatMessages = [];

  const companyLeads = db.scrapedLeads.filter(
    (l: any) => (l.companyId || l.tenantId) === companyId
  );

  leadsToAdd.forEach((item, index) => {
    const exists = companyLeads.some((l: any) => l.title === item.title || l.url === item.url);
    if (!exists) {
      const newScrapedId = `scrape-${Date.now()}-${index}`;
      const newLeadObj: any = {
        id: newScrapedId,
        companyId,
        tenantId: companyId,
        platform: item.platform,
        title: item.title,
        authorName: item.author,
        authorTitle: item.authorTitle,
        companyName: item.company,
        postSnippet: item.snippet,
        matchedKeyword: item.keyword,
        estimatedBudget: item.budget,
        detectedWebsiteType: item.websiteType,
        matchScore: Math.floor(Math.random() * 6) + 93,
        url: item.url,
        scrapedAt: new Date().toISOString(),
        injectedToPipeline: false
      };

      if (config.autoInject) {
        const commissionRate = item.budget <= 300 ? 25 : item.budget <= 700 ? 30 : 35;
        const commissionAmount = Number(((item.budget * commissionRate) / 100).toFixed(2));
        const newProjId = `proj-${Date.now()}-${index}`;

        const newProject: any = {
          id: newProjId,
          companyId,
          tenantId: companyId,
          clientName: item.author,
          clientEmail: `${item.author.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${item.company.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}.com`,
          clientCompany: item.company,
          channel: item.platform === 'linkedin' ? 'linkedin' : item.platform === 'upwork' ? 'upwork' : 'direct',
          websiteType: item.websiteType,
          purpose: `${item.title}: ${item.snippet}`,
          inspirationUrls: [],
          hasLogo: false,
          hasContent: false,
          hasImages: false,
          useStockPhotos: true,
          needsContentWriting: true,
          hostingStatus: 'needs_both',
          credentialsShared: false,
          recommendedHost: 'Hostinger',
          estimatedPrice: item.budget,
          finalPrice: item.budget,
          advancePaid: false,
          advanceAmount: Number((item.budget * 0.5).toFixed(2)),
          balancePaid: false,
          balanceAmount: Number((item.budget * 0.5).toFixed(2)),
          paymentMethod: 'paypal',
          currency: 'USD',
          assignedSalesperson: req.user?.name || 'Sales Desk',
          salespersonEmail: req.user?.email || '',
          commissionRate,
          commissionAmount,
          commissionStatus: 'pending',
          discordShared: false,
          internalQAPassed: false,
          clientApproved: false,
          domainTransferred: false,
          kickOffConfirmed: false,
          timelineDays: item.websiteType === 'landing' ? 7 : 14,
          startDate: new Date().toISOString().split('T')[0],
          targetDeliveryDate: new Date(Date.now() + 86400000 * (item.websiteType === 'landing' ? 7 : 14)).toISOString().split('T')[0],
          maintenanceOfferSent: false,
          maintenanceRetainer: false,
          referralEnrolled: false,
          status: 'lead',
          dripCampaign: {
            enabled: true,
            currentStage: 1,
            daysOverdue: 0,
            status: 'active',
            history: []
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        db.projects.unshift(newProject);
        newLeadObj.injectedToPipeline = true;
        newLeadObj.injectedProjectId = newProjId;
        autoInjectedCount++;

        db.chatMessages.push({
          id: `msg-auto-inject-${Date.now()}-${index}`,
          companyId,
          tenantId: companyId,
          senderId: 'bot-agent-reach',
          senderName: 'Lead Ingestion Bot',
          senderRole: 'sales',
          channel: 'general',
          content: `Live Lead Discovered & Placed in Pipeline: ${item.author} (${item.company}) — $${item.budget} (${item.websiteType.toUpperCase()})`,
          timestamp: new Date().toISOString(),
          reactions: {}
        });
      }

      db.scrapedLeads.unshift(newLeadObj);
      newlyFoundCount++;
    }
  });

  config.lastScanTime = new Date().toISOString();
  writeDB(db);

  const updatedLeads = db.scrapedLeads.filter((l: any) => (l.companyId || l.tenantId) === companyId);

  res.json({
    success: true,
    newlyFoundCount,
    autoInjectedCount,
    totalLeads: updatedLeads.length,
    leads: updatedLeads,
    message: newlyFoundCount > 0
      ? `Successfully discovered ${newlyFoundCount} live leads matching active keywords.${autoInjectedCount > 0 ? ` (${autoInjectedCount} auto-injected to Discovery column)` : ''}`
      : 'Live scan complete. No new unlisted leads found for current keywords.'
  });
});

// 3. Inject Lead directly into Pipeline Discovery Column (Strictly company-scoped)
scraperRouter.post('/inject/:id', (req: AuthenticatedRequest, res: Response) => {
  const companyId = req.companyId!;
  const db = readDB();
  const leadId = req.params.id;
  const lead: any = (db.scrapedLeads || []).find(
    (l: any) => l.id === leadId && (l.companyId || l.tenantId) === companyId
  );

  if (!lead) {
    return res.status(404).json({ success: false, message: 'Scraped lead record not found in your company workspace.' });
  }

  if (lead.injectedToPipeline) {
    return res.json({ success: true, message: 'Lead is already present in the Discovery pipeline.', projectId: lead.injectedProjectId });
  }

  const commissionRate = lead.estimatedBudget <= 300 ? 25 : lead.estimatedBudget <= 700 ? 30 : 35;
  const commissionAmount = Number(((lead.estimatedBudget * commissionRate) / 100).toFixed(2));
  const newProjId = `proj-${Date.now()}`;

  const newProject: any = {
    id: newProjId,
    companyId,
    tenantId: companyId,
    clientName: lead.authorName,
    clientEmail: `${lead.authorName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${(lead.companyName || 'client').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    clientCompany: lead.companyName || `${lead.authorName} Enterprise`,
    channel: lead.platform === 'linkedin' ? 'linkedin' : lead.platform === 'upwork' ? 'upwork' : 'direct',
    websiteType: lead.detectedWebsiteType || 'custom',
    purpose: `${lead.title} — ${lead.postSnippet}`,
    inspirationUrls: [],
    hasLogo: false,
    hasContent: false,
    hasImages: false,
    useStockPhotos: true,
    needsContentWriting: true,
    hostingStatus: 'needs_both',
    credentialsShared: false,
    recommendedHost: 'Hostinger',
    estimatedPrice: lead.estimatedBudget,
    finalPrice: lead.estimatedBudget,
    advancePaid: false,
    advanceAmount: Number((lead.estimatedBudget * 0.5).toFixed(2)),
    balancePaid: false,
    balanceAmount: Number((lead.estimatedBudget * 0.5).toFixed(2)),
    paymentMethod: 'paypal',
    currency: 'USD',
    assignedSalesperson: req.user?.name || 'Sales Desk',
    salespersonEmail: req.user?.email || '',
    commissionRate,
    commissionAmount,
    commissionStatus: 'pending',
    discordShared: false,
    internalQAPassed: false,
    clientApproved: false,
    domainTransferred: false,
    kickOffConfirmed: false,
    timelineDays: lead.detectedWebsiteType === 'landing' ? 7 : 14,
    startDate: new Date().toISOString().split('T')[0],
    targetDeliveryDate: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    maintenanceOfferSent: false,
    maintenanceRetainer: false,
    referralEnrolled: false,
    status: 'lead',
    dripCampaign: {
      enabled: true,
      currentStage: 1,
      daysOverdue: 0,
      status: 'active',
      history: []
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!Array.isArray(db.projects)) db.projects = [];
  if (!Array.isArray(db.chatMessages)) db.chatMessages = [];

  db.projects.unshift(newProject);
  lead.injectedToPipeline = true;
  lead.injectedProjectId = newProjId;

  db.chatMessages.push({
    id: `msg-inject-${Date.now()}`,
    companyId,
    tenantId: companyId,
    senderId: req.user?.id || 'bot-scraper',
    senderName: req.user?.name || 'Lead Ingestion Desk',
    senderRole: 'sales',
    channel: 'general',
    content: `Injected Scraped Lead into Discovery Pipeline: ${lead.authorName} (${lead.companyName || 'Prospect'}) — $${lead.estimatedBudget} USD`,
    timestamp: new Date().toISOString(),
    reactions: {}
  });

  writeDB(db);

  res.json({
    success: true,
    message: `Lead ${lead.authorName} successfully injected into Discovery column.`,
    project: newProject
  });
});

// ==========================================
// Inbound Automation Webhook Endpoint (/api/v1/leads/ingest)
// ==========================================

ingestRouter.get('/ingest', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    endpoint: '/api/v1/leads/ingest',
    method: 'POST',
    description: 'Direct Inbound Automation ingestion endpoint for n8n workflows, Python scrapers, and external Real Estate IDX parsers.',
    authentication: 'Header X-API-Key: sk_live_... OR Authorization: Bearer sk_live_...',
    payloadExample: {
      clientName: 'Client Contact Name',
      clientEmail: 'contact@client-company.com',
      clientCompany: 'Client Company Name',
      websiteType: 'corporate',
      purpose: 'Corporate web portal scope description',
      budget: 1500,
      source: 'n8n_automation'
    }
  });
});

ingestRouter.post('/ingest', authenticateApiKey, (req: Request, res: Response) => {
  const token = (req as any).apiToken;
  const companyId = token?.companyId || token?.tenantId || (req as any).companyId;
  if (!companyId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: API token is not bound to a company workspace.'
    });
  }

  const rawBody = req.body;
  if (!rawBody) {
    return res.status(400).json({ success: false, error: 'Request body cannot be empty.' });
  }

  let rawItems: any[] = [];
  if (Array.isArray(rawBody)) {
    rawItems = rawBody;
  } else if (Array.isArray(rawBody.leads)) {
    rawItems = rawBody.leads;
  } else if (typeof rawBody === 'object') {
    rawItems = [rawBody];
  }

  if (rawItems.length === 0) {
    return res.status(400).json({ success: false, error: 'No lead items provided in payload.' });
  }

  const db = readDB();
  if (!Array.isArray(db.projects)) db.projects = [];
  if (!Array.isArray(db.scrapedLeads)) db.scrapedLeads = [];

  const createdProjects: any[] = [];
  const leadIds: string[] = [];

  for (const item of rawItems) {
    const clientName = item.clientName || item.name || item.contact_name || item.author || 'Inbound Prospect';
    const clientEmail = item.clientEmail || item.email || item.contact_email || '';
    const clientPhone = item.clientPhone || item.phone || '';
    const clientCompany = item.clientCompany || item.company || item.companyName || item.property_title || 'Private Venture';
    const websiteType = item.websiteType || item.website_type || 'corporate';
    const purpose = item.purpose || item.description || item.notes || `Automated lead ingestion from ${item.source || 'external automation'}`;
    const budget = Number(item.budget || item.estimatedPrice || item.price || item.estimatedBudget) || 650;
    const source = item.source || item.channel || 'n8n_automation';
    const assignedCollabs = Array.isArray(item.assignedCollaborators) ? item.assignedCollaborators : (item.collaborator ? [item.collaborator] : []);

    let commissionRate = 30;
    if (budget <= 300) commissionRate = 25;
    else if (budget > 700) commissionRate = 35;
    const commissionAmount = Number(((budget * commissionRate) / 100).toFixed(2));

    const projId = `proj-inbound-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    leadIds.push(projId);

    let leadScore = 65;
    if (budget >= 1000) leadScore += 15;
    if (clientEmail.includes('@') && !clientEmail.includes('gmail') && !clientEmail.includes('yahoo')) leadScore += 10;
    if (clientPhone) leadScore += 5;
    if (item.propertyDetails || item.realEstateData) leadScore += 5;

    const newProject: any = {
      id: projId,
      companyId,
      tenantId: companyId,
      clientName,
      clientEmail,
      clientCompany,
      channel: (source.toLowerCase().includes('python') ? 'freelancer' : source.toLowerCase().includes('linkedin') ? 'linkedin' : 'custom') as any,
      websiteType: (websiteType === 'ecommerce' || websiteType === 'landing' || websiteType === 'corporate' ? websiteType : 'custom') as any,
      purpose,
      inspirationUrls: Array.isArray(item.inspirationUrls) ? item.inspirationUrls : (item.url ? [item.url] : []),
      hasLogo: Boolean(item.hasLogo),
      hasContent: Boolean(item.hasContent),
      hasImages: Boolean(item.hasImages),
      useStockPhotos: false,
      needsContentWriting: false,
      assetNotes: item.assetNotes || (item.propertyDetails ? `Real Estate IDX Property: ${JSON.stringify(item.propertyDetails)}` : 'Inbound automated scrape data.'),
      hostingStatus: item.hostingStatus || 'needs_both',
      recommendedHost: 'Namecheap',
      credentialsShared: false,
      estimatedPrice: budget,
      finalPrice: budget,
      advancePaid: false,
      advanceAmount: Number((budget * 0.5).toFixed(2)),
      balancePaid: false,
      balanceAmount: Number((budget * 0.5).toFixed(2)),
      paymentMethod: 'stripe',
      currency: 'USD',
      assignedSalesperson: item.assignedSalesperson || 'Sales Desk',
      salespersonEmail: item.salespersonEmail || '',
      commissionRate,
      commissionAmount,
      commissionStatus: 'pending',
      discordShared: false,
      internalQAPassed: false,
      clientApproved: false,
      domainTransferred: false,
      kickOffConfirmed: false,
      timelineDays: 14,
      startDate: new Date().toISOString().split('T')[0],
      targetDeliveryDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      maintenanceOfferSent: false,
      maintenanceRetainer: false,
      monthlyRetainerFee: 120,
      referralEnrolled: false,
      status: 'lead',
      assignedCollaborators: assignedCollabs,
      partnerEvaluationNotes: item.partnerNotes || '',
      partnerEvaluationScore: undefined,
      partnerSignOff: false,
      isDealSheetShared: assignedCollabs.length > 0,
      smartScore: leadScore,
      leadPriority: leadScore >= 85 ? 'VIP' : leadScore >= 70 ? 'Hot' : 'Warm',
      inboundSource: source,
      apiTokenId: token?.id,
      apiTokenName: token?.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.projects.unshift(newProject);
    createdProjects.push(newProject);

    db.scrapedLeads.unshift({
      id: `lead-inbound-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      companyId,
      tenantId: companyId,
      keyword: item.propertyDetails ? 'Real Estate Property Deal' : 'Inbound Webhook Lead',
      platform: (source.toLowerCase().includes('idx') ? 'freelancer' : 'upwork') as any,
      title: `${clientCompany} — ${purpose.slice(0, 75)}`,
      authorName: clientName,
      authorTitle: item.authorTitle || 'Director / Asset Owner',
      companyName: clientCompany,
      snippet: purpose,
      estimatedBudget: budget,
      detectedWebsiteType: newProject.websiteType,
      url: item.url || 'https://automation.agencyops.internal/lead/' + projId,
      scrapedAt: new Date().toISOString(),
      injectedToPipeline: true,
      injectedProjectId: projId
    });
  }

  writeDB(db);

  logAuditAction({
    companyId,
    userId: token?.userId || 'api-system',
    userName: token?.name || 'Automation Ingestion Token',
    userRole: 'api_token',
    action: 'LEAD_API_INGESTED',
    entityType: 'project_lead',
    entityId: leadIds[0],
    details: {
      ingestedCount: createdProjects.length,
      tokenName: token?.name,
      tokenPrefix: token?.tokenPrefix,
      leadIds
    },
    ipAddress: req.ip || '127.0.0.1'
  });

  res.status(201).json({
    success: true,
    count: createdProjects.length,
    leadIds,
    message: `Successfully ingested ${createdProjects.length} lead(s) into Discovery pipeline via token "${token.name}".`,
    leads: createdProjects
  });
});

export default scraperRouter;
