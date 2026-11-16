import React, { useState } from 'react';
import {
  Building2,
  ArrowRight,
  Check,
  LogOut,
  Mail,
  Plus,
  Layers,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ThemeToggle } from './ThemeToggle';

const PRESET_DEPARTMENTS = ['Operations', 'Engineering', 'Sales', 'Design', 'Support'];

export const CompanyOnboardingView: React.FC = () => {
  const {
    currentUser,
    pendingInvites,
    invitePreview,
    acceptInvite,
    createCompany,
    logout
  } = useApp();

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('Software & Technology');
  const [companySize, setCompanySize] = useState('1-10 employees');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['Operations', 'Engineering']);
  const [customDeptInput, setCustomDeptInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const handleAddCustomDept = () => {
    const clean = customDeptInput.trim();
    if (!clean) return;
    if (!selectedDepts.some((d) => d.toLowerCase() === clean.toLowerCase())) {
      setSelectedDepts((prev) => [...prev, clean]);
    }
    setCustomDeptInput('');
  };

  const handleCreateFirstCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || companyName.trim().length < 2) {
      setError('Please enter your Company Name (at least 2 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);
    const res = await createCompany({
      name: companyName.trim(),
      industry,
      size: companySize,
      initialDepartments: selectedDepts.length > 0 ? selectedDepts : ['Operations']
    });
    setSubmitting(false);

    if (!res.success) {
      setError(res.message || 'Could not create company.');
    }
  };

  const handleAccept = async (token: string) => {
    setAcceptingToken(token);
    setError(null);
    const res = await acceptInvite(token);
    setAcceptingToken(null);
    if (!res.success) {
      setError(res.message || 'Could not accept invitation.');
    }
  };

  const allPendingCards = [...pendingInvites];
  if (
    invitePreview &&
    !allPendingCards.some((inv) => inv.token === invitePreview.token)
  ) {
    allPendingCards.unshift(invitePreview);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] bg-canvas-textured text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#090D16]/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight text-slate-950 dark:text-white">
              ClientOps
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
              {currentUser?.name} ({currentUser?.email})
            </span>
            <ThemeToggle variant="compact" />
            <button
              type="button"
              onClick={logout}
              className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-2xl space-y-6 animate-fadeIn">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Pending Invitations Section */}
          {allPendingCards.length > 0 && (
            <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Pending Company Invitations</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Accept an invitation to join an existing company department immediately.
                </p>
              </div>

              <div className="space-y-3">
                {allPendingCards.map((inv) => {
                  const emailMismatch =
                    currentUser?.email.toLowerCase() !== inv.email.toLowerCase();
                  return (
                    <div
                      key={inv.id || inv.token}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-950 dark:text-white">
                          {inv.companyName}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          Department: <strong>{inv.departmentName}</strong> &middot;{' '}
                          <span>{inv.role === 'department_head' ? 'Department Head' : 'Employee'}</span> &middot;{' '}
                          <span>{inv.designation}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Invited by {inv.invitedByName} &middot; Issued to {inv.email}
                        </div>
                        {emailMismatch && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            Sign in with {inv.email} to accept this invitation.
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={emailMismatch || acceptingToken === inv.token}
                        onClick={() => handleAccept(inv.token)}
                        className="btn-tactile-primary inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        <span>
                          {acceptingToken === inv.token ? 'Joining...' : 'Accept & Join Company'}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Create Your First Company Form */}
          <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <Building2 className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                Create Your First Company
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Welcome, {currentUser?.name}. Register your company workspace to organize departments, invite heads and employees, and manage deals in complete isolation.
              </p>
            </div>

            <form onSubmit={handleCreateFirstCompany} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Company Name
                </label>
                <input
                  id="input-first-company-name"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Northstar Logistics Ltd"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Industry
                  </label>
                  <select
                    id="select-first-company-industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  >
                    <option value="Software & Technology">Software &amp; Technology</option>
                    <option value="Digital Agency & Consulting">Digital Agency &amp; Consulting</option>
                    <option value="Logistics & Supply Chain">Logistics &amp; Supply Chain</option>
                    <option value="Financial Services">Financial Services</option>
                    <option value="E-Commerce & Retail">E-Commerce &amp; Retail</option>
                    <option value="Healthcare & Biotech">Healthcare &amp; Biotech</option>
                    <option value="Other B2B Services">Other B2B Services</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Company Size
                  </label>
                  <select
                    id="select-first-company-size"
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  >
                    <option value="1-10 employees">1–10 employees</option>
                    <option value="11-50 employees">11–50 employees</option>
                    <option value="51-200 employees">51–200 employees</option>
                    <option value="200+ employees">200+ employees</option>
                  </select>
                </div>
              </div>

              {/* Starter Departments */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Starter Departments
                </label>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set([...PRESET_DEPARTMENTS, ...selectedDepts])).map((dept) => {
                    const active = selectedDepts.includes(dept);
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => toggleDept(dept)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-[#F8FAFC] dark:bg-[#090D16] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                        <span>{dept}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customDeptInput}
                    onChange={(e) => setCustomDeptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomDept();
                      }
                    }}
                    placeholder="Add custom department name..."
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomDept}
                    className="btn-tactile-secondary px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-create-first-company"
                disabled={submitting}
                className="btn-tactile-primary w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{submitting ? 'Creating Company Workspace...' : 'Create Company Workspace'}</span>
                {!submitting && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};
