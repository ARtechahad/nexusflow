import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Mail,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  CampaignItem,
  CampaignStats,
  listCampaigns,
  getCampaignStats,
  startCampaign,
  pauseCampaign,
  listMailboxes,
  Mailbox
} from '../../services/outreachService';
import { CampaignEditor } from './CampaignEditor';

export const CampaignsTab: React.FC = () => {
  const { showToast } = useApp();
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [selectedCampaignStats, setSelectedCampaignStats] = useState<{
    campaign: CampaignItem;
    stats: CampaignStats;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [camps, mbxs] = await Promise.all([listCampaigns(), listMailboxes()]);
      setCampaigns(camps);
      setMailboxes(mbxs);
    } catch (err: any) {
      showToast(err.message || 'Failed to load campaigns', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleCampaignStatus = async (camp: CampaignItem) => {
    try {
      if (camp.status === 'active') {
        await pauseCampaign(camp.id);
        showToast(`Campaign "${camp.name}" paused`, 'info');
      } else {
        const res = await startCampaign(camp.id);
        if (res.requiresConfirmation) {
          const proceed = window.confirm(
            `${res.warning}\n\nDo you want to acknowledge the deliverability risk and start anyway?`
          );
          if (proceed) {
            await startCampaign(camp.id, true);
            showToast(`Campaign "${camp.name}" started with risk acknowledged`, 'success');
          } else {
            return;
          }
        } else {
          showToast(`Campaign "${camp.name}" started successfully!`, 'success');
        }
      }
      loadData(true);
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error');
    }
  };

  const handleViewStats = async (camp: CampaignItem) => {
    try {
      setStatsLoading(true);
      const stats = await getCampaignStats(camp.id);
      setSelectedCampaignStats({ campaign: camp, stats });
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch campaign stats', 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  if (isEditorOpen) {
    return (
      <CampaignEditor
        mailboxes={mailboxes}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={() => {
          setIsEditorOpen(false);
          loadData();
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-600" />
            Outbound Multi-Step Sequences
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-step email campaigns scheduled through Cap Guard with deterministic spintax and reply detection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsEditorOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </button>
        </div>
      </div>

      {/* Campaigns Table or Empty State */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading outreach campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <Send className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            No Outbound Campaigns Yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Design your first multi-step sequence with automatic interval delays, spintax variations, and mailbox rotation.
          </p>
          <button
            onClick={() => setIsEditorOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {campaigns.map((camp) => {
            const isActive = camp.status === 'active';
            const enrolled = camp.enrolled_count || 0;
            const completed = camp.completed_enrolled || 0;
            const progress = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;

            return (
              <div
                key={camp.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : camp.status === 'paused'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                      {camp.status.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {camp.name}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {camp.mailbox_count || 0} mailboxes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      {camp.step_count || 0} sequence steps
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {enrolled} enrolled ({camp.active_enrolled || 0} in flight)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full max-w-md space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Sequence Completion</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => handleViewStats(camp)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Analytics
                  </button>

                  <button
                    onClick={() => handleToggleCampaignStatus(camp)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isActive
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    }`}
                  >
                    {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isActive ? 'Pause' : 'Start Sequence'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Campaign Analytics & Cap Guard Activity Modal */}
      {selectedCampaignStats && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedCampaignStats.campaign.name}
                </h3>
                <p className="text-xs text-slate-500">Live Delivery Performance & Safety Gate Logs</p>
              </div>
              <button
                onClick={() => setSelectedCampaignStats(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Performance Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[11px] text-slate-500 block">Sent Today</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
                  {selectedCampaignStats.stats.sent_today}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[11px] text-slate-500 block">Total Sent</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white mt-1 block">
                  {selectedCampaignStats.stats.total_sent}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[11px] text-slate-500 block">Replies</span>
                <span className="text-lg font-bold text-emerald-600 mt-1 block">
                  {selectedCampaignStats.stats.replied_count}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[11px] text-slate-500 block">Hard Bounces</span>
                <span className="text-lg font-bold text-rose-600 mt-1 block">
                  {selectedCampaignStats.stats.bounced}
                </span>
              </div>
            </div>

            {/* Cap Guard Deferral Activity Log */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                Cap Guard Deferral Reasons (Why was a send paced?)
              </div>
              {selectedCampaignStats.stats.deferActivity.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 text-center">
                  No active deferrals recorded. All sends are proceeding smoothly within schedule windows.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedCampaignStats.stats.deferActivity.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{log.email}</p>
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">{log.defer_reason}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
