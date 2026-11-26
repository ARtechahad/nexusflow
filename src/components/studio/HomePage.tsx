import React from 'react';
import { ArrowRight } from 'lucide-react';
import { HOME_CAPABILITIES, SHIPPING_STEPS } from '../../data/studioData';
import { MicroDotField } from './MicroDotField';
import { NexusFlowPreviewWindow } from './NexusFlowPreviewWindow';
import { StudioLink, StudioNavigationProps } from './StudioLayout';

interface HomePageProps extends StudioNavigationProps {
  isDark: boolean;
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  isDark,
  onNavigate,
  onOpenAuth
}) => {
  const handleLaunchApp = () => {
    if (onOpenAuth) {
      onOpenAuth('signup');
    } else {
      onNavigate('/signup');
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-16 md:py-24 lg:py-28 border-b border-slate-200 dark:border-slate-800">
        <MicroDotField isDark={isDark} />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[68ch] space-y-6">
            <h1 className="text-[34px] sm:text-[44px] lg:text-[52px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
              We engineer custom software, AI systems, and data infrastructure.
            </h1>

            <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
              ALM Nexus is a custom software engineering and AI automation agency. We deliver production Web &amp; SaaS Platforms, iOS &amp; Android Mobile Apps, AI Agents &amp; Automation, B2B Data Pipelines, and Security Audits, alongside our own SaaS products.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <StudioLink
                href="/contact"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors"
              >
                <span>Start a Project</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              </StudioLink>

              <StudioLink
                href="/products"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-900 dark:text-slate-100 transition-colors"
              >
                <span>Explore Products</span>
              </StudioLink>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 md:py-24 lg:py-28 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-[68ch] space-y-2">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Capabilities
            </p>
            <h2 className="text-[24px] sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
              Four engineering disciplines
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {HOME_CAPABILITIES.map((cap) => (
              <StudioLink
                key={cap.id}
                href={cap.href}
                onNavigate={onNavigate}
                className="group block p-6 sm:p-7 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {cap.title}
                    </h3>
                    <ArrowRight
                      className="w-4 h-4 text-slate-400 group-hover:text-[var(--accent)] transition-colors shrink-0"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-sm font-mono leading-relaxed text-slate-600 dark:text-slate-400">
                    {cap.summary}
                  </p>
                </div>
              </StudioLink>
            ))}
          </div>
        </div>
      </section>

      {/* Flagship product banner + Interactive NexusFlow UI Showcase */}
      <section className="py-16 md:py-24 lg:py-28 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="p-6 sm:p-10 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-[68ch] space-y-3">
                <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                  Flagship product
                </p>
                <h2 className="text-[24px] sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
                  NexusFlow: multi-tenant operations platform for agencies and B2B teams
                </h2>
                <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
                  NexusFlow gives agencies one workspace for client portals, deal pipelines, and outbound email, with role-based access per department. It is built and run by ALM Nexus.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <StudioLink
                  href="/products"
                  onNavigate={onNavigate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap"
                >
                  <span>Explore NexusFlow</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                </StudioLink>

                <button
                  type="button"
                  onClick={handleLaunchApp}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-900 dark:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Launch App</span>
                </button>
              </div>
            </div>

            <NexusFlowPreviewWindow />
          </div>
        </div>
      </section>

      {/* How we ship */}
      <section className="py-16 md:py-24 lg:py-28 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-[68ch] space-y-2">
            <h2 className="text-[24px] sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
              How we ship
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            {SHIPPING_STEPS.map((step) => (
              <div key={step.title} className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="text-[16px] leading-[1.6] text-slate-600 dark:text-slate-300 max-w-[68ch]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing strip */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-700 dark:text-slate-200 max-w-[68ch]">
            Have a technical specification, product prototype, or data workflow to scope.
          </p>
          <StudioLink
            href="/contact"
            onNavigate={onNavigate}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap shrink-0"
          >
            <span>Start a Project</span>
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          </StudioLink>
        </div>
      </section>
    </>
  );
};
