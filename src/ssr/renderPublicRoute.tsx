import React from 'react';
import { renderToString } from 'react-dom/server';
import { ROUTE_SEO, SITE_ORIGIN } from '../data/studioData';
import { buildRouteJsonLdObjects } from '../data/seoSchema';
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

  const jsonLdBlock = buildRouteJsonLdObjects(normalized, isKnown)
    .map(
      (obj) =>
        `<script type="application/ld+json" data-route-jsonld="true">${JSON.stringify(obj)}</script>`
    )
    .join('\n    ');

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
