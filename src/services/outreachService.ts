/**
 * Outreach Suite Frontend API Service
 */

export interface OutreachHealthResponse {
  module: string;
  postgresConnected: boolean;
  queueRunning: boolean;
  encryptionConfigured: boolean;
  timestamp: string;
}

export interface OutreachQueueStats {
  tenantId: string;
  workerRunning: boolean;
  stats: {
    byStatus: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    byType: Record<string, number>;
    total: number;
  };
}

export interface EnqueueTestJobResult {
  jobId: string;
  tenantId: string;
  type: string;
  shouldFail: boolean;
  status: string;
  message: string;
}

export interface Mailbox {
  id: string;
  tenant_id: string;
  domain_id: string;
  email: string;
  sender_name: string;
  provider: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  imap_host: string;
  imap_port: number;
  imap_user?: string;
  status: 'active' | 'paused' | 'error' | 'disabled';
  daily_cap: number;
  send_interval_sec: number;
  signature?: string;
  reputation_score: number;
  health_status: 'good' | 'warning' | 'error';
  last_error?: string | null;
  created_at: string;
  updated_at: string;
  domain?: string;
  spf_status?: string;
  dkim_status?: string;
  dmarc_status?: string;
  mx_status?: string;
  today_campaign_sent: number;
  today_warmup_sent: number;
  today_bounced: number;
}

export interface ProviderPreset {
  id: string;
  name: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  hint: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  smtp: {
    ok: boolean;
    error?: string;
    hint?: string;
  };
  imap: {
    ok: boolean;
    folders?: string[];
    hasSpamFolder?: boolean;
    error?: string;
    hint?: string;
  };
}

export interface DnsFixInstruction {
  type: 'MX' | 'TXT';
  host: string;
  value: string;
  priority?: number;
  purpose: 'SPF' | 'DKIM' | 'DMARC' | 'MX';
  reason: string;
}

export interface DomainItem {
  id: string;
  tenant_id: string;
  domain: string;
  spf_status: 'valid' | 'warning' | 'missing' | 'error' | 'pending';
  dkim_status: 'valid' | 'warning' | 'missing' | 'error' | 'pending';
  dmarc_status: 'valid' | 'warning' | 'missing' | 'error' | 'pending';
  mx_status: 'valid' | 'missing' | 'error' | 'pending';
  custom_tracking_domain?: string | null;
  verified_at?: string | null;
  dns_records?: any;
  fix_instructions?: DnsFixInstruction[];
  created_at: string;
  updated_at: string;
  mailbox_count?: number;
}

function getAuthHeader(): Record<string, string> {
  const token =
    localStorage.getItem('clerk_token') ||
    localStorage.getItem('agency_jwt_token') ||
    sessionStorage.getItem('agency_jwt_token') ||
    localStorage.getItem('alm_nexus_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch health status of Outreach Suite backend (probe PostgreSQL & worker state)
 */
export async function getOutreachHealth(): Promise<OutreachHealthResponse> {
  const res = await fetch('/api/outreach/system/health');
  if (!res.ok) {
    throw new Error(`Failed to check outreach health: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!body.success) {
    throw new Error(body.error || 'Failed to check outreach health');
  }
  return body.data;
}

/**
 * Fetch detailed queue stats (Admin only)
 */
export async function getOutreachQueueStats(): Promise<OutreachQueueStats> {
  const res = await fetch('/api/outreach/system/queue', {
    headers: getAuthHeader()
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || `HTTP ${res.status}: Failed to fetch queue stats`);
  }
  return body.data;
}

/**
 * Trigger an admin test job through the durable queue
 */
export async function triggerTestJob(shouldFail: boolean = false, reason?: string): Promise<EnqueueTestJobResult> {
  const res = await fetch('/api/outreach/system/queue/test-job', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({
      shouldFail,
      reason: reason || (shouldFail ? 'Intentional failure to verify retry backoff' : undefined)
    })
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || `HTTP ${res.status}: Failed to enqueue test job`);
  }
  return body.data;
}

/**
 * Fetch static provider presets
 */
export async function getProviderPresets(): Promise<Record<string, ProviderPreset>> {
  const res = await fetch('/api/outreach/mailboxes/presets', {
    headers: getAuthHeader()
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Failed to fetch presets');
  }
  return body.data;
}

/**
 * Live test SMTP & IMAP credentials
 */
export async function testMailboxCredentials(params: {
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  imapHost: string;
  imapPort: number;
  imapUser?: string;
  password: string;
}): Promise<ConnectionTestResult> {
  const res = await fetch('/api/outreach/mailboxes/test', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(params)
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Connection test failed');
  }
  return body.data;
}

/**
 * Create a new mailbox
 */
export async function createMailbox(data: {
  email: string;
  sender_name: string;
  provider?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  imap_host: string;
  imap_port: number;
  imap_user?: string;
  password: string;
  daily_cap?: number;
  send_interval_sec?: number;
  signature?: string;
  skip_live_check?: boolean;
}): Promise<Mailbox> {
  const res = await fetch('/api/outreach/mailboxes', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data)
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Failed to create mailbox');
  }
  return body.data;
}

/**
 * List all mailboxes
 */
export async function listMailboxes(): Promise<Mailbox[]> {
  const res = await fetch('/api/outreach/mailboxes', {
    headers: getAuthHeader()
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Failed to list mailboxes');
  }
  return body.data;
}

/**
 * Update mailbox settings
 */
export async function updateMailbox(
  id: string,
  data: {
    daily_cap?: number;
    send_interval_sec?: number;
    status?: 'active' | 'paused';
    sender_name?: string;
    signature?: string;
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    imap_host?: string;
    imap_port?: number;
    imap_user?: string;
    password?: string;
  }
): Promise<Mailbox> {
  const res = await fetch(`/api/outreach/mailboxes/${id}`, {
    method: 'PATCH',
    headers: getAuthHeader(),
    body: JSON.stringify(data)
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Failed to update mailbox');
  }
  return body.data;
}

/**
 * Delete / disconnect mailbox
 */
export async function deleteMailbox(id: string): Promise<{ success: boolean; campaigns?: any[] }> {
  const res = await fetch(`/api/outreach/mailboxes/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader()
  });

  const body = await res.json();
  if (!res.ok) {
    if (body.campaigns) {
      return { success: false, campaigns: body.campaigns };
    }
    throw new Error(body.error || 'Failed to delete mailbox');
  }
  return { success: true };
}

/**
 * Bulk import mailboxes from CSV
 */
export async function bulkImportMailboxes(csvText: string): Promise<{
  total: number;
  imported: number;
  failed: number;
  results: any[];
}> {
  const res = await fetch('/api/outreach/mailboxes/bulk-import', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ csvText })
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Bulk import failed');
  }
  return body.data;
}

/**
 * List sending domains
 */
export async function listDomains(): Promise<DomainItem[]> {
  const res = await fetch('/api/outreach/domains', {
    headers: getAuthHeader()
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'Failed to fetch domains');
  }
  return body.data;
}

/**
 * Check DNS records for a domain
 */
export async function checkDomainDns(domainId: string): Promise<any> {
  const res = await fetch(`/api/outreach/domains/${domainId}/check-dns`, {
    method: 'POST',
    headers: getAuthHeader()
  });

  const body = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.error || 'DNS verification failed');
  }
  return body.data;
}

// ==========================================
// CAMPAIGN SERVICE APIS
// ==========================================

export interface CampaignStepVariant {
  id?: string;
  variant_label: string;
  subject: string;
  body_html: string;
  body_text?: string;
  weight?: number;
}

export interface CampaignStep {
  id?: string;
  step_number: number;
  delay_days: number;
  delay_hours: number;
  condition?: StepCondition;
  on_true_step?: string;
  on_false_step?: string;
  auto_optimise?: boolean;
  optimization_log?: any[];
  variants: CampaignStepVariant[];
}

export interface CampaignItem {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  daily_limit: number;
  postal_address?: string;
  schedule?: {
    timezone: string;
    windows: { start: string; end: string; days: number[] }[];
  };
  tracking_settings?: {
    track_opens: boolean;
    track_clicks: boolean;
  };
  stop_on_reply?: boolean;
  mailbox_count?: number;
  step_count?: number;
  enrolled_count?: number;
  active_enrolled?: number;
  completed_enrolled?: number;
  bounced_enrolled?: number;
  created_at: string;
  updated_at: string;
  steps?: CampaignStep[];
  mailboxes?: Mailbox[];
}

export interface CampaignStats {
  total_enrolled: number;
  active: number;
  completed: number;
  bounced: number;
  total_sent: number;
  sent_today: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  deferActivity: { id: string; defer_reason: string; updated_at: string; email: string }[];
}

export async function listCampaigns(): Promise<CampaignItem[]> {
  const res = await fetch('/api/outreach/campaigns', { headers: getAuthHeader() });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to list campaigns');
  return body.data;
}

export async function getCampaign(id: string): Promise<CampaignItem> {
  const res = await fetch(`/api/outreach/campaigns/${id}`, { headers: getAuthHeader() });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to get campaign');
  return body.data;
}

export async function createCampaign(data: {
  name: string;
  daily_limit?: number;
  postal_address?: string;
  schedule?: any;
  tracking_settings?: any;
  stop_on_reply?: boolean;
  mailboxIds?: string[];
}): Promise<CampaignItem> {
  const res = await fetch('/api/outreach/campaigns', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data)
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to create campaign');
  return body.data;
}

export async function updateCampaignSteps(campaignId: string, steps: CampaignStep[]): Promise<void> {
  const res = await fetch(`/api/outreach/campaigns/${campaignId}/steps`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify({ steps })
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to save steps');
}

export async function enrollProspects(
  campaignId: string,
  data: {
    prospectIds?: string[];
    csvRows?: { email: string; first_name?: string; last_name?: string; company?: string; title?: string }[];
  }
): Promise<{ enrolled: number; skippedSuppressed: number }> {
  const res = await fetch(`/api/outreach/campaigns/${campaignId}/enroll`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data)
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to enroll prospects');
  return body.data;
}

export async function startCampaign(campaignId: string, acknowledgeRisk = false): Promise<{ requiresConfirmation?: boolean; warning?: string }> {
  const res = await fetch(`/api/outreach/campaigns/${campaignId}/start`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ acknowledgeRisk })
  });
  const body = await res.json();
  if (!res.ok) {
    if (body.requiresConfirmation) {
      return { requiresConfirmation: true, warning: body.warning };
    }
    throw new Error(body.error || 'Failed to start campaign');
  }
  return {};
}

export async function pauseCampaign(campaignId: string): Promise<void> {
  const res = await fetch(`/api/outreach/campaigns/${campaignId}/pause`, {
    method: 'POST',
    headers: getAuthHeader()
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to pause campaign');
}

export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const res = await fetch(`/api/outreach/campaigns/${campaignId}/stats`, { headers: getAuthHeader() });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to fetch campaign stats');
  return body.data;
}

export async function sendCampaignTestEmail(
  campaignId: string,
  data: { recipientEmail: string; stepIndex: number; mailboxId: string }
): Promise<string> {
  const res = await fetch(`/api/outreach/campaigns/${campaignId}/test-send`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data)
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Test send failed');
  return body.message || 'Test email dispatched';
}

// ----------------------------------------------------
// PHASE 3: THREADS, INBOUND REPLIES & TRACKING DOMAINS
// ----------------------------------------------------
export type ThreadLabel =
  | 'interested'
  | 'not_interested'
  | 'question'
  | 'out_of_office'
  | 'unsubscribe'
  | 'wrong_person';

export interface ThreadItem {
  id: string;
  tenant_id: string;
  mailbox_id: string;
  prospect_email: string;
  subject: string;
  last_message_at: string;
  status: 'open' | 'closed';
  label: ThreadLabel;
  is_unread: boolean;
  is_archived: boolean;
  campaign_id?: string;
  enrollment_id?: string;
  snippet?: string;
  created_at: string;
  updated_at: string;
  mailbox_email?: string;
  mailbox_sender_name?: string;
  campaign_name?: string;
  message_count?: number;
}

export interface MessageItem {
  id: string;
  thread_id: string;
  mailbox_id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  to_email: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  message_id_header?: string;
  received_at: string;
  created_at: string;
}

export interface ThreadStats {
  total: number;
  unread: number;
  interested: number;
  question: number;
  notInterested: number;
}

export async function getOutreachThreads(params?: {
  label?: string;
  mailboxId?: string;
  campaignId?: string;
  unread?: boolean;
  search?: string;
  archived?: boolean;
}): Promise<{ threads: ThreadItem[]; stats: ThreadStats }> {
  const query = new URLSearchParams();
  if (params?.label && params.label !== 'all') query.set('label', params.label);
  if (params?.mailboxId && params.mailboxId !== 'all') query.set('mailboxId', params.mailboxId);
  if (params?.campaignId && params.campaignId !== 'all') query.set('campaignId', params.campaignId);
  if (params?.unread) query.set('unread', 'true');
  if (params?.search) query.set('search', params.search);
  if (params?.archived) query.set('archived', 'true');

  const res = await fetch(`/api/outreach/inbox/threads?${query.toString()}`, {
    headers: getAuthHeader()
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to fetch inbox threads');
  return { threads: body.threads || [], stats: body.stats || { total: 0, unread: 0, interested: 0, question: 0, notInterested: 0 } };
}

export async function getOutreachThread(id: string): Promise<{ thread: ThreadItem; messages: MessageItem[] }> {
  const res = await fetch(`/api/outreach/inbox/threads/${id}`, {
    headers: getAuthHeader()
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to fetch thread detail');
  return { thread: body.thread, messages: body.messages || [] };
}

export async function sendThreadReply(
  threadId: string,
  data: { bodyText: string; subject?: string }
): Promise<{ messageId: string }> {
  const res = await fetch(`/api/outreach/inbox/threads/${threadId}/reply`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data)
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to send reply');
  return { messageId: body.messageId };
}

export async function updateThread(
  threadId: string,
  data: { label?: ThreadLabel; is_unread?: boolean; is_archived?: boolean }
): Promise<ThreadItem> {
  const res = await fetch(`/api/outreach/inbox/threads/${threadId}`, {
    method: 'PATCH',
    headers: getAuthHeader(),
    body: JSON.stringify(data)
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to update thread');
  return body.thread;
}

export async function suggestAIReply(threadId: string): Promise<{ suggestions: string[]; isFallback: boolean }> {
  const res = await fetch(`/api/outreach/inbox/threads/${threadId}/suggest-reply`, {
    method: 'POST',
    headers: getAuthHeader()
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to generate AI suggestions');
  return { suggestions: body.suggestions || [], isFallback: !!body.isFallback };
}

export async function createLeadFromThread(threadId: string): Promise<{ leadId: string; message: string }> {
  const res = await fetch(`/api/outreach/inbox/threads/${threadId}/create-lead`, {
    method: 'POST',
    headers: getAuthHeader()
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to create CRM lead');
  return { leadId: body.leadId, message: body.message };
}

export async function setDomainTracking(
  domainId: string,
  trackingDomain: string
): Promise<{ trackingDomain: string; cnameRecord: { host: string; type: string; target: string }; instructions: string }> {
  const res = await fetch(`/api/outreach/domains/${domainId}/tracking`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ domain: trackingDomain })
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to set tracking domain');
  return body;
}

export async function verifyDomainTracking(
  domainId: string
): Promise<{ verified: boolean; message: string; dnsLookupResult?: any }> {
  const res = await fetch(`/api/outreach/domains/${domainId}/tracking/verify`, {
    method: 'POST',
    headers: getAuthHeader()
  });
  const body = await res.json();
  if (!res.ok || !body.success) throw new Error(body.error || 'Failed to verify tracking domain');
  return body;
}

// ----------------------------------------------------
// PHASE 4: PEER-TO-PEER WARMUP ENGINE
// ----------------------------------------------------
export interface WarmupMailboxOverview {
  id: string;
  email: string;
  sender_name: string;
  provider: string;
  domain_name?: string;
  status: string;
  warmup_enabled: boolean;
  warmup_paused: boolean;
  warmup_terms_accepted: boolean;
  warmup_terms_accepted_at?: string;
  warmup_mode: 'new_domain' | 'new_mailbox' | 'dormant' | 'maintenance' | 'recovery';
  warmup_speed: 'conservative' | 'normal' | 'aggressive';
  warmup_target: number;
  pool_excluded: boolean;
  pool_excluded_reason?: string;
  health_score: number;
  sending_day_number: number;
  warmup_age_days: number;
  today_target: number;
  today_sent: number;
  today_received: number;
  today_campaign_sent: number;
  daily_cap: number;
  inbox_rate_7d: number;
  spam_rate_7d: number;
  bounce_rate_7d: number;
  dns: {
    hasSpf: boolean;
    hasDkim: boolean;
    hasDmarc: boolean;
  };
  reasons: string[];
  unlocked_full_target: boolean;
}

export interface WarmupOverviewResponse {
  network_pool: {
    total_active_mailboxes: number;
    is_ready: boolean;
    warning: string | null;
  };
  mailboxes: WarmupMailboxOverview[];
}

export interface WarmupStatsPoint {
  date: string;
  sent: number;
  received: number;
  inbox: number;
  spam: number;
  rescued: number;
  bounced: number;
  health_score: number;
}

export interface WarmupStatsResponse {
  mailbox_id: string;
  series: WarmupStatsPoint[];
}

export async function getWarmupOverview(): Promise<WarmupOverviewResponse> {
  const res = await fetch('/api/outreach/warmup/overview', {
    headers: getAuthHeader()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch warmup overview');
  }
  return res.json();
}

export async function updateWarmupSettings(
  mailboxId: string,
  settings: {
    warmup_enabled?: boolean;
    warmup_paused?: boolean;
    warmup_mode?: string;
    warmup_speed?: string;
    warmup_target?: number;
  }
): Promise<any> {
  const res = await fetch(`/api/outreach/warmup/${mailboxId}`, {
    method: 'PATCH',
    headers: getAuthHeader(),
    body: JSON.stringify(settings)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Failed to update warmup settings');
  return data;
}

export async function submitWarmupConsent(
  mailboxId: string,
  accepted: boolean = true
): Promise<any> {
  const res = await fetch(`/api/outreach/warmup/${mailboxId}/consent`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ accepted })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to record consent');
  return data;
}

export async function getWarmupStats(mailboxId: string): Promise<WarmupStatsResponse> {
  const res = await fetch(`/api/outreach/warmup/${mailboxId}/stats`, {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch warmup stats');
  return data;
}

export async function generateWarmupContentAI(): Promise<any> {
  const res = await fetch('/api/outreach/warmup/generate-content', {
    method: 'POST',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate warmup content');
  return data;
}

export async function triggerWarmupPlanner(): Promise<any> {
  const res = await fetch('/api/outreach/warmup/run-planner', {
    method: 'POST',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to run warmup planner');
  return data;
}

export async function testSimulateSpam(mailboxId: string, spamPercentage: number): Promise<any> {
  const res = await fetch('/api/outreach/warmup/test-simulate-spam', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ mailboxId, spamPercentage })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to simulate spam');
  return data;
}

// ============================================================================
// PHASE 5: PROSPECTS, VERIFIER, SUPPRESSIONS & SPAM CHECKER API CLIENT
// ============================================================================

export interface Prospect {
  id: string;
  tenant_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  company?: string | null;
  title?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  custom_attributes?: Record<string, any>;
  status: string;
  verification_status?: 'valid' | 'risky' | 'invalid' | 'unknown' | null;
  verification_reason?: string | null;
  verified_at?: string | null;
  tags?: string[] | null;
  list_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationCheckDetails {
  syntax: boolean;
  disposable: boolean;
  role: boolean;
  mx: boolean;
  hasArecordFallback?: boolean;
  smtp?: boolean | 'unknown';
  catchAll?: boolean | 'unknown';
}

export interface EmailVerificationResult {
  email: string;
  status: 'valid' | 'risky' | 'invalid' | 'unknown';
  reason: string;
  checks: VerificationCheckDetails;
  typoSuggestion?: string;
  mxRecords?: string[];
  processedAt: string;
}

export interface VerificationBatchData {
  id: string;
  tenantId: string;
  total: number;
  processed: number;
  valid: number;
  risky: number;
  invalid: number;
  unknown: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: EmailVerificationResult[];
  createdAt: string;
  updatedAt: string;
}

export interface VerificationQuotaInfo {
  quota: number;
  used: number;
  remaining: number;
}

export interface SuppressionItem {
  id: string;
  tenant_id: string;
  email: string;
  domain?: string | null;
  is_domain: boolean;
  reason: 'unsubscribe' | 'hard_bounce' | 'complaint' | 'manual';
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface SpamCheckerResponse {
  success: boolean;
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'Risky';
  issues: Array<{
    id: string;
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    matched?: string[];
  }>;
  fixes: string[];
  highlights: string[];
  details: {
    wordCount: number;
    allCapsRatio: number;
    exclamationCount: number;
    linkCount: number;
    hasImageOnly: boolean;
    missingPlainText: boolean;
    brokenMergeTags: string[];
    urlShorteners: string[];
    spamWords: string[];
  };
}

// Prospects API
export async function getProspects(params?: {
  search?: string;
  status?: string;
  verification_status?: string;
  tag?: string;
  list_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ prospects: Prospect[]; total: number; limit: number; offset: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);
  if (params?.verification_status) query.set('verification_status', params.verification_status);
  if (params?.tag) query.set('tag', params.tag);
  if (params?.list_id) query.set('list_id', params.list_id);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const res = await fetch(`/api/outreach/prospects?${query.toString()}`, {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch prospects');
  return data;
}

export async function createProspect(prospectData: Partial<Prospect>): Promise<Prospect> {
  const res = await fetch('/api/outreach/prospects', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(prospectData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create prospect');
  return data.prospect;
}

export async function updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect> {
  const res = await fetch(`/api/outreach/prospects/${id}`, {
    method: 'PATCH',
    headers: getAuthHeader(),
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update prospect');
  return data.prospect;
}

export async function deleteProspect(id: string): Promise<void> {
  const res = await fetch(`/api/outreach/prospects/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete prospect');
}

export async function importProspectsCsv(
  rows: any[],
  mapping?: Record<string, string>,
  list_id?: string,
  tags?: string[]
): Promise<{
  report: {
    total: number;
    imported: number;
    duplicate: number;
    invalid: number;
    suppressed: number;
    errors?: string[];
  };
}> {
  const res = await fetch('/api/outreach/prospects/import-csv', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ rows, mapping, list_id, tags })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to import CSV');
  return data;
}

export async function findLeadsOnline(params: {
  domain?: string;
  company?: string;
  title?: string;
}): Promise<{
  success: boolean;
  configured: boolean;
  provider?: string;
  prospects: Array<{
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    title: string;
    phone: string;
    linkedin_url: string;
  }>;
  error?: string;
}> {
  const res = await fetch('/api/outreach/prospects/find', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (!res.ok && res.status !== 200) throw new Error(data.error || 'Lead sourcing lookup failed');
  return data;
}

// Verification API
export async function verifySingleEmailOnline(email: string): Promise<EmailVerificationResult> {
  const res = await fetch('/api/outreach/tools/verify-email', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Verification failed');
  return data.result;
}

export async function startBulkVerification(params: {
  emails?: string[];
  prospectIds?: string[];
}): Promise<{ batchId: string; total: number; status: string; message: string }> {
  const res = await fetch('/api/outreach/prospects/verify', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to start bulk verification');
  return data;
}

export async function getVerificationBatchStatus(batchId: string): Promise<VerificationBatchData> {
  const res = await fetch(`/api/outreach/verification/batches/${batchId}`, {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch batch status');
  return data.batch;
}

export async function getVerificationQuotaInfo(): Promise<VerificationQuotaInfo> {
  const res = await fetch('/api/outreach/verification/quota', {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch quota info');
  return data;
}

export async function addCustomDisposableDomain(domain: string): Promise<void> {
  const res = await fetch('/api/outreach/tools/admin/disposable-domains', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ domain })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add disposable domain');
}

// Suppressions API
export async function getSuppressionsList(params?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ suppressions: SuppressionItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));

  const res = await fetch(`/api/outreach/suppressions?${query.toString()}`, {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch suppressions');
  return data;
}

export async function addSuppressionItem(item: {
  email?: string;
  domain?: string;
  is_domain?: boolean;
  reason?: 'unsubscribe' | 'hard_bounce' | 'complaint' | 'manual';
}): Promise<SuppressionItem> {
  const res = await fetch('/api/outreach/suppressions', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(item)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create suppression');
  return data.suppression;
}

export async function removeSuppressionItem(id: string): Promise<void> {
  const res = await fetch(`/api/outreach/suppressions/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to remove suppression');
}

export async function importSuppressionsCsvData(
  rows: any[],
  reason: string = 'manual',
  is_domain: boolean = false
): Promise<{ report: { total: number; imported: number; duplicate: number } }> {
  const res = await fetch('/api/outreach/suppressions/import-csv', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ rows, reason, is_domain })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to import suppressions');
  return data;
}

// Spam Checker API
export async function checkEmailSpamScore(input: {
  subject?: string;
  body?: string;
  emailCopy?: string;
  html?: string;
  text?: string;
}): Promise<SpamCheckerResponse> {
  const res = await fetch('/api/outreach/tools/spam-check', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(input)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to check spam score');
  return data;
}


// ============================================================================
// PHASE 6: CONDITIONAL BRANCHING, A-Z VARIANTS, ANALYTICS, PLANS & STRIPE BILLING
// ============================================================================

export interface ConditionRule {
  type:
    | 'opened'
    | 'clicked'
    | 'replied'
    | 'bounced'
    | 'not_opened'
    | 'not_clicked'
    | 'link_clicked'
    | 'replied_positive';
  stepRef?: string | number;
  withinHours?: number;
  linkUrl?: string;
}

export interface StepCondition {
  op: 'AND' | 'OR';
  rules: ConditionRule[];
}

export interface OutreachPlan {
  id: string;
  name: string;
  tier: 'starter' | 'growth' | 'scale';
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  mailboxLimit: number;
  monthlySendLimit: number;
  dailySendLimit: number;
  verificationQuota: number;
  features: {
    warmup: boolean;
    a_b_testing: boolean;
    conditional_branching: boolean;
    auto_optimize: boolean;
    dedicated_tracking_domain: boolean;
    advanced_analytics: boolean;
    priority_support: boolean;
  };
}

export interface TenantPlanDetails {
  tenantId: string;
  plan: OutreachPlan;
  billingInterval: 'monthly' | 'annual';
  billingCycleStart: string;
  billingCycleEnd: string;
  status: 'active' | 'past_due' | 'canceled';
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  isTestMode: boolean;
  usage?: {
    emailsSent: number;
    emailsLimit: number;
    emailsRemaining: number;
    mailboxesUsed: number;
    mailboxesLimit: number;
    verificationsUsed: number;
    verificationsLimit: number;
    isUpgradeRequired: boolean;
  };
}

export interface AnalyticsOverviewMetrics {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  positiveReplied: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  positiveReplyRate: number;
  bounceRate: number;
  openRateDisclaimer: string;
}

export interface AnalyticsDailyPoint {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  positiveReplied: number;
}

export interface CampaignAnalyticsSummary {
  id: string;
  name: string;
  status: string;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  positiveReplied: number;
  replyRate: number;
}

export interface VariantAnalyticsSummary {
  variantId: string;
  stepId: string;
  variantLabel: string;
  subject: string;
  weight: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  positiveReplied: number;
  replyRate: number;
  posteriorScore: number;
}

export interface MailboxAnalyticsSummary {
  mailboxId: string;
  email: string;
  sent: number;
  bounced: number;
  replied: number;
  bounceRate: number;
  healthScore: number;
}

export interface WarmupTrendPoint {
  date: string;
  sent: number;
  inboxLanded: number;
  spamLanded: number;
  rescued: number;
  replied: number;
  avgHealthScore: number;
}

export interface OutreachAnalyticsData {
  overview: AnalyticsOverviewMetrics;
  dailySeries: AnalyticsDailyPoint[];
  campaigns: CampaignAnalyticsSummary[];
  variants: VariantAnalyticsSummary[];
  mailboxes: MailboxAnalyticsSummary[];
  warmupTrend: WarmupTrendPoint[];
}

export interface WorkspaceMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'manager' | 'viewer';
  created_at: string;
  updated_at?: string;
}

// 1. Analytics Endpoints
export async function getOutreachAnalyticsData(filters: {
  campaignId?: string;
  mailboxId?: string;
  variantId?: string;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
} = {}): Promise<OutreachAnalyticsData> {
  const query = new URLSearchParams();
  if (filters.campaignId) query.set('campaignId', filters.campaignId);
  if (filters.mailboxId) query.set('mailboxId', filters.mailboxId);
  if (filters.variantId) query.set('variantId', filters.variantId);
  if (filters.dateRange) query.set('dateRange', filters.dateRange);
  if (filters.startDate) query.set('startDate', filters.startDate);
  if (filters.endDate) query.set('endDate', filters.endDate);

  const res = await fetch(`/api/outreach/analytics/overview?${query.toString()}`, {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch analytics overview');
  return data.data;
}

export async function downloadAnalyticsCsv(filters: {
  campaignId?: string;
  mailboxId?: string;
  dateRange?: string;
} = {}): Promise<void> {
  const query = new URLSearchParams();
  if (filters.campaignId) query.set('campaignId', filters.campaignId);
  if (filters.mailboxId) query.set('mailboxId', filters.mailboxId);
  if (filters.dateRange) query.set('dateRange', filters.dateRange);

  const res = await fetch(`/api/outreach/analytics/export-csv?${query.toString()}`, {
    headers: getAuthHeader()
  });
  if (!res.ok) throw new Error('Failed to export analytics CSV');

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `outreach-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function triggerDailyRollup(): Promise<any> {
  const res = await fetch('/api/outreach/analytics/rollup', {
    method: 'POST',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to execute rollup');
  return data.data;
}

// 2. Sequence Loop Validation
export async function validateSequenceNodes(steps: any[]): Promise<{ isValid: boolean; error?: string; cyclePath?: string[] }> {
  const res = await fetch('/api/outreach/sequences/validate', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ steps })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to validate sequence');
  return data.data;
}

// 3. Variant Auto-Optimise & Decision Log
export async function triggerStepAutoOptimise(
  campaignId: string,
  stepId: string,
  minSendsThreshold: number = 100
): Promise<any> {
  const res = await fetch(`/api/outreach/campaigns/${campaignId}/steps/${stepId}/auto-optimise`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ minSendsThreshold })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to auto-optimise step variants');
  return data.data;
}

export async function getStepOptimisationLog(campaignId: string, stepId: string): Promise<any> {
  const res = await fetch(`/api/outreach/campaigns/${campaignId}/steps/${stepId}/optimisation-log`, {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch optimization log');
  return data.data;
}

// 4. Plans & Stripe Billing
export async function getOutreachPlansList(): Promise<{ plans: Record<string, OutreachPlan>; isTestMode: boolean }> {
  const res = await fetch('/api/outreach/billing/plans', {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch plans');
  return data.data;
}

export async function getCurrentTenantPlan(): Promise<TenantPlanDetails> {
  const res = await fetch('/api/outreach/billing/current-plan', {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch current plan');
  return data.data;
}

export async function createOutreachCheckoutSession(
  planId: string,
  billingInterval: 'monthly' | 'annual'
): Promise<{ sessionId: string; url: string; isLiveStripe: boolean; isTestMode?: boolean; message?: string }> {
  const res = await fetch('/api/outreach/billing/checkout', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ planId, billingInterval })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create checkout session');
  return data;
}

export async function openCustomerPortalSession(): Promise<{ url: string; isTestMode?: boolean }> {
  const res = await fetch('/api/outreach/billing/portal', {
    method: 'POST',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to open customer portal');
  return data;
}

export async function testUpgradePlanManual(
  planId: string,
  billingInterval: 'monthly' | 'annual' = 'monthly'
): Promise<TenantPlanDetails> {
  const res = await fetch('/api/outreach/billing/test-upgrade', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ planId, billingInterval })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upgrade plan in test mode');
  return data.data;
}

// 5. Workspace Team Members
export async function getWorkspaceMembers(): Promise<WorkspaceMember[]> {
  const res = await fetch('/api/outreach/team/members', {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch team members');
  return data.data;
}

export async function addWorkspaceMember(
  userId: string,
  role: 'owner' | 'manager' | 'viewer'
): Promise<WorkspaceMember> {
  const res = await fetch('/api/outreach/team/members', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ userId, role })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add team member');
  return data.data;
}

export async function updateWorkspaceMemberRole(
  id: string,
  role: 'owner' | 'manager' | 'viewer'
): Promise<void> {
  const res = await fetch(`/api/outreach/team/members/${id}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify({ role })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update member role');
}

export async function removeWorkspaceMember(id: string): Promise<void> {
  const res = await fetch(`/api/outreach/team/members/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to remove member');
}

// ============================================================================
// 6. API Keys & Webhooks Management
// ============================================================================

export interface ApiKeyItem {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  created_at: string;
}

export interface CreatedApiKeyData {
  success: boolean;
  apiKey: string;
  keyInfo: ApiKeyItem;
  message: string;
}

export interface WebhookEndpointItem {
  id: string;
  tenant_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryItem {
  id: string;
  tenant_id: string;
  webhook_id: string;
  event: string;
  payload: any;
  status_code: number | null;
  response_body: string | null;
  duration_ms: number | null;
  attempt: number;
  max_attempts: number;
  next_retry_at: string | null;
  status: 'delivered' | 'retrying' | 'failed';
  created_at: string;
}

export async function getTenantApiKeys(): Promise<ApiKeyItem[]> {
  const res = await fetch('/api/outreach/v1/api-keys', {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch API keys');
  return data.keys || [];
}

export async function createTenantApiKey(
  name: string,
  scopes?: string[]
): Promise<CreatedApiKeyData> {
  const res = await fetch('/api/outreach/v1/api-keys', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ name, scopes })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create API key');
  return data;
}

export async function deleteTenantApiKey(id: string): Promise<void> {
  const res = await fetch(`/api/outreach/v1/api-keys/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to revoke API key');
}

export async function getWebhookEndpoints(): Promise<WebhookEndpointItem[]> {
  const res = await fetch('/api/outreach/v1/webhooks', {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch webhooks');
  return data.webhooks || [];
}

export async function createWebhookEndpoint(
  url: string,
  events: string[] = ['*'],
  secret?: string
): Promise<WebhookEndpointItem> {
  const res = await fetch('/api/outreach/v1/webhooks', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ url, events, secret })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Failed to create webhook');
  return data.webhook;
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const res = await fetch(`/api/outreach/v1/webhooks/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete webhook');
}

export async function getWebhookDeliveries(
  webhookId?: string,
  limit: number = 50
): Promise<WebhookDeliveryItem[]> {
  const url = webhookId
    ? `/api/outreach/v1/webhooks/${webhookId}/deliveries?limit=${limit}`
    : `/api/outreach/v1/webhooks/deliveries?limit=${limit}`;
  const res = await fetch(url, {
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch deliveries');
  return data.deliveries || [];
}

export async function replayWebhookDelivery(deliveryId: string): Promise<any> {
  const res = await fetch(`/api/outreach/v1/webhooks/deliveries/${deliveryId}/replay`, {
    method: 'POST',
    headers: getAuthHeader()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to replay delivery');
  return data.replayed;
}
