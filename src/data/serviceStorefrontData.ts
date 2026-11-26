import { InquiryCategory, ROUTE_SEO, SITE_ORIGIN, STUDIO_BRAND } from './studioData';

export type ServiceStorefrontRoute =
  | '/services/app-development'
  | '/services/web-development'
  | '/services/ai-automation'
  | '/services/data-intelligence'
  | '/services/cybersecurity';

export type WireframeVariantId =
  | 'mobile-saas'
  | 'mobile-ecommerce'
  | 'mobile-booking'
  | 'mobile-fintech'
  | 'web-saas'
  | 'web-agency'
  | 'web-crm'
  | 'web-ecommerce'
  | 'ai-cloud'
  | 'ai-private'
  | 'ai-hybrid'
  | 'data-csv'
  | 'data-api'
  | 'data-crm'
  | 'sec-webapp'
  | 'sec-api'
  | 'sec-cloud';

export type ComparisonIconId =
  | 'zap'
  | 'layers'
  | 'smartphone'
  | 'cpu'
  | 'globe'
  | 'layout'
  | 'building'
  | 'table'
  | 'bot'
  | 'radar'
  | 'workflow'
  | 'lock'
  | 'search'
  | 'sparkles'
  | 'mailcheck'
  | 'repeat'
  | 'shield'
  | 'shieldcheck'
  | 'filecode'
  | 'server';

export interface ComparisonOption {
  id: string;
  name: string;
  badge: string;
  icon: ComparisonIconId;
  takeaway: string;
  bestFor: string;
  launchSpeed: string;
  keyAdvantage: string;
}

export interface ConfigOptionItem {
  id: string;
  label: string;
  subtitle: string;
  wireframeId?: WireframeVariantId;
}

export interface ServiceFaqItem {
  question: string;
  answer: string;
}

export interface ServiceStorefrontConfig {
  route: ServiceStorefrontRoute;
  eyebrow: string;
  title: string;
  lead: string;
  quickAnswer: string;
  serviceSchemaName: string;
  serviceSchemaType: string;
  inquiryCategory: InquiryCategory;
  guideHeading: string;
  guideIntro: string;
  comparisons: ComparisonOption[];
  primaryStepLabel: string;
  primaryStepHint: string;
  primaryOptions: ConfigOptionItem[];
  defaultPrimaryId: string;
  visualStepLabel: string;
  visualStepHint: string;
  visualOptions: ConfigOptionItem[];
  defaultVisualId: string;
  addonStepLabel: string;
  addonStepHint: string;
  addonOptions: ConfigOptionItem[];
  defaultAddonIds: string[];
  liveToolCta?: {
    heading: string;
    description: string;
    href: '/tools/web-data-engine';
    ctaLabel: string;
  };
  faqs: ServiceFaqItem[];
}

export const SERVICE_STOREFRONT_CONFIGS: Record<
  ServiceStorefrontRoute,
  ServiceStorefrontConfig
> = {
  '/services/app-development': {
    route: '/services/app-development',
    eyebrow: 'MOBILE APPS · IOS & ANDROID',
    title: 'Custom Mobile App Development (iOS & Android)',
    lead: 'Pick the right mobile framework, preview starter screens, and scope your backend.',
    quickAnswer:
      'Designed for startups, consumer brands, and B2B operations teams launching mobile products. We build cross-platform and native iOS and Android apps using Flutter, React Native, Expo, Swift, or Kotlin paired with Node.js, FastAPI, and PostgreSQL. Clients receive production store builds, full source code ownership, admin controls, and deployment scripts.',
    serviceSchemaName: 'Custom Mobile App Development (iOS & Android)',
    serviceSchemaType: 'Mobile Application Development',
    inquiryCategory: 'Web / Mobile App',
    guideHeading: 'Choose Your Mobile Approach',
    guideIntro: 'Compare speed, budget fit, and hardware access across the four build paths.',
    comparisons: [
      {
        id: 'flutter',
        name: 'Flutter (Dart)',
        badge: 'Custom UI Parity',
        icon: 'layers',
        takeaway: 'One codebase delivering identical custom UI on iOS and Android.',
        bestFor: 'Consumer brands & fintech wallets',
        launchSpeed: '2–4 weeks MVP',
        keyAdvantage: 'Smooth 60/120fps GPU graphics'
      },
      {
        id: 'react-native-expo',
        name: 'React Native & Expo',
        badge: 'Fastest Launch',
        icon: 'zap',
        takeaway: 'Ship iOS and Android fast while sharing TypeScript with your web app.',
        bestFor: 'SaaS startups & marketplaces',
        launchSpeed: '2–3 weeks MVP',
        keyAdvantage: 'Instant over-the-air updates'
      },
      {
        id: 'swift',
        name: 'Native iOS (SwiftUI)',
        badge: 'Apple Performance',
        icon: 'smartphone',
        takeaway: 'Maximum speed and zero-day access to Apple hardware features.',
        bestFor: 'iOS-first apps, AR & HealthKit',
        launchSpeed: '3–5 weeks build',
        keyAdvantage: 'Smallest binary & battery footprint'
      },
      {
        id: 'kotlin',
        name: 'Native Android (Kotlin)',
        badge: 'Enterprise Hardware',
        icon: 'cpu',
        takeaway: 'Built for background GPS tracking, NFC scanners, and Android kiosks.',
        bestFor: 'Logistics, POS & field teams',
        launchSpeed: '3–5 weeks build',
        keyAdvantage: 'Reliable background OS services'
      }
    ],
    primaryStepLabel: '1. Mobile Framework',
    primaryStepHint: 'Select the client stack that matches your launch timeline.',
    primaryOptions: [
      { id: 'flutter', label: 'Flutter (Dart)', subtitle: 'iOS + Android · Pixel-identical UI' },
      { id: 'react-native', label: 'React Native (TypeScript)', subtitle: 'iOS + Android · Shared web code' },
      { id: 'expo', label: 'Expo Cross-Platform', subtitle: 'Fastest MVP + OTA updates' },
      { id: 'swift', label: 'Native iOS (SwiftUI)', subtitle: 'Apple-exclusive hardware speed' },
      { id: 'kotlin', label: 'Native Android (Kotlin)', subtitle: 'Scanners, GPS & background tasks' }
    ],
    defaultPrimaryId: 'react-native',
    visualStepLabel: '2. UI Starter Template',
    visualStepHint: 'Click a layout mockup to set your app interface direction.',
    visualOptions: [
      {
        id: 'mobile-saas',
        label: 'SaaS Mobile Dashboard',
        subtitle: 'KPI metrics, feed & tab navigation',
        wireframeId: 'mobile-saas'
      },
      {
        id: 'mobile-ecommerce',
        label: 'E-Commerce & Delivery',
        subtitle: 'Product grid, cart & live tracking',
        wireframeId: 'mobile-ecommerce'
      },
      {
        id: 'mobile-booking',
        label: 'On-Demand Booking',
        subtitle: 'Providers, time slots & checkout',
        wireframeId: 'mobile-booking'
      },
      {
        id: 'mobile-fintech',
        label: 'Fintech & Wallet UI',
        subtitle: 'Balance card, transfers & ledger',
        wireframeId: 'mobile-fintech'
      }
    ],
    defaultVisualId: 'mobile-saas',
    addonStepLabel: '3. Backend & Integrations',
    addonStepHint: 'Toggle the cloud services and mobile features you need.',
    addonOptions: [
      {
        id: 'backend-api',
        label: 'Node.js / FastAPI Backend',
        subtitle: 'Typed API, auth & rate limiting'
      },
      {
        id: 'db-storage',
        label: 'PostgreSQL / Supabase / Firebase',
        subtitle: 'Cloud database & file storage'
      },
      {
        id: 'push',
        label: 'Push Notifications',
        subtitle: 'APNs & FCM alerts with deep links'
      },
      {
        id: 'payments',
        label: 'Stripe & In-App Payments',
        subtitle: 'Subscriptions & checkout webhooks'
      },
      {
        id: 'chat',
        label: 'Real-Time Chat',
        subtitle: 'Live WebSocket messaging & media'
      }
    ],
    defaultAddonIds: ['backend-api', 'db-storage', 'push'],
    faqs: [
      {
        question: 'Should I pick Flutter, React Native, or Native Swift/Kotlin?',
        answer:
          'For 85% of startups and B2B apps, Flutter or React Native/Expo cuts engineering time nearly in half while delivering smooth 60fps performance on both iOS and Android. Choose Native Swift or Kotlin only when your core feature depends on specialized Apple/Android hardware APIs or single-platform OS depth.'
      },
      {
        question: 'How long does a mobile app MVP take to ship?',
        answer:
          'A focused mobile MVP with authentication, core screens, backend API, and TestFlight/Play Console internal testing typically takes 2 to 4 weeks. Complex marketplaces, real-time chat, or payment compliance workflows add 2 to 4 additional weeks depending on scope.'
      },
      {
        question: 'Do I own 100% of the source code and App Store accounts?',
        answer:
          'Yes. Upon project completion and milestone payment, ALM Nexus transfers full Git repository ownership, design tokens, backend deployment scripts, and builds directly under your Apple Developer and Google Play Console accounts.'
      },
      {
        question: 'What drives the cost of custom mobile app development?',
        answer:
          'Cost depends primarily on the number of distinct user roles (e.g., customer vs. vendor), third-party integrations (payments, maps, live chat), offline sync complexity, and whether you require a companion web admin panel.'
      },
      {
        question: 'Can you maintain the app after launch for iOS and Android OS updates?',
        answer:
          'Yes. We offer optional post-launch retainers covering dependency upgrades, Apple/Google store policy updates, crash monitoring, and incremental feature sprints.'
      }
    ]
  },

  '/services/web-development': {
    route: '/services/web-development',
    eyebrow: 'WEB & SAAS PLATFORMS',
    title: 'Custom Web & SaaS Platform Development',
    lead: 'Compare web architectures, preview starter interfaces, and configure your stack.',
    quickAnswer:
      'Built for SaaS founders, agencies, and enterprises replacing manual spreadsheets or scaling customer portals. We engineer web platforms using Next.js, React, TypeScript, Tailwind CSS, Node.js, FastAPI, PostgreSQL, and MongoDB. Clients receive responsive multi-tenant apps, role-based access control, automated CI/CD cloud deployment, database schemas, and complete repository handoff.',
    serviceSchemaName: 'Custom Web & SaaS Platform Development',
    serviceSchemaType: 'Web Application & SaaS Development',
    inquiryCategory: 'Web / Mobile App',
    guideHeading: 'Choose Your Web Architecture',
    guideIntro: 'Match your product goals to the right rendering model and database setup.',
    comparisons: [
      {
        id: 'marketing-seo',
        name: 'Marketing & SEO Sites',
        badge: 'Fastest Launch',
        icon: 'globe',
        takeaway: 'Prerendered pages built to rank on Google and convert visitors fast.',
        bestFor: 'Product launches & B2B lead gen',
        launchSpeed: '1–2 weeks',
        keyAdvantage: 'Instant load & full SEO schema'
      },
      {
        id: 'spa',
        name: 'Single-Page Web Apps',
        badge: 'Interactive UX',
        icon: 'layout',
        takeaway: 'App-like speed for live calculators, tables, and browser tools.',
        bestFor: 'Web tools & client dashboards',
        launchSpeed: '2–3 weeks MVP',
        keyAdvantage: 'Zero page reload transitions'
      },
      {
        id: 'multi-tenant-saas',
        name: 'Multi-Tenant SaaS',
        badge: 'Best for Scale',
        icon: 'building',
        takeaway: 'Subscription software with strict organization isolation and billing.',
        bestFor: 'B2B SaaS startups & portals',
        launchSpeed: '3–6 weeks MVP',
        keyAdvantage: 'Built-in RBAC, tenants & Stripe'
      },
      {
        id: 'admin-crm',
        name: 'Internal CRM & Ops',
        badge: 'Zero Seat Tax',
        icon: 'table',
        takeaway: 'Custom workflows replacing messy spreadsheets and rigid SaaS tools.',
        bestFor: 'Agencies, brokerages & ops teams',
        launchSpeed: '2–4 weeks',
        keyAdvantage: 'Unlimited staff, tailored rules'
      }
    ],
    primaryStepLabel: '1. Frontend Stack',
    primaryStepHint: 'Choose the web rendering stack that fits your product.',
    primaryOptions: [
      {
        id: 'nextjs-react-ts',
        label: 'Next.js / React + TypeScript',
        subtitle: 'SSR + API routes + Tailwind CSS'
      },
      {
        id: 'react-vite-tw',
        label: 'React + Vite + Tailwind CSS',
        subtitle: 'Fast interactive dashboards & SPAs'
      },
      {
        id: 'express-ssr-react',
        label: 'Express SSR + React Workspace',
        subtitle: 'SEO site + authenticated portal'
      }
    ],
    defaultPrimaryId: 'nextjs-react-ts',
    visualStepLabel: '2. UI Starter Template',
    visualStepHint: 'Select a layout wireframe to define your primary workspace structure.',
    visualOptions: [
      {
        id: 'web-saas',
        label: 'Multi-Tenant B2B SaaS',
        subtitle: 'Sidebar, tenant switcher & KPI cards',
        wireframeId: 'web-saas'
      },
      {
        id: 'web-agency',
        label: 'High-Converting Product Site',
        subtitle: 'Hero CTA, proof grid & lead form',
        wireframeId: 'web-agency'
      },
      {
        id: 'web-crm',
        label: 'Internal CRM & Pipeline',
        subtitle: 'Kanban stages, filters & sync status',
        wireframeId: 'web-crm'
      },
      {
        id: 'web-ecommerce',
        label: 'E-Commerce Storefront',
        subtitle: 'Filter sidebar, product grid & cart',
        wireframeId: 'web-ecommerce'
      }
    ],
    defaultVisualId: 'web-saas',
    addonStepLabel: '3. Backend, Database & Auth',
    addonStepHint: 'Select the API runtime, database, and access layer.',
    addonOptions: [
      {
        id: 'nodejs-express',
        label: 'Node.js Express API',
        subtitle: 'Typed TypeScript routes & webhooks'
      },
      {
        id: 'python-fastapi',
        label: 'Python FastAPI',
        subtitle: 'Async APIs for AI & data jobs'
      },
      {
        id: 'postgresql',
        label: 'PostgreSQL Database',
        subtitle: 'Indexed multi-tenant SQL storage'
      },
      {
        id: 'mongodb',
        label: 'MongoDB Document Store',
        subtitle: 'Flexible schemas for dynamic catalogs'
      },
      {
        id: 'rbac',
        label: 'Role-Based Auth (RBAC)',
        subtitle: 'Admin, staff & client permissions'
      }
    ],
    defaultAddonIds: ['nodejs-express', 'postgresql', 'rbac'],
    faqs: [
      {
        question: 'When should I choose a custom web app over Webflow or WordPress?',
        answer:
          'Use Webflow or static marketing tools if you only publish brochures and blog posts. Choose custom React, Next.js, or Express architecture when you need user logins, multi-tenant dashboards, custom pricing logic, API integrations, or strict Core Web Vitals control.'
      },
      {
        question: 'How do you handle multi-tenant data isolation in SaaS builds?',
        answer:
          'Every tenant record carries an explicit organization/tenant key enforced inside server middleware and database queries—not just in frontend UI filters—combined with role-based permissions and encrypted API key storage.'
      },
      {
        question: 'What is the typical timeline for a custom web platform?',
        answer:
          'Marketing/SEO storefronts ship in 1 to 2 weeks. Focused SaaS MVPs or internal CRM dashboards typically take 2 to 4 weeks for the first production-ready release.'
      },
      {
        question: 'Can you deploy on our AWS, Railway, or VPS infrastructure?',
        answer:
          'Yes. We deploy directly to your AWS, Railway, DigitalOcean, or Oracle/Ubuntu PM2 server with GitHub Actions CI/CD, environment variable templates, and zero proprietary lock-in.'
      },
      {
        question: 'Do we receive full TypeScript source code and database schemas?',
        answer:
          'Yes. You retain complete intellectual property rights, clean Git commit history, migration scripts, and deployment documentation.'
      }
    ]
  },

  '/services/ai-automation': {
    route: '/services/ai-automation',
    eyebrow: 'AI AGENTS & WORKFLOW AUTOMATION',
    title: 'Custom AI Agents, RAG & Workflow Automation',
    lead: 'Compare AI automation systems, preview deployment privacy, and scope your integrations.',
    quickAnswer:
      "Ideal for support teams, sales leaders, and regulated organizations automating repetitive workflows safely. We build cited RAG assistants, n8n pipelines, and B2B scraping agents using Python, pgvector, Qdrant, cloud LLM APIs, or private self-hosted LLMs via vLLM. Clients receive grounded chatbots, CRM webhook integrations, guardrails, and full infrastructure ownership.",
    serviceSchemaName: 'Custom AI Agents, RAG & Workflow Automation',
    serviceSchemaType: 'Artificial Intelligence Engineering',
    inquiryCategory: 'AI Bot / Model Fine-Tuning',
    guideHeading: 'Choose Your AI Automation Path',
    guideIntro: 'Pick the workflow pattern and data-privacy model that fits your team.',
    comparisons: [
      {
        id: 'rag-assistants',
        name: 'RAG Knowledge Assistants',
        badge: 'Zero Hallucination',
        icon: 'bot',
        takeaway: 'Chatbots grounded strictly in your private PDFs, SOPs, and databases.',
        bestFor: 'Support desks & internal wikis',
        launchSpeed: '1–2 weeks',
        keyAdvantage: 'Verified source citations every reply'
      },
      {
        id: 'b2b-lead-scraping',
        name: 'AI Lead & Scraping Agents',
        badge: 'Pipeline Growth',
        icon: 'radar',
        takeaway: 'Autonomous web crawlers that qualify prospects and enrich CRM records.',
        bestFor: 'Outbound sales & research teams',
        launchSpeed: '1–3 weeks',
        keyAdvantage: 'Automated ICP scoring & enrichment'
      },
      {
        id: 'n8n-workflow',
        name: 'n8n & API Automations',
        badge: 'Best for Ops',
        icon: 'workflow',
        takeaway: 'Connect email, WhatsApp, CRM, and billing without manual copy-pasting.',
        bestFor: 'Lead routing & onboarding workflows',
        launchSpeed: '1–2 weeks',
        keyAdvantage: 'No per-task Zapier markup'
      },
      {
        id: 'cloud-vs-private-llm',
        name: 'Private Self-Hosted LLMs',
        badge: 'Zero Data Leak',
        icon: 'lock',
        takeaway: 'Run open-weight AI models inside your own VPC with zero external calls.',
        bestFor: 'Healthcare, legal & NDA data',
        launchSpeed: '1–3 weeks',
        keyAdvantage: '100% air-gapped data residency'
      }
    ],
    primaryStepLabel: '1. AI Solution Type',
    primaryStepHint: 'Select the core AI capability you want deployed.',
    primaryOptions: [
      {
        id: 'rag-assistant',
        label: 'RAG Knowledge Assistant',
        subtitle: 'Cited Q&A over company docs & SQL'
      },
      {
        id: 'lead-scraping-agent',
        label: 'B2B Lead & Scraping Agent',
        subtitle: 'Extract, score & enrich prospects'
      },
      {
        id: 'n8n-automation',
        label: 'n8n / API Workflow Automation',
        subtitle: 'Cross-app webhooks & alerts'
      },
      {
        id: 'triage-voice-chat',
        label: 'Support & Lead Triage Agent',
        subtitle: 'Intent routing & draft replies'
      }
    ],
    defaultPrimaryId: 'rag-assistant',
    visualStepLabel: '2. Model Deployment Architecture',
    visualStepHint: 'Click a deployment diagram to choose how your data is processed.',
    visualOptions: [
      {
        id: 'ai-cloud',
        label: 'Cloud LLM APIs',
        subtitle: 'OpenAI / Anthropic / Gemini reasoning',
        wireframeId: 'ai-cloud'
      },
      {
        id: 'ai-private',
        label: 'Private Self-Hosted LLM',
        subtitle: 'Zero external egress · Dedicated VPC',
        wireframeId: 'ai-private'
      },
      {
        id: 'ai-hybrid',
        label: 'Hybrid PII-Redacted',
        subtitle: 'Local PII masking + cloud reasoning',
        wireframeId: 'ai-hybrid'
      }
    ],
    defaultVisualId: 'ai-cloud',
    addonStepLabel: '3. Workflow Integrations',
    addonStepHint: 'Choose which business tools connect to your AI pipeline.',
    addonOptions: [
      {
        id: 'crm-sync',
        label: 'CRM Sync (HubSpot / Pipedrive)',
        subtitle: 'Auto-log notes & deal updates'
      },
      {
        id: 'whatsapp-email',
        label: 'WhatsApp & Email Automation',
        subtitle: 'Reply drafts, alerts & SMTP send'
      },
      {
        id: 'scheduled-crawlers',
        label: 'Scheduled Web Crawlers',
        subtitle: 'Keep knowledge bases auto-updated'
      },
      {
        id: 'vector-db',
        label: 'Vector Database (pgvector / Qdrant)',
        subtitle: 'Fast hybrid semantic search'
      }
    ],
    defaultAddonIds: ['crm-sync', 'whatsapp-email', 'vector-db'],
    faqs: [
      {
        question: 'How do you stop AI agents from hallucinating wrong answers?',
        answer:
          'We combine strict RAG citation prompts, structured JSON schema outputs, confidence thresholds, and deterministic fallback rules. If the knowledge base lacks verified evidence, the agent explicitly escalates instead of guessing.'
      },
      {
        question: 'Can we run an AI assistant without sending sensitive client files to OpenAI?',
        answer:
          'Yes. We deploy open-weight models inside your private cloud VPC or on dedicated GPU servers using vLLM or Ollama so zero prompts or documents ever leave your infrastructure.'
      },
      {
        question: 'How long does an AI agent or RAG pipeline take to build?',
        answer:
          'Most scoped RAG assistants, n8n workflows, or lead-triage automations go from architecture design to staging testing within 1 to 3 weeks.'
      },
      {
        question: 'Do we control our own LLM API keys and token spend?',
        answer:
          'Yes. Everything runs on your own OpenAI, Anthropic, Gemini, or self-hosted GPU account with configurable rate limits, prompt caching, and token usage logging.'
      },
      {
        question: 'Can AI automation connect to our existing Postgres database or internal API?',
        answer:
          'Yes. We write typed tool-calling wrappers with read/write permission scopes and human-in-the-loop approval gates for sensitive database mutations.'
      }
    ]
  },

  '/services/data-intelligence': {
    route: '/services/data-intelligence',
    eyebrow: 'B2B LEAD GEN & DATA ENGINEERING',
    title: 'B2B Lead Generation & Web Data Engineering',
    lead: 'Configure verified web extraction pipelines—or test our live scraper free.',
    quickAnswer:
      'Created for outbound SDR teams, market researchers, and SaaS companies needing reliable web data. We engineer extraction pipelines using Python, FastAPI, Playwright headless Chromium, PostgreSQL, and live DNS/MX/SMTP verification. Clients receive deduplicated, bounce-checked B2B lead datasets delivered cleanly via CSV, JSON, REST APIs, Google Sheets, or CRM sync.',
    serviceSchemaName: 'B2B Lead Generation & Web Data Engineering',
    serviceSchemaType: 'Data Engineering & Web Scraping',
    inquiryCategory: 'Data Scraping & Lead Gen',
    guideHeading: '4-Stage Data Pipeline',
    guideIntro: 'Every dataset passes through crawling, cleanup, verification, and delivery.',
    comparisons: [
      {
        id: 'stage-crawl',
        name: '1. Hybrid Crawling',
        badge: 'JS + Static',
        icon: 'search',
        takeaway: 'Fast HTTP crawlers escalate to headless Chromium for dynamic JS pages.',
        bestFor: 'Directories, catalogs & profiles',
        launchSpeed: '48–72 hours dataset',
        keyAdvantage: 'Handles pagination & infinite scroll'
      },
      {
        id: 'stage-clean',
        name: '2. Clean & Deduplicate',
        badge: 'Zero Duplicates',
        icon: 'sparkles',
        takeaway: 'Normalize phones, company names, and root domains across sources.',
        bestFor: 'Multi-source master lists',
        launchSpeed: 'Automated post-crawl',
        keyAdvantage: 'Ready for instant CRM import'
      },
      {
        id: 'stage-verify',
        name: '3. MX / SMTP Verification',
        badge: 'Low Bounce',
        icon: 'mailcheck',
        takeaway: 'Live DNS MX and SMTP checks filter dead mailboxes before outreach.',
        bestFor: 'Cold outbound & SDR teams',
        launchSpeed: 'Verified pre-export',
        keyAdvantage: 'Protects sender domain health'
      },
      {
        id: 'one-time-vs-recurring',
        name: '4. One-Time vs. Live Feed',
        badge: 'Flexible Sync',
        icon: 'repeat',
        takeaway: 'Choose single campaign exports or daily/weekly automated delta feeds.',
        bestFor: 'Campaigns vs. market tracking',
        launchSpeed: '48h export · 1–2w feed',
        keyAdvantage: 'CSV, REST API, or CRM push'
      }
    ],
    primaryStepLabel: '1. Target Data Source',
    primaryStepHint: 'Select the public web format we are extracting from.',
    primaryOptions: [
      {
        id: 'directories',
        label: 'B2B Directories & Lists',
        subtitle: 'Listings + nested profile URLs'
      },
      {
        id: 'ecommerce-catalogs',
        label: 'E-Commerce & Catalogs',
        subtitle: 'SKUs, pricing & supplier contacts'
      },
      {
        id: 'public-listings',
        label: 'Property, Job & Permit Feeds',
        subtitle: 'Timestamped regional public data'
      },
      {
        id: 'multi-source',
        label: 'Multi-Source Enrichment',
        subtitle: 'Crawl + site contact + socials'
      }
    ],
    defaultPrimaryId: 'directories',
    visualStepLabel: '2. Delivery Format',
    visualStepHint: 'Pick how cleaned, verified records arrive in your workflow.',
    visualOptions: [
      {
        id: 'data-csv',
        label: 'Clean CSV / JSON / Excel',
        subtitle: 'UTF-8 verified tables ready to upload',
        wireframeId: 'data-csv'
      },
      {
        id: 'data-api',
        label: 'Live REST API & PostgreSQL',
        subtitle: 'Query structured records via JSON',
        wireframeId: 'data-api'
      },
      {
        id: 'data-crm',
        label: 'Google Sheets / CRM Sync',
        subtitle: 'Direct push to HubSpot or Sheets',
        wireframeId: 'data-crm'
      }
    ],
    defaultVisualId: 'data-csv',
    addonStepLabel: '3. Volume & Verification',
    addonStepHint: 'Select cadence, deliverability checks, and browser rendering.',
    addonOptions: [
      {
        id: 'one-time-dataset',
        label: 'One-Time Dataset (1k–25k rows)',
        subtitle: 'Delivered cleanly in 48–72 hours'
      },
      {
        id: 'recurring-feed',
        label: 'Recurring Scheduled Feed',
        subtitle: 'Daily or weekly delta updates'
      },
      {
        id: 'smtp-verification',
        label: 'Live MX / SMTP Email Check',
        subtitle: 'Filter invalid & risky inboxes'
      },
      {
        id: 'js-playwright',
        label: 'Playwright Headless Rendering',
        subtitle: 'Extract SPAs & infinite-scroll pages'
      }
    ],
    defaultAddonIds: ['one-time-dataset', 'smtp-verification'],
    liveToolCta: {
      heading: 'Try our free live web scraper before you scope',
      description:
        'Extract emails, phones, WhatsApp links, and socials to CSV, JSON, or PDF right now.',
      href: '/tools/web-data-engine',
      ctaLabel: 'Open Free AI Web Scraper'
    },
    faqs: [
      {
        question: 'What is the difference between your free Web Scraper tool and a custom pipeline?',
        answer:
          'Our free tool at /tools/web-data-engine runs live single-job crawls up to 20 pages and 25 nested profiles with instant CSV/JSON/PDF export. Custom engineering builds handle 10,000+ records, multi-source entity resolution, live SMTP email verification, scheduled cron runs, and direct CRM/PostgreSQL sync.'
      },
      {
        question: 'How fast can you deliver a custom B2B dataset?',
        answer:
          'Focused datasets for standard directories or public listings typically ship within 48 to 72 hours. Multi-source enrichment pipelines with recurring sync schedules take 1 to 2 weeks to engineer and stabilize.'
      },
      {
        question: 'How do you verify extracted email addresses?',
        answer:
          'We run syntax normalization, domain DNS MX lookups, disposable-domain filtering, and live SMTP handshake verification so bounce rates stay low before you load records into an outbound campaign.'
      },
      {
        question: 'Can you deliver data directly into HubSpot, Google Sheets, or PostgreSQL?',
        answer:
          'Yes. We support clean UTF-8 CSV/JSON exports as well as automated webhook, Google Sheets, HubSpot, Pipedrive, and PostgreSQL table synchronization.'
      },
      {
        question: 'How do you handle websites that load data via JavaScript or infinite scroll?',
        answer:
          'Our Python workers use a hybrid architecture—fast async HTTP parsing when possible, escalating automatically to Playwright headless Chromium with scroll and click orchestration for dynamic client-rendered sites.'
      }
    ]
  },

  '/services/cybersecurity': {
    route: '/services/cybersecurity',
    eyebrow: 'APPLICATION & CLOUD SECURITY',
    title: 'Web App Penetration Testing & Security Audits',
    lead: 'Compare audit methodologies, inspect tested surfaces, and scope your security review.',
    quickAnswer:
      'Built for pre-launch SaaS startups, fintech platforms, and engineering teams preparing for enterprise security reviews. We conduct manual Grey-Box and Black-Box penetration tests, OWASP Top 10 API checks, SAST code reviews, and AWS or Linux hardening. Clients receive CVSS-scored executive reports, reproducible PoC payloads, patch guides, and a free re-test.',
    serviceSchemaName: 'Web App Penetration Testing & Security Audits',
    serviceSchemaType: 'Cybersecurity & Penetration Testing',
    inquiryCategory: 'Cybersecurity & Audit',
    guideHeading: 'Choose Your Security Assessment',
    guideIntro: 'Pinpoint broken access controls, code flaws, and cloud exposure before launch.',
    comparisons: [
      {
        id: 'grey-box',
        name: 'Grey-Box Pentesting',
        badge: 'Highest Coverage',
        icon: 'shieldcheck',
        takeaway: 'Authenticated testing across user roles to catch deep RBAC and IDOR bugs.',
        bestFor: 'SaaS platforms & multi-role APIs',
        launchSpeed: '5–10 business days',
        keyAdvantage: 'Finds tenant & privilege bypasses'
      },
      {
        id: 'black-box',
        name: 'Black-Box & OWASP Top 10',
        badge: 'External Attack View',
        icon: 'shield',
        takeaway: 'Zero-knowledge testing simulating external attackers hitting public endpoints.',
        bestFor: 'Public web apps & login surfaces',
        launchSpeed: '5–7 business days',
        keyAdvantage: 'Real exploit proof, zero scanner noise'
      },
      {
        id: 'sast-review',
        name: 'Source Code Audit (SAST)',
        badge: 'Line-by-Line',
        icon: 'filecode',
        takeaway: 'Manual review of auth middleware, SQL queries, secrets, and dependencies.',
        bestFor: 'Investor diligence & pre-release',
        launchSpeed: '3–7 business days',
        keyAdvantage: 'Exact file/line patch guidance'
      },
      {
        id: 'cloud-hardening',
        name: 'Cloud & Server Hardening',
        badge: 'Full Audit',
        icon: 'server',
        takeaway: 'Lock down SSH, IAM policies, Nginx TLS headers, and database ports.',
        bestFor: 'AWS, Oracle VM & Railway apps',
        launchSpeed: '2–5 business days',
        keyAdvantage: 'Closes exposed ports & misconfigs'
      }
    ],
    primaryStepLabel: '1. Audit Scope',
    primaryStepHint: 'Select the depth of manual testing and repository review.',
    primaryOptions: [
      {
        id: 'grey-box-pentest',
        label: 'Grey-Box Web & API Pentest',
        subtitle: 'Multi-role auth + OWASP Top 10'
      },
      {
        id: 'black-box-pentest',
        label: 'Black-Box External Pentest',
        subtitle: 'Unauthenticated surface testing'
      },
      {
        id: 'sast-code-audit',
        label: 'Source Code Review (SAST)',
        subtitle: 'Auth, SQL, secrets & dependencies'
      },
      {
        id: 'full-stack-audit',
        label: 'Full-Stack Pentest + Hardening',
        subtitle: 'Grey-Box + SAST + cloud lockdown'
      }
    ],
    defaultPrimaryId: 'grey-box-pentest',
    visualStepLabel: '2. Target Environment',
    visualStepHint: 'Click an environment to inspect the security checkpoints covered.',
    visualOptions: [
      {
        id: 'sec-webapp',
        label: 'Web App (SaaS / Portal)',
        subtitle: 'Sessions, RBAC, XSS & tenant isolation',
        wireframeId: 'sec-webapp'
      },
      {
        id: 'sec-api',
        label: 'REST / GraphQL API',
        subtitle: 'BOLA/IDOR, JWT & webhook checks',
        wireframeId: 'sec-api'
      },
      {
        id: 'sec-cloud',
        label: 'Cloud Server & VPC',
        subtitle: 'Ports, SSH, IAM & Nginx TLS',
        wireframeId: 'sec-cloud'
      }
    ],
    defaultVisualId: 'sec-webapp',
    addonStepLabel: '3. Audit Deliverables',
    addonStepHint: 'Choose the reports and verification re-testing included.',
    addonOptions: [
      {
        id: 'executive-report',
        label: 'Executive Risk Summary',
        subtitle: 'CVSS severity report for buyers & leadership'
      },
      {
        id: 'poc-findings',
        label: 'Reproducible PoC Findings',
        subtitle: 'Step-by-step HTTP payloads & screenshots'
      },
      {
        id: 'remediation-retest',
        label: 'Patch Guide + Free 30-Day Re-Test',
        subtitle: 'Code fixes + verification attestation'
      }
    ],
    defaultAddonIds: ['executive-report', 'poc-findings', 'remediation-retest'],
    faqs: [
      {
        question: 'What is the difference between an automated vulnerability scan and your penetration test?',
        answer:
          'Automated scanners only catch known surface signatures and generate noisy false positives. We combine targeted tooling with manual business-logic testing—probing multi-tenant access controls, privilege escalation, payment/webhook tampering, and chained exploits.'
      },
      {
        question: 'Should we run the penetration test on staging or production?',
        answer:
          'We strongly recommend testing against a dedicated staging environment that mirrors production architecture and sample data. This allows thorough fuzzing and boundary testing without affecting live customer traffic.'
      },
      {
        question: 'Do we get a free re-test after fixing the reported vulnerabilities?',
        answer:
          'Yes. When Remediation Guide + Free Re-Test is included in your scope, once your engineers patch the findings within 30 days, we re-verify every fix and issue an updated clean attestation report.'
      },
      {
        question: 'How long does a web application security audit take?',
        answer:
          'Focused API or single-app audits typically complete within 5 to 7 business days. Combined Grey-Box pentests, source code reviews, and cloud server hardening take 7 to 12 business days depending on endpoint count.'
      },
      {
        question: 'Can you sign a mutual NDA before accessing our staging app or repository?',
        answer:
          'Yes. Mutual NDAs and explicit Rules of Engagement (RoE) authorization documents are executed before any testing or repository access begins.'
      }
    ]
  }
};

export function buildServiceRouteJsonLd(
  route: ServiceStorefrontRoute
): Record<string, unknown>[] {
  const config = SERVICE_STOREFRONT_CONFIGS[route];
  const seo = ROUTE_SEO[route];

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: config.serviceSchemaName,
      serviceType: config.serviceSchemaType,
      url: seo.canonical,
      description: seo.description,
      provider: {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: STUDIO_BRAND.name,
        url: `${SITE_ORIGIN}/`,
        email: STUDIO_BRAND.emailPrimary
      },
      areaServed: ['US', 'GB', 'AE', 'EU', 'Worldwide']
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: config.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer
        }
      }))
    }
  ];
}
