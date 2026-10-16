import React, { useState } from 'react';
import { 
  Building2, 
  Shield, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  X, 
  Mail, 
  Lock, 
  Globe, 
  Check, 
  Briefcase,
  DollarSign,
  Clock,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface TenantOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TenantOnboardingModal: React.FC<TenantOnboardingModalProps> = ({ isOpen, onClose }) => {
  const { onboardNewTenant, showToast, currentUser } = useApp();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Step 1: Company Category & Dynamic RBAC Roles
  const [companyCategory, setCompanyCategory] = useState<'software_house' | 'digital_agency' | 'enterprise_it' | 'ecommerce' | 'other'>('software_house');
  
  const categoryRolesPresets: Record<string, Array<{ key: string; title: string; desc: string; permissions: string[] }>> = {
    software_house: [
      { key: 'admin', title: 'Chief Executive Officer (CEO)', desc: 'Executive oversight, financial management & system controls', permissions: ['all_macro_analytics', 'financial_oversight', 'system_settings', 'user_management'] },
      { key: 'cto', title: 'Chief Technology Officer (CTO)', desc: 'Architecture, database schema, CI/CD pipeline & security audits', permissions: ['database_schema', 'deployment_controls', 'api_tokens', 'security_logs'] },
      { key: 'project_manager', title: 'Project Operations Manager (PM)', desc: 'Sprint planning, Kanban board assignments & milestone approvals', permissions: ['sprint_backlog', 'kanban_assignment', 'sop_qa_signoff', 'discord_broadcasts'] },
      { key: 'developer', title: 'Lead Full-Stack Engineer', desc: 'Code commits, staging deployments, and technical task execution', permissions: ['technical_tasks', 'staging_deployments', 'time_tracking', 'vault_credentials'] },
      { key: 'sales', title: 'Business Development Specialist', desc: 'Inbound campaigns, client outreach, and deal pipelines', permissions: ['lead_scrapers', 'outreach_engine', 'deal_pipeline', 'commission_ledger'] }
    ],
    digital_agency: [
      { key: 'admin', title: 'Managing Director & CEO', desc: 'Agency growth, high-level client accounts & financial ledger', permissions: ['all_macro_analytics', 'financial_oversight', 'system_settings', 'user_management'] },
      { key: 'creative_director', title: 'Creative Director', desc: 'UI/UX design standards, asset library & brand guidelines', permissions: ['brand_standards', 'asset_library', 'client_feedback', 'design_specs'] },
      { key: 'account_director', title: 'Client Account Director', desc: 'Client portal management, scope review & milestone escrow', permissions: ['client_portal_access', 'milestone_approvals', 'invoice_settlement'] },
      { key: 'growth_marketer', title: 'Growth & Outreach Lead', desc: 'Multi-channel campaigns, lead enrichment & CRM sequencing', permissions: ['lead_scrapers', 'outreach_engine', 'deal_pipeline', 'campaigns'] }
    ],
    enterprise_it: [
      { key: 'admin', title: 'Chief Information Officer (CIO)', desc: 'Enterprise infrastructure governance & executive oversight', permissions: ['all_macro_analytics', 'financial_oversight', 'system_settings', 'user_management'] },
      { key: 'vp_eng', title: 'VP of Engineering', desc: 'Technical division leadership & resource allocation', permissions: ['sprint_backlog', 'infrastructure', 'deployment_controls'] }
    ],
    ecommerce: [
      { key: 'admin', title: 'E-Commerce Founder & CEO', desc: 'Store operations, revenue analytics & financial control', permissions: ['all_macro_analytics', 'financial_oversight', 'system_settings', 'user_management'] },
      { key: 'growth_lead', title: 'Growth & Conversion Lead', desc: 'Customer acquisition, email marketing & pipeline tracking', permissions: ['outreach_engine', 'lead_scrapers', 'campaigns'] }
    ],
    other: [
      { key: 'admin', title: 'Managing Director & Admin', desc: 'Full workspace administration and team management', permissions: ['all_macro_analytics', 'system_settings', 'user_management'] }
    ]
  };

  const [configuredRoles, setConfiguredRoles] = useState<Record<string, { title: string; enabled: boolean; permissions: string[] }>>({
    admin: { title: 'Chief Executive Officer (CEO)', enabled: true, permissions: ['all_macro_analytics', 'financial_oversight', 'system_settings', 'user_management'] },
    cto: { title: 'Chief Technology Officer (CTO)', enabled: true, permissions: ['database_schema', 'deployment_controls', 'api_tokens', 'security_logs'] },
    project_manager: { title: 'Project Operations Manager (PM)', enabled: true, permissions: ['sprint_backlog', 'kanban_assignment', 'sop_qa_signoff', 'discord_broadcasts'] },
    developer: { title: 'Lead Full-Stack Engineer', enabled: true, permissions: ['technical_tasks', 'staging_deployments', 'time_tracking', 'vault_credentials'] },
    sales: { title: 'Business Development Specialist', enabled: true, permissions: ['lead_scrapers', 'outreach_engine', 'deal_pipeline', 'commission_ledger'] }
  });

  const handleCategoryChange = (cat: 'software_house' | 'digital_agency' | 'enterprise_it' | 'ecommerce' | 'other') => {
    setCompanyCategory(cat);
    const rolesList = categoryRolesPresets[cat] || categoryRolesPresets.software_house;
    const newRolesMap: Record<string, { title: string; enabled: boolean; permissions: string[] }> = {};
    rolesList.forEach(r => {
      newRolesMap[r.key] = {
        title: r.title,
        enabled: true,
        permissions: r.permissions
      };
    });
    setConfiguredRoles(newRolesMap);
  };

  // Step 2: Essential Business Profile Information
  const [companyName, setCompanyName] = useState<string>('');
  const [website, setWebsite] = useState<string>('https://');
  const [businessEmail, setBusinessEmail] = useState<string>(currentUser?.email || '');
  const [industrySector, setIndustrySector] = useState<string>('Software & Cloud Engineering');
  const [coreServiceOffering, setCoreServiceOffering] = useState<string>('Enterprise SaaS, Custom Full-Stack Apps & AI Automation');

  // Step 3: Team Scale & Operational Preferences (Flexible)
  const [teamSize, setTeamSize] = useState<string>('11-50 employees');
  const [operatingCurrency, setOperatingCurrency] = useState<string>('USD ($)');
  const [timezone, setTimezone] = useState<string>('America/New_York (EST)');
  const [communicationNote, setCommunicationNote] = useState<string>('Slack & Email (Flexible — configure anytime from Integrations)');

  // Step 4: Administrator Account & Instant Launch
  const [adminName, setAdminName] = useState<string>(currentUser?.name || 'Tariq Mehmood');
  const [adminEmail, setAdminEmail] = useState<string>(currentUser?.email || 'admin@agencyops.dev');
  const [adminPassword, setAdminPassword] = useState<string>('Admin@Enterprise2026');

  if (!isOpen) return null;

  const handleCompleteOnboarding = async () => {
    if (!companyName.trim()) {
      showToast('Please enter your Company Name', 'warning');
      setCurrentStep(2);
      return;
    }
    if (!adminEmail.trim() || !adminName.trim()) {
      showToast('Please provide Administrator name and email', 'warning');
      setCurrentStep(4);
      return;
    }

    setSubmitting(true);
    const payload = {
      companyName,
      logoUrl: '/icon.svg',
      branding: {
        primaryColor: '#6366f1',
        accentColor: '#06b6d4',
        theme: 'dark',
        geometricStyle: 'cyber_glass',
        logoPreset: 'hexagon_nexus'
      },
      businessInfo: {
        industry: industrySector,
        description: coreServiceOffering,
        website: website.trim() === 'https://' ? '' : website.trim(),
        targetRevenueUSD: 500000,
        coreObjectives: [
          `Category: ${companyCategory}`,
          `Team Size: ${teamSize}`,
          `Operating Currency: ${operatingCurrency}`,
          `Timezone: ${timezone}`
        ]
      },
      adminUser: {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        pin: '1234',
        title: 'Chief Executive Officer (CEO)'
      },
      rolesConfig: configuredRoles,
      integrations: {
        linkedIn: { connected: true, accountHandle: '@enterprise-growth', syncIntervalMinutes: 15, autoOutreachEnabled: true },
        gmail: { connected: true, accountEmail: businessEmail || adminEmail, threadTracking: true, autoDraftReplies: true },
        stripe: { connected: true, liveMode: true, currency: operatingCurrency.split(' ')[0] },
        resend: { apiKey: 're_LXiiEzAS_86mprrkSQfUGaJHZRK25Pp18', verified: true }
      }
    };

    const res = await onboardNewTenant(payload);
    setSubmitting(false);

    if (res.success) {
      showToast(`Welcome to ${companyName}! Workspace registered successfully. Welcome email sent via Resend.`, 'success');
      onClose();
    } else {
      showToast(res.message || 'Company registration failed. Please try again.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#090d16] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#05080f] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Company Workspace Registration
                </h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                  Step {currentStep} of 4
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Frictionless multi-tenant setup with Neon DB pooling, Clerk session sync &amp; Resend dispatch
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb Steps */}
        <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-white/10 flex items-center justify-between overflow-x-auto text-xs font-semibold gap-2">
          {[
            { s: 1, label: '1. Category & Roles' },
            { s: 2, label: '2. Company Profile' },
            { s: 3, label: '3. Team Scale & Preferences' },
            { s: 4, label: '4. Admin & Launch' }
          ].map(item => (
            <button
              key={item.s}
              onClick={() => setCurrentStep(item.s)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl transition shrink-0 cursor-pointer ${
                currentStep === item.s
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : currentStep > item.s
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5'
              }`}
            >
              <span>{item.label}</span>
              {currentStep > item.s && <Check className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
          ))}
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          
          {/* STEP 1: Company Category & Dynamic RBAC Roles */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-500" />
                  Select Business Category &amp; Workspace Management Roles
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select your organization category to automatically configure tailored hierarchical workspace roles.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'software_house', title: 'Software House', desc: 'Custom engineering, SaaS products & full-stack development teams' },
                  { id: 'digital_agency', title: 'Digital Agency', desc: 'Marketing, UI/UX creative design & international client operations' },
                  { id: 'enterprise_it', title: 'Enterprise IT', desc: 'Cloud infrastructure governance, security & IT services' },
                  { id: 'ecommerce', title: 'E-Commerce Brand', desc: 'Direct-to-consumer storefronts, growth & customer success' },
                  { id: 'other', title: 'Other Business', desc: 'General professional services, consulting & team operations' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id as any)}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      companyCategory === cat.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm mb-1">{cat.title}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{cat.desc}</div>
                    </div>
                    {companyCategory === cat.id && (
                      <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white">Assigned Hierarchical Roles &amp; Permissions</h4>
                <div className="space-y-2">
                  {Object.entries(configuredRoles).map(([key, roleObj]) => (
                    <div key={key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{roleObj.title}</div>
                        <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                          Permissions: {roleObj.permissions.join(', ')}
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                        Active Role
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Company Metadata & Profile (Frictionless) */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-indigo-500" />
                  Essential Company Profile
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Provide high-level company identity details. No burdensome corporate tax numbers required.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Brand Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Crestview Technologies"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Official Website</label>
                  <input
                    type="text"
                    placeholder="https://crestview.io"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Support / Business Email</label>
                  <input
                    type="email"
                    placeholder="contact@crestview.io"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Industry Sector</label>
                  <input
                    type="text"
                    placeholder="Software & Cloud Engineering"
                    value={industrySector}
                    onChange={(e) => setIndustrySector(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Core Service Offering / Elevator Summary</label>
                <textarea
                  rows={3}
                  value={coreServiceOffering}
                  onChange={(e) => setCoreServiceOffering(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Team Scale & Operational Preferences (Flexible) */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Team Scale &amp; Operational Preferences
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure team size and operating currency. All settings are completely flexible and can be modified anytime.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Team Size / Employee Count</label>
                  <select
                    value={teamSize}
                    onChange={(e) => setTeamSize(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  >
                    <option value="1-10 employees">1-10 employees (Startup)</option>
                    <option value="11-50 employees">11-50 employees (Growth)</option>
                    <option value="51-200 employees">51-200 employees (Scale-up)</option>
                    <option value="200+ employees">200+ employees (Enterprise)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Operating Currency</label>
                  <select
                    value={operatingCurrency}
                    onChange={(e) => setOperatingCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  >
                    <option value="USD ($)">USD ($)</option>
                    <option value="EUR (€)">EUR (€)</option>
                    <option value="GBP (£)">GBP (£)</option>
                    <option value="AED (د.إ)">AED (د.إ)</option>
                    <option value="AUD (A$)">AUD (A$)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Default Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  >
                    <option value="America/New_York (EST)">America/New_York (EST)</option>
                    <option value="Europe/London (GMT)">Europe/London (GMT)</option>
                    <option value="Asia/Dubai (GST)">Asia/Dubai (GST)</option>
                    <option value="Asia/Singapore (SGT)">Asia/Singapore (SGT)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Communication Channels Note</label>
                  <div className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                    {communicationNote}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Administrator Account & Instant Launch */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Administrator Identity &amp; Workspace Launch
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Confirm administrator credentials and provision your isolated company workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Master Administrator Name *</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Administrator Email (Clerk Auth) *</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Secure Password *</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Tenant ID</label>
                  <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 font-mono text-[11px]">
                    tenant-{companyName ? companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'workspace'}-01
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/20 space-y-2">
                <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  Automated Security &amp; Telemetry Provisioning
                </div>
                <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
                  <li>Tenant isolated in Neon Database with row-level <code className="font-mono">tenant_id</code> security.</li>
                  <li>Hierarchical RBAC assigned to master administrator account.</li>
                  <li>Instant welcome notification dispatched via Resend Email API (<code className="font-mono">re_LXiiEzAS...</code>).</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#05080f] flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteOnboarding}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-6 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
                <span>{submitting ? 'Provisioning Workspace...' : 'Launch Company Workspace'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
