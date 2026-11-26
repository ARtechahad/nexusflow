import React, { useEffect } from 'react';
import {
  buildWebScraperJsonLdObjects,
  PUBLIC_ROUTES,
  PublicRoutePath,
  ROUTE_SEO
} from '../../data/studioData';
import {
  buildServiceRouteJsonLd,
  SERVICE_STOREFRONT_CONFIGS,
  ServiceStorefrontRoute
} from '../../data/serviceStorefrontData';
import { StudioLayout } from './StudioLayout';
import { HomePage } from './HomePage';
import { ServicesPage } from './ServicesPage';
import { ServiceStorefrontPage } from './ServiceStorefrontPage';
import { ProductsPage } from './ProductsPage';
import { WorkPage } from './WorkPage';
import { AboutPage } from './AboutPage';
import { ContactPage } from './ContactPage';
import { WebDataEnginePage } from './WebDataEnginePage';
import { NotFoundPage, PrivacyPage, TermsPage } from './LegalPages';

export function normalizePathname(rawPathname: string): string {
  const pathOnly = rawPathname.split('?')[0].split('#')[0] || '/';
  if (pathOnly.length > 1 && pathOnly.endsWith('/')) {
    return pathOnly.slice(0, -1);
  }
  return pathOnly;
}

export function isKnownPublicRoute(pathname: string): pathname is PublicRoutePath {
  return (PUBLIC_ROUTES as readonly string[]).includes(normalizePathname(pathname));
}

interface StudioWebsiteProps {
  currentPath: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (href: string) => void;
  onOpenAuth?: (mode: 'signin' | 'signup') => void;
}

export const StudioWebsite: React.FC<StudioWebsiteProps> = ({
  currentPath,
  isDark,
  onToggleTheme,
  onNavigate,
  onOpenAuth
}) => {
  const normalizedPath = normalizePathname(currentPath);
  const isKnown = isKnownPublicRoute(normalizedPath);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const seo = isKnown
      ? ROUTE_SEO[normalizedPath]
      : {
          title: 'Page Not Found | ALM Nexus',
          description: 'The requested page could not be found on almnexus.tech.',
          canonical: 'https://almnexus.tech/'
        };

    document.title = seo.title;

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('meta[name="description"]', 'name', 'description', seo.description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', seo.canonical);
    setMeta('meta[property="og:image"]', 'property', 'og:image', 'https://almnexus.tech/og-banner.png');
    setMeta('meta[property="og:image:width"]', 'property', 'og:image:width', '1200');
    setMeta('meta[property="og:image:height"]', 'property', 'og:image:height', '630');
    setMeta(
      'meta[property="og:image:alt"]',
      'property',
      'og:image:alt',
      'ALM Nexus — AI, Web & Mobile Software Engineering Agency'
    );
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', 'https://almnexus.tech/og-banner.png');
    setMeta(
      'meta[name="twitter:image:alt"]',
      'name',
      'twitter:image:alt',
      'ALM Nexus — AI, Web & Mobile Software Engineering Agency'
    );
    setMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      isKnown ? 'index, follow' : 'noindex, nofollow'
    );

    const canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonicalEl) {
      canonicalEl.setAttribute('href', seo.canonical);
    }

    const existingJsonLd = document.querySelectorAll<HTMLScriptElement>(
      'script[data-route-jsonld="true"]'
    );
    existingJsonLd.forEach((node) => node.remove());

    if (normalizedPath === '/tools/web-data-engine') {
      buildWebScraperJsonLdObjects().forEach((schemaObj) => {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-route-jsonld', 'true');
        script.textContent = JSON.stringify(schemaObj);
        document.head.appendChild(script);
      });
    } else if (
      Object.prototype.hasOwnProperty.call(SERVICE_STOREFRONT_CONFIGS, normalizedPath)
    ) {
      buildServiceRouteJsonLd(normalizedPath as ServiceStorefrontRoute).forEach(
        (schemaObj) => {
          const script = document.createElement('script');
          script.type = 'application/ld+json';
          script.setAttribute('data-route-jsonld', 'true');
          script.textContent = JSON.stringify(schemaObj);
          document.head.appendChild(script);
        }
      );
    }
  }, [isKnown, normalizedPath]);

  const renderPage = () => {
    switch (normalizedPath) {
      case '/':
        return (
          <HomePage
            isDark={isDark}
            onNavigate={onNavigate}
            onOpenAuth={onOpenAuth}
          />
        );
      case '/services':
        return <ServicesPage onNavigate={onNavigate} />;
      case '/services/app-development':
      case '/services/web-development':
      case '/services/ai-automation':
      case '/services/data-intelligence':
      case '/services/cybersecurity':
        return (
          <ServiceStorefrontPage
            route={normalizedPath as ServiceStorefrontRoute}
            onNavigate={onNavigate}
          />
        );
      case '/products':
        return <ProductsPage onNavigate={onNavigate} onOpenAuth={onOpenAuth} />;
      case '/tools/web-data-engine':
        return <WebDataEnginePage onNavigate={onNavigate} />;
      case '/work':
        return <WorkPage onNavigate={onNavigate} />;
      case '/about':
        return <AboutPage onNavigate={onNavigate} />;
      case '/contact':
        return <ContactPage />;
      case '/privacy':
        return <PrivacyPage />;
      case '/terms':
        return <TermsPage />;
      default:
        return <NotFoundPage onNavigate={onNavigate} />;
    }
  };

  return (
    <StudioLayout
      currentPath={normalizedPath}
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      onNavigate={onNavigate}
    >
      {renderPage()}
    </StudioLayout>
  );
};
