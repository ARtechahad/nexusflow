import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Plus,
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Server,
  ShieldCheck,
  RefreshCw,
  X,
  Clock,
  Users
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ConnectedEmailAccount,
  EmailCampaignRecord,
  EmailDeliveryLog
} from '../types';

export const EmailOutreachView: React.FC = () => {
  const { authToken, currentTenant, showToast } = useApp();

  const [accounts, setAccounts] = useState<ConnectedEmailAccount[]>([]);
  const [resendConfigured, setResendConfigured] = useState<boolean>(false);
  const [campaigns, setCampaigns] = useState<EmailCampaignRecord[]>([]);
  const [summary, setSummary] = useState({
    totalCampaigns: 0,
    totalRecipients: 0,
    totalSent: 0,
    totalFailed: 0
  });
  const [loading, setLoading] = useState<boolean>(false);

  // Connect Business Email Modal
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [provider, setProvider] = useState<'smtp' | 'resend'>('smtp');
  const [senderName, setSenderName] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>('');
  const [smtpHost, setSmtpHost] = useState<string>('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState<string>('587');
  const [smtpUsername, setSmtpUsername] = useState<string>('');
  const [smtpPassword, setSmtpPassword] = useState<string>('');
  const [connecting, setConnecting] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // 3-Step Campaign Launcher
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [recipientsRaw, setRecipientsRaw] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [sendingCampaign, setSendingCampaign] = useState<boolean>(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [latestLogs, setLatestLogs] = useState<EmailDeliveryLog[] | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  const buildHeaders = useCallback(
    (extra?: Record<string, string>) => ({
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(currentTenant?.id ? { 'X-Tenant-Id': currentTenant.id } : {}),
      ...(extra || {})
    }),
    [authToken, currentTenant?.id]
  );

  const loadData = useCallback(async () => {
    if (!authToken || !currentTenant?.id) return;
    setLoading(true);
    try {
      const [accRes, campRes] = await Promise.all([
        fetch('/api/email-outreach/accounts', { headers: buildHeaders() }),
        fetch('/api/email-outreach/campaigns', { headers: buildHeaders() })
      ]);

      if (accRes.ok) {
        const accData = await accRes.json();
        const list: ConnectedEmailAccount[] = Array.isArray(accData.accounts) ? accData.accounts : [];
        setAccounts(list);
        setResendConfigured(Boolean(accData.resendConfigured));
        setSelectedAccountId((prev) => {
          if (prev && list.some((a) => a.id === prev)) return prev;
          return list[0]?.id || '';
        });
      }

      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(Array.isArray(campData.campaigns) ? campData.campaigns : []);
        if (campData.summary) {
          setSummary(campData.summary);
        }
      }
    } catch (err) {
      console.warn('Could not load email outreach data', err);
    } finally {
      setLoading(false);
    }
  }, [authToken, currentTenant?.id, buildHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetConnectForm = () => {
    setSenderName('');
    setSenderEmail('');
    setSmtpHost('smtp.gmail.com');
    setSmtpPort('587');
    setSmtpUsername('');
    setSmtpPassword('');
    setConnectError(null);
  };

  const handleConnectAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    setConnecting(true);

    const payload =
      provider === 'smtp'
        ? {
            provider: 'smtp' as const,
            senderName: senderName.trim(),
            email: senderEmail.trim(),
            smtpHost: smtpHost.trim(),
            smtpPort: Number(smtpPort) || 587,
            username: smtpUsername.trim() || undefined,
            password: smtpPassword
          }
        : {
            provider: 'resend' as const,
            senderName: senderName.trim(),
            email: senderEmail.trim()
          };

    try {
      const res = await fetch('/api/email-outreach/accounts', {
        method: 'POST',
        headers: buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.account) {
        showToast(data.message || 'Business email verified and connected.', 'success');
        setIsConnectModalOpen(false);
        resetConnectForm();
        await loadData();
        setSelectedAccountId(data.account.id);
      } else {
        setConnectError(data.error || data.message || 'Verification failed. Check your credentials.');
      }
    } catch {
      setConnectError('Network error verifying email account.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectAccount = async (account: ConnectedEmailAccount) => {
    try {
      const res = await fetch(`/api/email-outreach/accounts/${encodeURIComponent(account.id)}`, {
        method: 'DELETE',
        headers: buildHeaders()
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(`Disconnected ${account.email}.`, 'info');
        await loadData();
      } else {
        showToast(data.error || 'Could not remove account.', 'error');
      }
    } catch {
      showToast('Network error disconnecting email account.', 'error');
    }
  };

  const estimatedRecipientCount = recipientsRaw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes('@')).length;

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCampaignError(null);
    setLatestLogs(null);

    if (!selectedAccountId) {
      setCampaignError('Select a connected business email account in Step 1 first.');
      return;
    }

    setSendingCampaign(true);
    try {
      const res = await fetch('/api/email-outreach/campaigns/send', {
        method: 'POST',
        headers: buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          accountId: selectedAccountId,
          recipientsRaw,
          subject,
          body
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast(data.message || 'Campaign processed.', data.campaign?.failedCount > 0 ? 'warning' : 'success');
        setLatestLogs(Array.isArray(data.deliveryLogs) ? data.deliveryLogs : []);
        if (data.campaign?.sentCount > 0 && data.campaign?.failedCount === 0) {
          setRecipientsRaw('');
          setSubject('');
          setBody('');
        }
        await loadData();
      } else {
        setCampaignError(data.error || data.message || 'Failed to send campaign.');
      }
    } catch {
      setCampaignError('Network error dispatching campaign.');
    } finally {
      setSendingCampaign(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{currentTenant?.name || 'Workspace'}</span>
              <span>&middot;</span>
              <span>Real SMTP &amp; Resend Dispatch</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
              Email Outreach
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Connect a verified business mailbox via SMTP / Gmail App Password or Resend, then send personalized campaigns.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              id="btn-connect-business-email"
              onClick={() => {
                resetConnectForm();
                setIsConnectModalOpen(true);
              }}
              className="btn-tactile-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Business Email</span>
            </button>
          </div>
        </div>

        {/* Real Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Connected Mailboxes
            </span>
            <span className="text-xl font-bold text-slate-950 dark:text-white font-mono tabular-nums">
              {accounts.length}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Campaigns Sent
            </span>
            <span className="text-xl font-bold text-slate-950 dark:text-white font-mono tabular-nums">
              {summary.totalCampaigns}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Emails Delivered
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              {summary.totalSent}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Failed Deliveries
            </span>
            <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {summary.totalFailed}
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: Connected Accounts + 3-Step Campaign Launcher */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Connected Business Emails (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Server className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Connected Accounts</span>
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Verified SMTP &amp; Resend senders
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetConnectForm();
                  setIsConnectModalOpen(true);
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                + Add
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="py-8 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                <Mail className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  No business emails connected
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Connect your Gmail App Password, custom SMTP server, or verified Resend domain to start sending.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    resetConnectForm();
                    setIsConnectModalOpen(true);
                  }}
                  className="btn-tactile-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Connect Business Email</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {accounts.map((acc) => {
                  const isSelected = selectedAccountId === acc.id;
                  return (
                    <div
                      key={acc.id}
                      onClick={() => setSelectedAccountId(acc.id)}
                      className={`p-3.5 rounded-xl border transition cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-950 dark:text-white truncate">
                            {acc.senderName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">
                            {acc.email}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnectAccount(acc);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded cursor-pointer shrink-0"
                          title="Disconnect mailbox"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>
                          {acc.provider === 'smtp'
                            ? `SMTP · ${acc.smtpHost}:${acc.smtpPort}`
                            : 'Resend API'}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Verified
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Simple 3-Step Campaign Launcher (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <form
            onSubmit={handleSendCampaign}
            className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xs space-y-5"
          >
            <div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>3-Step Campaign Launcher</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dispatch real emails using your verified mailbox with optional {'{{name}}'} personalization.
              </p>
            </div>

            {campaignError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{campaignError}</span>
              </div>
            )}

            {/* Step 1: Select Connected Mailbox */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Step 1 &middot; Select Connected Mailbox
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={accounts.length === 0}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white cursor-pointer"
              >
                {accounts.length === 0 ? (
                  <option value="">Connect a business email account first...</option>
                ) : (
                  accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.senderName} &lt;{acc.email}&gt; ({acc.provider.toUpperCase()})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Step 2: Recipients, Subject & Message */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                    Step 2 &middot; Recipients, Subject &amp; Message
                  </label>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {estimatedRecipientCount} detected
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={recipientsRaw}
                  onChange={(e) => setRecipientsRaw(e.target.value)}
                  placeholder={'Paste recipient emails separated by commas or new lines:\nalice@acme.com\nBob Smith <bob@company.io>'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-mono text-slate-950 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Quick question for {{name}}"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email Body
                  </label>
                  <button
                    type="button"
                    onClick={() => setBody((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}{{name}}`)}
                    className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    + Insert {'{{name}}'}
                  </button>
                </div>
                <textarea
                  rows={6}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={'Hi {{name}},\n\nWriting to share an update from our team...'}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Step 3: Send Campaign Now */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Step 3 &middot; Real SMTP / Resend delivery is logged immediately per recipient.
              </span>
              <button
                type="submit"
                id="btn-send-campaign-now"
                disabled={sendingCampaign || accounts.length === 0}
                className="btn-tactile-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingCampaign ? 'Sending Campaign...' : 'Send Campaign Now'}</span>
              </button>
            </div>

            {/* Latest Dispatch Result Table */}
            {latestLogs && latestLogs.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Latest Dispatch Results
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  {latestLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#090D16] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                    >
                      <div className="font-mono text-slate-800 dark:text-slate-200 truncate">
                        {log.recipientName} &lt;{log.recipientEmail}&gt;
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {log.status === 'sent' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Sent
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Failed: {log.errorReason || 'Error'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Campaign History & Delivery Logs */}
      <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Campaign Delivery History</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real send records and per-recipient outcomes scoped strictly to {currentTenant?.name}.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}
          </span>
        </div>

        {campaigns.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            No campaigns sent yet. Send your first campaign above to inspect real delivery logs.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {campaigns.map((camp) => {
              const isExpanded = expandedCampaignId === camp.id;
              return (
                <div key={camp.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-bold text-slate-950 dark:text-white truncate">
                        {camp.subject}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        From {camp.accountEmail} ({camp.provider.toUpperCase()}) &middot;{' '}
                        {new Date(camp.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
                      <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {camp.totalRecipients}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {camp.sentCount} sent
                      </span>
                      {camp.failedCount > 0 && (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          {camp.failedCount} failed
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedCampaignId(isExpanded ? null : camp.id)}
                        className="text-indigo-600 dark:text-indigo-400 font-sans font-semibold hover:underline cursor-pointer"
                      >
                        {isExpanded ? 'Hide Logs' : 'View Logs'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && camp.logs && camp.logs.length > 0 && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                      {camp.logs.map((log) => (
                        <div
                          key={log.id}
                          className="px-3 py-2 bg-[#F8FAFC] dark:bg-[#090D16] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]"
                        >
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {log.recipientName} &lt;{log.recipientEmail}&gt;
                          </span>
                          <span
                            className={
                              log.status === 'sent'
                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                : 'text-rose-600 dark:text-rose-400 font-semibold'
                            }
                          >
                            {log.status === 'sent'
                              ? `Sent (${new Date(log.sentAt).toLocaleTimeString()})`
                              : `Failed: ${log.errorReason || 'Delivery rejected'}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: + Connect Business Email */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Connect Business Email
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Credentials are verified live before saving and encrypted at rest.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Provider Segmented Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setProvider('smtp');
                  setConnectError(null);
                }}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition cursor-pointer ${
                  provider === 'smtp'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                SMTP / Gmail App Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setProvider('resend');
                  setConnectError(null);
                }}
                className={`py-2 px-3 rounded-md text-xs font-semibold transition cursor-pointer ${
                  provider === 'resend'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Company Domain via Resend
              </button>
            </div>

            {connectError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{connectError}</span>
              </div>
            )}

            <form onSubmit={handleConnectAccount} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sender Name
                  </label>
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder={provider === 'smtp' ? 'you@gmail.com' : 'hello@yourdomain.com'}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                  />
                </div>
              </div>

              {provider === 'smtp' ? (
                <>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Presets:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSmtpHost('smtp.gmail.com');
                        setSmtpPort('587');
                      }}
                      className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      Gmail (587)
                    </button>
                    <span className="text-slate-300">&middot;</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSmtpHost('smtp.office365.com');
                        setSmtpPort('587');
                      }}
                      className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      Microsoft 365 (587)
                    </button>
                    <span className="text-slate-300">&middot;</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSmtpHost('smtp.zoho.com');
                        setSmtpPort('465');
                      }}
                      className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                    >
                      Zoho (465)
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        required
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-mono text-slate-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Port
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={65535}
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="587"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-mono text-slate-950 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      SMTP Username (Optional — defaults to Email Address)
                    </label>
                    <input
                      type="text"
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder={senderEmail || 'you@company.com'}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-mono text-slate-950 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Password / Gmail App Password
                    </label>
                    <input
                      type="password"
                      required
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder="16-character App Password or SMTP password"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-mono text-slate-950 dark:text-white"
                    />
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Resend Domain Delivery
                  </div>
                  <p>
                    {resendConfigured
                      ? 'Resend API key detected on the server. Enter a sender email from your verified Resend domain.'
                      : 'RESEND_API_KEY is not currently configured in server environment variables. Configure RESEND_API_KEY or use SMTP / Gmail App Password instead.'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="btn-tactile-secondary px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="btn-tactile-primary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {connecting
                    ? provider === 'smtp'
                      ? 'Verifying SMTP...'
                      : 'Connecting...'
                    : 'Verify & Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
