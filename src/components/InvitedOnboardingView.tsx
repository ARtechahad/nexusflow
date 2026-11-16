import React, { useState, useEffect } from 'react';
import {
  Building2,
  Layers,
  ShieldCheck,
  Mail,
  User,
  Lock,
  Phone,
  Briefcase,
  FileText,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const InvitedOnboardingView: React.FC = () => {
  const {
    currentUser,
    inviteToken,
    setInviteToken,
    invitePreview,
    inviteLoading,
    inviteError,
    completeInviteOnboarding
  } = useApp();

  const isSameSignedInUser = Boolean(
    currentUser &&
      invitePreview &&
      currentUser.email.trim().toLowerCase() === invitePreview.email.trim().toLowerCase()
  );

  const [fullName, setFullName] = useState(currentUser?.name || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [title, setTitle] = useState(invitePreview?.designation || currentUser?.title || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (invitePreview) {
      setTitle((prev) => prev || invitePreview.designation || '');
    }
    if (currentUser) {
      setFullName((prev) => prev || currentUser.name || '');
      setPhone((prev) => prev || currentUser.phone || '');
      setBio((prev) => prev || currentUser.bio || '');
    }
  }, [invitePreview, currentUser]);

  const clearInviteAndReturnHome = () => {
    setInviteToken(null);
    if (typeof window !== 'undefined' && window.location.search.includes('invite=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken || !invitePreview) return;
    setErrorMessage(null);

    if (fullName.trim().length < 2) {
      setErrorMessage('Please enter your Full Name (at least 2 characters).');
      return;
    }

    if (!isSameSignedInUser) {
      if (!invitePreview.userExists && password.length < 6) {
        setErrorMessage('Please create a password with at least 6 characters.');
        return;
      }
      if (invitePreview.userExists && !password) {
        setErrorMessage('Please enter your existing account password to verify and join.');
        return;
      }
    }

    if (phone.trim().length < 3) {
      setErrorMessage('Please enter your Phone Number to complete your profile.');
      return;
    }

    setSubmitting(true);
    const res = await completeInviteOnboarding(inviteToken, {
      fullName: fullName.trim(),
      password,
      phone: phone.trim(),
      title: title.trim() || invitePreview.designation,
      bio: bio.trim()
    });
    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message || 'Could not complete your profile setup.');
    }
  };

  if (inviteLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] bg-canvas-textured flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xl p-8 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
          <h1 className="text-base font-bold text-slate-950 dark:text-white">
            Verifying Your Invitation
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Checking your assigned company and department access...
          </p>
        </div>
      </div>
    );
  }

  if (inviteError || !invitePreview) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] bg-canvas-textured flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xl p-7 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-slate-950 dark:text-white">
              Invitation Unavailable
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {inviteError || 'This invitation link is invalid, expired, or has already been accepted.'}
            </p>
          </div>
          <button
            type="button"
            onClick={clearInviteAndReturnHome}
            className="btn-tactile-primary w-full py-2.5 px-4 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Return to ClientOps
          </button>
        </div>
      </div>
    );
  }

  const roleLabel =
    invitePreview.role === 'department_head' ? 'Department Head' : 'Department Employee';

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] bg-canvas-textured text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0B1120] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400 block">
                  Team Invitation
                </span>
                <h1 className="text-lg sm:text-xl font-bold text-slate-950 dark:text-white tracking-tight">
                  Complete Your Profile
                </h1>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              {roleLabel}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            You have been invited by <strong>{invitePreview.invitedByName}</strong> to join{' '}
            <strong>{invitePreview.companyName}</strong> inside the{' '}
            <strong>{invitePreview.departmentName}</strong> department. Complete your personal profile
            to enter your workspace.
          </p>

          {/* Assigned Company & Department Summary Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
            <div className="px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Company</span>
                <span className="font-semibold text-slate-950 dark:text-white truncate block">
                  {invitePreview.companyName}
                </span>
              </div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  Assigned Department
                </span>
                <span className="font-semibold text-slate-950 dark:text-white truncate block">
                  {invitePreview.departmentName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Read-Only Invited Work Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Invited Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                readOnly
                value={invitePreview.email}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/70 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Full Name */}
            <div>
              <label
                htmlFor="invite-full-name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="invite-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="invite-phone"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="invite-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Password */}
            {!isSameSignedInUser && (
              <div>
                <label
                  htmlFor="invite-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {invitePreview.userExists ? 'Confirm Account Password' : 'Create Password'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="invite-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={invitePreview.userExists ? 1 : 6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      invitePreview.userExists ? 'Enter your password' : 'Minimum 6 characters'
                    }
                    className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white focus:border-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Job Title / Designation */}
            <div className={isSameSignedInUser ? 'sm:col-span-2' : ''}>
              <label
                htmlFor="invite-title"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Job Title / Designation
              </label>
              <div className="relative">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="invite-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sales Lead, Backend Engineer"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Short Bio */}
          <div>
            <label
              htmlFor="invite-bio"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Short Bio &amp; Focus Area
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <textarea
                id="invite-bio"
                rows={2}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Briefly describe your role, timezone, or responsibilities for your department teammates..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white focus:border-indigo-500 outline-none resize-none"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={submitting}
              className="btn-tactile-primary w-full py-2.5 px-4 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Setting Up Your Profile...</span>
                </>
              ) : (
                <>
                  <span>Save Profile &amp; Enter {invitePreview.departmentName}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Department-scoped access
              </span>
              <button
                type="button"
                onClick={clearInviteAndReturnHome}
                className="hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
              >
                Cancel &amp; Return Home
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
