import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dns from 'node:dns';
import pg from 'pg';
import { getDatabaseUrl, setNeonPoolReachability } from './services/db';

const { Pool } = pg;

export function calculateCommission(projectValue: number, hasHighPerformanceTier = false) {
  let percentage = 25;
  let tierName = 'Standard Tier (≤ $300)';

  if (projectValue <= 300) {
    percentage = hasHighPerformanceTier ? 40 : 25;
    tierName = hasHighPerformanceTier ? 'High Performer Tier (40%)' : 'Tier 1: ≤ $300 (25%)';
  } else if (projectValue <= 700) {
    percentage = hasHighPerformanceTier ? 42 : 30;
    tierName = hasHighPerformanceTier ? 'High Performer Tier (42%)' : 'Tier 2: $300 – $700 (30%)';
  } else {
    percentage = hasHighPerformanceTier ? 45 : 35;
    tierName = hasHighPerformanceTier ? 'High Performer Tier (45%)' : 'Tier 3: > $700 (35%)';
  }

  const amount = Number(((projectValue * percentage) / 100).toFixed(2));
  return { percentage, amount, tierName, tier: tierName };
}

export interface DatabaseStatus {
  engine: 'postgresql' | 'local_disk_json';
  connected: boolean;
  latencyMs: number;
  poolSize: number;
  totalRecords: number;
  recordCount: number;
  databaseSizeBytes: number;
  host?: string;
  database?: string;
  lastBackupAt: string;
  tables: Array<{
    name: string;
    count: number;
  }>;
  connectionUrlMasked?: string;
  error?: string;
}

// Storage paths
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Global In-Memory Cache
let memoryDB: any = null;
let pgPool: pg.Pool | null = null;
let isPgConnected = false;
let lastPgPingMs = 0;
let lastBackupTimestamp = new Date().toISOString();

// Modern password hashing using Node crypto scrypt with a random 16-byte salt per user
// Format: scrypt$<saltHex>$<hashHex>
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

// Verify password supporting both modern scrypt format and legacy HMAC-SHA256
export function verifyPassword(passwordPlain: string, storedHash: string): { valid: boolean; needsUpgrade: boolean } {
  if (!storedHash || typeof storedHash !== 'string') {
    return { valid: false, needsUpgrade: false };
  }

  // Modern scrypt format
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length === 3) {
      const salt = parts[1];
      const expectedHash = parts[2];
      try {
        const derivedKey = crypto.scryptSync(passwordPlain, salt, 64);
        const derivedHex = derivedKey.toString('hex');
        const bufA = Buffer.from(derivedHex, 'hex');
        const bufB = Buffer.from(expectedHash, 'hex');
        if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
          return { valid: true, needsUpgrade: false };
        }
      } catch {
        return { valid: false, needsUpgrade: false };
      }
    }
    return { valid: false, needsUpgrade: false };
  }

  // Legacy HMAC-SHA256 format ('agency_salt_2026')
  const legacyHash = crypto.createHmac('sha256', 'agency_salt_2026').update(passwordPlain).digest('hex');
  const isMatch = legacyHash === storedHash;
  return { valid: isMatch, needsUpgrade: isMatch };
}

export function getPgPool(): pg.Pool | null {
  return pgPool;
}

// Initial seed data adhering to all 11 SOP sections
export const INITIAL_DB = {
  projects: [] as any[],
  chatMessages: [] as any[],
  files: [] as any[],
  gdprLogs: [] as any[],
  scraperConfig: {
    keywords: [
      'web developer needed',
      'e-commerce store setup',
      'Shopify expert',
      'Next.js landing page',
      'WordPress redesign'
    ],
    platforms: ['linkedin', 'upwork', 'twitter', 'freelancer'],
    autoInject: false,
    minBudget: 250,
    isScanningActive: false,
    lastScanTime: null as string | null,
    scanIntervalMinutes: 15
  },
  scrapedLeads: [] as any[],
  dripTemplates: [
    {
      stage: 1,
      delayHours: 24,
      label: 'Stage 1 (Day 1): Sprint Slot Reservation & Advance Protocol',
      purpose: 'Confirm project kickoff slot and remind of 50% advance deposit to lock sprint dates.',
      subject: 'Reservation Confirmation: Locking in your Web Development Sprint with ClientOps',
      bodyTemplate: 'Dear {{clientName}},\n\nFollowing our discussion regarding your {{websiteType}} project ({{clientCompany}}), our design and development sprint queue is currently scheduling for the upcoming cycle.\n\nAs outlined in our Standard Operating Procedure (SOP), we require a 50% advance deposit (${{advanceAmount}} USD) to officially initiate development, provision your private staging environment, and assign our dedicated engineering team.\n\nWe accept payment securely via PayPal or Payoneer. Please let us know if you would like us to issue the milestone invoice today.\n\nWarm regards,\nSales & Project Coordination Team\nClientOps Web Solutions'
    },
    {
      stage: 2,
      delayHours: 72,
      label: 'Stage 2 (Day 3): Staging Server Allocation & Queue Priority Hold',
      purpose: 'Maintain momentum by highlighting dedicated staging server readiness.',
      subject: 'Staging Server Allocation & Timeline Hold: {{clientName}}',
      bodyTemplate: 'Hi {{clientName}},\n\nI wanted to follow up on our proposal for {{clientCompany}}. Our server infrastructure team has pre-allocated your dedicated internal staging environment so you will be able to review live builds and provide feedback before anything ever goes live.\n\nTo ensure your delivery target remains on schedule without delays to your launch timeline, could you please confirm if you would like to proceed with the 50% advance deposit (${{advanceAmount}} USD) this week?\n\nIf you have any questions on the scope or payment options, I would be glad to hop on a quick 5-minute call.\n\nBest regards,\nSales & Coordination Desk\nClientOps'
    },
    {
      stage: 3,
      delayHours: 120,
      label: 'Stage 3 (Day 5): Urgency & Complimentary Technical Audit',
      purpose: 'Address hesitation with value-add and soft urgency on team capacity.',
      subject: 'Complimentary Performance & SEO Checklist + Sprint Status for {{clientCompany}}',
      bodyTemplate: 'Hello {{clientName}},\n\nWhile preparing the staging architecture for {{clientCompany}}, our technical team put together a complimentary checklist covering mobile responsiveness, Core Web Vitals, and domain DNS setup.\n\nWe have held your development sprint open for 5 days. Because our developers take on a maximum of 4 active international client projects per sprint to maintain strict quality standards, we will need to reallocate this slot if we cannot confirm the 50% advance (${{advanceAmount}} USD) within the next 48 hours.\n\nPlease let us know how you wish to proceed so we can plan accordingly!\n\nKind regards,\nClientOps Engineering & Operations'
    },
    {
      stage: 4,
      delayHours: 168,
      label: 'Stage 4 (Day 7): Graceful Scope Archival & Open Door',
      purpose: 'Polite breakup email that often triggers delayed clients to take action.',
      subject: 'Closing your project file for now: {{clientCompany}} Web Development',
      bodyTemplate: 'Hi {{clientName}},\n\nAs we haven\'t heard back regarding the 50% advance milestone for your {{websiteType}} project, I assume your priorities or timeline have shifted for now, which is completely understandable.\n\nWe are closing and archiving the open estimate for {{clientCompany}} to free up development resources. However, your project specifications and wireframe concepts remain safely stored with us.\n\nWhenever you are ready to resume in the future, simply reply to this message and we will be delighted to reopen your sprint.\n\nWishing you all the best with your business,\nClientOps Operations'
    }
  ],
  clientInquiries: [] as any[],

  // PHASE 3: AUTOMATED PDF INVOICES & PAYMENT RECEIPTS
  invoices: [] as any[],

  // PHASE 3: COMMISSION PAYOUT APPROVAL RECORDS
  commissionPayouts: [] as any[],

  // PHASE 3: COMMISSION AUDIT LOGS
  commissionAuditLogs: [] as any[],

  // PHASE 3: SALESPERSON PROFILES WITH MULTI-TIER MANAGEMENT
  salespersonProfiles: [] as any[],

  // PHASE 3: AUTOMATED DRIP EMAIL & WHATSAPP NUDGE TEMPLATES
  nudgeTemplates: [
    {
      id: 'nudge-advance-delay',
      triggerType: 'advance_deposit_delayed',
      title: '50% Advance Milestone Deposit Delay Notice',
      description: 'Triggered when client has not funded Milestone 1 within 48-72h of proposal approval.',
      delayHoursThreshold: 48,
      emailSubject: 'Action Required: Securing Your Project Sprint Slot (Invoice {{invoiceNumber}})',
      emailBody: 'Dear {{clientName}},\n\nI hope you are having a productive week! Following our agreed scope for {{clientCompany}}, we have provisioned your dedicated engineering team.\n\nTo officially lock in your delivery sprint and launch the staging environment, please complete the 50% advance milestone deposit (${{advanceAmount}} USD):\n\n👉 View & Pay Secure Invoice: {{invoiceLink}}\n\nOnce received, our development clock begins immediately. Please let us know if your accounts team requires any additional vendor documentation.\n\nWarm regards,\n{{salespersonName}}\nClient Operations Team',
      whatsappMessage: '👋 Hi *{{clientName}}*, following up on the web development sprint for *{{clientCompany}}*! Your initial 50% milestone invoice (*${{advanceAmount}} USD*) is ready for clearance: {{invoiceLink}}. Once cleared, we kick off staging development right away. Let us know if you need any assistance!',
      discordMessage: '⚠️ **Client Nudge Dispatched**: Advance deposit reminder sent to **{{clientName}}** ({{clientCompany}}). Milestone 1: **${{advanceAmount}} USD**. Channel: Email + WhatsApp.'
    },
    {
      id: 'nudge-staging-review',
      triggerType: 'staging_review_pending',
      title: 'Interactive Staging Site Ready for Review & Sign-Off',
      description: 'Triggered once internal QA passes and staging prototype is live for client testing.',
      delayHoursThreshold: 24,
      emailSubject: 'Your Staging Website is Live for Inspection: {{clientCompany}}',
      emailBody: 'Hi {{clientName}},\n\nGreat news! Our engineering team has completed the private staging build for {{clientCompany}} and passed internal cross-device QA testing.\n\n👉 Inspect Live Staging Website: {{stagingUrl}}\n👉 Access Your Secure Client Portal: {{portalLink}}\n\nPlease review the interactive layouts on desktop and mobile. You can submit feedback or revisions directly through your portal, or approve the build to initiate live domain migration.\n\nLooking forward to your thoughts!\n\nBest regards,\nEngineering Team',
      whatsappMessage: '🎉 Hi *{{clientName}}*! Your private staging website for *{{clientCompany}}* is now live: {{stagingUrl}}. Please take a look across desktop and mobile, and feel free to log any revision requests in your Client Portal: {{portalLink}}!',
      discordMessage: '🚀 **Staging Review Nudge**: Client **{{clientName}}** invited to inspect staging build at {{stagingUrl}}.'
    },
    {
      id: 'nudge-balance-due',
      triggerType: 'balance_due_handover',
      title: '50% Final Balance Clearance & Domain Cutover Notice',
      description: 'Triggered upon staging approval to release live production DNS cutover (SOP Rule 8).',
      delayHoursThreshold: 24,
      emailSubject: 'Staging Approved: Final Balance Invoice & Live Domain Cutover: {{clientCompany}}',
      emailBody: 'Dear {{clientName}},\n\nThank you for approving the staging build for {{clientCompany}}! Everything looks pristine and ready for your live audience.\n\nPer our agency standard operating procedure (Rule 8: Secure Handover Protocol), please clear the final 50% balance (${{balanceAmount}} USD) so we can execute the live domain DNS migration:\n\n👉 Clear Final Balance & Receipt: {{invoiceLink}}\n\nImmediately upon payment receipt, our DevOps specialists will point DNS records and transfer full admin ownership to your company.\n\nWarm regards,\nClientOps Engineering',
      whatsappMessage: '🌟 Hi *{{clientName}}*, thrilled that you approved the staging build! To trigger live DNS propagation to your official domain, please settle the final 50% balance (*${{balanceAmount}} USD*): {{invoiceLink}}. We are ready to launch immediately upon payment!',
      discordMessage: '🔒 **SOP Rule 8 Handover Gate**: Final balance notice dispatched to **{{clientName}}** (${{balanceAmount}} USD).'
    },
    {
      id: 'nudge-inactivity',
      triggerType: 'inactivity_checkin',
      title: 'Sprint Momentum & Feedback Check-In',
      description: 'Triggered when client has been inactive for more than 5 days during an active sprint.',
      delayHoursThreshold: 120,
      emailSubject: 'Project Check-In: Keeping Momentum on {{clientCompany}}',
      emailBody: 'Hi {{clientName}},\n\nChecking in to make sure you have everything needed to review our latest milestone updates. We want to ensure your site launches on schedule!\n\n👉 Revisit Your Project Portal: {{portalLink}}\n\nIf you prefer a quick 10-minute walkthrough call this week, just reply to this email or send us a WhatsApp message.\n\nBest regards,\nClient Services Team',
      whatsappMessage: '👋 Hi *{{clientName}}*, just checking in on the *{{clientCompany}}* project! Let us know if you have any questions or if you would like a brief walkthrough call: {{portalLink}}.',
      discordMessage: '⏳ **Inactivity Check-In**: Follow-up message sent to **{{clientName}}**.'
    }
  ],

  // PHASE 3: DISPATCH LOGS
  nudgeLogs: [] as any[],
  emailVerificationOtps: [] as any[],

  // PHASE 7: MULTI-COMPANY, DEPARTMENTS, MEMBERSHIPS, INVITES & DEPARTMENT TASKS
  departments: [] as any[],
  companyMemberships: [] as any[],
  companyInvites: [] as any[],
  departmentTasks: [] as any[],

  // PHASE 8: REAL BUSINESS EMAIL OUTREACH (SMTP & RESEND)
  emailAccounts: [] as any[],
  emailCampaigns: [] as any[],
  emailDeliveryLogs: [] as any[]
};

// Database read/write helpers with PostgreSQL & atomic fallback
export function readDB(): any {
  const parsed = getDB(INITIAL_DB) || {};
  if (!Array.isArray(parsed.projects)) parsed.projects = INITIAL_DB.projects || [];
  if (!Array.isArray(parsed.invoices)) parsed.invoices = INITIAL_DB.invoices || [];
  if (!Array.isArray(parsed.clientInquiries)) parsed.clientInquiries = INITIAL_DB.clientInquiries || [];
  if (!Array.isArray(parsed.chatMessages)) parsed.chatMessages = INITIAL_DB.chatMessages || [];
  if (!Array.isArray(parsed.files)) parsed.files = INITIAL_DB.files || [];
  if (!Array.isArray(parsed.gdprLogs)) parsed.gdprLogs = INITIAL_DB.gdprLogs || [];
  if (!Array.isArray(parsed.scrapedLeads)) parsed.scrapedLeads = INITIAL_DB.scrapedLeads || [];
  if (!Array.isArray(parsed.dripTemplates)) parsed.dripTemplates = INITIAL_DB.dripTemplates || [];
  if (!Array.isArray(parsed.commissionPayouts)) parsed.commissionPayouts = INITIAL_DB.commissionPayouts || [];
  if (!Array.isArray(parsed.commissionAuditLogs)) parsed.commissionAuditLogs = INITIAL_DB.commissionAuditLogs || [];
  if (!Array.isArray(parsed.salespersonProfiles)) parsed.salespersonProfiles = INITIAL_DB.salespersonProfiles || [];
  if (!Array.isArray(parsed.nudgeTemplates)) parsed.nudgeTemplates = INITIAL_DB.nudgeTemplates || [];
  if (!Array.isArray(parsed.nudgeLogs)) parsed.nudgeLogs = INITIAL_DB.nudgeLogs || [];
  if (!Array.isArray(parsed.emailVerificationOtps)) parsed.emailVerificationOtps = [];
  if (!Array.isArray(parsed.users)) parsed.users = [];
  if (!Array.isArray(parsed.connectors)) parsed.connectors = DEFAULT_CONNECTORS;
  if (!Array.isArray(parsed.webhookLogs)) parsed.webhookLogs = [];
  if (!Array.isArray(parsed.tenants)) parsed.tenants = [];
  if (!Array.isArray(parsed.departments)) parsed.departments = [];
  parsed.departments = parsed.departments.map((d: any) => ({
    ...d,
    allowed_modules: Array.isArray(d?.allowed_modules) ? d.allowed_modules : ['operations', 'chat']
  }));
  if (!Array.isArray(parsed.companyMemberships)) parsed.companyMemberships = [];
  if (!Array.isArray(parsed.companyInvites)) parsed.companyInvites = [];
  if (!Array.isArray(parsed.departmentTasks)) parsed.departmentTasks = [];
  if (!Array.isArray(parsed.emailAccounts)) parsed.emailAccounts = [];
  if (!Array.isArray(parsed.emailCampaigns)) parsed.emailCampaigns = [];
  if (!Array.isArray(parsed.emailDeliveryLogs)) parsed.emailDeliveryLogs = [];
  return parsed;
}

export function writeDB(data: typeof INITIAL_DB | any): void {
  saveDB(data);
}

// AI & Algorithmic Lead Scoring
export function calculateLeadScore(p: any): any {
  let budgetScore = 15;
  const price = p.finalPrice || p.estimatedPrice || 0;
  if (price >= 1000) budgetScore = 30;
  else if (price >= 700) budgetScore = 26;
  else if (price >= 400) budgetScore = 22;
  else if (price >= 250) budgetScore = 18;

  let scopeScore = 18;
  if (p.websiteType === 'ecommerce' || p.websiteType === 'corporate') scopeScore = 25;
  else if (p.websiteType === 'landing') scopeScore = 21;
  if (p.purpose && p.purpose.length > 30) scopeScore = Math.min(25, scopeScore + 3);

  let readinessScore = 5;
  if (p.hasLogo) readinessScore += 5;
  if (p.hasContent) readinessScore += 5;
  if (p.hasImages) readinessScore += 3;
  if (p.credentialsShared) readinessScore += 2;
  readinessScore = Math.min(20, readinessScore);

  let urgencyScore = 14;
  if (p.channel === 'upwork' || p.channel === 'linkedin') urgencyScore += 6;
  if (p.timelineDays && p.timelineDays <= 14) urgencyScore += 5;
  urgencyScore = Math.min(25, urgencyScore);

  const totalScore = Math.min(100, budgetScore + scopeScore + readinessScore + urgencyScore);

  let tierTag: 'vip' | 'hot' | 'warm' | 'cold' = 'warm';
  let label = '⚠️ Warm Lead';
  let recommendedAction = 'Schedule discovery call and finalize wireframe scope.';

  if (totalScore >= 88 && price >= 700) {
    tierTag = 'vip';
    label = '⚡ Fast-Track VIP';
    recommendedAction = 'High-value account. Assign senior sales rep and fast-track 50% advance invoice.';
  } else if (totalScore >= 78) {
    tierTag = 'hot';
    label = '🔥 Hot Lead';
    recommendedAction = 'Client has clear scope & budget. Send 50% advance agreement within 24h.';
  } else if (totalScore >= 50) {
    tierTag = 'warm';
    label = '⚠️ Warm Lead';
    recommendedAction = 'Address content/asset gaps and propose tiered hosting recommendation.';
  } else {
    tierTag = 'cold';
    label = '❄️ Cold Lead';
    recommendedAction = 'Send automated drip follow-up and educational portfolio links.';
  }

  return {
    totalScore,
    tierTag,
    label,
    factors: { budgetScore, scopeScore, readinessScore, urgencyScore },
    analysisSummary: `Budget: $${price} (${budgetScore}/30), Scope: ${String(p.websiteType || '').toUpperCase()} (${scopeScore}/25), Assets: (${readinessScore}/20), Urgency index: (${urgencyScore}/25).`,
    recommendedAction,
    analyzedAt: new Date().toISOString()
  };
}

// Zero pre-seeded fake users — every account is created by real registration & OTP verification
export const DEFAULT_USERS: any[] = [];

// Zero pre-seeded fake workspaces
export const DEFAULT_TENANTS: any[] = [];

// Real-Time Activity Feed Items (populated exclusively by real events)
export const DEFAULT_ACTIVITY_FEED: any[] = [];

// Company Knowledge Base starts empty until real company SOPs are added
export const DEFAULT_WIKI_DOCS: any[] = [];

// Departmental Tracking Metrics (populated from real tenant activity)
export const DEFAULT_DEPARTMENTAL_PROGRESS: any[] = [];

// Departments start empty until created by a real Company Owner
export const DEFAULT_DEPARTMENTS: any[] = [];

// Company memberships start empty until users register or join via invite
export const DEFAULT_COMPANY_MEMBERSHIPS: any[] = [];

// API Tokens for External Automation (created by admins)
export const DEFAULT_API_TOKENS: any[] = [];

// Audit Trail & Security Event Logs (recorded dynamically)
export const DEFAULT_AUDIT_LOGS: any[] = [];

// Gateway Connectors Schema (standby until configured by workspace admin)
export const DEFAULT_CONNECTORS = [
  {
    id: 'conn-stripe',
    channel: 'stripe',
    name: 'Stripe Global Payment Gateway',
    category: 'payments',
    description: 'Direct credit card, Apple Pay, and international settlements. Automatically unlocks SOP Rule 8 Website Transfer upon balance clearance.',
    status: process.env.STRIPE_SECRET_KEY ? 'connected' : 'standby',
    lastSyncTime: null as string | null,
    syncIntervalMinutes: 5,
    webhookEndpoint: '/api/webhooks/stripe',
    eventsHandledCount: 0,
    successRatePercent: 0,
    activeFeatures: ['Auto-reconcile 50% Advance', 'Auto-clear 50% Balance', 'Receipt Generation'],
    configSummary: 'Listening to checkout.session.completed & payment_intent.succeeded'
  },
  {
    id: 'conn-upwork',
    channel: 'upwork',
    name: 'Upwork Enterprise Lead & Escrow Hook',
    category: 'lead_generation',
    description: 'Bi-directional webhook synchronization for Upwork Direct Messages, Contract Milestones, and Escrow releases.',
    status: 'standby',
    lastSyncTime: null as string | null,
    syncIntervalMinutes: 10,
    webhookEndpoint: '/api/webhooks/upwork',
    eventsHandledCount: 0,
    successRatePercent: 0,
    activeFeatures: ['Inbound RFP Intake', 'Milestone Escrow Tracking', 'SOP Transfer Authorizer'],
    configSummary: 'Listening to contract_milestone_funded & milestone_released'
  },
  {
    id: 'conn-paypal',
    channel: 'paypal',
    name: 'PayPal Merchant Business Platform',
    category: 'payments',
    description: 'Instant IPN & Webhook transaction capture for international wire settlements and invoice milestone clearing.',
    status: 'standby',
    lastSyncTime: null as string | null,
    syncIntervalMinutes: 15,
    webhookEndpoint: '/api/webhooks/paypal',
    eventsHandledCount: 0,
    successRatePercent: 0,
    activeFeatures: ['Instant IPN Settlement', 'Dispute Guard', 'Multi-Currency USD/GBP'],
    configSummary: 'Listening to PAYMENT.CAPTURE.COMPLETED'
  },
  {
    id: 'conn-discord',
    channel: 'discord',
    name: 'Discord Agency Command Bot',
    category: 'messaging',
    description: 'Automated SOP Step 7 project briefing notifications, staging launch alerts, and milestone broadcasts.',
    status: process.env.DISCORD_WEBHOOK_URL ? 'connected' : 'standby',
    lastSyncTime: null as string | null,
    syncIntervalMinutes: 1,
    webhookEndpoint: '/api/webhooks/discord',
    eventsHandledCount: 0,
    successRatePercent: 0,
    activeFeatures: ['Closed Deal Briefings', 'Staging Deploy Pings', 'Team Escalation Bot'],
    configSummary: 'Webhook Bot ready for #sales-leads & #staging-dev'
  },
  {
    id: 'conn-linkedin',
    channel: 'linkedin',
    name: 'LinkedIn Sales Navigator Lead Stream',
    category: 'lead_generation',
    description: 'Captures incoming connection acceptances and InMail replies into the Unified Inbox with AI sentiment scoring.',
    status: 'standby',
    lastSyncTime: null as string | null,
    syncIntervalMinutes: 15,
    webhookEndpoint: '/api/webhooks/linkedin',
    eventsHandledCount: 0,
    successRatePercent: 0,
    activeFeatures: ['InMail Message Sync', 'Connection Tracker', 'AI Reply Drafter'],
    configSummary: 'Configure Sales Navigator webhook to sync leads'
  },
  {
    id: 'conn-hostinger',
    channel: 'hostinger',
    name: 'Hostinger / Cloudflare DNS DevOps API',
    category: 'scheduling',
    description: 'DevOps automation for provisioning staging subdomains and executing final DNS A-record live cutovers after SOP balance check.',
    status: 'standby',
    lastSyncTime: null as string | null,
    syncIntervalMinutes: 30,
    webhookEndpoint: '/api/webhooks/hostinger',
    eventsHandledCount: 0,
    successRatePercent: 0,
    activeFeatures: ['Staging DNS Provisioning', 'SSL Auto-Issue', 'SOP Live Cutover Gate'],
    configSummary: 'Configure Cloudflare or Hostinger API token'
  }
];

// Mask a connection URL for safe presentation
export function maskUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1••••••••$2');
}

// PostgreSQL Schema Initialization SQL
const POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agency_projects (
  id VARCHAR PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_users (
  id VARCHAR PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR NOT NULL,
  role VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  avatar VARCHAR,
  permissions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_inbox (
  id VARCHAR PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_invoices (
  id VARCHAR PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_webhook_logs (
  id VARCHAR PRIMARY KEY,
  channel VARCHAR NOT NULL,
  event_type VARCHAR NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_connectors (
  id VARCHAR PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agency_settings (
  key VARCHAR PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  token_hash VARCHAR NOT NULL,
  token_prefix VARCHAR NOT NULL,
  created_by VARCHAR NOT NULL,
  user_id VARCHAR,
  permissions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR PRIMARY KEY,
  tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus',
  user_id VARCHAR,
  user_name VARCHAR,
  user_role VARCHAR,
  action VARCHAR NOT NULL,
  entity_type VARCHAR NOT NULL,
  entity_id VARCHAR,
  details JSONB,
  ip_address VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS audit_logs ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) DEFAULT 'tenant-alm-nexus';

CREATE TABLE IF NOT EXISTS email_verification_otps (
  email VARCHAR(255) PRIMARY KEY,
  otp_hash VARCHAR(128) NOT NULL,
  pending_data JSONB NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

/**
 * Initialize PostgreSQL connection pool if DATABASE_URL is configured
 */
export async function initPostgresPool(connectionString?: string): Promise<boolean> {
  const connUrl = (connectionString && connectionString.trim()) || getDatabaseUrl();
  if (!connUrl) {
    isPgConnected = false;
    setNeonPoolReachability(null, false);
    return false;
  }

  let newPool: pg.Pool | null = null;
  try {
    // Fast pre-flight DNS check for remote hosts so stale/deleted hostnames fall back cleanly
    try {
      const parsed = new URL(connUrl.replace(/^postgres(ql)?:\/\//i, 'http://'));
      const host = parsed.hostname;
      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        await dns.promises.lookup(host);
      }
    } catch (dnsErr: any) {
      isPgConnected = false;
      setNeonPoolReachability(null, false);
      console.log(`ℹ️ [Database Engine] Remote PostgreSQL host unreachable (${dnsErr?.code || dnsErr?.message}). Using local JSON disk persistence.`);
      return false;
    }

    const isSslRequired = !connUrl.includes('localhost') && !connUrl.includes('127.0.0.1');
    newPool = new Pool({
      connectionString: connUrl,
      ssl: isSslRequired ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    const start = Date.now();
    const client = await newPool.connect();
    lastPgPingMs = Date.now() - start;

    // Run schema creation for standard tables and Neon tables
    await client.query(POSTGRES_SCHEMA_SQL);
    client.release();

    if (pgPool) {
      await pgPool.end().catch(() => {});
    }

    pgPool = newPool;
    isPgConnected = true;
    setNeonPoolReachability(newPool, true);

    // Run Neon-specific schema and Clerk user sync tables
    try {
      const { initNeonSchema } = await import('./services/db');
      await initNeonSchema(newPool);
    } catch {}

    const isNeon = connUrl.includes('.neon.tech') || connUrl.includes('neon');
    console.log(`✅ [Database Engine] Connected to ${isNeon ? 'Neon Serverless PostgreSQL' : 'PostgreSQL'} successfully (${lastPgPingMs}ms latency). Schema verified.`);
    return true;
  } catch (err: any) {
    if (newPool) {
      await newPool.end().catch(() => {});
    }
    isPgConnected = false;
    setNeonPoolReachability(null, false);
    console.log(`ℹ️ [Database Engine] PostgreSQL unavailable (${err?.code || err?.message}). Using local JSON disk persistence.`);
    return false;
  }
}

export { getNeonPool, testNeonConnection, initNeonSchema, neonQuery } from './services/db';

/**
 * Load initial data into memory from disk or initialize fresh
 */
export function loadLocalDB(initialFallbackData: any): any {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const seeded = {
        ...initialFallbackData,
        users: [],
        tenants: [],
        departments: [],
        companyMemberships: [],
        companyInvites: [],
        departmentTasks: [],
        emailAccounts: [],
        emailCampaigns: [],
        emailDeliveryLogs: [],
        connectors: DEFAULT_CONNECTORS,
        apiTokens: DEFAULT_API_TOKENS,
        auditLogs: DEFAULT_AUDIT_LOGS,
        webhookLogs: []
      };
      atomicWriteFile(DB_FILE, JSON.stringify(seeded, null, 2));
      memoryDB = seeded;
      return seeded;
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    // Preserve empty arrays cleanly; only populate missing collections
    const merged = {
      ...(initialFallbackData || {}),
      ...parsed,
      projects: Array.isArray(parsed.projects) ? parsed.projects : (initialFallbackData?.projects || []),
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : (initialFallbackData?.invoices || []),
      clientInquiries: Array.isArray(parsed.clientInquiries) ? parsed.clientInquiries : (initialFallbackData?.clientInquiries || []),
      chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : (initialFallbackData?.chatMessages || []),
      files: Array.isArray(parsed.files) ? parsed.files : (initialFallbackData?.files || []),
      gdprLogs: Array.isArray(parsed.gdprLogs) ? parsed.gdprLogs : (initialFallbackData?.gdprLogs || []),
      scrapedLeads: Array.isArray(parsed.scrapedLeads) ? parsed.scrapedLeads : (initialFallbackData?.scrapedLeads || []),
      dripTemplates: Array.isArray(parsed.dripTemplates) && parsed.dripTemplates.length > 0 ? parsed.dripTemplates : (initialFallbackData?.dripTemplates || []),
      commissionPayouts: Array.isArray(parsed.commissionPayouts) ? parsed.commissionPayouts : (initialFallbackData?.commissionPayouts || []),
      commissionAuditLogs: Array.isArray(parsed.commissionAuditLogs) ? parsed.commissionAuditLogs : (initialFallbackData?.commissionAuditLogs || []),
      salespersonProfiles: Array.isArray(parsed.salespersonProfiles) ? parsed.salespersonProfiles : (initialFallbackData?.salespersonProfiles || []),
      nudgeTemplates: Array.isArray(parsed.nudgeTemplates) && parsed.nudgeTemplates.length > 0 ? parsed.nudgeTemplates : (initialFallbackData?.nudgeTemplates || []),
      nudgeLogs: Array.isArray(parsed.nudgeLogs) ? parsed.nudgeLogs : (initialFallbackData?.nudgeLogs || []),
      users: Array.isArray(parsed.users) ? parsed.users : [],
      connectors: Array.isArray(parsed.connectors) && parsed.connectors.length > 0 ? parsed.connectors : DEFAULT_CONNECTORS,
      apiTokens: Array.isArray(parsed.apiTokens) ? parsed.apiTokens : (initialFallbackData?.apiTokens || DEFAULT_API_TOKENS),
      auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : (initialFallbackData?.auditLogs || DEFAULT_AUDIT_LOGS),
      tenants: Array.isArray(parsed.tenants) ? parsed.tenants : [],
      departments: Array.isArray(parsed.departments) ? parsed.departments : [],
      companyMemberships: Array.isArray(parsed.companyMemberships) ? parsed.companyMemberships : [],
      companyInvites: Array.isArray(parsed.companyInvites) ? parsed.companyInvites : [],
      departmentTasks: Array.isArray(parsed.departmentTasks) ? parsed.departmentTasks : [],
      emailAccounts: Array.isArray(parsed.emailAccounts) ? parsed.emailAccounts : [],
      emailCampaigns: Array.isArray(parsed.emailCampaigns) ? parsed.emailCampaigns : [],
      emailDeliveryLogs: Array.isArray(parsed.emailDeliveryLogs) ? parsed.emailDeliveryLogs : [],
      activityFeed: Array.isArray(parsed.activityFeed) ? parsed.activityFeed : DEFAULT_ACTIVITY_FEED,
      wikiDocs: Array.isArray(parsed.wikiDocs) ? parsed.wikiDocs : [],
      departmentalProgress: Array.isArray(parsed.departmentalProgress) ? parsed.departmentalProgress : DEFAULT_DEPARTMENTAL_PROGRESS,
      webhookLogs: Array.isArray(parsed.webhookLogs) ? parsed.webhookLogs : [],
      emailVerificationOtps: Array.isArray(parsed.emailVerificationOtps) ? parsed.emailVerificationOtps : []
    };

    memoryDB = merged;
    // Persist full structure to disk so future loads are complete
    atomicWriteFile(DB_FILE, JSON.stringify(merged, null, 2));
    return merged;
  } catch (err: any) {
    console.error('Error loading DB, attempting recovery from latest backup:', err.message);
    const recovered = attemptBackupRecovery();
    if (recovered) {
      memoryDB = recovered;
      return recovered;
    }
    memoryDB = initialFallbackData;
    return initialFallbackData;
  }
}

/**
 * Atomic write to file to prevent corruption on crash/power failure
 */
function atomicWriteFile(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tempPath, content, 'utf-8');
  fs.renameSync(tempPath, filePath);
}

/**
 * Save snapshot backup in data/backups/
 */
export function createBackup(): string {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUPS_DIR, `db-snapshot-${ts}.json`);
    atomicWriteFile(backupFile, JSON.stringify(memoryDB, null, 2));
    lastBackupTimestamp = new Date().toISOString();

    // Keep only last 10 backups
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('db-snapshot-'))
      .sort()
      .reverse();

    if (files.length > 10) {
      for (const f of files.slice(10)) {
        fs.unlinkSync(path.join(BACKUPS_DIR, f));
      }
    }

    return backupFile;
  } catch (err: any) {
    console.error('Failed to create backup snapshot:', err.message);
    return '';
  }
}

/**
 * Attempt to restore from latest backup if main db.json was corrupted
 */
function attemptBackupRecovery(): any | null {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return null;
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('db-snapshot-'))
      .sort()
      .reverse();

    if (files.length === 0) return null;
    const latest = path.join(BACKUPS_DIR, files[0]);
    const raw = fs.readFileSync(latest, 'utf-8');
    const parsed = JSON.parse(raw);
    console.log(`🛡️ Successfully recovered database from snapshot: ${files[0]}`);
    atomicWriteFile(DB_FILE, raw);
    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Synchronous read from in-memory cache
 */
export function getDB(initialFallback?: any): any {
  if (!memoryDB) {
    memoryDB = loadLocalDB(initialFallback || {});
  }
  return memoryDB;
}

/**
 * Save DB state:
 * 1. Updates memory cache
 * 2. Writes atomically to local data/db.json
 * 3. If PostgreSQL is connected, asynchronously syncs changes to PostgreSQL tables
 */
export function saveDB(newDB: any): void {
  memoryDB = newDB;

  try {
    atomicWriteFile(DB_FILE, JSON.stringify(newDB, null, 2));
  } catch (err: any) {
    console.error('Error saving local db.json:', err.message);
  }

  // Asynchronous sync to PostgreSQL if connected
  if (isPgConnected && pgPool) {
    syncToPostgresAsync(newDB).catch(err => {
      console.warn('Background sync to PostgreSQL had warning:', err.message);
    });
  }
}

/**
 * Asynchronously persist updated data to PostgreSQL tables
 */
async function syncToPostgresAsync(db: any): Promise<void> {
  if (!pgPool || !isPgConnected) return;

  try {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // Sync projects
      if (Array.isArray(db.projects)) {
        for (const proj of db.projects) {
          await client.query(
            `INSERT INTO agency_projects (id, data, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
            [proj.id, JSON.stringify(proj)]
          );
        }
      }

      // Sync users
      if (Array.isArray(db.users)) {
        for (const user of db.users) {
          await client.query(
            `INSERT INTO agency_users (id, email, password_hash, role, name, avatar, permissions)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE
             SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash,
                 role = EXCLUDED.role, name = EXCLUDED.name, permissions = EXCLUDED.permissions`,
            [user.id, user.email, user.passwordHash || '', user.role, user.name, user.avatar || '', JSON.stringify(user.permissions || [])]
          );
        }
      }

      // Sync webhooks logs (last 50)
      if (Array.isArray(db.webhookLogs)) {
        const recentLogs = db.webhookLogs.slice(0, 50);
        for (const log of recentLogs) {
          await client.query(
            `INSERT INTO agency_webhook_logs (id, channel, event_type, payload, status, processed_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO NOTHING`,
            [log.id, log.source || 'stripe', log.event || 'event', JSON.stringify(log), log.status || 'success', log.timestamp || new Date().toISOString()]
          );
        }
      }

      // Sync API tokens
      if (Array.isArray(db.apiTokens)) {
        for (const tok of db.apiTokens) {
          await client.query(
            `INSERT INTO api_tokens (id, name, token_hash, token_prefix, created_by, user_id, permissions, created_at, expires_at, revoked_at, last_used_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (id) DO UPDATE
             SET name = EXCLUDED.name, revoked_at = EXCLUDED.revoked_at, last_used_at = EXCLUDED.last_used_at`,
            [tok.id, tok.name, tok.tokenHash, tok.tokenPrefix, tok.createdBy, tok.userId || null, JSON.stringify(tok.permissions || []), tok.createdAt, tok.expiresAt || null, tok.revokedAt || null, tok.lastUsedAt || null]
          );
        }
      }

      // Sync audit logs (last 50)
      if (Array.isArray(db.auditLogs)) {
        const recentAudit = db.auditLogs.slice(0, 50);
        for (const alog of recentAudit) {
          await client.query(
            `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING`,
            [alog.id, alog.userId || null, alog.userName || null, alog.userRole || null, alog.action, alog.entityType, alog.entityId || null, JSON.stringify(alog.details || {}), alog.ipAddress || null, alog.createdAt]
          );
        }
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn('PostgreSQL sync error:', err.message);
  }
}

/**
 * Get comprehensive Database Engine Status
 */
export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const db = getDB();
  const connUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  let latency = 0;
  let pgConnectedNow = false;

  if (pgPool) {
    try {
      const start = Date.now();
      await pgPool.query('SELECT 1');
      latency = Date.now() - start;
      pgConnectedNow = true;
      isPgConnected = true;
    } catch (e) {
      pgConnectedNow = false;
      isPgConnected = false;
    }
  }

  const projectsCount = (db.projects || []).length;
  const usersCount = (db.users || []).length;
  const tenantsCount = (db.tenants || []).length;
  const departmentsCount = (db.departments || []).length;
  const membershipsCount = (db.companyMemberships || []).length;
  const tasksCount = (db.departmentTasks || []).length;
  const emailAccountsCount = (db.emailAccounts || []).length;
  const emailCampaignsCount = (db.emailCampaigns || []).length;
  const inquiriesCount = (db.clientInquiries || []).length;
  const invoicesCount = (db.invoices || []).length;
  const webhookLogsCount = (db.webhookLogs || []).length;
  const connectorsCount = (db.connectors || []).length;
  const apiTokensCount = (db.apiTokens || []).length;
  const auditLogsCount = (db.auditLogs || []).length;

  const totalRecords =
    projectsCount +
    usersCount +
    tenantsCount +
    departmentsCount +
    membershipsCount +
    tasksCount +
    emailAccountsCount +
    emailCampaignsCount +
    inquiriesCount +
    invoicesCount +
    webhookLogsCount +
    apiTokensCount +
    auditLogsCount;

  let databaseSizeBytes = 0;
  try {
    if (fs.existsSync(DB_FILE)) {
      databaseSizeBytes = fs.statSync(DB_FILE).size;
    }
  } catch {
    databaseSizeBytes = 0;
  }

  return {
    engine: pgConnectedNow ? 'postgresql' : 'local_disk_json',
    connected: pgConnectedNow,
    latencyMs: latency,
    poolSize: pgPool?.totalCount || 0,
    totalRecords,
    recordCount: totalRecords,
    databaseSizeBytes,
    host: pgConnectedNow && connUrl ? maskUrl(connUrl).split('@')[1]?.split('/')[0] : 'local-filesystem',
    database: pgConnectedNow && connUrl ? connUrl.split('/').pop()?.split('?')[0] : 'db.json (atomic write)',
    lastBackupAt: lastBackupTimestamp,
    tables: [
      { name: 'companies_tenants', count: tenantsCount },
      { name: 'departments', count: departmentsCount },
      { name: 'company_memberships', count: membershipsCount },
      { name: 'department_tasks', count: tasksCount },
      { name: 'agency_projects', count: projectsCount },
      { name: 'agency_users', count: usersCount },
      { name: 'email_accounts', count: emailAccountsCount },
      { name: 'email_campaigns', count: emailCampaignsCount },
      { name: 'agency_inbox', count: inquiriesCount },
      { name: 'agency_invoices', count: invoicesCount },
      { name: 'agency_webhook_logs', count: webhookLogsCount },
      { name: 'agency_connectors', count: connectorsCount },
      { name: 'api_tokens', count: apiTokensCount },
      { name: 'audit_logs', count: auditLogsCount }
    ],
    connectionUrlMasked: pgConnectedNow ? maskUrl(connUrl) : 'local-filesystem (db.json)'
  };
}

/**
 * Test a PostgreSQL connection without making it default
 */
export async function testPostgresConnection(testUrl: string): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  if (!testUrl || !testUrl.startsWith('postgres')) {
    return { ok: false, latencyMs: 0, message: 'Invalid PostgreSQL connection URI. Must begin with postgresql:// or postgres://' };
  }

  let testPool: pg.Pool | null = null;
  try {
    const isSslRequired = !testUrl.includes('localhost') && !testUrl.includes('127.0.0.1');
    testPool = new Pool({
      connectionString: testUrl,
      ssl: isSslRequired ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000
    });

    const start = Date.now();
    const client = await testPool.connect();
    const result = await client.query('SELECT version();');
    const latency = Date.now() - start;
    client.release();

    const versionStr = result.rows[0]?.version || 'PostgreSQL';
    return {
      ok: true,
      latencyMs: latency,
      message: `Successfully connected to ${versionStr.split(',')[0]} in ${latency}ms.`
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: 0,
      message: `Connection failed: ${err.message}`
    };
  } finally {
    if (testPool) {
      await testPool.end().catch(() => {});
    }
  }
}

/**
 * Migrate all current local data into a target PostgreSQL database in 1 click
 */
export async function migrateToPostgres(targetUrl: string): Promise<{
  success: boolean;
  message: string;
  recordsMigrated: number;
  tablesMigrated: number;
  totalRowsInserted: number;
}> {
  const testRes = await testPostgresConnection(targetUrl);
  if (!testRes.ok) {
    return {
      success: false,
      message: testRes.message,
      recordsMigrated: 0,
      tablesMigrated: 0,
      totalRowsInserted: 0
    };
  }

  try {
    const isSslRequired = !targetUrl.includes('localhost') && !targetUrl.includes('127.0.0.1');
    const newPool = new Pool({
      connectionString: targetUrl,
      ssl: isSslRequired ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 8000
    });

    const client = await newPool.connect();
    await client.query(POSTGRES_SCHEMA_SQL);

    const db = getDB();
    let count = 0;

    await client.query('BEGIN');

    // Migrate projects
    for (const p of db.projects || []) {
      await client.query(
        `INSERT INTO agency_projects (id, data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [p.id, JSON.stringify(p)]
      );
      count++;
    }

    // Migrate users
    for (const u of db.users || DEFAULT_USERS) {
      await client.query(
        `INSERT INTO agency_users (id, email, password_hash, role, name, avatar, permissions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email, password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role, name = EXCLUDED.name, permissions = EXCLUDED.permissions`,
        [u.id, u.email, u.passwordHash || '', u.role, u.name, u.avatar || '', JSON.stringify(u.permissions || [])]
      );
      count++;
    }

    // Migrate inbox
    for (const msg of db.clientInquiries || []) {
      await client.query(
        `INSERT INTO agency_inbox (id, data, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [msg.id, JSON.stringify(msg)]
      );
      count++;
    }

    // Migrate invoices
    for (const inv of db.invoices || []) {
      await client.query(
        `INSERT INTO agency_invoices (id, data, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [inv.id, JSON.stringify(inv)]
      );
      count++;
    }

    await client.query('COMMIT');
    client.release();

    // Switch active pool
    if (pgPool) await pgPool.end().catch(() => {});
    pgPool = newPool;
    isPgConnected = true;
    setNeonPoolReachability(newPool, true);

    return {
      success: true,
      message: `Migration complete! Successfully transferred ${count} records into PostgreSQL tables.`,
      recordsMigrated: count,
      tablesMigrated: 4,
      totalRowsInserted: count
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Migration error: ${err.message}`,
      recordsMigrated: 0,
      tablesMigrated: 0,
      totalRowsInserted: 0
    };
  }
}

/**
 * Generate full SQL export script (DDL + INSERTs) for Railway, Supabase, Neon, or Cloud SQL
 */
export function generateSQLDump(): string {
  const db = getDB();
  let sql = `-- ========================================================\n`;
  sql += `-- ALM Nexus / ClientOps PostgreSQL Production Schema Dump\n`;
  sql += `-- Export Date: ${new Date().toISOString()}\n`;
  sql += `-- Compatible with Railway, Supabase, Neon, AWS RDS, Cloud SQL\n`;
  sql += `-- ========================================================\n\n`;

  sql += POSTGRES_SCHEMA_SQL + `\n\n`;

  // Insert Users
  sql += `-- 1. Staff and Client Users (Salted SHA-256 Authentication)\n`;
  for (const u of db.users || DEFAULT_USERS) {
    const escapedName = (u.name || '').replace(/'/g, "''");
    const escapedEmail = (u.email || '').replace(/'/g, "''");
    const escapedRole = (u.role || '').replace(/'/g, "''");
    const escapedAvatar = (u.avatar || '').replace(/'/g, "''");
    const escapedPerms = JSON.stringify(u.permissions || []).replace(/'/g, "''");
    sql += `INSERT INTO agency_users (id, email, password_hash, role, name, avatar, permissions)\n`;
    sql += `VALUES ('${u.id}', '${escapedEmail}', '${u.passwordHash}', '${escapedRole}', '${escapedName}', '${escapedAvatar}', '${escapedPerms}'::jsonb)\n`;
    sql += `ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = EXCLUDED.role, permissions = EXCLUDED.permissions;\n\n`;
  }

  // Insert Projects
  sql += `-- 2. SOP Projects Pipeline & Escrow Milestones\n`;
  for (const p of db.projects || []) {
    const escapedJson = JSON.stringify(p).replace(/'/g, "''");
    sql += `INSERT INTO agency_projects (id, data, updated_at)\n`;
    sql += `VALUES ('${p.id}', '${escapedJson}'::jsonb, NOW())\n`;
    sql += `ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW();\n\n`;
  }

  // Insert Invoices
  sql += `-- 3. Project Invoices & 50% Milestone Receipts\n`;
  for (const inv of db.invoices || []) {
    const escapedJson = JSON.stringify(inv).replace(/'/g, "''");
    sql += `INSERT INTO agency_invoices (id, data, created_at)\n`;
    sql += `VALUES ('${inv.id}', '${escapedJson}'::jsonb, NOW())\n`;
    sql += `ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data;\n\n`;
  }

  // Insert API Tokens
  sql += `-- 4. Inbound Automation API Tokens (n8n & Python Scrapers)\n`;
  for (const tok of db.apiTokens || []) {
    const escapedName = (tok.name || '').replace(/'/g, "''");
    const escapedCreatedBy = (tok.createdBy || '').replace(/'/g, "''");
    const escapedPerms = JSON.stringify(tok.permissions || []).replace(/'/g, "''");
    sql += `INSERT INTO api_tokens (id, name, token_hash, token_prefix, created_by, user_id, permissions, created_at, expires_at, revoked_at, last_used_at)\n`;
    sql += `VALUES ('${tok.id}', '${escapedName}', '${tok.tokenHash}', '${tok.tokenPrefix}', '${escapedCreatedBy}', ${tok.userId ? `'${tok.userId}'` : 'NULL'}, '${escapedPerms}'::jsonb, '${tok.createdAt}', ${tok.expiresAt ? `'${tok.expiresAt}'` : 'NULL'}, ${tok.revokedAt ? `'${tok.revokedAt}'` : 'NULL'}, ${tok.lastUsedAt ? `'${tok.lastUsedAt}'` : 'NULL'})\n`;
    sql += `ON CONFLICT (id) DO NOTHING;\n\n`;
  }

  return sql;
}

/**
 * Generate a new secure API token for external inbound automation (n8n, Python web scrapers)
 */
export function createApiToken(params: {
  name: string;
  createdBy: string;
  userId?: string;
  companyId?: string;
  permissions?: string[];
  expiresInDays?: number;
}): { tokenRecord: any; rawToken: string } {
  const db = getDB();
  if (!Array.isArray(db.apiTokens)) {
    db.apiTokens = [];
  }

  // Generate cryptographically secure random token (64 hex characters)
  const randomHex = crypto.randomBytes(24).toString('hex');
  const rawToken = `sk_live_agency_${randomHex}`;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokenPrefix = `sk_live_...${randomHex.substring(randomHex.length - 6)}`;

  const now = new Date();
  let expiresAt: string | null = null;
  if (params.expiresInDays && params.expiresInDays > 0) {
    const exp = new Date(now.getTime() + params.expiresInDays * 24 * 60 * 60 * 1000);
    expiresAt = exp.toISOString();
  }

  const companyId = params.companyId || undefined;
  const tokenRecord = {
    id: `tok-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    companyId,
    tenantId: companyId,
    name: params.name || 'External Automation Key',
    tokenHash,
    tokenPrefix,
    createdBy: params.createdBy,
    userId: params.userId || 'user-admin-1',
    permissions: params.permissions || ['leads:write', 'realestate:write'],
    createdAt: now.toISOString(),
    expiresAt,
    revokedAt: null,
    lastUsedAt: null
  };

  db.apiTokens.unshift(tokenRecord);
  saveDB(db);

  // Automatically log audit trail
  logAuditAction({
    companyId,
    userId: params.userId || 'user-admin-1',
    userName: params.createdBy,
    userRole: 'admin',
    action: 'API_TOKEN_CREATED',
    entityType: 'api_token',
    entityId: tokenRecord.id,
    details: { name: tokenRecord.name, prefix: tokenPrefix, expiresAt },
    ipAddress: 'internal'
  });

  return { tokenRecord, rawToken };
}

/**
 * Verify an API token presented by an external caller (e.g. n8n, Python scrapers)
 */
export function verifyApiToken(rawKey: string): { valid: boolean; token?: any; error?: string } {
  if (!rawKey || typeof rawKey !== 'string') {
    return { valid: false, error: 'API key is missing or invalid format.' };
  }

  const cleanKey = rawKey.trim().replace(/^Bearer\s+/i, '');
  const incomingHash = crypto.createHash('sha256').update(cleanKey).digest('hex');

  const db = getDB();
  const tokens = Array.isArray(db.apiTokens) ? db.apiTokens : [];
  const token = tokens.find((t: any) => t.tokenHash === incomingHash);

  if (!token) {
    return { valid: false, error: 'Invalid API token. Access denied.' };
  }

  if (token.revokedAt) {
    return { valid: false, error: 'API token has been revoked.' };
  }

  if (token.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) {
    return { valid: false, error: 'API token has expired.' };
  }

  // Update last used timestamp
  token.lastUsedAt = new Date().toISOString();
  saveDB(db);

  return { valid: true, token };
}

/**
 * Revoke an API token (strictly scoped by companyId when supplied)
 */
export function revokeApiToken(tokenId: string, revokerEmail?: string, companyId?: string): boolean {
  const db = getDB();
  if (!Array.isArray(db.apiTokens)) return false;

  const token = db.apiTokens.find((t: any) => {
    if (t.id !== tokenId) return false;
    if (companyId) {
      return (t.companyId || t.tenantId) === companyId;
    }
    return true;
  });
  if (!token) return false;

  token.revokedAt = new Date().toISOString();
  saveDB(db);

  logAuditAction({
    companyId: companyId || token.companyId || token.tenantId,
    userId: token.userId || 'user-admin-1',
    userName: revokerEmail || token.createdBy,
    userRole: 'admin',
    action: 'API_TOKEN_REVOKED',
    entityType: 'api_token',
    entityId: token.id,
    details: { name: token.name, prefix: token.tokenPrefix },
    ipAddress: 'internal'
  });

  return true;
}

/**
 * List API tokens (sanitized, no token secret, strictly scoped by companyId when provided)
 */
export function getApiTokens(companyId?: string): any[] {
  const db = getDB();
  const tokens = Array.isArray(db.apiTokens) ? db.apiTokens : [];
  const filtered = companyId
    ? tokens.filter((t: any) => (t.companyId || t.tenantId) === companyId)
    : tokens;
  return filtered.map((t: any) => ({
    id: t.id,
    companyId: t.companyId || t.tenantId,
    name: t.name,
    tokenPrefix: t.tokenPrefix,
    createdBy: t.createdBy,
    userId: t.userId,
    permissions: t.permissions,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    revokedAt: t.revokedAt,
    lastUsedAt: t.lastUsedAt,
    status: t.revokedAt ? 'revoked' : (t.expiresAt && new Date(t.expiresAt).getTime() < Date.now() ? 'expired' : 'active')
  }));
}

/**
 * Append an immutable audit trail entry
 */
export function logAuditAction(params: {
  companyId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
}): any {
  const db = getDB();
  if (!Array.isArray(db.auditLogs)) {
    db.auditLogs = [];
  }

  const logEntry = {
    id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    companyId: params.companyId || undefined,
    tenantId: params.companyId || undefined,
    userId: params.userId || 'system',
    userName: params.userName || 'System Engine',
    userRole: params.userRole || 'system',
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId || null,
    details: params.details || {},
    ipAddress: params.ipAddress || '127.0.0.1',
    createdAt: new Date().toISOString()
  };

  db.auditLogs.unshift(logEntry);
  // Cap in-memory/JSON audit log history to last 500 records
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }

  saveDB(db);

  // If PostgreSQL is connected, write immediately to audit_logs table
  if (isPgConnected && pgPool) {
    pgPool.query(
      `INSERT INTO audit_logs (id, tenant_id, user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [logEntry.id, logEntry.companyId || null, logEntry.userId, logEntry.userName, logEntry.userRole, logEntry.action, logEntry.entityType, logEntry.entityId, JSON.stringify(logEntry.details), logEntry.ipAddress, logEntry.createdAt]
    ).catch(e => {
      console.warn('Could not persist audit log directly to PostgreSQL:', e.message);
    });
  }

  return logEntry;
}

/**
 * Retrieve filtered audit logs (strictly scoped by companyId when specified)
 */
export function getAuditLogs(options?: {
  companyId?: string;
  action?: string;
  userId?: string;
  entityType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): { logs: any[]; total: number } {
  const db = getDB();
  let logs: any[] = Array.isArray(db.auditLogs) ? [...db.auditLogs] : [];

  if (options?.companyId) {
    logs = logs.filter(l => (l.companyId || l.tenantId) === options.companyId);
  }

  if (options?.action && options.action !== 'all') {
    logs = logs.filter(l => l.action.toLowerCase() === options.action?.toLowerCase());
  }

  if (options?.entityType && options.entityType !== 'all') {
    logs = logs.filter(l => l.entityType.toLowerCase() === options.entityType?.toLowerCase());
  }

  if (options?.userId && options.userId !== 'all') {
    logs = logs.filter(l => l.userId === options.userId);
  }

  if (options?.search) {
    const s = options.search.toLowerCase();
    logs = logs.filter(l => 
      (l.action && l.action.toLowerCase().includes(s)) ||
      (l.userName && l.userName.toLowerCase().includes(s)) ||
      (l.entityType && l.entityType.toLowerCase().includes(s)) ||
      (l.entityId && l.entityId.toLowerCase().includes(s)) ||
      (JSON.stringify(l.details || {}).toLowerCase().includes(s))
    );
  }

  const total = logs.length;
  const offset = options?.offset || 0;
  const limit = options?.limit || 50;
  const paginated = logs.slice(offset, offset + limit);

  return { logs: paginated, total };
}

