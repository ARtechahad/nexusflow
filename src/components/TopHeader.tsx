import React from 'react';
import {
  Menu,
  Search,
  Coins,
  User,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Bell,
  BookOpen,
  Activity
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SupportedCurrency } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { TenantSwitcher } from './TenantSwitcher';

interface TopHeaderProps {
  onOpenMobileSidebar: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onOpenMobileSidebar }) => {
  const {
    activeTab,
    setActiveTab,
    role,
    currentUser,
    currentTenant,
    setIsAuthModalOpen,
    currency,
    setCurrency,
    unreadActivityCount,
    setIsActivityFeedOpen,
    setIsWikiModalOpen,
    setIsPlatformHealthModalOpen,
    setIsCommandPaletteOpen,
    setIsCreativeStudioOpen
  } = useApp();

  const tabTitles: Record<string, { title: string; section: string }> = {
    pipeline: { title: 'Pipeline & Deals', section: 'Command Center' },
    outreach_suite: { title: 'Outreach Suite', section: 'Command Center' },
    inbox: { title: 'Unified Omni-Inbox', section: 'Command Center' },
    gmail: { title: 'Gmail Workspace', section: 'Command Center' },
    outreach: { title: 'AI Lead Finder', section: 'Command Center' },
    commissions: { title: 'Commission Ledger', section: 'Revenue & Splits' },
    analytics: { title: 'Revenue Analytics', section: 'Revenue & Splits' },
    departmental: { title: 'Department Velocity', section: 'Delivery & SOP' },
    sop: { title: 'SOP 1–11 Rules', section: 'Delivery & SOP' },
    vault: { title: 'Secure File Vault', section: 'Delivery & SOP' },
    portal: { title: 'Client Portal', section: 'Delivery & SOP' },
    chat: { title: 'Team Channels', section: 'Platform' },
    free_apis: { title: 'Forex & DNS Tools', section: 'Platform' },
    integrations: { title: 'Integrations & Hooks', section: 'Platform' },
    docs: { title: 'API & MCP Docs', section: 'Platform' },
    leadflow: { title: 'Product Showcase', section: 'Platform' },
    profile: { title: 'Profile & Workspaces', section: 'Account' }
  };

  const currentViewMeta = tabTitles[activeTab] || { title: 'Operations Dashboard', section: 'Workspace' };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0a192f]/95 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto w-full h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
        {/* Left: Mobile Sidebar Toggle, Tenant Switcher & Clean Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="Open Navigation Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:block shrink-0">
            <TenantSwitcher compact={true} />
          </div>

          <nav className="flex items-center gap-1.5 text-xs min-w-0" aria-label="Breadcrumb">
            <span className="hidden xl:inline text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
              {currentTenant?.name || 'Workspace'}
            </span>
            <ChevronRight className="hidden xl:inline w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
            <span className="hidden md:inline text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap">
              {currentViewMeta.section}
            </span>
            <ChevronRight className="hidden md:inline w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
            <h1 className="text-sm sm:text-base font-bold text-slate-950 dark:text-white tracking-tight truncate">
              {currentViewMeta.title}
            </h1>
          </nav>
        </div>

        {/* Center / Right: Prominent Quick Command Search Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="flex items-center justify-between gap-3 sm:w-56 md:w-64 lg:w-72 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900 transition cursor-pointer text-xs shadow-2xs"
            title="Quick Command Search (⌘K / Ctrl+K)"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="hidden sm:inline truncate">Search deals, outreach, commands...</span>
              <span className="sm:hidden">Search</span>
            </span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-mono text-slate-600 dark:text-slate-300 font-semibold shrink-0">
              ⌘K
            </kbd>
          </button>

        {/* Compact Utility Controls */}
        <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-xs">
          <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
            className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-hidden cursor-pointer font-mono"
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
          onClick={() => setIsCreativeStudioOpen(true)}
          className="hidden md:flex p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="AI Creative Studio & Media Vault"
          aria-label="AI Creative Studio"
        >
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </button>

        <button
          type="button"
          onClick={() => setIsWikiModalOpen(true)}
          className="hidden sm:flex p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Company Wiki & Knowledge Base"
          aria-label="Company Wiki"
        >
          <BookOpen className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsPlatformHealthModalOpen(true)}
          className="hidden lg:flex p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Platform & Services Health Monitor"
          aria-label="Platform Health"
        >
          <Activity className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsActivityFeedOpen(true)}
          className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Activity Feed & Alerts"
          aria-label="Activity Feed"
        >
          <Bell className="w-4 h-4" />
          {unreadActivityCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-mono tabular-nums font-bold flex items-center justify-center">
              {unreadActivityCount}
            </span>
          )}
        </button>

        <div className="hidden sm:block">
          <ThemeToggle variant="compact" />
        </div>

        <button
          type="button"
          onClick={() => (currentUser ? setActiveTab('profile') : setIsAuthModalOpen(true))}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
          title="Personal Profile & Role Settings"
        >
          <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <span className="hidden md:inline truncate max-w-[110px]">
            {currentUser?.name?.split(' ')[0] || role.replace('_', ' ')}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </button>
        </div>
      </div>
    </header>
  );
};
