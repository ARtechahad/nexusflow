import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CompanyRole } from '../types';

function formatCompanyRoleLabel(role?: CompanyRole): string {
  if (role === 'company_admin') return 'Owner';
  if (role === 'department_head') return 'Dept Head';
  if (role === 'employee') return 'Employee';
  return 'Member';
}

export const TenantSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentTenant, tenants, companyRole, switchTenant, setIsOnboardingModalOpen } = useApp();
  const canRegisterCompany = companyRole === 'company_admin' || tenants.length === 0;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTenantName = currentTenant?.name || 'Select Company';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="btn-company-switcher"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-lg border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
          compact
            ? 'px-2.5 py-1.5 bg-[#F8FAFC] dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            : 'px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#111827] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
        title="Switch Active Company Workspace"
      >
        <div className="w-5 h-5 rounded-md bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>

        <div className="text-left min-w-0">
          <span className="text-xs font-bold text-slate-950 dark:text-white truncate block max-w-[130px] sm:max-w-[170px]">
            {activeTenantName}
          </span>
          {!compact && currentTenant?.myRole && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block -mt-0.5">
              {formatCompanyRoleLabel(currentTenant.myRole)}
            </span>
          )}
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-72 bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-2 space-y-1 animate-fadeIn">
          <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Your Companies ({tenants.length})
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1">
            {tenants.map((t) => {
              const isSelected = currentTenant?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    switchTenant(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-700/40'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="min-w-0 text-left pr-2">
                    <span className="block truncate font-bold text-xs text-slate-950 dark:text-white">
                      {t.name}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {formatCompanyRoleLabel(t.myRole)} &middot; {t.businessInfo?.industry || 'Operations'}
                    </span>
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {canRegisterCompany && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                id="btn-register-new-company"
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsOnboardingModalOpen(true);
                }}
                className="btn-tactile-secondary w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Company</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
