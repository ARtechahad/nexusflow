import React, { useState, useEffect } from 'react';
import {
  Send,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Calendar,
  Database,
  Plus
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useOutreachTelemetry } from '../hooks/useOutreachTelemetry';

export const LeadFlowEngineSection: React.FC = () => {
  const { setActiveTab, projects, authToken } = useApp();
  const telemetry = useOutreachTelemetry();
  const [activeTab, setActiveTabLocal] = useState<'deliverability' | 'sequences' | 'enrichment' | 'meetings'>('deliverability');
  const [scrapedLeads, setScrapedLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchLeads = async () => {
      setLoadingLeads(true);
      try {
        const res = await fetch('/api/scraper/leads', {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        });
        if (res.ok && active) {
          const data = await res.json();
          setScrapedLeads(Array.isArray(data.leads) ? data.leads : []);
        }
      } catch {
        // Keep empty on error
      } finally {
        if (active) setLoadingLeads(false);
      }
    };
    fetchLeads();
    return () => { active = false; };
  }, [authToken]);

  const mailboxes = telemetry.mailboxes || [];
  const campaigns = telemetry.campaigns || [];
  const discoveryBookings = projects.filter(p => Boolean((p as any).bookingDate) || (p as any).source === 'leadflow_inbound');

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner: LeadFlow Engine Overview */}
      <div className="p-6 rounded-2xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
              LeadFlow GTM Infrastructure
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {telemetry.activeMailboxesCount} Active Mailbox{telemetry.activeMailboxesCount === 1 ? '' : 'es'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Managed Cold Email &amp; Multi-Channel Lead Engine
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Live outbound infrastructure connected to your authenticated PostgreSQL outreach tables, verified mailboxes, and inbound discovery pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('outreach')}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition cursor-pointer flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Outreach Suite</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 flex-wrap border-b border-slate-200 dark:border-white/10 pb-3">
        {[
          { id: 'deliverability', label: `Sender Mailboxes (${mailboxes.length})`, icon: ShieldCheck },
          { id: 'sequences', label: `Active Sequences (${campaigns.length})`, icon: Send },
          { id: 'enrichment', label: `Captured Leads (${scrapedLeads.length})`, icon: Database },
          { id: 'meetings', label: `Booked Discovery (${discoveryBookings.length})`, icon: Calendar }
        ].map(st => {
          const Icon = st.icon;
          const isSelected = activeTab === st.id;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setActiveTabLocal(st.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{st.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Sender Mailboxes & Deliverability */}
      {activeTab === 'deliverability' && (
        <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>Authenticated Sending Mailboxes &amp; DNS Health</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time mailbox status, daily send caps, and DNS alignment metrics.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('outreach')}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 hover:border-indigo-500 text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manage Mailboxes</span>
            </button>
          </div>

          {mailboxes.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No sending mailboxes configured</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Connect an SMTP/IMAP sender domain in the Outreach Suite to start tracking live deliverability.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {mailboxes.map(mb => (
                <div key={mb.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                      {mb.email}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold uppercase">
                      {mb.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Reputation:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{mb.reputation_score}%</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Sent Today:</span>
                      <span>{mb.today_campaign_sent || 0} / {mb.daily_cap || 0} cap</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-600 dark:text-slate-300">SPF: {mb.spf_status || 'pending'}</span>
                    <span className="text-slate-600 dark:text-slate-300">DKIM: {mb.dkim_status || 'pending'}</span>
                    <span className="text-slate-600 dark:text-slate-300">DMARC: {mb.dmarc_status || 'pending'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Sequences */}
      {activeTab === 'sequences' && (
        <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-500" />
                <span>Multi-Touch Outreach Campaigns</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live sequences synced with your Outreach Suite database.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">
              {campaigns.filter(c => c.status === 'active').length} Active
            </span>
          </div>

          {campaigns.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No outreach campaigns created yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Create a campaign in the Outreach Suite to track live enrollment, opens, and replies.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map(seq => (
                <div key={seq.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{seq.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono font-bold uppercase">
                        {seq.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {seq.enrolled_count || 0} prospects enrolled &bull; Daily cap: {seq.daily_limit}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 text-xs font-mono shrink-0">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Active</span>
                      <span className="font-bold text-slate-900 dark:text-white">{seq.active_enrolled || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Completed</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{seq.completed_enrolled || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Steps</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{seq.step_count || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Captured / Enriched Leads */}
      {activeTab === 'enrichment' && (
        <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                <span>Captured &amp; Enriched Leads</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live prospects ingested from webhook automation and lead scraper runs.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('outreach')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
            >
              Open Lead Scraper &rarr;
            </button>
          </div>

          {loadingLeads ? (
            <p className="text-xs text-slate-500 py-6 text-center">Loading captured leads...</p>
          ) : scrapedLeads.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No captured leads yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Run a live scan in the Lead Scraper or ingest leads via the Automation API.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 font-mono">
                    <th className="pb-3 font-semibold">Prospect</th>
                    <th className="pb-3 font-semibold">Company &amp; Title</th>
                    <th className="pb-3 font-semibold">Platform</th>
                    <th className="pb-3 font-semibold">Est. Budget</th>
                    <th className="pb-3 font-semibold">Pipeline Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {scrapedLeads.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition">
                      <td className="py-3 font-bold text-slate-900 dark:text-white">
                        {p.authorName || p.title}
                      </td>
                      <td className="py-3">
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium block">{p.authorTitle || p.websiteType || 'Lead'}</span>
                        <span className="text-slate-500 text-[11px]">{p.companyName || '—'}</span>
                      </td>
                      <td className="py-3 font-mono uppercase text-[11px] text-slate-600 dark:text-slate-300">
                        {p.platform || 'inbound'}
                      </td>
                      <td className="py-3 font-mono text-slate-900 dark:text-white font-semibold">
                        ${p.estimatedBudget || 0}
                      </td>
                      <td className="py-3 font-mono">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.injectedToPipeline ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}>
                          {p.injectedToPipeline ? 'In Pipeline' : 'Captured'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Booked Discovery Calls */}
      {activeTab === 'meetings' && (
        <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-500" />
                <span>Scheduled Discovery &amp; Strategy Calls</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Confirmed bookings synchronized with your live Deals Pipeline.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
              {discoveryBookings.length} Booked
            </span>
          </div>

          {discoveryBookings.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 dark:border-white/10 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No discovery calls scheduled</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Inbound bookings and scheduled calls will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {discoveryBookings.map(p => (
                <div key={p.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 dark:text-white">{p.clientName}</span>
                    <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">
                      {p.clientCompany || 'Direct'} (${p.finalPrice || p.estimatedPrice})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    {(p as any).bookingDate || p.startDate} {(p as any).bookingTime ? `@ ${(p as any).bookingTime}` : ''}
                  </p>
                  {p.purpose && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">{p.purpose}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
