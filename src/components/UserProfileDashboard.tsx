import React from 'react';
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  Users,
  Layers,
  Mail,
  Kanban,
  Send,
  Coins,
  Database,
  Plus,
  Briefcase,
  MessageSquare
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AvailabilityStatus } from '../types';

export const UserProfileDashboard: React.FC = () => {
  const {
    currentUser,
    companyRole,
    tenants,
    currentTenant,
    pendingInvites,
    switchTenant,
    acceptInvite,
    updateMyAvailability,
    setActiveTab,
    setIsOnboardingModalOpen,
    projects,
    unreadInboxCount,
    logout,
    formatMoney
  } = useApp();

  const isAdmin = companyRole === 'company_admin';
  const isDeptHead = companyRole === 'department_head';

  const totalDeals = projects.length;
  const totalPipelineValue = projects.reduce((acc, p) => acc + (p.finalPrice || p.estimatedPrice || 0), 0);

  const handleEnterWorkspace = async (tenant: typeof currentTenant) => {
    if (tenant) {
      await switchTenant(tenant.id);
    }
  };

  const roleShortcuts = isAdmin
    ? [
        { id: 'pipeline', title: 'Executive Dashboard', desc: `${totalDeals} deals (${formatMoney(totalPipelineValue)})`, icon: Kanban },
        { id: 'departmental', title: 'Departments & Team', desc: 'Structure, invites & tasks', icon: Users },
        { id: 'outreach_suite', title: 'Email Hub', desc: 'Mailboxes, campaigns & warmup', icon: Send },
        { id: 'commissions', title: 'Commission Ledger', desc: 'Splits, advances & payouts', icon: Coins }
      ]
    : isDeptHead
    ? [
        { id: 'departmental', title: 'Department Operations', desc: 'Roster, employees & tasks', icon: Users },
        { id: 'chat', title: 'Department Chat', desc: 'Private room & work updates', icon: MessageSquare },
        { id: 'outreach_suite', title: 'Email Hub', desc: 'Connected mailboxes & sequences', icon: Send },
        { id: 'inbox', title: 'Client Inbox', desc: `${unreadInboxCount} unread threads`, icon: Mail }
      ]
    : [
        { id: 'departmental', title: 'My Department', desc: 'Assigned tasks & live team roster', icon: Users },
        { id: 'chat', title: 'Department Chat', desc: 'Team room & daily work status', icon: MessageSquare }
      ];

  return (
    <div className="max-w-7xl mx-auto py-2 space-y-6 animate-fadeIn">
      {/* 1. Account Identity Banner */}
      <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xs p-6">
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
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {currentUser?.name || 'Workspace Member'}
                </h1>
                <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  {companyRole === 'company_admin'
                    ? 'COMPANY OWNER'
                    : companyRole === 'department_head'
                    ? 'DEPARTMENT HEAD'
                    : companyRole === 'employee'
                    ? 'EMPLOYEE'
                    : 'VERIFIED ACCOUNT'}
                </span>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  &bull; Session Verified
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                {currentUser?.email || 'No email configured'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {currentTenant?.myDesignation || currentUser?.title || 'Personal Profile'} &bull;{' '}
                {tenants.length} Company {tenants.length === 1 ? 'Membership' : 'Memberships'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              value={currentUser?.availabilityStatus || 'Available'}
              onChange={(e) => updateMyAvailability(e.target.value as AvailabilityStatus)}
              aria-label="My Availability Status"
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="Available">Status: Available</option>
              <option value="In a Meeting">Status: In a Meeting</option>
              <option value="Busy">Status: Busy</option>
              <option value="Offline">Status: Offline</option>
            </select>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('commissions')}
                className="btn-tactile-secondary px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                Team Splits &amp; Ledger
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="btn-tactile-secondary px-3.5 py-2 rounded-lg hover:text-red-600 dark:hover:text-red-400 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Workspace Configuration Status Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Tenant Boundary: <strong className="text-slate-950 dark:text-white">Strictly Isolated</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              Account Status: <strong className="text-slate-950 dark:text-white">Email OTP Verified</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>
              Live Availability:{' '}
              <strong className="text-slate-950 dark:text-white">
                {currentUser?.availabilityStatus || 'Available'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Pending Invitations Banner */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-indigo-200 dark:border-indigo-800 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Pending Company Invitations ({pendingInvites.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-950 dark:text-white truncate">
                    {inv.companyName} &middot; {inv.departmentName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {inv.role === 'department_head' ? 'Department Head' : 'Employee'} ({inv.designation})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => acceptInvite(inv.token)}
                  className="btn-tactile-primary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Accept &amp; Join
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Register New Company CTA */}
      <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
              Register Another Company Under Your Account
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every company gets its own isolated departments, team hierarchy, connected mailboxes, client pipeline, and financial ledger.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOnboardingModalOpen(true)}
            className="btn-tactile-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register New Company</span>
          </button>
        </div>
      </div>

      {/* 3. Registered Companies & Workspaces */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Your Companies &amp; Memberships</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Switch between companies you own or belong to as a Department Head or Employee
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsOnboardingModalOpen(true)}
            className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Company</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((t) => {
            const isCurrent = currentTenant?.id === t.id;
            const roleLabel =
              t.myRole === 'company_admin'
                ? 'Owner'
                : t.myRole === 'department_head'
                ? 'Dept Head'
                : 'Employee';
            return (
              <div
                key={t.id}
                className={`rounded-xl border p-5 transition flex flex-col justify-between bg-[#FFFFFF] dark:bg-[#111827] ${
                  isCurrent
                    ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-800 dark:text-white shrink-0">
                        {t.name ? t.name.slice(0, 2).toUpperCase() : 'CO'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-950 dark:text-white truncate">
                          {t.name}
                        </h4>
                        <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate block">
                          {roleLabel}
                          {t.myDesignation ? ` · ${t.myDesignation}` : ''}
                        </span>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {t.businessInfo?.description || 'Multi-tenant company operations & department workspace.'}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                      {t.industry || t.businessInfo?.industry || 'B2B Operations'}
                    </span>
                    <span className="flex items-center gap-1 font-mono tabular-nums">
                      <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      {t.activeMembersCount || 1} {t.activeMembersCount === 1 ? 'Member' : 'Members'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-slate-400 truncate">
                    {t.departmentsCount ?? 0} Depts
                  </span>

                  <button
                    type="button"
                    onClick={() => handleEnterWorkspace(t)}
                    className="btn-tactile-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Open Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Role-Filtered Module Shortcuts */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Authorized Modules</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {roleShortcuts.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveTab(mod.id as any)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#FFFFFF] dark:bg-[#111827] hover:border-indigo-300 dark:hover:border-slate-700 text-left transition cursor-pointer space-y-2"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-950 dark:text-white">{mod.title}</div>
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
