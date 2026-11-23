import React from 'react';
import { ArrowRight } from 'lucide-react';
import { WORK_CASE_STUDIES } from '../../data/studioData';
import { StudioLink, StudioNavigationProps } from './StudioLayout';

export const WorkPage: React.FC<StudioNavigationProps> = ({ onNavigate }) => {
  return (
    <>
      <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[68ch] space-y-4">
            <h1 className="text-[34px] sm:text-[44px] lg:text-[50px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
              Work
            </h1>
            <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
              Selected software systems, data pipelines, prototypes, and internal products engineered by ALM Nexus.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {WORK_CASE_STUDIES.map((study) => (
            <article
              key={study.id}
              className="p-6 sm:p-7 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col justify-between space-y-6"
            >
              <div className="space-y-4">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {study.status}
                </p>

                <h2 className="text-[22px] sm:text-[24px] font-bold tracking-[-0.015em] leading-[1.25] text-slate-900 dark:text-white">
                  {study.title}
                </h2>

                <p className="text-sm sm:text-[15px] leading-[1.6] text-slate-700 dark:text-slate-200">
                  {study.summary}
                </p>

                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Problem
                  </h3>
                  <p className="text-sm sm:text-[15px] leading-[1.6] text-slate-600 dark:text-slate-300">
                    {study.problem}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    What we built
                  </h3>
                  <ul className="space-y-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300 list-disc pl-4">
                    {study.built.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">Stack: </span>
                <span className="font-mono text-slate-600 dark:text-slate-300">{study.stack}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-700 dark:text-slate-200 max-w-[68ch]">
            Need an engineering team for a product build, prototype, or internal data system.
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
