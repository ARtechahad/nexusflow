import React, { useEffect, useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import {
  PRIMARY_NAV_ITEMS,
  SOCIAL_CHANNELS,
  STUDIO_BRAND
} from '../../data/studioData';

export interface StudioNavigationProps {
  onNavigate: (href: string) => void;
}

interface StudioLayoutProps {
  currentPath: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (href: string) => void;
  children: React.ReactNode;
}

export const StudioLink: React.FC<{
  href: string;
  onNavigate: (href: string) => void;
  className?: string;
  children: React.ReactNode;
  'aria-current'?: 'page' | undefined;
  'aria-label'?: string;
}> = ({ href, onNavigate, className = '', children, ...rest }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    if (href.startsWith('/')) {
      e.preventDefault();
      onNavigate(href);
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  );
};

export const AlmNexusLogo: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (imgFailed) {
    return (
      <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
        ALM Nexus
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-[6px] transition-colors ${
        isDark ? 'bg-white px-2 py-1' : 'bg-transparent'
      }`}
    >
      <img
        src={STUDIO_BRAND.logoPath}
        alt="ALM Nexus software studio logo"
        width={112}
        height={28}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="h-7 w-auto object-contain"
      />
    </span>
  );
};

export const StudioLayout: React.FC<StudioLayoutProps> = ({
  currentPath,
  isDark,
  onToggleTheme,
  onNavigate,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath]);

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    onNavigate(href);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B0F17] text-[#0F172A] dark:text-[#F1F5F9] antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-[6px] focus:bg-[var(--accent)] focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-[#F8FAFC]/95 dark:bg-[#0B0F17]/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <StudioLink
            href="/"
            onNavigate={handleNavClick}
            aria-label="ALM Nexus home"
            className="inline-flex items-center shrink-0"
          >
            <AlmNexusLogo isDark={isDark} />
          </StudioLink>

          <nav
            aria-label="Primary"
            className="hidden md:flex items-center gap-7 text-[15px] font-medium"
          >
            {PRIMARY_NAV_ITEMS.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <StudioLink
                  key={item.href}
                  href={item.href}
                  onNavigate={handleNavClick}
                  aria-current={isActive ? 'page' : undefined}
                  className={`whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'text-[#0F172A] dark:text-white underline decoration-[var(--accent)] decoration-2 underline-offset-8'
                      : 'text-slate-600 dark:text-slate-300 hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </StudioLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex items-center justify-center w-10 h-10 rounded-[6px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>

            <StudioLink
              href="/contact"
              onNavigate={handleNavClick}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white transition-colors whitespace-nowrap shrink-0"
            >
              Start a Project
            </StudioLink>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-[6px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {mobileMenuOpen ? (
                <X className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Menu className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            id="mobile-nav-drawer"
            aria-label="Mobile navigation"
            className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0B0F17] px-4 py-4 space-y-1"
          >
            {PRIMARY_NAV_ITEMS.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <StudioLink
                  key={item.href}
                  href={item.href}
                  onNavigate={handleNavClick}
                  aria-current={isActive ? 'page' : undefined}
                  className={`block px-3 py-2.5 rounded-[6px] text-base font-medium ${
                    isActive
                      ? 'bg-white dark:bg-[#111827] text-[#0F172A] dark:text-white border border-slate-200 dark:border-slate-800'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.label}
                </StudioLink>
              );
            })}
            <div className="pt-2">
              <StudioLink
                href="/contact"
                onNavigate={handleNavClick}
                className="flex items-center justify-center w-full px-4 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] text-white"
              >
                Start a Project
              </StudioLink>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F141F]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="space-y-3 max-w-sm">
              <StudioLink
                href="/"
                onNavigate={handleNavClick}
                aria-label="ALM Nexus home"
                className="inline-flex items-center"
              >
                <AlmNexusLogo isDark={isDark} />
              </StudioLink>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {STUDIO_BRAND.oneLineSummary}
              </p>
              <p className="text-sm">
                <a
                  href={`mailto:${STUDIO_BRAND.emailPrimary}`}
                  className="font-mono text-slate-900 dark:text-slate-100 hover:underline"
                >
                  {STUDIO_BRAND.emailPrimary}
                </a>
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div className="space-y-2.5">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Studio</div>
                <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                  <li>
                    <StudioLink href="/services" onNavigate={handleNavClick} className="hover:text-slate-900 dark:hover:text-white">
                      Services
                    </StudioLink>
                  </li>
                  <li>
                    <StudioLink href="/products" onNavigate={handleNavClick} className="hover:text-slate-900 dark:hover:text-white">
                      Products
                    </StudioLink>
                  </li>
                  <li>
                    <StudioLink href="/tools/web-data-engine" onNavigate={handleNavClick} className="hover:text-slate-900 dark:hover:text-white">
                      Web Data Engine
                    </StudioLink>
                  </li>
                  <li>
                    <StudioLink href="/work" onNavigate={handleNavClick} className="hover:text-slate-900 dark:hover:text-white">
                      Work
                    </StudioLink>
                  </li>
                  <li>
                    <StudioLink href="/about" onNavigate={handleNavClick} className="hover:text-slate-900 dark:hover:text-white">
                      About
                    </StudioLink>
                  </li>
                  <li>
                    <StudioLink href="/contact" onNavigate={handleNavClick} className="hover:text-slate-900 dark:hover:text-white">
                      Contact
                    </StudioLink>
                  </li>
                </ul>
              </div>

              <div className="space-y-2.5">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Legal</div>
                <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                  <li>
                    <StudioLink href="/privacy" onNavigate={handleNavClick} className="hover:text-slate-900 dark:hover:text-white">
                      Privacy Policy
                    </StudioLink>
                  </li>
                  <li>
                    <StudioLink href="/terms" onNavigate={handleNavClick} className="hover:text-slate-900 dark:hover:text-white">
                      Terms of Service
                    </StudioLink>
                  </li>
                </ul>
              </div>

              <div className="space-y-2.5 col-span-2 sm:col-span-1">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Social</div>
                <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                  {SOCIAL_CHANNELS.map((channel) => (
                    <li key={channel.name}>
                      <a
                        href={channel.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-slate-900 dark:hover:text-white"
                      >
                        {channel.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <p>&copy; {new Date().getFullYear()} {STUDIO_BRAND.name}. All rights reserved.</p>
            <p>{STUDIO_BRAND.domain}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
