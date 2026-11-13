import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  Mail,
  Calendar,
  BarChart3,
  Clock,
  Send,
  Lock,
  Building2,
  Layers,
  ChevronDown,
  RefreshCw,
  Database,
  Kanban,
  Coins,
  Globe2,
  UserCheck,
  FileCheck2,
  BookOpen
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LeadFlowBookingModal } from './LeadFlowBookingModal';
import { LeadFlowRoiCalculator } from './LeadFlowRoiCalculator';
import { LeadFlowFreeToolsSection } from './LeadFlowFreeToolsSection';
import { ThemeToggle } from './ThemeToggle';
import { LeadFlowSoftwareSection } from './LeadFlowSoftwareSection';
import { DocsView } from './DocsView';

interface LeadFlowLandingViewProps {
  onOpenLoginModal?: () => void;
  onEnterWorkspace?: () => void;
}

export const LeadFlowLandingView: React.FC<LeadFlowLandingViewProps> = ({
  onOpenLoginModal,
  onEnterWorkspace
}) => {
  const {
    currentUser,
    showToast,
    setActiveTab,
    refreshProjects
  } = useApp();

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedPlanForBooking, setSelectedPlanForBooking] = useState('Business Workspace Plan');
  const [activeWorkflowStage, setActiveWorkflowStage] = useState<number>(0);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [currencyMultiplier, setCurrencyMultiplier] = useState(1);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [checkingOutTier, setCheckingOutTier] = useState<string | null>(null);
  const [showDocsModal, setShowDocsModal] = useState(false);

  React.useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('checkout') === 'success') {
        const tier = urlParams.get('tier') || 'business';
        const amount = urlParams.get('amount') || '2,990';
        showToast(`Payment confirmed. Stripe session verified for ${tier.toUpperCase()} tier ($${amount}).`, 'success');
        if (refreshProjects) refreshProjects();
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const handleCurrencyChange = (curr: 'USD' | 'EUR' | 'GBP') => {
    setCurrency(curr);
    if (curr === 'USD') {
      setCurrencyMultiplier(1);
      setCurrencySymbol('$');
    } else if (curr === 'EUR') {
      setCurrencyMultiplier(0.92);
      setCurrencySymbol('€');
    } else {
      setCurrencyMultiplier(0.79);
      setCurrencySymbol('£');
    }
  };

  const handleOpenBooking = (planName?: string) => {
    if (planName) setSelectedPlanForBooking(planName);
    setIsBookingModalOpen(true);
  };

  const handleChoosePlanCheckout = async (tier: 'pilot' | 'business' | 'enterprise', planTitle: string, basePrice: number) => {
    setCheckingOutTier(tier);
    try {
      const finalAmount = Math.round(basePrice * currencyMultiplier);
      const res = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: tier,
          planName: `${planTitle} (${currencySymbol}${finalAmount}/mo)`,
          amount: finalAmount,
          currency,
          customerName: currentUser?.name || 'Workspace Owner',
          customerEmail: currentUser?.email || 'owner@company.com',
          companyName: 'Client Enterprise'
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.url) {
        showToast(`Creating Stripe checkout session for ${planTitle}...`, 'info');
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to initialize Stripe checkout session');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error connecting to Stripe checkout', 'error');
    } finally {
      setCheckingOutTier(null);
    }
  };

  const handleAuthOrWorkspace = () => {
    if (currentUser) {
      if (onEnterWorkspace) onEnterWorkspace();
      else setActiveTab('profile');
    } else if (onOpenLoginModal) {
      onOpenLoginModal();
    }
  };

  const workflowStages = [
    {
      step: '01',
      label: 'Discovery & Scoping',
      sopRef: 'SOP Sections 1–4',
      title: 'Standardized client intake & transparent quoting',
      summary: 'Capture client requirements, website category (Landing $200–$300, E-commerce $500–$700, Corporate $800+), assets, and domain/hosting status before engineering starts.',
      checkpoints: [
        'Channel attribution across LinkedIn, Upwork, Direct Email & Referrals',
        'Domain/hosting readiness check without aggressive credential requests',
        'AI proposal & scope summary synced directly to Google Docs & Sheets'
      ]
    },
    {
      step: '02',
      label: '50% Advance Escrow',
      sopRef: 'SOP Sections 5 & 7',
      title: 'Upfront milestone verification before kick-off',
      summary: 'Enforce the 50% upfront advance rule via PayPal, Payoneer, or Stripe Checkout before authorizing development sprints and broadcasting Discord team handoffs.',
      checkpoints: [
        'Automated 50% deposit & 50% balance ledger per deal',
        'Structured Discord handoff formatting for design & engineering teams',
        'Multi-currency conversion across USD, GBP, EUR, AUD, and AED'
      ]
    },
    {
      step: '03',
      label: 'Internal Staging & QA',
      sopRef: 'SOP Sections 8 & 9',
      title: 'Isolated staging builds with 17-point SOP verification',
      summary: 'Engineering teams build exclusively on internal staging domains while tracking task swimlanes, sprint hours, and client portal review approvals.',
      checkpoints: [
        'Kanban task swimlanes prioritized by urgency with live stopwatch timer',
        'Isolated Client Portal for asynchronous staging sign-offs',
        'Strict SOP Rule 8 guard locking live domain transfer until balance clears'
      ]
    },
    {
      step: '04',
      label: 'Splits & Handover',
      sopRef: 'SOP Sections 6, 8 & 11',
      title: 'Verified domain transfer & automated commission ledger',
      summary: 'Once the remaining 50% balance clears, release encrypted vault credentials, execute live transfer, and settle tiered employee commissions automatically.',
      checkpoints: [
        'Tiered commission matrix: 25% (≤$300), 30% ($300–$700), 35% (>$700)',
        'Encrypted File Vault with role-based credential access',
        'Monthly maintenance retainer tracking & post-project retention workflow'
      ]
    }
  ];

  const capabilities = [
    {
      icon: Kanban,
      title: 'Deals Pipeline & Task Swimlanes',
      description: 'Switch seamlessly between SOP stage Kanban columns, urgency-prioritized developer swimlanes, full table grids, and milestone timelines.'
    },
    {
      icon: ShieldCheck,
      title: 'SOP 1–11 Transfer Gatekeeper',
      description: 'Programmatic Rule 8 enforcement prevents premature live domain handover until the remaining 50% balance milestone is verified.'
    },
    {
      icon: Coins,
      title: 'Tiered Commission Ledger',
      description: 'Calculate and audit sales/coordination commission payouts dynamically across $200–$800+ project tiers with high-performer overrides.'
    },
    {
      icon: Send,
      title: 'Outreach Suite & Warmup Engine',
      description: 'Connect SMTP/IMAP mailboxes, verify SPF/DKIM/DMARC DNS records, run peer-to-peer warmup, and branch A–Z outreach sequences.'
    },
    {
      icon: UserCheck,
      title: 'Isolated Client & Partner Portals',
      description: 'Give external stakeholders a scoped portal for staging reviews and NDA-masked deal appraisals without exposing internal commission margins.'
    },
    {
      icon: Database,
      title: 'Multi-Tenant Isolation & Auth',
      description: 'Onboard multiple company workspaces backed by Neon PostgreSQL row-level tenant isolation, Clerk/Google/GitHub Auth, and Resend alerts.'
    }
  ];

  const faqs = [
    {
      q: 'How does authentication and workspace onboarding work?',
      a: 'Click Login in the header to sign in via Google, GitHub, Email & Password/PIN, or inspect any role in the workspace. Immediately after login, you land on your Personal Profile Hub where you can click Get Started to register a new company workspace in four quick steps—no Tax ID or EIN required—or enter an existing company dashboard.'
    },
    {
      q: 'How does SOP Rule 8 protect project revenue?',
      a: 'Every project begins on an internal staging URL after the 50% advance payment is recorded. The live domain transfer control remains locked until the remaining 50% balance milestone is confirmed cleared.'
    },
    {
      q: 'How are employee commissions calculated?',
      a: 'Under SOP Section 6, standard tiers apply automatically by deal value: 25% for projects up to $300, 30% between $300 and $700, and 35% above $700, with optional management high-performer tier overrides.'
    },
    {
      q: 'Can we run cold email outreach without risking our main domain?',
      a: 'Yes. The built-in Outreach Suite enforces daily send caps, verifies SPF/DKIM/DMARC and MX records before launch, runs peer-to-peer inbox warmup, and lets you send strictly from dedicated secondary domains.'
    },
    {
      q: 'What happens when multiple companies share the platform?',
      a: 'Each organization operates inside an isolated tenant workspace (`tenant_id` scoping across database queries) with configurable roles, currencies, and team members.'
    }
  ];

  const activeStage = workflowStages[activeWorkflowStage];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070e1b] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white transition-colors duration-200">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-[#070e1b]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight block leading-tight">
                ClientOps Suite
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                International Client &amp; Project Ops
              </span>
            </div>
          </a>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#workflow" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap">
              Workflow
            </a>
            <a href="#capabilities" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap">
              Platform Modules
            </a>
            <a href="#calculator" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap">
              ROI Calculator
            </a>
            <a href="#software" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap">
              Outreach Engine
            </a>
            <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap">
              Plans
            </a>
            <button
              type="button"
              onClick={() => setShowDocsModal(true)}
              className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Docs &amp; API
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle variant="compact" />

            <button
              type="button"
              onClick={() => handleOpenBooking()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Book Demo</span>
            </button>

            {currentUser ? (
              <button
                type="button"
                onClick={handleAuthOrWorkspace}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Personal Profile &amp; Dashboard</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenLoginModal?.()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 1. HERO SECTION + INTERACTIVE PRODUCT WORKFLOW PREVIEW */}
      <section className="pt-14 pb-16 sm:pt-20 sm:pb-24 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070e1b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Multi-Tenant Client Operations Platform
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.12]">
                International client handling, from first outreach to paid domain handover.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                Unify B2B cold outreach, SOP 1–11 milestone enforcement, 50% advance escrow checks, tiered employee commission ledgers, and isolated client portals inside one workspace.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAuthOrWorkspace}
                  className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs transition cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <span>{currentUser ? 'Open Profile & Workspaces' : 'Sign In & Get Started'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenBooking('Platform Walkthrough')}
                  className="px-5 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold transition cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>Schedule Architecture Review</span>
                </button>
              </div>

              <div className="pt-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block font-mono tabular-nums">SOP 1–11</span>
                  <span className="text-slate-500 dark:text-slate-400">17/17 automated checks</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block font-mono tabular-nums">50% / 50%</span>
                  <span className="text-slate-500 dark:text-slate-400">Escrow transfer gate</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block font-mono tabular-nums">25%–35%</span>
                  <span className="text-slate-500 dark:text-slate-400">Tiered split ledger</span>
                </div>
              </div>
            </div>

            {/* Interactive 4-Stage Product Architecture Card (No fabricated metrics) */}
            <div id="workflow" className="lg:col-span-6">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 p-5 sm:p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Interactive Operations Blueprint
                    </span>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      End-to-End Client Delivery Lifecycle
                    </h2>
                  </div>
                  <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    Stage {activeStage.step}/04
                  </span>
                </div>

                {/* Stage Selector Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {workflowStages.map((stage, idx) => (
                    <button
                      key={stage.step}
                      type="button"
                      onClick={() => setActiveWorkflowStage(idx)}
                      className={`px-2.5 py-2 rounded-lg text-left text-xs transition cursor-pointer border ${
                        activeWorkflowStage === idx
                          ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs'
                          : 'bg-transparent border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="block font-mono text-[10px] opacity-70">{stage.step}</span>
                      <span className="block truncate">{stage.label}</span>
                    </button>
                  ))}
                </div>

                {/* Selected Stage Details */}
                <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>{activeStage.sopRef}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Enforced in App</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {activeStage.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {activeStage.summary}
                  </p>

                  <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
                    {activeStage.checkpoints.map((cp, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{cp}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    Login &rarr; Profile Hub &rarr; Get Started (4-Step Company Setup)
                  </span>
                  <button
                    type="button"
                    onClick={handleAuthOrWorkspace}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>Try Workflow</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. REAL PRODUCT CAPABILITIES */}
      <section id="capabilities" className="py-16 sm:py-20 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060c18]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Core Platform Modules
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              Built for agencies, software houses, and B2B operations teams
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Every module below runs live inside your multi-tenant workspace with real PostgreSQL persistence and role-based access control.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="p-5 sm:p-6 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {cap.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE ROI CALCULATOR (Real Working Component) */}
      <section id="calculator" className="py-16 sm:py-20 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a192f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LeadFlowRoiCalculator onBookCall={() => handleOpenBooking('Custom Projected ROI Plan')} />
        </div>
      </section>

      {/* 4. FREE DELIVERABILITY & OUTBOUND SIMULATOR */}
      <section id="free-tools" className="py-16 sm:py-20 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060c18]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LeadFlowFreeToolsSection onBookCall={() => handleOpenBooking('Outbound Infrastructure Setup')} />
        </div>
      </section>

      {/* 5. SOFTWARE PLATFORM & LIVE PUBLIC TOOLS (Email Verifier + DNS Checker + Subscriptions) */}
      <LeadFlowSoftwareSection
        onOpenDocs={() => setShowDocsModal(true)}
        onEnterWorkspace={handleAuthOrWorkspace}
      />

      {/* 6. WORKSPACE SERVICE & STRIPE CHECKOUT TIERS */}
      <section id="pricing" className="py-16 sm:py-20 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070e1b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Managed &amp; Enterprise Deployment
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              Flexible workspace &amp; outbound deployment tiers
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Start with your company workspace immediately or provision a managed outbound retainer via Stripe Checkout.
            </p>

            <div className="mt-5 inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono">
              {(['USD', 'EUR', 'GBP'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCurrencyChange(c)}
                  className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                    currency === c
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                tier: 'pilot' as const,
                title: 'PILOT',
                basePrice: 999,
                subtitle: '30-day sprint for lean sales teams validating international outbound.',
                quota: '1,000 Verified Prospects',
                featured: false,
                features: [
                  'Dedicated tenant workspace + SOP 1–11',
                  '1 Outbound channel (Email or LinkedIn)',
                  'Secondary domain warmup & DNS verification',
                  'Tiered commission calculator & deal board'
                ]
              },
              {
                tier: 'business' as const,
                title: 'BUSINESS',
                basePrice: 2990,
                subtitle: 'Full multi-channel operations, inbox triage, and client portals.',
                quota: '3,000 Verified Prospects / mo',
                featured: true,
                features: [
                  'Multi-channel LinkedIn + Cold Email sequences',
                  'Unified Omni-Inbox & Gmail Workspace sync',
                  'Isolated Client & NDA Partner Portals',
                  'Google Workspace Sheets, Tasks & Docs sync'
                ]
              },
              {
                tier: 'enterprise' as const,
                title: 'ENTERPRISE',
                basePrice: 5490,
                subtitle: 'Multi-inbox scaling, custom webhooks, and MCP agent automation.',
                quota: '7,000+ Verified Prospects / mo',
                featured: false,
                features: [
                  'Up to 15 connected sending mailboxes',
                  'REST API + Model Context Protocol (MCP)',
                  'Custom RBAC hierarchy & encrypted vault',
                  'Neon PostgreSQL multi-tenant isolation'
                ]
              }
            ].map((plan) => {
              const displayPrice = Math.round(plan.basePrice * currencyMultiplier).toLocaleString();
              return (
                <div
                  key={plan.tier}
                  className={`p-6 sm:p-7 rounded-xl border flex flex-col justify-between space-y-6 ${
                    plan.featured
                      ? 'bg-white dark:bg-slate-900 border-indigo-600 ring-1 ring-indigo-600/20 shadow-sm'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.title}</h3>
                      {plan.featured && (
                        <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          RECOMMENDED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {plan.subtitle}
                    </p>

                    <div className="my-5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                          {currencySymbol}{displayPrice}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">/month</span>
                      </div>
                      <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono block mt-1">
                        {plan.quota}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                      {plan.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={checkingOutTier === plan.tier}
                      onClick={() => handleChoosePlanCheckout(plan.tier, `${plan.title} Plan`, plan.basePrice)}
                      className={`w-full py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
                        plan.featured
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white'
                      }`}
                    >
                      {checkingOutTier === plan.tier ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating Stripe Session...</span>
                        </>
                      ) : (
                        <>
                          <span>Select {plan.title} &bull; {currencySymbol}{displayPrice}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenBooking(`${plan.title} Scope (${currencySymbol}${displayPrice}/mo)`)}
                      className="w-full py-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-[11px] font-medium transition cursor-pointer"
                    >
                      Discuss scope on a call
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. FAQ ACCORDION */}
      <section id="faq" className="py-16 sm:py-20 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060c18]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Platform FAQ
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              Architecture &amp; workflow questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = activeFaq === i;
              return (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : i)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold tabular-nums">
                        0{i + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {faq.q}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3 animate-fadeIn">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. CLEAN ENTERPRISE FOOTER */}
      <footer className="bg-white dark:bg-[#050b14] text-slate-600 dark:text-slate-400 py-10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white block">
                ClientOps Operations Suite
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                International Client Handling &amp; Project Operations platform with multi-tenant isolation, SOP enforcement, and cold outreach deliverability.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-medium">
              <a href="#workflow" className="hover:text-slate-900 dark:hover:text-white transition">Workflow</a>
              <a href="#capabilities" className="hover:text-slate-900 dark:hover:text-white transition">Modules</a>
              <a href="#calculator" className="hover:text-slate-900 dark:hover:text-white transition">ROI Calculator</a>
              <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition">Plans</a>
              <button
                type="button"
                onClick={handleAuthOrWorkspace}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
              >
                {currentUser ? 'Personal Profile →' : 'Login →'}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
            <span>&copy; 2026 ClientOps Operations Suite</span>
            <span>SOP 1–11 Enforced &bull; Neon DB Multi-Tenant &bull; Resend Verified</span>
          </div>
        </div>
      </footer>

      <LeadFlowBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        preselectedPlan={selectedPlanForBooking}
      />

      {showDocsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-slate-950 animate-fadeIn">
          <DocsView onBackToApp={() => setShowDocsModal(false)} />
        </div>
      )}
    </div>
  );
};
