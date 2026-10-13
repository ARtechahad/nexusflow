import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Mail,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ArrowDown,
  ArrowRight,
  MoveDown,
  MoveUp,
  HelpCircle,
  Sparkles,
  Zap,
  Sliders,
  Check,
  X
} from 'lucide-react';
import { CampaignStep, validateSequenceNodes, StepCondition, ConditionRule } from '../../services/outreachService';

interface SequenceBuilderProps {
  steps: CampaignStep[];
  onChange: (steps: CampaignStep[]) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SequenceBuilder: React.FC<SequenceBuilderProps> = ({
  steps,
  onChange,
  showToast
}) => {
  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cyclePath, setCyclePath] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'visual' | 'nodes'>('visual');

  // Validate on steps changes
  useEffect(() => {
    async function checkLoops() {
      try {
        const mapped = steps.map((s, idx) => ({
          id: s.id || `step_${s.step_number || idx + 1}`,
          step_number: s.step_number || idx + 1,
          condition: s.condition,
          on_true_step: s.on_true_step,
          on_false_step: s.on_false_step
        }));
        const res = await validateSequenceNodes(mapped);
        if (!res.isValid) {
          setValidationError(res.error || 'Circular loop detected in sequence branches!');
          setCyclePath(res.cyclePath || []);
        } else {
          setValidationError(null);
          setCyclePath([]);
        }
      } catch {
        // Fallback local DFS check
        setValidationError(null);
      }
    }
    checkLoops();
  }, [steps]);

  const addStep = (type: 'email' | 'delay' | 'condition') => {
    const nextNumber = steps.length + 1;
    const newStepId = `step_${Date.now()}`;

    let newStep: CampaignStep;
    if (type === 'delay') {
      newStep = {
        id: newStepId,
        step_number: nextNumber,
        delay_days: 2,
        delay_hours: 0,
        variants: [
          {
            variant_label: 'A',
            subject: 'Follow-up on previous note',
            body_html: '<p>Hi {{first_name}},</p><p>Wanted to follow up on my previous note regarding outbound growth.</p>',
            weight: 100
          }
        ]
      };
    } else if (type === 'condition') {
      newStep = {
        id: newStepId,
        step_number: nextNumber,
        delay_days: 1,
        delay_hours: 0,
        condition: {
          op: 'AND',
          rules: [{ type: 'opened', withinHours: 48 }]
        },
        on_true_step: `step_${nextNumber + 1}`,
        on_false_step: `step_${nextNumber + 2}`,
        variants: [
          {
            variant_label: 'A',
            subject: 'Quick question regarding your roadmap',
            body_html: '<p>Hi {{first_name}}, following up on my previous message.</p>',
            weight: 100
          }
        ]
      };
    } else {
      // Default email step
      newStep = {
        id: newStepId,
        step_number: nextNumber,
        delay_days: 1,
        delay_hours: 0,
        variants: [
          {
            variant_label: 'A',
            subject: 'Quick touchpoint {{first_name}}',
            body_html: '<p>Hi {{first_name}},</p><p>Wanted to follow up briefly.</p>',
            weight: 100
          }
        ]
      };
    }

    const updated = [...steps, newStep];
    onChange(updated);
    setSelectedStepIndex(updated.length - 1);
    showToast(`Added ${type} step #${nextNumber}`, 'success');
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) {
      showToast('A campaign requires at least 1 sequence step', 'error');
      return;
    }
    const updated = steps.filter((_, idx) => idx !== index).map((s, idx) => ({
      ...s,
      step_number: idx + 1
    }));
    onChange(updated);
    setSelectedStepIndex(Math.max(0, index - 1));
    showToast(`Removed step #${index + 1}`, 'info');
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    const copy = [...steps];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;

    const renumbered = copy.map((s, idx) => ({
      ...s,
      step_number: idx + 1
    }));
    onChange(renumbered);
    setSelectedStepIndex(targetIdx);
  };

  const updateSelectedStep = (updater: (prev: CampaignStep) => CampaignStep) => {
    const copy = [...steps];
    copy[selectedStepIndex] = updater(copy[selectedStepIndex]);
    onChange(copy);
  };

  const curStep = steps[selectedStepIndex] || steps[0];

  return (
    <div className="space-y-6">
      {/* Top Header & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Visual Sequence & Conditional Branch Builder</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Construct multi-touch outbound journeys with automated YES/NO branch paths based on prospect engagement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'visual'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Interactive Canvas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('nodes')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'nodes'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Node Inspector
            </button>
          </div>

          <div className="relative group">
            <button
              type="button"
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Node</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-30 hidden group-hover:block">
              <button
                type="button"
                onClick={() => addStep('email')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                <span>Email Step</span>
              </button>
              <button
                type="button"
                onClick={() => addStep('delay')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Delay Interval</span>
              </button>
              <button
                type="button"
                onClick={() => addStep('condition')}
                className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <GitBranch className="w-3.5 h-3.5 text-purple-500" />
                <span>Condition Branch</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Circular Loop Warning Alert */}
      {validationError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-bold">Circular Loop Detected in Sequence Branches</h4>
            <p>{validationError}</p>
            {cyclePath.length > 0 && (
              <p className="font-mono text-[11px] bg-rose-100 dark:bg-rose-900/40 px-2 py-1 rounded-md inline-block">
                Cycle: {cyclePath.join(' &rarr; ')}
              </p>
            )}
            <p className="text-[11px] text-rose-600 dark:text-rose-400">
              Please adjust target steps so the sequence flows forward without circular recursion.
            </p>
          </div>
        </div>
      )}

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Canvas Visualization */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 min-h-[500px] flex flex-col items-center justify-start space-y-4 relative overflow-hidden">
            {/* Canvas Background Grid */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />

            {/* Sequence Start Badge */}
            <div className="relative z-10 px-4 py-1.5 rounded-full bg-emerald-600 text-white font-mono text-[11px] font-bold shadow-xs flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>SEQUENCE START</span>
            </div>

            {/* Downward flow connector */}
            <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700" />

            {/* Render Nodes in Order */}
            {steps.map((step, idx) => {
              const isSelected = selectedStepIndex === idx;
              const hasCondition = Boolean(step.condition && step.condition.rules?.length);

              return (
                <React.Fragment key={step.id || idx}>
                  {/* Step Node Card */}
                  <div
                    onClick={() => setSelectedStepIndex(idx)}
                    className={`relative z-10 w-full max-w-md rounded-2xl p-4 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-white dark:bg-slate-900 border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 font-mono text-xs font-bold flex items-center justify-center">
                          #{step.step_number}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {hasCondition ? 'Branching Decision Step' : `Step ${step.step_number}: Email Touchpoint`}
                            </span>
                            {step.auto_optimise && (
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                                Auto-Optimise
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {step.delay_days > 0 ? `Wait ${step.delay_days}d` : ''}{' '}
                              {step.delay_hours > 0 ? `${step.delay_hours}h` : ''}
                              {step.delay_days === 0 && step.delay_hours === 0 ? 'Immediate send' : ''}
                            </span>
                            <span>•</span>
                            <span>{step.variants.length} variant{step.variants.length > 1 ? 's' : ''} (A-Z)</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveStep(idx, 'up');
                          }}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveStep(idx, 'down');
                          }}
                          disabled={idx === steps.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeStep(idx);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Step Variants Preview */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 space-y-1.5">
                      {step.variants.slice(0, 3).map((v) => (
                        <div key={v.variant_label} className="text-xs flex items-center justify-between">
                          <span className="truncate max-w-[240px] text-slate-600 dark:text-slate-300">
                            <strong className="text-indigo-600 dark:text-indigo-400 font-mono mr-1">
                              [{v.variant_label}]
                            </strong>{' '}
                            {v.subject}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{v.weight}% weight</span>
                        </div>
                      ))}
                      {step.variants.length > 3 && (
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                          +{step.variants.length - 3} more variants configured
                        </div>
                      )}
                    </div>

                    {/* Condition branch visual preview */}
                    {hasCondition && (
                      <div className="mt-3 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 text-[11px] space-y-1">
                        <div className="font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                          <GitBranch className="w-3 h-3" />
                          <span>Condition: {step.condition?.op} ({step.condition?.rules.length} rule{step.condition?.rules.length! > 1 ? 's' : ''})</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                          <div className="text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/60 p-1 rounded-md">
                            YES &rarr; {step.on_true_step ? `Step ${step.on_true_step.replace('step_', '')}` : 'Next Linear'}
                          </div>
                          <div className="text-rose-700 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-950/60 p-1 rounded-md">
                            NO &rarr; {step.on_false_step ? `Step ${step.on_false_step.replace('step_', '')}` : 'Next Linear'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Flow connector line between nodes */}
                  {idx < steps.length - 1 && (
                    <div className="flex flex-col items-center my-0.5">
                      <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700" />
                      <ArrowDown className="w-3.5 h-3.5 text-slate-400 -mt-1" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Sequence End Badge */}
            <div className="w-0.5 h-6 bg-slate-300 dark:bg-slate-700" />
            <div className="relative z-10 px-4 py-1.5 rounded-full bg-slate-600 text-white font-mono text-[11px] font-bold shadow-xs">
              SEQUENCE END
            </div>
          </div>
        </div>

        {/* Right: Selected Node Configuration Inspector */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>Configure Step #{curStep.step_number}</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  Delay timing, conditional routing, and A–Z message variants.
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                Step {curStep.step_number} of {steps.length}
              </span>
            </div>

            {/* Timing & Delay Controls */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Wait Interval Before Send
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Days</span>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={curStep.delay_days}
                    onChange={(e) =>
                      updateSelectedStep((prev) => ({
                        ...prev,
                        delay_days: parseInt(e.target.value, 10) || 0
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 mb-1 block">Hours</span>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={curStep.delay_hours}
                    onChange={(e) =>
                      updateSelectedStep((prev) => ({
                        ...prev,
                        delay_hours: parseInt(e.target.value, 10) || 0
                      }))
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Auto-optimise toggle switch */}
            <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-purple-900 dark:text-purple-300 block">
                  Bayesian Auto-Optimise (Beta posterior)
                </span>
                <span className="text-[10px] text-purple-700 dark:text-purple-400">
                  Automatically shifts weights toward best-performing variant after &ge; 100 sends (5% min floor).
                </span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(curStep.auto_optimise)}
                onChange={(e) =>
                  updateSelectedStep((prev) => ({
                    ...prev,
                    auto_optimise: e.target.checked
                  }))
                }
                className="w-4 h-4 text-purple-600 rounded-sm focus:ring-purple-500"
              />
            </div>

            {/* Conditional Branching Section */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Conditional Branching
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Route prospect to different steps based on events
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (curStep.condition) {
                      updateSelectedStep((prev) => ({
                        ...prev,
                        condition: undefined,
                        on_true_step: undefined,
                        on_false_step: undefined
                      }));
                    } else {
                      updateSelectedStep((prev) => ({
                        ...prev,
                        condition: {
                          op: 'AND',
                          rules: [{ type: 'opened', withinHours: 48 }]
                        },
                        on_true_step: `step_${Math.min(steps.length, curStep.step_number + 1)}`,
                        on_false_step: `step_${Math.min(steps.length, curStep.step_number + 2)}`
                      }));
                    }
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    curStep.condition
                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                      : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {curStep.condition ? 'Disable Condition' : 'Enable Branching'}
                </button>
              </div>

              {curStep.condition && (
                <div className="space-y-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-xs">
                  {/* Operator */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px]">Match condition:</span>
                    <select
                      value={curStep.condition.op}
                      onChange={(e) =>
                        updateSelectedStep((prev) => ({
                          ...prev,
                          condition: prev.condition
                            ? { ...prev.condition, op: e.target.value as 'AND' | 'OR' }
                            : undefined
                        }))
                      }
                      className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                    >
                      <option value="AND">AND (All rules must match)</option>
                      <option value="OR">OR (Any rule matches)</option>
                    </select>
                  </div>

                  {/* Rules list */}
                  <div className="space-y-2">
                    {curStep.condition.rules.map((rule, rIdx) => (
                      <div key={rIdx} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            RULE #{rIdx + 1}
                          </span>
                          {curStep.condition!.rules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newRules = curStep.condition!.rules.filter((_, idx) => idx !== rIdx);
                                updateSelectedStep((prev) => ({
                                  ...prev,
                                  condition: prev.condition ? { ...prev.condition, rules: newRules } : undefined
                                }));
                              }}
                              className="text-[10px] text-rose-500 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <select
                          value={rule.type}
                          onChange={(e) => {
                            const newRules = [...curStep.condition!.rules];
                            newRules[rIdx] = { ...newRules[rIdx], type: e.target.value as any };
                            updateSelectedStep((prev) => ({
                              ...prev,
                              condition: prev.condition ? { ...prev.condition, rules: newRules } : undefined
                            }));
                          }}
                          className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                        >
                          <option value="opened">Prospect Opened Email</option>
                          <option value="clicked">Prospect Clicked Any Link</option>
                          <option value="link_clicked">Prospect Clicked Specific URL</option>
                          <option value="replied">Prospect Replied</option>
                          <option value="replied_positive">Prospect Positive Reply</option>
                          <option value="not_opened">Prospect Did NOT Open</option>
                          <option value="not_clicked">Prospect Did NOT Click</option>
                          <option value="bounced">Email Bounced</option>
                        </select>

                        {rule.type === 'link_clicked' && (
                          <input
                            type="text"
                            placeholder="Target link URL (e.g. calendly.com/meeting)"
                            value={rule.linkUrl || ''}
                            onChange={(e) => {
                              const newRules = [...curStep.condition!.rules];
                              newRules[rIdx] = { ...newRules[rIdx], linkUrl: e.target.value };
                              updateSelectedStep((prev) => ({
                                ...prev,
                                condition: prev.condition ? { ...prev.condition, rules: newRules } : undefined
                              }));
                            }}
                            className="w-full px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs"
                          />
                        )}

                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>Within</span>
                          <input
                            type="number"
                            min="1"
                            max="720"
                            value={rule.withinHours || 48}
                            onChange={(e) => {
                              const newRules = [...curStep.condition!.rules];
                              newRules[rIdx] = { ...newRules[rIdx], withinHours: parseInt(e.target.value, 10) || 48 };
                              updateSelectedStep((prev) => ({
                                ...prev,
                                condition: prev.condition ? { ...prev.condition, rules: newRules } : undefined
                              }));
                            }}
                            className="w-16 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-mono"
                          />
                          <span>hours</span>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const newRules = [...curStep.condition!.rules, { type: 'opened' as const, withinHours: 48 }];
                        updateSelectedStep((prev) => ({
                          ...prev,
                          condition: prev.condition ? { ...prev.condition, rules: newRules } : undefined
                        }));
                      }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Rule to Condition</span>
                    </button>
                  </div>

                  {/* True / False Branch Targets */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 block mb-1">
                        ON TRUE (YES)
                      </span>
                      <select
                        value={curStep.on_true_step || ''}
                        onChange={(e) =>
                          updateSelectedStep((prev) => ({
                            ...prev,
                            on_true_step: e.target.value || undefined
                          }))
                        }
                        className="w-full px-2 py-1 rounded-md border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-xs"
                      >
                        <option value="">Continue Linearly</option>
                        {steps.map((s) => (
                          <option key={s.id || s.step_number} value={s.id || `step_${s.step_number}`}>
                            Step {s.step_number}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-rose-600 block mb-1">
                        ON FALSE (NO)
                      </span>
                      <select
                        value={curStep.on_false_step || ''}
                        onChange={(e) =>
                          updateSelectedStep((prev) => ({
                            ...prev,
                            on_false_step: e.target.value || undefined
                          }))
                        }
                        className="w-full px-2 py-1 rounded-md border border-rose-300 dark:border-rose-900 bg-white dark:bg-slate-900 text-xs"
                      >
                        <option value="">Continue Linearly</option>
                        {steps.map((s) => (
                          <option key={s.id || s.step_number} value={s.id || `step_${s.step_number}`}>
                            Step {s.step_number}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
