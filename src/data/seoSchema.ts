import {
  buildWebScraperJsonLdObjects,
  PRIMARY_NAV_ITEMS,
  PublicRoutePath,
  ROUTE_SEO,
  SITE_ORIGIN,
  SOCIAL_CHANNELS,
  STUDIO_BRAND
} from './studioData';
import {
  buildServiceRouteJsonLd,
  SERVICE_STOREFRONT_CONFIGS,
  ServiceStorefrontRoute
} from './serviceStorefrontData';

const ORG_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

const SERVICE_OFFER_ORDER: ServiceStorefrontRoute[] = [
  '/services/app-development',
  '/services/web-development',
  '/services/ai-automation',
  '/services/data-intelligence',
  '/services/cybersecurity'
];

export function buildOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'ProfessionalService'],
    '@id': ORG_ID,
    name: STUDIO_BRAND.name,
    url: `${SITE_ORIGIN}/`,
    logo: `${SITE_ORIGIN}/favicon.jpg`,
    image: `${SITE_ORIGIN}/og-banner.png`,
    email: STUDIO_BRAND.emailPrimary,
    description:
      'Custom web platforms, iOS & Android mobile apps, AI automation agents, and B2B lead data pipelines built for ambitious companies worldwide.',
    founder: {
      '@type': 'Person',
      name: 'Abdul Ahad Rana'
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PK'
    },
    areaServed: ['US', 'GB', 'AE', 'EU', 'Worldwide'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: STUDIO_BRAND.emailPrimary,
      url: `${SITE_ORIGIN}/contact`,
      areaServed: ['US', 'GB', 'AE', 'EU']
    },
    knowsAbout: [
      'Custom Software Development',
      'Mobile App Development',
      'Web & SaaS Platform Engineering',
      'AI Agents & RAG',
      'LLM Fine-Tuning & Private Self-Hosted LLMs',
      'Web Scraping & Data Engineering',
      'B2B Lead Generation & SMTP Verification',
      'Penetration Testing & Application Security'
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'ALM Nexus Engineering Services',
      itemListElement: SERVICE_OFFER_ORDER.map((route) => {
        const svc = SERVICE_STOREFRONT_CONFIGS[route];
        const seo = ROUTE_SEO[route];
        return {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: svc.serviceSchemaName,
            serviceType: svc.serviceSchemaType,
            url: seo.canonical,
            description: seo.description
          }
        };
      })
    },
    sameAs: SOCIAL_CHANNELS.map((c) => c.href)
  };
}

export function buildWebSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: STUDIO_BRAND.name,
    alternateName: 'almnexus.tech',
    url: `${SITE_ORIGIN}/`,
    publisher: {
      '@id': ORG_ID
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_ORIGIN}/services?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

export function buildSiteNavigationSchema(): Record<string, unknown> {
  const navEntries = [
    ...PRIMARY_NAV_ITEMS,
    { label: 'Start a Project', href: '/contact' as PublicRoutePath }
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ALM Nexus Primary Navigation',
    itemListElement: navEntries.map((item, idx) => ({
      '@type': 'SiteNavigationElement',
      position: idx + 1,
      name: item.label,
      url: ROUTE_SEO[item.href].canonical
    }))
  };
}

interface BreadcrumbNode {
  name: string;
  item: string;
}

const ROUTE_BREADCRUMBS: Partial<Record<PublicRoutePath, BreadcrumbNode[]>> = {
  '/services': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Services', item: `${SITE_ORIGIN}/services` }
  ],
  '/services/app-development': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Services', item: `${SITE_ORIGIN}/services` },
    {
      name: SERVICE_STOREFRONT_CONFIGS['/services/app-development'].serviceSchemaName,
      item: `${SITE_ORIGIN}/services/app-development`
    }
  ],
  '/services/web-development': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Services', item: `${SITE_ORIGIN}/services` },
    {
      name: SERVICE_STOREFRONT_CONFIGS['/services/web-development'].serviceSchemaName,
      item: `${SITE_ORIGIN}/services/web-development`
    }
  ],
  '/services/ai-automation': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Services', item: `${SITE_ORIGIN}/services` },
    {
      name: SERVICE_STOREFRONT_CONFIGS['/services/ai-automation'].serviceSchemaName,
      item: `${SITE_ORIGIN}/services/ai-automation`
    }
  ],
  '/services/data-intelligence': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Services', item: `${SITE_ORIGIN}/services` },
    {
      name: SERVICE_STOREFRONT_CONFIGS['/services/data-intelligence'].serviceSchemaName,
      item: `${SITE_ORIGIN}/services/data-intelligence`
    }
  ],
  '/services/cybersecurity': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Services', item: `${SITE_ORIGIN}/services` },
    {
      name: SERVICE_STOREFRONT_CONFIGS['/services/cybersecurity'].serviceSchemaName,
      item: `${SITE_ORIGIN}/services/cybersecurity`
    }
  ],
  '/products': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Products', item: `${SITE_ORIGIN}/products` }
  ],
  '/tools/web-data-engine': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    {
      name: 'Free AI Web Scraper & Lead Extractor',
      item: `${SITE_ORIGIN}/tools/web-data-engine`
    }
  ],
  '/work': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Work', item: `${SITE_ORIGIN}/work` }
  ],
  '/about': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'About', item: `${SITE_ORIGIN}/about` }
  ],
  '/contact': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Contact', item: `${SITE_ORIGIN}/contact` }
  ],
  '/privacy': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Privacy Policy', item: `${SITE_ORIGIN}/privacy` }
  ],
  '/terms': [
    { name: 'Home', item: `${SITE_ORIGIN}/` },
    { name: 'Terms of Service', item: `${SITE_ORIGIN}/terms` }
  ]
};

export function buildBreadcrumbSchema(
  route: PublicRoutePath
): Record<string, unknown> | null {
  const trail = ROUTE_BREADCRUMBS[route];
  if (!trail || trail.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.item
    }))
  };
}

function isServiceStorefrontRoute(route: string): route is ServiceStorefrontRoute {
  return Object.prototype.hasOwnProperty.call(SERVICE_STOREFRONT_CONFIGS, route);
}

export function buildRouteJsonLdObjects(
  normalizedPath: string,
  isKnown: boolean
): Record<string, unknown>[] {
  if (!isKnown) {
    return [];
  }

  const route = normalizedPath as PublicRoutePath;

  if (route === '/') {
    return [
      buildOrganizationSchema(),
      buildWebSiteSchema(),
      buildSiteNavigationSchema()
    ];
  }

  const schemas: Record<string, unknown>[] = [];
  const breadcrumb = buildBreadcrumbSchema(route);
  if (breadcrumb) {
    schemas.push(breadcrumb);
  }

  if (route === '/services' || route === '/about') {
    schemas.push(buildOrganizationSchema());
  }

  if (route === '/tools/web-data-engine') {
    schemas.push(...buildWebScraperJsonLdObjects());
  } else if (isServiceStorefrontRoute(route)) {
    schemas.push(...buildServiceRouteJsonLd(route));
  }

  return schemas;
}
