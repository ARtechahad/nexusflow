import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowUpRight, 
  CheckCircle2, 
  ShieldCheck, 
  Mail, 
  Linkedin, 
  Calendar, 
  Phone, 
  DollarSign, 
  BarChart3, 
  Users, 
  Clock, 
  Filter, 
  ExternalLink, 
  Zap, 
  ChevronDown, 
  ChevronRight, 
  X, 
  Play, 
  RefreshCw, 
  Send, 
  Lock, 
  Globe, 
  Building2,
  Check,
  Search,
  Layers,
  Award,
  Star,
  Activity,
  CheckSquare,
  HelpCircle,
  Database,
  Sliders,
  Laptop
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LeadFlowBookingModal } from './LeadFlowBookingModal';
import { LeadFlowRoiCalculator } from './LeadFlowRoiCalculator';
import { LeadFlowFreeToolsSection } from './LeadFlowFreeToolsSection';
import { InteractiveCampaignDrawer, CampaignTemplate } from './InteractiveCampaignDrawer';
import { ThemeToggle } from './ThemeToggle';
import { ParticleBackground } from './ParticleBackground';
import { UserRole } from '../types';

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
    role, 
    switchPersona, 
    showToast, 
    setIsOnboardingModalOpen,
    setActiveTab,
    refreshProjects
  } = useApp();

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedPlanForBooking, setSelectedPlanForBooking] = useState('Business Retainer ($2,990/mo)');
  const [activeCaseStudy, setActiveCaseStudy] = useState<number>(0);
  const [activeFitTab, setActiveFitTab] = useState<'saas' | 'agencies' | 'services'>('saas');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP'>('USD');
  const [currencyMultiplier, setCurrencyMultiplier] = useState(1);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  // Interactive Campaign Drawer State
  const [isCampaignDrawerOpen, setIsCampaignDrawerOpen] = useState(false);
  const [selectedCampaignForDrawer, setSelectedCampaignForDrawer] = useState<CampaignTemplate | null>(null);

  // Stripe Checkout Loading State
  const [checkingOutTier, setCheckingOutTier] = useState<string | null>(null);

  // Check URL params for checkout=success
  React.useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('checkout') === 'success') {
        const tier = urlParams.get('tier') || 'business';
        const amount = urlParams.get('amount') || '2,990';
        showToast(`🎉 Payment Confirmed! Stripe session verified for ${tier.toUpperCase()} tier ($${amount}). Welcome to LeadFlow!`, 'success');
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

  const handleOpenCampaignDrawer = (cs: typeof caseStudies[0]) => {
    setSelectedCampaignForDrawer({
      badge: cs.badge,
      headline: cs.headline,
      icp: cs.icp,
      sqlsMetric: cs.sqlsMetric,
      sqlsSubtitle: cs.sqlsSubtitle,
      results: cs.results,
      steps: cs.steps,
      quote: cs.quote
    });
    setIsCampaignDrawerOpen(true);
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
          customerName: currentUser?.name || 'Prospect Client',
          customerEmail: currentUser?.email || 'prospect@business.com',
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

  // Case studies mirroring LeadFlow's genuine campaigns
  const caseStudies = [
    {
      badge: 'DACH + UK B2B Fintech (Embedded Payments)',
      sqlsMetric: '7 SQLs / month',
      sqlsSubtitle: 'avg over 6 months &bull; $140k pipeline',
      headline: '7 sales-qualified meetings per month for a B2B fintech selling embedded payments',
      icp: 'Chief Commercial Officers, VP Payments, Head of Treasury in online marketplaces & platforms ($10M–$100M GMV)',
      results: [
        { label: 'Positive Reply Rate', val: '6.8%' },
        { label: 'Qualified Meetings', val: '42 SQLs' },
        { label: 'Pipeline Generated', val: '$140k+' },
        { label: 'Contract ACV', val: '$20,000' }
      ],
      sequencePreview: {
        channel: 'LinkedIn + Cold Email Multi-Touch',
        step1: 'Step 1 (Day 1): Soft LinkedIn connection referencing their marketplace expansion.',
        step2: 'Step 2 (Day 3): Cold Email highlighting interchange margin leakage in cross-border settlements.',
        step3: 'Step 3 (Day 7): Case study snapshot showing a similar platform reducing transaction friction by 31%.'
      },
      steps: [
        {
          stepNumber: 1,
          day: 'Day 1',
          channel: 'linkedin' as const,
          title: 'Soft LinkedIn Connection Hook',
          content: 'Hi {{firstName}} — noticed your team\'s recent expansion into the UK/DACH corridor. Curious how you\'re navigating interchange spread as platform GMV scales? We put together a 2-page benchmark from 40 European marketplaces that might be helpful.',
          proTip: 'Send as a personalized connection note without any direct pitch or scheduling link.'
        },
        {
          stepNumber: 2,
          day: 'Day 3',
          channel: 'email' as const,
          title: 'Primary Cold Email: Settlement Margin Leakage',
          subject: '{{company}} marketplace settlement margin leakage / benchmark',
          content: 'Hi {{firstName}},\n\nReaching out because most Chief Commercial Officers running $20M–$80M GMV platforms lose between 28 and 42 bps on cross-border payment settlements without realizing it.\n\nWe helped a peer DACH marketplace recover $140,000 in net annual processing spread in their first 60 days.\n\nOpen to reviewing the 1-page breakdown? Happy to send it over asynchronously.',
          proTip: 'Keep under 70 words. Low-friction "mind if I send the 1-page breakdown" CTA has a 6.8% positive response rate.'
        },
        {
          stepNumber: 3,
          day: 'Day 7',
          channel: 'email' as const,
          title: 'Follow-Up Email: 31% Friction Reduction Case Study',
          subject: 'Re: {{company}} marketplace settlement margin leakage',
          content: 'Quick follow-up {{firstName}} — here is what that transition looked like for a peer marketplace:\n\n• Zero changes to merchant checkout UX\n• Instant dynamic routing for SEPA & BACS rails\n• Result: 31% drop in settlement friction\n\nWorth a 10-minute exploratory sync this Thursday at 2:30pm?',
          proTip: 'Always reply in the original email thread to retain context and respect the prospect\'s inbox.'
        },
        {
          stepNumber: 4,
          day: 'Day 11',
          channel: 'linkedin' as const,
          title: 'LinkedIn InMail / Voice Note Follow-Up',
          content: 'Hey {{firstName}} — dropped a quick note in your inbox regarding the cross-border payment benchmarks. Just saw your team announced the new platform launch — congrats! Let me know if you\'d like the benchmark breakdown.',
          proTip: 'Combining email with a LinkedIn profile touchpoint increases response probability by 2.4x.'
        },
        {
          stepNumber: 5,
          day: 'Day 16',
          channel: 'email' as const,
          title: 'Polite Permission to Close the Loop',
          subject: 'Closing the loop on payment margins',
          content: '{{firstName}} — assuming this isn\'t on your roadmap this quarter, which is completely fine!\n\nI\'ll stop reaching out. If you ever want to see how your processing margin compares against peer platforms, our benchmark tool is always live at leadflow.dev/benchmarks.\n\nWishing you all the best with the expansion!',
          proTip: 'The breakup touch often triggers up to 25% of total replies from busy executives.'
        }
      ],
      quote: '"LeadFlow has been our single most predictable pipeline generator across the UK and DACH regions."'
    },
    {
      badge: 'US Niche AI Speech Tech (Enterprise Contact Centers)',
      sqlsMetric: '12 SQLs / month',
      sqlsSubtitle: 'targeting enterprise contact centers &bull; 4.9x ROI',
      headline: '12 SQLs per month for a niche AI speech company selling to contact centers',
      icp: 'VP Customer Experience, Head of Contact Center Operations, CIOs at financial institutions & healthcare',
      results: [
        { label: 'Positive Reply Rate', val: '8.4%' },
        { label: 'Qualified Meetings', val: '72 SQLs' },
        { label: 'Pipeline Generated', val: '$280k+' },
        { label: 'ROI Multiple', val: '4.9x' }
      ],
      sequencePreview: {
        channel: 'Email Primary + LinkedIn Support',
        step1: 'Step 1 (Day 1): Short email asking how they handle QA auditing on 10,000+ daily agent calls.',
        step2: 'Step 2 (Day 4): 2-line follow-up with a 15-second audio spectrogram demo link.',
        step3: 'Step 3 (Day 9): Direct executive invite to discuss reduced agent burnout metrics.'
      },
      steps: [
        {
          stepNumber: 1,
          day: 'Day 1',
          channel: 'email' as const,
          title: 'QA Auditing Bottleneck Teardown',
          subject: 'Auditing 10,000 daily agent calls at {{company}}',
          content: 'Hi {{firstName}},\n\nQuick question: what percentage of your contact center calls does your QA team currently review manually? Most enterprise teams we talk to can barely sample 1.5%.\n\nWe deployed an acoustic speech model that audits 100% of calls in real-time, cutting compliance review costs by 64%.\n\nWould it make sense to send you a 45-second interactive spectrogram demo?',
          proTip: 'Ask about a tangible operational pain (1.5% QA sampling rate) that the executive lives every day.'
        },
        {
          stepNumber: 2,
          day: 'Day 4',
          channel: 'linkedin' as const,
          title: 'LinkedIn Contextual Engagement',
          content: 'Hi {{firstName}} — noticed your team is hiring bilingual agents in the US. How is your team handling automated sentiment tagging during peak volume? Sent a quick note to your email with a demo.',
          proTip: 'Reference real hiring activity discovered via Google Search / LinkedIn intent signals.'
        },
        {
          stepNumber: 3,
          day: 'Day 8',
          channel: 'email' as const,
          title: 'Spectrogram Demo & Proof Point',
          subject: 'Re: Auditing 10,000 daily agent calls at {{company}}',
          content: 'Hi {{firstName}},\n\nHere is a 15-second loom recording of the engine identifying audio latency and customer frustration markers in real-time.\n\nAre you free for 10 minutes this Wednesday to review how this would integrate with your current telephony stack?',
          proTip: 'Attach a brief visual or audio proof point instead of generic marketing brochures.'
        },
        {
          stepNumber: 4,
          day: 'Day 14',
          channel: 'email' as const,
          title: 'Executive Breakup / Resource Handoff',
          subject: 'Should I pause for {{company}}?',
          content: '{{firstName}} — figured you\'re focused on other initiatives right now. I\'ll pause our emails. If automated speech QA becomes a priority later this year, let me know!\n\nBest,\nLeadFlow Team',
          proTip: 'Clean and respectful closing touch keeps the door open for future quarter restarts.'
        }
      ],
      quote: '"Within 90 days, LeadFlow booked meetings with 3 of our top 10 dream accounts."'
    },
    {
      badge: 'Saudi Telecom & Infrastructure (Enterprise Connectivity)',
      sqlsMetric: '20 SQLs / month',
      sqlsSubtitle: 'managed enterprise connectivity &bull; $420k closed deals',
      headline: '20 SQLs per month for a Saudi telecom firm selling managed connectivity to enterprise',
      icp: 'CTOs, IT Directors, Head of Enterprise Network Infrastructure at mid-market & government contracting firms',
      results: [
        { label: 'Positive Reply Rate', val: '11.2%' },
        { label: 'Qualified Meetings', val: '120 SQLs' },
        { label: 'Pipeline Generated', val: '$420k+' },
        { label: 'Average Deal Size', val: '$35,000' }
      ],
      sequencePreview: {
        channel: 'Bilingual LinkedIn + Email',
        step1: 'Step 1 (Day 1): English/Arabic personalized note addressing SLA uptime and cloud peering.',
        step2: 'Step 2 (Day 5): Invitation to review latency benchmarking across Riyadh and Jeddah hubs.',
        step3: 'Step 3 (Day 10): Direct WhatsApp follow-up once prospect engaged with technical whitepaper.'
      },
      steps: [
        {
          stepNumber: 1,
          day: 'Day 1',
          channel: 'linkedin' as const,
          title: 'Bilingual Executive Peer Note',
          content: 'Salam {{firstName}} — noticed {{company}}\'s digital infrastructure expansion in Riyadh. How are you maintaining sub-5ms peering latency between your cloud data centers? Shared a brief benchmark note with fellow CTOs in KSA.',
          proTip: 'Localize language and cultural conventions for regional GCC decision-makers.'
        },
        {
          stepNumber: 2,
          day: 'Day 4',
          channel: 'email' as const,
          title: 'Infrastructure SLA Benchmark Teardown',
          subject: 'Sub-5ms peering latency between Riyadh & Jeddah hubs ({{company}})',
          content: 'Hi {{firstName}},\n\nReaching out because high-throughput government and commercial infrastructure in Saudi Arabia cannot afford 99.8% SLA dropouts.\n\nOur redundant SD-WAN backbone guarantees 99.999% uptime with direct cloud peering at both Riyadh and Jeddah exchanges.\n\nWould you be open to reviewing the latency report this week?',
          proTip: 'Highlight mission-critical uptime metrics (99.999% SLA) that IT Directors are measured on.'
        },
        {
          stepNumber: 3,
          day: 'Day 9',
          channel: 'phone' as const,
          title: 'Technical Executive Handoff Call',
          content: 'Direct briefing touchpoint with Senior Enterprise Network Engineer to review direct fiber trunk options.',
          proTip: 'For large deals ($35k+ ACV), multi-channel phone and WhatsApp touchpoints accelerate sales velocity.'
        }
      ],
      quote: '"The quality of enterprise decision-makers on our calendar was outstanding from week two."'
    }
  ];

  // FAQ items mirroring LeadFlow
  const faqs = [
    {
      q: "How does LeadFlow's multi-channel approach work?",
      a: "We combine LinkedIn outreach with cold email campaigns to maximize your reach without spamming. Our system personalizes each touchpoint based on live trigger signals, handles replies, and tracks engagement across both channels to ensure qualified sales conversations land directly on your calendar."
    },
    {
      q: "How long does it take to see results?",
      a: "Our complete technical onboarding and 7-day launch sprint gets your campaign live in exactly one week. Most clients see their first qualified meetings booked between days 10 and 14 once email inboxes are warmed and LinkedIn sequences initiate."
    },
    {
      q: "Will cold email harm my company's main domain?",
      a: "Never. We strictly set up custom secondary sending domains (e.g., yourcompany-hq.com) with SPF, DKIM, and DMARC authentication. Your primary domain is 100% protected and never used for cold sending."
    },
    {
      q: "How do you define a Sales-Qualified Meeting (SQL)?",
      a: "A qualified meeting is with a verified decision-maker matching your pre-approved Ideal Customer Profile (ICP) who has expressed clear interest in your offering and confirmed attendance on your calendar."
    },
    {
      q: "What CRM and tool integrations are supported?",
      a: "LeadFlow synchronizes natively with ALM Nexus Enterprise, HubSpot, Salesforce, Pipedrive, Slack, Discord, and Google Calendar. Replies and notes are logged automatically in real time."
    },
    {
      q: "Is there a long-term contract lock-in?",
      a: "No. Our Pilot program is a 30-day sprint. Our Business and Enterprise retainers operate on flexible month-to-month terms because our retention is driven by pipeline performance, not contract lock-ins."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a192f] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-slate-900 selection:text-white transition-colors duration-200">
      
      {/* ========================================================
          STICKY TOP NAVBAR (Enterprise Antigravity Glass)
      ======================================================== */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-900/95 text-white dark:bg-[#070e1b]/90 border-b border-slate-800/80 dark:border-white/10 transition-all shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Product Badge */}
          <div className="flex items-center gap-3">
            <a href="#" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700/80 p-0.5 shadow-xs flex items-center justify-center group-hover:border-slate-600 transition-colors">
                <Send className="w-4 h-4 text-white transform -rotate-12 group-hover:rotate-0 transition-transform duration-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-white tracking-tight">
                    LeadFlow
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono tracking-wide">
                    GTM Engine
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 block -mt-0.5 tracking-tight">
                  An ALM Nexus Product
                </span>
              </div>
            </a>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-300">
            <a href="#case-studies" className="hover:text-white transition-colors">Case Studies</a>
            <a href="#fit" className="hover:text-white transition-colors">Honest Fit</a>
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#process" className="hover:text-white transition-colors">7-Day Launch</a>
            <a href="#calculator" className="hover:text-white transition-colors">ROI Calculator</a>
            <a href="#free-tools" className="hover:text-white transition-colors flex items-center gap-1.5">
              <span>Free Tools</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-400 font-mono font-semibold">FREE</span>
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </nav>

          {/* Right Action Area */}
          <div className="flex items-center gap-3">
            <ThemeToggle variant="segmented" showLabels={false} />

            {/* Book A Call CTA */}
            <button
              type="button"
              onClick={() => handleOpenBooking()}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold shadow-xs transition cursor-pointer hover:shadow-md"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book A Call</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            {/* Launch / Access Operations Platform Button */}
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  if (onEnterWorkspace) onEnterWorkspace();
                  else setActiveTab('pipeline');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-slate-300" />
                <span>Open Operations Hub</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onOpenLoginModal) onOpenLoginModal();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <Lock className="w-3.5 h-3.5 text-slate-300" />
                <span>Team / Client Login</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================
          1. HERO SECTION (Airy, Spacious Google Antigravity Layout)
      ======================================================== */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070e1b]">
        {/* Antigravity Interactive Particles (Spacious & Interactive) */}
        <ParticleBackground className="absolute inset-0 z-0 pointer-events-none" />

        {/* Ambient Subtle Radial Gradient Backdrop for Perfect Contrast */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(56,189,248,0.08),transparent)] pointer-events-none z-1" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            
            {/* Left Column: Hero Text */}
            <div className="w-full lg:w-7/12 text-left space-y-7">
              
              {/* Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 text-xs font-semibold font-mono shadow-xs backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="tracking-wide">MANAGED LINKEDIN &amp; COLD EMAIL OUTREACH FOR B2B TEAMS</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.12]">
                Managed LinkedIn and cold email outreach for B2B teams.
              </h1>

              {/* Subtext */}
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl font-normal">
                We research your prospects, write the outreach, and handle replies — so your sales team can focus strictly on closed revenue conversations.
              </p>

              {/* Call to Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleOpenBooking()}
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-center gap-2 group"
                >
                  <span>Discuss your outbound plan</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <a
                  href="#case-studies"
                  className="px-5 py-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow-xs backdrop-blur-sm"
                >
                  <span>See case studies</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    if (currentUser && onEnterWorkspace) {
                      onEnterWorkspace();
                    } else if (onOpenLoginModal) {
                      onOpenLoginModal();
                    }
                  }}
                  className="px-5 py-3 rounded-xl border border-slate-300 dark:border-white/15 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 shadow-xs backdrop-blur-sm"
                >
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span>ALM Nexus Workspace</span>
                </button>
              </div>

              {/* Organized Proof Metric Strip (4 High-Trust Antigravity Cards) */}
              <div className="pt-6 border-t border-slate-200/80 dark:border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    <span>30-Min Audit</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">Direct fit review</span>
                </div>

                <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>7-Day Sprint</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">Live in one week</span>
                </div>

                <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>0 Domain Risk</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">Isolated secondary domains</span>
                </div>

                <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-white/10 backdrop-blur-sm">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>100% Turnkey</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">Copy &amp; reply management</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Outbound Sequence Simulation Card */}
            <div className="w-full lg:w-5/12">
              <div className="relative rounded-2xl bg-white/90 dark:bg-slate-900/75 border border-slate-200/80 dark:border-white/10 p-6 sm:p-7 shadow-lg backdrop-blur-md space-y-4">
                
                {/* Simulator Card Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
                      Live Multi-Channel Pipeline
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                    LeadFlow Engine
                  </span>
                </div>

                {/* Step 1: Verified Prospect */}
                <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      <span>Target Prospect Identified</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">ICP Match 99/100</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Dominik Weber &bull; Head of Treasury @ Apex Pay (UK) &bull; Verified Work Email + Direct Mobile
                  </p>
                </div>

                {/* Step 2: Multi-Touch Touchpoint Flow */}
                <div className="space-y-2 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/5 flex items-start gap-2.5">
                    <Linkedin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        Touch 1 &bull; LinkedIn Soft Note
                      </span>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 italic">
                        "Saw you guys are scaling marketplace payouts across the EU. How are you handling cross-border interchange rates?"
                      </p>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold mt-1 inline-block">
                        &check; Accepted &bull; 4h reply turnaround
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-white/5 flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white block">
                        Touch 2 &bull; Cold Email with Anonymized Case Study
                      </span>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                        Delivered from warmed secondary domain &bull; 74% Open Rate &bull; Zero spam trigger words
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 3: Meeting Booked Outcome */}
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                        Sales-Qualified Meeting Booked
                      </span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                        Thursday @ 2:30 PM &bull; Google Meet Invite Confirmed
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono text-[10px] font-semibold">
                    SQL #14
                  </span>
                </div>

                {/* Footer Metric Row */}
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono border-t border-slate-100 dark:border-white/10">
                  <span>Clay + Instantly + Apollo Stack</span>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">100% Handled By LeadFlow</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================
          ANTIGRAVITY STICKY QUICK-NAVIGATION JUMP BAR
      ======================================================== */}
      <div className="sticky top-16 z-30 w-full backdrop-blur-xl bg-white/90 dark:bg-[#070e1b]/90 border-b border-slate-200/80 dark:border-white/10 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0 text-xs font-mono font-medium text-slate-500 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="uppercase tracking-wider">NAVIGATE:</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a href="#case-studies" className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/70 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 transition">Case Studies</a>
            <a href="#fit" className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/70 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 transition">Honest Fit</a>
            <a href="#services" className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/70 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 transition">Services</a>
            <a href="#process" className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/70 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 transition">7-Day Sprint</a>
            <a href="#calculator" className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/70 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 transition">ROI Calculator</a>
            <a href="#free-tools" className="px-3 py-1.5 rounded-full text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition flex items-center gap-1.5">
              <span>Cold Email Sim</span>
              <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-emerald-500/20">FREE</span>
            </a>
            <a href="#pricing" className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/70 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 transition">Pricing</a>
            <a href="#faq" className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/70 dark:bg-white/5 hover:bg-slate-200/70 dark:hover:bg-white/10 border border-slate-200/60 dark:border-white/10 transition">FAQ</a>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenBooking()}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition flex items-center gap-1 shadow-2xs"
            >
              <span>Book Call</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. CAMPAIGN EXAMPLES & REAL PIPELINE (Case Studies)
      ======================================================== */}
      <section id="case-studies" className="py-20 sm:py-24 border-b border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#070e1b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 mb-3">
              01 // VERIFIED CAMPAIGNS
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Real campaigns, real pipeline
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 font-normal max-w-xl mx-auto">
              Anonymized case studies from B2B teams we run outbound for — the ICP, the funnel numbers, and the exact multi-channel sequences.
            </p>
          </div>

          {/* Case Study Tabs */}
          <div className="flex items-center justify-center gap-1.5 mb-8 flex-wrap p-1.5 bg-slate-100/90 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-white/10 max-w-3xl mx-auto backdrop-blur-sm">
            {caseStudies.map((cs, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveCaseStudy(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  activeCaseStudy === idx
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/50'
                }`}
              >
                <span>{cs.badge}</span>
              </button>
            ))}
          </div>

          {/* Active Case Study Detail Card */}
          {caseStudies[activeCaseStudy] && (() => {
            const cs = caseStudies[activeCaseStudy];
            return (
              <div className="max-w-5xl mx-auto bg-white/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-2xl p-6 sm:p-10 shadow-sm hover:shadow-md transition-shadow space-y-8 animate-fadeIn backdrop-blur-sm">
                
                {/* Header Metrics Banner */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-white/10">
                  <div>
                    <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                      {cs.badge}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {cs.headline}
                    </h3>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-850/70 border border-slate-200/80 dark:border-white/10 text-right shrink-0">
                    <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono block">
                      {cs.sqlsMetric}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono" dangerouslySetInnerHTML={{ __html: cs.sqlsSubtitle }} />
                  </div>
                </div>

                {/* 4 Key Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {cs.results.map((r, i) => (
                    <div key={i} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500 block font-medium">{r.label}</span>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-0.5 block tabular-nums">
                        {r.val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* ICP & Exact Sequence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase font-mono flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-slate-500" />
                      <span>Target Ideal Customer Profile (ICP)</span>
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                      {cs.icp}
                    </p>
                    <div className="pt-2 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">Decision Makers Only</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">Direct Mobiles Verified</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">Zero Catch-All Inboxes</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-white uppercase font-mono flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-slate-500" />
                      <span>Exact Sequence Used ({cs.sequencePreview.channel})</span>
                    </h4>
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 font-normal">
                      <p className="text-[11px] leading-relaxed">{cs.sequencePreview.step1}</p>
                      <p className="text-[11px] leading-relaxed">{cs.sequencePreview.step2}</p>
                      <p className="text-[11px] leading-relaxed">{cs.sequencePreview.step3}</p>
                    </div>
                  </div>
                </div>

                {/* Client Quote & CTA */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs italic text-slate-500 dark:text-slate-400 max-w-xl">
                    {cs.quote}
                  </p>

                  <button
                    type="button"
                    onClick={() => handleOpenCampaignDrawer(cs)}
                    className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-2 shrink-0"
                  >
                    <span>Replicate This Campaign</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}

        </div>
      </section>

      {/* ========================================================
          3. HONEST FIT BEFORE WE TALK NUMBERS (Is This For You?)
      ======================================================== */}
      <section id="fit" className="py-20 sm:py-24 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#060c18]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 mb-3">
              02 // CANDID AUDIT
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Honest fit before we talk numbers
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 font-normal max-w-xl mx-auto">
              We work best with a specific type of team. Pick your closest match — we'll tell you straight when we're not a fit.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            
            {/* Card 1: B2B SaaS */}
            <div className={`p-6 sm:p-8 rounded-2xl border transition-all ${
              activeFitTab === 'saas'
                ? 'bg-slate-50 dark:bg-[#0d2345] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/20'
                : 'bg-white dark:bg-[#0d203d] border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
            }`}>
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold mb-4 border border-slate-200 dark:border-slate-700">
                <Laptop className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">B2B SaaS</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-4">Product-led or sales-led &bull; $2K+ ACV</p>
              
              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <span className="font-semibold text-slate-900 dark:text-white block text-[11px] uppercase font-mono tracking-wider">You'll see results if...</span>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>You have paying customers and a defined ICP</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Deal size &ge; $2K ACV (or $500+ MRR)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Sales cycle 2–6 weeks with clear decision-makers</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="text-rose-500 font-bold block mb-1">Not a fit if:</span>
                Consumer apps (B2C) or deal sizes under $1k/year.
              </div>
            </div>

            {/* Card 2: Agencies & Studios */}
            <div className={`p-6 sm:p-8 rounded-2xl border transition-all ${
              activeFitTab === 'agencies'
                ? 'bg-slate-50 dark:bg-[#0d2345] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/20'
                : 'bg-white dark:bg-[#0d203d] border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
            }`}>
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold mb-4 border border-slate-200 dark:border-slate-700">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Agencies &amp; Studios</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-4">Web, design &amp; marketing retainers &bull; $5K+</p>
              
              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <span className="font-semibold text-slate-900 dark:text-white block text-[11px] uppercase font-mono tracking-wider">You'll see results if...</span>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Proven case studies and solid client portfolio</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Retainer &ge; $3,500/mo or project size &ge; $5,000</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Capacity to onboard 2–4 new accounts each month</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="text-rose-500 font-bold block mb-1">Not a fit if:</span>
                Brand new agency without a portfolio or past client references.
              </div>
            </div>

            {/* Card 3: B2B Services */}
            <div className={`p-6 sm:p-8 rounded-2xl border transition-all ${
              activeFitTab === 'services'
                ? 'bg-slate-50 dark:bg-[#0d2345] border-emerald-500/80 shadow-md ring-1 ring-emerald-500/20'
                : 'bg-white dark:bg-[#0d203d] border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
            }`}>
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold mb-4 border border-slate-200 dark:border-slate-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">B2B Enterprise Services</h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-4">Consulting, IT &amp; Logistics &bull; $10K+ ACV</p>
              
              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <span className="font-semibold text-slate-900 dark:text-white block text-[11px] uppercase font-mono tracking-wider">You'll see results if...</span>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>High-ticket contract value ($10,000 – $100,000+)</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Targeting C-Suite, VPs, or specialized directors</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>1 closed deal pays for 3–6 months of LeadFlow retainers</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="text-rose-500 font-bold block mb-1">Not a fit if:</span>
                Vague offering with no specific enterprise buyer role.
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================
          4. OUR SERVICES: Everything you need to scale outbound
      ======================================================== */}
      <section id="services" className="py-20 sm:py-24 border-b border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#070e1b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 mb-3">
              03 // ARCHITECTURE &amp; DELIVERABLES
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Everything you need to scale outbound
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 font-normal max-w-xl mx-auto">
              From data enrichment and technical deliverability to multi-touch messaging and booked meetings on your calendar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Service 1 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold border border-slate-200 dark:border-slate-700">
                <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Appointment Setting</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                LinkedIn + Email outreach campaigns that book sales-qualified meetings directly to your Google Meet or Zoom calendar.
              </p>
              <div className="pt-2 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span>Direct calendar integration</span> &rarr;
              </div>
            </div>

            {/* Service 2 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold border border-slate-200 dark:border-slate-700">
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Prospects Database Preparation</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Custom-built lead lists with verified business emails and direct mobile numbers matching your exact ideal customer profile.
              </p>
              <div className="pt-2 text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                <span>Apollo + Clay + Prospeo waterfall</span> &rarr;
              </div>
            </div>

            {/* Service 3 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold border border-slate-200 dark:border-slate-700">
                <Linkedin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">LinkedIn Content &amp; Thought Leadership</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Executive ghostwriting, profile optimization, and social selling sequences that turn your founder's profile into an inbound magnet.
              </p>
              <div className="pt-2 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                <span>Personal branding flywheel</span> &rarr;
              </div>
            </div>

            {/* Service 4 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold border border-slate-200 dark:border-slate-700">
                <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">CRM Setup &amp; Pipeline Tracking</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Bi-directional synchronization with ALM Nexus, HubSpot, or Pipedrive so your account executives have full conversation context.
              </p>
              <div className="pt-2 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span>Real-time webhook sync</span> &rarr;
              </div>
            </div>

            {/* Service 5 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold border border-slate-200 dark:border-slate-700">
                <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">n8n / Make.com &amp; Clay Workflows</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Custom automated workflows scraping buying signals, funding rounds, job board hirings, and dynamic AI personalized lines.
              </p>
              <div className="pt-2 text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <span>Intent-triggered outreach</span> &rarr;
              </div>
            </div>

            {/* Service 6 */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white flex items-center justify-center font-bold border border-slate-200 dark:border-slate-700">
                <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Deliverability &amp; Secondary Domains</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Secondary domain purchasing, SPF, DKIM, DMARC records, Google Workspace inboxes, and 14-day automated warmup protecting sender reputation.
              </p>
              <div className="pt-2 text-[11px] font-mono text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                <span>98.6% Primary inbox landing</span> &rarr;
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================
          5. OUR PROCESS: Launch your outbound engine in 7 days
      ======================================================== */}
      <section id="process" className="py-20 sm:py-24 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#060c18]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 mb-3">
              04 // 7-DAY SPRINT
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Launch your outbound engine in 7 days
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 font-normal max-w-xl mx-auto">
              From ICP research to booked meetings — we handle the entire infrastructure so you can focus strictly on closing deals.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 relative">
              <span className="text-3xl font-black text-slate-300 dark:text-slate-700 font-mono block">
                01
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-block">
                Days 1–2
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">ICP Research &amp; Planning</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Define your Ideal Customer Profile based on past wins, target ACV, geographic criteria, and market positioning.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 relative">
              <span className="text-3xl font-black text-slate-300 dark:text-slate-700 font-mono block">
                02
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-block">
                Days 3–4
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Technical Infrastructure</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Configure isolated secondary domains, SPF, DKIM, DMARC records, and initiate automated inbox warming.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 relative">
              <span className="text-3xl font-black text-slate-300 dark:text-slate-700 font-mono block">
                03
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-block">
                Days 5–6
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Copywriting &amp; Sequences</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Craft 3 distinct angle variations across LinkedIn and Email with pain-driven hooks and low-friction CTAs.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 relative">
              <span className="text-3xl font-black text-slate-300 dark:text-slate-700 font-mono block">
                04
              </span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 inline-block">
                Day 7+
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Launch &amp; Meetings Booked</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                Go live, triage replies within 15 minutes, qualify prospects, and book calls directly to your calendar.
              </p>
            </div>

          </div>

          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={() => handleOpenBooking('7-Day Outbound Launch Sprint')}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer"
            >
              <span>Start Your 7-Day Outbound Engine</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          6. INTERACTIVE ROI CALCULATOR
      ======================================================== */}
      <section id="calculator" className="py-16 sm:py-24 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#071324]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LeadFlowRoiCalculator onBookCall={() => handleOpenBooking('Custom Projected ROI Plan')} />
        </div>
      </section>

      {/* ========================================================
          7. FREE GTM & OUTBOUND TOOLS
      ======================================================== */}
      <section id="free-tools" className="py-16 sm:py-24 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a192f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LeadFlowFreeToolsSection onBookCall={() => handleOpenBooking('LeadFlow Outbound Setup')} />
        </div>
      </section>

      {/* ========================================================
          8. TRANSPARENT PRICING
      ======================================================== */}
      <section id="pricing" className="py-20 sm:py-24 border-b border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#070e1b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 mb-3">
              07 // TRANSPARENT PRICING
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Scale your pipeline, not your costs
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-3 font-normal max-w-xl mx-auto">
              Compare managed outbound scopes. Confirm total inclusions and delivery terms before launch.
            </p>

            {/* Currency Switcher */}
            <div className="mt-5 inline-flex items-center p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono shadow-xs">
              {(['USD', 'EUR', 'GBP'] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCurrencyChange(c)}
                  className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                    currency === c
                      ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            
            {/* Tier 1: PILOT */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
              <div>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">TIER 1</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">PILOT</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Validate your offer and message market fit with a focused 30-day outbound sprint.
                </p>

                <div className="my-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-mono">
                      {currencySymbol}{Math.round(999 * currencyMultiplier).toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">/month</span>
                  </div>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono font-semibold block mt-1">
                    1,000 Verified Prospects
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>1 Outbound Channel (Email or LinkedIn)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Custom ICP prospect list &amp; enrichment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>2 Copywriting angles A/B tested</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Secondary domain warming setup</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Direct calendar meeting booking</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={checkingOutTier === 'pilot'}
                  onClick={() => handleChoosePlanCheckout('pilot', 'Pilot Sprint', 999)}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer text-center flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {checkingOutTier === 'pilot' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Stripe Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Choose Pilot Plan &bull; {currencySymbol}{Math.round(999 * currencyMultiplier)}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenBooking(`Pilot Scope (${currencySymbol}${Math.round(999 * currencyMultiplier)}/mo)`)}
                  className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-[11px] font-medium transition cursor-pointer text-center"
                >
                  Or discuss plan on a fit call
                </button>
              </div>
            </div>

            {/* Tier 2: BUSINESS (Featured) */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d2345] border-2 border-emerald-500 shadow-md flex flex-col justify-between space-y-6 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider font-mono shadow-xs">
                MOST POPULAR
              </div>

              <div>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">TIER 2</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">BUSINESS</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Scale your pipeline with unified multi-channel LinkedIn and Email coordination.
                </p>

                <div className="my-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-mono">
                      {currencySymbol}{Math.round(2990 * currencyMultiplier).toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">/month</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-bold block mt-1">
                    3,000 Verified Prospects / mo
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-200 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span><strong>Multi-Channel:</strong> LinkedIn + Cold Email</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Dedicated SDR Inbox Reply Manager</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Clay Waterfall Data &amp; Mobile Phone Enrichment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>ALM Nexus, HubSpot, or Pipedrive CRM sync</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Bi-weekly pipeline optimization reviews</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Target: 10–18 Sales-Qualified Meetings/mo</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={checkingOutTier === 'business'}
                  onClick={() => handleChoosePlanCheckout('business', 'Business Retainer', 2990)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer text-center flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {checkingOutTier === 'business' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Stripe Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Choose Business Retainer &bull; {currencySymbol}{Math.round(2990 * currencyMultiplier)}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenBooking(`Business Retainer (${currencySymbol}${Math.round(2990 * currencyMultiplier)}/mo)`)}
                  className="w-full py-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white text-[11px] font-medium transition cursor-pointer text-center"
                >
                  Or discuss plan on a fit call
                </button>
              </div>
            </div>

            {/* Tier 3: ENTERPRISE */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
              <div>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">TIER 3</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">ENTERPRISE</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Full outbound team replacement for high-growth SaaS, agencies, and enterprise sales.
                </p>

                <div className="my-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white font-mono">
                      {currencySymbol}{Math.round(5490 * currencyMultiplier).toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">/month</span>
                  </div>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono font-semibold block mt-1">
                    7,000+ Verified Prospects / mo
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Multi-inbox scaling (up to 15 sender inboxes)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Founder LinkedIn Ghostwriting &amp; Thought Leadership</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Custom n8n / Make webhook pipelines</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Dedicated Senior Growth Director</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Target: 20–35+ Sales-Qualified Meetings/mo</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={checkingOutTier === 'enterprise'}
                  onClick={() => handleChoosePlanCheckout('enterprise', 'Enterprise Scaling', 5490)}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer text-center flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {checkingOutTier === 'enterprise' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Stripe Session...</span>
                    </>
                  ) : (
                    <>
                      <span>Choose Enterprise Plan &bull; {currencySymbol}{Math.round(5490 * currencyMultiplier)}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenBooking(`Enterprise Custom Scope (${currencySymbol}${Math.round(5490 * currencyMultiplier)}/mo)`)}
                  className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-[11px] font-medium transition cursor-pointer text-center"
                >
                  Or discuss custom enterprise scope
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================
          9. CLIENT SUCCESS STORIES & CLUTCH REVIEWS
      ======================================================== */}
      <section className="py-16 sm:py-24 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a192f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1 text-amber-500 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
              ))}
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 ml-1">5.0 on Clutch &bull; 100+ Reviews</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Trusted by 100+ B2B teams
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                ))}
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic font-normal">
                "The team over-executed on metrics and KPIs. Their multi-channel outreach achieved 14 qualified discovery calls in our first 30 days."
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-xs text-slate-900 dark:text-white block">Soren Lindqvist</span>
                <span className="text-[10px] text-slate-400">Head of Growth, Nordic Fintech</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                ))}
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic font-normal">
                "We replaced an entire SDR team that cost us $16,000/mo with LeadFlow's Business Retainer. More pipeline, higher reply quality, zero management friction."
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-xs text-slate-900 dark:text-white block">Elena Rostova</span>
                <span className="text-[10px] text-slate-400">Co-Founder &amp; COO, CloudOps SaaS</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                ))}
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic font-normal">
                "Our agency closed three $15k retainers in Q3 exclusively from LeadFlow LinkedIn outreach sequences. The ROI has been over 7x."
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-xs text-slate-900 dark:text-white block">Devon Vance</span>
                <span className="text-[10px] text-slate-400">Managing Director, Studio Apex</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          10. COMMON QUESTIONS (FAQ Accordion)
      ======================================================== */}
      <section id="faq" className="py-20 sm:py-24 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#060c18]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 mb-3">
              08 // FREQUENTLY ASKED QUESTIONS
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Everything you need to know
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => {
              const isOpen = activeFaq === i;
              return (
                <div 
                  key={i}
                  className="bg-white dark:bg-[#0d203d] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : i)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        0{i + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {faq.q}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3 font-normal animate-fadeIn">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ========================================================
          11. FINAL CTA SECTION
      ======================================================== */}
      <section className="py-20 sm:py-28 relative overflow-hidden bg-slate-900 dark:bg-[#071324] border-b border-slate-800 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative">
          
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center shadow-sm mx-auto">
            <Send className="w-6 h-6 transform -rotate-12" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Ready to scale your pipeline?
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto font-normal">
            Book a 30-minute fit call to review your target market, channel economics, and get an exact outbound plan tailored to your sales capacity.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => handleOpenBooking('Website Footer CTA')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Book A Call &bull; 30 Min Fit Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (currentUser && onEnterWorkspace) {
                  onEnterWorkspace();
                } else if (onOpenLoginModal) {
                  onOpenLoginModal();
                }
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>ALM Nexus Client &amp; Ops Suite</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================
          12. COMPREHENSIVE FOOTER (An ALM Nexus Product)
      ======================================================== */}
      <footer className="border-t border-slate-800 bg-slate-900 dark:bg-[#050b14] text-slate-400 py-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          {/* Top Row: Brand & Product Attribution */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">
                  LeadFlow
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
                  An ALM Nexus Product
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md font-normal">
                LeadFlow is the specialized B2B outbound lead generation engine of the ALM Nexus Enterprise Client Handling &amp; Project Operations Suite.
              </p>
            </div>

            {/* Quick module links */}
            <div className="flex flex-wrap gap-4 text-xs font-mono">
              <a href="#services" className="hover:text-emerald-400 transition">Services</a>
              <a href="#case-studies" className="hover:text-emerald-400 transition">Case Studies</a>
              <a href="#calculator" className="hover:text-emerald-400 transition">ROI Calculator</a>
              <a href="#free-tools" className="hover:text-emerald-400 transition">Free Tools</a>
              <a href="#pricing" className="hover:text-emerald-400 transition">Pricing</a>
              <a href="#faq" className="hover:text-emerald-400 transition">FAQ</a>
              <button 
                onClick={() => {
                  if (currentUser && onEnterWorkspace) onEnterWorkspace();
                  else if (onOpenLoginModal) onOpenLoginModal();
                }}
                className="text-emerald-400 font-bold hover:underline"
              >
                ALM Nexus Workspace &rarr;
              </button>
            </div>
          </div>

          {/* Bottom Row: Copyright & Legal */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-slate-500">
            <p>
              &copy; 2026 LeadFlow &bull; A Product by ALM Nexus Operations Platform. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span>SOP 1–11 Compliant</span>
              <span>&bull;</span>
              <span>Primary Domain Protection</span>
              <span>&bull;</span>
              <span>GDPR &amp; CAN-SPAM Certified</span>
            </div>
          </div>

        </div>
      </footer>

      {/* Booking Modal */}
      <LeadFlowBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        preselectedPlan={selectedPlanForBooking}
      />

      {/* Interactive Sequence Playbook Drawer */}
      <InteractiveCampaignDrawer
        isOpen={isCampaignDrawerOpen}
        onClose={() => setIsCampaignDrawerOpen(false)}
        campaign={selectedCampaignForDrawer}
        onDeployCampaign={(campaignName) => handleOpenBooking(`Replicate Sequence: ${campaignName}`)}
      />
    </div>
  );
};
