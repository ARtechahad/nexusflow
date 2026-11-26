import React from 'react';
import { ArrowRight } from 'lucide-react';
import { SERVICES_LIST } from '../../data/studioData';
import { StudioLink, StudioNavigationProps } from './StudioLayout';

export const ServicesPage: React.FC<StudioNavigationProps> = ({ onNavigate }) => {
  return (
    <>
      <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[68ch] space-y-4">
            <h1 className="text-[34px] sm:text-[44px] lg:text-[50px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
              Services
            </h1>
            <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
              Engineering engagements scoped around concrete deliverables, clean code handoffs, and predictable timelines.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {SERVICES_LIST.map((service) => (
            <article
              key={service.id}
              id={service.id}
              className="scroll-mt-24 p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-6"
            >
              <div className="max-w-[68ch] space-y-3">
                <h2 className="text-[24px] sm:text-[28px] lg:text-[30px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
                  {service.title}
                </h2>
                <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
                  {service.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="space-y-2 md:col-span-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    What you get
                  </h3>
                  <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300 list-disc pl-4">
                    {service.deliverables.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Stack
                  </h3>
                  <p className="text-sm font-mono leading-relaxed text-slate-700 dark:text-slate-300">
                    {service.stack}
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Typical timeline
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {service.timeline}
                  </p>
                </div>
              </div>

                {service.id === 'web-mobile' && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Compare frameworks, preview starter UI layouts, and configure your technical blueprint.
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <StudioLink
                        href="/services/app-development"
                        onNavigate={onNavigate}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap"
                      >
                        <span>Configure Mobile App</span>
                        <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                      </StudioLink>
                      <StudioLink
                        href="/services/web-development"
                        onNavigate={onNavigate}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-sm font-medium border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white transition-colors whitespace-nowrap"
                      >
                        <span>Configure Web / SaaS</span>
                        <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                      </StudioLink>
                    </div>
                  </div>
                )}

                {service.id === 'ai' && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Compare RAG assistants, n8n workflows, and cloud vs. private self-hosted LLMs.
                    </p>
                    <StudioLink
                      href="/services/ai-automation"
                      onNavigate={onNavigate}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap"
                    >
                      <span>Learn &amp; Configure AI Automation</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                    </StudioLink>
                  </div>
                )}

                {service.id === 'data' && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Scope a custom B2B data pipeline or test our live public web scraper directly.
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <StudioLink
                        href="/services/data-intelligence"
                        onNavigate={onNavigate}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap"
                      >
                        <span>Configure Data Pipeline</span>
                        <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                      </StudioLink>
                      <StudioLink
                        href="/tools/web-data-engine"
                        onNavigate={onNavigate}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-sm font-medium border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white transition-colors whitespace-nowrap"
                      >
                        <span>Free Web Scraper &amp; Lead Extractor</span>
                        <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                      </StudioLink>
                    </div>
                  </div>
                )}
            </article>
          ))}

          <article
            id="cybersecurity"
            className="scroll-mt-24 p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-6"
          >
            <div className="max-w-[68ch] space-y-3">
              <h2 className="text-[24px] sm:text-[28px] lg:text-[30px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
                Web App Penetration Testing &amp; Security Audits
              </h2>
              <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
                We run manual Black-Box and Grey-Box penetration tests, OWASP Top 10 verification, source code security reviews (SAST), and cloud server hardening before production launches or enterprise reviews.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="space-y-2 md:col-span-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  What you get
                </h3>
                <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-300 list-disc pl-4">
                  <li>Executive risk summary report</li>
                  <li>Reproducible PoC HTTP findings</li>
                  <li>Code-level remediation guide</li>
                  <li>Verification re-test within 30 days</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Coverage
                </h3>
                <p className="text-sm font-mono leading-relaxed text-slate-700 dark:text-slate-300">
                  OWASP Top 10, BOLA/IDOR, RBAC, SAST, AWS / Linux Hardening
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Typical timeline
                </h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  5–10 business days for web/API audits and remediation report.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Compare Black-Box vs. Grey-Box testing, target environments, and deliverables.
              </p>
              <StudioLink
                href="/services/cybersecurity"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap"
              >
                <span>Learn &amp; Configure Security Audit</span>
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              </StudioLink>
            </div>
          </article>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="max-w-[68ch] space-y-1">
            <h2 className="text-[24px] sm:text-[28px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
              Ready to scope a build
            </h2>
            <p className="text-[16px] text-slate-600 dark:text-slate-300">
              Send your requirements and we will reply with architecture notes within 1-2 business days.
            </p>
          </div>
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
