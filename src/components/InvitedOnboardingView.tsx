import React, { useState } from 'react';
import {
  Building2,
  Mail,
  User,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  LogOut,
  CheckCircle2
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
    acceptInvite,
    login,
    logout,
    completeInviteOnboarding
  } = useApp();

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearInviteAndReturnHome = () => {
    setInviteToken(null);
    if (typeof window !== 'undefined' && window.location.search.includes('invite=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  };

  if (inviteLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] flex items-center justify-center p-4">
        <div className="w-full max-w-md card-elevated rounded-xl p-8 text-center space-y-3">
          <Loader2 className="w-7 h-7 text-[#4F46E5] dark:text-indigo-400 animate-spin mx-auto" />
          <h1 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight">
            Verifying Invitation
          </h1>
          <p className="text-xs text-[#64748B] dark:text-slate-400">
            Checking workspace access and department details...
          </p>
        </div>
      </div>
    );
  }

  if (inviteError || !invitePreview) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] flex items-center justify-center p-4">
        <div className="w-full max-w-md card-elevated rounded-xl p-7 text-center space-y-4">
          <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-[#0F172A] dark:text-white tracking-tight">
              Invitation Unavailable
            </h1>
            <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
              {inviteError || 'This invitation link is invalid, expired, or has already been accepted.'}
            </p>
          </div>
          <button
            type="button"
            onClick={clearInviteAndReturnHome}
            className="btn-tactile-primary w-full py-2.5 px-4 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Return to ClientOps
          </button>
        </div>
      </div>
    );
  }

  const roleLabel =
    invitePreview.role === 'department_head' ? 'Department Head' : 'Team Member';

  const currentEmail = (currentUser?.email || '').trim().toLowerCase();
  const inviteEmail = (invitePreview.email || '').trim().toLowerCase();
  const isMatchingLoggedInUser = Boolean(currentUser && currentEmail === inviteEmail);
  const isMismatchedLoggedInUser = Boolean(currentUser && currentEmail !== inviteEmail);

  // Case A1: Logged in with matching email -> Focused Accept card
  const handleAcceptAuthenticatedInvite = async () => {
    if (!inviteToken) return;
    setSubmitting(true);
    setErrorMessage(null);
    const res = await acceptInvite(inviteToken);
    setSubmitting(false);
    if (!res.success) {
      setErrorMessage(res.message || 'Could not accept invitation.');
    }
  };

  // Case B: Logged out + existing user -> Password sign-in + auto-accept invite
  const handleExistingUserSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) return;
    setErrorMessage(null);
    if (!password) {
      setErrorMessage('Please enter your password to sign in and join.');
      return;
    }

    setSubmitting(true);
    const loginRes = await login(invitePreview.email, password);
    if (!loginRes.success) {
      setSubmitting(false);
      setErrorMessage(loginRes.message || 'Incorrect password. Please try again.');
      return;
    }

    const acceptRes = await acceptInvite(inviteToken);
    setSubmitting(false);
    if (!acceptRes.success) {
      setErrorMessage(acceptRes.message || 'Signed in, but could not accept invitation.');
    }
  };

  // Case C: Logged out + brand new user -> Full Name + Password in one step
  const handleNewUserSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken) return;
    setErrorMessage(null);

    if (fullName.trim().length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Please create a password with at least 6 characters.');
      return;
    }

    setSubmitting(true);
    const res = await completeInviteOnboarding(inviteToken, {
      fullName: fullName.trim(),
      password
    });
    setSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message || 'Could not complete your account setup.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-[#0F172A] dark:text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md card-elevated rounded-xl overflow-hidden animate-fadeIn">
        {/* Clean Header */}
        <div className="p-6 border-b border-[#E2E8F0] dark:border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#4F46E5] text-white flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-[#64748B] dark:text-slate-400 block">
                Workspace Invitation &middot; Invited by {invitePreview.invitedByName}
              </span>
              <h1 className="text-lg font-bold text-[#0F172A] dark:text-white tracking-tight truncate">
                {isMatchingLoggedInUser
                  ? `Join ${invitePreview.companyName}`
                  : isMismatchedLoggedInUser
                  ? `Switch Account to Join`
                  : invitePreview.userExists
                  ? `Sign in to join ${invitePreview.companyName}`
                  : `Set up your account to join ${invitePreview.companyName}`}
              </h1>
            </div>
          </div>

          <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
            You&apos;ve been invited to join{' '}
            <strong className="text-[#0F172A] dark:text-white">{invitePreview.companyName}</strong>{' '}
            ({invitePreview.departmentName} &middot; {roleLabel}).
          </p>
        </div>

        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* CASE A1: Logged in with matching email */}
          {isMatchingLoggedInUser && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-[#E2E8F0] dark:border-slate-800 flex items-center gap-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[#64748B] dark:text-slate-400 block">Signed in as</span>
                  <span className="font-semibold text-[#0F172A] dark:text-white truncate block">
                    {currentUser?.name} ({currentUser?.email})
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleAcceptAuthenticatedInvite}
                className="btn-tactile-primary w-full py-2.5 px-4 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Joining Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Accept &amp; Open Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={clearInviteAndReturnHome}
                className="w-full text-center text-xs text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                Decline &amp; return to workspace
              </button>
            </div>
          )}

          {/* CASE A2: Logged in with a different email */}
          {isMismatchedLoggedInUser && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                You&apos;re signed in as <strong>{currentUser?.email}</strong>, but this invite is
                for <strong>{invitePreview.email}</strong>. Switch account to accept.
              </div>

              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  logout();
                }}
                className="btn-tactile-primary w-full py-2.5 px-4 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Switch Account to Accept</span>
              </button>

              <button
                type="button"
                onClick={clearInviteAndReturnHome}
                className="w-full text-center text-xs text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                Cancel &amp; return to current workspace
              </button>
            </div>
          )}

          {/* CASE B: Logged out + existing account */}
          {!currentUser && invitePreview.userExists && (
            <form onSubmit={handleExistingUserSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1">
                  Invited Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    readOnly
                    value={invitePreview.email}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-slate-100 dark:bg-slate-800/70 text-xs font-medium text-[#64748B] dark:text-slate-300 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="invite-signin-password"
                  className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="invite-signin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your existing password"
                    className="w-full pl-9 pr-9 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white focus:border-[#4F46E5] focus:outline-hidden"
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

              <button
                type="submit"
                disabled={submitting}
                className="btn-tactile-primary w-full py-2.5 px-4 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in &amp; Joining...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In &amp; Join {invitePreview.companyName}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={clearInviteAndReturnHome}
                className="w-full text-center text-xs text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}

          {/* CASE C: Logged out + brand new teammate */}
          {!currentUser && !invitePreview.userExists && (
            <form onSubmit={handleNewUserSetup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    readOnly
                    value={invitePreview.email}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-slate-100 dark:bg-slate-800/70 text-xs font-medium text-[#64748B] dark:text-slate-300 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="invite-full-name"
                  className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="invite-full-name"
                    type="text"
                    required
                    autoFocus
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white focus:border-[#4F46E5] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="invite-password"
                  className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1"
                >
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="invite-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-9 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white focus:border-[#4F46E5] focus:outline-hidden"
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

              <button
                type="submit"
                disabled={submitting}
                className="btn-tactile-primary w-full py-2.5 px-4 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account &amp; Join {invitePreview.departmentName}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={clearInviteAndReturnHome}
                className="w-full text-center text-xs text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
