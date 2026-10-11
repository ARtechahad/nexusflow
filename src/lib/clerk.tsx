import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
  useAuth,
  useClerk
} from '@clerk/clerk-react';
import { Shield, Sparkles, Key, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

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
 */
export function getClerkPublishableKey(): string | null {
  const key =
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
    (typeof window !== 'undefined' ? (window as any).__CLERK_PUBLISHABLE_KEY__ : null);

  if (typeof key === 'string' && key.trim().startsWith('pk_')) {
    return key.trim();
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

/**
 * Root Clerk Authentication Wrapper
 * If VITE_CLERK_PUBLISHABLE_KEY is present, initializes ClerkProvider.
 * If not yet configured, gracefully renders children without throwing errors.
 */
export const ClerkAppWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const publishableKey = getClerkPublishableKey();

  if (!publishableKey) {
    return (
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
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkTokenSynchronizer>{children}</ClerkTokenSynchronizer>
    </ClerkProvider>
  );
};

/**
 * Interactive Clerk Status & Auth Widget for Header / Settings
 */
export const ClerkAuthWidget: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isConfigured, publishableKey } = useClerkContext();

  if (!isConfigured) {
    if (compact) {
      return (
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          title="Clerk Auth: Set VITE_CLERK_PUBLISHABLE_KEY in .env to connect."
        >
          <Key className="w-3.5 h-3.5" />
          <span>Clerk: Key Needed</span>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <Key className="w-4 h-4 text-amber-500" />
          <span>Clerk Authentication Ready</span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400">
          To activate Clerk SSO & session security, add your <code>VITE_CLERK_PUBLISHABLE_KEY</code> and{' '}
          <code>CLERK_SECRET_KEY</code> to <code>.env</code>.
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
            <button className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors">
              Sign In (Clerk)
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              Sign Up
            </button>
          </SignUpButton>
        </div>
      </SignedOut>
    </div>
  );
};
