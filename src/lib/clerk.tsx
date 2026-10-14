import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
  useAuth
} from '@clerk/clerk-react';
import { Shield, Key, AlertCircle } from 'lucide-react';

// Global error listener to intercept and silence Clerk JS CDN timeout errors in iframe/preview environments
if (typeof window !== 'undefined') {
  const isClerkTimeoutMessage = (msg: unknown) => {
    if (typeof msg !== 'string') return false;
    return (
      msg.includes('failed_to_load_clerk_js_timeout') ||
      msg.includes('Failed to load Clerk') ||
      msg.includes('@clerk/clerk-react') ||
      msg.includes('clerk.accounts.dev')
    );
  };

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      const msg = event?.message || event?.error?.message || '';
      if (isClerkTimeoutMessage(msg)) {
        console.warn('[Clerk] Intercepted and silenced Clerk.js CDN timeout in sandbox/preview:', msg);
        try {
          sessionStorage.setItem('clerk_load_failed', 'true');
        } catch {}
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      const msg = event?.reason?.message || String(event?.reason || '');
      if (isClerkTimeoutMessage(msg)) {
        console.warn('[Clerk] Intercepted and silenced unhandled Clerk timeout rejection:', msg);
        try {
          sessionStorage.setItem('clerk_load_failed', 'true');
        } catch {}
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    },
    true
  );
}

interface ClerkContextValue {
  isConfigured: boolean;
  publishableKey: string | null;
  clerkToken: string | null;
}

const ClerkCustomContext = createContext<ClerkContextValue>({
  isConfigured: false,
  publishableKey: null,
  clerkToken: null
});

export const useClerkContext = () => useContext(ClerkCustomContext);

/**
 * Resolves Clerk Publishable Key from Vite env or window
 * Safely filters out dead development placeholder keys and iframe-blocked domains.
 */
export function getClerkPublishableKey(): string | null {
  if (typeof window !== 'undefined') {
    // 1. If previously timed out in this session or explicitly disabled, do not attempt to reload
    if (
      sessionStorage.getItem('clerk_load_failed') === 'true' ||
      localStorage.getItem('clerk_disabled') === 'true'
    ) {
      return null;
    }

    // 2. In iframe environments (AI Studio preview: window.self !== window.top),
    // development instances (*.clerk.accounts.dev) fail with frame-ancestors restrictions
    // and trigger failed_to_load_clerk_js_timeout.
    const isInIframe = window.self !== window.top;
    const rawKey =
      import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
      (window as any).__CLERK_PUBLISHABLE_KEY__;

    if (
      isInIframe &&
      typeof rawKey === 'string' &&
      (rawKey.includes('patient-gazelle') || rawKey.includes('cGF0aWVudC1nYXplbGxl') || rawKey.startsWith('pk_test_'))
    ) {
      // In sandbox iframe preview, bypass placeholder development test keys that cannot be framed
      return null;
    }
  }

  const key =
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    (typeof window !== 'undefined' ? (window as any).__CLERK_PUBLISHABLE_KEY__ : null);

  if (typeof key === 'string') {
    const trimmed = key.trim();
    // Inactive placeholder keys should be bypassed
    if (trimmed.includes('patient-gazelle') || trimmed.includes('cGF0aWVudC1nYXplbGxl')) {
      return null;
    }
    if (trimmed.startsWith('pk_')) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Inner component active when ClerkProvider is loaded to sync tokens
 */
const ClerkTokenSynchronizer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const [clerkToken, setClerkToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function syncToken() {
      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token && isMounted) {
            setClerkToken(token);
            if (typeof window !== 'undefined') {
              localStorage.setItem('clerk_token', token);
              localStorage.setItem('agency_jwt_token', token);
              localStorage.setItem('alm_nexus_token', token);
            }
          }
        } catch (err) {
          console.warn('[Clerk] Token fetch warning:', err);
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('clerk_token');
        }
        if (isMounted) setClerkToken(null);
      }
    }

    syncToken();
    const interval = setInterval(syncToken, 60 * 1000); // Refresh token every minute

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isSignedIn, getToken, user]);

  return (
    <ClerkCustomContext.Provider
      value={{
        isConfigured: true,
        publishableKey: getClerkPublishableKey(),
        clerkToken
      }}
    >
      {children}
    </ClerkCustomContext.Provider>
  );
};

interface ClerkErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

interface ClerkErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Error boundary that catches any ClerkProvider initialization or script timeout failures
 * and gracefully renders the unauthenticated fallback context instead of crashing the app.
 */
export class ClerkErrorBoundary extends React.Component<
  ClerkErrorBoundaryProps,
  ClerkErrorBoundaryState
> {
  constructor(props: ClerkErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      errorMessage: error?.message || String(error)
    };
  }

  componentDidCatch(error: any) {
    console.warn(
      '[Clerk] Caught ClerkProvider initialization/timeout failure, activating fallback mode:',
      error?.message
    );
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('clerk_load_failed', 'true');
      }
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * Root Clerk Authentication Wrapper
 * If a valid VITE_CLERK_PUBLISHABLE_KEY is present and connectable, initializes ClerkProvider.
 * If not configured or if Clerk CDN times out (e.g. in iframe environments),
 * gracefully renders children with local context without throwing errors.
 */
export const ClerkAppWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadFailed, setLoadFailed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('clerk_load_failed') === 'true';
    }
    return false;
  });

  const publishableKey = loadFailed ? null : getClerkPublishableKey();

  const fallbackContent = (
    <ClerkCustomContext.Provider
      value={{
        isConfigured: false,
        publishableKey: null,
        clerkToken: null
      }}
    >
      {children}
    </ClerkCustomContext.Provider>
  );

  if (!publishableKey) {
    return fallbackContent;
  }

  return (
    <ClerkErrorBoundary fallback={fallbackContent}>
      <ClerkProvider publishableKey={publishableKey}>
        <ClerkTokenSynchronizer>{children}</ClerkTokenSynchronizer>
      </ClerkProvider>
    </ClerkErrorBoundary>
  );
};

/**
 * Interactive Clerk Status & Auth Widget for Header / Settings
 */
export const ClerkAuthWidget: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isConfigured } = useClerkContext();

  if (!isConfigured) {
    if (compact) {
      return (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          title="Clerk Auth: Set a valid VITE_CLERK_PUBLISHABLE_KEY in .env to connect."
        >
          <Key className="w-3.5 h-3.5" />
          <span>Local Auth Mode</span>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <Key className="w-4 h-4 text-amber-500" />
          <span>Local Authentication Mode Active</span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400">
          The app is running with native role authentication. To connect external Clerk SSO, configure a production <code>VITE_CLERK_PUBLISHABLE_KEY</code> in <code>.env</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SignedIn>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300">
          <Shield className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-[11px] font-medium">Clerk Active</span>
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                userButtonAvatarBox: 'w-6 h-6 rounded-lg'
              }
            }}
          />
        </div>
      </SignedIn>

      <SignedOut>
        <div className="flex items-center gap-1.5">
          <SignInButton mode="modal">
            <button className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer">
              Sign In (Clerk)
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </SignedOut>
    </div>
  );
};
