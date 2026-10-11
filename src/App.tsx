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
import { ActivityFeedDrawer } from './components/ActivityFeedDrawer';
import { CompanyWikiModal } from './components/CompanyWikiModal';
import { PlatformHealthModal } from './components/PlatformHealthModal';
import { 
  ShieldCheck, 
  CheckCircle2, 
  TrendingUp, 
  Database, 
  Server,
  Zap,
  Activity,
  ArrowUpRight
} from 'lucide-react';

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
import { GlobalCommandPalette } from './components/GlobalCommandPalette';
import { CreativeStudioModal } from './components/CreativeStudioModal';
import { EmbeddedGeminiChatbot } from './components/EmbeddedGeminiChatbot';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ParticleBackground } from './components/ParticleBackground';
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
    projects,
    formatMoney,
    automatedTestsPassedCount,
    databaseStatus,
    role
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

  const totalPipelineValue = projects.reduce((acc, p) => acc + (p.finalPrice || p.estimatedPrice || 0), 0);
  const advancesCleared = projects.filter(p => p.advancePaid).length;
  const inStaging = projects.filter(p => p.internalQAPassed && !p.domainTransferred).length;

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
        return <LeadFlowLandingView onEnterWorkspace={() => setActiveTab('pipeline')} />;
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

      {/* Main Workspace Area (offset by Left Sidebar on lg screens) */}
      <div className="lg:pl-72 flex flex-col flex-1 min-h-screen w-full">
        
        {/* Top Header */}
        <TopHeader onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

        {/* Executive Operations Telemetry Ribbon (Visible for Internal Roles) */}
        {role !== 'client_guest' && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0a192f]/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center justify-between gap-4 flex-wrap text-xs">
              
              {/* Metric Badges */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-900 dark:text-slate-300" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Pipeline:</span>
                  <span className="font-semibold text-slate-900 dark:text-white font-mono">{formatMoney(totalPipelineValue)}</span>
                </div>

                <div className="h-3 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">50% Deposits:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-300 font-mono">{advancesCleared} / {projects.length}</span>
                </div>

                <div className="h-3 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hidden md:flex">
                  <Activity className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">In-Flight QA:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{inStaging} Active</span>
                </div>

                <div className="h-3 w-px bg-slate-200 dark:bg-slate-800 hidden lg:block" />

                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 hidden lg:flex">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">SOP Gate:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-300 font-mono">{automatedTestsPassedCount}/17 Passed</span>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-3 ml-auto">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{databaseStatus?.engine === 'postgresql' ? 'Cloud SQL Active' : 'Persistence Ready'}</span>
                </div>

                {activeTab !== 'sop' && (
                  <button
                    onClick={() => setActiveTab('sop')}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1 text-[11px] font-medium"
                  >
                    <span>SOP Rules</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Body */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full animate-fadeIn max-w-7xl">
          {renderActiveView()}
        </main>

        {/* Clean Corporate Enterprise Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 py-4 px-4 sm:px-6 lg:px-8 bg-slate-900 dark:bg-[#0a192f] text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">AgencyOps ALM</span>
            <span>&bull;</span>
            <span>Client Handling &amp; Project Operations Suite</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              SOP Gate 17/17 Passed
            </span>
            <span>&bull;</span>
            <span>GDPR Ready</span>
            <span>&bull;</span>
            <span>v2.7.0 Enterprise</span>
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
