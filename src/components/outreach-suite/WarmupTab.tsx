import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
  Send,
  Inbox,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Lock,
  Unlock,
  Radio,
  FileText
} from 'lucide-react';
import {
  getWarmupOverview,
  updateWarmupSettings,
  submitWarmupConsent,
  getWarmupStats,
  generateWarmupContentAI,
  triggerWarmupPlanner,
  testSimulateSpam,
  WarmupMailboxOverview,
  WarmupOverviewResponse,
  WarmupStatsPoint
} from '../../services/outreachService';

interface WarmupTabProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isAdmin?: boolean;
}

export const WarmupTab: React.FC<WarmupTabProps> = ({ showToast, isAdmin = true }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<WarmupOverviewResponse | null>(null);
  const [selectedStatsMbx, setSelectedStatsMbx] = useState<string | null>(null);
  const [statsSeries, setStatsSeries] = useState<WarmupStatsPoint[]>([]);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});
  const [generatingContent, setGeneratingContent] = useState<boolean>(false);
  const [runningPlanner, setRunningPlanner] = useState<boolean>(false);
  const [simulatingSpam, setSimulatingSpam] = useState<string | null>(null);

  // Consent modal state
  const [consentTargetMbx, setConsentTargetMbx] = useState<WarmupMailboxOverview | null>(null);
  const [consentAgreed, setConsentAgreed] = useState<boolean>(false);
  const [savingConsent, setSavingConsent] = useState<boolean>(false);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getWarmupOverview();
      setData(res);
    } catch (err: any) {
      showToast(err?.message || 'Failed to fetch warmup status', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleToggleEnabled = async (mbx: WarmupMailboxOverview) => {
    // If not opted in yet, show consent modal
    if (!mbx.warmup_terms_accepted && !mbx.warmup_enabled) {
      setConsentTargetMbx(mbx);
      setConsentAgreed(false);
      return;
    }

    try {
      const nextState = !mbx.warmup_enabled;
      await updateWarmupSettings(mbx.id, { warmup_enabled: nextState });
      showToast(`Warmup ${nextState ? 'enabled' : 'disabled'} for ${mbx.email}`, 'success');
      fetchOverview();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update warmup state', 'error');
    }
  };

  const handleTogglePause = async (mbx: WarmupMailboxOverview) => {
    try {
      const nextPause = !mbx.warmup_paused;
      await updateWarmupSettings(mbx.id, { warmup_paused: nextPause });
      showToast(`Warmup ${nextPause ? 'paused' : 'resumed'} for ${mbx.email}`, 'info');
      fetchOverview();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update pause state', 'error');
    }
  };

  const handleSettingChange = async (
    mailboxId: string,
    key: 'warmup_mode' | 'warmup_speed' | 'warmup_target',
    value: any
  ) => {
    try {
      await updateWarmupSettings(mailboxId, { [key]: value });
      showToast('Warmup configuration updated', 'success');
      fetchOverview();
    } catch (err: any) {
      showToast(err?.message || 'Update failed', 'error');
    }
  };

  const handleAcceptConsent = async () => {
    if (!consentTargetMbx || !consentAgreed) return;
    try {
      setSavingConsent(true);
      await submitWarmupConsent(consentTargetMbx.id, true);
      // Also enable warmup now that consent is recorded
      await updateWarmupSettings(consentTargetMbx.id, { warmup_enabled: true });
      showToast('Terms accepted and warmup enabled', 'success');
      setConsentTargetMbx(null);
      fetchOverview();
    } catch (err: any) {
      showToast(err?.message || 'Failed to record consent', 'error');
    } finally {
      setSavingConsent(false);
    }
  };

  const handleOpenStats = async (mbxId: string) => {
    try {
      setSelectedStatsMbx(mbxId);
      setStatsLoading(true);
      const res = await getWarmupStats(mbxId);
      setStatsSeries(res.series || []);
    } catch (err: any) {
      showToast(err?.message || 'Failed to load warmup history', 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleGenerateAIContent = async () => {
    try {
      setGeneratingContent(true);
      const res = await generateWarmupContentAI();
      showToast(res.message || '100 AI warmup items generated and saved!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate AI warmup content', 'error');
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleRunPlanner = async () => {
    try {
      setRunningPlanner(true);
      const res = await triggerWarmupPlanner();
      showToast(
        res.result?.poolTooSmall
          ? 'Planner ran: pool has fewer than 2 eligible mailboxes.'
          : `Planner completed: scheduled ${res.result?.createdJobs ?? 0} warmup emails`,
        'success'
      );
      fetchOverview();
    } catch (err: any) {
      showToast(err?.message || 'Planner run failed', 'error');
    } finally {
      setRunningPlanner(false);
    }
  };

  const handleSimulateHighSpam = async (mailboxId: string) => {
    try {
      setSimulatingSpam(mailboxId);
      const res = await testSimulateSpam(mailboxId, 16.0);
      showToast(
        `Simulated 16% spam landing: pool excluded = ${res.targetResult?.poolExcluded}, target = ${res.targetResult?.target}`,
        'info'
      );
      fetchOverview();
    } catch (err: any) {
      showToast(err?.message || 'Simulation failed', 'error');
    } finally {
      setSimulatingSpam(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-12 text-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading peer-to-peer warmup network...</p>
      </div>
    );
  }

  const pool = data?.network_pool;
  const mailboxes = data?.mailboxes || [];

  return (
    <div className="space-y-6">
      {/* 1. Header & Pool Status Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                <Flame className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Peer-to-Peer Warmup Engine
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <Radio className="w-3 h-3 animate-pulse" />
                Phase 4 Live
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Safe, authentic peer email exchange exclusively between verified opt-in mailboxes. Automatically rescues spam landings to INBOX, manages natural human thread replies, and ramps deliverability safely. Real prospects are never contacted.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleRunPlanner}
              disabled={runningPlanner}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
              title="Spread today's warmup sends with >=4 min jitter"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${runningPlanner ? 'animate-spin' : ''}`} />
              Run Planner
            </button>

            {isAdmin && (
              <button
                onClick={handleGenerateAIContent}
                disabled={generatingContent}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xs transition-all disabled:opacity-50"
                title="Generates 100 new varied subjects, openers, bodies, and replies using Gemini 3.8 Flash"
              >
                <Sparkles className={`w-3.5 h-3.5 ${generatingContent ? 'animate-spin' : ''}`} />
                {generatingContent ? 'Generating 100 Items...' : 'Generate AI Content'}
              </button>
            )}

            <button
              onClick={fetchOverview}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Refresh overview"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Network Pool Readiness Banner */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                pool?.is_ready ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Network Pool Status:
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              {pool?.total_active_mailboxes ?? 0} active participating {pool?.total_active_mailboxes === 1 ? 'mailbox' : 'mailboxes'} in network
            </span>
          </div>

          {pool?.warning && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{pool.warning}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Mailboxes List */}
      {mailboxes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <Flame className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">
            No Connected Mailboxes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Connect mailboxes in the Mailboxes tab to enable peer-to-peer warmup and build spam-filter sender reputation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {mailboxes.map((mbx) => {
            const isExcluded = mbx.pool_excluded;
            const reasonsOpen = expandedReasons[mbx.id] ?? false;

            // Health color
            let healthColor = 'text-emerald-600 dark:text-emerald-400 stroke-emerald-500';
            let healthBg = 'bg-emerald-50 dark:bg-emerald-950/50';
            if (mbx.health_score < 65) {
              healthColor = 'text-rose-600 dark:text-rose-400 stroke-rose-500';
              healthBg = 'bg-rose-50 dark:bg-rose-950/50';
            } else if (mbx.health_score < 85) {
              healthColor = 'text-amber-600 dark:text-amber-400 stroke-amber-500';
              healthBg = 'bg-amber-50 dark:bg-amber-950/50';
            }

            return (
              <div
                key={mbx.id}
                className={`rounded-2xl border transition-all ${
                  isExcluded
                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                } p-6 shadow-xs space-y-6`}
              >
                {/* Mailbox Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Health Ring Gauge */}
                    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                      <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 36 36">
                        <path
                          className="text-slate-100 dark:text-slate-800"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={healthColor}
                          strokeDasharray={`${mbx.health_score}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {Math.round(mbx.health_score)}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                          Health
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {mbx.email}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {mbx.provider}
                        </span>
                        {mbx.domain_name && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            @{mbx.domain_name}
                          </span>
                        )}

                        {isExcluded ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                            <ShieldAlert className="w-3 h-3" />
                            Pool Excluded (Spam ≥ 15%)
                          </span>
                        ) : mbx.warmup_paused ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                            <Pause className="w-3 h-3" />
                            Paused
                          </span>
                        ) : mbx.warmup_enabled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Active Warming
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Sending Day {mbx.sending_day_number} (Age: {mbx.warmup_age_days}d)
                        </span>

                        <span className="flex items-center gap-1">
                          {mbx.unlocked_full_target ? (
                            <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 font-medium">
                              <Unlock className="w-3.5 h-3.5" />
                              Full Target Unlocked
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 inline-flex items-center gap-1 font-medium">
                              <Lock className="w-3.5 h-3.5" />
                              Ramping Mode
                            </span>
                          )}
                        </span>

                        <span className="flex items-center gap-1.5">
                          DNS:
                          <span className={mbx.dns.hasSpf ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                            SPF {mbx.dns.hasSpf ? '✓' : '✗'}
                          </span>
                          <span className={mbx.dns.hasDkim ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                            DKIM {mbx.dns.hasDkim ? '✓' : '✗'}
                          </span>
                          <span className={mbx.dns.hasDmarc ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                            DMARC {mbx.dns.hasDmarc ? '✓' : '—'}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleOpenStats(mbx.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      14-Day History
                    </button>

                    {mbx.warmup_enabled && (
                      <button
                        onClick={() => handleTogglePause(mbx)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          mbx.warmup_paused
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                        }`}
                      >
                        {mbx.warmup_paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        {mbx.warmup_paused ? 'Resume' : 'Pause'}
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleEnabled(mbx)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        mbx.warmup_enabled
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      {mbx.warmup_enabled ? 'Disable' : 'Enable Warmup'}
                    </button>

                    <button
                      onClick={() => handleSimulateHighSpam(mbx.id)}
                      disabled={simulatingSpam === mbx.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                      title="Test helper: simulates 16% spam landing to verify automatic 50% volume cut & pool exclusion"
                    >
                      {simulatingSpam === mbx.id ? 'Simulating...' : 'Test 16% Spam'}
                    </button>
                  </div>
                </div>

                {/* Terms Consent Notice Banner if not agreed */}
                {!mbx.warmup_terms_accepted && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
                    <div className="space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        Warmup Network Participation Terms Required
                      </div>
                      <p className="text-amber-700 dark:text-amber-300">
                        Owner must accept the peer network terms to enable automated spam rescue, threading, and warmup sends.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setConsentTargetMbx(mbx);
                        setConsentAgreed(false);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shrink-0 shadow-xs transition-colors"
                    >
                      Review & Accept Terms
                    </button>
                  </div>
                )}

                {/* Progress & Rates Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Today Warmup Target
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">
                        {mbx.today_sent} / {mbx.today_target}
                      </span>
                      <span className="text-xs text-slate-500">sent today</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            mbx.today_target > 0 ? (mbx.today_sent / mbx.today_target) * 100 : 0
                          )}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Campaign Budget Share
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">
                        {mbx.today_campaign_sent}
                      </span>
                      <span className="text-xs text-slate-500">
                        campaigns / {mbx.daily_cap} cap
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Shared capacity: {Math.max(0, mbx.daily_cap - mbx.today_campaign_sent)} remaining
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      7-Day Inbox Placement
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        {mbx.inbox_rate_7d}%
                      </span>
                      <span className="text-xs text-slate-500">inbox</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Spam: {mbx.spam_rate_7d}% (penalty threshold: ≥5%)
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Received & Rescued
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">
                        {mbx.today_received}
                      </span>
                      <span className="text-xs text-slate-500">inbound peers</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Bounce rate: {mbx.bounce_rate_7d}%
                    </p>
                  </div>
                </div>

                {/* Configuration Controls (Mode, Speed, Target) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Warmup Ramp Mode
                    </label>
                    <select
                      value={mbx.warmup_mode}
                      onChange={(e) => handleSettingChange(mbx.id, 'warmup_mode', e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="new_domain">New Domain (Start 1, Ceil 40)</option>
                      <option value="new_mailbox">New Mailbox (Start 3, Ceil 60)</option>
                      <option value="dormant">Dormant (Start 3, Ceil 40)</option>
                      <option value="maintenance">Maintenance (Start 15, Ceil 30)</option>
                      <option value="recovery">Recovery (Start 5, Ceil 30)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Ramp Speed
                    </label>
                    <select
                      value={mbx.warmup_speed}
                      onChange={(e) => handleSettingChange(mbx.id, 'warmup_speed', e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="conservative">Conservative (+0.5 emails/sending day)</option>
                      <option value="normal">Normal (+1.0 emails/sending day)</option>
                      <option value="aggressive">Aggressive (+1.5 emails/sending day)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Target Volume: {mbx.warmup_target}/day
                      </label>
                      <span className="text-slate-400 text-[11px]">(Max 120)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="5"
                        max="120"
                        step="5"
                        value={mbx.warmup_target}
                        onChange={(e) => handleSettingChange(mbx.id, 'warmup_target', Number(e.target.value))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={mbx.warmup_target}
                        onChange={(e) => handleSettingChange(mbx.id, 'warmup_target', Number(e.target.value))}
                        className="w-16 text-xs text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* "Why is my volume lower?" Panel */}
                {mbx.reasons && mbx.reasons.length > 0 && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
                    <button
                      onClick={() =>
                        setExpandedReasons((prev) => ({
                          ...prev,
                          [mbx.id]: !reasonsOpen
                        }))
                      }
                      className="w-full flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300"
                    >
                      <span className="flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-amber-600" />
                        Why is my daily volume lower? ({mbx.reasons.length}{' '}
                        {mbx.reasons.length === 1 ? 'factor' : 'factors'} active)
                      </span>
                      {reasonsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {reasonsOpen && (
                      <ul className="space-y-1.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200/90 list-disc list-inside">
                        {mbx.reasons.map((r, i) => (
                          <li key={i} className="leading-relaxed">
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Consent Modal Dialog */}
      {consentTargetMbx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Warmup Network Participation Terms
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {consentTargetMbx.email}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/70 dark:border-slate-700/60">
              <p>
                <strong>Strict Peer-to-Peer Isolation:</strong> Warmup messages are exchanged exclusively between opted-in mailboxes inside the private LeadFlow peer network. Warmup emails are never dispatched to prospects, leads, or external addresses.
              </p>
              <p>
                <strong>Automated Spam Rescue:</strong> If a warmup message lands in your Spam or Junk folder, our IMAP worker will rescue it to your Primary INBOX and mark it as read and starred to build positive sender reputation with ESP algorithms.
              </p>
              <p>
                <strong>Natural Conversation Threads:</strong> With a 40% probability, our engine will automatically generate human-like contextual replies (up to depth 5) across multiple hours with randomized intervals to replicate authentic business dialogue.
              </p>
              <p>
                <strong>Data Privacy:</strong> All warmup headers (<code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700">X-Warmup-Tag</code>) ensure warmup emails are excluded from your campaigns, analytics, and CRM logs.
              </p>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <input
                type="checkbox"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 dark:text-slate-200 select-none">
                I agree to the Warmup Network Participation terms and authorize automated peer exchange, spam rescue, and reply threading for this mailbox.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConsentTargetMbx(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptConsent}
                disabled={!consentAgreed || savingConsent}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors disabled:opacity-50"
              >
                {savingConsent ? 'Enabling...' : 'Accept & Enable Warmup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 14-Day History Modal */}
      {selectedStatsMbx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  14-Day Deliverability & Health History
                </h3>
                <p className="text-xs text-slate-500">
                  Rolling daily performance and spam filter trajectory
                </p>
              </div>
              <button
                onClick={() => setSelectedStatsMbx(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 text-xs"
              >
                ✕ Close
              </button>
            </div>

            {statsLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading 14-day metrics...
              </div>
            ) : statsSeries.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                No past warmup telemetry recorded for this mailbox yet.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Sent</th>
                        <th className="pb-2 font-medium">Inbox</th>
                        <th className="pb-2 font-medium">Spam</th>
                        <th className="pb-2 font-medium">Rescued</th>
                        <th className="pb-2 font-medium">Health</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                      {statsSeries.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-2 font-mono text-[11px]">{row.date}</td>
                          <td className="py-2 font-semibold">{row.sent}</td>
                          <td className="py-2 text-emerald-600 dark:text-emerald-400 font-medium">
                            {row.inbox}
                          </td>
                          <td className="py-2 text-rose-500 font-medium">{row.spam}</td>
                          <td className="py-2 text-indigo-500">{row.rescued}</td>
                          <td className="py-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                row.health_score >= 85
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                  : row.health_score >= 65
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {Math.round(row.health_score)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
