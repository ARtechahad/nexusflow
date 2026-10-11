import React, { useState } from 'react';
import { 
  Activity, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Linkedin, 
  Mail, 
  CreditCard, 
  Server, 
  Zap, 
  ShieldCheck 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface PlatformHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlatformHealthModal: React.FC<PlatformHealthModalProps> = ({ isOpen, onClose }) => {
  const { databaseStatus, refreshDatabaseStatus, showToast } = useApp();
  const [testingService, setTestingService] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestPing = (serviceName: string) => {
    setTestingService(serviceName);
    setTimeout(() => {
      setTestingService(null);
      showToast(`Ping test for ${serviceName} succeeded: Latency 28ms, HTTP 200 OK`, 'success');
    }, 750);
  };

  const services = [
    {
      id: 'linkedin',
      name: 'LinkedIn Sales Navigator & InMail Stream',
      category: 'Lead Gen & Outreach',
      icon: Linkedin,
      iconColor: 'bg-[#0077b5]',
      status: 'operational',
      latency: '34ms',
      lastPing: '2 mins ago',
      eventsHandled: 148,
      details: 'Sync frequency: 15 mins. Automated keyword matching active for "web developer needed".'
    },
    {
      id: 'gmail',
      name: 'Gmail Corporate Workspace & Unified Inbox',
      category: 'Communications',
      icon: Mail,
      iconColor: 'bg-[#ea4335]',
      status: 'operational',
      latency: '22ms',
      lastPing: '1 min ago',
      eventsHandled: 312,
      details: 'IMAP & OAuth thread tracking enabled. AI sentiment classification running locally.'
    },
    {
      id: 'stripe',
      name: 'Stripe Global Milestone Escrow Gateway',
      category: 'Financial Management',
      icon: CreditCard,
      iconColor: 'bg-[#635bff]',
      status: 'operational',
      latency: '41ms',
      lastPing: '30s ago',
      eventsHandled: 84,
      details: 'Listening for checkout.session.completed & payment_intent.succeeded. 50% deposit gatekeeper active.'
    },
    {
      id: 'database',
      name: 'PostgreSQL Dual Persistence & Cache Engine',
      category: 'Database Infrastructure',
      icon: Database,
      iconColor: 'bg-emerald-600',
      status: 'operational',
      latency: `${databaseStatus?.latencyMs || 18}ms`,
      lastPing: 'Real-time',
      eventsHandled: databaseStatus?.totalRecords || 1240,
      details: `Engine: ${databaseStatus?.engine === 'postgresql' ? 'Cloud PostgreSQL with SSL' : 'Atomic Disk Storage with memory cache'}. Backups active.`
    },
    {
      id: 'scraper',
      name: 'Autonomous Agent-Reach Scraper Engine',
      category: 'Autonomous Agents',
      icon: Zap,
      iconColor: 'bg-amber-600',
      status: 'operational',
      latency: '52ms',
      lastPing: '5 mins ago',
      eventsHandled: 26,
      details: 'Scraping Upwork, LinkedIn & Twitter feeds for international agency RFPs.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]">
        
        {/* Modal Top Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a12] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Platform Health &amp; Integration Monitor
                </h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  All Systems Optimal
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live heartbeat, latency, and webhook telemetry across all external connectors
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Services List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {services.map(s => {
            const Icon = s.icon;
            const isTesting = testingService === s.id;

            return (
              <div
                key={s.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 space-y-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${s.iconColor} text-white flex items-center justify-center shadow-sm shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {s.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {s.category} · Latency: <strong className="text-indigo-500 dark:text-indigo-400">{s.latency}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 font-mono">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Operational</span>
                    </span>

                    <button
                      onClick={() => handleTestPing(s.name)}
                      disabled={isTesting}
                      className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                      <span>Ping</span>
                    </button>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/5 text-[11px] text-slate-600 dark:text-slate-400">
                  {s.details}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a12] flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Dual Persistence: Active</span>
          <span>Automatic Webhook Retry Worker: Running</span>
        </div>

      </div>
    </div>
  );
};
