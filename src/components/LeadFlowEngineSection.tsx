import React, { useState } from 'react';
import { 
  Send, 
  Linkedin, 
  Mail, 
  CheckCircle2, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Calendar, 
  RefreshCw, 
  Layers, 
  Globe, 
  Database,
  Filter,
  Check,
  TrendingUp,
  Sliders,
  DollarSign
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LeadFlowEngineSection: React.FC = () => {
  const { showToast, setActiveTab } = useApp();
  const [activeTab, setActiveTabLocal] = useState<'deliverability' | 'sequences' | 'enrichment' | 'meetings'>('deliverability');

  const [domains, setDomains] = useState([
    { domain: 'agencyops-hq.com', spf: true, dkim: true, dmarc: true, warmupDay: 14, emailsSentToday: 42, inboxRate: '99.1%' },
    { domain: 'getagencyops.co', spf: true, dkim: true, dmarc: true, warmupDay: 12, emailsSentToday: 35, inboxRate: '98.4%' },
    { domain: 'agencygrowthmail.com', spf: true, dkim: true, dmarc: true, warmupDay: 14, emailsSentToday: 48, inboxRate: '97.8%' }
  ]);

  const [activeSequences, setActiveSequences] = useState([
    {
      name: 'B2B SaaS CCOs & VP Payments (Embedded Margin Leakage)',
      channel: 'LinkedIn + Cold Email Multi-Touch',
      prospectsCount: 840,
      openRate: '72.4%',
      replyRate: '7.1%',
      meetingsBooked: 11,
      status: 'Active'
    },
    {
      name: 'US Enterprise Contact Centers (Audio QA Automation)',
      channel: 'Cold Email Primary + LinkedIn',
      prospectsCount: 650,
      openRate: '68.5%',
      replyRate: '8.4%',
      meetingsBooked: 14,
      status: 'Active'
    },
    {
      name: 'UK E-Commerce Brands (Headless Shopify Migration)',
      channel: 'LinkedIn Social Selling + Email',
      prospectsCount: 920,
      openRate: '64.8%',
      replyRate: '5.9%',
      meetingsBooked: 9,
      status: 'Active'
    }
  ]);

  const [enrichedProspects, setEnrichedProspects] = useState([
    { name: 'Julian Vance', title: 'VP Commercial Engineering', company: 'NovaPay Global', location: 'London, UK', email: 'j.vance@novapay.co.uk', emailStatus: 'Verified (0% Bounce)', phone: '+44 20 7946 0912', intentScore: 98 },
    { name: 'Sarah Chen', title: 'Head of Customer Experience', company: 'CloudDesk AI', location: 'San Francisco, US', email: 'schen@clouddesk.ai', emailStatus: 'Verified (0% Bounce)', phone: '+1 (415) 890-4412', intentScore: 94 },
    { name: 'Tariq Al-Mansoor', title: 'Chief Technology Officer', company: 'Riyadh Telecom', location: 'Riyadh, KSA', email: 't.mansoor@riyadhtelecom.sa', emailStatus: 'Verified (0% Bounce)', phone: '+966 11 480 3210', intentScore: 99 }
  ]);

  const handleTestDeliverability = () => {
    showToast('Running live DNS & Google Postmaster reputation ping across all 3 secondary domains...', 'info');
    setTimeout(() => {
      showToast('All 3 secondary domains 100% healthy! SPF/DKIM/DMARC passed with zero spam reports.', 'success');
    }, 700);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Banner: LeadFlow Engine Overview */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-900/30 via-slate-900/40 to-slate-900/80 border border-indigo-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              LeadFlow GTM Infrastructure
            </span>
            <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Multi-Channel Live Engine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Managed LinkedIn &amp; Cold Email Lead Generation
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Equipped with waterfall prospect enrichment, isolated secondary domains, SPF/DKIM warmup, and multi-touch sequences delivering qualified sales calls directly to your calendar.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('leadflow')}
          className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center gap-2 shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>View Public LeadFlow Agency Site</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 flex-wrap border-b border-slate-200 dark:border-white/10 pb-3">
        {[
          { id: 'deliverability', label: 'Domain Deliverability & Warmup', icon: ShieldCheck },
          { id: 'sequences', label: 'Multi-Channel Sequences', icon: Send },
          { id: 'enrichment', label: 'Clay Waterfall Lead Enrichment', icon: Database },
          { id: 'meetings', label: 'Booked Calendar Meetings', icon: Calendar }
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

      {/* Tab 1: Domain Deliverability & Warmup */}
      {activeTab === 'deliverability' && (
        <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span>Secondary Domain Deliverability &amp; In-Box Health</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Your primary domain is 100% isolated. Secondary domains are monitored continuously for SPF, DKIM, and DMARC alignment.
              </p>
            </div>

            <button
              type="button"
              onClick={handleTestDeliverability}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 hover:border-indigo-500 text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Run Deliverability Audit</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {domains.map(d => (
              <div key={d.domain} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {d.domain}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-mono font-bold">
                    {d.inboxRate} Landing
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Warmup Status:</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">Day {d.warmupDay} / 14 Completed</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Sent Today:</span>
                    <span>{d.emailsSentToday} / 50 cap</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-emerald-500 font-bold">&check; SPF Pass</span>
                  <span className="text-emerald-500 font-bold">&check; DKIM Pass</span>
                  <span className="text-emerald-500 font-bold">&check; DMARC Pass</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Sequences */}
      {activeTab === 'sequences' && (
        <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-500" />
                <span>Active Multi-Touch Campaigns</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Coordinated LinkedIn connection notes, personalized emails, and follow-ups.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
              34 Total SQLs Generated
            </span>
          </div>

          <div className="space-y-3">
            {activeSequences.map(seq => (
              <div key={seq.name} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {seq.name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                      {seq.channel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {seq.prospectsCount} prospects enrolled &bull; 15-min reply response SLA
                  </p>
                </div>

                <div className="flex items-center gap-6 text-xs font-mono shrink-0">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Open Rate</span>
                    <span className="font-bold text-slate-900 dark:text-white">{seq.openRate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Reply Rate</span>
                    <span className="font-bold text-emerald-500">{seq.replyRate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Booked SQLs</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{seq.meetingsBooked} calls</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Waterfall Enrichment */}
      {activeTab === 'enrichment' && (
        <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                <span>Clay + Apollo Waterfall Enrichment Table</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every record is triple-verified: Catch-all resolved, MX confirmed, and direct mobile lines uncovered.
              </p>
            </div>
            <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-bold">
              0% Hard Bounce Guarantee
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-slate-400 font-mono">
                  <th className="pb-3 font-semibold">Prospect</th>
                  <th className="pb-3 font-semibold">Title &amp; Company</th>
                  <th className="pb-3 font-semibold">Verified Email</th>
                  <th className="pb-3 font-semibold">Direct Phone</th>
                  <th className="pb-3 font-semibold">Intent Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {enrichedProspects.map(p => (
                  <tr key={p.email} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition">
                    <td className="py-3.5 font-bold text-slate-900 dark:text-white">
                      {p.name}
                      <span className="block text-[10px] text-slate-400 font-normal">{p.location}</span>
                    </td>
                    <td className="py-3.5">
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium block">{p.title}</span>
                      <span className="text-slate-500 text-[11px]">{p.company}</span>
                    </td>
                    <td className="py-3.5 font-mono">
                      <span className="text-slate-900 dark:text-slate-200 block">{p.email}</span>
                      <span className="text-[10px] text-emerald-500 font-bold">{p.emailStatus}</span>
                    </td>
                    <td className="py-3.5 font-mono text-slate-600 dark:text-slate-300">
                      {p.phone}
                    </td>
                    <td className="py-3.5 font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                        {p.intentScore}/100
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Booked Calendar Meetings */}
      {activeTab === 'meetings' && (
        <div className="bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-500" />
                <span>Upcoming Discovery &amp; Strategy Calls Booked</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Qualified meetings automatically confirmed on Google Calendar &amp; synced into Deals Pipeline.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-mono font-bold">
              Synced with Deals Pipeline
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-white">Dominik Weber &bull; Head of Treasury</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">Apex Pay ($140k Deal)</span>
              </div>
              <p className="text-xs text-slate-500 font-mono">Thursday, Oct 8 @ 2:30 PM EST &bull; Google Meet</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                "Interested in cross-border settlement architecture. Wants demo on staging QA."
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-white">Sarah Chen &bull; Head of CX</span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-mono text-[10px] font-bold">CloudDesk AI ($80k Deal)</span>
              </div>
              <p className="text-xs text-slate-500 font-mono">Friday, Oct 9 @ 11:00 AM EST &bull; Zoom</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                "Evaluating AI agent compliance monitoring. Budget pre-approved for Q4."
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
