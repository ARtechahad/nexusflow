import React from 'react';
import { 
  Building2, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  Layers, 
  ExternalLink, 
  Mail, 
  Kanban, 
  Send, 
  BarChart3, 
  Database, 
  Shield, 
  Lock, 
  Check, 
  Clock, 
  User, 
  Plus, 
  Zap,
  Globe2,
  Briefcase
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const UserProfileDashboard: React.FC = () => {
  const { 
    currentUser, 
    role, 
    tenants, 
    currentTenant, 
    switchTenant, 
    setActiveTab, 
    setIsOnboardingModalOpen,
    projects,
    unreadInboxCount,
    automatedTestsPassedCount,
    logout,
    setIsAuthModalOpen,
    formatMoney
  } = useApp();

  const totalDeals = projects.length;
  const totalPipelineValue = projects.reduce((acc, p) => acc + (p.finalPrice || p.estimatedPrice || 0), 0);

  const handleEnterWorkspace = async (tenant: typeof currentTenant) => {
    if (tenant) {
      await switchTenant(tenant.id);
    }
    setActiveTab('pipeline');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      
      {/* 1. Header Profile Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-slate-800 shadow-xl p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 p-0.5 shadow-lg shadow-indigo-600/30 shrink-0">
              {currentUser?.avatar ? (
                <img 
                  src={currentUser.avatar} 
                  alt={currentUser.name} 
                  className="w-full h-full object-cover rounded-2xl" 
                />
              ) : (
                <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center text-white font-extrabold text-2xl">
                  {currentUser?.name ? currentUser.name[0] : 'U'}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-white">
                  {currentUser?.name || 'Enterprise Member'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
                  {role.replace('_', ' ').toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Authenticated Session
                </span>
              </div>
              <p className="text-sm text-slate-300 font-medium">
                {currentUser?.email || 'admin@agencyops.dev'}
              </p>
              <p className="text-xs text-slate-400">
                {currentUser?.title || 'Chief Executive Officer (CEO)'} &bull; Member of {tenants.length} Workspace{tenants.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              Switch Role
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Security & Verification Health Ribbons */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Neon DB: <strong>Multi-Tenant Isolated</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Clerk Auth: <strong>Session Verified</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Mail className="w-4 h-4 text-purple-400" />
            <span>Resend Dispatch: <strong>Active (`re_LXii...`)</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Primary Guidance Card: "Get Started" to Register Company */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Company Onboarding</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Register or Expand a Company Workspace
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Launch a dedicated, isolated tenant workspace in under 60 seconds. Collect essential company details, automatically establish hierarchical RBAC team roles, and trigger instant welcome email notifications via Resend.
            </p>
          </div>

          <button
            onClick={() => setIsOnboardingModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Registered Companies & Enterprise Workspaces */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" />
              Your Registered Company Workspaces
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select any registered organization to open its enterprise operations dashboard
            </p>
          </div>

          <button
            onClick={() => setIsOnboardingModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Company</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map(t => {
            const isCurrent = currentTenant?.id === t.id;
            return (
              <div 
                key={t.id}
                className={`rounded-2xl border p-5 transition-all flex flex-col justify-between ${
                  isCurrent 
                    ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-500 shadow-md'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-800 dark:text-white">
                        {t.name ? t.name.slice(0, 2).toUpperCase() : 'CO'}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[180px]">
                          {t.name}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {t.slug || t.id}
                        </span>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {t.businessInfo?.description || 'Centralized growth operations & international client management.'}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-indigo-400" />
                      {t.businessInfo?.industry || 'B2B SaaS'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-emerald-400" />
                      {t.activeMembersCount || 1} Member{t.activeMembersCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">
                    ID: {t.id.slice(0, 16)}...
                  </span>

                  <button
                    onClick={() => handleEnterWorkspace(t)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <span>Enter Dashboard</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Quick Operational Shortcuts */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-500" />
          Enterprise Workspace Modules
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'pipeline', title: 'Deals & Pipeline', desc: `${totalDeals} active projects (${formatMoney(totalPipelineValue)})`, icon: Kanban },
            { id: 'outreach_suite', title: 'Outreach Suite', desc: 'Cold sequences & peer email warmup', icon: Send },
            { id: 'inbox', title: 'Unified Omni-Inbox', desc: `${unreadInboxCount} unread client threads`, icon: Mail },
            { id: 'analytics', title: 'Revenue Analytics', desc: 'Financial conversions & SLA health', icon: BarChart3 }
          ].map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveTab(mod.id as any)}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition cursor-pointer space-y-2"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{mod.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{mod.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};
