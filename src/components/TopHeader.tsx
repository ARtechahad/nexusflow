import React from 'react';
import { 
  Menu, 
  Search, 
  CheckCircle2, 
  Database, 
  ShieldCheck, 
  Coins, 
  User,
  Sparkles,
  ChevronDown,
  Sun,
  Moon,
  Bell,
  BookOpen,
  Activity,
  Layers
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SupportedCurrency, UserRole } from '../types';
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
    firebaseUser,
    setIsAuthModalOpen,
    currency,
    setCurrency,
    automatedTestsPassedCount,
    databaseStatus,
    isDark,
    setIsDark,
    showToast,
    unreadActivityCount,
    setIsActivityFeedOpen,
    setIsWikiModalOpen,
    setIsPlatformHealthModalOpen,
    setIsCommandPaletteOpen,
    setIsCreativeStudioOpen
  } = useApp();

  const tabTitles: Record<string, { title: string; subtitle: string }> = {
    pipeline: { title: 'Pipeline & Lead Deals', subtitle: 'Step 1–5: Discovery, Pricing, 50% Advance & Staging' },
    departmental: { title: 'Departmental Progress & Velocity', subtitle: 'Cross-functional tracking for Sales, PM, Engineering & Design' },
    inbox: { title: 'Unified Omni-Inbox', subtitle: 'Centralized client conversations across LinkedIn, Upwork & Email' },
    outreach: { title: 'AI Cold Outreach Engine', subtitle: 'Lead scraper, automated follow-ups & connection templates' },
    sop: { title: 'International Client SOP Rules', subtitle: '11-Step Quality Gate, Commission Rules & Milestone Protections' },
    analytics: { title: 'Executive Operations Analytics', subtitle: 'Revenue forecasts, conversion funnels & SLA monitoring' },
    free_apis: { title: 'Global Agency Live Free APIs', subtitle: 'Live Currency Forex, Cloudflare DNS-over-HTTPS & Client Geo Radar' },
    commissions: { title: 'Commission Calculator & Splits', subtitle: 'SOP Section 6 tiered payout matrix & audit logs' },
    chat: { title: 'Team Collaboration Hub', subtitle: 'Internal channels for Sales, Devs & Operations' },
    vault: { title: 'Encrypted Credential Vault', subtitle: 'RBAC protected hosting, Git & domain credentials' },
    integrations: { title: 'Webhooks & External Connectors', subtitle: 'Live Stripe, PayPal IPN, Upwork & Discord channels' },
    portal: { title: 'Isolated Client Portal', subtitle: 'Live milestone reviews, invoice settlement & handover archive' }
  };

  const currentViewMeta = tabTitles[activeTab] || { title: 'Operations Dashboard', subtitle: 'Client Operations Suite' };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0a192f]/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Left: Mobile Toggle & Page Title & Tenant Switcher */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Open Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <TenantSwitcher compact={true} />
        </div>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            {currentViewMeta.title}
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block font-normal">
            {currentViewMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Quick Context Badges */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        
        {/* Global Command Palette Launcher (⌘K) */}
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-xs"
          title="Global Command Palette (Ctrl+K / ⌘K)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden xl:inline text-[11px] text-slate-500 dark:text-slate-400">Search commands...</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[9px] font-mono text-slate-500 font-semibold">⌘K</kbd>
        </button>

        {/* AI Creative Studio & Media Vault Button */}
        <button
          onClick={() => setIsCreativeStudioOpen(true)}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="AI Creative Studio & Media Vault"
        >
          <Sparkles className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </button>

        {/* Global Wiki Button */}
        <button
          onClick={() => setIsWikiModalOpen(true)}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Company Wiki & Knowledge Base"
        >
          <BookOpen className="w-4 h-4" />
        </button>

        {/* Real-Time Activity Feed Bell */}
        <button
          onClick={() => setIsActivityFeedOpen(true)}
          className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Activity Feed & Live Stream"
        >
          <Bell className="w-4 h-4" />
          {unreadActivityCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-mono font-bold flex items-center justify-center">
              {unreadActivityCount}
            </span>
          )}
        </button>

        {/* Platform Health Monitor */}
        <button
          onClick={() => setIsPlatformHealthModalOpen(true)}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-medium hover:bg-emerald-500/20 transition cursor-pointer"
          title="External APIs Health Monitor"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Health OK</span>
        </button>

        {/* LeadFlow Agency GTM Portal Quick Button */}
        <button
          onClick={() => setActiveTab('leadflow')}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition cursor-pointer"
          title="View LeadFlow Agency Public Website"
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-500" />
          <span>LeadFlow Site</span>
        </button>

        {/* Professional Real Light / Dark / System Mode Switcher */}
        <ThemeToggle variant="compact" />

        {/* Currency Quick Switcher */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-xs font-medium">
          <Coins className="w-3.5 h-3.5 text-amber-500" />
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value as SupportedCurrency)}
            className="bg-transparent text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-hidden cursor-pointer"
          >
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="EUR">EUR (€)</option>
            <option value="AUD">AUD (A$)</option>
            <option value="AED">AED (AED)</option>
          </select>
        </div>

        {/* Firebase / Google Auth Quick Badge */}
        {firebaseUser ? (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-600/25 transition cursor-pointer"
            title={`Firebase Verified: ${firebaseUser.email}`}
          >
            {firebaseUser.photoURL ? (
              <img src={firebaseUser.photoURL} alt="Google" className="w-4 h-4 rounded-full" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
            <span className="font-mono text-[11px] truncate max-w-[110px]">{firebaseUser.displayName || firebaseUser.email}</span>
            <span className="text-[9px] uppercase font-mono px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Firebase</span>
          </button>
        ) : (
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shadow-2xs"
            title="Sign in with Google Firebase"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span className="text-[11px]">Sign in with Google</span>
          </button>
        )}

        {/* Role Switcher Pill */}
        <button
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          title="Click to switch persona role"
        >
          <User className="w-3.5 h-3.5 text-slate-500" />
          <span className="capitalize">{role.replace('_', ' ')}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    </header>
  );
};
