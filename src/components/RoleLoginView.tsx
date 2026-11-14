import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  User,
  Building2,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type AuthTabMode = 'signin' | 'signup';

interface RoleLoginViewProps {
  initialMode?: AuthTabMode;
  onSuccess?: () => void;
}

export const RoleLoginView: React.FC<RoleLoginViewProps> = ({
  initialMode = 'signin',
  onSuccess
}) => {
  const {
    login,
    loginWithGoogle,
    onboardNewTenant,
    setActiveTab,
    showToast
  } = useApp();

  const [mode, setMode] = useState<AuthTabMode>(initialMode);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Sign In fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Create Account fields
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  // Forgot Password fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setShowForgotPassword(false);
    setErrorMessage(null);
  }, [initialMode]);

  const handleTabSwitch = (nextMode: AuthTabMode) => {
    setMode(nextMode);
    setShowForgotPassword(false);
    setErrorMessage(null);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      const res = await loginWithGoogle();
      if (res.success) {
        setActiveTab('pipeline');
        onSuccess?.();
      } else if (!res.cancelled) {
        setErrorMessage(res.message || 'Unable to sign in with Google.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = signInEmail.trim();
    if (!email || !signInPassword) {
      setErrorMessage('Please enter your work email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await login(email, signInPassword);
      if (res.success) {
        setActiveTab('pipeline');
        onSuccess?.();
      } else {
        setErrorMessage(res.message || 'Invalid work email or password.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanCompany = companyName.trim();
    const cleanEmail = signUpEmail.trim();

    if (!cleanName || !cleanCompany || !cleanEmail || !signUpPassword) {
      setErrorMessage('Please complete all fields to create your workspace.');
      return;
    }
    if (signUpPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await onboardNewTenant({
        companyName: cleanCompany,
        businessInfo: {
          industry: 'Operations & Client Services',
          description: `${cleanCompany} company operations workspace`
        },
        adminUser: {
          name: cleanName,
          email: cleanEmail,
          password: signUpPassword,
          title: 'Workspace Owner'
        }
      });

      if (res.success) {
        setActiveTab('pipeline');
        onSuccess?.();
      } else {
        setErrorMessage(res.message || 'Could not create workspace.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while creating workspace.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your work email address.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResetSent(true);
        showToast('Password reset instructions sent if an account exists.', 'info');
      } else {
        setErrorMessage(data.message || 'Unable to send reset email.');
      }
    } catch {
      setErrorMessage('Network error while requesting password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fadeIn">
      <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Clean Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            {showForgotPassword
              ? 'Reset Your Password'
              : mode === 'signin'
              ? 'Sign in to ClientOps'
              : 'Create Your Company Workspace'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {showForgotPassword
              ? 'Enter your work email and we will send recovery instructions.'
              : mode === 'signin'
              ? 'Enter your workspace credentials to access your operations dashboard.'
              : 'Set up your account and launch your workspace in seconds.'}
          </p>
        </div>

        {/* Two Simple Tabs: Sign In & Create Account */}
        {!showForgotPassword && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleTabSwitch('signin')}
              className={`py-2 rounded-lg transition cursor-pointer ${
                mode === 'signin'
                  ? 'bg-[#FFFFFF] dark:bg-[#1E293B] text-slate-950 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('signup')}
              className={`py-2 rounded-lg transition cursor-pointer ${
                mode === 'signup'
                  ? 'bg-[#FFFFFF] dark:bg-[#1E293B] text-slate-950 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Inline Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* FORGOT PASSWORD VIEW */}
        {showForgotPassword ? (
          resetSent ? (
            <div className="space-y-4 text-center py-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Recovery instructions have been sent to <strong className="text-slate-950 dark:text-white">{resetEmail}</strong> if an account matches.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                }}
                className="btn-tactile-secondary w-full py-2.5 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-tactile-primary w-full py-2.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setErrorMessage(null);
                }}
                className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
              >
                Back to Sign In
              </button>
            </form>
          )
        ) : mode === 'signin' ? (
          /* SIGN IN TAB */
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="btn-tactile-secondary w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
              <span>{googleLoading ? 'Connecting Google...' : 'Continue with Google'}</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="bg-[#FFFFFF] dark:bg-[#111827] px-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">
                or
              </span>
            </div>

            <form onSubmit={handleSignInSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-signin-email"
                    type="email"
                    required
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(signInEmail);
                      setShowForgotPassword(true);
                      setErrorMessage(null);
                    }}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-signin-password"
                    type="password"
                    required
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-signin-submit"
                disabled={loading}
                className="btn-tactile-primary w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? 'Signing In...' : 'Sign In'}</span>
                {!loading && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>
          </div>
        ) : (
          /* CREATE ACCOUNT TAB */
          <form onSubmit={handleCreateAccountSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-signup-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Company / Workspace Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-signup-company"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Northstar Operations Ltd"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-signup-email"
                  type="email"
                  required
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="alex@northstar.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-signup-password"
                  type="password"
                  required
                  minLength={6}
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              id="btn-signup-submit"
              disabled={loading}
              className="btn-tactile-primary w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Creating Workspace...' : 'Create Workspace'}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
