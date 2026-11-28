import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { ProjectsPipeline } from './components/ProjectsPipeline';
import { SOPGuideView } from './components/SOPGuideView';
import { EmailOutreachView } from './components/EmailOutreachView';
import { CompanyOverviewView } from './components/CompanyOverviewView';
import { UnifiedInboxView } from './components/UnifiedInboxView';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { IntegrationsView } from './components/IntegrationsView';
import { CommissionCalculatorView } from './components/CommissionCalculatorView';
import { TeamChatView } from './components/TeamChatView';
import { SecureFileVault } from './components/SecureFileVault';
import { ClientPortalView } from './components/ClientPortalView';
import { GmailWorkspaceView } from './components/GmailWorkspaceView';
import { DepartmentalTrackingView } from './components/DepartmentalTrackingView';
import { TenantOnboardingModal } from './components/TenantOnboardingModal';
import { UserProfileDashboard } from './components/UserProfileDashboard';
import { ActivityFeedDrawer } from './components/ActivityFeedDrawer';
import { CompanyWikiModal } from './components/CompanyWikiModal';
import { PlatformHealthModal } from './components/PlatformHealthModal';
import { CompanyOnboardingView } from './components/CompanyOnboardingView';
import { DepartmentSelectorView } from './components/DepartmentSelectorView';
import { InvitedOnboardingView } from './components/InvitedOnboardingView';
import { isEmailOutreachVisible } from './utils/departmentAccess';

// Modals
import { NewClientLeadModal } from './components/NewClientLeadModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { AISettingsModal } from './components/AISettingsModal';
import { DatabasePersistenceModal } from './components/DatabasePersistenceModal';
import { AutomatedTestingModal } from './components/AutomatedTestingModal';
import { GDPRComplianceModal } from './components/GDPRComplianceModal';
import { AuthModal } from './components/AuthModal';
import { DiscordExportModal } from './components/DiscordExportModal';
import { ToastNotification } from './components/ToastNotification';
import { RoleLoginView } from './components/RoleLoginView';
import { RoleRouteGuard } from './components/RoleRouteGuard';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import { StudioWebsite, normalizePathname } from './components/studio/StudioWebsite';
import { NOINDEX_APP_PREFIXES, STUDIO_BRAND } from './data/studioData';
import { DocsView } from './components/DocsView';
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { X } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentUser,
    tenants,
    currentTenant,
    companyRole,
    departments,
    selectedDepartmentId,
    inviteToken,
    activeTab,
    setActiveTab,
    isDark,
    toggleTheme,
    isAISettingsModalOpen,
    setIsAISettingsModalOpen,
    isOnboardingModalOpen,
    setIsOnboardingModalOpen,
    isActivityFeedOpen,
    setIsActivityFeedOpen,
    isWikiModalOpen,
    setIsWikiModalOpen,
    isPlatformHealthModalOpen,
    setIsPlatformHealthModalOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    toasts,
    dismissToast,
    sidebarCollapsed
  } = useApp();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authModalState, setAuthModalState] = useState<{ open: boolean; mode: 'signin' | 'signup' }>({
    open: false,
    mode: 'signin'
  });

  // Global Keyboard Navigation (⌘K / Ctrl+K Command Palette)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return normalizePathname(window.location.pathname);
    }
    return '/';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkPath = () => {
      setCurrentPath(normalizePathname(window.location.pathname));
    };
    window.addEventListener('popstate', checkPath);
    if (window.location.hash) {
      const targetId = window.location.hash.replace(/^#/, '');
      window.setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
    return () => window.removeEventListener('popstate', checkPath);
  }, []);

  const navigateTo = (href: string) => {
    if (typeof window === 'undefined') return;
    const [rawPath, hashPart] = href.split('#');
    const nextPath = normalizePathname(rawPath || '/');
    window.history.pushState({}, '', href);
    setCurrentPath(nextPath);

    if (hashPart) {
      const scrollToTarget = () => {
        const el = document.getElementById(hashPart);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          return true;
        }
        return false;
      };
      window.requestAnimationFrame(() => {
        if (!scrollToTarget()) {
          window.setTimeout(scrollToTarget, 80);
        }
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const isNoIndexRoute = NOINDEX_APP_PREFIXES.some(
    (prefix) => currentPath === prefix || currentPath.startsWith(`${prefix}/`)
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (currentUser || inviteToken || isNoIndexRoute) {
      let robotsMeta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta');
        robotsMeta.setAttribute('name', 'robots');
        document.head.appendChild(robotsMeta);
      }
      robotsMeta.setAttribute('content', 'noindex, nofollow');
    }
  }, [currentUser, inviteToken, isNoIndexRoute]);

  const isDocsRoute = currentPath === '/docs' || currentPath.startsWith('/docs/');

  if (isDocsRoute || (activeTab as any) === 'docs') {
    return (
      <DocsView
        onBackToApp={() => {
          navigateTo('/');
          setActiveTab(currentUser ? (companyRole === 'company_admin' ? 'overview' : 'departmental') : 'leadflow');
        }}
      />
    );
  }

  // 0. Dedicated Smart Invite Acceptance & Onboarding Gateway (?invite=<token>)
  if (inviteToken) {
    return (
      <>
        <InvitedOnboardingView />
        <ToastNotification toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // 1. Unauthenticated Public Website & Dedicated Auth Routes (/login, /signup, /app, /workspace, /portal)
  if (!currentUser) {
    if (isNoIndexRoute) {
      const authMode: 'signin' | 'signup' = currentPath === '/signup' ? 'signup' : 'signin';
      return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/');
                }}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline underline-offset-4"
              >
                Back to {STUDIO_BRAND.name}
              </a>
            </div>
            <RoleLoginView
              initialMode={authMode}
              onSuccess={() => {
                setAuthModalState({ open: false, mode: 'signin' });
              }}
            />
          </div>
          <AuthModal />
          <ToastNotification toasts={toasts} onDismiss={dismissToast} />
        </div>
      );
    }

    return (
      <>
        <StudioWebsite
          currentPath={currentPath}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onNavigate={navigateTo}
          onOpenAuth={(mode) => setAuthModalState({ open: true, mode })}
        />

        {authModalState.open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
            onClick={() => setAuthModalState((prev) => ({ ...prev, open: false }))}
          >
            <div className="relative w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setAuthModalState((prev) => ({ ...prev, open: false }))}
                className="btn-tactile-secondary absolute top-3 right-3 z-20 p-1.5 rounded-lg cursor-pointer"
                aria-label="Close Authentication Modal"
              >
                <X className="w-4 h-4" />
              </button>
              <RoleLoginView
                initialMode={authModalState.mode}
                onSuccess={() => setAuthModalState((prev) => ({ ...prev, open: false }))}
              />
            </div>
          </div>
        )}

        <GlobalCommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
        <AuthModal />
        <ToastNotification toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // 2. Authenticated Personal User with 0 Companies -> "Create Your First Company" / Accept Invite Screen
  if (tenants.length === 0 || !currentTenant) {
    return (
      <>
        <CompanyOnboardingView />
        <ToastNotification toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // 3. Multi-Department Non-Admin Selector Screen (when user belongs to > 1 department & none selected)
  if (companyRole !== 'company_admin' && departments.length > 1 && !selectedDepartmentId) {
    return (
      <>
        <DepartmentSelectorView />
        <ToastNotification toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const activeDept = departments.find((d) => d.id === selectedDepartmentId) || departments[0] || null;
  const emailOutreachEnabled = isEmailOutreachVisible(
    companyRole,
    currentTenant?.settings,
    activeDept,
    departments
  );

  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin']}
            moduleName="Company Overview"
          >
            <CompanyOverviewView />
          </RoleRouteGuard>
        );
      case 'departments':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin']}
            moduleName="Departments & Team"
          >
            <DepartmentalTrackingView mode="departments_team" />
          </RoleRouteGuard>
        );
      case 'pipeline':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin']}
            moduleName="Executive Dashboard & Deals"
          >
            <ProjectsPipeline />
          </RoleRouteGuard>
        );
      case 'departmental':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin', 'department_head', 'employee']}
            requiredModule="operations"
            moduleName="Operations & Tasks"
          >
            <DepartmentalTrackingView mode="operations_tasks" />
          </RoleRouteGuard>
        );
      case 'gmail':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin']}
            moduleName="Google Mailbox Sync"
          >
            <GmailWorkspaceView />
          </RoleRouteGuard>
        );
      case 'inbox':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin', 'department_head', 'employee']}
            requiredModule="client_inbox"
            moduleName="Unified Client Inbox"
          >
            <UnifiedInboxView />
          </RoleRouteGuard>
        );
      case 'sop':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin']}
            moduleName="SOP Stage Gates"
          >
            <SOPGuideView />
          </RoleRouteGuard>
        );
      case 'outreach':
      case 'outreach_suite':
        if (companyRole === 'company_admin' && !emailOutreachEnabled) {
          return (
            <RoleRouteGuard allowedCompanyRoles={['company_admin']} moduleName="Email Outreach">
              <EmailOutreachView />
            </RoleRouteGuard>
          );
        }
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin', 'department_head', 'employee']}
            requiredModule="email_hub"
            moduleName="Email Outreach"
          >
            <EmailOutreachView />
          </RoleRouteGuard>
        );
      case 'analytics':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin', 'department_head', 'employee']}
            requiredModule="financials"
            moduleName="Revenue Analytics"
          >
            <DashboardAnalytics />
          </RoleRouteGuard>
        );
      case 'portal':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin']}
            moduleName="Client Portal"
          >
            <ClientPortalView />
          </RoleRouteGuard>
        );
      case 'commissions':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin', 'department_head', 'employee']}
            requiredModule="financials"
            moduleName="Commission & Payout Ledger"
          >
            <CommissionCalculatorView />
          </RoleRouteGuard>
        );
      case 'chat':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin', 'department_head', 'employee']}
            requiredModule="chat"
            moduleName="Department Chat & Status Updates"
          >
            <TeamChatView />
          </RoleRouteGuard>
        );
      case 'vault':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin']}
            moduleName="Secure File Vault"
          >
            <SecureFileVault />
          </RoleRouteGuard>
        );
      case 'integrations':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin']}
            moduleName="Webhooks & API"
          >
            <IntegrationsView />
          </RoleRouteGuard>
        );
      case 'profile':
        return <UserProfileDashboard />;
      case 'docs':
        return (
          <DocsView
            onBackToApp={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
              setActiveTab(companyRole === 'company_admin' ? 'overview' : 'departmental');
            }}
          />
        );
      default:
        return companyRole === 'company_admin' ? (
          <CompanyOverviewView />
        ) : (
          <DepartmentalTrackingView mode="operations_tasks" />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] bg-canvas-textured text-slate-900 dark:text-slate-100 flex font-sans antialiased selection:bg-indigo-600 selection:text-white transition-colors duration-200 relative">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      <div className={`${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'} flex flex-col flex-1 min-h-screen w-full transition-all duration-200 ease-in-out`}>
        <TopHeader onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

        <main className="px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full animate-fadeIn max-w-[1440px] mx-auto">
          {renderActiveView()}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800 bg-[#FFFFFF] dark:bg-[#111827] text-xs text-slate-600 dark:text-slate-400">
          <div className="max-w-[1440px] mx-auto py-3.5 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-950 dark:text-white">ClientOps</span>
              <span>&bull;</span>
              <span>{currentTenant.name}</span>
            </div>

            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Multi-Tenant Workspace
            </span>
          </div>
        </footer>
      </div>

      <GlobalCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <OfflineSyncBanner />
      <NewClientLeadModal />
      <AIAssistantModal />
      <AISettingsModal
        isOpen={isAISettingsModalOpen}
        onClose={() => setIsAISettingsModalOpen(false)}
      />
      <DatabasePersistenceModal />
      <AutomatedTestingModal />
      <GDPRComplianceModal />
      <AuthModal />
      <DiscordExportModal />

      {(companyRole === 'company_admin' || tenants.length === 0) && (
        <TenantOnboardingModal
          isOpen={isOnboardingModalOpen}
          onClose={() => setIsOnboardingModalOpen(false)}
        />
      )}
      <ActivityFeedDrawer
        isOpen={isActivityFeedOpen}
        onClose={() => setIsActivityFeedOpen(false)}
      />
      <CompanyWikiModal
        isOpen={isWikiModalOpen}
        onClose={() => setIsWikiModalOpen(false)}
      />
      <PlatformHealthModal
        isOpen={isPlatformHealthModalOpen}
        onClose={() => setIsPlatformHealthModalOpen(false)}
      />

      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
};

export default App;
