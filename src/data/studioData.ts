export type PublicRoutePath =
  | '/'
  | '/services'
  | '/services/app-development'
  | '/services/web-development'
  | '/services/ai-automation'
  | '/services/data-intelligence'
  | '/services/cybersecurity'
  | '/products'
  | '/tools/web-data-engine'
  | '/work'
  | '/about'
  | '/contact'
  | '/privacy'
  | '/terms';

export const PUBLIC_ROUTES: PublicRoutePath[] = [
  '/',
  '/services',
  '/services/app-development',
  '/services/web-development',
  '/services/ai-automation',
  '/services/data-intelligence',
  '/services/cybersecurity',
  '/products',
  '/tools/web-data-engine',
  '/work',
  '/about',
  '/contact',
  '/privacy',
  '/terms'
];

export const NOINDEX_APP_PREFIXES = [
  '/docs',
  '/login',
  '/signup',
  '/app',
  '/workspace',
  '/portal'
];

export interface RouteSeoConfig {
  title: string;
  description: string;
  canonical: string;
}

export const SITE_ORIGIN = 'https://almnexus.tech';

export const ROUTE_SEO: Record<PublicRoutePath, RouteSeoConfig> = {
  '/': {
    title: 'ALM Nexus — AI, Web & Mobile Software Engineering Agency',
    description:
      'Custom web platforms, iOS & Android mobile apps, AI automation agents, and B2B lead data pipelines built for ambitious companies worldwide.',
    canonical: `${SITE_ORIGIN}/`
  },
  '/services': {
    title: 'Services | ALM Nexus',
    description:
      'Custom web and mobile apps, Unity game development, AI engineering and fine-tuning, Python data scraping pipelines, and security audits.',
    canonical: `${SITE_ORIGIN}/services`
  },
  '/services/app-development': {
    title: 'Custom Mobile App Development | ALM Nexus',
    description:
      'Compare Flutter, React Native, Swift, Kotlin, and Expo. Configure your mobile UI template, backend stack, and request a build proposal.',
    canonical: `${SITE_ORIGIN}/services/app-development`
  },
  '/services/web-development': {
    title: 'Custom Web & SaaS Development | ALM Nexus',
    description:
      'Compare marketing websites, SPAs, multi-tenant SaaS, and admin portals. Configure your frontend stack, UI template, database, and scope.',
    canonical: `${SITE_ORIGIN}/services/web-development`
  },
  '/services/ai-automation': {
    title: 'AI Agents, RAG & Workflow Automation | ALM Nexus',
    description:
      'Compare RAG assistants, B2B scraping agents, n8n workflows, and cloud vs. private LLMs. Configure your AI blueprint and request a proposal.',
    canonical: `${SITE_ORIGIN}/services/ai-automation`
  },
  '/services/data-intelligence': {
    title: 'B2B Lead Gen & Web Data Engineering | ALM Nexus',
    description:
      'Targeted crawling, deduplication, SMTP verification, and CRM exports. Configure your data pipeline or test our free web scraper tool.',
    canonical: `${SITE_ORIGIN}/services/data-intelligence`
  },
  '/services/cybersecurity': {
    title: 'Web App Pentesting & Security Audits | ALM Nexus',
    description:
      'Compare Black-Box vs. Grey-Box pentesting, OWASP Top 10 testing, SAST code reviews, and cloud hardening. Configure your security audit scope.',
    canonical: `${SITE_ORIGIN}/services/cybersecurity`
  },
  '/products': {
    title: 'NexusFlow and Products | ALM Nexus',
    description:
      'NexusFlow multi-tenant operations platform for agencies and B2B teams, plus internal engineering tools from ALM Nexus.',
    canonical: `${SITE_ORIGIN}/products`
  },
  '/tools/web-data-engine': {
    title: 'Free AI Web Scraper & Lead Extractor | ALM Nexus',
    description:
      'Free online web scraper and lead extractor. Extract business emails, phone numbers, WhatsApp links, social profiles, and structured data to CSV, JSON, or PDF.',
    canonical: `${SITE_ORIGIN}/tools/web-data-engine`
  },
  '/work': {
    title: 'Work and Case Studies | ALM Nexus',
    description:
      'Engineering case studies across NexusFlow, Python data extraction, Unity game prototyping, and AI triage workflows.',
    canonical: `${SITE_ORIGIN}/work`
  },
  '/about': {
    title: 'About | ALM Nexus',
    description:
      'ALM Nexus is a custom software engineering and AI automation agency founded by Abdul Ahad Rana, serving clients in the US, UK, UAE and EU.',
    canonical: `${SITE_ORIGIN}/about`
  },
  '/contact': {
    title: 'Start a Project | ALM Nexus',
    description:
      'Tell ALM Nexus what you want built across apps, Unity games, AI agents, data pipelines, or NexusFlow. Reply in 1-2 business days.',
    canonical: `${SITE_ORIGIN}/contact`
  },
  '/privacy': {
    title: 'Privacy Policy | ALM Nexus',
    description:
      'Privacy Policy and data handling practices for ALM Nexus client engagements and the NexusFlow workspace.',
    canonical: `${SITE_ORIGIN}/privacy`
  },
  '/terms': {
    title: 'Terms of Service | ALM Nexus',
    description:
      'Terms of Service governing custom software engagements and NexusFlow usage with ALM Nexus.',
    canonical: `${SITE_ORIGIN}/terms`
  }
};

export const STUDIO_BRAND = {
  name: 'ALM Nexus',
  domain: 'almnexus.tech',
  logoPath: '/assets/aistudio/1771048398683_15e1bf38.jpg',
  emailPrimary: 'contact@almnexus.tech',
  emailDirect: 'ahad@almnexus.tech',
  // EDITABLE: Update phoneDisplay and phoneHref with your direct WhatsApp / sales line
  phoneDisplay: '+92 300 000 0000',
  phoneHref: 'tel:+923000000000',
  locationRemote: 'Pakistan-based, working remotely with clients in the US, UK, UAE and EU.',
  contactAvailability: 'Pakistan-based, available remotely for clients in the US, UK, UAE and EU',
  oneLineSummary:
    'Custom software engineering and AI automation agency working remotely worldwide.',
  founderBio:
    'ALM Nexus is a custom software engineering and AI automation agency founded by Abdul Ahad Rana, based in Pakistan and working remotely with clients across the US, UK, UAE, and EU. Abdul leads delivery across Web & SaaS Platforms, iOS & Android Mobile Apps, AI Agents & Automation, B2B Data Pipelines, and Security Audits.'
};

export interface NavItem {
  label: string;
  href: PublicRoutePath;
}

export interface ServiceSubNavItem {
  label: string;
  shortDesc: string;
  href:
    | '/services/app-development'
    | '/services/web-development'
    | '/services/ai-automation'
    | '/services/data-intelligence'
    | '/services/cybersecurity';
}

export const SERVICE_SUBNAV_ITEMS: ServiceSubNavItem[] = [
  {
    label: 'Mobile App Development',
    shortDesc: 'Flutter, React Native, Swift, Kotlin & Expo',
    href: '/services/app-development'
  },
  {
    label: 'Web & SaaS Platforms',
    shortDesc: 'Next.js, React, SaaS portals & CRMs',
    href: '/services/web-development'
  },
  {
    label: 'AI Agents & Automation',
    shortDesc: 'RAG, n8n workflows, cloud & private LLMs',
    href: '/services/ai-automation'
  },
  {
    label: 'Data & Lead Engineering',
    shortDesc: 'Crawling, deduplication & SMTP verification',
    href: '/services/data-intelligence'
  },
  {
    label: 'Cybersecurity & Audits',
    shortDesc: 'Pentesting, OWASP Top 10 & SAST reviews',
    href: '/services/cybersecurity'
  }
];

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: 'Services', href: '/services' },
  { label: 'Products', href: '/products' },
  { label: 'Web Scraper', href: '/tools/web-data-engine' },
  { label: 'Work', href: '/work' },
  { label: 'About', href: '/about' }
];

export interface HeaderNavItem {
  label: string;
  href: string;
  matchPath?: string;
}

export const HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { label: 'Services', href: '/services', matchPath: '/services' },
  { label: 'Solutions', href: '/#solutions' },
  { label: 'Products', href: '/products', matchPath: '/products' },
  { label: 'Tech Stack', href: '/#tech-stack' },
  { label: 'Case Studies', href: '/work', matchPath: '/work' },
  { label: 'Insights', href: '/#insights' },
  { label: 'About', href: '/about', matchPath: '/about' },
  { label: 'Pricing', href: '/#pricing' }
];

export const HERO_ROTATING_WORDS = [
  'Startups',
  'SaaS Founders',
  'Agencies',
  'Enterprises'
] as const;

export type AgencyServiceIconKey =
  | 'bot'
  | 'globe'
  | 'cloud'
  | 'layers'
  | 'database'
  | 'shield'
  | 'rocket'
  | 'smartphone'
  | 'gamepad';

export interface QuickServiceStripItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: AgencyServiceIconKey;
}

export const QUICK_SERVICE_STRIP: QuickServiceStripItem[] = [
  {
    id: 'ai-agents',
    title: 'AI Agents & Automation',
    subtitle: 'RAG, n8n & voice bots',
    href: '/services/ai-automation',
    icon: 'bot'
  },
  {
    id: 'web-mobile',
    title: 'Web & Mobile Apps',
    subtitle: 'Next.js, Flutter & React Native',
    href: '/services/web-development',
    icon: 'globe'
  },
  {
    id: 'devops-cloud',
    title: 'DevOps & Cloud',
    subtitle: 'CI/CD, Terraform & K8s',
    href: '/services/web-development',
    icon: 'cloud'
  },
  {
    id: 'enterprise-software',
    title: 'Custom Enterprise Software',
    subtitle: 'High-throughput backends',
    href: '/services/web-development',
    icon: 'layers'
  },
  {
    id: 'data-pipelines',
    title: 'Data & Lead Pipelines',
    subtitle: 'Python ETL & SMTP checks',
    href: '/services/data-intelligence',
    icon: 'database'
  },
  {
    id: 'cybersecurity',
    title: 'Cybersecurity & Audits',
    subtitle: 'Pentesting & OWASP hardening',
    href: '/services/cybersecurity',
    icon: 'shield'
  }
];

export interface HomepageStatItem {
  id: string;
  displayValue: string;
  targetNumber: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  secondaryNumber?: number;
  separator?: string;
  label: string;
  detail: string;
}

// ============================================================================
// EDITABLE PLACEHOLDER STATS:
// Update targetNumber / displayValue / suffix / label / detail anytime to match
// your current production milestones without touching component logic.
// ============================================================================
export const HOMEPAGE_STATS: HomepageStatItem[] = [
  {
    id: 'shipped-systems',
    displayValue: '50+',
    targetNumber: 50,
    suffix: '+',
    label: 'Production Builds',
    detail: 'Web platforms, mobile apps, AI agents & data tools'
  },
  {
    id: 'uptime-sla',
    displayValue: '99.9%',
    targetNumber: 99.9,
    decimals: 1,
    suffix: '%',
    label: 'Uptime Architecture',
    detail: 'Automated CI/CD, health probes & cloud failover'
  },
  {
    id: 'monitoring-coverage',
    displayValue: '24/7',
    targetNumber: 24,
    separator: '/',
    secondaryNumber: 7,
    label: 'Pipeline Monitoring',
    detail: 'Continuous scraper queues, webhooks & alerting'
  },
  {
    id: 'code-ownership',
    displayValue: '100%',
    targetNumber: 100,
    suffix: '%',
    label: 'IP & Code Ownership',
    detail: 'Direct Git repository transfer with zero lock-in'
  }
];

export interface WhatWeBuildCard {
  id: string;
  title: string;
  description: string;
  bullets: [string, string, string, string];
  href: string;
  icon: AgencyServiceIconKey;
}

export const WHAT_WE_BUILD_SERVICES: WhatWeBuildCard[] = [
  {
    id: 'ai-agents',
    title: 'AI Agents & Automation',
    description: 'Autonomous task execution grounded in your private knowledge.',
    bullets: [
      'Custom AI agents & multi-agent orchestration',
      'LLM integration & structured prompt engineering',
      'Cited RAG pipelines & vector knowledge bases',
      'Model fine-tuning, voice/chat agents, n8n & Python'
    ],
    href: '/services/ai-automation',
    icon: 'bot'
  },
  {
    id: 'product-mvp',
    title: 'Product Development / MVP',
    description: 'Go from technical spec to a testable v1 build in tight sprints.',
    bullets: [
      'Interactive architecture prototyping & scoping',
      'Production MVP delivery in 2–4 week sprints',
      'Typed REST/GraphQL API & microservices design',
      'Relational database modeling & query optimization'
    ],
    href: '/services/web-development',
    icon: 'rocket'
  },
  {
    id: 'web-saas',
    title: 'Web & SaaS Platforms',
    description: 'Multi-tenant subscription products built for daily team workflows.',
    bullets: [
      'React, Next.js & TypeScript interfaces',
      'Node.js Express & Python FastAPI backends',
      'Multi-tenant PostgreSQL isolation & RBAC auth',
      'Automated AWS, Railway & Oracle VM deployment'
    ],
    href: '/services/web-development',
    icon: 'globe'
  },
  {
    id: 'mobile-apps',
    title: 'Mobile Apps',
    description: 'Smooth iOS and Android applications engineered from one core spec.',
    bullets: [
      'Cross-platform iOS & Android (React Native & Flutter)',
      'Native SwiftUI & Kotlin modules for hardware access',
      '60fps UI polish, offline cache & push alerts',
      'Full App Store & Google Play submission support'
    ],
    href: '/services/app-development',
    icon: 'smartphone'
  },
  {
    id: 'devops-cloud',
    title: 'DevOps & Cloud',
    description: 'Zero-downtime deployment infrastructure you own end to end.',
    bullets: [
      'Kubernetes cluster setup & container orchestration',
      'GitHub Actions CI/CD release automation',
      'Infrastructure as Code with Terraform modules',
      'Prometheus telemetry, logging & uptime alerting'
    ],
    href: '/services/web-development',
    icon: 'cloud'
  },
  {
    id: 'enterprise-software',
    title: 'Custom Enterprise Software',
    description: 'Internal operations portals replacing disconnected spreadsheets.',
    bullets: [
      'Tailored B2B enterprise workflows & audit logs',
      'Legacy system modernization & zero-loss migration',
      'High-throughput event workers & async queues',
      'Bi-directional CRM, ERP & payment API integrations'
    ],
    href: '/services/web-development',
    icon: 'layers'
  },
  {
    id: 'data-pipelines',
    title: 'Data & Lead Pipelines',
    description: 'Clean, verified web extraction engineered for outbound growth.',
    bullets: [
      'Hybrid Python HTTP & Playwright headless crawlers',
      'Live DNS MX & SMTP mailbox verification checks',
      'Entity deduplication & domain enrichment',
      'Automated ETL exports to CSV, Postgres or CRM'
    ],
    href: '/services/data-intelligence',
    icon: 'database'
  },
  {
    id: 'cybersecurity',
    title: 'Cybersecurity & Audits',
    description: 'Uncover broken access controls and logic flaws before attackers do.',
    bullets: [
      'Manual Grey-Box & Black-Box web/API pentesting',
      'OWASP Top 10 & tenant RBAC vulnerability checks',
      'Server, Nginx TLS & cloud IAM hardening',
      'Executive CVSS reports + 30-day patch re-test'
    ],
    href: '/services/cybersecurity',
    icon: 'shield'
  },
  {
    id: 'game-development',
    title: 'Game Development',
    description: 'Playable 2D and 3D worlds built with clean C# state systems.',
    bullets: [
      'Unity 2D & 3D gameplay architecture in C#',
      'Custom physics, collision & AI pathing systems',
      'Deterministic game-state & checkpoint tooling',
      'Cross-platform desktop, WebGL & mobile builds'
    ],
    href: '/services#games',
    icon: 'gamepad'
  }
];

export interface TechStackCategory {
  category: string;
  items: string[];
}

export const HOMEPAGE_TECH_STACK: TechStackCategory[] = [
  {
    category: 'AI & Orchestration',
    items: ['Python', 'OpenAI / Anthropic / Gemini', 'vLLM / Ollama', 'pgvector', 'Qdrant', 'n8n']
  },
  {
    category: 'Web & Mobile',
    items: ['React', 'Next.js', 'TypeScript', 'Flutter', 'React Native', 'Tailwind CSS']
  },
  {
    category: 'Backend & Data',
    items: ['Node.js', 'FastAPI', 'PostgreSQL', 'Redis', 'Playwright', 'Unity / C#']
  },
  {
    category: 'Cloud & Security',
    items: ['AWS', 'Kubernetes', 'Terraform', 'Docker', 'GitHub Actions', 'OWASP SAST']
  }
];

export interface HomepageProcessStep {
  number: string;
  title: string;
  summary: string;
  deliverable: string;
}

export const HOMEPAGE_PROCESS_STEPS: HomepageProcessStep[] = [
  {
    number: '01',
    title: 'Discovery',
    summary: 'Audit workflows, define schema boundaries, and align on architecture before code.',
    deliverable: 'Technical spec & milestone map'
  },
  {
    number: '02',
    title: 'Design',
    summary: 'Prototype core user flows, API contracts, and tenant permissions with zero guesswork.',
    deliverable: 'UI wireframes & data contract'
  },
  {
    number: '03',
    title: 'Build',
    summary: 'Weekly staging releases you can open and test directly, backed by automated checks.',
    deliverable: 'Interactive staging builds'
  },
  {
    number: '04',
    title: 'Launch',
    summary: 'Deploy to your cloud, harden endpoints, and transfer full Git repo & code ownership.',
    deliverable: 'Full Git repo, docs & IP handoff'
  }
];

export interface HomepageInsightItem {
  category: string;
  title: string;
  summary: string;
  href: string;
  ctaLabel: string;
}

export const HOMEPAGE_INSIGHTS: HomepageInsightItem[] = [
  {
    category: 'AI Architecture',
    title: 'Eliminating RAG hallucinations with deterministic JSON routing',
    summary: 'How strict citation prompts and SQL fallback guardrails keep enterprise bots factual.',
    href: '/services/ai-automation',
    ctaLabel: 'Explore AI systems'
  },
  {
    category: 'Data Engineering',
    title: 'Hybrid HTTP + Playwright crawling under strict memory budgets',
    summary: 'Test our production Python FastAPI extractor live on public URLs with instant export.',
    href: '/tools/web-data-engine',
    ctaLabel: 'Launch Web Scraper'
  },
  {
    category: 'Platform Engineering',
    title: 'Multi-tenant RBAC and encrypted BYOK vaults inside NexusFlow',
    summary: 'Inside the architecture of our client operations, pipeline, and Resend outreach suite.',
    href: '/work',
    ctaLabel: 'Read case studies'
  }
];

export interface HomepagePricingTier {
  id: string;
  name: string;
  cadence: string;
  summary: string;
  highlights: string[];
  featured?: boolean;
}

export const HOMEPAGE_PRICING_MODELS: HomepagePricingTier[] = [
  {
    id: 'mvp-sprint',
    name: 'Fixed-Scope MVP Sprint',
    cadence: '2–4 Week Delivery',
    summary: 'Scoped build for founders launching a focused web, mobile, or AI product.',
    highlights: [
      'Defined feature milestones & fixed budget',
      'Weekly clickable staging deployments',
      '100% Git repository & cloud handoff'
    ]
  },
  {
    id: 'dedicated-pod',
    name: 'Dedicated Engineering Pod',
    cadence: 'Monthly Retainer',
    summary: 'Embedded full-stack, AI, and DevOps velocity for scaling SaaS teams.',
    highlights: [
      'Direct Slack & sprint sync with senior engineers',
      'Continuous CI/CD, API & database scaling',
      'Flexible backlog priority every 2 weeks'
    ],
    featured: true
  },
  {
    id: 'audit-pipeline',
    name: 'Audit or Data Pipeline',
    cadence: '5–10 Business Days',
    summary: 'Targeted OWASP pentesting or verified B2B scraping & enrichment delivery.',
    highlights: [
      'CVSS risk report & PoC findings or clean CSV/API',
      'Live DNS/MX/SMTP verification or 30-day re-test',
      'Mutual NDA & clear Rules of Engagement'
    ]
  }
];

export interface HomeCapability {
  id: string;
  title: string;
  summary: string;
  href: string;
}

export const HOME_CAPABILITIES: HomeCapability[] = [
  {
    id: 'web-mobile',
    title: 'Web & Mobile Applications',
    summary: 'React, Next.js, React Native, Node.js, PostgreSQL, AWS',
    href: '/services#web-mobile'
  },
  {
    id: 'games',
    title: 'Game Development',
    summary: 'Unity, C#, 2D and 3D, cross-platform',
    href: '/services#games'
  },
  {
    id: 'ai',
    title: 'AI Agents & Fine-Tuning',
    summary: 'LLM fine-tuning, RAG, voice and chat agents, n8n and Python automation',
    href: '/services#ai'
  },
  {
    id: 'data',
    title: 'Data & Lead Pipelines',
    summary: 'Python scraping, SMTP-verified B2B datasets, outbound infrastructure',
    href: '/services#data'
  }
];

export interface ShippingStep {
  title: string;
  description: string;
}

export const SHIPPING_STEPS: ShippingStep[] = [
  {
    title: 'Scope and architecture',
    description:
      'We agree on what gets built, the data model, and the stack before any code.'
  },
  {
    title: 'Sprint build',
    description:
      'Short cycles with working builds you can open and click, not slide decks.'
  },
  {
    title: 'Deploy and handoff',
    description:
      'We ship to your infrastructure, document it, and hand over the repo and credentials.'
  }
];

export interface ServiceDetail {
  id: 'web-mobile' | 'games' | 'ai' | 'data';
  title: string;
  description: string;
  deliverables: string[];
  stack: string;
  timeline: string;
}

export const SERVICES_LIST: ServiceDetail[] = [
  {
    id: 'web-mobile',
    title: 'Web & Mobile Applications',
    description:
      'We build production web applications, internal client portals, and cross-platform mobile apps with typed backends, relational schemas, and clean deployment pipelines.',
    deliverables: [
      'Working MVP',
      'Auth and roles',
      'Admin panel',
      'Deployed on AWS or Vercel',
      'Source handed over'
    ],
    stack: 'React, Next.js, React Native, Node.js, TypeScript, PostgreSQL, AWS',
    timeline: 'Typical MVP in 2–4 weeks depending on scope.'
  },
  {
    id: 'games',
    title: 'Game Development',
    description:
      'We build 2D and 3D Unity games from playable mechanics prototypes through structured game-state systems, physics tuning, and target platform builds.',
    deliverables: [
      'Playable prototype',
      'Core mechanics and physics',
      'State management',
      'Build for target platforms'
    ],
    stack: 'Unity, C#',
    timeline: 'Typical playable prototype in 2–4 weeks; full builds scoped per milestone.'
  },
  {
    id: 'ai',
    title: 'AI Engineering & Fine-Tuning',
    description:
      'We train task-specific models, build retrieval pipelines over private documentation, and wire automated chat, voice, and CRM triage workflows into existing tools.',
    deliverables: [
      'LLM fine-tuning',
      'RAG over your documents',
      'Chat or voice agents',
      'Workflow automation with webhooks and CRM sync'
    ],
    stack: 'Python, OpenAI/Anthropic/open-source models, n8n, vector databases',
    timeline: 'Typical agent or RAG pipeline in 1–3 weeks.'
  },
  {
    id: 'data',
    title: 'Data Scraping & Lead Generation',
    description:
      'We write custom Python scrapers, normalize and deduplicate company records, run live MX and SMTP mailbox checks, and configure outbound sending domains.',
    deliverables: [
      'Custom scrapers',
      'Deduplicated and entity-resolved datasets',
      'Live MX/SMTP email verification',
      'Outbound setup'
    ],
    stack: 'Python, PostgreSQL, SMTP validation',
    timeline: 'Small datasets in 48–72 hours; recurring pipelines scoped per project.'
  }
];

export interface NexusFlowTabItem {
  id: 'client-portals' | 'rbac' | 'outreach' | 'deal-pipeline' | 'api-vault';
  label: string;
  body: string;
}

export const NEXUSFLOW_TABS: NexusFlowTabItem[] = [
  {
    id: 'client-portals',
    label: 'Client portals',
    body: 'Each client organization gets an isolated workspace to view project milestones, review delivered datasets or builds, and exchange files without shared spreadsheets or scattered email threads.'
  },
  {
    id: 'rbac',
    label: 'Role-based access',
    body: 'Company admins assign permissions per department and team member. Sales, research, and delivery staff only see the modules, records, and client accounts allocated to their role.'
  },
  {
    id: 'outreach',
    label: 'Outreach',
    body: 'Connect verified business domains through Resend or custom SMTP to schedule multi-step sequences, manage warm-up ramps, and handle prospect replies inside a unified inbox.'
  },
  {
    id: 'deal-pipeline',
    label: 'Deal pipeline',
    body: 'Track inbound and outbound prospects from initial contact through qualification, proposal, and closed delivery stages inside one structured pipeline board.'
  },
  {
    id: 'api-vault',
    label: 'API key vault',
    body: 'Store tenant-scoped Resend, OpenAI, Apollo, Hunter, or Stripe keys per workspace so agencies and client teams run their own provider accounts without mixing credentials.'
  }
];

export interface RdProduct {
  id: string;
  status: 'Internal engineering tool';
  title: string;
  summary: string;
  stack: string;
}

export const RD_PRODUCTS: RdProduct[] = [
  {
    id: 'ai-developer-tool',
    status: 'Internal engineering tool',
    title: 'AI developer tool',
    summary:
      'Internal CLI and repository indexing utility for running structured code reviews and schema checks on client handoffs.',
    stack: 'TypeScript, Python, CLI'
  },
  {
    id: 'data-verification-worker',
    status: 'Internal engineering tool',
    title: 'Verification & scraping worker',
    summary:
      'Lightweight queue worker for scheduling recurring MX/SMTP mailbox checks and exporting deduplicated CSV or PostgreSQL tables.',
    stack: 'Python, PostgreSQL, SMTP'
  },
  {
    id: 'unity-telemetry-kit',
    status: 'Internal engineering tool',
    title: 'Unity build & state inspector',
    summary:
      'Editor tooling package for logging deterministic physics ticks, state transitions, and input replays during Unity playtesting.',
    stack: 'Unity, C#'
  }
];

export type CaseStudyStatus = 'Production' | 'Prototype' | 'Internal build';

export interface WorkCaseStudy {
  id: string;
  title: string;
  status: CaseStudyStatus;
  summary: string;
  problem: string;
  built: string[];
  stack: string;
}

export const WORK_CASE_STUDIES: WorkCaseStudy[] = [
  {
    id: 'nexusflow-platform',
    title: 'NexusFlow — Multi-Tenant Client Portal & Outbound Engine',
    status: 'Internal build',
    summary:
      'Built and deployed in production on AWS with React, TypeScript, Node.js, PostgreSQL, role-based access per department, encrypted BYOK API key vault, and Resend email dispatch.',
    problem:
      'Running client delivery, lead lists, and outbound email across separate spreadsheets and third-party tools made multi-client access control error-prone.',
    built: [
      'Company-scoped workspaces with department role permissions',
      'Multi-step outbound email scheduler backed by Resend and SMTP mailboxes',
      'Structured deal pipeline stages and shared team inbox',
      'Encrypted tenant-isolated BYOK API key vault and signed webhook ingestion'
    ],
    stack: 'React, TypeScript, Node.js, PostgreSQL, AWS, Resend'
  },
  {
    id: 'real-estate-b2b-pipeline',
    title: 'Real Estate & B2B Data Extraction Pipeline',
    status: 'Production',
    summary:
      'Automated Python scrapers with entity resolution, deduplication, and live DNS/MX/SMTP handshake verification to deliver clean B2B and off-market property datasets.',
    problem:
      'Analysts were copying property records and corporate officer contacts manually across disconnected directories with high duplicate and bounce rates.',
    built: [
      'Scheduled Python extractors targeting public commercial and corporate sources',
      'Entity-resolution pass to merge duplicate companies and normalize fields',
      'Syntax, DNS MX, and live SMTP handshake verification before export',
      'PostgreSQL storage layer with clean CSV and webhook delivery'
    ],
    stack: 'Python, Entity Resolution, DNS/MX/SMTP Validation, PostgreSQL'
  },
  {
    id: 'unity-3d-puzzle-action',
    title: '3D Puzzle-Action Game Prototype',
    status: 'Prototype',
    summary:
      'Built in Unity with C#, featuring custom physics interactions, state machine architecture, and modular level progression.',
    problem:
      'Validating spatial puzzle mechanics, responsive character movement, and deterministic level state transitions before full asset production.',
    built: [
      'Custom C# character controller and rigidbody interaction physics',
      'State machine architecture supporting resettable room checkpoints',
      'Modular level progression and camera framing for third-person puzzle rooms',
      'Cross-platform playable build targets configured in Unity'
    ],
    stack: 'Unity, C#'
  },
  {
    id: 'ai-triage-automation',
    title: 'AI Workflow & Customer Triage Automation',
    status: 'Production',
    summary:
      'Automated inbound lead classification and CRM routing using LLM intent extraction, Python, and webhook pipelines.',
    problem:
      'Incoming prospect replies and support requests landed in one mailbox without intent tagging, routing rules, or automatic CRM updates.',
    built: [
      'Structured LLM intent extraction layer for inbound email and webhook events',
      'Deterministic routing rules splitting positive replies, opt-outs, and support tickets',
      'Signed webhook workers updating CRM deal stages and team notifications',
      'Fallback rules for low-confidence classifications requiring human review'
    ],
    stack: 'Python, LLM Intent Extraction, Webhooks, CRM Sync'
  }
];

export const INQUIRY_CATEGORIES = [
  'Web / Mobile App',
  'Unity Game Development',
  'AI Bot / Model Fine-Tuning',
  'Data Scraping & Lead Gen',
  'Cybersecurity & Audit',
  'NexusFlow SaaS'
] as const;

export type InquiryCategory = (typeof INQUIRY_CATEGORIES)[number];

export const BUDGET_RANGES = [
  'Under $5,000',
  '$5,000 - $15,000',
  '$15,000 - $35,000',
  '$35,000+',
  'Scope first / Not sure yet'
] as const;

export interface SocialChannel {
  name: string;
  href: string;
}

export const SOCIAL_CHANNELS: SocialChannel[] = [
  { name: 'LinkedIn', href: 'https://www.linkedin.com/company/almnexus/' },
  { name: 'Instagram', href: 'https://www.instagram.com/almnexus/' },
  { name: 'Facebook', href: 'https://www.facebook.com/share/1CPfabuMZf/' },
  { name: 'X', href: 'https://x.com/almnexus50408' },
  { name: 'GitHub', href: 'https://github.com/ARtechahad' }
];

export interface WebScraperFaqItem {
  question: string;
  answer: string;
}

export const WEB_SCRAPER_FAQS: WebScraperFaqItem[] = [
  {
    question: 'Is the ALM Nexus AI Web Scraper & Lead Extractor free to use?',
    answer:
      'Yes. You can inspect public URLs, run multi-page and directory-profile crawls up to 20 pages and 25 profiles per job, and export results to CSV, JSON, or PDF at no cost.'
  },
  {
    question: 'How does the tool handle JavaScript-rendered websites?',
    answer:
      'The crawler uses a hybrid engine. It starts with lightweight HTTP parsing for fast static pages and automatically switches to headless Chromium browser rendering with scroll execution when dynamic JavaScript content is detected.'
  },
  {
    question: 'What types of contacts and structured data can I extract?',
    answer:
      'You can extract business emails, personal emails, phone numbers, WhatsApp links, social media profiles (LinkedIn, X, Instagram, Facebook, YouTube, TikTok), page metadata, images, directory profiles, book catalogs, and quote lists.'
  },
  {
    question: 'What does Deep Directory / Profile Crawl do?',
    answer:
      'When enabled, the crawler automatically identifies inner listing, store, or profile detail pages linked from the target URL and visits up to 25 of them to collect nested contact details and official external websites.'
  },
  {
    question: 'Can ALM Nexus build larger scheduled pipelines or CRM integrations?',
    answer:
      'Yes. For high-volume jobs exceeding 10,000 rows, recurring scheduled runs, live SMTP email verification, or automated CRM webhook sync, reach out through the ALM Nexus project intake page.'
  }
];

export function buildWebScraperJsonLdObjects(): Record<string, unknown>[] {
  const seo = ROUTE_SEO['/tools/web-data-engine'];
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Free AI Web Scraper & Lead Extractor — ALM Nexus',
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      url: seo.canonical,
      description: seo.description,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD'
      },
      publisher: {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: STUDIO_BRAND.name,
        url: `${SITE_ORIGIN}/`
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: WEB_SCRAPER_FAQS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer
        }
      }))
    }
  ];
}
