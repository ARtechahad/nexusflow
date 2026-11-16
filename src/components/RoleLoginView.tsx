import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  Building2
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export type AuthTabMode = 'signin' | 'signup';

interface RoleLoginViewProps {
  initialMode?: AuthTabMode;
  onSuccess?: () => void;
}

interface PendingVerificationState {
  email: string;
  fullName: string;
  deliveryProvider?: string;
}

export const RoleLoginView: React.FC<RoleLoginViewProps> = ({
  initialMode = 'signin',
  onSuccess
}) => {
  const {
    login,
    requestSignupOtp,
    resendSignupOtp,
    verifySignupOtp,
    inviteToken,
    invitePreview,
    acceptInvite,
    showToast
  } = useApp();

  const [mode, setMode] = useState<AuthTabMode>(initialMode);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Sign In fields
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Individual-first Create Account fields (NO Company Name here)
  const [fullName, setFullName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

  // Email OTP Verification state
  const [verificationStep, setVerificationStep] = useState<PendingVerificationState | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [resendingCode, setResendingCode] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Forgot Password fields
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    setShowForgotPassword(false);
    setVerificationStep(null);
    setOtpDigits(['', '', '', '', '', '']);
    setErrorMessage(null);
    setStatusMessage(null);
  }, [initialMode]);

  // Pre-fill email if arriving from an invite link
  useEffect(() => {
    if (invitePreview?.email) {
      setSignInEmail((prev) => prev || invitePreview.email);
      setSignUpEmail((prev) => prev || invitePreview.email);
    }
  }, [invitePreview?.email]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (verificationStep) {
      const id = window.setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 60);
      return () => window.clearTimeout(id);
    }
  }, [verificationStep]);

  const handleTabSwitch = (nextMode: AuthTabMode) => {
    setMode(nextMode);
    setShowForgotPassword(false);
    setVerificationStep(null);
    setOtpDigits(['', '', '', '', '', '']);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = signInEmail.trim();
    if (!email || !signInPassword) {
      setErrorMessage('Please enter your email address and password.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await login(email, signInPassword);
      if (res.success) {
        if (inviteToken) {
          await acceptInvite(inviteToken);
        }
        onSuccess?.();
      } else {
        setErrorMessage(res.message || 'Invalid email address or password.');
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
    const cleanEmail = signUpEmail.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !signUpPassword) {
      setErrorMessage('Please enter your full name, email address, and password.');
      return;
    }
    if (signUpPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await requestSignupOtp({
        fullName: cleanName,
        email: cleanEmail,
        password: signUpPassword
      });

      if (res.success) {
        setVerificationStep({
          email: res.email || cleanEmail,
          fullName: cleanName,
          deliveryProvider: res.deliveryProvider
        });
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(res.cooldownSeconds || 30);
        setStatusMessage(res.message || `We sent a 6-digit code to ${cleanEmail}.`);
      } else {
        if (typeof res.retryAfterSeconds === 'number' && res.retryAfterSeconds > 0) {
          setResendCooldown(res.retryAfterSeconds);
        }
        setErrorMessage(res.message || 'Could not send verification code.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while requesting verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpInputChange = (index: number, rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, '');
    setErrorMessage(null);

    if (!digitsOnly) {
      const next = [...otpDigits];
      next[index] = '';
      setOtpDigits(next);
      return;
    }

    if (digitsOnly.length > 1) {
      const next = [...otpDigits];
      for (let i = 0; i < 6 && index + i < 6; i++) {
        if (digitsOnly[i]) {
          next[index + i] = digitsOnly[i];
        }
      }
      setOtpDigits(next);
      const nextFocus = Math.min(index + digitsOnly.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const next = [...otpDigits];
    next[index] = digitsOnly;
    setOtpDigits(next);
    if (index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = '';
        setOtpDigits(next);
      } else if (index > 0) {
        const next = [...otpDigits];
        next[index - 1] = '';
        setOtpDigits(next);
        otpInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    setErrorMessage(null);
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();
  };

  const combinedOtp = otpDigits.join('');

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationStep) return;

    if (!/^\d{6}$/.test(combinedOtp)) {
      setErrorMessage('Please enter all 6 digits of your verification code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await verifySignupOtp(verificationStep.email, combinedOtp);
      if (res.success) {
        if (inviteToken) {
          await acceptInvite(inviteToken);
        }
        onSuccess?.();
      } else {
        setErrorMessage(res.message || 'Invalid or expired verification code.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to verify email code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!verificationStep || resendCooldown > 0 || resendingCode) return;

    setResendingCode(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await resendSignupOtp(verificationStep.email);
      if (res.success) {
        setOtpDigits(['', '', '', '', '', '']);
        setResendCooldown(res.cooldownSeconds || 30);
        setStatusMessage(res.message || `A new 6-digit code was sent to ${verificationStep.email}.`);
        otpInputRefs.current[0]?.focus();
      } else {
        if (typeof res.retryAfterSeconds === 'number' && res.retryAfterSeconds > 0) {
          setResendCooldown(res.retryAfterSeconds);
        }
        setErrorMessage(res.message || 'Unable to resend verification code.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while resending code.');
    } finally {
      setResendingCode(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = resetEmail.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
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
      <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5">
        {/* Clean Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-xs">
            {verificationStep ? <ShieldCheck className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
          </div>
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white tracking-tight">
            {verificationStep
              ? 'Enter Verification Code'
              : showForgotPassword
              ? 'Reset Your Password'
              : mode === 'signin'
              ? 'Sign in to ClientOps'
              : 'Create Your Personal Account'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {verificationStep ? (
              <>
                Enter the 6-digit verification code sent to{' '}
                <strong className="text-slate-900 dark:text-white">{verificationStep.email}</strong>.
                <br />
                Code expires in 10 minutes.
              </>
            ) : showForgotPassword ? (
              'Enter your email address and we will send recovery instructions.'
            ) : mode === 'signin' ? (
              'Sign in to manage your companies, departments, and operations.'
            ) : (
              'Register your personal profile first, then create or join a company.'
            )}
          </p>
        </div>

        {/* Invitation Banner if opened from an invite link */}
        {invitePreview && !verificationStep && !showForgotPassword && (
          <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/35 border border-indigo-200 dark:border-indigo-500/30 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-200">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Team Invitation: {invitePreview.companyName}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>{invitePreview.invitedByName}</strong> invited <strong>{invitePreview.email}</strong> to{' '}
              <strong>{invitePreview.departmentName}</strong> as{' '}
              <strong>{invitePreview.role === 'department_head' ? 'Department Head' : 'Employee'}</strong> ({invitePreview.designation}).
            </p>
          </div>
        )}

        {/* Two Simple Tabs: Sign In & Create Account */}
        {!showForgotPassword && !verificationStep && (
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

        {/* Inline Status Notice */}
        {statusMessage && !errorMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* EMAIL OTP VERIFICATION VIEW */}
        {verificationStep ? (
          <form onSubmit={handleVerifyOtpSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 text-center">
                6-Digit Verification Code
              </label>
              <div className="grid grid-cols-6 gap-2 sm:gap-2.5" id="otp-input-group">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`input-otp-digit-${idx}`}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpInputChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    aria-label={`Verification digit ${idx + 1}`}
                    className="h-12 text-center text-lg font-mono font-bold tabular-nums rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/35 focus:border-indigo-500 transition"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              id="btn-verify-email-submit"
              disabled={loading || combinedOtp.length !== 6}
              className="btn-tactile-primary w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? 'Verifying Email...' : 'Verify Email'}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                id="btn-otp-back"
                onClick={() => {
                  setVerificationStep(null);
                  setOtpDigits(['', '', '', '', '', '']);
                  setErrorMessage(null);
                  setStatusMessage(null);
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Edit details</span>
              </button>

              <button
                type="button"
                id="btn-resend-otp"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || resendingCode}
                className="btn-tactile-secondary px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed tabular-nums"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resendingCode ? 'animate-spin' : ''}`} />
                <span>
                  {resendingCode
                    ? 'Sending...'
                    : resendCooldown > 0
                    ? `Resend Code (${resendCooldown}s)`
                    : 'Resend Code'}
                </span>
              </button>
            </div>
          </form>
        ) : showForgotPassword ? (
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
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@domain.com"
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
          <form onSubmit={handleSignInSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-signin-email"
                  type="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="you@domain.com"
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
        ) : (
          /* INDIVIDUAL-FIRST CREATE ACCOUNT TAB (ONLY Full Name, Email, Password) */
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
                  placeholder="Ahad Rana"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-signup-email"
                  type="email"
                  required
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  placeholder="you@domain.com"
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
              <span>{loading ? 'Sending Verification Code...' : 'Continue & Verify Email'}</span>
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
