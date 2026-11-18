import React from 'react';
import { Layers, Users, CheckSquare, ArrowRight, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TenantSwitcher } from './TenantSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { DEPARTMENT_MODULE_DEFINITIONS, getDepartmentAllowedModules } from '../utils/departmentAccess';

export const DepartmentSelectorView: React.FC = () => {
  const {
    currentUser,
    currentTenant,
    companyRole,
    departments,
    setSelectedDepartmentId,
    setActiveTab,
    logout
  } = useApp();

  const handleSelectDepartment = (deptId: string) => {
    const dept = departments.find((d) => d.id === deptId);
    const mods = getDepartmentAllowedModules(dept);
    setSelectedDepartmentId(deptId);
    if (mods.includes('operations')) setActiveTab('departmental');
    else if (mods.includes('chat')) setActiveTab('chat');
    else if (mods.includes('email_hub')) setActiveTab('outreach_suite');
    else if (mods.includes('client_inbox')) setActiveTab('inbox');
    else if (mods.includes('financials')) setActiveTab('commissions');
    else setActiveTab('profile');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] bg-canvas-textured text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <TenantSwitcher compact={true} />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {currentUser?.name} &middot; {currentTenant?.myDesignation || (companyRole === 'department_head' ? 'Department Head' : 'Employee')}
            </span>
            <ThemeToggle variant="compact" />
            <button
              type="button"
              onClick={logout}
              className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Selector Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-4xl space-y-6 animate-fadeIn">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {currentTenant?.name}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              Select a Department Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              You belong to {departments.length} departments in {currentTenant?.name}. Choose one to open its enabled modules and team workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => {
              const totalTasks = dept.tasksTotal ?? 0;
              const completedTasks = dept.tasksCompleted ?? 0;
              const openTasks = Math.max(0, totalTasks - completedTasks);
              const enabledModules = getDepartmentAllowedModules(dept);
              const moduleSummary = DEPARTMENT_MODULE_DEFINITIONS
                .filter((m) => enabledModules.includes(m.key))
                .map((m) => m.label)
                .join(' · ');

              return (
                <div
                  key={dept.id}
                  className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-indigo-400 dark:hover:border-indigo-500/50 transition"
                >
                  <div className="space-y-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>

                    <div>
                      <h2 className="text-base font-bold text-slate-950 dark:text-white">
                        {dept.name}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {dept.description || `${dept.name} department operations and tasks.`}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums pt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{dept.memberCount ?? 1} members</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span>{openTasks} open</span>
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {moduleSummary || 'No modules enabled'}
                    </div>
                  </div>

                  <button
                    type="button"
                    id={`btn-select-dept-${dept.id}`}
                    onClick={() => handleSelectDepartment(dept.id)}
                    className="btn-tactile-primary w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Enter Department</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};
