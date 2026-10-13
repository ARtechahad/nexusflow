import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Zap,
  Filter,
  Download,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  Server,
  Layers,
  ArrowUpRight,
  Eye,
  MousePointer,
  MessageSquare,
  Sparkles,
  Award
} from 'lucide-react';
import {
  getOutreachAnalyticsData,
  downloadAnalyticsCsv,
  triggerDailyRollup,
  OutreachAnalyticsData
} from '../../services/outreachService';

interface AnalyticsTabProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ showToast }) => {
  const [data, setData] = useState<OutreachAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [rollingUp, setRollingUp] = useState<boolean>(false);

  // Filters
  const [dateRange, setDateRange] = useState<string>('30d');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getOutreachAnalyticsData({
        dateRange,
        campaignId: selectedCampaignId || undefined
      });
      setData(res);
    } catch (err: any) {
      showToast(err.message || 'Failed to load outreach analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedCampaignId, showToast]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleDownloadCsv = async () => {
    try {
      await downloadAnalyticsCsv({
        dateRange,
        campaignId: selectedCampaignId || undefined
      });
      showToast('Exported outreach analytics CSV successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to download CSV', 'error');
    }
  };

  const handleTriggerRollup = async () => {
    setRollingUp(true);
    try {
      await triggerDailyRollup();
      showToast('Nightly rollup table refreshed', 'success');
      loadAnalytics();
    } catch (err: any) {
      showToast(err.message || 'Failed to execute rollup', 'error');
    } finally {
      setRollingUp(false);
    }
  };

  const overview = data?.overview || {
    sent: 0,
    delivered: 0,
    bounced: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    positiveReplied: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
    positiveReplyRate: 0,
    bounceRate: 0,
    openRateDisclaimer: 'approximate (Apple Mail Privacy Protection inflates opens)'
  };

  const maxSeriesSent = Math.max(
    ...(data?.dailySeries.map((d) => d.sent) || [1]),
    1
  );

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Outbound Performance & Conversion Funnel</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time delivery rates, verified open telemetries, and A–Z message variant analytics.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            <span>Range:</span>
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>

          {data?.campaigns && data.campaigns.length > 0 && (
            <select
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 focus:outline-hidden max-w-[180px] truncate"
            >
              <option value="">All Campaigns</option>
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-2xs transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerRollup}
            disabled={rollingUp}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-500 hover:text-slate-700"
            title="Refresh Nightly Rollup"
          >
            <RefreshCw className={`w-4 h-4 ${rollingUp ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Metric Cards (Using DashboardAnalytics styling) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sent & Delivered */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold">Sent & Delivered</span>
            <Mail className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {overview.sent.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Delivered: <strong className="text-emerald-600 font-mono">{overview.delivered.toLocaleString()}</strong></span>
            <span className="text-emerald-600 font-bold font-mono">{overview.deliveryRate}%</span>
          </div>
        </div>

        {/* Opened Rate (With Apple Mail Disclaimer) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold">Opens (Telemetry)</span>
            <Eye className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {overview.opened.toLocaleString()}
            </div>
            <span className="text-xs font-bold font-mono text-indigo-500">
              ({overview.openRate}%)
            </span>
          </div>
          <div className="text-[10px] text-slate-400 italic">
            * {overview.openRateDisclaimer}
          </div>
        </div>

        {/* Replies & Sentiment */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold">Replies & Engagement</span>
            <MessageSquare className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {overview.replied.toLocaleString()}
            </div>
            <span className="text-xs font-bold font-mono text-emerald-500">
              ({overview.replyRate}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between">
            <span>Positive: <strong className="text-emerald-600 font-mono">{overview.positiveReplied.toLocaleString()}</strong></span>
            <span className="text-emerald-600 font-bold font-mono">{overview.positiveReplyRate}%</span>
          </div>
        </div>

        {/* Bounce Rate & Reputation */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span className="font-semibold">Bounces & Protection</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {overview.bounced.toLocaleString()}
            </div>
            <span className="text-xs font-bold font-mono text-amber-500">
              ({overview.bounceRate}%)
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Cap Guard & Auto-Pause: Healthy</span>
          </div>
        </div>
      </div>

      {/* Daily Performance Activity Bar Chart */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Outbound Volume & Daily Delivery Velocity</span>
            </h3>
            <p className="text-xs text-slate-400">
              Daily distribution of sent emails, opens, and prospect replies.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span>Sent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Replies</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Series */}
        <div className="pt-4 pb-2">
          {(!data?.dailySeries || data.dailySeries.length === 0) ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No outbound activity recorded in this date range.
            </div>
          ) : (
            <div className="h-44 flex items-end gap-2 overflow-x-auto pb-2">
              {data.dailySeries.map((point) => {
                const heightPct = Math.min(100, Math.max(8, (point.sent / maxSeriesSent) * 100));
                return (
                  <div key={point.date} className="flex-1 min-w-[36px] flex flex-col items-center gap-1.5 group">
                    <div className="text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                      {point.sent}
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-lg h-36 flex items-end relative overflow-hidden">
                      <div
                        className="w-full bg-indigo-500/80 hover:bg-indigo-600 transition-all rounded-t-md"
                        style={{ height: `${heightPct}%` }}
                      />
                      {point.replied > 0 && (
                        <div
                          className="w-full bg-emerald-500 absolute bottom-0 left-0"
                          style={{ height: `${Math.min(100, (point.replied / point.sent) * 100)}%` }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 truncate max-w-[40px]">
                      {point.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* A-Z Variant Performance Breakdown Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>A–Z Variant Metrics & Bayesian Beta Posterior Rankings</span>
            </h3>
            <p className="text-xs text-slate-400">
              E[θ] expected reply rates calculated via Beta(1 + replies, 1 + sends - replies) posterior score.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-2 font-semibold">Variant</th>
                <th className="pb-2 font-semibold">Subject Line</th>
                <th className="pb-2 font-semibold text-right">Weight</th>
                <th className="pb-2 font-semibold text-right">Sends</th>
                <th className="pb-2 font-semibold text-right">Opens*</th>
                <th className="pb-2 font-semibold text-right">Replies</th>
                <th className="pb-2 font-semibold text-right">Reply Rate</th>
                <th className="pb-2 font-semibold text-right">Posterior Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {(!data?.variants || data.variants.length === 0) ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-400 font-sans">
                    No variant experiments active yet.
                  </td>
                </tr>
              ) : (
                data.variants.map((v) => (
                  <tr key={v.variantId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 font-bold text-indigo-600 dark:text-indigo-400">
                      [{v.variantLabel}]
                    </td>
                    <td className="py-3 font-sans text-slate-800 dark:text-slate-200 max-w-xs truncate">
                      {v.subject}
                    </td>
                    <td className="py-3 text-right text-slate-600 dark:text-slate-300">
                      {v.weight}%
                    </td>
                    <td className="py-3 text-right text-slate-700 dark:text-slate-200">
                      {v.sent}
                    </td>
                    <td className="py-3 text-right text-slate-500">
                      {v.opened}
                    </td>
                    <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                      {v.replied}
                    </td>
                    <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                      {v.replyRate}%
                    </td>
                    <td className="py-3 text-right text-purple-600 dark:text-purple-400 font-bold">
                      {v.posteriorScore}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaigns & Mailboxes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Campaign Breakdown */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Campaign Performance</span>
          </h3>
          <div className="space-y-2">
            {(!data?.campaigns || data.campaigns.length === 0) ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No campaigns found.
              </div>
            ) : (
              data.campaigns.map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {c.name}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {c.sent} sent • {c.delivered} delivered
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono block">
                      {c.replyRate}% reply
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {c.replied} replies
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mailbox Health & Deliverability */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            <span>Mailbox Health & Bounce Distribution</span>
          </h3>
          <div className="space-y-2">
            {(!data?.mailboxes || data.mailboxes.length === 0) ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No mailboxes configured.
              </div>
            ) : (
              data.mailboxes.map((m) => (
                <div key={m.mailboxId} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block truncate max-w-[200px]">
                      {m.email}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {m.sent} sent • Bounce rate: {m.bounceRate}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                      {m.healthScore}% Health
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
