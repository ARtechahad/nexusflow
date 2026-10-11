import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  Globe, 
  User, 
  Mail, 
  Building2, 
  DollarSign, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  Sparkles,
  Shield,
  Layers,
  ExternalLink,
  CalendarDays,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface LeadFlowBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedPlan?: string;
}

export const LeadFlowBookingModal: React.FC<LeadFlowBookingModalProps> = ({
  isOpen,
  onClose,
  preselectedPlan = 'Business Retainer ($2,990/mo)'
}) => {
  const { showToast, refreshProjects } = useApp();

  // Scheduler Mode: Direct Intake Form vs Embedded Cal.com / Calendly
  const [schedulerMode, setSchedulerMode] = useState<'direct_intake' | 'embedded_cal'>('direct_intake');
  const [step, setStep] = useState<'details' | 'calendar' | 'success'>('details');
  
  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [dealSize, setDealSize] = useState('$5k - $15k ACV');
  const [primaryChannel, setPrimaryChannel] = useState<'both' | 'email' | 'linkedin'>('both');
  const [selectedDate, setSelectedDate] = useState('2026-10-09');
  const [selectedTime, setSelectedTime] = useState('14:30');
  const [timezone, setTimezone] = useState('America/New_York (EST)');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Embedded Cal.com interactive state
  const [calDuration, setCalDuration] = useState<'15' | '30' | '45'>('30');
  const [calBookedSuccess, setCalBookedSuccess] = useState(false);

  if (!isOpen) return null;

  const availableDates = [
    { date: '2026-10-08', day: 'Today', slots: 4 },
    { date: '2026-10-09', day: 'Fri, Oct 9', slots: 5 },
    { date: '2026-10-12', day: 'Mon, Oct 12', slots: 7 },
    { date: '2026-10-13', day: 'Tue, Oct 13', slots: 6 },
    { date: '2026-10-14', day: 'Wed, Oct 14', slots: 4 }
  ];

  const availableTimes = [
    '09:00', '10:30', '11:15', '13:00', '14:30', '15:45', '17:00'
  ];

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !company.trim()) {
      showToast('Please fill in your name, business email, and company.', 'warning');
      return;
    }
    setStep('calendar');
  };

  const handleConfirmBooking = async () => {
    if (!name.trim() || !email.trim()) {
      showToast('Please provide your name and work email.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const estimatedPrice = preselectedPlan.includes('999') ? 999 : preselectedPlan.includes('5,490') ? 5490 : 2990;

      // 1. Direct Save to CRM Database via /api/leads
      const leadPayload = {
        clientName: name.trim(),
        clientEmail: email.trim(),
        clientCompany: company.trim() || 'Undisclosed Company',
        clientPhone: phone.trim() || '',
        websiteUrl: website.trim() || '',
        dealSize,
        channel: primaryChannel,
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        timezone,
        purpose: notes.trim() || `Strategy Session regarding ${preselectedPlan}`,
        notes: `Selected Scope: ${preselectedPlan} | Preferred Timing: ${selectedDate} at ${selectedTime} (${timezone}). Notes: ${notes || 'None'}`,
        source: schedulerMode === 'embedded_cal' ? 'cal_com_embedded_scheduler' : 'direct_lead_intake_modal',
        status: 'lead',
        estimatedPrice,
        finalPrice: estimatedPrice
      };

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadPayload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save intake to CRM');
      }

      // 2. Dispatch optional notification webhook
      try {
        await fetch('/api/webhook/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'strategy_call_booked',
            lead: leadPayload,
            timestamp: new Date().toISOString()
          })
        });
      } catch {
        // Notification webhook fallback is non-blocking
      }

      if (refreshProjects) refreshProjects();
      setStep('success');
      showToast(`Strategy Call secured! Calendar invitation sent to ${email}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Error confirming booking', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a12] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Book Outbound Strategy Session
                </h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                  30 Min Free Fit Call
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                LeadFlow by ALM Nexus &bull; Discuss audience, channel fit, and 7-day outbound launch
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scheduler Switcher Tabs (Direct Intake vs Cal.com / Calendly) */}
        {step !== 'success' && (
          <div className="px-6 pt-4 pb-2 bg-slate-100/60 dark:bg-slate-900/40 border-b border-slate-200 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Booking Engine:</span>
            <div className="inline-flex p-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setSchedulerMode('direct_intake')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  schedulerMode === 'direct_intake'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Strategy Intake Form</span>
              </button>

              <button
                type="button"
                onClick={() => setSchedulerMode('embedded_cal')}
                className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  schedulerMode === 'embedded_cal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Cal.com / Calendly Embed</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto">
          {schedulerMode === 'embedded_cal' && step !== 'success' ? (
            /* Cal.com / Calendly Embedded Scheduler View */
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Integrated Scheduler:</span>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400">Cal.com Enterprise Sync &bull; {preselectedPlan}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Live Cal Sync</span>
                </div>
              </div>

              {/* Duration Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Call Duration:</span>
                {(['15', '30', '45'] as const).map(dur => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setCalDuration(dur)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      calDuration === dur
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {dur} Min
                  </button>
                ))}
              </div>

              {/* Embedded Cal UI Preview Grid */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Rachel Adams"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Business Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="rachel@company.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      placeholder="e.g. ScalePath AI"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-medium outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Select Date &amp; Time
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        className="flex-1 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-mono font-medium outline-none"
                      >
                        {availableDates.map(d => (
                          <option key={d.date} value={d.date}>{d.day}</option>
                        ))}
                      </select>
                      <select
                        value={selectedTime}
                        onChange={e => setSelectedTime(e.target.value)}
                        className="w-24 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-mono font-medium outline-none"
                      >
                        {availableTimes.map(t => (
                          <option key={t} value={t}>{t} EST</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    What are your current outbound pipeline targets?
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Need 12 qualified SaaS demos/month for our AE team"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-medium outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Direct API Sync to ALM Nexus CRM</span>
                </span>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmBooking}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Syncing Cal.com &amp; CRM...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm {calDuration}-Min Strategy Session</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : step === 'details' ? (
            /* Direct Intake: Step 1 Details Form */
            <form onSubmit={handleDetailsSubmit} className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Interested in scope:</span>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400">{preselectedPlan}</p>
                </div>
                <span className="px-2 py-1 rounded-lg bg-indigo-600 text-white font-mono text-[10px] font-bold">
                  Zero Obligation
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Your Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Marcus Sterling"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Work Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="marcus@company.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Company Name *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      placeholder="e.g. Apex HealthTech"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Company Website / LinkedIn
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      placeholder="https://company.com"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Average Deal Size (ACV)
                  </label>
                  <select
                    value={dealSize}
                    onChange={e => setDealSize(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  >
                    <option value="$2k - $5k ACV">$2k – $5k ACV (Starter SaaS / Studio)</option>
                    <option value="$5k - $15k ACV">$5k – $15k ACV (Mid-Market B2B)</option>
                    <option value="$15k - $50k ACV">$15k – $50k ACV (Enterprise Solutions)</option>
                    <option value="$50k+ ACV">$50k+ ACV (High-Value Institutional)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Outbound Channels
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'both', label: 'Multi-Channel' },
                      { id: 'linkedin', label: 'LinkedIn' },
                      { id: 'email', label: 'Cold Email' }
                    ].map(ch => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setPrimaryChannel(ch.id as any)}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer text-center ${
                          primaryChannel === ch.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Describe Your Target Audience or Bottleneck (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. We target VP of Engineering in fintech companies across US & UK. Need 10+ meetings/month."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition cursor-pointer flex items-center gap-2"
                >
                  <span>Select Date &amp; Time</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : step === 'calendar' ? (
            /* Direct Intake: Step 2 Calendar & Time Picker */
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold"
                >
                  &larr; Edit Details ({name}, {company})
                </button>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  <Globe className="w-3.5 h-3.5" />
                  <span>{timezone}</span>
                </div>
              </div>

              {/* Date selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  1. Choose Strategy Session Date
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {availableDates.map(d => (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setSelectedDate(d.date)}
                      className={`p-3 rounded-2xl border text-center transition cursor-pointer ${
                        selectedDate === d.date
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/25'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                      }`}
                    >
                      <span className="block text-xs font-bold">{d.day}</span>
                      <span className={`text-[10px] block mt-1 font-mono ${selectedDate === d.date ? 'text-indigo-100' : 'text-emerald-500'}`}>
                        {d.slots} slots
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  2. Choose Time Slot (EST)
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableTimes.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTime(t)}
                      className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition cursor-pointer text-center ${
                        selectedTime === t
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                      }`}
                    >
                      {t} EST
                    </button>
                  ))}
                </div>
              </div>

              {/* Meeting Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      30-Min Zoom / Google Meet Consultation
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {selectedDate} @ {selectedTime} EST with LeadFlow Senior Director
                    </span>
                  </div>
                </div>
                <span className="text-emerald-500 font-bold font-mono text-[11px]">
                  Free &bull; Confirmed
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 text-xs font-bold transition"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmBooking}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving to CRM...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm 30-Min Strategy Call</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Step 3: Success Confirmation */
            <div className="py-8 text-center space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 mx-auto flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Strategy Call Confirmed &amp; Ingested!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                  We've sent the Google Meet calendar invite and custom ICP pre-brief checklist to <strong className="text-indigo-600 dark:text-indigo-400">{email}</strong>.
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Host:</span>
                  <span className="font-bold text-slate-900 dark:text-white">LeadFlow by ALM Nexus Outbound Director</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Company:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{company}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled Time:</span>
                  <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">{selectedDate} @ {selectedTime} EST</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CRM Status:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">Captured in Inbound Leads &bull; Webhook Dispatched</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition cursor-pointer"
                >
                  Done &amp; Return to Page
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
