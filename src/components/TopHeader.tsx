import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Coins,
  User,
  ChevronDown,
  ChevronRight,
  Bell,
  BookOpen,
  LogOut,
  Building2,
  Settings,
  Plus,
  Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AvailabilityStatus, SupportedCurrency } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { TenantSwitcher } from './TenantSwitcher';

interface TopHeaderProps {
  onOpenMobileSidebar: () => void;
}

const AVAILABILITY_OPTIONS: AvailabilityStatus[] = [
  'Available',
  'In a Meeting',
  'Busy',
  'Offline'
];

function getAvailabilityDotClass(status?: AvailabilityStatus): string {
  switch (status) {
    case 'Available':
      return 'bg-emerald-500';
    case 'In a Meeting':
      return 'bg-amber-500';
    case 'Busy':
      return 'bg-rose-500';
    default:
      return 'bg-slate-400';
  }
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenMobileSidebar }) => {
  const {
    activeTab,
    setActiveTab,
    companyRole,
    currentUser,
    currentTenant,
    departments,
    selectedDepartmentId,
    setSelectedDepartmentId,
    updateMyAvailability,
    setIsOnboardingModalOpen,
    logout,
    setIsAuthModalOpen,
    currency,
    setCurrency,
    unreadActivityCount,
    setIsActivityFeedOpen,
    setIsWikiModalOpen,
    setIsCommandPaletteOpen
  } = useApp();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const isCompanyOwner = companyRole === 'company_admin';

  const tabTitles: Record<string, { title: string; section: string }> = {
    overview: { title: 'Company Overview', section: 'Workspace' },
    departments: { title: 'Departments & Team', section: 'Workspace' },
    departmental: {
      title: isCompanyOwner ? 'Operations & Tasks' : 'Department Operations',
      section: 'Workspace'
    },
    chat: { title: 'Department Chat', section: 'Workspace' },
    outreach_suite: { title: 'Email Outreach', section: 'Optional Modules' },
    inbox: { title: 'Unified Client Inbox', section: 'Optional Modules' },
    gmail: { title: 'Google Mailbox Sync', section: 'Optional Modules' },
    commissions: { title: 'Commission Ledger', section: 'Optional Modules' },
    analytics: { title: 'Revenue Analytics', section: 'Optional Modules' },
    pipeline: { title: 'Executive Dashboard', section: 'Optional Modules' },
    sop: { title: 'SOP Stage Gates', section: 'Optional Modules' },
    vault: { title: 'Secure File Vault', section: 'Optional Modules' },
    portal: { title: 'Client Portal', section: 'Optional Modules' },
    integrations: { title: 'Webhooks & API', section: 'Optional Modules' },
    profile: { title: isCompanyOwner ? 'Account & Settings' : 'My Profile', section: 'My Account' }
  };

  const currentViewMeta = tabTitles[activeTab] || {
    title: isCompanyOwner ? 'Company Overview' : 'Department Operations',
    section: 'Workspace'
  };
  const activeDept = departments.find((d) => d.id === selectedDepartmentId);
  const myAvailability: AvailabilityStatus = currentUser?.availabilityStatus || 'Available';

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-[#E2E8F0] dark:border-slate-800 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto w-full h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left: Mobile Sidebar Toggle, Company Switcher, Department Switcher & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="lg:hidden btn-tactile-secondary p-2 rounded-lg cursor-pointer shrink-0"
            aria-label="Open Navigation Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:block shrink-0">
            <TenantSwitcher compact={true} />
          </div>

          {departments.length > 0 && (companyRole === 'company_admin' || departments.length > 1) && (
            <>
              <div className="hidden sm:block h-5 w-px bg-[#E2E8F0] dark:bg-slate-800 shrink-0" />
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#111827] text-xs shrink-0">
                <Layers className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400 shrink-0" />
                <select
                  id="select-header-department"
                  value={selectedDepartmentId || ''}
                  onChange={(e) => setSelectedDepartmentId(e.target.value || null)}
                  className="bg-transparent text-[#0F172A] dark:text-white text-xs font-semibold focus:outline-hidden cursor-pointer max-w-[140px]"
                  aria-label="Active Department"
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id} className="bg-white dark:bg-slate-900 text-[#0F172A] dark:text-white">
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="hidden md:block h-5 w-px bg-[#E2E8F0] dark:bg-slate-800 shrink-0" />

          <nav className="flex items-center gap-1.5 text-xs min-w-0" aria-label="Breadcrumb">
            {activeDept && (
              <>
                <span className="hidden 2xl:inline text-[#64748B] dark:text-slate-400 font-medium whitespace-nowrap truncate max-w-[120px]">
                  {activeDept.name}
                </span>
                <ChevronRight className="hidden 2xl:inline w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
              </>
            )}
            <h1 className="text-sm font-semibold text-[#0F172A] dark:text-white tracking-tight truncate">
              {currentViewMeta.title}
            </h1>
          </nav>
        </div>

        {/* Right: Roomy Search Bar, Subtle Divider, Status Pill, Notifications, Theme & Account */}
        <div className="flex items-center gap-2.5 shrink-0">
          {companyRole !== 'employee' && (
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center justify-between gap-3 w-64 lg:w-72 px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#111827] text-[#64748B] dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer text-xs shadow-[0_1px_2px_rgba(15,23,42,0.03)] shrink-0 whitespace-nowrap"
              title="Quick Command Search (⌘K)"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
                <span>Search workspace...</span>
              </span>
              <kbd className="inline-flex items-center px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-[10px] font-mono text-[#64748B] dark:text-slate-300 font-semibold shrink-0">
                ⌘K
              </kbd>
            </button>
          )}

          <div className="hidden md:block h-5 w-px bg-[#E2E8F0] dark:bg-slate-800 shrink-0" />

          {/* Clean Live Availability Status Pill */}
          {currentUser && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E2E8F0] dark:border-slate-800 bg-[#FFFFFF] dark:bg-[#111827] text-xs shadow-[0_1px_2px_rgba(15,23,42,0.03)] shrink-0 whitespace-nowrap">
              <span className={`w-2 h-2 rounded-full shrink-0 ${getAvailabilityDotClass(myAvailability)}`} />
              <select
                id="select-my-availability"
                value={myAvailability}
                onChange={(e) => updateMyAvailability(e.target.value as AvailabilityStatus)}
                className="bg-transparent text-[#0F172A] dark:text-slate-200 text-xs font-medium focus:outline-hidden cursor-pointer pr-0.5"
                aria-label="Your Availability Status"
              >
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} className="bg-white dark:bg-slate-900 text-[#0F172A] dark:text-white">
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {companyRole !== 'employee' && (
            <button
              type="button"
              onClick={() => setIsActivityFeedOpen(true)}
              className="relative p-2 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-[#FFFFFF] dark:bg-[#111827] text-[#64748B] dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              title="Activity Feed & Alerts"
              aria-label="Activity Feed"
            >
              <Bell className="w-4 h-4" />
              {unreadActivityCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#4F46E5] text-white text-[9px] font-mono tabular-nums font-bold flex items-center justify-center">
                  {unreadActivityCount}
                </span>
              )}
            </button>
          )}

          <div className="hidden sm:block shrink-0">
            <ThemeToggle variant="compact" />
          </div>

          <div className="hidden sm:block h-5 w-px bg-[#E2E8F0] dark:bg-slate-800 shrink-0" />

          <div className="relative" ref={profileMenuRef}>
            <button
              id="btn-header-user-menu"
              type="button"
              onClick={() => (currentUser ? setProfileMenuOpen((prev) => !prev) : setIsAuthModalOpen(true))}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-[#FFFFFF] dark:bg-[#111827] text-[#0F172A] dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              title="Account & Workspace Menu"
            >
              <User className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
              <span className="hidden md:inline truncate max-w-[110px]">
                {currentUser?.name?.split(' ')[0] || 'Account'}
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {currentUser && profileMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 rounded-xl border border-[#E2E8F0] dark:border-slate-800 bg-[#FFFFFF] dark:bg-[#111827] shadow-xl py-1.5 z-50 animate-fadeIn"
              >
                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-0.5">
                  <div className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-[#64748B] dark:text-slate-400 truncate">
                    {currentUser.email}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-[#4F46E5] dark:text-indigo-400 truncate">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      {currentTenant?.name || 'Personal Profile'}
                      {currentTenant?.myDesignation ? ` · ${currentTenant.myDesignation}` : ''}
                    </span>
                  </div>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActiveTab('profile');
                      setProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer text-left"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
                    <span>{isCompanyOwner ? 'Account & Settings' : 'My Profile & Details'}</span>
                  </button>

                  {companyRole !== 'employee' && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setIsWikiModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer text-left"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
                      <span>Company Knowledge Base</span>
                    </button>
                  )}

                  {isCompanyOwner && (
                    <>
                      <div className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span className="flex items-center gap-2.5">
                          <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Currency</span>
                        </span>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                          className="bg-[#F8FAFC] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-mono text-[#0F172A] dark:text-white cursor-pointer"
                          aria-label="Workspace Display Currency"
                        >
                          <option value="USD">USD</option>
                          <option value="GBP">GBP</option>
                          <option value="EUR">EUR</option>
                          <option value="AUD">AUD</option>
                          <option value="AED">AED</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setIsOnboardingModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition cursor-pointer text-left"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#64748B] dark:text-slate-400 shrink-0" />
                        <span>Register New Company</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="p-1.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    id="btn-header-logout"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
