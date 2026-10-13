import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  CreditCard,
  Zap,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  Plus,
  Trash2,
  Mail,
  UserCheck,
  Check,
  RefreshCw,
  Globe,
  Sliders
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
  TenantPlanDetails,
  OutreachPlan,
  WorkspaceMember
} from '../../services/outreachService';

interface SettingsTabProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ showToast, isAdmin = true }) => {
  const [currentPlan, setCurrentPlan] = useState<TenantPlanDetails | null>(null);
  const [plansMap, setPlansMap] = useState<Record<string, OutreachPlan>>({});
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [upgrading, setUpgrading] = useState<boolean>(false);

  // Team workspace members
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState<string>('');
  const [newMemberRole, setNewMemberRole] = useState<'owner' | 'manager' | 'viewer'>('manager');
  const [addingMember, setAddingMember] = useState<boolean>(false);

  const loadSettingsData = useCallback(async () => {
    try {
      setLoading(true);
      const [planData, plansRes, membersRes] = await Promise.all([
        getCurrentTenantPlan(),
        getOutreachPlansList(),
        getWorkspaceMembers()
      ]);
      setCurrentPlan(planData);
      setPlansMap(plansRes.plans);
      setIsTestMode(plansRes.isTestMode);
      setMembers(membersRes);
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
        // Immediate test mode upgrade
        const updated = await testUpgradePlanManual(planKey, billingInterval);
        setCurrentPlan(updated);
        setShowUpgradeModal(false);
        showToast(`Successfully upgraded to ${updated.plan.name} (${billingInterval}) plan!`, 'success');
      } else {
        // Stripe Checkout redirect
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
      const res = await openCustomerPortalSession();
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to open customer portal', 'error');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail) return;

    setAddingMember(true);
    try {
      const added = await addWorkspaceMember(newMemberEmail, newMemberRole);
      setMembers([...members.filter((m) => m.id !== added.id), added]);
      setNewMemberEmail('');
      showToast(`Invited ${newMemberEmail} as ${newMemberRole}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add workspace member', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: 'owner' | 'manager' | 'viewer') => {
    try {
      await updateWorkspaceMemberRole(memberId, role);
      setMembers(members.map((m) => (m.id === memberId ? { ...m, role } : m)));
      showToast(`Updated role to ${role}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update role', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeWorkspaceMember(memberId);
      setMembers(members.filter((m) => m.id !== memberId));
      showToast('Removed member from workspace', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error');
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

        {/* Active Connected Mailboxes */}
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
              / {usage.mailboxesLimit} allowed
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${mailboxPct}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>{mailboxPct}% utilized</span>
            <span>{usage.mailboxesLimit - usage.mailboxesUsed} inboxes free</span>
          </div>
        </div>

        {/* Monthly Verifications */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">Monthly Verifications</span>
            <ShieldCheck className="w-4 h-4 text-blue-500" />
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
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${verifPct}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>{verifPct}% utilized</span>
            <span>{(usage.verificationsLimit - usage.verificationsUsed).toLocaleString()} remaining</span>
          </div>
        </div>
      </div>

      {/* Workspace Team Permissions Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
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
            className="flex-1 w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
          />
          <select
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
          >
            <option value="owner">Owner (Full Access & Billing)</option>
            <option value="manager">Manager (Create & Send Campaigns)</option>
            <option value="viewer">Viewer (Read-only Analytics)</option>
          </select>
          <button
            type="submit"
            disabled={addingMember}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all"
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
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold text-[11px]"
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
                      className="text-slate-400 hover:text-rose-600 transition-colors"
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

      {/* Upgrade Plan Modal */}
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
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs'
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
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-2xs'
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
                        {p.features.conditional_branching && (
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-purple-500 shrink-0" />
                            <span>Conditional Branching & A–Z</span>
                          </div>
                        )}
                        {p.features.auto_optimize && (
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
                      className={`mt-6 w-full py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm ${
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
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
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
