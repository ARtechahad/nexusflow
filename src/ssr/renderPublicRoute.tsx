import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  buildWebScraperJsonLdObjects,
  ROUTE_SEO,
  SITE_ORIGIN,
  SOCIAL_CHANNELS,
  STUDIO_BRAND
} from '../data/studioData';
import {
  buildServiceRouteJsonLd,
  SERVICE_STOREFRONT_CONFIGS,
  ServiceStorefrontRoute
} from '../data/serviceStorefrontData';
import {
  isKnownPublicRoute,
  normalizePathname,
  StudioWebsite
} from '../components/studio/StudioWebsite';

function escapeAttr(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSeoHeadBlock(options: {
  title: string;
  description: string;
  canonical: string;
  robots: string;
}): string {
  const title = escapeAttr(options.title);
  const description = escapeAttr(options.description);
  const canonical = escapeAttr(options.canonical);
  const robots = escapeAttr(options.robots);

  return [
    `<title>${title}</title>`,
    `    <meta name="description" content="${description}" />`,
    `    <meta name="robots" content="${robots}" />`,
    `    <link rel="canonical" href="${canonical}" />`,
    `    <meta property="og:site_name" content="ALM Nexus" />`,
    `    <meta property="og:url" content="${canonical}" />`,
    `    <meta property="og:title" content="${title}" />`,
    `    <meta property="og:description" content="${description}" />`,
    `    <meta property="og:type" content="website" />`,
    `    <meta property="og:image" content="${SITE_ORIGIN}/og-banner.png" />`,
    `    <meta property="og:image:width" content="1200" />`,
    `    <meta property="og:image:height" content="630" />`,
    `    <meta property="og:image:alt" content="ALM Nexus — AI, Web &amp; Mobile Software Engineering Agency" />`,
    `    <meta name="twitter:card" content="summary_large_image" />`,
    `    <meta name="twitter:title" content="${title}" />`,
    `    <meta name="twitter:description" content="${description}" />`,
    `    <meta name="twitter:image" content="${SITE_ORIGIN}/og-banner.png" />`,
    `    <meta name="twitter:image:alt" content="ALM Nexus — AI, Web &amp; Mobile Software Engineering Agency" />`
  ].join('\n');
}

function buildHomeOrganizationJsonLd(): string {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: STUDIO_BRAND.name,
    url: `${SITE_ORIGIN}/`,
    logo: `${SITE_ORIGIN}/favicon.jpg`,
    image: `${SITE_ORIGIN}/og-banner.png`,
    email: STUDIO_BRAND.emailPrimary,
    description:
      'Custom web platforms, iOS & Android mobile apps, AI automation agents, and B2B lead data pipelines built for ambitious companies worldwide.',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PK'
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: STUDIO_BRAND.emailPrimary,
      areaServed: ['US', 'GB', 'AE', 'EU']
    },
    sameAs: SOCIAL_CHANNELS.map((c) => c.href)
  };
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

function buildWebScraperRouteJsonLd(): string {
  return buildWebScraperJsonLdObjects()
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n    ');
}

function buildServiceStorefrontRouteJsonLd(route: ServiceStorefrontRoute): string {
  return buildServiceRouteJsonLd(route)
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n    ');
}

function isServiceStorefrontRoute(route: string): route is ServiceStorefrontRoute {
  return Object.prototype.hasOwnProperty.call(SERVICE_STOREFRONT_CONFIGS, route);
}

export function renderPublicRouteHtml(
  templateHtml: string,
  rawPath: string
): { html: string; statusCode: number } {
  const normalized = normalizePathname(rawPath);
  const isKnown = isKnownPublicRoute(normalized);
  const statusCode = isKnown ? 200 : 404;

  const seo = isKnown
    ? ROUTE_SEO[normalized]
    : {
        title: 'Page Not Found | ALM Nexus',
        description: 'The requested URL does not exist on almnexus.tech.',
        canonical: `${SITE_ORIGIN}/`
      };

  const headBlock = buildSeoHeadBlock({
    title: seo.title,
    description: seo.description,
    canonical: seo.canonical,
    robots: isKnown ? 'index, follow' : 'noindex, nofollow'
  });

  const jsonLdBlock =
    normalized === '/'
      ? buildHomeOrganizationJsonLd()
      : normalized === '/tools/web-data-engine'
      ? buildWebScraperRouteJsonLd()
      : isServiceStorefrontRoute(normalized)
      ? buildServiceStorefrontRouteJsonLd(normalized)
      : '';

  const renderedMarkup = renderToString(
    <StudioWebsite
      currentPath={normalized}
      isDark={false}
      onToggleTheme={() => {}}
      onNavigate={() => {}}
    />
  );

  let html = templateHtml.replace(
    /<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/,
    headBlock
  );
  html = html.replace('<!--SEO_JSON_LD-->', jsonLdBlock);
  html = html.replace('<!--SSR_OUTLET-->', renderedMarkup);

  return { html, statusCode };
}

export function renderNoIndexAppHtml(templateHtml: string, rawPath: string): string {
  const normalized = normalizePathname(rawPath);
  const headBlock = buildSeoHeadBlock({
    title: 'Workspace | ALM Nexus',
    description: 'NexusFlow workspace and client operations portal.',
    canonical: `${SITE_ORIGIN}${normalized}`,
    robots: 'noindex, nofollow'
  });

  let html = templateHtml.replace(
    /<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/,
    headBlock
  );
  html = html.replace('<!--SEO_JSON_LD-->', '');
  html = html.replace('<!--SSR_OUTLET-->', '');
  return html;
}
