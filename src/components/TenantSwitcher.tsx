import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  ChevronDown, 
  Check, 
  Plus, 
  Sparkles, 
  ShieldCheck, 
  Globe 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Tenant } from '../types';

export const TenantSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentTenant, tenants, switchTenant, setIsOnboardingModalOpen } = useApp();
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

  const activeTenantName = currentTenant?.name || 'ALM Nexus Global';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-xl border transition-all cursor-pointer ${
          compact
            ? 'px-2 py-1 bg-slate-100 dark:bg-slate-900/90 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
            : 'px-3 py-1.5 bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
        }`}
        title="Active Multi-Tenant Organization Workspace"
      >
        <div className="w-5 h-5 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        
        <div className="text-left overflow-hidden">
          <span className="text-xs font-bold text-slate-900 dark:text-white truncate block max-w-[120px] sm:max-w-[150px]">
            {activeTenantName}
          </span>
          {!compact && (
            <span className="text-[9px] uppercase font-mono text-slate-500 dark:text-slate-400 block -mt-0.5">
              Tenant Isolation
            </span>
          )}
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-64 bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-fadeIn">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
            Switch Organization
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {tenants.map(t => {
              const isSelected = currentTenant?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    switchTenant(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-700/40'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: t.branding?.primaryColor || '#6366f1' }} 
                    />
                    <div className="truncate text-left">
                      <span className="block truncate font-bold text-xs">{t.name}</span>
                      <span className="block text-[10px] text-slate-400 font-mono truncate">{t.businessInfo?.industry || 'B2B'}</span>
                    </div>
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-white/10">
            <button
              onClick={() => {
                setIsOpen(false);
                setIsOnboardingModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition cursor-pointer border border-indigo-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Onboard New Company</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
