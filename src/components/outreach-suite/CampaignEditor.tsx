import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Code,
  Eye,
  FileText,
  Mail,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
  AlertTriangle
} from 'lucide-react';
import {
  CampaignStep,
  createCampaign,
  updateCampaignSteps,
  enrollProspects,
  sendCampaignTestEmail,
  Mailbox
} from '../../services/outreachService';

interface CampaignEditorProps {
  mailboxes: Mailbox[];
  onClose: () => void;
  onSuccess: (campaignId: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CampaignEditor: React.FC<CampaignEditorProps> = ({
  mailboxes,
  onClose,
  onSuccess,
  showToast
}) => {
  const [stepIndex, setStepIndex] = useState<number>(1);
  const [saving, setSaving] = useState<boolean>(false);

  // Step 1: Settings
  const [name, setName] = useState<string>('');
  const [selectedMailboxIds, setSelectedMailboxIds] = useState<string[]>([]);
  const [dailyLimit, setDailyLimit] = useState<number>(50);
  const [timezone, setTimezone] = useState<string>('UTC');
  const [windowStart, setWindowStart] = useState<string>('09:00');
  const [windowEnd, setWindowEnd] = useState<string>('17:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [stopOnReply, setStopOnReply] = useState<boolean>(true);
  const [trackOpens, setTrackOpens] = useState<boolean>(true);
  const [trackClicks, setTrackClicks] = useState<boolean>(true);
  const [postalAddress, setPostalAddress] = useState<string>('LeadFlow Global HQ, 100 Montgomery St, Suite 1500, San Francisco, CA 94104');

  // Step 2: Sequence
  const [steps, setSteps] = useState<CampaignStep[]>([
    {
      step_number: 1,
      delay_days: 0,
      delay_hours: 0,
      variants: [
        {
          variant_label: 'A',
          subject: '{Quick question|Hello} {{first_name|there}}',
          body_html: '<p>Hi {{first_name|there}},</p><p>{I noticed your team at {{company|your company}}|Saw your work in the industry} and wanted to reach out regarding outbound efficiency.</p><p>Would you have 10 minutes this week for a brief conversation?</p><p>Best regards,<br>{{sender_name}}</p>',
          weight: 100
        }
      ]
    }
  ]);
  const [activeStepTab, setActiveStepTab] = useState<number>(0);
  const [previewProspect, setPreviewProspect] = useState({
    first_name: 'Alex',
    last_name: 'Morgan',
    company: 'Nexus Tech',
    title: 'Head of Growth'
  });

  // Step 3: Prospects
  const [csvText, setCsvText] = useState<string>(
    'alex.morgan@example.com,Alex,Morgan,Nexus Tech,Head of Growth\nsam.taylor@example.com,Sam,Taylor,Acme Corp,VP Sales'
  );

  // Step 4: Test send
  const [testEmail, setTestEmail] = useState<string>('');
  const [testMailboxId, setTestMailboxId] = useState<string>(mailboxes[0]?.id || '');
  const [testingSend, setTestingSend] = useState<boolean>(false);

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const toggleMailbox = (mId: string) => {
    if (selectedMailboxIds.includes(mId)) {
      setSelectedMailboxIds(selectedMailboxIds.filter((id) => id !== mId));
    } else {
      setSelectedMailboxIds([...selectedMailboxIds, mId]);
    }
  };

  const addStep = () => {
    const nextNumber = steps.length + 1;
    setSteps([
      ...steps,
      {
        step_number: nextNumber,
        delay_days: 2,
        delay_hours: 0,
        variants: [
          {
            variant_label: 'A',
            subject: 'Following up on my note {{first_name|there}}',
            body_html: '<p>Hi {{first_name|there}},</p><p>Wanted to make sure my previous message didn\'t get lost in your inbox.</p><p>Best,<br>{{sender_name}}</p>',
            weight: 100
          }
        ]
      }
    ]);
    setActiveStepTab(steps.length);
  };

  const removeStep = (indexToRemove: number) => {
    if (steps.length <= 1) return;
    const filtered = steps.filter((_, i) => i !== indexToRemove);
    const renumbered = filtered.map((s, idx) => ({ ...s, step_number: idx + 1 }));
    setSteps(renumbered);
    setActiveStepTab(Math.max(0, indexToRemove - 1));
  };

  const insertTag = (tag: string) => {
    const currentStep = steps[activeStepTab];
    if (!currentStep) return;
    const currentVariant = currentStep.variants[0];
    const updatedHtml = (currentVariant.body_html || '') + ` {{${tag}}}`;
    updateCurrentVariantBody(updatedHtml);
  };

  const insertSpintax = () => {
    const currentStep = steps[activeStepTab];
    if (!currentStep) return;
    const currentVariant = currentStep.variants[0];
    const updatedHtml = (currentVariant.body_html || '') + ' {Hi|Hello|Hey}';
    updateCurrentVariantBody(updatedHtml);
  };

  const updateCurrentVariantSubject = (val: string) => {
    setSteps((prev) => {
      const copy = [...prev];
      if (copy[activeStepTab]?.variants[0]) {
        copy[activeStepTab].variants[0].subject = val;
      }
      return copy;
    });
  };

  const updateCurrentVariantBody = (val: string) => {
    setSteps((prev) => {
      const copy = [...prev];
      if (copy[activeStepTab]?.variants[0]) {
        copy[activeStepTab].variants[0].body_html = val;
      }
      return copy;
    });
  };

  const updateCurrentStepDelay = (days: number, hours: number) => {
    setSteps((prev) => {
      const copy = [...prev];
      if (copy[activeStepTab]) {
        copy[activeStepTab].delay_days = days;
        copy[activeStepTab].delay_hours = hours;
      }
      return copy;
    });
  };

  // Live preview generator
  const getRenderedPreview = () => {
    const currentStep = steps[activeStepTab];
    if (!currentStep || !currentStep.variants[0]) return { subject: '', body: '' };

    let s = currentStep.variants[0].subject;
    let b = currentStep.variants[0].body_html || '';

    // Simple preview regex substitution
    s = s.replace(/\{\{first_name(?:\|[^}]+)?\}\}/g, previewProspect.first_name);
    s = s.replace(/\{\{last_name(?:\|[^}]+)?\}\}/g, previewProspect.last_name);
    s = s.replace(/\{\{company(?:\|[^}]+)?\}\}/g, previewProspect.company);
    s = s.replace(/\{\{title(?:\|[^}]+)?\}\}/g, previewProspect.title);
    s = s.replace(/\{([^|{}]+)\|[^}]+\}/g, '$1');

    b = b.replace(/\{\{first_name(?:\|[^}]+)?\}\}/g, previewProspect.first_name);
    b = b.replace(/\{\{last_name(?:\|[^}]+)?\}\}/g, previewProspect.last_name);
    b = b.replace(/\{\{company(?:\|[^}]+)?\}\}/g, previewProspect.company);
    b = b.replace(/\{\{title(?:\|[^}]+)?\}\}/g, previewProspect.title);
    b = b.replace(/\{\{sender_name\}\}/g, 'Sarah Jenkins');
    b = b.replace(/\{([^|{}]+)\|[^}]+\}/g, '$1');

    return { subject: s, body: b };
  };

  // Complete Campaign Creation Pipeline
  const handleCreateAndLaunch = async () => {
    if (!name.trim()) {
      showToast('Please enter a campaign name', 'error');
      setStepIndex(1);
      return;
    }
    if (selectedMailboxIds.length === 0) {
      showToast('Please select at least one sending mailbox', 'error');
      setStepIndex(1);
      return;
    }
    if (!postalAddress.trim()) {
      showToast('Sender postal address is required for CAN-SPAM compliance', 'error');
      setStepIndex(1);
      return;
    }

    try {
      setSaving(true);

      // 1. Create Campaign
      const camp = await createCampaign({
        name,
        daily_limit: dailyLimit,
        postal_address: postalAddress,
        schedule: {
          timezone,
          windows: [
            {
              start: windowStart,
              end: windowEnd,
              days: selectedDays
            }
          ]
        },
        tracking_settings: {
          track_opens: trackOpens,
          track_clicks: trackClicks
        },
        stop_on_reply: stopOnReply,
        mailboxIds: selectedMailboxIds
      });

      // 2. Save Sequence Steps
      await updateCampaignSteps(camp.id, steps);

      // 3. Enroll Prospects from CSV
      const rows = csvText
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(',').map((p) => p.trim());
          return {
            email: parts[0],
            first_name: parts[1] || '',
            last_name: parts[2] || '',
            company: parts[3] || '',
            title: parts[4] || ''
          };
        })
        .filter((r) => r.email && r.email.includes('@'));

      if (rows.length > 0) {
        await enrollProspects(camp.id, { csvRows: rows });
      }

      showToast(`Campaign "${name}" created with ${steps.length} steps and ${rows.length} enrolled prospects!`, 'success');
      onSuccess(camp.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to create campaign', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      showToast('Please provide a valid test recipient email', 'error');
      return;
    }
    if (!testMailboxId) {
      showToast('Please pick a mailbox for test delivery', 'error');
      return;
    }

    try {
      setTestingSend(true);
      // Create temporary campaign or trigger directly
      const camp = await createCampaign({
        name: `[Test] ${name || 'Draft Sequence'}`,
        daily_limit: 10,
        postal_address: postalAddress,
        mailboxIds: [testMailboxId]
      });
      await updateCampaignSteps(camp.id, steps);

      const msg = await sendCampaignTestEmail(camp.id, {
        recipientEmail: testEmail,
        stepIndex: activeStepTab,
        mailboxId: testMailboxId
      });

      showToast(msg, 'success');
    } catch (err: any) {
      showToast(`Test send failed: ${err.message}`, 'error');
    } finally {
      setTestingSend(false);
    }
  };

  const activeStep = steps[activeStepTab] || steps[0];
  const activeVariant = activeStep?.variants[0] || { subject: '', body_html: '' };
  const preview = getRenderedPreview();
  const wordCount = (activeVariant.body_html || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const charCount = (activeVariant.body_html || '').replace(/<[^>]+>/g, '').length;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {name ? name : 'New Multi-Step Outreach Campaign'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Step {stepIndex} of 4 • {stepIndex === 1 && 'Campaign Settings & Mailbox Allocation'}
              {stepIndex === 2 && 'Sequence Designer & Spintax Live Preview'}
              {stepIndex === 3 && 'Prospect List & Attribute Mapping'}
              {stepIndex === 4 && 'Launch Readiness & Compliance Checklist'}
            </p>
          </div>
        </div>

        {/* Wizard Progress Pills */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map((idx) => (
            <button
              key={idx}
              onClick={() => setStepIndex(idx)}
              className={`w-8 h-8 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                stepIndex === idx
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : idx < stepIndex
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {idx < stepIndex ? <Check className="w-3.5 h-3.5" /> : idx}
            </button>
          ))}
        </div>
      </div>

      {/* STEP 1: SETTINGS */}
      {stepIndex === 1 && (
        <div className="p-6 space-y-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Campaign Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 VP Sales Cold Outreach - SaaS Founders"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Daily Send Limit (across all mailboxes)
              </label>
              <input
                type="number"
                min="1"
                max="5000"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(parseInt(e.target.value || '1', 10))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Mailbox Multi-select */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Sending Mailboxes ({selectedMailboxIds.length} chosen) *
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Sends will rotate evenly across selected mailboxes respecting each mailbox's daily cap.
            </p>
            {mailboxes.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-700 dark:text-amber-300">
                No mailboxes connected yet. Please connect an SMTP/IMAP mailbox in the Mailboxes tab first.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                {mailboxes.map((mbx) => {
                  const isChecked = selectedMailboxIds.includes(mbx.id);
                  return (
                    <div
                      key={mbx.id}
                      onClick={() => toggleMailbox(mbx.id)}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                        isChecked
                          ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{mbx.email}</p>
                          <p className="text-[10px] text-slate-500">{mbx.sender_name} • Cap: {mbx.daily_cap}/day</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {mbx.provider}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Schedule Windows & Weekdays */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Delivery Schedule Window
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Window Start</label>
                <input
                  type="time"
                  value={windowStart}
                  onChange={(e) => setWindowStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">Window End</label>
                <input
                  type="time"
                  value={windowEnd}
                  onChange={(e) => setWindowEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-2">Sending Weekdays</label>
              <div className="flex gap-2">
                {[
                  { d: 1, label: 'Mon' },
                  { d: 2, label: 'Tue' },
                  { d: 3, label: 'Wed' },
                  { d: 4, label: 'Thu' },
                  { d: 5, label: 'Fri' },
                  { d: 6, label: 'Sat' },
                  { d: 0, label: 'Sun' }
                ].map(({ d, label }) => {
                  const active = selectedDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CAN-SPAM Sender Postal Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Sender Physical Postal Address (Required by CAN-SPAM) *
            </label>
            <input
              type="text"
              value={postalAddress}
              onChange={(e) => setPostalAddress(e.target.value)}
              placeholder="e.g. 100 Montgomery St, Suite 1500, San Francisco, CA 94104"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Appended to email unsubscribe footer alongside RFC one-click headers. Campaign launch is blocked if empty.
            </p>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={stopOnReply}
                onChange={(e) => setStopOnReply(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Stop sequence on reply</span>
            </label>

            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={trackOpens}
                onChange={(e) => setTrackOpens(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Track email opens</span>
            </label>

            <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={trackClicks}
                onChange={(e) => setTrackClicks(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">Track link clicks</span>
            </label>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStepIndex(2)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
            >
              Continue to Sequence Designer →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SEQUENCE DESIGNER */}
      {stepIndex === 2 && (
        <div className="p-6 space-y-6">
          {/* Step Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
            {steps.map((st, sIdx) => (
              <div
                key={sIdx}
                onClick={() => setActiveStepTab(sIdx)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                  activeStepTab === sIdx
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>Step {st.step_number}</span>
                {sIdx > 0 && (
                  <span className="text-[10px] opacity-75">
                    (+{st.delay_days}d {st.delay_hours}h)
                  </span>
                )}
                {steps.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStep(sIdx);
                    }}
                    className="hover:text-rose-300 ml-1"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addStep}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Follow-Up Step
            </button>
          </div>

          {/* Delay Settings for current step if > 1 */}
          {activeStepTab > 0 && (
            <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Wait before sending:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={activeStep.delay_days}
                  onChange={(e) => updateCurrentStepDelay(parseInt(e.target.value || '0', 10), activeStep.delay_hours)}
                  className="w-16 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
                <span className="text-slate-500">days</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={activeStep.delay_hours}
                  onChange={(e) => updateCurrentStepDelay(activeStep.delay_days, parseInt(e.target.value || '0', 10))}
                  className="w-16 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
                <span className="text-slate-500">hours</span>
              </div>
            </div>
          )}

          {/* Two-Column Editor & Live Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Editor */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject Line *
                </label>
                <input
                  type="text"
                  value={activeVariant.subject}
                  onChange={(e) => updateCurrentVariantSubject(e.target.value)}
                  placeholder="{Quick question|Hello} {{first_name|there}}"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Helper Insert Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-slate-500">Insert tag:</span>
                {['first_name|there', 'company|your company', 'title', 'sender_name'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    {`{{${tag}}}`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={insertSpintax}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  + Spintax
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email Body (HTML / Spintax) *
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {wordCount} words • {charCount} chars
                  </span>
                </div>
                <textarea
                  rows={10}
                  value={activeVariant.body_html}
                  onChange={(e) => updateCurrentVariantBody(e.target.value)}
                  placeholder="<p>Hi {{first_name|there}},</p>..."
                  className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Eye className="w-4 h-4 text-indigo-500" />
                  Live Deterministic Preview
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Prospect:</span>
                  <input
                    type="text"
                    value={previewProspect.first_name}
                    onChange={(e) => setPreviewProspect({ ...previewProspect, first_name: e.target.value })}
                    className="w-20 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>

              {/* Rendered Email Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="border-b border-slate-200 dark:border-slate-700 pb-3">
                  <p className="text-[11px] text-slate-500 font-medium">Subject:</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">
                    {preview.subject || '(Subject line preview)'}
                  </p>
                </div>

                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-xs text-slate-700 dark:text-slate-300 min-h-[160px]"
                  dangerouslySetInnerHTML={{ __html: preview.body || '<p>(Email body preview)</p>' }}
                />

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 space-y-1">
                  <p>{postalAddress}</p>
                  <p>Unsubscribe link included automatically.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStepIndex(1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← Back to Settings
            </button>
            <button
              onClick={() => setStepIndex(3)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
            >
              Continue to Prospects →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PROSPECTS CSV ENROLLMENT */}
      {stepIndex === 3 && (
        <div className="p-6 space-y-6 max-w-4xl">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              Add Prospects to Sequence
            </h3>
            <p className="text-xs text-slate-500">
              Paste CSV rows below. Header format: <code>email,first_name,last_name,company,title</code>.
              Suppressed contacts are automatically skipped.
            </p>
          </div>

          <textarea
            rows={8}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStepIndex(2)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← Back to Sequence
            </button>
            <button
              onClick={() => setStepIndex(4)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
            >
              Continue to Review & Launch →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & LAUNCH CHECKLIST */}
      {stepIndex === 4 && (
        <div className="p-6 space-y-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pre-Flight Checklist */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Pre-Flight Launch Checklist
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className={`w-4 h-4 ${name ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span>Campaign Name: <strong>{name || 'Missing'}</strong></span>
                </div>

                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className={`w-4 h-4 ${selectedMailboxIds.length > 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
                  <span>Assigned Mailboxes: <strong>{selectedMailboxIds.length} connected</strong></span>
                </div>

                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className={`w-4 h-4 ${steps.length > 0 ? 'text-emerald-500' : 'text-rose-500'}`} />
                  <span>Sequence Steps: <strong>{steps.length} steps configured</strong></span>
                </div>

                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className={`w-4 h-4 ${postalAddress ? 'text-emerald-500' : 'text-rose-500'}`} />
                  <span>CAN-SPAM Address: <strong>{postalAddress ? 'Configured' : 'Missing (Blocks Launch)'}</strong></span>
                </div>

                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Cap Guard Gate: <strong>Atomic Daily & Domain Throttling Active</strong></span>
                </div>
              </div>
            </div>

            {/* Test Send Dispatcher */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-indigo-500" />
                Live Single Test Send
              </h4>
              <p className="text-xs text-slate-500">
                Dispatches Step 1 rendered email directly through the Cap Guard and SMTP transporter to your inbox.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Recipient Test Address
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="elon57564@gmail.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  From Mailbox
                </label>
                <select
                  value={testMailboxId}
                  onChange={(e) => setTestMailboxId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                >
                  {mailboxes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.email} ({m.provider})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleTestSend}
                disabled={testingSend}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                {testingSend ? 'Sending Test...' : 'Send Live Test Email'}
              </button>
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setStepIndex(3)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← Back to Prospects
            </button>
            <button
              onClick={handleCreateAndLaunch}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Creating & Launching...' : 'Save & Launch Campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
