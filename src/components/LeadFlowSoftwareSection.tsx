import React, { useState } from 'react';
import {
  Flame,
  GitBranch,
  Split,
  ShieldCheck,
  Inbox,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Shield,
  Zap,
  Lock,
  ChevronDown,
  Sparkles,
  ExternalLink,
  Layers,
  Terminal,
  Activity,
  Check,
  AlertCircle
} from 'lucide-react';
import { OUTREACH_PLANS } from '../../server/services/outreach/plans';

interface SoftwareSectionProps {
  onOpenDocs?: () => void;
  onEnterWorkspace?: () => void;
}

export const LeadFlowSoftwareSection: React.FC<SoftwareSectionProps> = ({
  onOpenDocs,
  onEnterWorkspace
}) => {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Free Tool 1: Email Verifier
  const [verifyEmailInput, setVerifyEmailInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any | null>(null);

  // Free Tool 2: DNS Checker
  const [dnsDomainInput, setDnsDomainInput] = useState('');
  const [checkingDns, setCheckingDns] = useState(false);
  const [dnsResult, setDnsResult] = useState<any | null>(null);

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const res = await fetch('/api/outreach/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingInterval })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        onEnterWorkspace?.();
      }
    } catch {
      onEnterWorkspace?.();
    } finally {
      setCheckoutLoading(null);
    }
  };

  const runPublicVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmailInput.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/outreach/v1/public/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verifyEmailInput.trim() })
      });
      const data = await res.json();
      setVerifyResult(data.verification || { status: 'unknown', reason: 'Service unavailable' });
    } catch {
      setVerifyResult({ status: 'unknown', reason: 'Network error' });
    } finally {
      setVerifying(false);
    }
  };

  const runPublicDnsCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dnsDomainInput.trim()) return;
    setCheckingDns(true);
    setDnsResult(null);
    try {
      const res = await fetch('/api/outreach/v1/public/dns-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: dnsDomainInput.trim() })
      });
      const data = await res.json();
      setDnsResult(data.dnsReport || null);
    } catch {
      setDnsResult(null);
    } finally {
      setCheckingDns(false);
    }
  };

  const softwareFaqs = [
    {
      q: 'How does LeadFlow protect my primary domain from getting blacklisted?',
      a: 'LeadFlow uses a three-tier protection architecture: 1) We recommend and support secondary outreach domains, 2) our Cap Guard enforces strict daily and hourly sending throttles across all inboxes, and 3) our Peer-to-Peer Warmup Engine automatically halves send volume if your spam rate exceeds 5%.'
    },
    {
      q: 'What is the Model Context Protocol (MCP) and how can AI agents use it?',
      a: 'MCP is the open standard protocol for connecting AI assistants to external tools. LeadFlow provides an authenticated Streamable HTTP / SSE MCP endpoint. You can connect Claude Desktop or Cursor to inspect your campaigns, enroll prospects, and start paced outreach using natural conversational prompts.'
    },
    {
      q: 'How does A–Z variant auto-optimization work?',
      a: 'You can test up to 26 subject line and email body variants (A through Z) on any step. Once variants record at least 100 sends each, our engine applies a Bayesian Beta-posterior formula to allocate traffic dynamically toward the copy with the highest reply rate, while keeping a 5% exploration floor.'
    },
    {
      q: 'Can I connect mailboxes from Google Workspace and Microsoft 365 simultaneously?',
      a: 'Yes. LeadFlow supports multi-provider mailbox pooling. You can connect Gmail, Outlook, Zoho, and custom SMTP inboxes under the same campaign and distribute outbound volume evenly across them.'
    },
    {
      q: 'Are custom tracking domains and unsubscribe headers supported?',
      a: 'Yes. You can configure custom CNAME tracking domains (e.g. track.yourdomain.com) to avoid shared domain penalties. All outgoing emails automatically include RFC 8058 one-click List-Unsubscribe headers compliant with Google and Yahoo sender guidelines.'
    }
  ];

  return (
    <section id="software" className="py-24 border-b border-slate-200/80 dark:border-white/10 bg-slate-900 text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-24">
        {/* Software Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>LeadFlow Outbound Software Suite</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            The Autonomous Outbound & Deliverability Engine
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Connect unlimited sending inboxes, automate reputation warmup, branch multi-touch sequences dynamically, and let AI agents scale qualified meetings safely.
          </p>
          {onOpenDocs && (
            <div className="pt-2">
              <button
                onClick={onOpenDocs}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer"
              >
                <span>Read Developer Documentation & MCP Specs</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Feature Grid (6 distinctive cards) */}
        <div>
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-white">Full-Stack Cold Outbound Architecture</h3>
            <p className="text-slate-400 text-sm mt-1">Everything required to run high-converting, spam-free outbound at scale.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Mailbox Warmup */}
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-indigo-500/50 transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <Flame className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Peer-to-Peer Warmup Engine</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Autonomous inbox exchange across Google Workspace, Microsoft 365, and private SMTP. Includes automatic spam folder rescue and ramp throttling.
              </p>
            </div>

            {/* 2. Multi-Step Sequences */}
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-indigo-500/50 transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <GitBranch className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Conditional Sequence Branching</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Visual node builder that evaluates 8 real-time event rules (opened, clicked, replied, sentiment) to send tailored follow-ups automatically.
              </p>
            </div>

            {/* 3. A-Z Testing */}
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-indigo-500/50 transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Split className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Bayesian A–Z Variant Optimization</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Deploy up to 26 subject and copy variants per step. Automatically shifts traffic toward winning copy using Beta-posterior reply analysis.
              </p>
            </div>

            {/* 4. Verification */}
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-indigo-500/50 transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Layered Email Verification</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Pre-flight deliverability check flags disposable domains, role accounts, typo suggestions, and missing MX records to maintain &lt;1% bounce rates.
              </p>
            </div>

            {/* 5. Unified Inbox */}
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-indigo-500/50 transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Inbox className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Unified Smart Inbox</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Triage replies across all sending domains in one clean interface. Built-in sentiment classifier auto-detects meeting requests, referrals, and objections.
              </p>
            </div>

            {/* 6. MCP & API */}
            <div className="p-6 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-indigo-500/50 transition space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Model Context Protocol (MCP) & REST API</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Control outreach via Claude, Cursor, or your backend. Full REST surface with Bearer API keys, rate limits, webhooks, and idempotent POST execution.
              </p>
            </div>
          </div>
        </div>

        {/* 4-Step How It Works */}
        <div className="space-y-12">
          <div className="text-center max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-white">How It Works</h3>
            <p className="text-slate-400 text-sm mt-1">Four simple steps from zero to predictable enterprise outbound pipeline.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3 relative">
              <span className="text-3xl font-extrabold text-indigo-400 font-mono">01</span>
              <h4 className="text-sm font-bold text-white">Connect & Verify DNS</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Plug in your mailboxes. Our real-time DNS inspector verifies SPF, DKIM, DMARC, and MX records before a single email is dispatched.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3 relative">
              <span className="text-3xl font-extrabold text-indigo-400 font-mono">02</span>
              <h4 className="text-sm font-bold text-white">Warm Up Inboxes</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Our peer-to-peer network exchanges authentic business correspondence, automatically rescuing missed messages to build high trust.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3 relative">
              <span className="text-3xl font-extrabold text-indigo-400 font-mono">03</span>
              <h4 className="text-sm font-bold text-white">Launch Adaptive Flows</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Compose sequences with A–Z variants and conditional logic. Cap Guard paces every send so your domain reputation never degrades.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3 relative">
              <span className="text-3xl font-extrabold text-indigo-400 font-mono">04</span>
              <h4 className="text-sm font-bold text-white">Automate via Agents</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Use our MCP server and REST endpoints to let AI agents or your internal CRM automate list enrichment, enrollment, and reply triage.
              </p>
            </div>
          </div>
        </div>

        {/* Public Free Tools (Email Verifier & DNS Checker) */}
        <div className="p-8 rounded-3xl bg-slate-800/80 border border-slate-700 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="w-3.5 h-3.5" />
              <span>Public Deliverability Utilities</span>
            </div>
            <h3 className="text-2xl font-bold text-white">Instant Free Tools (No Signup Required)</h3>
            <p className="text-slate-400 text-xs sm:text-sm">
              Test our deliverability and verification engines directly from your browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Free Tool 1: Email Verifier */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-bold text-white">Live Email Verifier</h4>
              </div>
              <p className="text-slate-400 text-xs">
                Checks RFC syntax, disposable domains, role addresses (e.g. sales@, info@), and MX records.
              </p>

              <form onSubmit={runPublicVerify} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={verifyEmailInput}
                    onChange={(e) => setVerifyEmailInput(e.target.value)}
                    placeholder="alex@acme-corp.com"
                    required
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={verifying}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 cursor-pointer"
                  >
                    {verifying ? 'Checking...' : 'Verify Email'}
                  </button>
                </div>
              </form>

              {verifyResult && (
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Deliverability Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                        verifyResult.status === 'valid'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : verifyResult.status === 'risky'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {verifyResult.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{verifyResult.reason}</p>
                </div>
              )}
            </div>

            {/* Free Tool 2: SPF/DKIM/DMARC Checker */}
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">SPF / DKIM / DMARC DNS Checker</h4>
              </div>
              <p className="text-slate-400 text-xs">
                Inspects domain DNS TXT and MX records against modern Google & Yahoo deliverability standards.
              </p>

              <form onSubmit={runPublicDnsCheck} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dnsDomainInput}
                    onChange={(e) => setDnsDomainInput(e.target.value)}
                    placeholder="stripe.com"
                    required
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={checkingDns}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 cursor-pointer"
                  >
                    {checkingDns ? 'Querying DNS...' : 'Check Domain'}
                  </button>
                </div>
              </form>

              {dnsResult && (
                <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900">
                      <span className="text-slate-400">SPF Record:</span>
                      <span className={dnsResult.spf?.valid ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {dnsResult.spf?.valid ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900">
                      <span className="text-slate-400">DMARC Policy:</span>
                      <span className={dnsResult.dmarc?.valid ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {dnsResult.dmarc?.valid ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900">
                      <span className="text-slate-400">MX Mail Servers:</span>
                      <span className={dnsResult.mx?.valid ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {dnsResult.mx?.valid ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900">
                      <span className="text-slate-400">DKIM Selectors:</span>
                      <span className={dnsResult.dkim?.valid ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {dnsResult.dkim?.valid ? 'DETECTED' : 'CHECKING'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Software Pricing Section */}
        <div className="space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h3 className="text-2xl sm:text-3xl font-bold text-white">Transparent Software Subscriptions</h3>
            <p className="text-slate-400 text-sm">
              All plans include autonomous mailbox warmup, multi-step branching, and API access.
            </p>

            {/* Billing Interval Toggle */}
            <div className="inline-flex items-center p-1 rounded-xl bg-slate-800 border border-slate-700 text-xs">
              <button
                onClick={() => setBillingInterval('monthly')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                  billingInterval === 'monthly' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval('annual')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  billingInterval === 'annual' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Annual</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold">20% OFF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {Object.values(OUTREACH_PLANS).map((p) => {
              const isPopular = p.id === 'growth';
              const price = billingInterval === 'annual' ? p.annualPriceUsd : p.monthlyPriceUsd;

              return (
                <div
                  key={p.id}
                  className={`rounded-3xl p-8 flex flex-col justify-between transition relative ${
                    isPopular
                      ? 'bg-gradient-to-b from-indigo-950/80 to-slate-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10'
                      : 'bg-slate-800/60 border border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500 text-white shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <h4 className="text-xl font-bold text-white">{p.name}</h4>
                      <p className="text-slate-400 text-xs mt-1">For growing sales teams</p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-white font-mono">${price}</span>
                      <span className="text-slate-400 text-xs">/month</span>
                    </div>

                    <div className="space-y-2.5 pt-4 border-t border-slate-700/80 text-xs text-slate-300">
                      <div className="flex items-center gap-2 font-semibold text-white">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{p.monthlySendLimit.toLocaleString()} Cold Emails / Month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Up to {p.mailboxLimit} Connected Sending Mailboxes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{p.verificationQuota.toLocaleString()} Email Verifications / Month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Autonomous Peer-to-Peer Warmup</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Conditional Branching & A–Z Variants</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>REST API & Model Context Protocol (MCP)</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8">
                    <button
                      onClick={() => handleCheckout(p.id)}
                      disabled={checkoutLoading === p.id}
                      className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                        isPopular
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                          : 'bg-slate-700 hover:bg-slate-600 text-white'
                      }`}
                    >
                      <span>{checkoutLoading === p.id ? 'Connecting Stripe...' : `Get Started with ${p.name}`}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Software FAQ */}
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-white">Frequently Asked Questions</h3>
            <p className="text-slate-400 text-sm">Everything you need to know about our outbound software platform.</p>
          </div>

          <div className="space-y-3">
            {softwareFaqs.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-800/40 overflow-hidden">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between text-sm font-semibold text-white hover:text-indigo-400 transition cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-0 text-xs text-slate-300 leading-relaxed border-t border-slate-800/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Compliance Statement */}
        <div className="p-8 rounded-3xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h4 className="text-base font-bold text-white">Strict Compliance & Deliverability Posture</h4>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed max-w-2xl">
              LeadFlow enforces 100% CAN-SPAM Act compliance, GDPR Right-to-be-Forgotten protocols, and mandatory RFC 8058 one-click unsubscribe headers. Mailbox credentials are encrypted using AES-256-GCM authenticated cipher before persistence.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              CAN-SPAM Verified
            </span>
            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              GDPR Compliant
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
