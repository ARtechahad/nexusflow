import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CompanyRole, UserRole } from '../types';
import { canAccessEmailModules } from '../utils/departmentAccess';

interface RoleRouteGuardProps {
  allowedRoles?: UserRole[];
  allowedCompanyRoles?: CompanyRole[];
  requireEmailHubAccess?: boolean;
  moduleName: string;
  children: React.ReactNode;
}

export const RoleRouteGuard: React.FC<RoleRouteGuardProps> = ({
  allowedRoles = [],
  allowedCompanyRoles,
  requireEmailHubAccess = false,
  moduleName,
  children
}) => {
  const { role, companyRole, departments, selectedDepartmentId, setActiveTab } = useApp();
  const activeDept = departments.find((d) => d.id === selectedDepartmentId) || departments[0] || null;

  let isAllowed = false;
  if (allowedCompanyRoles && allowedCompanyRoles.length > 0) {
    isAllowed = companyRole !== null && allowedCompanyRoles.includes(companyRole);
  } else {
    isAllowed = role === 'admin' || role === 'ceo' || role === 'bd_head' || allowedRoles.includes(role);
  }

  if (isAllowed && requireEmailHubAccess) {
    isAllowed = canAccessEmailModules(companyRole, activeDept, departments);
  }

  if (!isAllowed) {
    const fallbackTab =
      role === 'client_guest'
        ? 'portal'
        : companyRole === 'company_admin'
        ? 'pipeline'
        : 'departmental';

    const displayRole = companyRole
      ? companyRole.replace('_', ' ').toUpperCase()
      : role.replace('_', ' ').toUpperCase();

    return (
      <div className="p-6 sm:p-10 max-w-2xl mx-auto my-12 animate-fadeIn">
        <div className="p-6 sm:p-8 rounded-2xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 mx-auto mb-4 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300 text-xs font-mono font-bold mb-2">
            <Lock className="w-3.5 h-3.5" />
            <span>ACCESS RESTRICTED (403)</span>
          </div>

          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            Restricted Module: {moduleName}
          </h3>

          <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto leading-relaxed">
            Your active company role (<strong className="font-mono text-slate-800 dark:text-slate-200">{displayRole}</strong>) does not authorize access to <em>{moduleName}</em>.
          </p>

          <button
            type="button"
            onClick={() => setActiveTab(fallbackTab)}
            className="btn-tactile-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Authorized Workspace</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
