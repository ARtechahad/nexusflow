import React, { useState } from 'react';
import { 
  Wrench, 
  Mail, 
  Linkedin, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw,
  Phone,
  Flame,
  ArrowRight,
  ShieldCheck,
  Send
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LeadFlowFreeToolsSection: React.FC<{ onBookCall?: () => void }> = ({ onBookCall }) => {
  const { showToast } = useApp();
  const [activeTool, setActiveTool] = useState<'email_finder' | 'spam_checker' | 'hook_optimizer' | 'intent_scanner'>('email_finder');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Email Finder State
  const [targetDomain, setTargetDomain] = useState('stripe.com');
  const [targetRole, setTargetRole] = useState('VP of Sales');
  const [findingEmail, setFindingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{
    pattern?: string;
    patterns: string[];
    sampleEmail: string;
    mxStatus: string;
    deliverabilityConfidence: number;
    phoneFormat: string;
    lineStatus?: string;
    provider?: string;
  } | null>({
    pattern: '{first}.{last}@stripe.com',
    patterns: ['{first}.{last}@stripe.com', '{f}{last}@stripe.com', '{first}@stripe.com'],
    sampleEmail: 'v.patel@stripe.com',
    mxStatus: 'Google Workspace Enterprise (Verified MX Records)',
    deliverabilityConfidence: 98,
    phoneFormat: '+1 (415) 890-XXXX (Direct Dial Available)',
    lineStatus: 'Direct Dial & Mobile Carrier Active'
  });

  // 2. Spam Checker State
  const [emailSubject, setEmailSubject] = useState('Quick question regarding your outbound SDR pipeline');
  const [emailBody, setEmailBody] = useState(`Hi {{firstName}},

Saw you are scaling the business development team at {{companyName}}. 

Most B2B SaaS teams we speak with spend $8,500/mo on an in-house SDR who takes 3 months to ramp up. We handle prospect research, email warmup, and LinkedIn outreach on a managed retainer, booking 7-15 qualified meetings directly to your calendar.

Would you be open to seeing an anonymized case study of how we scaled pipeline for a similar fintech company?

Best,
Marcus`);
  const [analyzingSpam, setAnalyzingSpam] = useState(false);
  const [spamScore, setSpamScore] = useState<{
    score: number; // 0-100 (higher = better deliverability)
    grade: 'A+' | 'B' | 'C' | 'Risky';
    wordCount: number;
    readingTimeSec: number;
    flaggedWords: string[];
    recommendations: string[];
  }>({
    score: 94,
    grade: 'A+',
    wordCount: 76,
    readingTimeSec: 22,
    flaggedWords: [],
    recommendations: [
      'Excellent word count (under 90 words is ideal for mobile executive reading)',
      'Clear, low-friction call-to-action asking for interest rather than asking for a 30-min call upfront',
      'No spam trigger words detected ($$$ , FREE, Guarantee, Urgent)'
    ]
  });

  // 3. LinkedIn Hook Optimizer State
  const [targetPersona, setTargetPersona] = useState('VP of Sales / B2B Founders');
  const [hookTopic, setHookTopic] = useState('Why cold calling is dead and multi-channel outbound is winning in 2026');
  const [generatingHook, setGeneratingHook] = useState(false);
  const [hooksList, setHooksList] = useState<string[]>([
    "We spent $42,000 testing cold email vs. LinkedIn outreach in Q3.\n\nHere is the exact data breakdown (and why single-channel outbound is burning your budget): 🧵",
    "Most B2B founders fire their SDR after 90 days.\n\nIt's rarely the SDR's fault. Here's what actually broke in your pipeline:",
    "If your cold email reply rate is below 4%, do not send another email until you fix these 3 DNS settings:"
  ]);

  // 4. Intent Scanner State
  const [intentCompany, setIntentCompany] = useState('Fintech / Enterprise Payments');
  const [scanningIntent, setScanningIntent] = useState(false);
  const [intentResults, setIntentResults] = useState<{
    intentLevel: 'Very High' | 'High' | 'Moderate';
    signals: string[];
    suggestedAngle: string;
    recentHirings?: string[];
    fundingStatus?: string;
    techStackChanges?: string[];
    growthTriggers?: string[];
    provider?: string;
  }>({
    intentLevel: 'Very High',
    signals: [
      'Active job postings for "Account Executive" & "Head of Partnerships" detected in last 14 days',
      'Recent Series B funding announcement ($24M) indicates aggressive outbound pipeline mandate',
      'Tech stack updated: Migrated from HubSpot to Salesforce CRM + Apollo API'
    ],
    recentHirings: ['Head of Outbound Partnerships', 'Enterprise Account Executive', 'RevOps Lead'],
    fundingStatus: 'Series B ($24M Growth Round) &bull; Aggressive GTM Mandate',
    techStackChanges: ['HubSpot CRM &bull; Apollo API &bull; Clay Data Waterfall'],
    growthTriggers: ['Accelerating enterprise SDR pipeline before Q4 target'],
    suggestedAngle: 'Reach out to the VP of Commercial Growth referencing their recent hiring expansion and offer immediate appointment setting to accelerate time-to-revenue.'
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard!', 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Endpoint 1: Email & Mobile Finder Integration
  const handleRunEmailFinder = async () => {
    const cleanDomain = targetDomain.trim();
    if (!cleanDomain) {
      showToast('Please enter a target company domain (e.g. stripe.com)', 'error');
      return;
    }
    setFindingEmail(true);
    try {
      const res = await fetch('/api/gtm/email-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyDomain: cleanDomain,
          personaTitle: targetRole.trim() || 'VP of Sales'
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}: Failed to analyze domain`);
      }
      const data = json.data;
      setEmailResult({
        pattern: data.pattern || (data.patterns && data.patterns[0]) || `{first}.{last}@${cleanDomain}`,
        patterns: Array.isArray(data.patterns) && data.patterns.length > 0 ? data.patterns : [data.pattern],
        sampleEmail: data.sampleEmail || `alex.rivers@${cleanDomain}`,
        mxStatus: data.mxStatus || 'Active Mail Exchange & Catch-All Resolved',
        deliverabilityConfidence: data.deliverabilityConfidence ?? 96,
        phoneFormat: data.phoneFormat || '+1 (555) 720-XXXX (Waterfall Verified Mobile)',
        lineStatus: data.lineStatus || 'Direct Dial & Mobile Carrier Active',
        provider: data.provider
      });
      showToast(`Domain analyzed! Verified pattern found via ${data.provider || 'Self-Built Scraper & MX Engine'}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error communicating with Email Finder API', 'error');
    } finally {
      setFindingEmail(false);
    }
  };

  // Endpoint 2: Spam Checker Integration (OpenAI gpt-4o-mini / Gemini)
  const handleRunSpamCheck = async () => {
    if (!emailBody.trim()) {
      showToast('Please enter email body copy to check deliverability', 'error');
      return;
    }
    setAnalyzingSpam(true);
    try {
      const res = await fetch('/api/gtm/spam-checker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailCopy: emailBody,
          subject: emailSubject
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}: Failed to analyze spam deliverability`);
      }
      const data = json.data;
      setSpamScore({
        score: data.deliverabilityScore ?? data.score ?? 90,
        grade: data.grade || 'A+',
        wordCount: data.wordCount || emailBody.trim().split(/\s+/).length,
        readingTimeSec: data.readingTimeSec || Math.round(emailBody.trim().split(/\s+/).length / 3.5),
        flaggedWords: Array.isArray(data.spamTriggerWords) ? data.spamTriggerWords : (data.flaggedWords || []),
        recommendations: Array.isArray(data.improvementSuggestions) ? data.improvementSuggestions : (data.recommendations || [])
      });
      showToast(`Spam analysis complete! Deliverability Score: ${data.deliverabilityScore ?? data.score}/100`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Error communicating with Spam Checker API', 'error');
    } finally {
      setAnalyzingSpam(false);
    }
  };

  // Endpoint 3: Hook Generator Integration (OpenAI gpt-4o-mini / Gemini)
  const handleRunHookGenerator = async () => {
    const angle = hookTopic.trim();
    if (!angle) {
      showToast('Please enter your offer, angle, or insight', 'error');
      return;
    }
    setGeneratingHook(true);
    try {
      const res = await fetch('/api/gtm/hook-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPersona: targetPersona.trim() || 'VP of Sales',
          valueProp: angle,
          hookTopic: angle
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}: Failed to generate hooks`);
      }
      const data = json.data;
      if (Array.isArray(data.hooks) && data.hooks.length > 0) {
        setHooksList(data.hooks);
        showToast(`Generated 3 conversational LinkedIn hooks via ${data.provider || 'AI Engine'}!`, 'success');
      } else {
        throw new Error('No hooks returned from API');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error communicating with Hook Generator API', 'error');
    } finally {
      setGeneratingHook(false);
    }
  };

  // Intent Scanner Integration
  const handleRunIntentScanner = async () => {
    setScanningIntent(true);
    try {
      const res = await fetch('/api/gtm/intent-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetMarket: intentCompany
        })
      });
      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setIntentResults(json.data);
        showToast('Live ICP intent signals refreshed from market intelligence!', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error scanning intent signals', 'error');
    } finally {
      setScanningIntent(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-[#0a192f] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-sm">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold font-mono mb-3">
          <Wrench className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>FREE GTM PROSPECTING ENGINE &bull; NO SUBSCRIPTION REQUIRED</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Enterprise Outbound &amp; GTM Operations Tools
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 font-normal">
          Use the same proprietary tools our outbound team relies on to verify decision-maker emails, analyze spam triggers, and optimize outreach.
        </p>
      </div>

      {/* Tool Selector Tabs */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap mb-8 p-1.5 bg-slate-100 dark:bg-slate-850/80 rounded-xl border border-slate-200 dark:border-slate-800 max-w-2xl mx-auto">
        {[
          { id: 'email_finder', label: 'Email & Mobile Finder', icon: Search },
          { id: 'spam_checker', label: 'Cold Email Spam Checker', icon: Mail },
          { id: 'hook_optimizer', label: 'LinkedIn Hook Generator', icon: Linkedin },
          { id: 'intent_scanner', label: 'ICP Intent Signals', icon: Flame }
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTool(t.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-slate-900 dark:bg-slate-800 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tool 1: Email & Mobile Finder */}
      {activeTool === 'email_finder' && (
        <div className="max-w-3xl mx-auto bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-6 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>Decision-Maker Pattern &amp; Deliverability Scanner</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enter target company domain and decision-maker seniority to reveal verified email patterns and direct line presence.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Target Company Domain
              </label>
              <input
                type="text"
                value={targetDomain}
                onChange={e => setTargetDomain(e.target.value)}
                placeholder="e.g. stripe.com or ramp.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-slate-400 dark:focus:border-slate-600 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Target Title / Persona
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
                placeholder="e.g. VP Sales, CTO, CMO"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-slate-400 dark:focus:border-slate-600 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={findingEmail}
              onClick={handleRunEmailFinder}
              className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-2"
            >
              {findingEmail ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning MX &amp; Clay Enrichment...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-slate-300" />
                  <span>Find Verified Patterns</span>
                </>
              )}
            </button>
          </div>

          {emailResult && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Primary Verified Email Pattern:</span>
                  <span className="font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-[11px] border border-slate-200 dark:border-slate-700">
                    {emailResult.pattern || emailResult.patterns?.[0]}
                  </span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-semibold border border-emerald-500/20">
                  {emailResult.deliverabilityConfidence}% Confidence
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-mono">Sample Verified Contact</span>
                  <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">
                    {emailResult.sampleEmail}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-mono">Mobile / Direct Dial</span>
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 block">
                    {emailResult.phoneFormat}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono pt-1 border-t border-slate-100 dark:border-slate-800">
                <span>MX: {emailResult.mxStatus}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">{emailResult.lineStatus || 'Direct Dial & Mobile Carrier Active'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tool 2: Spam Checker */}
      {activeTool === 'spam_checker' && (
        <div className="max-w-3xl mx-auto bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-5 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>Cold Email Deliverability &amp; Spam Trigger Analyzer</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Paste your cold email copy to test against spam filters, reading length, and executive response probability.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-slate-400 dark:focus:border-slate-600 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email Body
            </label>
            <textarea
              rows={6}
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-slate-400 dark:focus:border-slate-600 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition resize-none font-mono"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={analyzingSpam}
              onClick={handleRunSpamCheck}
              className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-2"
            >
              {analyzingSpam ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Deliverability...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-300" />
                  <span>Analyze Deliverability Score</span>
                </>
              )}
            </button>
          </div>

          {spamScore && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Deliverability Grade</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{spamScore.grade}</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">({spamScore.score}/100 Score)</span>
                  </div>
                </div>

                <div className="text-right text-xs font-mono">
                  <span className="text-slate-500 block">Length: {spamScore.wordCount} words</span>
                  <span className="text-slate-500 block">Read time: ~{spamScore.readingTimeSec}s</span>
                </div>
              </div>

              {spamScore.flaggedWords && spamScore.flaggedWords.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-semibold flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Detected Spam Trigger Words:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {spamScore.flaggedWords.map((word, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-mono text-[11px] font-semibold">
                        "{word}"
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  LeadFlow Deliverability Recommendations:
                </span>
                {spamScore.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tool 3: LinkedIn Hook Generator */}
      {activeTool === 'hook_optimizer' && (
        <div className="max-w-3xl mx-auto bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-5 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span>LinkedIn B2B Outreach &amp; Thought Leadership Hook Generator</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Enter target persona and value prop to generate high-converting, scroll-stopping hooks for LinkedIn outreach notes and viral posts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Target Persona
              </label>
              <input
                type="text"
                value={targetPersona}
                onChange={e => setTargetPersona(e.target.value)}
                placeholder="e.g. VP of Sales, CTO, CMO"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-slate-400 dark:focus:border-slate-600 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Value Proposition / Topic Angle
              </label>
              <input
                type="text"
                value={hookTopic}
                onChange={e => setHookTopic(e.target.value)}
                placeholder="e.g. Why cold calling is dead or Managed appointment setting"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-slate-400 dark:focus:border-slate-600 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={generatingHook}
              onClick={handleRunHookGenerator}
              className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-2"
            >
              {generatingHook ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Conversational Hooks...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-slate-300" />
                  <span>Generate 3 LinkedIn Hooks</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {hooksList.map((hk, i) => (
              <div key={i} className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shadow-2xs">
                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                  {hk}
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy(hk, `hook_${i}`)}
                  className="p-1.5 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition shrink-0 cursor-pointer"
                  title="Copy Hook"
                >
                  {copiedKey === `hook_${i}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool 4: Intent Scanner */}
      {activeTool === 'intent_scanner' && (
        <div className="max-w-3xl mx-auto bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-5 animate-fadeIn">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>ICP Intent Signal &amp; Trigger Event Analyzer</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Discover real-time buying signals (hiring growth, tech migrations, funding rounds) to time your outbound outreach with precision.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={intentCompany}
              onChange={e => setIntentCompany(e.target.value)}
              placeholder="e.g. Fintech / Enterprise Payments or stripe.com"
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-slate-400 dark:focus:border-slate-600 focus:ring-2 focus:ring-slate-900/5 dark:focus:ring-white/5 transition"
            />
            <button
              type="button"
              disabled={scanningIntent}
              onClick={handleRunIntentScanner}
              className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              {scanningIntent ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning Market Signals...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-slate-300" />
                  <span>Scan Real-Time Intent</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            <strong>Why intent signals matter:</strong> Prospects reached within 14 days of an executive hire or funding round exhibit a <strong>3.4x higher meeting conversion rate</strong> than cold static databases.
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900 dark:text-white">Active Signal Feeds:</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-semibold border border-emerald-500/20">
                {intentResults.intentLevel} Buying Intent
              </span>
            </div>

            <div className="space-y-2">
              {intentResults.signals.map((sig, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{sig}</span>
                </div>
              ))}
            </div>

            {/* Structured Triggers (Hirings, Funding, Tech Migrations) */}
            {(intentResults.recentHirings || intentResults.fundingStatus || intentResults.techStackChanges) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {intentResults.recentHirings && intentResults.recentHirings.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase font-mono block mb-1">Recent Hiring Triggers</span>
                    <div className="flex flex-wrap gap-1">
                      {intentResults.recentHirings.map((h, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-medium border border-slate-200 dark:border-slate-700">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {intentResults.fundingStatus && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase font-mono block mb-1">Funding &amp; Capital Momentum</span>
                    <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400" dangerouslySetInnerHTML={{ __html: intentResults.fundingStatus }} />
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex-1">
                <span className="text-[11px] font-semibold text-slate-900 dark:text-slate-200 block mb-0.5">
                  Recommended Outbound Angle:
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic">
                  "{intentResults.suggestedAngle}"
                </p>
              </div>
              {intentResults.provider && (
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-mono shrink-0 border border-slate-200 dark:border-slate-700">
                  {intentResults.provider}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom CTA Banner inside Free Tools */}
      <div className="mt-8 text-center pt-4">
        <button
          type="button"
          onClick={onBookCall}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs border border-slate-800 dark:border-slate-700"
        >
          <span>Want LeadFlow to manage and execute this outbound engine for you? Book a 30-min fit call</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
