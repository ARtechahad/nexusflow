import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  NEXUSFLOW_TABS,
  NexusFlowTabItem,
  RD_PRODUCTS,
  RdProduct
} from '../../data/studioData';
import { NexusFlowPreviewWindow } from './NexusFlowPreviewWindow';
import { StudioLink, StudioNavigationProps } from './StudioLayout';

const RdProductCard: React.FC<{ product: RdProduct }> = ({ product }) => (
  <article className="p-6 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-3">
    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
      {product.status}
    </p>
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
      {product.title}
    </h3>
    <p className="text-sm leading-[1.6] text-slate-600 dark:text-slate-300">
      {product.summary}
    </p>
    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
      {product.stack}
    </p>
  </article>
);

interface ProductsPageProps extends StudioNavigationProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  onNavigate,
  onOpenAuth
}) => {
  const [activeTabId, setActiveTabId] = useState<NexusFlowTabItem['id']>('client-portals');

  const activeTab =
    NEXUSFLOW_TABS.find((t) => t.id === activeTabId) || NEXUSFLOW_TABS[0];

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % NEXUSFLOW_TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + NEXUSFLOW_TABS.length) % NEXUSFLOW_TABS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = NEXUSFLOW_TABS.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = NEXUSFLOW_TABS[nextIndex];
    setActiveTabId(nextTab.id);
    if (typeof document !== 'undefined') {
      const nextEl = document.getElementById(`nexusflow-tab-${nextTab.id}`);
      nextEl?.focus();
    }
  };

  const handleLaunchNexusFlow = () => {
    if (onOpenAuth) {
      onOpenAuth('signup');
    } else {
      onNavigate('/signup');
    }
  };

  const handleClientSignIn = () => {
    if (onOpenAuth) {
      onOpenAuth('signin');
    } else {
      onNavigate('/login');
    }
  };

  return (
    <>
      <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[68ch] space-y-4">
            <h1 className="text-[34px] sm:text-[44px] lg:text-[50px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
              Products
            </h1>
            <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
              ALM Nexus builds its own software alongside client work. NexusFlow is the first release.
            </p>
          </div>
        </div>
      </section>

      {/* Featured product: NexusFlow */}
      <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-[68ch] space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
              Featured product
            </p>
            <h2 className="text-[24px] sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
              NexusFlow
            </h2>
            <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
              Multi-tenant operations workspace for agencies and B2B teams running client delivery, deal pipelines, and outbound email under one roof.
            </p>
          </div>

          <div className="rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
            <div
              role="tablist"
              aria-label="NexusFlow modules"
              className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0D131F]"
            >
              {NEXUSFLOW_TABS.map((tab, idx) => {
                const isSelected = tab.id === activeTab.id;
                return (
                  <button
                    key={tab.id}
                    id={`nexusflow-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls={`nexusflow-panel-${tab.id}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setActiveTabId(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                      isSelected
                        ? 'border-[var(--accent)] text-slate-900 dark:text-white bg-white dark:bg-[#111827]'
                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div
              id={`nexusflow-panel-${activeTab.id}`}
              role="tabpanel"
              aria-labelledby={`nexusflow-tab-${activeTab.id}`}
              className="p-6 sm:p-8 space-y-6"
            >
              <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-700 dark:text-slate-200 max-w-[68ch]">
                {activeTab.body}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleLaunchNexusFlow}
                  className="px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
                >
                  Launch NexusFlow
                </button>

                <button
                  type="button"
                  onClick={handleClientSignIn}
                  className="px-5 py-2.5 rounded-[6px] text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-900 dark:text-slate-100 transition-colors cursor-pointer"
                >
                  Client Sign In
                </button>
              </div>
            </div>
          </div>

          <NexusFlowPreviewWindow />
        </div>
      </section>

      {/* Internal engineering tools */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-[68ch] space-y-2">
            <h2 className="text-[24px] sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-[1.2] text-slate-900 dark:text-white">
              Internal engineering tools
            </h2>
            <p className="text-[16px] leading-[1.6] text-slate-600 dark:text-slate-300">
              Internal software utilities supporting client delivery sprints, data verification, and automated QA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {RD_PRODUCTS.map((product) => (
              <RdProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="p-6 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-mono uppercase tracking-wider text-[var(--accent)] dark:text-blue-400">
                Free Online Tool
              </p>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Free AI Web Scraper &amp; Lead Extractor
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-[60ch]">
                Extract business emails, phone numbers, WhatsApp links, social profiles, and structured catalogs to CSV, JSON, or PDF.
              </p>
            </div>
            <StudioLink
              href="/tools/web-data-engine"
              onNavigate={onNavigate}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap shrink-0"
            >
              <span>Open Free Web Scraper</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            </StudioLink>
          </div>
        </div>
      </section>
    </>
  );
};
