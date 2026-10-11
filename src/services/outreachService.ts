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
  const token = localStorage.getItem('agency_jwt_token') || sessionStorage.getItem('agency_jwt_token');
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

