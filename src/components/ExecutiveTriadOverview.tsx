import React from 'react';
import {
  Kanban,
  Send,
  Coins,
  ArrowUpRight,
  Plus,
  Mail,
  CheckCircle2,
  AlertCircle,
  Lock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateCommission } from '../data/sopContent';
import { useOutreachTelemetry } from '../hooks/useOutreachTelemetry';

export const ExecutiveTriadOverview: React.FC = () => {
  const {
    projects,
    formatMoney,
    setActiveTab,
    setIsNewLeadModalOpen,
    role
  } = useApp();

  const outreachState = useOutreachTelemetry();

  const totalPipelineValue = projects.reduce((sum, p) => sum + (p.finalPrice || p.estimatedPrice || 0), 0);
  const advancesCleared = projects.filter(p => p.advancePaid).length;
  const advanceClearancePct = projects.length > 0 ? Math.round((advancesCleared / projects.length) * 100) : 0;
  const inStagingCount = projects.filter(
    p => !p.domainTransferred && (p.status === 'staging_dev' || p.status === 'client_review' || p.internalQAPassed)
  ).length;
  const transferredCount = projects.filter(
    p => p.domainTransferred || p.status === 'completed' || p.status === 'transferred'
  ).length;

  const sendUtilizationPct =
    outreachState.dailyCapacity > 0
      ? Math.min(Math.round((outreachState.sentToday / outreachState.dailyCapacity) * 100), 100)
      : 0;

  const isCollaborator = role === 'collaborator';
  const canOpenCommissions = !isCollaborator && ['admin', 'ceo', 'bd_head', 'sales'].includes(role);
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
  const commissionClearedPct =
    commissionTotals.total > 0 ? Math.round((commissionTotals.cleared / commissionTotals.total) * 100) : 0;

  return (
    <section
      aria-label="Core Operational Modules"
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch"
    >
      {/* PRIMARY CARD 1: LIVE DEALS PIPELINE */}
      <article className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-indigo-600 dark:border-t-indigo-500 rounded-xl p-5 sm:p-6 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              <Kanban className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Live Deals Pipeline</span>
            </div>

            <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
              <span className="text-3xl leading-none font-extrabold text-slate-950 dark:text-white tracking-tight font-mono tabular-nums">
                {formatMoney(totalPipelineValue)}
              </span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                {projects.length} {projects.length === 1 ? 'active deal' : 'active deals'}
              </span>
            </div>
          </div>

          {role !== 'collaborator' && (
            <button
              type="button"
              onClick={() => setIsNewLeadModalOpen(true)}
              className="btn-tactile-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Deal</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">50% Advance Escrow Clearance</span>
              <span className="text-slate-950 dark:text-white font-mono tabular-nums">{advanceClearancePct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                style={{ width: `${advanceClearancePct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">50% Advances</span>
              <span className="mt-1 block text-base font-bold text-slate-950 dark:text-white font-mono tabular-nums">
                {advancesCleared}/{projects.length}
              </span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">In Staging QA</span>
              <span className="mt-1 block text-base font-bold text-slate-950 dark:text-white font-mono tabular-nums">
                {inStagingCount}
              </span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">Transferred</span>
              <span className="mt-1 block text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {transferredCount}
              </span>
            </div>
          </div>
        </div>
      </article>

      {/* PRIMARY CARD 2: CONNECTED MAILBOXES & OUTREACH STATS */}
      <article className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-emerald-600 dark:border-t-emerald-500 rounded-xl p-5 sm:p-6 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Email Hub &amp; Mailboxes</span>
            </div>

            {outreachState.loading ? (
              <div className="mt-3 h-8 w-40 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : outreachState.postgresConnected === false ? (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>PostgreSQL offline — connect Email DB to stream mailbox status</span>
              </div>
            ) : outreachState.mailboxes.length === 0 && outreachState.campaigns.length === 0 ? (
              <div className="mt-3">
                <span className="text-base font-bold text-slate-950 dark:text-white block">
                  No mailboxes connected
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Connect an SMTP/IMAP or Google sender to manage threads &amp; campaigns.
                </span>
              </div>
            ) : (
              <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
                <span className="text-3xl leading-none font-extrabold text-slate-950 dark:text-white tracking-tight font-mono tabular-nums">
                  {outreachState.sentToday}
                  <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">
                    /{outreachState.dailyCapacity || 0}
                  </span>
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  sent today
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('outreach_suite')}
            className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{outreachState.mailboxes.length === 0 ? 'Connect' : 'Email Hub'}</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">Daily Send Quota Utilization</span>
              <span className="text-slate-950 dark:text-white font-mono tabular-nums">{sendUtilizationPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
                style={{ width: `${sendUtilizationPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">Mailboxes</span>
              <span className="mt-1 block text-base font-bold text-slate-950 dark:text-white font-mono tabular-nums">
                {outreachState.activeMailboxesCount}/{outreachState.mailboxes.length}
              </span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">Campaigns</span>
              <span className="mt-1 block text-base font-bold text-slate-950 dark:text-white font-mono tabular-nums">
                {outreachState.activeCampaignsCount}
              </span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">30d Reply Rate</span>
              <span className="mt-1 block text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {outreachState.analytics ? `${outreachState.analytics.replyRate.toFixed(1)}%` : '0.0%'}
              </span>
            </div>
          </div>
        </div>
      </article>

      {/* PRIMARY CARD 3: COMMISSION & PAYMENT SPLITS */}
      <article className="md:col-span-2 xl:col-span-1 bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 border-t-[3px] border-t-amber-600 dark:border-t-amber-500 rounded-xl p-5 sm:p-6 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Financial &amp; Commission Ledger</span>
            </div>

            {isCollaborator ? (
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Internal splits masked for Partner NDA role.</span>
              </div>
            ) : (
              <div className="mt-3 flex items-baseline gap-2.5 flex-wrap">
                <span className="text-3xl leading-none font-extrabold text-slate-950 dark:text-white tracking-tight font-mono tabular-nums">
                  {formatMoney(commissionTotals.total)}
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  total split pool
                </span>
              </div>
            )}
          </div>

          {canOpenCommissions && (
            <button
              type="button"
              onClick={() => setActiveTab('commissions')}
              className="btn-tactile-secondary inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>Ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">Cleared vs. Escrow Pool</span>
              <span className="text-slate-950 dark:text-white font-mono tabular-nums">
                {isCollaborator ? 'Masked' : `${commissionClearedPct}%`}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-300"
                style={{ width: `${isCollaborator ? 0 : commissionClearedPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">Cleared</span>
              <span className="mt-1 block text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {isCollaborator ? 'Masked' : formatMoney(commissionTotals.cleared)}
              </span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">Pending Escrow</span>
              <span className="mt-1 block text-base font-bold text-slate-950 dark:text-white font-mono tabular-nums">
                {isCollaborator ? 'Masked' : formatMoney(commissionTotals.pending)}
              </span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-400 block text-[11px] font-semibold">Split Tiers</span>
              <span className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                25–35%
              </span>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
};
