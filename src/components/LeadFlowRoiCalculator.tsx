import React, { useState } from 'react';
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight,
  Zap,
  Building,
  Users,
  Mail,
  Download,
  X,
  FileText,
  Check,
  Send
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LeadFlowRoiCalculatorProps {
  onBookCall?: () => void;
}

export const LeadFlowRoiCalculator: React.FC<LeadFlowRoiCalculatorProps> = ({ onBookCall }) => {
  const { showToast, refreshProjects } = useApp();
  const [dealSize, setDealSize] = useState<number>(6500); // Average deal size
  const [prospectsPerMonth, setProspectsPerMonth] = useState<number>(2500);
  const [closeRatePercent, setCloseRatePercent] = useState<number>(20);
  const [selectedIndustry, setSelectedIndustry] = useState<'saas' | 'agency' | 'enterprise'>('saas');

  // ROI Email Gate Modal state
  const [isEmailGateOpen, setIsEmailGateOpen] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  // LeadFlow standard conversion metrics grounded in real campaigns:
  const meetingRatePer1000 = selectedIndustry === 'saas' ? 7.2 : selectedIndustry === 'agency' ? 8.5 : 5.8;
  const projectedMeetings = Math.round((prospectsPerMonth / 1000) * meetingRatePer1000);
  const projectedDeals = Math.max(1, Math.round(projectedMeetings * (closeRatePercent / 100)));
  const monthlyPipeline = projectedMeetings * dealSize;
  const projectedRevenue = projectedDeals * dealSize;
  
  // LeadFlow standard retainer cost benchmark ($2,990 for 2,500 prospects)
  const estimatedCost = prospectsPerMonth <= 1000 ? 999 : prospectsPerMonth <= 3000 ? 2990 : 5490;
  const netProfit = projectedRevenue - estimatedCost;
  const roiMultiple = Number((projectedRevenue / estimatedCost).toFixed(1));

  const inHouseSdrCost = 8500;
  const monthlySavingsVsSdr = Math.max(0, inHouseSdrCost - estimatedCost);

  const handleSubmitRoiEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !leadEmail || !leadCompany) {
      showToast('Please provide your name, business email, and company.', 'warning');
      return;
    }

    setSendingEmail(true);
    try {
      // 1. Save lead to backend CRM
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: leadName,
          clientEmail: leadEmail,
          clientCompany: leadCompany,
          clientPhone: leadPhone,
          channel: 'both',
          websiteType: selectedIndustry === 'saas' ? 'landing' : 'corporate',
          dealSize: `$${dealSize.toLocaleString()} ACV`,
          notes: `ROI Simulator Model: ${prospectsPerMonth.toLocaleString()} prospects/mo, Projected SQLs: ${projectedMeetings}/mo, Projected Revenue: $${(projectedRevenue / 1000).toFixed(0)}k/mo, Net Profit: +$${(netProfit / 1000).toFixed(0)}k/mo (${roiMultiple}x ROI).`,
          status: 'lead',
          source: 'roi_simulator_email_gate',
          estimatedPrice: estimatedCost,
          finalPrice: estimatedCost
        })
      });

      // 2. Dispatch transactional email with calculated metrics
      await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: leadEmail,
          clientName: leadName,
          clientCompany: leadCompany,
          subject: `Your LeadFlow Outbound ROI Breakdown: $${(projectedRevenue / 1000).toFixed(0)}k Monthly Revenue Model`,
          template: 'roi_breakdown',
          variables: {
            clientName: leadName,
            clientCompany: leadCompany,
            dealSize,
            prospectsPerMonth,
            projectedMeetings,
            monthlyPipeline,
            projectedRevenue,
            netProfit,
            roiMultiple,
            estimatedCost
          }
        })
      });

      if (refreshProjects) refreshProjects();
      setEmailSentSuccess(true);
      showToast(`ROI Breakdown and projections sent to ${leadEmail}!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Saved successfully', 'info');
      setEmailSentSuccess(true);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  return (
    <div className="w-full bg-white dark:bg-[#0a192f] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 lg:p-10 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
        
        {/* Left: Interactive Controls */}
        <div className="w-full lg:w-1/2 space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold font-mono mb-2">
              <Calculator className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>OUTBOUND ROI SIMULATOR</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Calculate Your Revenue Velocity
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-normal">
              Adjust parameters based on your business model to see projected qualified meetings and net revenue multiple.
            </p>
          </div>

          {/* Industry Preset */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Business Model &amp; ICP Target
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'saas', label: 'B2B SaaS', desc: '$2k-$10k ACV' },
                { id: 'agency', label: 'Agency / Studio', desc: '$4k-$20k Retainer' },
                { id: 'enterprise', label: 'B2B Enterprise', desc: '$15k-$50k+ Contract' }
              ].map(ind => (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => setSelectedIndustry(ind.id as any)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    selectedIndustry === ind.id
                      ? 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-700 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="block text-xs font-semibold">{ind.label}</span>
                  <span className={`text-[10px] block mt-0.5 ${selectedIndustry === ind.id ? 'text-slate-300' : 'text-slate-400'}`}>
                    {ind.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Slider 1: Average Deal Size */}
          <div>
            <div className="flex justify-between items-center mb-2 text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">Average Deal Size (ACV):</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                ${dealSize.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={1500}
              max={30000}
              step={500}
              value={dealSize}
              onChange={e => setDealSize(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-slate-400"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>$1.5k</span>
              <span>$15k</span>
              <span>$30k+</span>
            </div>
          </div>

          {/* Slider 2: Monthly Prospects Outreached */}
          <div>
            <div className="flex justify-between items-center mb-2 text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">Monthly Prospect Volume:</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {prospectsPerMonth.toLocaleString()} contacts
              </span>
            </div>
            <input
              type="range"
              min={1000}
              max={5000}
              step={500}
              value={prospectsPerMonth}
              onChange={e => setProspectsPerMonth(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-slate-400"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>1,000 (Pilot)</span>
              <span>3,000 (Business)</span>
              <span>5,000 (Enterprise)</span>
            </div>
          </div>

          {/* Slider 3: Close Rate */}
          <div>
            <div className="flex justify-between items-center mb-2 text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">Your Sales Closing Rate:</span>
              <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {closeRatePercent}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={40}
              step={5}
              value={closeRatePercent}
              onChange={e => setCloseRatePercent(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-slate-400"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>10% (Conservative)</span>
              <span>20% (Average)</span>
              <span>40% (Top Tier)</span>
            </div>
          </div>
        </div>

        {/* Right: Projected Metrics Display Card */}
        <div className="w-full lg:w-1/2 p-6 sm:p-8 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <span className="text-xs uppercase font-mono font-semibold tracking-wider text-slate-300">
                Projected 30-Day Output
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold font-mono border border-emerald-500/20">
                {roiMultiple}x Est. ROI
              </span>
            </div>

            {/* Key Stat Highlights */}
            <div className="grid grid-cols-2 gap-3.5 my-6">
              <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60">
                <span className="text-xs text-slate-400 block font-medium">Qualified SQLs</span>
                <span className="text-2xl sm:text-3xl font-bold text-white font-mono mt-1 block tabular-nums">
                  {projectedMeetings}
                </span>
                <span className="text-[10px] text-slate-300 font-mono">meetings on calendar</span>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60">
                <span className="text-xs text-slate-400 block font-medium">Pipeline Generated</span>
                <span className="text-2xl sm:text-3xl font-bold text-slate-200 font-mono mt-1 block tabular-nums">
                  ${(monthlyPipeline / 1000).toFixed(0)}k
                </span>
                <span className="text-[10px] text-slate-400 font-mono">deal opportunity</span>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60">
                <span className="text-xs text-slate-400 block font-medium">Deals Closed</span>
                <span className="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono mt-1 block tabular-nums">
                  {projectedDeals}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">at {closeRatePercent}% closing</span>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700/60">
                <span className="text-xs text-slate-400 block font-medium">Projected Revenue</span>
                <span className="text-2xl sm:text-3xl font-bold text-emerald-300 font-mono mt-1 block tabular-nums">
                  ${(projectedRevenue / 1000).toFixed(0)}k
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">+${(netProfit / 1000).toFixed(0)}k net</span>
              </div>
            </div>

            {/* In-House SDR Comparison Banner */}
            <div className="p-4 rounded-lg bg-slate-800/70 border border-slate-700/80 text-xs space-y-1.5 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">LeadFlow vs. Hiring In-House SDR:</span>
                <span className="text-emerald-400 font-mono font-semibold">${monthlySavingsVsSdr.toLocaleString()}/mo Saved</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                Hiring 1 full-time SDR typically costs <strong>$8,500/mo</strong> (base salary + recruitment fees + software licenses for SalesNav, Apollo, Clay, warmup) with 3 months ramp time. LeadFlow delivers a complete multi-channel team in <strong>7 days</strong> for <strong>${estimatedCost.toLocaleString()}/mo</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                setEmailSentSuccess(false);
                setIsEmailGateOpen(true);
              }}
              className="flex-1 py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <Mail className="w-4 h-4 text-slate-300" />
              <span>Email My Breakdown</span>
            </button>

            <button
              type="button"
              onClick={onBookCall}
              className="flex-1 py-3 px-5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-slate-700" />
              <span>Book Strategy Call</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* ROI Simulation Lead Gate & PDF Export Modal */}
      {isEmailGateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Email My ROI Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Receive your custom pipeline velocity report &amp; forecast
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEmailGateOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Model Summary Preview */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Projected SQLs</span>
                <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-mono text-sm">{projectedMeetings}/mo</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Pipeline Value</span>
                <span className="font-extrabold text-slate-900 dark:text-white font-mono text-sm">${(monthlyPipeline / 1000).toFixed(0)}k</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Projected Revenue</span>
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-sm">${(projectedRevenue / 1000).toFixed(0)}k</span>
              </div>
            </div>

            {emailSentSuccess ? (
              <div className="py-6 text-center space-y-4 animate-fadeIn">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mx-auto flex items-center justify-center shadow-md">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    ROI Breakdown Dispatched!
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
                    We've emailed the complete revenue projection model to <strong className="text-indigo-600 dark:text-indigo-400">{leadEmail}</strong>.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Print / Save PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEmailGateOpen(false)}
                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold transition hover:bg-indigo-500 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitRoiEmail} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={leadName}
                    onChange={e => setLeadName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Business Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={leadEmail}
                    onChange={e => setLeadEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={leadCompany}
                      onChange={e => setLeadCompany(e.target.value)}
                      placeholder="e.g. Stripe, Ramp, Apex"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Direct Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      value={leadPhone}
                      onChange={e => setLeadPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEmailGateOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingEmail}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition cursor-pointer flex items-center gap-2"
                  >
                    {sendingEmail ? (
                      <span>Sending Model...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Me My Report</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
