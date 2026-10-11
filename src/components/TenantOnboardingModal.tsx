import React, { useState } from 'react';
import { 
  Building2, 
  Shield, 
  Users, 
  Link2, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  X, 
  Linkedin, 
  Mail, 
  CreditCard, 
  Lock, 
  Key, 
  Eye, 
  Globe, 
  Sliders, 
  CheckSquare, 
  Check, 
  Zap, 
  Palette, 
  Briefcase 
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface TenantOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TenantOnboardingModal: React.FC<TenantOnboardingModalProps> = ({ isOpen, onClose }) => {
  const { onboardNewTenant, showToast } = useApp();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Step 1: Company Branding & Profile
  const [companyName, setCompanyName] = useState<string>('');
  const [industry, setIndustry] = useState<string>('B2B SaaS & Growth Operations');
  const [companyDescription, setCompanyDescription] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [primaryColor, setPrimaryColor] = useState<string>('#6366f1');
  const [accentColor, setAccentColor] = useState<string>('#06b6d4');
  const [geometricStyle, setGeometricStyle] = useState<'cyber_glass' | 'minimal_grid' | 'monochrome_clean' | 'matrix_dark'>('cyber_glass');
  const [logoPreset, setLogoPreset] = useState<string>('hexagon_nexus');
  const [targetRevenueUSD, setTargetRevenueUSD] = useState<number>(250000);
  const [objectives, setObjectives] = useState<string[]>([
    'Automate LinkedIn & Gmail client outreach',
    'Manage Stripe milestone escrow releases',
    'Real-time cross-departmental team tracking'
  ]);
  const [newObjective, setNewObjective] = useState<string>('');

  // Step 2: Admin Authentication & Master Role
  const [adminName, setAdminName] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('Admin@12345');
  const [adminPin, setAdminPin] = useState<string>('1234');
  const [adminTitle, setAdminTitle] = useState<string>('Chief Executive Officer (CEO)');
  const [timezone, setTimezone] = useState<string>('America/New_York (EST)');

  // Step 3: Granular Role Definition (RBAC)
  const [configuredRoles, setConfiguredRoles] = useState<Record<string, { title: string; enabled: boolean; permissions: string[] }>>({
    admin: {
      title: 'Chief Executive Officer (CEO)',
      enabled: true,
      permissions: ['all_macro_analytics', 'financial_oversight', 'system_settings', 'user_management']
    },
    project_manager: {
      title: 'Project Operations Manager',
      enabled: true,
      permissions: ['sprint_backlog', 'kanban_assignment', 'sop_qa_signoff', 'discord_broadcasts']
    },
    sales: {
      title: 'Business Development Specialist',
      enabled: true,
      permissions: ['lead_scrapers', 'outreach_engine', 'deal_pipeline', 'commission_ledger']
    },
    developer: {
      title: 'Lead Full-Stack Engineer',
      enabled: true,
      permissions: ['technical_tasks', 'staging_deployments', 'time_tracking', 'vault_credentials']
    },
    designer: {
      title: 'Lead UI/UX Designer',
      enabled: true,
      permissions: ['wireframe_specs', 'asset_library', 'client_feedback', 'brand_standards']
    },
    client_guest: {
      title: 'Client Stakeholder',
      enabled: true,
      permissions: ['client_portal_access', 'milestone_approvals', 'invoice_settlement']
    }
  });

  // Step 4: External Integrations Setup
  const [linkedInEnabled, setLinkedInEnabled] = useState<boolean>(true);
  const [linkedInHandle, setLinkedInHandle] = useState<string>('@company-growth');
  const [linkedInSyncFreq, setLinkedInSyncFreq] = useState<number>(15);
  const [linkedInAutoOutreach, setLinkedInAutoOutreach] = useState<boolean>(true);

  const [gmailEnabled, setGmailEnabled] = useState<boolean>(true);
  const [gmailEmail, setGmailEmail] = useState<string>('');
  const [gmailThreadTracking, setGmailThreadTracking] = useState<boolean>(true);
  const [gmailAutoDraft, setGmailAutoDraft] = useState<boolean>(true);

  const [stripeEnabled, setStripeEnabled] = useState<boolean>(true);
  const [stripeCurrency, setStripeCurrency] = useState<string>('USD');
  const [stripeLiveMode, setStripeLiveMode] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleAddObjective = () => {
    if (newObjective.trim() && !objectives.includes(newObjective.trim())) {
      setObjectives([...objectives, newObjective.trim()]);
      setNewObjective('');
    }
  };

  const handleRemoveObjective = (idx: number) => {
    setObjectives(objectives.filter((_, i) => i !== idx));
  };

  const handleTogglePermission = (roleKey: string, perm: string) => {
    setConfiguredRoles(prev => {
      const current = prev[roleKey];
      if (!current) return prev;
      const hasPerm = current.permissions.includes(perm);
      const updatedPerms = hasPerm 
        ? current.permissions.filter(p => p !== perm) 
        : [...current.permissions, perm];
      return {
        ...prev,
        [roleKey]: {
          ...current,
          permissions: updatedPerms
        }
      };
    });
  };

  const handleCompleteOnboarding = async () => {
    if (!companyName.trim()) {
      showToast('Please enter your Company Name', 'warning');
      setCurrentStep(1);
      return;
    }
    if (!adminEmail.trim() || !adminName.trim()) {
      showToast('Please fill in the Master Admin name and email', 'warning');
      setCurrentStep(2);
      return;
    }

    setSubmitting(true);
    const payload = {
      companyName,
      logoUrl: '/icon.svg',
      branding: {
        primaryColor,
        accentColor,
        theme: 'dark',
        geometricStyle,
        logoPreset
      },
      businessInfo: {
        industry,
        description: companyDescription || `${companyName} centralized growth operations.`,
        website,
        targetRevenueUSD,
        coreObjectives: objectives
      },
      adminUser: {
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        pin: adminPin,
        title: adminTitle
      },
      rolesConfig: configuredRoles,
      integrations: {
        linkedIn: {
          connected: linkedInEnabled,
          accountHandle: linkedInHandle,
          syncIntervalMinutes: linkedInSyncFreq,
          autoOutreachEnabled: linkedInAutoOutreach
        },
        gmail: {
          connected: gmailEnabled,
          accountEmail: gmailEmail || adminEmail,
          threadTracking: gmailThreadTracking,
          autoDraftReplies: gmailAutoDraft
        },
        stripe: {
          connected: stripeEnabled,
          liveMode: stripeLiveMode,
          currency: stripeCurrency
        }
      }
    };

    const res = await onboardNewTenant(payload);
    setSubmitting(false);

    if (res.success) {
      onClose();
    } else {
      showToast(res.message || 'Onboarding failed. Please try again.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#0b101e] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Modal Top Header */}
        <div className="p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a12] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  ALM Nexus Tenant Setup
                </h2>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                  Enterprise Onboarding
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Initialize your isolated multi-channel workspace, RBAC permissions, and external APIs
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

        {/* Step Progress Breadcrumb */}
        <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-white/10 flex items-center justify-between overflow-x-auto text-xs font-semibold">
          {[
            { step: 1, label: '1. Company Branding' },
            { step: 2, label: '2. Admin Master' },
            { step: 3, label: '3. RBAC Roles' },
            { step: 4, label: '4. External APIs' },
            { step: 5, label: '5. Launch' }
          ].map(s => {
            const isCompleted = currentStep > s.step;
            const isCurrent = currentStep === s.step;
            return (
              <button
                key={s.step}
                onClick={() => setCurrentStep(s.step)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer whitespace-nowrap ${
                  isCurrent 
                    ? 'bg-indigo-600 text-white font-bold shadow-xs' 
                    : isCompleted 
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="font-mono text-[11px]">{s.step}</span>}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Step Body */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
          
          {/* STEP 1: Company Branding & Profile */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-indigo-500" />
                  <span>Company Branding &amp; Operational Objectives</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure your company profile and geometric dark-mode aesthetics for strict tenant isolation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Company / Agency Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Digital Ventures"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Primary Industry Focus
                  </label>
                  <select
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                  >
                    <option value="B2B SaaS & Growth Operations">B2B SaaS & Growth Operations</option>
                    <option value="Digital Web Development & Design Agency">Digital Web Development & Design Agency</option>
                    <option value="Game Development & Interactive Studios">Game Development & Interactive Studios</option>
                    <option value="FinTech & Corporate Consultancy">FinTech & Corporate Consultancy</option>
                    <option value="E-Commerce & High-Ticket Retail">E-Commerce & High-Ticket Retail</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Official Website / Domain
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    placeholder="https://apexventures.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Quarterly Target Revenue (USD)
                  </label>
                  <input
                    type="number"
                    value={targetRevenueUSD}
                    onChange={e => setTargetRevenueUSD(Number(e.target.value))}
                    step={10000}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition font-mono"
                  />
                </div>
              </div>

              {/* Geometric Brand Aesthetics */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-4">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  Geometric Dark-Mode Brand Styling
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'cyber_glass', label: 'Cyber Glass', desc: 'Subtle neon borders & glass blur' },
                    { key: 'minimal_grid', label: 'Minimal Grid', desc: 'Engineering lines & dot matrix' },
                    { key: 'monochrome_clean', label: 'Monochrome', desc: 'High contrast clean slate' },
                    { key: 'matrix_dark', label: 'Matrix Dark', desc: 'Deep terminal blacks' }
                  ].map(style => (
                    <div
                      key={style.key}
                      onClick={() => setGeometricStyle(style.key as any)}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        geometricStyle === style.key
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{style.label}</span>
                        {geometricStyle === style.key && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{style.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 flex-wrap pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Primary Color:</span>
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={e => setPrimaryColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-500">{primaryColor}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Accent Color:</span>
                    <input
                      type="color"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border-0 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-500">{accentColor}</span>
                  </div>
                </div>
              </div>

              {/* Core Objectives Checklist */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Core Business Objectives
                </label>
                <div className="space-y-2 mb-3">
                  {objectives.map((obj, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 text-xs">
                      <span className="text-slate-800 dark:text-slate-200 font-medium">✓ {obj}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveObjective(i)}
                        className="text-slate-400 hover:text-red-500 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newObjective}
                    onChange={e => setNewObjective(e.target.value)}
                    placeholder="Add custom objective (e.g. Upwork Enterprise RFP integration)..."
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddObjective())}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddObjective}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-xs font-bold transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Master Admin / CEO Authentication */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-rose-500" />
                  <span>Master Administrator &amp; CEO Configuration</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Register the root company executive. This account maintains unrestricted macro-level access across all departments.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Master Administrator Name *
                  </label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="e.g. Tariq Mehmood"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Corporate Email Address *
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    placeholder="ceo@yourcompany.com"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Master Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    4-Digit Fast Security PIN
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={4}
                      value={adminPin}
                      onChange={e => setAdminPin(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Executive Title
                  </label>
                  <input
                    type="text"
                    value={adminTitle}
                    onChange={e => setAdminTitle(e.target.value)}
                    placeholder="CEO & Managing Director"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Operating Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={e => setTimezone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                  >
                    <option value="America/New_York (EST)">America/New_York (EST, UTC-5)</option>
                    <option value="Europe/London (GMT)">Europe/London (GMT/BST, UTC+0)</option>
                    <option value="Asia/Dubai (GST)">Asia/Dubai (GST, UTC+4)</option>
                    <option value="Asia/Karachi (PKT)">Asia/Karachi (PKT, UTC+5)</option>
                    <option value="Europe/Berlin (CET)">Europe/Berlin (CET, UTC+1)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Role Definition & Granular Access Control (RBAC) */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>Role Definition &amp; Granular Access Control (RBAC)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Define organizational roles and assign specific permission scopes so team members only see data relevant to their function.
                </p>
              </div>

              <div className="space-y-3">
                {(Object.entries(configuredRoles) as Array<[string, { title: string; enabled: boolean; permissions: string[] }]>).map(([roleKey, conf]) => (
                  <div 
                    key={roleKey}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 space-y-3"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {conf.title}
                          </span>
                          <span className="ml-2 font-mono text-[10px] text-slate-500 dark:text-slate-400 uppercase">
                            ({roleKey})
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                        {conf.permissions.length} Scopes Active
                      </span>
                    </div>

                    {/* Permissions Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {conf.permissions.map(perm => (
                        <span 
                          key={perm}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 font-mono font-medium"
                        >
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>{perm.replace(/_/g, ' ')}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: External Integrations Setup */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-500" />
                  <span>External Integrations Setup (LinkedIn, Gmail, Stripe)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Connect corporate accounts for automated marketing, synchronized email communication, and financial escrow billing.
                </p>
              </div>

              {/* LinkedIn Connector */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#0077b5] text-white flex items-center justify-center shadow-md">
                      <Linkedin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">LinkedIn Outreach Engine</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Automated lead scraper, connection requests & InMail sync</p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={linkedInEnabled}
                    onChange={e => setLinkedInEnabled(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {linkedInEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Corporate / Sales Nav Handle
                      </label>
                      <input
                        type="text"
                        value={linkedInHandle}
                        onChange={e => setLinkedInHandle(e.target.value)}
                        placeholder="@company-sales"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Sync Frequency
                      </label>
                      <select
                        value={linkedInSyncFreq}
                        onChange={e => setLinkedInSyncFreq(Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      >
                        <option value={5}>Every 5 minutes</option>
                        <option value={15}>Every 15 minutes (Recommended)</option>
                        <option value={30}>Every 30 minutes</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Gmail Connector */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#ea4335] text-white flex items-center justify-center shadow-md">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Gmail Corporate Outreach</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Thread tracking, automated follow-up sequences, and Unified Inbox</p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={gmailEnabled}
                    onChange={e => setGmailEnabled(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {gmailEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Outreach Email Account
                      </label>
                      <input
                        type="email"
                        value={gmailEmail}
                        onChange={e => setGmailEmail(e.target.value)}
                        placeholder="outreach@yourcompany.com"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-4">
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={gmailAutoDraft}
                          onChange={e => setGmailAutoDraft(e.target.checked)}
                          className="accent-indigo-600"
                        />
                        <span>AI Auto-Draft Replies</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Stripe Connector */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#635bff] text-white flex items-center justify-center shadow-md">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Stripe Financial Escrow</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Automated 50% advance deposits, milestone clearance & receipts</p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={stripeEnabled}
                    onChange={e => setStripeEnabled(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {stripeEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Settlement Currency
                      </label>
                      <select
                        value={stripeCurrency}
                        onChange={e => setStripeCurrency(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="AED">AED (AED)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 pt-4">
                      <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={stripeLiveMode}
                          onChange={e => setStripeLiveMode(e.target.checked)}
                          className="accent-indigo-600"
                        />
                        <span>Production Live Mode (Unchecked: Sandbox)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Final Review & Launch */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="text-center max-w-lg mx-auto">
                <div className="w-14 h-14 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/10">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Ready to Launch {companyName || 'Your Workspace'}!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Your tenant configuration is validated. Click below to provision the isolated database schema, create the master CEO account, and enter the dashboard.
                </p>
              </div>

              {/* Summary Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-white/10 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Company</span>
                    <strong className="text-slate-900 dark:text-white font-bold">{companyName || 'Not Set'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Industry</span>
                    <strong className="text-slate-900 dark:text-white font-bold">{industry}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Master CEO</span>
                    <strong className="text-slate-900 dark:text-white font-bold">{adminName || 'Admin'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-mono">Aesthetics</span>
                    <strong className="text-slate-900 dark:text-white font-bold font-mono">{geometricStyle}</strong>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Active Integrations:</span>
                  <div className="flex items-center gap-2">
                    {linkedInEnabled && <span className="px-2 py-0.5 rounded-full bg-[#0077b5]/10 text-[#0077b5] font-bold text-[10px]">LinkedIn</span>}
                    {gmailEnabled && <span className="px-2 py-0.5 rounded-full bg-[#ea4335]/10 text-[#ea4335] font-bold text-[10px]">Gmail</span>}
                    {stripeEnabled && <span className="px-2 py-0.5 rounded-full bg-[#635bff]/10 text-[#635bff] font-bold text-[10px]">Stripe</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Controls */}
        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#070a12] flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 text-xs font-bold transition cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-white text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (currentStep === 1 && !companyName.trim()) {
                  showToast('Please enter your Company Name to continue.', 'warning');
                  return;
                }
                if (currentStep === 2 && (!adminEmail.trim() || !adminName.trim())) {
                  showToast('Please enter Master Admin name and email.', 'warning');
                  return;
                }
                setCurrentStep(prev => prev + 1);
              }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition cursor-pointer flex items-center gap-2"
            >
              <span>Continue to Step {currentStep + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCompleteOnboarding}
              disabled={submitting}
              className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center gap-2"
            >
              {submitting ? (
                <span>Provisioning Tenant...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Launch ALM Nexus Workspace</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
