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
  LogOut,
  LogIn,
  CheckCircle2,
  Layers,
  User,
  Database,
  Globe2,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { ThemeToggle } from './ThemeToggle';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface NavGroup {
  label: string;
  items: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: UserRole[];
    dynamicCount?: number;
  }[];
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
    logout,
    setIsAuthModalOpen,
    setIsNewLeadModalOpen,
    openAIModal,
    setIsTestModalOpen,
    setIsDatabaseModalOpen,
    databaseStatus,
    sidebarCollapsed,
    setSidebarCollapsed
  } = useApp();

  const roleLabels: Record<UserRole, { title: string }> = {
    admin: { title: 'Executive (Admin)' },
    ceo: { title: 'Chief Executive' },
    sales: { title: 'Sales Specialist' },
    coordinator: { title: 'Project Coordinator' },
    project_manager: { title: 'Project Manager' },
    developer: { title: 'Lead Developer' },
    designer: { title: 'UI/UX Designer' },
    bd_head: { title: 'Head of BD' },
    collaborator: { title: 'Evaluation Partner' },
    client_guest: { title: 'Client Stakeholder' },
    team_member: { title: 'Team Member' }
  };

  const navGroups: NavGroup[] = [
    {
      label: 'Command Center',
      items: [
        {
          id: 'profile',
          label: 'Profile & Workspaces',
          icon: User,
          roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer', 'collaborator', 'client_guest', 'team_member']
        },
        {
          id: 'pipeline',
          label: 'Pipeline & Deals',
          icon: Kanban,
          roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer', 'collaborator']
        },
        {
          id: 'outreach_suite',
          label: 'Outreach Suite',
          icon: Send,
          roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer']
        },
        {
          id: 'inbox',
          label: 'Unified Inbox',
          icon: Inbox,
          dynamicCount: unreadInboxCount > 0 ? unreadInboxCount : undefined,
          roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager']
        },
        {
          id: 'gmail',
          label: 'Gmail Workspace',
          icon: Mail,
          roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer']
        },
        {
          id: 'outreach',
          label: 'AI Lead Finder',
          icon: Sparkles,
          roles: ['admin', 'ceo', 'bd_head', 'sales']
        }
      ]
    },
    {
      label: 'Revenue & Splits',
      items: [
        {
          id: 'commissions',
          label: 'Commission Ledger',
          icon: Coins,
          roles: ['admin', 'ceo', 'bd_head', 'sales']
        },
        {
          id: 'analytics',
          label: 'Revenue Analytics',
          icon: BarChart3,
          roles: ['admin', 'ceo', 'bd_head']
        }
      ]
    },
    {
      label: 'Delivery & SOP',
      items: [
        {
          id: 'departmental',
          label: 'Department Velocity',
          icon: Layers,
          roles: ['admin', 'ceo', 'bd_head', 'coordinator', 'project_manager', 'sales', 'developer', 'designer']
        },
        {
          id: 'sop',
          label: 'SOP 1–11 Rules',
          icon: CheckCircle2,
          roles: ['admin', 'ceo', 'bd_head', 'coordinator', 'project_manager', 'developer']
        },
        {
          id: 'vault',
          label: 'Secure File Vault',
          icon: FolderLock,
          roles: ['admin', 'ceo', 'bd_head', 'coordinator', 'project_manager', 'developer', 'designer']
        },
        {
          id: 'portal',
          label: 'Client Portal',
          icon: ExternalLink,
          roles: ['admin', 'ceo', 'bd_head', 'client_guest', 'team_member', 'collaborator']
        }
      ]
    },
    {
      label: 'Platform & Tools',
      items: [
        {
          id: 'chat',
          label: 'Team Channels',
          icon: MessageSquare,
          roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer', 'collaborator']
        },
        {
          id: 'free_apis',
          label: 'Forex & DNS Tools',
          icon: Globe2,
          roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer']
        },
        {
          id: 'integrations',
          label: 'Integrations & Hooks',
          icon: Globe,
          roles: ['admin', 'ceo', 'bd_head']
        },
        {
          id: 'docs',
          label: 'API & MCP Docs',
          icon: BookOpen,
          roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer', 'collaborator', 'client_guest', 'team_member']
        },
        {
          id: 'leadflow',
          label: 'Product Showcase',
          icon: Sparkles,
          roles: ['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager', 'developer', 'designer', 'collaborator', 'client_guest', 'team_member']
        }
      ]
    }
  ];

  const currentRoleInfo = roleLabels[role] || roleLabels.admin;

  const handleNavClick = (id: string) => {
    setActiveTab(id as any);
    setMobileOpen(false);
  };

  const isCollapsedDesktop = sidebarCollapsed && !mobileOpen;

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Collapsible Left Navigation Rail */}
      <aside
        id="app-left-sidebar"
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col justify-between transition-all duration-200 ease-in-out border-r
          ${mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-60'}
          bg-white dark:bg-[#0a192f] border-slate-200 dark:border-slate-800 shadow-lg lg:shadow-none`}
      >
        {/* Top: Brand Header & Collapse Control */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <div className={`h-16 px-3 flex items-center ${isCollapsedDesktop ? 'justify-center' : 'justify-between'}`}>
            {!isCollapsedDesktop && (
              <div
                className="flex items-center gap-2.5 cursor-pointer min-w-0"
                onClick={() => handleNavClick('pipeline')}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <img src="/icon.svg" alt="ClientOps" className="w-5 h-5 rounded-xs" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white truncate block leading-tight">
                    {currentTenant?.name || 'ClientOps Suite'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                    Operations Workspace
                  </span>
                </div>
              </div>
            )}

            {isCollapsedDesktop && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition"
                title="Expand Navigation Sidebar"
                aria-label="Expand Navigation Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {!isCollapsedDesktop && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed(true)}
                  className="hidden lg:flex p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Collapse Sidebar"
                  aria-label="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  aria-label="Close Sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Active User Summary Card */}
          {!isCollapsedDesktop ? (
            <div className="px-3 pb-3">
              <div
                onClick={() => handleNavClick('profile')}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors"
                title="Open Personal Profile & Workspaces"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                      {currentUser ? currentUser.name : 'Workspace Member'}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                      {currentRoleInfo.title}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAuthModalOpen(true);
                  }}
                  className="px-2 py-1 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700 transition cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Role
                </button>
              </div>
            </div>
          ) : (
            <div className="pb-2.5 flex justify-center">
              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center cursor-pointer hover:border-indigo-400 transition"
                title={`${currentUser?.name || 'Profile'} (${currentRoleInfo.title})`}
              >
                {currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}
              </button>
            </div>
          )}
        </div>

        {/* Primary Quick Actions */}
        {['admin', 'ceo', 'bd_head', 'sales', 'coordinator', 'project_manager'].includes(role) && (
          <div className={`px-2.5 pt-2.5 pb-1 space-y-1.5 ${isCollapsedDesktop ? 'flex flex-col items-center' : ''}`}>
            <button
              id="btn-sidebar-new-lead"
              type="button"
              onClick={() => setIsNewLeadModalOpen(true)}
              className={`${
                isCollapsedDesktop ? 'w-10 h-10 p-0 justify-center' : 'w-full py-2 px-3 justify-center gap-1.5'
              } flex items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap`}
              title="New Client Lead"
            >
              <Plus className="w-4 h-4 shrink-0" />
              {!isCollapsedDesktop && <span>New Client Lead</span>}
            </button>

            {['admin', 'ceo', 'bd_head', 'sales'].includes(role) && (
              <button
                id="btn-sidebar-ai-pitch"
                type="button"
                onClick={() => openAIModal()}
                className={`${
                  isCollapsedDesktop ? 'w-10 h-9 p-0 justify-center' : 'w-full py-1.5 px-3 justify-center gap-1.5'
                } flex items-center rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer whitespace-nowrap`}
                title="AI Proposal & Pitch Assistant"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                {!isCollapsedDesktop && <span>AI Proposal &amp; Pitch</span>}
              </button>
            )}
          </div>
        )}

        {/* Domain-Grouped Navigation */}
        <nav className="px-2.5 py-2 flex-1 overflow-y-auto space-y-3">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => item.roles.includes(role));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="space-y-0.5">
                {!isCollapsedDesktop && (
                  <div className="px-2.5 pt-1 pb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {group.label}
                  </div>
                )}
                {isCollapsedDesktop && (
                  <div className="mx-2 my-1 border-t border-slate-200 dark:border-slate-800" />
                )}

                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      id={`sidebar-nav-${item.id}`}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      title={item.label}
                      className={`w-full flex items-center ${
                        isCollapsedDesktop ? 'justify-center px-0 py-2' : 'justify-between px-2.5 py-1.5'
                      } rounded-lg text-[13px] transition-colors cursor-pointer relative ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/80 dark:border-indigo-500/30'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60 font-medium border border-transparent'
                      }`}
                    >
                      <div className={`flex items-center ${isCollapsedDesktop ? 'justify-center' : 'gap-2.5 min-w-0'}`}>
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        />
                        {!isCollapsedDesktop && <span className="truncate">{item.label}</span>}
                      </div>

                      {!isCollapsedDesktop && item.dynamicCount !== undefined && (
                        <span className="text-[11px] font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                          {item.dynamicCount}
                        </span>
                      )}

                      {isCollapsedDesktop && item.dynamicCount !== undefined && (
                        <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Bottom Utility & Session Section */}
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 space-y-2 bg-slate-50/70 dark:bg-[#0a192f]">
          {!isCollapsedDesktop ? (
            <>
              <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <ThemeToggle variant="segmented" showLabels={true} className="w-full justify-between" />
              </div>

              <div className="flex items-center justify-between text-[11px] px-1">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(true)}
                  className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-mono tabular-nums font-medium cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>SOP {automatedTestsPassedCount}/17</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDatabaseModalOpen(true)}
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 font-mono cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{databaseStatus?.engine === 'postgresql' ? 'Neon PG' : 'Local DB'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(true)}
                className="w-9 h-8 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                title={`SOP Tests ${automatedTestsPassedCount}/17 Passed`}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {currentUser ? (
            <button
              type="button"
              onClick={logout}
              title={`Sign Out (${currentUser.name})`}
              className={`w-full flex items-center justify-center gap-2 py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer whitespace-nowrap`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsedDesktop && <span>Sign Out</span>}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              title="Sign In"
              className="w-full flex items-center justify-center gap-2 py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              {!isCollapsedDesktop && <span>Sign In</span>}
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
