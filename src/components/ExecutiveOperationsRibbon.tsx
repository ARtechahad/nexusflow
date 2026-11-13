import React from 'react';
import {
  Kanban,
  Send,
  Coins,
  CheckCircle2,
  ArrowUpRight,
  Lock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateCommission } from '../data/sopContent';
import { useOutreachTelemetry } from '../hooks/useOutreachTelemetry';

export const ExecutiveOperationsRibbon: React.FC = () => {
  const {
    projects,
    formatMoney,
    automatedTestsPassedCount,
    databaseStatus,
    activeTab,
    setActiveTab,
    role
  } = useApp();

  const outreach = useOutreachTelemetry();

  if (role === 'client_guest') {
    return null;
  }

  const isCollaborator = role === 'collaborator';
  const canOpenCommissions = ['admin', 'bd_head', 'sales'].includes(role);
  const canOpenOutreach = ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer'].includes(role);
  const canOpenSop = ['admin', 'bd_head', 'coordinator', 'developer'].includes(role);

  // 1. Live Deals Pipeline Telemetry
  const totalPipelineValue = projects.reduce((acc, p) => acc + (p.finalPrice || p.estimatedPrice || 0), 0);
  const advancesCleared = projects.filter(p => p.advancePaid).length;
  const inStaging = projects.filter(
    p => !p.domainTransferred && (p.internalQAPassed || p.status === 'staging_dev' || p.status === 'client_review')
  ).length;

  // 2. Commission Ledger Telemetry
  const commissionTotals = projects.reduce(
    (acc, p) => {
      const value = p.finalPrice || p.estimatedPrice || 0;
      const calc = calculateCommission(value);
      const comm = p.commissionAmount && p.commissionAmount > 0 ? p.commissionAmount : calc.amount;
      acc.total += comm;
      if (p.balancePaid || p.status === 'completed' || p.status === 'transferred') {
        acc.cleared += comm;
      } else {
        acc.pending += comm;
      }
      return acc;
    },
    { total: 0, cleared: 0, pending: 0 }
  );

  return (
    <section
      aria-label="Executive Operations Telemetry Ribbon"
      className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a192f] transition-colors"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-px bg-slate-200 dark:bg-slate-800 border-x border-slate-200/70 dark:border-slate-800/70">
          {/* TELEMETRY CELL 1: LIVE DEALS PIPELINE */}
          <button
            type="button"
            onClick={() => setActiveTab('pipeline')}
            className={`xl:col-span-3 text-left px-4 py-2.5 transition flex items-center justify-between gap-3 cursor-pointer ${
              activeTab === 'pipeline'
                ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
                : 'bg-white dark:bg-[#0a192f] hover:bg-slate-50 dark:hover:bg-slate-900/70'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <Kanban className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">Live Deals Pipeline</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-sm font-bold text-slate-950 dark:text-white font-mono tabular-nums tracking-tight">
                  {formatMoney(totalPipelineValue)}
                </span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                  {projects.length} {projects.length === 1 ? 'deal' : 'deals'}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0 space-y-0.5">
              <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-200 font-mono tabular-nums">
                {advancesCleared}/{projects.length} Adv
              </div>
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                {inStaging} Staging
              </div>
            </div>
          </button>

          {/* TELEMETRY CELL 2: COLD OUTREACH STATS */}
          <button
            type="button"
            onClick={() => canOpenOutreach && setActiveTab('outreach_suite')}
            disabled={!canOpenOutreach}
            className={`xl:col-span-3 text-left px-4 py-2.5 transition flex items-center justify-between gap-3 ${
              canOpenOutreach ? 'cursor-pointer' : 'cursor-default opacity-80'
            } ${
              activeTab === 'outreach_suite'
                ? 'bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'bg-white dark:bg-[#0a192f] hover:bg-slate-50 dark:hover:bg-slate-900/70'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <Send className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Cold Outreach Stats</span>
              </div>

              {outreach.loading ? (
                <div className="mt-1.5 h-4 w-28 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : outreach.postgresConnected === false ? (
                <div className="mt-1 text-xs font-semibold text-amber-800 dark:text-amber-300 truncate">
                  Outreach DB Offline
                </div>
              ) : (
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-slate-950 dark:text-white font-mono tabular-nums tracking-tight">
                    {outreach.sentToday}
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      /{outreach.dailyCapacity || 0}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    sent today
                  </span>
                </div>
              )}
            </div>

            <div className="text-right shrink-0 space-y-0.5">
              <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {outreach.analytics ? `${outreach.analytics.replyRate.toFixed(1)}%` : '0.0%'} Reply
              </div>
              <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                {outreach.activeMailboxesCount} Box &bull; {outreach.activeCampaignsCount} Camp
              </div>
            </div>
          </button>

          {/* TELEMETRY CELL 3: COMMISSION LEDGER */}
          <button
            type="button"
            onClick={() => canOpenCommissions && setActiveTab('commissions')}
            disabled={!canOpenCommissions || isCollaborator}
            className={`xl:col-span-3 text-left px-4 py-2.5 transition flex items-center justify-between gap-3 ${
              canOpenCommissions && !isCollaborator ? 'cursor-pointer' : 'cursor-default'
            } ${
              activeTab === 'commissions'
                ? 'bg-amber-50/50 dark:bg-amber-950/30'
                : 'bg-white dark:bg-[#0a192f] hover:bg-slate-50 dark:hover:bg-slate-900/70'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <Coins className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">Commission Ledger</span>
              </div>

              {isCollaborator ? (
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Masked (Partner NDA)</span>
                </div>
              ) : (
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-slate-950 dark:text-white font-mono tabular-nums tracking-tight">
                    {formatMoney(commissionTotals.total)}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    SOP pool
                  </span>
                </div>
              )}
            </div>

            {!isCollaborator && (
              <div className="text-right shrink-0 space-y-0.5">
                <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                  {formatMoney(commissionTotals.cleared)} Cleared
                </div>
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  {formatMoney(commissionTotals.pending)} Escrow
                </div>
              </div>
            )}
          </button>

          {/* TELEMETRY CELL 4: SOP GATE & PERSISTENCE */}
          <div className="xl:col-span-3 px-4 py-2.5 bg-white dark:bg-[#0a192f] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">SOP Gate &amp; Storage</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
                  {automatedTestsPassedCount}/17 Passed
                </span>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {databaseStatus?.engine === 'postgresql' ? 'Neon PG' : 'Local Sync'}
                </span>
              </div>
            </div>

            {canOpenSop && activeTab !== 'sop' && (
              <button
                type="button"
                onClick={() => setActiveTab('sop')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-[11px] font-semibold transition cursor-pointer shrink-0"
              >
                <span>SOP</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
