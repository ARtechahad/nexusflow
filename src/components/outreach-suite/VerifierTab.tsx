import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Search,
  Upload,
  Download,
  Server,
  Mail,
  Zap,
  Globe,
  Plus,
  BarChart3,
  Sliders,
  Check,
  AlertCircle
} from 'lucide-react';
import {
  verifySingleEmailOnline,
  startBulkVerification,
  getVerificationBatchStatus,
  getVerificationQuotaInfo,
  addCustomDisposableDomain,
  EmailVerificationResult,
  VerificationBatchData,
  VerificationQuotaInfo
} from '../../services/outreachService';

interface VerifierTabProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
}

export const VerifierTab: React.FC<VerifierTabProps> = ({ showToast, isAdmin = true }) => {
  // Quota info
  const [quotaInfo, setQuotaInfo] = useState<VerificationQuotaInfo | null>(null);

  // Single verification state
  const [singleEmail, setSingleEmail] = useState<string>('');
  const [singleLoading, setSingleLoading] = useState<boolean>(false);
  const [singleResult, setSingleResult] = useState<EmailVerificationResult | null>(null);

  // Bulk verification state
  const [bulkInput, setBulkInput] = useState<string>('');
  const [activeBatch, setActiveBatch] = useState<VerificationBatchData | null>(null);
  const [batchPolling, setBatchPolling] = useState<boolean>(false);

  // Admin disposable domain state
  const [newDisposableDomain, setNewDisposableDomain] = useState<string>('');
  const [addingDomain, setAddingDomain] = useState<boolean>(false);

  // Load quota
  const loadQuota = useCallback(async () => {
    try {
      const data = await getVerificationQuotaInfo();
      setQuotaInfo(data);
    } catch {
      // Fallback display if not configured
      setQuotaInfo({ quota: 1000, used: 0, remaining: 1000 });
    }
  }, []);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  // Poll active bulk batch
  useEffect(() => {
    if (!activeBatch || activeBatch.status === 'completed' || activeBatch.status === 'failed') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await getVerificationBatchStatus(activeBatch.id);
        setActiveBatch(updated);
        if (updated.status === 'completed' || updated.status === 'failed') {
          clearInterval(interval);
          setBatchPolling(false);
          loadQuota();
          if (updated.status === 'completed') {
            showToast(`Bulk verification completed: ${updated.processed} emails processed`, 'success');
          }
        }
      } catch {
        clearInterval(interval);
        setBatchPolling(false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeBatch, showToast, loadQuota]);

  // Handle single verification
  const handleSingleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleEmail.trim()) {
      showToast('Please enter an email address', 'error');
      return;
    }

    setSingleLoading(true);
    setSingleResult(null);
    try {
      const res = await verifySingleEmailOnline(singleEmail.trim());
      setSingleResult(res);
      loadQuota();
    } catch (err: any) {
      showToast(err.message || 'Verification failed', 'error');
    } finally {
      setSingleLoading(false);
    }
  };

  // Handle bulk verification submit
  const handleStartBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawList = bulkInput
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'));

    if (rawList.length === 0) {
      showToast('Please enter at least one valid email address', 'error');
      return;
    }

    setBatchPolling(true);
    try {
      const res = await startBulkVerification({ emails: rawList });
      showToast(`Batch queued (${res.total} emails). Processing...`, 'success');
      // Fetch initial batch state
      const initial = await getVerificationBatchStatus(res.batchId);
      setActiveBatch(initial);
    } catch (err: any) {
      showToast(err.message || 'Failed to start bulk verification', 'error');
      setBatchPolling(false);
    }
  };

  // Download Bulk Results as CSV
  const handleDownloadCsv = () => {
    if (!activeBatch || !activeBatch.results || activeBatch.results.length === 0) {
      showToast('No results to export', 'error');
      return;
    }

    const headers = ['Email', 'Status', 'Reason', 'Syntax', 'Disposable', 'Role', 'MX', 'SMTP', 'Catch-All'];
    const lines = [headers.join(',')];

    for (const r of activeBatch.results) {
      const escape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      lines.push([
        escape(r.email),
        escape(r.status),
        escape(r.reason),
        escape(r.checks.syntax),
        escape(r.checks.disposable),
        escape(r.checks.role),
        escape(r.checks.mx),
        escape(r.checks.smtp),
        escape(r.checks.catchAll)
      ].join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verification-results-${activeBatch.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Add disposable domain
  const handleAddDisposable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisposableDomain.trim()) return;

    setAddingDomain(true);
    try {
      await addCustomDisposableDomain(newDisposableDomain.trim());
      showToast(`Added ${newDisposableDomain} to disposable blacklist`, 'success');
      setNewDisposableDomain('');
    } catch (err: any) {
      showToast(err.message || 'Failed to add disposable domain', 'error');
    } finally {
      setAddingDomain(false);
    }
  };

  const quotaPercent = quotaInfo
    ? Math.min(100, Math.round((quotaInfo.used / quotaInfo.quota) * 100))
    : 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Quota Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Module Title Card */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Deliverability & Email Verifier
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-lg">
              Multi-layered deliverability scanner: RFC syntax, 750+ disposable blacklist, role addresses, MX & A-record lookups, and catch-all detection.
            </p>
          </div>
          <div className="hidden sm:block">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
              <Zap className="w-3.5 h-3.5" />
              Active Protection
            </span>
          </div>
        </div>

        {/* Monthly Plan Quota Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Monthly Verification Quota
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {quotaInfo ? `${quotaInfo.used.toLocaleString()} / ${quotaInfo.quota.toLocaleString()}` : '—'}
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                quotaPercent > 90
                  ? 'bg-rose-500'
                  : quotaPercent > 70
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{quotaInfo?.remaining.toLocaleString()} remaining this month</span>
            <span>{quotaPercent}% used</span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Single Email Real-Time Verifier */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Single Address Instant Audit
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Live DNS Resolution</span>
          </div>

          <form onSubmit={handleSingleVerify} className="flex gap-2">
            <input
              type="email"
              placeholder="Enter email to inspect (e.g. alex@company.com)"
              value={singleEmail}
              onChange={(e) => setSingleEmail(e.target.value)}
              className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={singleLoading}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {singleLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          {/* Single Result Breakdown Card */}
          {singleResult && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {singleResult.email}
                  </div>
                  <div className="text-[11px] text-slate-500 capitalize">
                    Reason: {singleResult.reason.replace(/_/g, ' ')}
                  </div>
                </div>

                <div>
                  {singleResult.status === 'valid' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      Deliverable (Valid)
                    </span>
                  )}
                  {singleResult.status === 'risky' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4" />
                      Risky Address
                    </span>
                  )}
                  {singleResult.status === 'invalid' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                      <XCircle className="w-4 h-4" />
                      Undeliverable (Invalid)
                    </span>
                  )}
                  {singleResult.status === 'unknown' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <HelpCircle className="w-4 h-4" />
                      Unknown Status
                    </span>
                  )}
                </div>
              </div>

              {/* Typo Suggestion Box */}
              {singleResult.typoSuggestion && (
                <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs flex items-center justify-between">
                  <span className="text-indigo-700 dark:text-indigo-300">
                    Did you mean: <strong className="font-mono">{singleResult.typoSuggestion}</strong>?
                  </span>
                  <button
                    onClick={() => {
                      setSingleEmail(singleResult.typoSuggestion!);
                      setSingleResult(null);
                    }}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Use Suggestion
                  </button>
                </div>
              )}

              {/* Layered Checks Matrix */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">RFC Syntax</span>
                  {singleResult.checks.syntax ? (
                    <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                      <Check className="w-3.5 h-3.5" /> Pass
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1 font-semibold">
                      <XCircle className="w-3.5 h-3.5" /> Fail
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Disposable Domain</span>
                  {singleResult.checks.disposable ? (
                    <span className="text-rose-600 font-semibold">Detected</span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">Clean</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Role Address</span>
                  {singleResult.checks.role ? (
                    <span className="text-amber-600 font-semibold">Role-based</span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">Personal</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">MX DNS Record</span>
                  {singleResult.checks.mx ? (
                    <span className="text-emerald-600 font-semibold">Active</span>
                  ) : (
                    <span className="text-rose-600 font-semibold">No MX</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Catch-All Domain</span>
                  {singleResult.checks.catchAll === true ? (
                    <span className="text-amber-600 font-semibold">Catch-All</span>
                  ) : (
                    <span className="text-slate-500 font-medium">Standard / Unknown</span>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">SMTP Host Probe</span>
                  <span className="text-slate-500 font-medium">
                    {String(singleResult.checks.smtp)}
                  </span>
                </div>
              </div>

              {/* MX Hosts details */}
              {singleResult.mxRecords && singleResult.mxRecords.length > 0 && (
                <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    Target Mail Exchanges (MX):
                  </div>
                  {singleResult.mxRecords.slice(0, 2).map((mx, idx) => (
                    <div key={idx} className="truncate">
                      • {mx}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Bulk Verification & Queue Worker */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Bulk Verification & List Cleaning
              </h3>
            </div>
            {activeBatch && (
              <button
                onClick={handleDownloadCsv}
                disabled={!activeBatch.results || activeBatch.results.length === 0}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV
              </button>
            )}
          </div>

          <form onSubmit={handleStartBulk} className="space-y-3">
            <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Paste Emails (one per line, or comma-separated)
            </label>
            <textarea
              rows={4}
              placeholder="alex@acme.com&#10;sarah@enterprise.org&#10;info@startup.io&#10;sales@domain.co"
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Processed asynchronously in Postgres queue
              </span>
              <button
                type="submit"
                disabled={batchPolling}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
              >
                {batchPolling ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying...
                  </span>
                ) : (
                  'Run Bulk Verification'
                )}
              </button>
            </div>
          </form>

          {/* Active Batch Progress Banner */}
          {activeBatch && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Batch Status: <span className="uppercase text-indigo-600">{activeBatch.status}</span>
                </span>
                <span className="font-bold">
                  {activeBatch.processed} / {activeBatch.total}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{
                    width: `${Math.round((activeBatch.processed / Math.max(1, activeBatch.total)) * 100)}%`
                  }}
                />
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                  <div className="text-sm font-bold">{activeBatch.valid}</div>
                  <div className="text-[10px] uppercase font-semibold">Valid</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                  <div className="text-sm font-bold">{activeBatch.risky}</div>
                  <div className="text-[10px] uppercase font-semibold">Risky</div>
                </div>
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
                  <div className="text-sm font-bold">{activeBatch.invalid}</div>
                  <div className="text-[10px] uppercase font-semibold">Invalid</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <div className="text-sm font-bold">{activeBatch.unknown}</div>
                  <div className="text-[10px] uppercase font-semibold">Unknown</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin Disposable Domain Blacklist Section */}
      {isAdmin && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Globe className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Admin Disposable Domain Blacklist
              </h3>
              <p className="text-[11px] text-slate-500">
                750+ default temporary/disposable domains are bundled in <code>disposableDomains.json</code>. Add custom domains to the blacklist below.
              </p>
            </div>
          </div>

          <form onSubmit={handleAddDisposable} className="flex gap-2 max-w-md">
            <input
              type="text"
              placeholder="e.g. tempinbox-fake.org"
              value={newDisposableDomain}
              onChange={(e) => setNewDisposableDomain(e.target.value)}
              className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={addingDomain}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 shrink-0"
            >
              {addingDomain ? 'Adding...' : '+ Add Domain'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
