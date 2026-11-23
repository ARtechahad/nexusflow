export type PublicRoutePath =
  | '/'
  | '/services'
  | '/products'
  | '/work'
  | '/about'
  | '/contact'
  | '/privacy'
  | '/terms';

export const PUBLIC_ROUTES: PublicRoutePath[] = [
  '/',
  '/services',
  '/products',
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
    title: 'ALM Nexus — Software Studio & R&D Lab',
    description:
      'Software studio and R&D lab building web and mobile apps, Unity games, AI agents, data pipelines, and NexusFlow.',
    canonical: `${SITE_ORIGIN}/`
  },
  '/services': {
    title: 'Services | ALM Nexus',
    description:
      'Custom web and mobile apps, Unity game development, AI engineering and fine-tuning, and Python data scraping pipelines.',
    canonical: `${SITE_ORIGIN}/services`
  },
  '/products': {
    title: 'NexusFlow and Products | ALM Nexus',
    description:
      'NexusFlow multi-tenant operations platform for agencies and B2B teams, plus software tools in R&D from ALM Nexus.',
    canonical: `${SITE_ORIGIN}/products`
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
      'ALM Nexus is a Pakistan-based software studio and R&D lab founded by Abdul Ahad Rana, working remotely with clients in the US, UK, UAE and EU.',
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
  locationRemote: 'Pakistan-based, working remotely with clients in the US, UK, UAE and EU.',
  contactAvailability: 'Pakistan-based, available remotely for clients in the US, UK, UAE and EU',
  oneLineSummary: 'Software studio and R&D lab based in Pakistan, working remotely worldwide.',
  founderBio:
    'ALM Nexus is a software engineering studio and R&D lab founded by Abdul Ahad Rana, based in Pakistan and working remotely with clients across the US, UK, UAE, and EU. Abdul builds full-stack web and mobile applications, Unity games, AI automation systems, and B2B data pipelines.'
};

export interface NavItem {
  label: string;
  href: PublicRoutePath;
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: 'Services', href: '/services' },
  { label: 'Products', href: '/products' },
  { label: 'Work', href: '/work' },
  { label: 'About', href: '/about' }
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
  status: 'In active R&D';
  title: string;
  summary: string;
  stack: string;
}

export const RD_PRODUCTS: RdProduct[] = [
  {
    id: 'ai-developer-tool',
    status: 'In active R&D',
    title: 'AI developer tool',
    summary:
      'Internal CLI and repository indexing utility for running structured code reviews and schema checks on client handoffs.',
    stack: 'TypeScript, Python, CLI'
  },
  {
    id: 'data-verification-worker',
    status: 'In active R&D',
    title: 'Verification & scraping worker',
    summary:
      'Lightweight queue worker for scheduling recurring MX/SMTP mailbox checks and exporting deduplicated CSV or PostgreSQL tables.',
    stack: 'Python, PostgreSQL, SMTP'
  },
  {
    id: 'unity-telemetry-kit',
    status: 'In active R&D',
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
