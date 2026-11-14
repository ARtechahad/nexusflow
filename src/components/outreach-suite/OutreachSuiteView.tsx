import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Flame,
  Globe2,
  Inbox,
  Layers,
  Lock,
  Mail,
  Play,
  RefreshCw,
  Send,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Zap
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { MailboxesTab } from './MailboxesTab';
import { CampaignsTab } from './CampaignsTab';
import { InboxTab } from './InboxTab';
import { WarmupTab } from './WarmupTab';
import { ProspectsTab } from './ProspectsTab';
import { VerifierTab } from './VerifierTab';
import { AnalyticsTab } from './AnalyticsTab';
import { SettingsTab } from './SettingsTab';
import {
  getOutreachHealth,
  getOutreachQueueStats,
  triggerTestJob,
  OutreachHealthResponse,
  OutreachQueueStats
} from '../../services/outreachService';

type OutreachTab =
  | 'dashboard'
  | 'mailboxes'
  | 'warmup'
  | 'campaigns'
  | 'prospects'
  | 'inbox'
  | 'verifier'
  | 'analytics'
  | 'settings';

export const OutreachSuiteView: React.FC = () => {
  const { showToast, role } = useApp();
  const [activeTab, setActiveTab] = useState<OutreachTab>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [health, setHealth] = useState<OutreachHealthResponse | null>(null);
  const [queueData, setQueueData] = useState<OutreachQueueStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggeringTest, setTriggeringTest] = useState<boolean>(false);

  const isAdmin = role === 'admin' || role === 'ceo' || role === 'bd_head';

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const healthRes = await getOutreachHealth();
      setHealth(healthRes);

      if (healthRes.postgresConnected && isAdmin) {
        try {
          const statsRes = await getOutreachQueueStats();
          setQueueData(statsRes);
        } catch (statsErr: any) {
          // If queue stats fail (e.g. auth or table issue), capture error
          setError(statsErr?.message || 'Failed to fetch queue statistics');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to Outreach Suite system endpoints');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleRunTestJob = async (shouldFail: boolean = false) => {
    setTriggeringTest(true);
    try {
      const res = await triggerTestJob(shouldFail);
      showToast?.(
        shouldFail
          ? `Simulated failing job enqueued (${res.jobId.slice(0, 12)}...). Will retry with exponential backoff.`
          : `Test job enqueued (${res.jobId.slice(0, 12)}...). Running via Postgres worker.`,
        'success'
      );
      // Refresh stats after a brief delay for worker processing
      setTimeout(() => loadData(true), 1500);
    } catch (err: any) {
      showToast?.(`Job trigger failed: ${err.message}`, 'error');
    } finally {
      setTriggeringTest(false);
    }
  };

  const tabs: { id: OutreachTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'mailboxes', label: 'Mailboxes', icon: Mail },
    { id: 'warmup', label: 'Warmup', icon: Flame },
    { id: 'campaigns', label: 'Campaigns', icon: Send },
    { id: 'prospects', label: 'Prospects', icon: Users },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'verifier', label: 'Verifier', icon: ShieldCheck },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between animate-pulse">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // 1. PostgreSQL Required State
  if (health && !health.postgresConnected) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Email Hub &amp; Mailbox Engine
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white mt-0.5">
              Connected Mailboxes &amp; Campaigns
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Connect company SMTP/IMAP mailboxes, verify deliverability, and manage outbound sequences.
            </p>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="btn-tactile-secondary inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Check Connection</span>
          </button>
        </div>

        <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-[#FFFFFF] dark:bg-[#111827] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
              <Database className="w-7 h-7" />
            </div>
            <div className="space-y-4 max-w-3xl">
              <div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white flex items-center gap-2.5 flex-wrap">
                  <span>PostgreSQL Database Required for Email Hub</span>
                  <span className="text-xs font-mono text-amber-700 dark:text-amber-300">
                    (ox_* schema pending)
                  </span>
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                  The <span className="font-semibold text-slate-950 dark:text-white">Email Hub</span> requires a persistent PostgreSQL connection to run row-level mailbox locking (<code>SELECT FOR UPDATE SKIP LOCKED</code>), preventing concurrent sends and enforcing ISP rate caps.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs space-y-2 border border-slate-800">
                <div className="text-slate-400">// Provide your PostgreSQL connection string in .env:</div>
                <div className="text-emerald-400">DATABASE_URL=&quot;postgresql://postgres:password@host:5432/dbname?sslmode=require&quot;</div>
                <div className="text-slate-400">// Ensure your 32-byte AES-256 encryption key is configured:</div>
                <div className="text-sky-400">ENCRYPTION_KEY=&quot;&lt;base64-encoded-32-byte-key&gt;&quot;</div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Deals pipeline, tasks, commission ledger, and client portal remain operational in local/cloud mode.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Active PostgreSQL Dashboard & Tabs
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            PostgreSQL Connected &bull; Email Hub Active
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white mt-0.5">
            Connected Mailboxes &amp; Campaigns
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage company SMTP/IMAP mailboxes, client threads, warmup, and outbound campaigns.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="btn-tactile-secondary inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 flex items-center gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* DASHBOARD TAB CONTENT */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Engine Health Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Queue Worker */}
            <div className="p-5 rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Durable Worker Loop</span>
                <Cpu className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-950 dark:text-white">
                  {queueData?.workerRunning ? 'Active' : 'Standby'}
                </span>
                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                  5s Interval
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Claims via <code>FOR UPDATE SKIP LOCKED</code>
              </p>
            </div>

            {/* Card 2: Pending Jobs */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Pending Jobs</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {queueData?.stats?.byStatus?.pending ?? 0}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">due or scheduled</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                In-flight: <span className="font-semibold">{queueData?.stats?.byStatus?.processing ?? 0}</span>
              </p>
            </div>

            {/* Card 3: Completed Jobs */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Completed Jobs</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {queueData?.stats?.byStatus?.completed ?? 0}
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">executed</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Total processed in Postgres
              </p>
            </div>

            {/* Card 4: Failed Jobs & Dead Letter */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Failed / Dead-Letter</span>
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {queueData?.stats?.byStatus?.failed ?? 0}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">max attempts exhausted</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Auto-recovers stuck locks &gt;10m
              </p>
            </div>
          </div>

          {/* Admin Queue Diagnostics & Test Runner Panel */}
          {isAdmin && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    Durable Queue Diagnostics & Test Runner
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Verify that background jobs are claimed atomically, retry with exponential backoff, and survive restarts.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunTestJob(false)}
                    disabled={triggeringTest}
                    className="btn-tactile-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Enqueue Test Job</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunTestJob(true)}
                    disabled={triggeringTest}
                    className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Simulate Retry Backoff</span>
                  </button>
                </div>
              </div>

              {/* Jobs by Type Breakdown */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                  Registered Job Types in Postgres Queue:
                </span>
                {queueData?.stats?.byType && Object.keys(queueData.stats.byType).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(queueData.stats.byType).map(([type, count]) => (
                      <div
                        key={type}
                        className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-2"
                      >
                        <span className="font-semibold">{type}</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px]">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No jobs recorded yet. Click "Enqueue Test Job" above to test the worker.</p>
                )}
              </div>
            </div>
          )}

          {/* Module Roadmap & Architectural Summary */}
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              Safety Architecture & Deliverability Guarantees Active
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">1. Encryption Guard</span>
                AES-256-GCM encryption with 12-byte IV for all SMTP credentials and OAuth tokens. Never logged or returned via API.
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">2. Scheduler-First Cap</span>
                Sends are scheduled through <code>ox_jobs</code>. No UI action or external API can bypass the Cap Guard daily limits.
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-1">3. Suppression Compliance</span>
                Hard bounces and unsubscribe requests automatically write to <code>ox_suppressions</code> to protect sender domain reputation.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAILBOXES TAB CONTENT */}
      {activeTab === 'mailboxes' && <MailboxesTab />}

      {/* CAMPAIGNS TAB CONTENT */}
      {activeTab === 'campaigns' && <CampaignsTab />}

      {/* INBOX TAB CONTENT (PHASE 3) */}
      {activeTab === 'inbox' && <InboxTab />}

      {/* WARMUP TAB CONTENT (PHASE 4) */}
      {activeTab === 'warmup' && (
        <WarmupTab showToast={showToast} isAdmin={role === 'admin'} />
      )}

      {/* PROSPECTS TAB CONTENT (PHASE 5) */}
      {activeTab === 'prospects' && (
        <ProspectsTab showToast={showToast} />
      )}

      {/* VERIFIER TAB CONTENT (PHASE 5) */}
      {activeTab === 'verifier' && (
        <VerifierTab showToast={showToast} isAdmin={role === 'admin'} />
      )}

      {/* ANALYTICS TAB CONTENT (PHASE 6) */}
      {activeTab === 'analytics' && (
        <AnalyticsTab showToast={showToast} />
      )}

      {/* SETTINGS & USAGE TAB CONTENT (PHASE 6) */}
      {activeTab === 'settings' && (
        <SettingsTab showToast={showToast} isAdmin={role === 'admin'} />
      )}
    </div>
  );
};
