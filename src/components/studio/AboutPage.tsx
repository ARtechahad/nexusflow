import React from 'react';
import { ArrowRight } from 'lucide-react';
import { STUDIO_BRAND } from '../../data/studioData';
import { StudioLink, StudioNavigationProps } from './StudioLayout';

export const AboutPage: React.FC<StudioNavigationProps> = ({ onNavigate }) => {
  return (
    <>
      <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[68ch] space-y-4">
            <h1 className="text-[34px] sm:text-[44px] lg:text-[50px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
              About ALM Nexus
            </h1>
            <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
              {STUDIO_BRAND.locationRemote}
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3">
              <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
                What we build
              </h2>
              <p className="text-[16px] leading-[1.6] text-slate-600 dark:text-slate-300 max-w-[68ch]">
                ALM Nexus operates as a small software studio and R&amp;D lab. We work with founders, small engineering teams, and agencies on production web and mobile applications, 2D and 3D games in Unity, fine-tuned AI agents and automation workflows, and Python data scraping with verified B2B lead datasets.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3">
              <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
                How we work with clients
              </h2>
              <p className="text-[16px] leading-[1.6] text-slate-600 dark:text-slate-300 max-w-[68ch]">
                Every engagement starts with written scope, data models, and architecture before code begins. We work in short sprint cycles with clickable builds, deploy onto client-owned infrastructure, and hand over source repositories and credentials cleanly.
              </p>
            </div>

            <div className="p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3">
              <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
                First software product
              </h2>
              <p className="text-[16px] leading-[1.6] text-slate-600 dark:text-slate-300 max-w-[68ch]">
                Alongside client builds, ALM Nexus develops its own SaaS tools. NexusFlow is our first release—a multi-tenant operations workspace for client portals, role-based access, deal pipelines, and outbound email.
              </p>
              <div className="pt-2">
                <StudioLink
                  href="/products"
                  onNavigate={onNavigate}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] dark:text-blue-400 hover:underline"
                >
                  <span>View NexusFlow and R&amp;D products</span>
                  <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
                </StudioLink>
              </div>
            </div>

            <div className="p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3">
              <h2 className="text-[22px] sm:text-[26px] font-bold tracking-[-0.02em] text-slate-900 dark:text-white">
                Leadership
              </h2>
              <p className="text-[16px] leading-[1.6] text-slate-600 dark:text-slate-300 max-w-[68ch]">
                {STUDIO_BRAND.founderBio}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Direct inquiries:{' '}
                <a
                  href={`mailto:${STUDIO_BRAND.emailDirect}`}
                  className="font-mono text-slate-900 dark:text-slate-100 underline"
                >
                  {STUDIO_BRAND.emailDirect}
                </a>
              </p>
            </div>
          </div>

          <div className="pt-4">
            <StudioLink
              href="/contact"
              onNavigate={onNavigate}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors"
            >
              <span>Start a Project</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            </StudioLink>
          </div>
        </div>
      </section>
    </>
  );
};
