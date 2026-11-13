import React from 'react';
import {
  Building2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Users,
  Layers,
  Mail,
  Kanban,
  Send,
  BarChart3,
  Database,
  Plus,
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
    <div className="max-w-7xl mx-auto py-2 space-y-6 animate-fadeIn">
      {/* 1. Account Identity Banner (Clean Enterprise Light / Dark Parity) */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shrink-0 overflow-hidden shadow-xs">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}</span>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {currentUser?.name || 'Workspace Member'}
                </h1>
                <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  {role.replace('_', ' ').toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Verified Session
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                {currentUser?.email || 'No email configured'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {currentUser?.title || 'Workspace Operator'} &bull; {tenants.length} Registered Company {tenants.length === 1 ? 'Workspace' : 'Workspaces'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer whitespace-nowrap"
            >
              Switch Role
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Security & Infrastructure Status Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Neon DB: <strong className="text-slate-900 dark:text-white">Multi-Tenant Isolated</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>Clerk Auth: <strong className="text-slate-900 dark:text-white">Session Verified</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>Resend Dispatch: <strong className="text-slate-900 dark:text-white">Transactional Ready</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Company Onboarding CTA: "Get Started" */}
      <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Company Onboarding</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Register a New Company Workspace
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Launch an isolated company workspace in four quick steps—enter your company name, website, email, industry, and team size without any Tax ID or EIN fields.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOnboardingModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-xs transition cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" />
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Registered Companies & Enterprise Workspaces */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Your Registered Company Workspaces</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a workspace to enter its deals pipeline, outreach suite, and commission ledger
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOnboardingModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Company</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((t) => {
            const isCurrent = currentTenant?.id === t.id;
            return (
              <div
                key={t.id}
                className={`rounded-xl border p-5 transition flex flex-col justify-between bg-white dark:bg-slate-900/80 ${
                  isCurrent
                    ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-800 dark:text-white shrink-0">
                        {t.name ? t.name.slice(0, 2).toUpperCase() : 'CO'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {t.name}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate block">
                          {t.slug || t.id}
                        </span>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {t.businessInfo?.description || 'International client operations & multi-tenant workspace.'}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                      {t.businessInfo?.industry || 'B2B Operations'}
                    </span>
                    <span className="flex items-center gap-1 font-mono tabular-nums">
                      <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {t.activeMembersCount || 1} {t.activeMembersCount === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-slate-400 truncate">
                    {t.id.slice(0, 18)}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleEnterWorkspace(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Enter Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Direct Workspace Shortcuts */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Workspace Modules</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { id: 'pipeline', title: 'Deals & Pipeline', desc: `${totalDeals} deals (${formatMoney(totalPipelineValue)})`, icon: Kanban },
            { id: 'outreach_suite', title: 'Outreach Suite', desc: 'Mailboxes, warmup & A–Z sequences', icon: Send },
            { id: 'inbox', title: 'Unified Omni-Inbox', desc: `${unreadInboxCount} unread threads`, icon: Mail },
            { id: 'analytics', title: 'Revenue Analytics', desc: 'Conversions & SLA monitoring', icon: BarChart3 }
          ].map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveTab(mod.id as any)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:border-indigo-300 dark:hover:border-slate-700 text-left transition cursor-pointer space-y-2"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{mod.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono tabular-nums">{mod.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
