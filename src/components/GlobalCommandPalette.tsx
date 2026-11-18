import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Command,
  Kanban,
  Layers,
  LayoutDashboard,
  Inbox,
  Send,
  BookOpen,
  BarChart3,
  Coins,
  MessageSquare,
  FolderLock,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  Building2,
  User,
  Sun,
  Moon,
  X,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { offlineSyncService } from '../services/offlineSyncService';
import {
  getDepartmentAllowedModules,
  hasModuleAccess,
  isEmailOutreachVisible
} from '../utils/departmentAccess';

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    currentTenant,
    companyRole,
    departments,
    selectedDepartmentId,
    setActiveTab,
    projects,
    setIsNewLeadModalOpen,
    setIsOnboardingModalOpen,
    setIsWikiModalOpen,
    toggleTheme,
    isDark,
    showToast,
    refreshProjects
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (isOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentUser) return null;

  const isAdmin = companyRole === 'company_admin';
  const isDeptHead = companyRole === 'department_head';
  const activeDept =
    departments.find((d) => d.id === selectedDepartmentId) ||
    (departments.length === 1 ? departments[0] : null);

  const settings = currentTenant?.settings;
  const canOps = isAdmin || hasModuleAccess(companyRole, 'operations', activeDept, departments);
  const canChat = isAdmin || hasModuleAccess(companyRole, 'chat', activeDept, departments);
  const canEmailHub = isEmailOutreachVisible(companyRole, settings, activeDept, departments);
  const canClientInbox = isAdmin
    ? Boolean(settings?.enableClientInbox) ||
      departments.some((d) => getDepartmentAllowedModules(d).includes('client_inbox'))
    : hasModuleAccess(companyRole, 'client_inbox', activeDept, departments);
  const canFinancials = isAdmin
    ? Boolean(settings?.enableFinancials) ||
      departments.some((d) => getDepartmentAllowedModules(d).includes('financials'))
    : hasModuleAccess(companyRole, 'financials', activeDept, departments);
  const canDeals = isAdmin && Boolean(settings?.enableDealsPipeline);

  const allNavigationItems = [
    { id: 'nav-overview', label: 'Company Overview', group: 'Workspace', icon: LayoutDashboard, action: () => setActiveTab('overview'), shortcut: 'G O', allowed: isAdmin },
    { id: 'nav-departments', label: 'Departments & Team', group: 'Workspace', icon: Building2, action: () => setActiveTab('departments'), shortcut: 'G T', allowed: isAdmin },
    { id: 'nav-dept', label: isAdmin ? 'Operations & Tasks' : 'Department Operations', group: 'Workspace', icon: Layers, action: () => setActiveTab('departmental'), shortcut: 'G D', allowed: canOps },
    { id: 'nav-chat', label: 'Department Chat', group: 'Workspace', icon: MessageSquare, action: () => setActiveTab('chat'), shortcut: 'G M', allowed: canChat },
    { id: 'nav-outreach', label: 'Email Outreach (SMTP / Resend Campaigns)', group: 'Optional Modules', icon: Send, action: () => setActiveTab('outreach_suite'), shortcut: 'G E', allowed: canEmailHub },
    { id: 'nav-inbox', label: 'Unified Client Inbox', group: 'Optional Modules', icon: Inbox, action: () => setActiveTab('inbox'), shortcut: 'G I', allowed: canClientInbox },
    { id: 'nav-commissions', label: 'Commission & Payout Ledger', group: 'Optional Modules', icon: Coins, action: () => setActiveTab('commissions'), shortcut: 'G C', allowed: canFinancials },
    { id: 'nav-analytics', label: 'Revenue Analytics', group: 'Optional Modules', icon: BarChart3, action: () => setActiveTab('analytics'), shortcut: 'G A', allowed: canFinancials },
    { id: 'nav-pipeline', label: 'Executive Dashboard & Deals Pipeline', group: 'Optional Modules', icon: Kanban, action: () => setActiveTab('pipeline'), shortcut: 'G P', allowed: canDeals },
    { id: 'nav-sop', label: 'SOP Stage Gates', group: 'Optional Modules', icon: BookOpen, action: () => setActiveTab('sop'), shortcut: 'G S', allowed: canDeals },
    { id: 'nav-vault', label: 'Secure File Vault', group: 'Optional Modules', icon: FolderLock, action: () => setActiveTab('vault'), shortcut: 'G V', allowed: canDeals },
    { id: 'nav-portal', label: 'Client Portal', group: 'Optional Modules', icon: ExternalLink, action: () => setActiveTab('portal'), shortcut: 'G K', allowed: canDeals },
    { id: 'nav-integrations', label: 'Webhooks & API', group: 'Optional Modules', icon: Globe, action: () => setActiveTab('integrations'), shortcut: 'G X', allowed: canDeals },
    { id: 'nav-profile', label: isAdmin ? 'Account & Settings' : 'My Profile', group: 'My Account', icon: User, action: () => setActiveTab('profile'), shortcut: 'G U', allowed: true }
  ];

  const navigationItems = allNavigationItems.filter((item) => item.allowed);

  const allActionItems = [
    {
      id: 'act-new-deal',
      label: 'Create New Client Deal',
      group: 'Quick Actions',
      icon: Plus,
      action: () => setIsNewLeadModalOpen(true),
      shortcut: 'N',
      allowed: canDeals
    },
    {
      id: 'act-sync-cache',
      label: 'Trigger Cloud Sync Now',
      group: 'Quick Actions',
      icon: RefreshCw,
      action: async () => {
        showToast('Initiating sync queue flush...', 'info');
        await offlineSyncService.processQueue();
        if (isAdmin || isDeptHead) {
          await refreshProjects();
        }
        showToast('Workspace synchronized with cloud database.', 'success');
      },
      shortcut: 'S',
      allowed: isAdmin
    },
    {
      id: 'act-tenant-onboard',
      label: 'Register New Company Workspace',
      group: 'Quick Actions',
      icon: Building2,
      action: () => setIsOnboardingModalOpen(true),
      shortcut: 'O',
      allowed: isAdmin
    },
    {
      id: 'act-company-wiki',
      label: 'Open Company SOP & Knowledge Base',
      group: 'Quick Actions',
      icon: BookOpen,
      action: () => setIsWikiModalOpen(true),
      shortcut: 'W',
      allowed: isAdmin
    },
    {
      id: 'act-toggle-theme',
      label: `Switch Theme to ${isDark ? 'Light' : 'Dark'} Mode`,
      group: 'Quick Actions',
      icon: isDark ? Sun : Moon,
      action: () => toggleTheme(),
      shortcut: 'M',
      allowed: true
    }
  ];

  const actionItems = allActionItems.filter((item) => item.allowed);

  const projectItems = isAdmin
    ? projects.slice(0, 8).map(p => ({
        id: `proj-${p.id}`,
        label: `${p.clientName} (${p.clientCompany || p.websiteType}) - $${p.finalPrice || p.estimatedPrice}`,
        group: 'Active Deals',
        icon: CheckCircle2,
        action: () => {
          setActiveTab('pipeline');
          showToast(`Viewing deal for ${p.clientName}`, 'info');
        },
        shortcut: p.status.toUpperCase()
      }))
    : [];

  const allItems = [...navigationItems, ...actionItems, ...projectItems];

  const filteredItems = allItems.filter(item =>
    item.label.toLowerCase().includes(search.toLowerCase()) ||
    item.group.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-[#F8FAFC] dark:bg-[#090D16]">
          <Command className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, workspace module, deal, or shortcut..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none font-medium"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            ESC
          </span>
        </div>

        <div className="p-2 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-1">
              <Search className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
              <p className="font-bold text-slate-700 dark:text-slate-300">No matching commands or deals found</p>
              <p>Try searching for &quot;Email Hub&quot;, &quot;Dashboard&quot;, &quot;Commission&quot;, or a client name.</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[#F8FAFC] dark:bg-[#090D16] text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-800'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold block truncate">
                        {item.label}
                      </span>
                      <span className={`text-[10px] block font-mono ${
                        isSelected ? 'text-indigo-100' : 'text-slate-400'
                      }`}>
                        {item.group}
                      </span>
                    </div>
                  </div>

                  {item.shortcut && (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shrink-0 ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}>
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
            ClientOps Command Palette
          </span>
        </div>
      </div>
    </div>
  );
};
