import React from 'react';
import {
  ArrowRight,
  Mail,
  Kanban,
  CheckSquare,
  Coins,
  Layers,
  ShieldCheck,
  Inbox,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ThemeToggle } from './ThemeToggle';

interface LeadFlowLandingViewProps {
  onOpenSignIn?: () => void;
  onOpenSignUp?: () => void;
  onEnterWorkspace?: () => void;
}

export const LeadFlowLandingView: React.FC<LeadFlowLandingViewProps> = ({
  onOpenSignIn,
  onOpenSignUp,
  onEnterWorkspace
}) => {
  const { currentUser, setActiveTab } = useApp();

  const handleSignInClick = () => {
    if (currentUser) {
      if (onEnterWorkspace) onEnterWorkspace();
      else setActiveTab('pipeline');
    } else if (onOpenSignIn) {
      onOpenSignIn();
    }
  };

  const handleGetStartedClick = () => {
    if (currentUser) {
      if (onEnterWorkspace) onEnterWorkspace();
      else setActiveTab('pipeline');
    } else if (onOpenSignUp) {
      onOpenSignUp();
    } else if (onOpenSignIn) {
      onOpenSignIn();
    }
  };

  const coreModules = [
    {
      number: '01',
      icon: Mail,
      title: 'Connected Email & Unified Inbox',
      description:
        'Connect company SMTP/IMAP or Google/Microsoft mailboxes to send, receive, and manage all client communication directly inside the app.',
      accent: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-100 dark:border-indigo-500/20'
    },
    {
      number: '02',
      icon: Kanban,
      title: 'Client Deals & Operations Pipeline',
      description:
        'Track every project and deal from initial inquiry to final client delivery with clear stage gates across Kanban, table, and timeline views.',
      accent: 'text-sky-600 dark:text-sky-400',
      iconBg: 'bg-sky-50 dark:bg-sky-950/70 border-sky-100 dark:border-sky-500/20'
    },
    {
      number: '03',
      icon: CheckSquare,
      title: 'Team Task & Workflow Management',
      description:
        'Assign tasks to engineering, design, and sales roles, track deadlines with live sprint timers, and enforce SOP milestones across departments.',
      accent: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-100 dark:border-emerald-500/20'
    },
    {
      number: '04',
      icon: Coins,
      title: 'Financial & Commission Ledger',
      description:
        'Track project payments, 50% upfront advance clearances, balance escrow locks, and automated team or partner payout splits.',
      accent: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-50 dark:bg-amber-950/70 border-amber-100 dark:border-amber-500/20'
    }
  ];

  const howItWorksSteps = [
    {
      step: '01',
      icon: Building2,
      title: 'Sign in & create your company workspace',
      detail:
        'Create an account with your company name and work email—or sign in with Google—to launch directly into your operations dashboard.'
    },
    {
      step: '02',
      icon: Inbox,
      title: 'Connect your company email mailboxes',
      detail:
        'Link Google Workspace or custom SMTP/IMAP accounts so every outbound email and client thread syncs directly inside your unified inbox.'
    },
    {
      step: '03',
      icon: ShieldCheck,
      title: 'Run deals, team tasks & financial splits',
      detail:
        'Assign departmental tasks, verify 50% advance clearances, lock domain handover until balance settles, and audit team payouts in real time.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] bg-canvas-textured text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white transition-colors duration-200">
      {/* 1. CLEAN TOP NAVBAR */}
      <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-bold text-base text-slate-950 dark:text-white tracking-tight whitespace-nowrap">
              ClientOps
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a
              href="#core-modules"
              className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              Core Modules
            </a>
            <a
              href="#how-it-works"
              className="hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap"
            >
              How It Works
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle variant="compact" />
            <button
              type="button"
              onClick={handleSignInClick}
              className="btn-tactile-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{currentUser ? 'Open Workspace' : 'Sign In'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. CRISP HERO SECTION */}
      <main className="flex-1">
        <section className="py-16 sm:py-24 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
              <div className="lg:col-span-6 space-y-6">
                <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-950 dark:text-white tracking-tight leading-[1.1]">
                  Run Your Entire Company Operations &amp; Client Communication in One Workspace
                </h1>

                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  Connect your company email accounts, manage client deals and stage pipelines, assign team tasks across departments, and track financial splits from a single unified workspace.
                </p>

                <div className="pt-2 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleGetStartedClick}
                    className="btn-tactile-primary px-6 py-3 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>{currentUser ? 'Enter Workspace' : 'Get Started'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Crisp Elevated Architectural Workspace Preview */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/50">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Unified Workspace Architecture
                    </span>
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      Multi-Tenant &bull; Mailbox Sync
                    </span>
                  </div>

                  <div className="p-5 sm:p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16]">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                          <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <span>Email Hub</span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          SMTP/IMAP &amp; Google Workspace mailboxes wired into one shared client thread view.
                        </p>
                      </div>

                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16]">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                          <Kanban className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>Deals Pipeline</span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Intake, scoping, 50% deposit verification, staging review, and domain handover.
                        </p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                        <span>Operational Enforcement Gates</span>
                        <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                          Database-Backed
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>50% Advance Check</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Departmental Tasks</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Commission Splits</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 4-CARD CORE CAPABILITIES GRID */}
        <section id="core-modules" className="py-16 sm:py-20 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Core Modules
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight mt-1">
                Four connected modules built for daily operations
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Every workflow connects directly to your company mailbox, client deals database, and team ledger.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {coreModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={mod.number}
                    className="p-6 rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${mod.iconBg} ${mod.accent}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                        {mod.number}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-950 dark:text-white">
                      {mod.title}
                    </h3>

                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. HOW IT WORKS */}
        <section id="how-it-works" className="py-16 sm:py-20 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                How It Works
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight mt-1">
                From account sign-in to full team execution
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {howItWorksSteps.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="p-6 rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        Step {item.step}
                      </span>
                      <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* 5. SIMPLE FOOTER */}
      <footer className="bg-[#FFFFFF] dark:bg-[#111827] border-t border-slate-200 dark:border-slate-800 py-8 text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm text-slate-950 dark:text-white">ClientOps</span>
            <span className="text-slate-300 dark:text-slate-700">&bull;</span>
            <span>Company Operations &amp; Client Communication Platform</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#core-modules" className="hover:text-slate-950 dark:hover:text-white transition-colors">
              Core Modules
            </a>
            <a href="#how-it-works" className="hover:text-slate-950 dark:hover:text-white transition-colors">
              How It Works
            </a>
            <button
              type="button"
              onClick={handleSignInClick}
              className="btn-tactile-secondary px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              {currentUser ? 'Open Workspace' : 'Workspace Login'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
