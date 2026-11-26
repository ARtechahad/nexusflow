import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FileCode2,
  Globe,
  Layers,
  Layout,
  Lock,
  MailCheck,
  Radar,
  Repeat,
  RotateCcw,
  Search,
  Server,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Table2,
  Workflow,
  Zap
} from 'lucide-react';
import {
  ComparisonIconId,
  SERVICE_STOREFRONT_CONFIGS,
  ServiceStorefrontRoute
} from '../../data/serviceStorefrontData';
import { StudioLink } from './StudioLayout';
import { MiniWireframeCard } from './TemplateWireframePreview';

interface ServiceStorefrontPageProps {
  route: ServiceStorefrontRoute;
  onNavigate: (href: string) => void;
}

const COMPARISON_ICONS: Record<ComparisonIconId, React.ElementType> = {
  zap: Zap,
  layers: Layers,
  smartphone: Smartphone,
  cpu: Cpu,
  globe: Globe,
  layout: Layout,
  building: Building2,
  table: Table2,
  bot: Bot,
  radar: Radar,
  workflow: Workflow,
  lock: Lock,
  search: Search,
  sparkles: Sparkles,
  mailcheck: MailCheck,
  repeat: Repeat,
  shield: Shield,
  shieldcheck: ShieldCheck,
  filecode: FileCode2,
  server: Server
};

export const ServiceStorefrontPage: React.FC<ServiceStorefrontPageProps> = ({
  route,
  onNavigate
}) => {
  const config = SERVICE_STOREFRONT_CONFIGS[route];

  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string>(
    config.defaultPrimaryId
  );
  const [selectedVisualId, setSelectedVisualId] = useState<string>(
    config.defaultVisualId
  );
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>(
    config.defaultAddonIds
  );
  // Closed by default for clean visual layout; all answers remain in SSR DOM
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  React.useEffect(() => {
    setSelectedPrimaryId(config.defaultPrimaryId);
    setSelectedVisualId(config.defaultVisualId);
    setSelectedAddonIds(config.defaultAddonIds);
    setOpenFaqIdx(null);
  }, [config.defaultAddonIds, config.defaultPrimaryId, config.defaultVisualId]);

  const activePrimary = useMemo(
    () =>
      config.primaryOptions.find((o) => o.id === selectedPrimaryId) ||
      config.primaryOptions[0],
    [config.primaryOptions, selectedPrimaryId]
  );

  const activeVisual = useMemo(
    () =>
      config.visualOptions.find((o) => o.id === selectedVisualId) ||
      config.visualOptions[0],
    [config.visualOptions, selectedVisualId]
  );

  const activeAddons = useMemo(
    () => config.addonOptions.filter((o) => selectedAddonIds.includes(o.id)),
    [config.addonOptions, selectedAddonIds]
  );

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetDefaults = () => {
    setSelectedPrimaryId(config.defaultPrimaryId);
    setSelectedVisualId(config.defaultVisualId);
    setSelectedAddonIds(config.defaultAddonIds);
  };

  const blueprintSummaryText = useMemo(() => {
    const addonLabels =
      activeAddons.length > 0
        ? activeAddons.map((a) => a.label).join(', ')
        : 'Core architecture only';
    return [
      `Service Blueprint: ${config.serviceSchemaName}`,
      `- ${config.primaryStepLabel.replace(/^\d+\.\s*/, '')}: ${activePrimary.label}`,
      `- ${config.visualStepLabel.replace(/^\d+\.\s*/, '')}: ${activeVisual.label}`,
      `- ${config.addonStepLabel.replace(/^\d+\.\s*/, '')}: ${addonLabels}`
    ].join('\n');
  }, [
    activeAddons,
    activePrimary.label,
    activeVisual.label,
    config.addonStepLabel,
    config.primaryStepLabel,
    config.serviceSchemaName,
    config.visualStepLabel
  ]);

  const proposalHref = useMemo(() => {
    const params = new URLSearchParams({
      category: config.inquiryCategory,
      service: config.serviceSchemaName,
      blueprint: blueprintSummaryText
    });
    return `/contact?${params.toString()}`;
  }, [blueprintSummaryText, config.inquiryCategory, config.serviceSchemaName]);

  const visualGridCols =
    config.visualOptions.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <>
      {/* Hero */}
      <section className="py-12 md:py-16 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
          <nav
            aria-label="Breadcrumb"
            className="text-xs font-mono text-slate-500 dark:text-slate-400"
          >
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <StudioLink
                  href="/services"
                  onNavigate={onNavigate}
                  className="hover:text-[var(--accent)] dark:hover:text-blue-400 underline underline-offset-4"
                >
                  Services
                </StudioLink>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-slate-800 dark:text-slate-200">
                {config.serviceSchemaName}
              </li>
            </ol>
          </nav>

          <div className="max-w-[66ch] space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
              {config.eyebrow}
            </p>
            <h1 className="text-[30px] sm:text-[40px] lg:text-[46px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
              {config.title}
            </h1>
            <p className="text-[16px] sm:text-[17px] leading-[1.5] text-slate-600 dark:text-slate-300">
              {config.lead}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href="#blueprint-configurator"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              <span>Configure Blueprint</span>
            </a>
            <a
              href="#comparison-guide"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-900 dark:text-slate-100 transition-colors"
            >
              <span>Compare Options</span>
            </a>
          </div>
        </div>
      </section>

      {/* Visual-First 4-Card Path Comparison */}
      <section
        id="comparison-guide"
        className="scroll-mt-20 py-12 md:py-16 border-b border-slate-200 dark:border-slate-800"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-[62ch] space-y-1.5">
            <h2 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
              {config.guideHeading}
            </h2>
            <p className="text-[15px] leading-[1.5] text-slate-600 dark:text-slate-300">
              {config.guideIntro}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {config.comparisons.map((option) => {
              const IconComponent = COMPARISON_ICONS[option.icon] || Layers;
              return (
                <article
                  key={option.id}
                  className="p-5 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="w-9 h-9 rounded-[6px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] flex items-center justify-center text-[var(--accent)] dark:text-blue-400 shrink-0">
                        <IconComponent className="w-4 h-4" strokeWidth={1.85} aria-hidden="true" />
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-[var(--accent)] dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/70 whitespace-nowrap">
                        {option.badge}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {option.name}
                      </h3>
                      <p className="text-xs leading-[1.5] text-slate-600 dark:text-slate-300">
                        {option.takeaway}
                      </p>
                    </div>
                  </div>

                  <ul className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <li className="flex items-start gap-2">
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span>
                        <strong className="text-slate-900 dark:text-slate-100">Best for:</strong>{' '}
                        <span className="text-slate-600 dark:text-slate-300">{option.bestFor}</span>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span>
                        <strong className="text-slate-900 dark:text-slate-100">Speed:</strong>{' '}
                        <span className="text-slate-600 dark:text-slate-300">{option.launchSpeed}</span>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2
                        className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span>
                        <strong className="text-slate-900 dark:text-slate-100">Edge:</strong>{' '}
                        <span className="text-slate-600 dark:text-slate-300">{option.keyAdvantage}</span>
                      </span>
                    </li>
                  </ul>
                </article>
              );
            })}
          </div>

          {config.liveToolCta && (
            <div className="p-5 sm:p-6 rounded-[8px] border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {config.liveToolCta.heading}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {config.liveToolCta.description}
                </p>
              </div>
              <StudioLink
                href={config.liveToolCta.href}
                onNavigate={onNavigate}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap shrink-0"
              >
                <span>{config.liveToolCta.ctaLabel}</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              </StudioLink>
            </div>
          )}
        </div>
      </section>

      {/* Centerpiece: Interactive Visual Storefront Configurator */}
      <section
        id="blueprint-configurator"
        className="scroll-mt-20 py-12 md:py-16 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0D121C]"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-[60ch] space-y-1.5">
              <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                Interactive Storefront
              </p>
              <h2 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
                Configure your technical blueprint
              </h2>
              <p className="text-[15px] text-slate-600 dark:text-slate-300">
                Pick your stack, visual layout, and backend modules to generate a ready scope.
              </p>
            </div>
            <button
              type="button"
              onClick={resetDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px] text-xs font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Visual Steps */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 1 */}
              <div className="p-6 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {config.primaryStepLabel}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {config.primaryStepHint}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {config.primaryOptions.map((item) => {
                    const isSelected = item.id === activePrimary.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedPrimaryId(item.id)}
                        aria-pressed={isSelected}
                        className={`text-left p-3.5 rounded-[6px] border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/25 bg-blue-50/70 dark:bg-blue-950/30 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0B0F17] hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.label}
                          </span>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected
                                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSelected && (
                              <Check className="w-2.5 h-2.5" strokeWidth={3} aria-hidden="true" />
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {item.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Visual Mini-UI Mockup Cards */}
              <div className="p-6 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {config.visualStepLabel}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {config.visualStepHint}
                  </p>
                </div>

                <div className={`grid grid-cols-1 ${visualGridCols} gap-3.5`}>
                  {config.visualOptions.map((item) => {
                    const isSelected = item.id === activeVisual.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedVisualId(item.id)}
                        aria-pressed={isSelected}
                        className={`text-left p-3 rounded-[8px] border transition-all cursor-pointer flex flex-col gap-3 ${
                          isSelected
                            ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/25 bg-blue-50/60 dark:bg-blue-950/25 shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {item.wireframeId && (
                          <MiniWireframeCard
                            variant={item.wireframeId}
                            active={isSelected}
                          />
                        )}
                        <div className="space-y-0.5 px-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.label}
                            </span>
                            <span
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                  : 'border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {isSelected && (
                                <Check className="w-2.5 h-2.5" strokeWidth={3} aria-hidden="true" />
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {item.subtitle}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Multi-select Add-ons */}
              <div className="p-6 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {config.addonStepLabel}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {config.addonStepHint}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {config.addonOptions.map((item) => {
                    const checked = selectedAddonIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleAddon(item.id)}
                        aria-pressed={checked}
                        className={`text-left p-3.5 rounded-[6px] border transition-all cursor-pointer flex items-start gap-2.5 ${
                          checked
                            ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/25 bg-blue-50/70 dark:bg-blue-950/30 shadow-xs'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#0B0F17] hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                            checked
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#111827]'
                          }`}
                        >
                          {checked && (
                            <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
                          )}
                        </span>
                        <div className="space-y-0.5">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.label}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {item.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Sticky Blueprint Summary */}
            <aside className="lg:col-span-5 lg:sticky lg:top-24">
              <div className="p-6 sm:p-7 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm space-y-5">
                <div className="space-y-1 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                    Your Selected Blueprint
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {config.serviceSchemaName}
                  </h3>
                </div>

                {activeVisual.wireframeId && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400">
                      Selected Layout Preview
                    </span>
                    <MiniWireframeCard variant={activeVisual.wireframeId} active />
                  </div>
                )}

                <div className="space-y-3 text-sm">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400">
                      Stack &amp; Template
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-950/50 text-[var(--accent)] dark:text-blue-300 border border-blue-200 dark:border-blue-800/80">
                        {activePrimary.label}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {activeVisual.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400">
                      Included Modules ({activeAddons.length})
                    </div>
                    {activeAddons.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeAddons.map((addon) => (
                          <span
                            key={addon.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70"
                          >
                            <Check className="w-3 h-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                            <span>{addon.label}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Core stack only.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <StudioLink
                    href={proposalHref}
                    onNavigate={onNavigate}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors"
                  >
                    <span>Request Proposal with This Stack</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                  </StudioLink>
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    Pre-fills your configuration on the next step · Reply in 1–2 business days
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Clean Compact FAQ Accordion (Closed by default, 100% present in SSR DOM) */}
      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              FAQ
            </p>
            <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
              Common questions on timeline &amp; ownership
            </h2>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
            {config.faqs.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={faq.question} className="py-3.5">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 text-left cursor-pointer py-1"
                  >
                    <span className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    aria-hidden={!isOpen}
                    className={`grid transition-all duration-200 ${
                      isOpen ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm leading-[1.6] text-slate-600 dark:text-slate-300 pr-6 pb-1">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
};
