import React from 'react';
import { 
  Kanban, 
  Inbox, 
  Send, 
  Mail,
  BookOpen, 
  BarChart3, 
  Coins, 
  MessageSquare, 
  FolderLock, 
  Globe, 
  ExternalLink,
  Plus,
  Sparkles,
  Sun,
  Moon,
  LogOut,
  LogIn,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Layers,
  Building2,
  User,
  ChevronRight,
  Database,
  Globe2,
  Zap
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { ThemeToggle } from './ThemeToggle';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, setMobileOpen }) => {
  const {
    activeTab,
    setActiveTab,
    role,
    currentUser,
    currentTenant,
    unreadInboxCount,
    automatedTestsPassedCount,
    isDark,
    setIsDark,
    logout,
    setIsAuthModalOpen,
    setIsNewLeadModalOpen,
    setIsOnboardingModalOpen,
    openAIModal,
    setIsTestModalOpen,
    setIsDatabaseModalOpen,
    databaseStatus
  } = useApp();

  const roleLabels: Record<UserRole, { title: string; badgeClass: string }> = {
    admin: { title: 'Executive (Admin)', badgeClass: 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30' },
    ceo: { title: 'Chief Executive (CEO)', badgeClass: 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/30' },
    sales: { title: 'Sales Specialist', badgeClass: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' },
    coordinator: { title: 'Project Coordinator', badgeClass: 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30' },
    project_manager: { title: 'Project Manager', badgeClass: 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30' },
    developer: { title: 'Lead Developer', badgeClass: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-500/30' },
    designer: { title: 'UI/UX Designer', badgeClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30' },
    bd_head: { title: 'Head of BD', badgeClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30' },
    collaborator: { title: 'Evaluation Partner', badgeClass: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/30' },
    client_guest: { title: 'Client Stakeholder', badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30' },
    team_member: { title: 'Team Member', badgeClass: 'bg-slate-500/20 text-slate-600 dark:text-slate-300 border-slate-500/30' }
  };

  // Role-based navigation matrix
  const navItems = [
    { id: 'leadflow', label: 'LeadFlow Agency (GTM)', icon: Sparkles, badge: 'Agency Hub', roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer', 'collaborator', 'client_guest', 'team_member'] },
    { id: 'pipeline', label: 'Pipeline & Deals', icon: Kanban, roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer', 'collaborator'] },
    { id: 'departmental', label: 'Department Velocity', icon: Layers, roles: ['admin', 'ceo', 'bd_head', 'coordinator', 'project_manager', 'sales', 'developer', 'designer'] },
    { id: 'gmail', label: 'Gmail Workspace', icon: Mail, roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer'] },
    { id: 'inbox', label: 'Unified Inbox', icon: Inbox, badge: unreadInboxCount, roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager'] },
    { id: 'outreach', label: 'Outreach Engine', icon: Send, roles: ['admin', 'ceo', 'bd_head', 'sales'] },
    { id: 'outreach_suite', label: 'Outreach Suite', icon: Send, badge: 'Phase 0', roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer'] },
    { id: 'sop', label: 'SOP 1–11 Rules', icon: BookOpen, badge: `${automatedTestsPassedCount}/17`, roles: ['admin', 'ceo', 'bd_head', 'coordinator', 'project_manager', 'developer'] },
    { id: 'analytics', label: 'Analytics & Revenue', icon: BarChart3, roles: ['admin', 'ceo', 'bd_head'] },
    { id: 'free_apis', label: 'Live Free APIs', icon: Globe2, badge: 'Forex & DNS', roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer'] },
    { id: 'commissions', label: 'Commissions & Splits', icon: Coins, roles: ['admin', 'ceo', 'bd_head', 'sales'] },
    { id: 'chat', label: 'Team Chat', icon: MessageSquare, roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer', 'collaborator'] },
    { id: 'vault', label: 'Secure File Vault', icon: FolderLock, roles: ['admin', 'ceo', 'bd_head', 'coordinator', 'project_manager', 'developer', 'designer'] },
    { id: 'integrations', label: 'Integrations & Hooks', icon: Globe, roles: ['admin', 'ceo', 'bd_head'] },
    { id: 'portal', label: 'Client Portal', icon: ExternalLink, roles: ['admin', 'ceo', 'bd_head', 'client_guest', 'team_member', 'collaborator'] }
  ];

  const currentRoleInfo = roleLabels[role] || roleLabels.admin;

  const handleNavClick = (id: string) => {
    setActiveTab(id as any);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Left Sidebar */}
      <aside 
        id="app-left-sidebar"
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 flex flex-col justify-between transition-transform duration-300 ease-in-out border-r
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          bg-white dark:bg-[#0a192f] border-slate-200 dark:border-slate-800 shadow-lg lg:shadow-none`}
      >
        {/* Top: Brand Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => handleNavClick('pipeline')}
            >
              <div className="w-9 h-9 rounded-lg bg-slate-900 dark:bg-slate-800 border border-slate-700 p-0.5 shadow-xs flex items-center justify-center">
                <img src="/icon.svg" alt="ALM Nexus" className="w-7 h-7 rounded-md" />
              </div>
              <div className="truncate max-w-[170px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white truncate">
                    {currentTenant?.name || 'ALM Nexus'}
                  </span>
                  <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono shrink-0">
                    SaaS
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block -mt-0.5 truncate font-medium">
                  Enterprise Operations Hub
                </span>
              </div>
            </div>

            <span className="w-2 h-2 rounded-full bg-emerald-500" title="System Operational" />
          </div>

          {/* Active Persona / Role Badge Card */}
          <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-md bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser?.name ? currentUser.name[0] : (role === 'client_guest' ? 'C' : 'A')}
              </div>
              <div className="truncate">
                <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                  {currentUser ? currentUser.name : (role === 'client_guest' ? 'Client Guest' : 'Tariq Mehmood')}
                </span>
                <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold border font-mono ${currentRoleInfo.badgeClass}`}>
                  {currentRoleInfo.title}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-300 dark:border-slate-700 transition cursor-pointer shrink-0"
              title="Switch user role or log in"
            >
              Role
            </button>
          </div>
        </div>

        {/* Action Buttons on Left Side (strictly filtered by role) */}
        {['admin', 'bd_head', 'sales', 'coordinator'].includes(role) && (
          <div className="px-3 pt-3 pb-1 space-y-1.5">
            <button
              id="btn-sidebar-new-lead"
              onClick={() => setIsNewLeadModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Client Lead</span>
            </button>

            {['admin', 'bd_head', 'sales'].includes(role) && (
              <button
                id="btn-sidebar-ai-pitch"
                onClick={() => openAIModal()}
                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-800 transition cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>AI Proposal &amp; Pitch</span>
              </button>
            )}
          </div>
        )}

        {/* Center: Navigation Menu Items */}
        <nav className="px-3 py-2 flex-1 overflow-y-auto space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Navigation Menu
          </div>

          {navItems.map(item => {
            if (item.roles && !item.roles.includes(role)) return null;

            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`sidebar-nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 dark:bg-slate-800 text-white font-semibold shadow-xs border border-slate-800 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold font-mono ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section: Theme Toggle, Telemetry, and Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50 dark:bg-[#0a192f]">
          
          {/* Real Light / Dark / System Mode Switcher */}
          <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                {isDark ? <Moon className="w-3.5 h-3.5 text-slate-300" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                <span>Theme Mode</span>
              </span>
              <span className="text-[10px] font-mono uppercase text-slate-400">
                {isDark ? 'Dark' : 'Light'}
              </span>
            </div>
            <ThemeToggle variant="segmented" showLabels={true} className="w-full justify-between" />
          </div>

          {/* SOP Engine Status / Test Trigger */}
          <div className="flex items-center justify-between text-xs px-1">
            <button
              onClick={() => setIsTestModalOpen(true)}
              className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-mono font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>SOP Tests 17/17</span>
            </button>

            <button
              onClick={() => setIsDatabaseModalOpen(true)}
              className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 font-mono"
            >
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>{databaseStatus?.engine === 'postgresql' ? 'PostgreSQL' : 'JSON DB'}</span>
            </button>
          </div>

          {/* Auth Action: Sign In or Sign Out */}
          <div className="pt-1">
            {currentUser ? (
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out ({currentUser.name.split(' ')[0]})</span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In / Select Role</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
