import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Linkedin, 
  Mail, 
  Phone, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Layers,
  Share2,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface CampaignSequenceStep {
  stepNumber: number;
  day: string;
  channel: 'email' | 'linkedin' | 'phone';
  title: string;
  subject?: string;
  content: string;
  proTip?: string;
}

export interface CampaignTemplate {
  badge: string;
  headline: string;
  icp: string;
  sqlsMetric: string;
  sqlsSubtitle: string;
  results: Array<{ label: string; val: string }>;
  steps: CampaignSequenceStep[];
  quote?: string;
}

interface InteractiveCampaignDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignTemplate | null;
  onDeployCampaign?: (campaignName: string) => void;
}

export const InteractiveCampaignDrawer: React.FC<InteractiveCampaignDrawerProps> = ({
  isOpen,
  onClose,
  campaign,
  onDeployCampaign
}) => {
  const { showToast } = useApp();
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedStepIndex, setCopiedStepIndex] = useState<number | null>(null);

  if (!isOpen || !campaign) return null;

  const handleCopyAll = async () => {
    try {
      const fullSequenceText = [
        `=====================================================`,
        `CAMPAIGN PLAYBOOK: ${campaign.badge}`,
        `TARGET ICP: ${campaign.icp}`,
        `BENCHMARK RESULTS: ${campaign.sqlsMetric} | ${campaign.results.map(r => `${r.label}: ${r.val}`).join(' | ')}`,
        `=====================================================\n`,
        ...campaign.steps.map(s => {
          return [
            `--- STEP ${s.stepNumber} (${s.day}) [${s.channel.toUpperCase()}] ---`,
            s.subject ? `Subject: ${s.subject}` : '',
            s.content,
            s.proTip ? `Pro-Tip: ${s.proTip}` : '',
            ''
          ].filter(Boolean).join('\n');
        })
      ].join('\n');

      await navigator.clipboard.writeText(fullSequenceText);
      setCopiedAll(true);
      showToast('Complete multi-channel sequence copied to clipboard!', 'success');
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleCopyStep = async (step: CampaignSequenceStep, index: number) => {
    try {
      const stepText = [
        `Step ${step.stepNumber} (${step.day}) - ${step.title}`,
        step.subject ? `Subject: ${step.subject}` : '',
        step.content
      ].filter(Boolean).join('\n\n');

      await navigator.clipboard.writeText(stepText);
      setCopiedStepIndex(index);
      showToast(`Step ${step.stepNumber} copy copied to clipboard!`, 'info');
      setTimeout(() => setCopiedStepIndex(null), 2000);
    } catch {
      showToast('Failed to copy step', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-[#090d18] border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col justify-between">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#060912] flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 text-[11px] font-mono font-bold mb-2">
                <Layers className="w-3.5 h-3.5" />
                <span>OUTBOUND CAMPAIGN PLAYBOOK &amp; SEQUENCING</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {campaign.badge}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Targeting: <strong className="text-slate-800 dark:text-slate-200">{campaign.icp}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results Summary Bar */}
          <div className="bg-indigo-600/5 dark:bg-indigo-950/30 border-b border-indigo-500/10 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Live Performance:</span>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">
                {campaign.sqlsMetric}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAll}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {copiedAll ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Sequence Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>1-Click Copy Full Sequence</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sequence Steps Scrollable List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{campaign.steps.length} Multi-Touch Sequencing Steps</span>
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">100% CAN-SPAM &amp; GDPR Compliant</span>
            </div>

            {campaign.steps.map((step, idx) => (
              <div 
                key={idx}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 hover:border-indigo-400/50 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-mono font-black flex items-center justify-center">
                      {step.stepNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {step.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {step.day}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase font-bold text-slate-500">
                      {step.channel === 'linkedin' && <Linkedin className="w-3.5 h-3.5 text-blue-500" />}
                      {step.channel === 'email' && <Mail className="w-3.5 h-3.5 text-purple-500" />}
                      {step.channel === 'phone' && <Phone className="w-3.5 h-3.5 text-emerald-500" />}
                      <span>{step.channel}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCopyStep(step, idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Copy this step"
                    >
                      {copiedStepIndex === idx ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {step.subject && (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/5 text-xs font-mono">
                    <span className="text-slate-400 font-bold">Subject: </span>
                    <span className="text-slate-900 dark:text-slate-200">{step.subject}</span>
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-white dark:bg-black/40 border border-slate-200 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed font-sans">
                  {step.content}
                </div>

                {step.proTip && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400/90 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/30">
                    <strong>💡 Outbound Pro-Tip:</strong> {step.proTip}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer CTA */}
          <div className="p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#060912] flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Want our team to configure domains, verify prospect emails, and run this campaign for you?
            </p>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onDeployCampaign) onDeployCampaign(campaign.badge);
              }}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center gap-2 shrink-0"
            >
              <span>Deploy Sequence With LeadFlow</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
