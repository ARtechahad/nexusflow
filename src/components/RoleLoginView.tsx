import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Mail, 
  Key, 
  ArrowRight, 
  Sparkles, 
  AlertCircle,
  Building2,
  Users,
  Briefcase,
  Code2,
  FileCheck2,
  UserCheck,
  CheckCircle2,
  ShieldCheck,
  Database,
  Layers,
  Check,
  Zap,
  Globe2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ThemeToggle } from './ThemeToggle';

interface RoleLoginViewProps {
  onSuccess?: () => void;
}

export const RoleLoginView: React.FC<RoleLoginViewProps> = ({ onSuccess }) => {
  const { 
    login, 
    loginWithGoogle, 
    loginWithOAuth, 
    showToast,
    setActiveTab
  } = useApp();

  const [authMode, setAuthMode] = useState<'gateway' | 'personas'>('gateway');
  const [emailInput, setEmailInput] = useState<string>('admin@agencyops.dev');
  const [passwordOrPin, setPasswordOrPin] = useState<string>('1234');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [githubLoading, setGithubLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const personas: Array<{
    role: UserRole;
    name: string;
    title: string;
    email: string;
    pass: string;
    pin: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badgeStyle: string;
    scopeSummary: string;
    accessHighlights: string[];
  }> = [
    {
      role: 'admin',
      name: 'Tariq Mehmood',
      title: 'Chief Executive Officer (CEO)',
      email: 'admin@agencyops.dev',
      pass: 'Admin@12345',
      pin: '1234',
      icon: Building2,
      accentColor: 'indigo',
      badgeStyle: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
      scopeSummary: 'Unrestricted executive oversight across all revenue pipelines, financial commissions, database management, and SOP test gates.',
      accessHighlights: ['All 11 Modules', 'Financial Audits', 'Cloud SQL Sync']
    },
    {
      role: 'coordinator',
      name: 'Fatima Noor',
      title: 'Project Operations Manager & QA',
      email: 'coordinator@agencyops.dev',
      pass: 'Coord@12345',
      pin: '1234',
      icon: Users,
      accentColor: 'blue',
      badgeStyle: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',
      scopeSummary: 'SOP 1–11 enforcement, client briefing handovers, Discord team notifications, staging verification, and sprint backlogs.',
      accessHighlights: ['SOP Gatekeeper', 'Delivery Pipeline', 'Team Chat']
    },
    {
      role: 'sales',
      name: 'Hamza Farooq',
      title: 'Business Development & Sales Specialist',
      email: 'sales@agencyops.dev',
      pass: 'Sales@12345',
      pin: '1234',
      icon: Briefcase,
      accentColor: 'emerald',
      badgeStyle: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
      scopeSummary: 'Discovery, client pitch generation, active deal pipeline, cold outreach engine, and personal 35% commission ledger.',
      accessHighlights: ['Pipeline Deals', 'Outreach Engine', 'Live Forex & DNS']
    },
    {
      role: 'developer',
      name: 'Zain Ul Abideen',
      title: 'Lead Full-Stack Software Engineer',
      email: 'dev@agencyops.dev',
      pass: 'Dev@12345',
      pin: '1234',
      icon: Code2,
      accentColor: 'indigo',
      badgeStyle: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20',
      scopeSummary: 'Staging environment deployment, technical architecture, automated QA testing, and secure credential vault management.',
      accessHighlights: ['Staging & QA', 'Server File Vault', 'SOP 17/17 Tests']
    },
    {
      role: 'designer',
      name: 'Sara Jenkins',
      title: 'Lead UI/UX Designer & Creative Lead',
      email: 'design@agencyops.dev',
      pass: 'Design@12345',
      pin: '1234',
      icon: Sparkles,
      accentColor: 'purple',
      badgeStyle: 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
      scopeSummary: 'Wireframes, interactive mockups, brand assets, client design sign-offs, and geometric dark-mode styling library.',
      accessHighlights: ['Design Assets', 'Wireframe Specs', 'Brand Guidelines']
    },
    {
      role: 'client_guest',
      name: 'Alexander Vance',
      title: 'Client Stakeholder & Team Member',
      email: 'client@lumina-health.co.uk',
      pass: 'Client@12345',
      pin: '1234',
      icon: UserCheck,
      accentColor: 'amber',
      badgeStyle: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
      scopeSummary: 'Secure isolated Client Portal: review active staging preview, inspect 50% deposit milestones, and download final delivery assets.',
      accessHighlights: ['Client Portal Only', 'Staging Review', 'Milestone Invoices']
    },
    {
      role: 'collaborator',
      name: 'Marcus Vance',
      title: 'Partner & Deal Evaluator',
      email: 'partner@vance-capital.com',
      pass: 'Partner@12345',
      pin: '1234',
      icon: FileCheck2,
      accentColor: 'cyan',
      badgeStyle: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20',
      scopeSummary: 'Institutional valuation partner workspace: confidential deal appraisal, scope sign-offs, with internal rates securely masked.',
      accessHighlights: ['Partner Pipeline', 'Deal Evaluation', 'NDA Workspace']
    }
  ];

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        setActiveTab('profile');
        if (onSuccess) onSuccess();
      } else if (!res.cancelled) {
        setErrorMessage(res.message || 'Google Sign-In failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setGithubLoading(true);
    setErrorMessage(null);
    try {
      const res = await loginWithOAuth('github', {
        name: 'GitHub Engineer',
        email: 'dev@agencyops.dev',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
      });
      if (res.success) {
        setActiveTab('profile');
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(res.message || 'GitHub OAuth failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication error during GitHub sign-in.');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!passwordOrPin) {
      setErrorMessage('Please enter your password or 4-digit PIN (default PIN: 1234).');
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    const res = await login(emailInput.trim(), passwordOrPin);
    setLoading(false);

    if (res.success) {
      setActiveTab('profile');
      if (onSuccess) onSuccess();
    } else {
      setErrorMessage(res.message || 'Authentication failed. Please verify credentials or use quick PIN 1234.');
    }
  };

  const handleQuickSignIn = async (p: typeof personas[0]) => {
    setSelectedRole(p.role);
    setEmailInput(p.email);
    setPasswordOrPin(p.pin || '1234');
    setLoading(true);
    setErrorMessage(null);

    const res = await login(p.email, p.pin || p.pass);
    setLoading(false);

    if (res.success) {
      showToast(`Welcome ${p.name}! Session established as ${p.title}.`, 'info');
      setActiveTab('profile');
      if (onSuccess) onSuccess();
    } else {
      setErrorMessage(res.message || 'Quick login failed.');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-3 sm:px-6 animate-fadeIn">
      
      {/* Top Header Bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-white/10 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 dark:text-white tracking-tight text-lg">
                ALM Nexus Enterprise
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                Clerk &amp; Neon DB
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Secure Authentication Gateway &bull; Multi-Tenant Workspace Hub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle variant="segmented" showLabels={false} />
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/20 overflow-hidden relative">
        
        {/* Verification Ribbon */}
        <div className="mb-6 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Clerk Session Guard: <strong>Active</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Database className="w-4 h-4 text-indigo-500" />
            <span>Neon DB: <strong>Row-Level Tenant Isolation</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Mail className="w-4 h-4 text-purple-500" />
            <span>Resend Dispatch: <strong>re_LXiiEzAS...</strong></span>
          </div>
        </div>

        {/* View Switcher Tabs: Gateway vs Demo Personas */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAuthMode('gateway')}
              className={`px-5 py-2 rounded-xl transition cursor-pointer flex items-center gap-2 ${
                authMode === 'gateway'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Authentication Gateway (Email &bull; Google &bull; GitHub)</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('personas')}
              className={`px-5 py-2 rounded-xl transition cursor-pointer flex items-center gap-2 ${
                authMode === 'personas'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Demo Enterprise Roles</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* MODE 1: Standard Authentication Gateway */}
        {authMode === 'gateway' ? (
          <div className="max-w-xl mx-auto space-y-6 animate-fadeIn">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Sign in to Your Account
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Access your personal profile, register your company, and open isolated workspaces.
              </p>
            </div>

            {/* Social / SSO Auth Buttons: Google & GitHub */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Google Workspace */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{googleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
              </button>

              {/* GitHub OAuth */}
              <button
                type="button"
                onClick={handleGitHubSignIn}
                disabled={githubLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>{githubLoading ? 'Signing in with GitHub...' : 'Continue with GitHub'}</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 dark:border-white/10 w-full" />
              <span className="bg-white dark:bg-[#0a0f1d] px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
                Or sign in with email
              </span>
            </div>

            {/* Direct Email / Password Form */}
            <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/80 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition"
                  />
                </div>

                {/* Quick email presets chips */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                  <span className="text-slate-400">Quick fill:</span>
                  {[
                    { label: 'CEO', email: 'admin@agencyops.dev' },
                    { label: 'Lead Dev', email: 'dev@agencyops.dev' },
                    { label: 'Sales', email: 'sales@agencyops.dev' },
                    { label: 'Client', email: 'client@lumina-health.co.uk' }
                  ].map(c => (
                    <button
                      key={c.email}
                      type="button"
                      onClick={() => setEmailInput(c.email)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Password or 4-Digit PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => setPasswordOrPin('1234')}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Quick PIN (1234)
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={passwordOrPin}
                    onChange={e => setPasswordOrPin(e.target.value)}
                    placeholder="Enter password or 1234"
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/80 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span>Verifying Session...</span>
                ) : (
                  <>
                    <span>Sign In to Personal Profile &amp; Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Strict Neon DB multi-tenant isolation and Clerk session verification enforced</span>
            </div>
          </div>
        ) : (
          /* MODE 2: Demo Enterprise Roles Grid */
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center space-y-1 max-w-xl mx-auto">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Select a Demo Enterprise Persona
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instantly authenticate with pre-configured organizational privileges to inspect dashboards and features.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {personas.map(p => {
                const Icon = p.icon;
                const isSelected = selectedRole === p.role;

                return (
                  <div
                    key={p.role}
                    onClick={() => {
                      setSelectedRole(p.role);
                      setEmailInput(p.email);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-bold border font-mono ${p.badgeStyle}`}>
                              {p.role.toUpperCase()}
                            </span>
                            <div className="font-bold text-xs text-slate-900 dark:text-white mt-0.5">
                              {p.name}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        )}
                      </div>

                      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {p.title}
                      </p>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                        {p.scopeSummary}
                      </p>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {p.accessHighlights.map((hl, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {hl}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono">
                        PIN: 1234
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickSignIn(p);
                        }}
                        disabled={loading}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <span>Instant Login</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
