import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Zap,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Plus,
  Trash2,
  Mail,
  UserCheck,
  Check,
  Copy,
  Key,
  Webhook,
  Cpu,
  RotateCcw,
  Code2,
  Terminal,
  Clock,
  Eye,
  Info
} from 'lucide-react';
import {
  getCurrentTenantPlan,
  getOutreachPlansList,
  createOutreachCheckoutSession,
  openCustomerPortalSession,
  testUpgradePlanManual,
  getWorkspaceMembers,
  addWorkspaceMember,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  getTenantApiKeys,
  createTenantApiKey,
  deleteTenantApiKey,
  getWebhookEndpoints,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  getWebhookDeliveries,
  replayWebhookDelivery,
  TenantPlanDetails,
  OutreachPlan,
  WorkspaceMember,
  ApiKeyItem,
  CreatedApiKeyData,
  WebhookEndpointItem,
  WebhookDeliveryItem
} from '../../services/outreachService';

interface SettingsTabProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
}

type SettingsSubTab = 'billing' | 'apikeys' | 'webhooks' | 'mcp' | 'team';

const ALL_SCOPES = [
  { id: 'campaigns:read', label: 'campaigns:read', desc: 'Read campaigns and sequence steps' },
  { id: 'campaigns:write', label: 'campaigns:write', desc: 'Create, update, start & pause campaigns' },
  { id: 'prospects:read', label: 'prospects:read', desc: 'List and search prospects' },
  { id: 'prospects:write', label: 'prospects:write', desc: 'Create and bulk import prospects' },
  { id: 'mailboxes:read', label: 'mailboxes:read', desc: 'Inspect mailbox health and deliverability' },
  { id: 'warmup:read', label: 'warmup:read', desc: 'Inspect warmup progress and spam rescue rates' },
  { id: 'warmup:write', label: 'warmup:write', desc: 'Configure warmup ramp parameters' },
  { id: 'enrollments:write', label: 'enrollments:write', desc: 'Enroll prospects into campaign sequences' },
  { id: 'suppressions:read', label: 'suppressions:read', desc: 'Inspect global suppression list' },
  { id: 'suppressions:write', label: 'suppressions:write', desc: 'Add emails/domains to suppression list' },
  { id: 'inbox:read', label: 'inbox:read', desc: 'Read unified inbox replies and sentiment' },
  { id: 'jobs:read', label: 'jobs:read', desc: 'Inspect background queue telemetry' }
];

const ALL_WEBHOOK_EVENTS = [
  { id: 'email.sent', label: 'email.sent', desc: 'Dispatched from sending mailbox' },
  { id: 'email.opened', label: 'email.opened', desc: 'Open tracking pixel loaded' },
  { id: 'email.clicked', label: 'email.clicked', desc: 'Tracked link clicked' },
  { id: 'reply.received', label: 'reply.received', desc: 'Inbound prospect response received' },
  { id: 'email.bounced', label: 'email.bounced', desc: 'Hard or soft bounce recorded' },
  { id: 'lead.unsubscribed', label: 'lead.unsubscribed', desc: 'List-Unsubscribe or opt-out link clicked' },
  { id: 'campaign.completed', label: 'campaign.completed', desc: 'All steps completed for prospect' }
];

export const SettingsTab: React.FC<SettingsTabProps> = ({ showToast, isAdmin = true }) => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('billing');

  // Billing state
  const [currentPlan, setCurrentPlan] = useState<TenantPlanDetails | null>(null);
  const [plansMap, setPlansMap] = useState<Record<string, OutreachPlan>>({});
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [upgrading, setUpgrading] = useState<boolean>(false);

  // Team workspace members state
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState<string>('');
  const [newMemberRole, setNewMemberRole] = useState<'owner' | 'manager' | 'viewer'>('manager');
  const [addingMember, setAddingMember] = useState<boolean>(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [showNewKeyModal, setShowNewKeyModal] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['*']);
  const [creatingKey, setCreatingKey] = useState<boolean>(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<CreatedApiKeyData | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookEndpointItem[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [showNewWebhookModal, setShowNewWebhookModal] = useState<boolean>(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState<string>('');
  const [newWebhookSecret, setNewWebhookSecret] = useState<string>('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['*']);
  const [creatingWebhook, setCreatingWebhook] = useState<boolean>(false);
  const [replayingId, setReplayingId] = useState<string | null>(null);

  const loadSettingsData = useCallback(async () => {
    try {
      setLoading(true);
      const [planData, plansRes, membersRes, keysRes, webhooksRes, deliveriesRes] = await Promise.all([
        getCurrentTenantPlan(),
        getOutreachPlansList(),
        getWorkspaceMembers(),
        getTenantApiKeys().catch(() => []),
        getWebhookEndpoints().catch(() => []),
        getWebhookDeliveries(undefined, 20).catch(() => [])
      ]);
      setCurrentPlan(planData);
      setPlansMap(plansRes.plans);
      setIsTestMode(plansRes.isTestMode);
      setMembers(membersRes);
      setApiKeys(keysRes);
      setWebhooks(webhooksRes);
      setDeliveries(deliveriesRes);
    } catch (err: any) {
      showToast(err.message || 'Failed to load settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSettingsData();
  }, [loadSettingsData]);

  const handleUpgradePlan = async (planKey: string) => {
    setUpgrading(true);
    try {
      if (isTestMode) {
        const updated = await testUpgradePlanManual(planKey, billingInterval);
        setCurrentPlan(updated);
        setShowUpgradeModal(false);
        showToast(`Successfully upgraded to ${updated.plan.name} (${billingInterval}) plan!`, 'success');
      } else {
        const session = await createOutreachCheckoutSession(planKey, billingInterval);
        if (session.url) {
          window.location.href = session.url;
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to initiate plan upgrade', 'error');
    } finally {
      setUpgrading(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      const session = await openCustomerPortalSession();
      if (session.isTestMode) {
        showToast('Running in Stripe Test Mode. Switch plans directly in the Plan Switcher.', 'info');
        setShowUpgradeModal(true);
      } else if (session.url) {
        window.location.href = session.url;
      }
    } catch (err: any) {
      showToast(err.message || 'Customer portal unavailable', 'error');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;
    setAddingMember(true);
    try {
      const newM = await addWorkspaceMember(newMemberEmail.trim(), newMemberRole);
      setMembers((prev) => [newM, ...prev]);
      setNewMemberEmail('');
      showToast(`Invited ${newMemberEmail} as ${newMemberRole}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to invite member', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: 'owner' | 'manager' | 'viewer') => {
    try {
      await updateWorkspaceMemberRole(memberId, role);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
      showToast('Member role updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update member role', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the workspace?')) return;
    try {
      await removeWorkspaceMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      showToast('Member removed from workspace', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error');
    }
  };

  // API Key handlers
  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const result = await createTenantApiKey(newKeyName.trim(), selectedScopes);
      setApiKeys((prev) => [result.keyInfo, ...prev]);
      setNewlyCreatedKey(result);
      setShowNewKeyModal(false);
      setNewKeyName('');
      setSelectedScopes(['*']);
      showToast('API key created successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to create API key', 'error');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Any running scripts or MCP clients using it will immediately fail.')) return;
    try {
      await deleteTenantApiKey(id);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      showToast('API key revoked', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke API key', 'error');
    }
  };

  // Webhook handlers
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;
    setCreatingWebhook(true);
    try {
      const hook = await createWebhookEndpoint(
        newWebhookUrl.trim(),
        selectedEvents,
        newWebhookSecret.trim() || undefined
      );
      setWebhooks((prev) => [hook, ...prev]);
      setShowNewWebhookModal(false);
      setNewWebhookUrl('');
      setNewWebhookSecret('');
      setSelectedEvents(['*']);
      showToast('Webhook endpoint registered', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to register webhook', 'error');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Delete this webhook endpoint and stop deliveries?')) return;
    try {
      await deleteWebhookEndpoint(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      showToast('Webhook endpoint removed', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete webhook', 'error');
    }
  };

  const handleReplayDelivery = async (deliveryId: string) => {
    setReplayingId(deliveryId);
    try {
      const replayed = await replayWebhookDelivery(deliveryId);
      showToast(
        replayed.success ? 'Delivery replayed successfully' : `Replay failed: ${replayed.error || 'Check endpoint'}`,
        replayed.success ? 'success' : 'error'
      );
      const updated = await getWebhookDeliveries(undefined, 20);
      setDeliveries(updated);
    } catch (err: any) {
      showToast(err.message || 'Failed to replay delivery', 'error');
    } finally {
      setReplayingId(null);
    }
  };

  const usage = currentPlan?.usage || {
    emailsSent: 0,
    emailsLimit: 25000,
    emailsRemaining: 25000,
    mailboxesUsed: 0,
    mailboxesLimit: 10,
    verificationsUsed: 0,
    verificationsLimit: 5000,
    isUpgradeRequired: false
  };

  const plan = currentPlan?.plan || {
    id: 'growth',
    name: 'Growth',
    tier: 'growth',
    monthlyPriceUsd: 99,
    annualPriceUsd: 79,
    mailboxLimit: 10,
    monthlySendLimit: 25000,
    dailySendLimit: 1000,
    verificationQuota: 5000
  };

  const emailsPct = Math.min(100, Math.round((usage.emailsSent / usage.emailsLimit) * 100));
  const mailboxPct = Math.min(100, Math.round((usage.mailboxesUsed / usage.mailboxesLimit) * 100));
  const verifPct = Math.min(100, Math.round((usage.verificationsUsed / usage.verificationsLimit) * 100));

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Workspace Settings & Developer Hub</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage billing, team permissions, REST API keys, webhooks, and Model Context Protocol (MCP) integrations.
          </p>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('billing')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'billing'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Billing & Quotas</span>
          </button>

          <button
            onClick={() => setActiveSubTab('apikeys')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'apikeys'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              {apiKeys.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('webhooks')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'webhooks'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Webhook className="w-3.5 h-3.5" />
            <span>Webhooks</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              {webhooks.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('mcp')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'mcp'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>MCP & AI Agents</span>
          </button>

          <button
            onClick={() => setActiveSubTab('team')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeSubTab === 'team'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team Members</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          1. BILLING & QUOTAS SUB-TAB
      ===================================================================== */}
      {activeSubTab === 'billing' && (
        <div className="space-y-6">
          {/* Test Mode Banner */}
          {isTestMode && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <div>
                  <span className="font-bold">STRIPE TEST MODE ACTIVE: </span>
                  <span>No live Stripe API key configured. Manual plan switching and test upgrade simulation enabled.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all shadow-2xs"
              >
                Switch Plan (Test Mode)
              </button>
            </div>
          )}

          {/* Plan upgrade required banner if limit exceeded */}
          {usage.isUpgradeRequired && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <div>
                  <span className="font-bold">MONTHLY EMAIL QUOTA EXHAUSTED: </span>
                  <span>Campaign sending is automatically paused by Cap Guard. Please upgrade your plan tier to resume outbound.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
              >
                Upgrade Plan Now
              </button>
            </div>
          )}

          {/* Active Plan Card & Action Header */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {plan.name} Plan
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400">
                  Active Tier
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Billing cycle renews on{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {currentPlan?.billingCycleEnd ? new Date(currentPlan.billingCycleEnd).toLocaleDateString() : 'N/A'}
                </strong>{' '}
                ({currentPlan?.billingInterval || 'monthly'} cadence).
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-4 h-4" />
                <span>Upgrade Plan</span>
              </button>
              <button
                type="button"
                onClick={handleOpenPortal}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-bold text-xs text-slate-700 dark:text-slate-200 shadow-2xs flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Customer Portal</span>
              </button>
            </div>
          </div>

          {/* Usage Meters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Monthly Emails Sent */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold">Monthly Emails Sent</span>
                <Mail className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {usage.emailsSent.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">
                  / {usage.emailsLimit.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    emailsPct >= 90 ? 'bg-rose-500' : emailsPct >= 70 ? 'bg-amber-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${emailsPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>{emailsPct}% utilized</span>
                <span>{usage.emailsRemaining.toLocaleString()} remaining</span>
              </div>
            </div>

            {/* Connected Mailboxes */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold">Connected Mailboxes</span>
                <Zap className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {usage.mailboxesUsed}
                </span>
                <span className="text-xs text-slate-400">
                  / {usage.mailboxesLimit}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    mailboxPct >= 90 ? 'bg-rose-500' : mailboxPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${mailboxPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>{mailboxPct}% of quota</span>
                <span>{usage.mailboxesLimit - usage.mailboxesUsed} slots open</span>
              </div>
            </div>

            {/* Email Verifications Quota */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold">Monthly Verifications</span>
                <ShieldCheck className="w-4 h-4 text-purple-500" />
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {usage.verificationsUsed.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">
                  / {usage.verificationsLimit.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    verifPct >= 90 ? 'bg-rose-500' : verifPct >= 70 ? 'bg-amber-500' : 'bg-purple-600'
                  }`}
                  style={{ width: `${verifPct}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>{verifPct}% utilized</span>
                <span>{(usage.verificationsLimit - usage.verificationsUsed).toLocaleString()} remaining</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. API KEYS SUB-TAB
      ===================================================================== */}
      {activeSubTab === 'apikeys' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>Outreach REST API Keys</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Keys look like <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">lf_&lt;32 chars&gt;</code>. Plaintext keys are shown ONCE at generation and stored as SHA-256 hashes.
              </p>
            </div>

            <button
              onClick={() => setShowNewKeyModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Generate API Key</span>
            </button>
          </div>

          {/* Newly Created Key Modal Banner (Shown ONCE) */}
          {newlyCreatedKey && (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 dark:border-emerald-600 text-slate-900 dark:text-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>New API Key Generated ({newlyCreatedKey.keyInfo.name})</span>
                </div>
                <button
                  onClick={() => setNewlyCreatedKey(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold"
                >
                  Dismiss
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Please copy your API key immediately. <strong>You will not be able to see it again.</strong>
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={newlyCreatedKey.apiKey}
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 font-mono text-xs text-slate-900 dark:text-white"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(newlyCreatedKey.apiKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
                </button>
              </div>
            </div>
          )}

          {/* API Keys Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px]">
                    <th className="pb-2 font-semibold">Key Name</th>
                    <th className="pb-2 font-semibold">Key Prefix</th>
                    <th className="pb-2 font-semibold">Allowed Scopes</th>
                    <th className="pb-2 font-semibold">Last Used</th>
                    <th className="pb-2 font-semibold">Created</th>
                    <th className="pb-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {apiKeys.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No API keys generated yet. Click "Generate API Key" to create your first credential.
                      </td>
                    </tr>
                  ) : (
                    apiKeys.map((k) => (
                      <tr key={k.id}>
                        <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                          {k.name}
                        </td>
                        <td className="py-3 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                          {k.key_prefix}••••••••
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {k.permissions.includes('*') ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                                Full Access (*)
                              </span>
                            ) : (
                              k.permissions.map((p) => (
                                <span
                                  key={p}
                                  className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  {p}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-slate-400 font-mono text-[11px]">
                          {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3 text-slate-400 font-mono text-[11px]">
                          {new Date(k.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDeleteApiKey(k.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Revoke Key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          3. WEBHOOKS SUB-TAB
      ===================================================================== */}
      {activeSubTab === 'webhooks' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Webhook className="w-4 h-4 text-indigo-600" />
                <span>Webhooks & Event Dispatches</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every webhook is cryptographically signed with <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-mono text-[11px]">X-LeadFlow-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;</code> over <code className="font-mono">t.body</code>. Protected with SSRF filters.
              </p>
            </div>

            <button
              onClick={() => setShowNewWebhookModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Webhook</span>
            </button>
          </div>

          {/* Endpoints Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Configured Endpoints ({webhooks.length})
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px]">
                    <th className="pb-2 font-semibold">Destination URL</th>
                    <th className="pb-2 font-semibold">Subscribed Events</th>
                    <th className="pb-2 font-semibold">Signing Secret</th>
                    <th className="pb-2 font-semibold">Last Dispatched</th>
                    <th className="pb-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {webhooks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No webhook endpoints configured. Click "Add Webhook" to receive real-time email event dispatches.
                      </td>
                    </tr>
                  ) : (
                    webhooks.map((w) => (
                      <tr key={w.id}>
                        <td className="py-3 font-mono font-semibold text-slate-800 dark:text-slate-200 max-w-xs truncate">
                          {w.url}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {w.events.includes('*') ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                All Events (*)
                              </span>
                            ) : (
                              w.events.map((e) => (
                                <span
                                  key={e}
                                  className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  {e}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-3 font-mono text-slate-400 text-[11px]">
                          whsec_••••••••••••
                        </td>
                        <td className="py-3 text-slate-400 font-mono text-[11px]">
                          {w.last_triggered_at ? new Date(w.last_triggered_at).toLocaleString() : 'Never'}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleDeleteWebhook(w.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Webhook"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery Logs Table */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Recent Webhook Deliveries & Replay Log
                </h4>
                <p className="text-[11px] text-slate-400">
                  Deliveries retry automatically with exponential backoff for up to 24 hours.
                </p>
              </div>

              <button
                onClick={async () => {
                  const updated = await getWebhookDeliveries(undefined, 20);
                  setDeliveries(updated);
                  showToast('Delivery logs refreshed', 'info');
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh Log</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px]">
                    <th className="pb-2 font-semibold">Event</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">HTTP Code</th>
                    <th className="pb-2 font-semibold">Latency</th>
                    <th className="pb-2 font-semibold">Attempt</th>
                    <th className="pb-2 font-semibold">Timestamp</th>
                    <th className="pb-2 font-semibold text-right">Replay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No delivery logs recorded yet. Outbound campaign activities will be logged here in real time.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((del) => (
                      <tr key={del.id}>
                        <td className="py-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {del.event}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              del.status === 'delivered'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : del.status === 'retrying'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {del.status}
                          </span>
                        </td>
                        <td className="py-3 font-mono">
                          {del.status_code ? (
                            <span className={del.status_code >= 200 && del.status_code < 300 ? 'text-emerald-600' : 'text-rose-600'}>
                              {del.status_code}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 font-mono text-slate-500">
                          {del.duration_ms ? `${del.duration_ms}ms` : '—'}
                        </td>
                        <td className="py-3 font-mono text-slate-500">
                          {del.attempt} / {del.max_attempts}
                        </td>
                        <td className="py-3 font-mono text-slate-400 text-[11px]">
                          {new Date(del.created_at).toLocaleTimeString()}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleReplayDelivery(del.id)}
                            disabled={replayingId === del.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 transition cursor-pointer disabled:opacity-50"
                          >
                            {replayingId === del.id ? 'Replaying...' : 'Replay'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. MODEL CONTEXT PROTOCOL (MCP) SUB-TAB
      ===================================================================== */}
      {activeSubTab === 'mcp' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  <span>Model Context Protocol (MCP) Server</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Connect Claude Desktop, Cursor, and autonomous AI agents to manage outreach via natural language over Streamable HTTP and SSE.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Endpoint Active</span>
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono flex items-center justify-between">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                POST / GET /api/outreach/mcp
              </span>
              <span className="text-slate-400">Streamable HTTP / SSE Protocol 2024-11-05</span>
            </div>
          </div>

          {/* Claude Desktop Config Snippet */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Terminal className="w-4 h-4 text-indigo-600" />
                <span>Claude Desktop Configuration (claude_desktop_config.json)</span>
              </div>
              <button
                onClick={() => {
                  const cfg = JSON.stringify(
                    {
                      mcpServers: {
                        leadflow: {
                          command: 'npx',
                          args: [
                            '-y',
                            '@modelcontextprotocol/server-sse',
                            `${window.location.origin}/api/outreach/mcp`,
                            '--header',
                            'Authorization: Bearer lf_your_api_key_here'
                          ]
                        }
                      }
                    },
                    null,
                    2
                  );
                  navigator.clipboard.writeText(cfg);
                  showToast('Claude configuration copied to clipboard', 'success');
                }}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Config</span>
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
{`{
  "mcpServers": {
    "leadflow": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sse",
        "${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/outreach/mcp",
        "--header",
        "Authorization: Bearer lf_your_api_key_here"
      ]
    }
  }
}`}
            </pre>
          </div>

          {/* Available MCP Tools Grid */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Available AI Tools & Agent Guardrails (18 Registered Tools)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Read Tools */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">Read & Telemetry Tools</span>
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                  <li>• list_campaigns - Query active and draft campaigns</li>
                  <li>• get_campaign - Inspect sequence steps & variants</li>
                  <li>• list_prospects - Filter by status, company, tags</li>
                  <li>• list_mailboxes - View deliverability status</li>
                  <li>• get_mailbox_health - Check SPF, DKIM, DMARC scores</li>
                  <li>• get_warmup_stats - Inspect peer-to-peer warmup metrics</li>
                  <li>• list_suppressions - Inspect blocked addresses</li>
                  <li>• get_usage - Audit quota consumption and plan limits</li>
                </ul>
              </div>

              {/* Write Tools */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Write & Automation Tools</span>
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                  <li>• create_prospect - Insert single enriched prospect</li>
                  <li>• bulk_create_prospects - Batch import prospects</li>
                  <li>• create_campaign - Initialize campaign in draft mode</li>
                  <li>• update_campaign - Update DAG steps (cycle checked)</li>
                  <li>• start_campaign - Hand off to Cap Guard (never blasted)</li>
                  <li>• pause_campaign / resume_campaign - Control dispatching</li>
                  <li>• enroll_prospects - Enroll verified targets</li>
                  <li>• add_to_suppression_list - Annotated as destructive</li>
                  <li>• verify_email - Run pre-flight deliverability check</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. TEAM MEMBERS SUB-TAB
      ===================================================================== */}
      {activeSubTab === 'team' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Workspace Members & Roles (Outreach Suite)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage workspace-level permissions: Owners (full billing + admin), Managers (campaign creation & sending), and Viewers (read-only telemetry).
              </p>
            </div>
          </div>

          {/* Invite Member Form */}
          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="email"
              placeholder="Teammate email (e.g. alex@acme.com)"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              required
              className="flex-1 w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
            />
            <select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
            >
              <option value="owner">Owner (Full Access & Billing)</option>
              <option value="manager">Manager (Create & Send Campaigns)</option>
              <option value="viewer">Viewer (Read-only Analytics)</option>
            </select>
            <button
              type="submit"
              disabled={addingMember}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Invite Member</span>
            </button>
          </form>

          {/* Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px]">
                  <th className="pb-2 font-semibold">Teammate User / ID</th>
                  <th className="pb-2 font-semibold">Workspace Role</th>
                  <th className="pb-2 font-semibold">Added At</th>
                  <th className="pb-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-indigo-500" />
                      <span>{m.user_id}</span>
                    </td>
                    <td className="py-3">
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as any)}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-[11px] text-slate-900 dark:text-white"
                      >
                        <option value="owner">Owner</option>
                        <option value="manager">Manager</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="py-3 text-slate-400 text-[11px] font-mono">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Remove Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: GENERATE API KEY
      ===================================================================== */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <span>Create New API Key</span>
              </h3>
              <button
                onClick={() => setShowNewKeyModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateApiKey} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Key Name</label>
                <input
                  type="text"
                  placeholder="e.g. Production Ingestion or Claude Desktop Agent"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Permissions & Scopes</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedScopes.includes('*')) {
                        setSelectedScopes(['campaigns:read', 'prospects:read']);
                      } else {
                        setSelectedScopes(['*']);
                      }
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {selectedScopes.includes('*') ? 'Select Specific Scopes' : 'Grant Full Access (*)'}
                  </button>
                </div>

                {selectedScopes.includes('*') ? (
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs">
                    Key will have full workspace administrative read and write scopes across all modules.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                    {ALL_SCOPES.map((sc) => {
                      const isChecked = selectedScopes.includes(sc.id);
                      return (
                        <label
                          key={sc.id}
                          className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedScopes((prev) => [...prev.filter((s) => s !== '*'), sc.id]);
                              } else {
                                setSelectedScopes((prev) => prev.filter((s) => s !== sc.id));
                              }
                            }}
                            className="mt-0.5 rounded text-indigo-600"
                          />
                          <div>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block text-[11px]">
                              {sc.label}
                            </span>
                            <span className="text-[10px] text-slate-400">{sc.desc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewKeyModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingKey}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer transition shadow-sm"
                >
                  {creatingKey ? 'Generating...' : 'Create API Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ADD WEBHOOK
      ===================================================================== */}
      {showNewWebhookModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Webhook className="w-4 h-4 text-indigo-600" />
                <span>Register Webhook Endpoint</span>
              </h3>
              <button
                onClick={() => setShowNewWebhookModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateWebhook} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Endpoint Destination URL</label>
                <input
                  type="url"
                  placeholder="https://api.yourcompany.com/webhooks/leadflow"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                />
                <span className="text-[11px] text-slate-400 block">
                  Must be public HTTPS (SSRF protected from internal/private IP blocks).
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Signing Secret (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate secure 32-byte secret"
                  value={newWebhookSecret}
                  onChange={(e) => setNewWebhookSecret(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Subscribed Events</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedEvents.includes('*')) {
                        setSelectedEvents(['email.sent', 'reply.received']);
                      } else {
                        setSelectedEvents(['*']);
                      }
                    }}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {selectedEvents.includes('*') ? 'Select Specific Events' : 'Subscribe to All (*)'}
                  </button>
                </div>

                {selectedEvents.includes('*') ? (
                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs">
                    Endpoint will receive dispatches for all outbound and reply events.
                  </div>
                ) : (
                  <div className="space-y-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                    {ALL_WEBHOOK_EVENTS.map((ev) => {
                      const isChecked = selectedEvents.includes(ev.id);
                      return (
                        <label
                          key={ev.id}
                          className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEvents((prev) => [...prev.filter((s) => s !== '*'), ev.id]);
                              } else {
                                setSelectedEvents((prev) => prev.filter((s) => s !== ev.id));
                              }
                            }}
                            className="rounded text-indigo-600"
                          />
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                            {ev.label}
                          </span>
                          <span className="text-[10px] text-slate-400">— {ev.desc}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewWebhookModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingWebhook}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer transition shadow-sm"
                >
                  {creatingWebhook ? 'Registering...' : 'Register Webhook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: UPGRADE PLAN
      ===================================================================== */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <span>Choose Your Outreach Suite Plan</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Section 7.3 Canonical Plans. Unlimited deliverability warmup across all tiers.
                </p>
              </div>

              {/* Monthly / Annual Toggle */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setBillingInterval('monthly')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    billingInterval === 'monthly'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingInterval('annual')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    billingInterval === 'annual'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>Annual</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Plans Tier Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {Object.values(plansMap).map((p) => {
                const isCurrent = plan.id === p.id;
                const price = billingInterval === 'annual' ? p.annualPriceUsd : p.monthlyPriceUsd;

                return (
                  <div
                    key={p.id}
                    className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                      isCurrent
                        ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {p.name}
                        </h4>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                            Current
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1 font-mono">
                        <span className="text-3xl font-black text-slate-900 dark:text-white">
                          ${price}
                        </span>
                        <span className="text-xs text-slate-400">
                          / month
                        </span>
                      </div>

                      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span><strong>{p.mailboxLimit}</strong> Inboxes included</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span><strong>{p.monthlySendLimit.toLocaleString()}</strong> Emails / month</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span><strong>{p.verificationQuota.toLocaleString()}</strong> Verifications / month</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>Peer-to-Peer Warmup Engine</span>
                        </div>
                        {p.features?.conditional_branching && (
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-purple-500 shrink-0" />
                            <span>Conditional Branching & A–Z</span>
                          </div>
                        )}
                        {p.features?.auto_optimize && (
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-purple-500 shrink-0" />
                            <span>Bayesian Auto-Optimization</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isCurrent || upgrading}
                      onClick={() => handleUpgradePlan(p.id)}
                      className={`mt-6 w-full py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {isCurrent ? 'Current Plan' : isTestMode ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
