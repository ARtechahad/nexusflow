import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { ProjectsPipeline } from './components/ProjectsPipeline';
import { SOPGuideView } from './components/SOPGuideView';
import { OutreachSuiteView } from './components/outreach-suite/OutreachSuiteView';
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
import { ExecutiveOperationsRibbon } from './components/ExecutiveOperationsRibbon';
import { CompanyOnboardingView } from './components/CompanyOnboardingView';
import { DepartmentSelectorView } from './components/DepartmentSelectorView';

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
import { LeadFlowLandingView } from './components/LeadFlowLandingView';
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
    automatedTestsPassedCount,
    sidebarCollapsed
  } = useApp();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [authModalState, setAuthModalState] = useState<{ open: boolean; mode: 'signin' | 'signup' }>(() => ({
    open: Boolean(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('invite')),
    mode: 'signin'
  }));

  useEffect(() => {
    if (!currentUser && inviteToken) {
      setAuthModalState((prev) => ({ ...prev, open: true }));
    }
  }, [currentUser, inviteToken]);

  // Global Keyboard Navigation (⌘K / Ctrl+K Command Palette)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  const [isDocsRoute, setIsDocsRoute] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/docs');
  });

  useEffect(() => {
    const checkPath = () => {
      setIsDocsRoute(window.location.pathname.startsWith('/docs'));
    };
    window.addEventListener('popstate', checkPath);
    return () => window.removeEventListener('popstate', checkPath);
  }, []);

  if (isDocsRoute || (activeTab as any) === 'docs') {
    return (
      <DocsView
        onBackToApp={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
          }
          setIsDocsRoute(false);
          setActiveTab(currentUser ? (companyRole === 'company_admin' ? 'pipeline' : 'departmental') : 'leadflow');
        }}
      />
    );
  }

  // 1. Unauthenticated Landing Page & Auth Gateway
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] bg-canvas-textured text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white transition-colors duration-200 relative">
        <LeadFlowLandingView
          onOpenSignIn={() => setAuthModalState({ open: true, mode: 'signin' })}
          onOpenSignUp={() => setAuthModalState({ open: true, mode: 'signup' })}
          onEnterWorkspace={() => setAuthModalState({ open: true, mode: 'signin' })}
        />

        {authModalState.open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn"
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
      </div>
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
        <TenantOnboardingModal
          isOpen={isOnboardingModalOpen}
          onClose={() => setIsOnboardingModalOpen(false)}
        />
        <ToastNotification toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
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
            moduleName="Department Operations & Roster"
          >
            <DepartmentalTrackingView />
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
            allowedCompanyRoles={['company_admin', 'department_head']}
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
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin', 'department_head']}
            moduleName="Email Hub (Mailboxes & Campaigns)"
          >
            <OutreachSuiteView />
          </RoleRouteGuard>
        );
      case 'analytics':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin']}
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
            allowedCompanyRoles={['company_admin']}
            moduleName="Commission & Payout Ledger"
          >
            <CommissionCalculatorView />
          </RoleRouteGuard>
        );
      case 'chat':
        return (
          <RoleRouteGuard
            allowedCompanyRoles={['company_admin', 'department_head', 'employee']}
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
              setActiveTab(companyRole === 'company_admin' ? 'outreach_suite' : 'departmental');
            }}
          />
        );
      default:
        return companyRole === 'company_admin' ? <ProjectsPipeline /> : <DepartmentalTrackingView />;
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

        <ExecutiveOperationsRibbon />

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

            {companyRole === 'company_admin' && (
              <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  SOP Gate {automatedTestsPassedCount}/17
                </span>
                <span>&bull;</span>
                <span>Multi-Tenant Isolation</span>
              </div>
            )}
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

      <TenantOnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
      />
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
