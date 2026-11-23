import React from 'react';
import { STUDIO_BRAND } from '../../data/studioData';
import { StudioLink, StudioNavigationProps } from './StudioLayout';

export const PrivacyPage: React.FC = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-8">
          <h1 className="text-[34px] sm:text-[44px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="text-sm font-mono text-slate-500 dark:text-slate-400">
            {STUDIO_BRAND.name} · {STUDIO_BRAND.domain}
          </p>
        </div>

        <div className="space-y-8 text-[16px] leading-[1.6] text-slate-600 dark:text-slate-300 max-w-[68ch]">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              1. Scope and controller
            </h2>
            <p>
              ALM Nexus ({STUDIO_BRAND.domain}) is {STUDIO_BRAND.locationRemote.toLowerCase()} We operate custom software engineering services, B2B data pipelines, and the NexusFlow SaaS platform.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              2. Information collected on this website
            </h2>
            <p>
              When you submit the project inquiry form, we collect your name, email address, optional company and budget selection, and project notes solely to respond to your request. Theme preference settings are stored locally in your browser via localStorage.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              3. B2B data and client dataset isolation
            </h2>
            <p>
              B2B research and outbound systems built for clients focus strictly on corporate roles and business domains in alignment with GDPR Article 6(1)(f), UK GDPR, and US CAN-SPAM rules. Client-commissioned datasets and NexusFlow API keys remain isolated per tenant and are never resold or shared across accounts.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              4. Data deletion and contact
            </h2>
            <p>
              For data access, correction, or opt-out inquiries, write to{' '}
              <a
                href={`mailto:${STUDIO_BRAND.emailPrimary}`}
                className="font-mono text-slate-900 dark:text-white underline"
              >
                {STUDIO_BRAND.emailPrimary}
              </a>{' '}
              or{' '}
              <a
                href={`mailto:${STUDIO_BRAND.emailDirect}`}
                className="font-mono text-slate-900 dark:text-white underline"
              >
                {STUDIO_BRAND.emailDirect}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export const TermsPage: React.FC = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-8">
          <h1 className="text-[34px] sm:text-[44px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
            Terms of Service
          </h1>
          <p className="text-sm font-mono text-slate-500 dark:text-slate-400">
            {STUDIO_BRAND.name} · {STUDIO_BRAND.domain}
          </p>
        </div>

        <div className="space-y-8 text-[16px] leading-[1.6] text-slate-600 dark:text-slate-300 max-w-[68ch]">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              1. Engagement scope and delivery
            </h2>
            <p>
              ALM Nexus provides web and mobile application engineering, Unity game development, AI agent and fine-tuning work, data extraction pipelines, and NexusFlow software access pursuant to mutually agreed written project scopes.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              2. Source handoff and data ownership
            </h2>
            <p>
              Unless otherwise specified in a written agreement, client-commissioned software repositories and custom prospect datasets belong to the commissioning client upon milestone completion and must be used in compliance with applicable laws in the client&apos;s operating jurisdictions.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              3. NexusFlow workspace responsibilities
            </h2>
            <p>
              Workspace administrators govern departmental role-based access, team invitations, and third-party API credentials stored inside their tenant key vault.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              4. Contact
            </h2>
            <p>
              For contract or compliance questions, email{' '}
              <a
                href={`mailto:${STUDIO_BRAND.emailPrimary}`}
                className="font-mono text-slate-900 dark:text-white underline"
              >
                {STUDIO_BRAND.emailPrimary}
              </a>{' '}
              or{' '}
              <a
                href={`mailto:${STUDIO_BRAND.emailDirect}`}
                className="font-mono text-slate-900 dark:text-white underline"
              >
                {STUDIO_BRAND.emailDirect}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export const NotFoundPage: React.FC<StudioNavigationProps> = ({ onNavigate }) => {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
          404
        </p>
        <h1 className="text-[34px] sm:text-[44px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
          Page not found
        </h1>
        <p className="text-[16px] leading-[1.6] text-slate-600 dark:text-slate-300 max-w-[68ch]">
          The requested URL does not exist on {STUDIO_BRAND.domain}.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <StudioLink
            href="/"
            onNavigate={onNavigate}
            className="inline-flex items-center px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors"
          >
            Back to home
          </StudioLink>
          <StudioLink
            href="/contact"
            onNavigate={onNavigate}
            className="inline-flex items-center px-5 py-2.5 rounded-[6px] text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
          >
            Start a Project
          </StudioLink>
        </div>
      </div>
    </section>
  );
};
