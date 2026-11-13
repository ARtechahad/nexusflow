import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { ProjectsPipeline } from './components/ProjectsPipeline';
import { SOPGuideView } from './components/SOPGuideView';
import { OutreachView } from './components/OutreachView';
import { OutreachSuiteView } from './components/outreach-suite/OutreachSuiteView';
import { UnifiedInboxView } from './components/UnifiedInboxView';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { IntegrationsView } from './components/IntegrationsView';
import { CommissionCalculatorView } from './components/CommissionCalculatorView';
import { TeamChatView } from './components/TeamChatView';
import { SecureFileVault } from './components/SecureFileVault';
import { ClientPortalView } from './components/ClientPortalView';
import { FreeApiToolsView } from './components/FreeApiToolsView';
import { GmailWorkspaceView } from './components/GmailWorkspaceView';
import { DepartmentalTrackingView } from './components/DepartmentalTrackingView';
import { TenantOnboardingModal } from './components/TenantOnboardingModal';
import { UserProfileDashboard } from './components/UserProfileDashboard';
import { ActivityFeedDrawer } from './components/ActivityFeedDrawer';
import { CompanyWikiModal } from './components/CompanyWikiModal';
import { PlatformHealthModal } from './components/PlatformHealthModal';
import { ExecutiveOperationsRibbon } from './components/ExecutiveOperationsRibbon';

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
import { CreativeStudioModal } from './components/CreativeStudioModal';
import { EmbeddedGeminiChatbot } from './components/EmbeddedGeminiChatbot';
import { ErrorBoundary } from './components/ErrorBoundary';
import { X } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentUser,
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
    isCreativeStudioOpen,
    setIsCreativeStudioOpen,
    toasts,
    dismissToast,
    automatedTestsPassedCount,
    sidebarCollapsed
  } = useApp();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Global Keyboard Navigation (⌘K / Ctrl+K Command Palette)
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  // Support /docs route inside SPA directly
  const [isDocsRoute, setIsDocsRoute] = useState(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/docs');
  });

  React.useEffect(() => {
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
          setActiveTab(currentUser ? 'pipeline' : 'leadflow');
        }}
      />
    );
  }

  // When not authenticated, display the full LeadFlow Agency experience by default,
  // allowing visitors to explore features, calculate ROI, test free tools, book a call,
  // or launch/sign into the ALM Nexus internal operations portal.
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a192f] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-slate-900 selection:text-white transition-colors duration-200 relative">
        <LeadFlowLandingView
          onOpenLoginModal={() => setShowLoginModal(true)}
          onEnterWorkspace={() => setShowLoginModal(true)}
        />

        {/* Modal for Role / Account Login */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
            <div className="relative w-full max-w-5xl my-auto">
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 z-50 p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer shadow-md"
                aria-label="Close Login Modal"
              >
                <X className="w-5 h-5" />
              </button>
              <RoleLoginView onSuccess={() => setShowLoginModal(false)} />
            </div>
          </div>
        )}

        <GlobalCommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
        <TenantOnboardingModal
          isOpen={isOnboardingModalOpen}
          onClose={() => setIsOnboardingModalOpen(false)}
        />
        <AuthModal />
        <ToastNotification toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'pipeline':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'sales', 'coordinator', 'developer', 'collaborator']} moduleName="Pipeline & Lead Deals">
            <ProjectsPipeline />
          </RoleRouteGuard>
        );
      case 'departmental':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'ceo', 'bd_head', 'coordinator', 'project_manager', 'sales', 'developer', 'designer']} moduleName="Departmental Velocity & Progress">
            <DepartmentalTrackingView />
          </RoleRouteGuard>
        );
      case 'gmail':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'sales', 'coordinator', 'developer']} moduleName="Gmail Workspace">
            <GmailWorkspaceView />
          </RoleRouteGuard>
        );
      case 'inbox':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'sales', 'coordinator']} moduleName="Unified Omni-Inbox">
            <UnifiedInboxView />
          </RoleRouteGuard>
        );
      case 'sop':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'coordinator', 'developer']} moduleName="SOP Quality & Gatekeeping">
            <SOPGuideView />
          </RoleRouteGuard>
        );
      case 'outreach':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'sales']} moduleName="Outreach Engine & Scrapers">
            <OutreachView />
          </RoleRouteGuard>
        );
      case 'outreach_suite':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer']} moduleName="LeadFlow Outreach Suite">
            <OutreachSuiteView />
          </RoleRouteGuard>
        );
      case 'analytics':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head']} moduleName="Executive Revenue Analytics">
            <DashboardAnalytics />
          </RoleRouteGuard>
        );
      case 'free_apis':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'sales', 'coordinator', 'developer']} moduleName="Agency Live Tools & APIs">
            <FreeApiToolsView />
          </RoleRouteGuard>
        );
      case 'portal':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'client_guest', 'collaborator']} moduleName="Client Portal">
            <ClientPortalView />
          </RoleRouteGuard>
        );
      case 'commissions':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'sales']} moduleName="Commission Ledger & Payouts">
            <CommissionCalculatorView />
          </RoleRouteGuard>
        );
      case 'chat':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'sales', 'coordinator', 'developer', 'collaborator']} moduleName="Team Channels & Chat">
            <TeamChatView />
          </RoleRouteGuard>
        );
      case 'vault':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head', 'coordinator', 'developer']} moduleName="Secure File & Credential Vault">
            <SecureFileVault />
          </RoleRouteGuard>
        );
      case 'integrations':
        return (
          <RoleRouteGuard allowedRoles={['admin', 'bd_head']} moduleName="External Integrations & Webhooks">
            <IntegrationsView />
          </RoleRouteGuard>
        );
      case 'leadflow':
        return <LeadFlowLandingView onEnterWorkspace={() => setActiveTab('profile')} />;
      case 'profile':
        return <UserProfileDashboard />;
      case 'docs':
        return (
          <DocsView
            onBackToApp={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
              }
              setActiveTab('outreach_suite');
            }}
          />
        );
      default:
        return <ProjectsPipeline />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a192f] text-slate-900 dark:text-slate-100 flex font-sans antialiased selection:bg-slate-900 selection:text-white transition-colors duration-200 relative">
      {/* Left Sidebar (All navigation and buttons shifted to left side) */}
      <Sidebar 
        mobileOpen={mobileSidebarOpen} 
        setMobileOpen={setMobileSidebarOpen} 
      />

      {/* Main Workspace Area (offset dynamically by Collapsible Left Sidebar on lg screens) */}
      <div className={`${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'} flex flex-col flex-1 min-h-screen w-full transition-all duration-200 ease-in-out`}>
        
        {/* Top Header */}
        <TopHeader onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

        {/* Executive Operations Telemetry Ribbon (Responsive CSS Grid for Core Modules) */}
        <ExecutiveOperationsRibbon />

        {/* Main Content Body */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full animate-fadeIn max-w-[1440px] mx-auto">
          {renderActiveView()}
        </main>

        {/* Clean Enterprise Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a192f] text-xs text-slate-600 dark:text-slate-400">
          <div className="max-w-[1440px] mx-auto py-3.5 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">ClientOps Operations Suite</span>
              <span>&bull;</span>
              <span>International Client Handling &amp; Project Operations</span>
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                SOP Gate {automatedTestsPassedCount}/17
              </span>
              <span>&bull;</span>
              <span>Multi-Tenant Isolation</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Global Modals */}
      <GlobalCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <CreativeStudioModal
        isOpen={isCreativeStudioOpen}
        onClose={() => setIsCreativeStudioOpen(false)}
      />
      <EmbeddedGeminiChatbot />
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

      {/* Enterprise Multi-Tenant Modals & Real-time Drawers */}
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

      {/* Toast Feedback */}
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
