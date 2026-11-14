import {
  GeneratedContract,
  DeveloperRoleAllocation,
  ProjectCostEstimate,
  TimezoneMeeting,
  SalesBattlecard,
  CaseStudy,
  CampaignAttribution,
  ReviewCampaign,
  PartnerAgency,
  RFPQuestionAnswer,
  RetainerAccountHealth
} from '../types';

export const INITIAL_ROLE_BENCHMARKS: DeveloperRoleAllocation[] = [
  {
    id: 'role-1',
    roleTitle: 'Lead Architect / Tech Lead',
    seniority: 'Lead',
    headcount: 1,
    hoursPerWeek: 40,
    internalHourlyCost: 28,
    clientHourlyRate: 75
  },
  {
    id: 'role-2',
    roleTitle: 'Senior Full-Stack Engineer (React/Node/Next)',
    seniority: 'Senior',
    headcount: 2,
    hoursPerWeek: 40,
    internalHourlyCost: 20,
    clientHourlyRate: 55
  },
  {
    id: 'role-3',
    roleTitle: 'Mid-Level Full-Stack Engineer',
    seniority: 'Mid',
    headcount: 1,
    hoursPerWeek: 40,
    internalHourlyCost: 14,
    clientHourlyRate: 40
  },
  {
    id: 'role-4',
    roleTitle: 'Product Designer (UI/UX & Design System)',
    seniority: 'Senior',
    headcount: 1,
    hoursPerWeek: 25,
    internalHourlyCost: 18,
    clientHourlyRate: 50
  },
  {
    id: 'role-5',
    roleTitle: 'QA Automation Engineer',
    seniority: 'Mid',
    headcount: 1,
    hoursPerWeek: 20,
    internalHourlyCost: 12,
    clientHourlyRate: 35
  },
  {
    id: 'role-6',
    roleTitle: 'DevOps & Cloud Architect (AWS/GCP/Docker)',
    seniority: 'Senior',
    headcount: 1,
    hoursPerWeek: 15,
    internalHourlyCost: 22,
    clientHourlyRate: 65
  }
];

export const INITIAL_ESTIMATES: ProjectCostEstimate[] = [];

export const INITIAL_CONTRACTS: GeneratedContract[] = [];

export const INITIAL_MEETINGS: TimezoneMeeting[] = [];

export const SALES_BATTLECARDS: SalesBattlecard[] = [
  {
    id: 'bc-1',
    category: 'pricing',
    objectionTitle: '"Your agency quote is higher than other quotes we received"',
    clientQuerySnippet: 'We have quotes from freelancers or agencies proposing $3,000 for what you quoted $12,000.',
    rootPsychology: 'Fear of overpaying or being taken advantage of, combined with inability to differentiate surface-level coding from production-ready architecture.',
    winningScript: 'I completely respect that budget is critical for your team. Here is what that difference actually buys: With budget quotes, 70% of clients come to us 4 months later to rewrite the codebase because of zero test coverage, unmaintainable spaghetti code, and security vulnerabilities that prevent them from scaling. Our fee includes dedicated senior engineers, 90-day bug warranty, full CI/CD deployment on staging, and isolated IP protection under a registered entity. Would you rather pay once for guaranteed delivery, or pay twice to fix a broken launch?',
    proofPoints: [
      'Zero-downtime deployment & strict SOP QA staging tests',
      '90-day post-launch warranty with dedicated engineer on standby',
      '99.8% on-time milestone delivery track record across 40+ international launches'
    ],
    whatNotToSay: 'Do NOT say "You get what you pay for" or insult the cheaper provider. Do NOT offer an instant 40% discount—that destroys your credibility.',
    recommendedFollowUpQuestion: 'If budget is fixed at $3,000, which 3 core features would you be willing to sacrifice so we can deliver enterprise-grade quality on a phased MVP?'
  },
  {
    id: 'bc-2',
    category: 'freelancer_comparison',
    objectionTitle: '"Why should we hire your agency instead of an Upwork freelancer?"',
    clientQuerySnippet: 'I can hire a top-rated freelancer on Upwork for $25/hour. Why work with your agency?',
    rootPsychology: 'Desire for direct control and cost savings, but ignorance of single-point-of-failure risk (freelancer disappearing or getting sick).',
    winningScript: 'Upwork has talented individuals, but a single freelancer is a single point of failure. If they get sick, take another full-time job, or hit an architecture roadblock in DevOps, your entire product launch halts. When you partner with us, you are not hiring an individual; you are securing an entire managed infrastructure. If a developer is unavailable, our team lead immediately steps in. You get UI/UX, DevOps, QA, and project management in one unified retainer without needing to manage 4 independent contractors yourself.',
    proofPoints: [
      'Multi-disciplinary squad with QA & DevOps redundancy',
      'Dedicated project coordinator delivering weekly sprint demo video audits',
      'Escrow-grade security and audited Git repositories'
    ],
    whatNotToSay: 'Never say "Freelancers are unreliable." Focus on system redundancy, managed oversight, and risk mitigation.',
    recommendedFollowUpQuestion: 'How much time per week do you personally have to manage Jira tickets, QA test pull requests, and configure cloud servers?'
  },
  {
    id: 'bc-3',
    category: 'agency_credibility',
    objectionTitle: '"We’ve been burned by offshore dev agencies in the past"',
    clientQuerySnippet: 'We hired an overseas agency before and they overpromised, missed deadlines, and gave us code we could not use.',
    rootPsychology: 'Past trauma, loss of thousands of dollars, and fear of looking foolish to internal leadership or investors.',
    winningScript: 'I hear this constantly, and frankly, you have every right to be guarded. The traditional agency model failed because they took 100% upfront or disappeared for 3 months without transparency. We operate under a strict 11-step SOP designed specifically to eliminate your risk: First, we only ask for 50% advance to initiate the sprint; the remaining 50% is strictly locked until you test and approve the working product on our staging environment. Second, you receive weekly live Loom demo audits and direct Slack/Discord access to the engineering squad.',
    proofPoints: [
      'Staging gate: You test the working application before paying final balance',
      'Recorded weekly Loom sprint demos with transparent Git commits',
      'Real verifiable client references in US, UK, and Europe'
    ],
    whatNotToSay: 'Do NOT dismiss their previous experience or blame the other agency. Validate their caution and show the structural SOP safeguards.',
    recommendedFollowUpQuestion: 'Would it give you peace of mind to speak directly with one of our existing clients in your timezone before we sign?'
  },
  {
    id: 'bc-4',
    category: 'timeline',
    objectionTitle: '"Can you build this entire platform in 2 weeks?"',
    clientQuerySnippet: 'Our marketing launch is in 14 days. We need everything live by then.',
    rootPsychology: 'Urgency driven by an external deadline (trade show, investor meeting, marketing campaign) that is disconnected from software reality.',
    winningScript: 'If another agency promised you this full scope in 2 weeks, they are either lying or planning to hand you a non-functional mock template. To protect your brand from a disastrous launch that crashes on day one, here is our tactical solution: We execute a High-Impact Launch MVP in 14 days covering the critical conversion flow (user signup, payment, and core feature). We run marketing traffic to that, while sprint 2 delivers the secondary settings and dashboard modules 2 weeks later. This hits your deadline without cutting architectural corners.',
    proofPoints: [
      'Phased Agile MVP delivery schedule prevents public launch failures',
      'Automated testing pipeline ensures zero checkout or signup regressions',
      'Rapid design sprint prototype ready within 72 hours'
    ],
    whatNotToSay: 'Never say a flat "No, that is impossible" without offering a phased MVP alternative.',
    recommendedFollowUpQuestion: 'What is the single most critical action a user MUST be able to complete on launch day to consider the event a success?'
  }
];

export const INITIAL_CASE_STUDIES: CaseStudy[] = [];

export const INITIAL_CAMPAIGNS: CampaignAttribution[] = [];

export const INITIAL_REVIEWS: ReviewCampaign[] = [];

export const INITIAL_PARTNERS: PartnerAgency[] = [];

export const INITIAL_RFP_KNOWLEDGE: RFPQuestionAnswer[] = [
  {
    id: 'rfp-01',
    category: 'security_compliance',
    tenderPrompt: 'What security standards and compliance protocols does your development team enforce for user data and credentials?',
    verifiedAnswer: 'We enforce strict Zero-Trust Architecture and OWASP Top 10 security standards across all client deliverables. All credentials and API keys are strictly restricted to server-side environments and never bundled in client builds. Data in transit is encrypted using TLS 1.3, and data at rest utilizes AES-256 encryption. We support automated role-based access control (RBAC), sanitized SQL/NoSQL parameterization to prevent injection, and strict Content Security Policies (CSP).',
    certifications: ['SOC 2 Type II Compatible', 'GDPR Compliant', 'OWASP Top 10 Audited'],
    keywords: ['encryption', 'AES-256', 'TLS 1.3', 'RBAC', 'GDPR', 'OWASP'],
    lastAuditedDate: '2026-09-01'
  },
  {
    id: 'rfp-02',
    category: 'ip_escrow',
    tenderPrompt: 'Who retains intellectual property rights to the source code, databases, and custom assets developed during the contract?',
    verifiedAnswer: 'Upon clearance of agreed contractual milestones, 100% of all intellectual property, source code, database architectures, documentation, and design assets are irrevocably assigned and transferred to the Client. We do not use proprietary vendor lock-in frameworks; everything is built using standard, modern open-source stacks (e.g. Next.js, TypeScript, PostgreSQL) and transferred directly to the client’s GitHub / GitLab organization.',
    certifications: ['Full IP Assignment Clause', 'Clean Git History Transfer', 'No Vendor Lock-In'],
    keywords: ['IP ownership', 'code transfer', 'GitHub', 'escrow', 'open-source'],
    lastAuditedDate: '2026-08-20'
  },
  {
    id: 'rfp-03',
    category: 'qa_testing',
    tenderPrompt: 'Describe your Quality Assurance (QA), automated testing, and regression testing methodologies prior to production releases.',
    verifiedAnswer: 'Our development workflow operates under an automated CI/CD pipeline where every pull request requires automated linting, unit test execution, and static type-checking. Pre-release testing takes place in an isolated staging environment that mirrors production data schemas. Every release is gated by an automated 17-point SOP regression test suite validating HTTPS certificates, cross-browser responsiveness, payment webhooks, and zero-console-error policies before domain migration.',
    certifications: ['Automated CI/CD', 'Staging Isolation', 'Zero Regression Gate'],
    keywords: ['QA', 'regression', 'automated testing', 'CI/CD', 'staging'],
    lastAuditedDate: '2026-09-10'
  },
  {
    id: 'rfp-04',
    category: 'devops_cloud',
    tenderPrompt: 'What is your disaster recovery strategy, uptime SLA target, and automated backup protocol?',
    verifiedAnswer: 'We target a 99.9% uptime Service Level Agreement (SLA). Production database clusters are configured with automated daily point-in-time recovery (PITR) snapshots retained for 30 days across multi-region geographic backups. Containerized services deploy via blue-green zero-downtime rollouts, allowing instantaneous rollback to the previous stable release hash within 60 seconds if runtime anomalies are detected.',
    certifications: ['99.9% Uptime SLA', 'Multi-Region Backups', 'Automated Rollback'],
    keywords: ['disaster recovery', 'SLA', 'backups', 'blue-green', 'uptime'],
    lastAuditedDate: '2026-09-05'
  },
  {
    id: 'rfp-05',
    category: 'team_velocity',
    tenderPrompt: 'How does your agency manage sprint velocity, client visibility, and change request scoping?',
    verifiedAnswer: 'We practice two-week Agile sprint cycles. Clients receive real-time visibility through a dedicated client portal, weekly recorded Loom video sprint audits, and bi-weekly milestone demonstrations. Any new feature requests outside the agreed Statement of Work (SOW) are formally documented in an Architectural Change Order (ACO) detailing the exact hours and budget delta before coding commences, ensuring zero surprise invoices.',
    certifications: ['Agile Scrum Framework', 'Weekly Loom Audits', 'Transparent Change Orders'],
    keywords: ['Agile', 'sprint velocity', 'change order', 'Loom', 'scrum'],
    lastAuditedDate: '2026-08-30'
  }
];

export const INITIAL_RETAINERS: RetainerAccountHealth[] = [];
