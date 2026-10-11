import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Command, 
  Kanban, 
  Sparkles, 
  Layers, 
  Mail, 
  Inbox, 
  Send, 
  BookOpen, 
  BarChart3, 
  Globe2, 
  Coins, 
  MessageSquare, 
  FolderLock, 
  ExternalLink, 
  Globe, 
  Plus, 
  Play, 
  RefreshCw, 
  Building2, 
  User, 
  Sun, 
  Moon, 
  ArrowRight, 
  X,
  Zap,
  Activity,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { offlineSyncService } from '../services/offlineSyncService';
import { UserRole } from '../types';

interface GlobalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalCommandPalette: React.FC<GlobalCommandPaletteProps> = ({ isOpen, onClose }) => {
  const {
    setActiveTab,
    projects,
    setIsNewLeadModalOpen,
    setIsTestModalOpen,
    openAIModal,
    setIsAISettingsModalOpen,
    setIsOnboardingModalOpen,
    setIsPlatformHealthModalOpen,
    setIsWikiModalOpen,
    setIsAuthModalOpen,
    switchPersona,
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

  // Keyboard navigation & global shortcuts
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

  if (!isOpen) return null;

  // Build searchable commands
  const navigationItems = [
    { id: 'nav-pipeline', label: 'Pipeline & Deals (Kanban)', group: 'Navigation', icon: Kanban, action: () => setActiveTab('pipeline'), shortcut: 'G P' },
    { id: 'nav-leadflow', label: 'LeadFlow Agency (GTM Website)', group: 'Navigation', icon: Sparkles, action: () => setActiveTab('leadflow'), shortcut: 'G L' },
    { id: 'nav-dept', label: 'Department Velocity & Tracking', group: 'Navigation', icon: Layers, action: () => setActiveTab('departmental'), shortcut: 'G D' },
    { id: 'nav-gmail', label: 'Gmail Workspace & Mail Sync', group: 'Navigation', icon: Mail, action: () => setActiveTab('gmail'), shortcut: 'G M' },
    { id: 'nav-inbox', label: 'Unified Omni-Inbox', group: 'Navigation', icon: Inbox, action: () => setActiveTab('inbox'), shortcut: 'G I' },
    { id: 'nav-outreach', label: 'Outreach Engine & Scrapers', group: 'Navigation', icon: Send, action: () => setActiveTab('outreach'), shortcut: 'G O' },
    { id: 'nav-sop', label: 'SOP 1–11 Quality Gate Guide', group: 'Navigation', icon: BookOpen, action: () => setActiveTab('sop'), shortcut: 'G S' },
    { id: 'nav-analytics', label: 'Executive Revenue Analytics', group: 'Navigation', icon: BarChart3, action: () => setActiveTab('analytics'), shortcut: 'G A' },
    { id: 'nav-tools', label: 'Live Free APIs (Forex & DNS)', group: 'Navigation', icon: Globe2, action: () => setActiveTab('free_apis'), shortcut: 'G F' },
    { id: 'nav-commissions', label: 'Commission Ledger & Payouts', group: 'Navigation', icon: Coins, action: () => setActiveTab('commissions'), shortcut: 'G C' },
    { id: 'nav-chat', label: 'Team Collaboration Chat', group: 'Navigation', icon: MessageSquare, action: () => setActiveTab('chat'), shortcut: 'G T' },
    { id: 'nav-vault', label: 'Secure File Vault & Credentials', group: 'Navigation', icon: FolderLock, action: () => setActiveTab('vault'), shortcut: 'G V' },
    { id: 'nav-portal', label: 'Isolated Client Portal', group: 'Navigation', icon: ExternalLink, action: () => setActiveTab('portal'), shortcut: 'G K' },
    { id: 'nav-integrations', label: 'Webhooks & External Connectors', group: 'Navigation', icon: Globe, action: () => setActiveTab('integrations'), shortcut: 'G X' }
  ];

  const actionItems = [
    { 
      id: 'act-new-deal', 
      label: 'Create New Client Lead / Deal', 
      group: 'Quick Actions', 
      icon: Plus, 
      action: () => setIsNewLeadModalOpen(true), 
      shortcut: 'N' 
    },
    { 
      id: 'act-test-gate', 
      label: 'Run Automated SOP 1–11 Test Suite', 
      group: 'Quick Actions', 
      icon: Play, 
      action: () => setIsTestModalOpen(true), 
      shortcut: 'T' 
    },
    { 
      id: 'act-ai-assistant', 
      label: 'Launch Gemini AI Scoper & Pitch Assistant', 
      group: 'Quick Actions', 
      icon: Sparkles, 
      action: () => openAIModal({ mode: 'custom_pitch' }), 
      shortcut: 'A' 
    },
    { 
      id: 'act-sync-cache', 
      label: 'Trigger Offline-to-Cloud Sync Now', 
      group: 'Quick Actions', 
      icon: RefreshCw, 
      action: async () => {
        showToast('Initiating offline sync queue flush...', 'info');
        await offlineSyncService.processQueue();
        await refreshProjects();
        showToast('Local database synced with cloud backend!', 'success');
      }, 
      shortcut: 'S' 
    },
    { 
      id: 'act-tenant-onboard', 
      label: 'Open Multi-Tenant Onboarding Wizard', 
      group: 'Quick Actions', 
      icon: Building2, 
      action: () => setIsOnboardingModalOpen(true), 
      shortcut: 'O' 
    },
    { 
      id: 'act-platform-health', 
      label: 'Inspect API Platform Health & Latency', 
      group: 'Quick Actions', 
      icon: Activity, 
      action: () => setIsPlatformHealthModalOpen(true), 
      shortcut: 'H' 
    },
    { 
      id: 'act-company-wiki', 
      label: 'Open Internal Company Wiki & SOP Docs', 
      group: 'Quick Actions', 
      icon: BookOpen, 
      action: () => setIsWikiModalOpen(true), 
      shortcut: 'W' 
    },
    { 
      id: 'act-toggle-theme', 
      label: `Switch Theme to ${isDark ? 'Light' : 'Dark'} Mode`, 
      group: 'Quick Actions', 
      icon: isDark ? Sun : Moon, 
      action: () => toggleTheme(), 
      shortcut: 'M' 
    }
  ];

  const roleItems: Array<{ id: string; label: string; group: string; icon: any; action: () => void; shortcut: string }> = [
    { id: 'role-admin', label: 'Switch to Executive (Admin/CEO: Tariq Mehmood)', group: 'Role Switcher', icon: User, action: () => switchPersona('admin'), shortcut: 'R 1' },
    { id: 'role-sales', label: 'Switch to Sales Specialist (Hamza Farooq)', group: 'Role Switcher', icon: User, action: () => switchPersona('sales'), shortcut: 'R 2' },
    { id: 'role-coord', label: 'Switch to Project Operations QA (Fatima Noor)', group: 'Role Switcher', icon: User, action: () => switchPersona('coordinator'), shortcut: 'R 3' },
    { id: 'role-dev', label: 'Switch to Lead Software Engineer (Zain Ul Abideen)', group: 'Role Switcher', icon: User, action: () => switchPersona('developer'), shortcut: 'R 4' },
    { id: 'role-client', label: 'Switch to Client Stakeholder (Alexander Vance)', group: 'Role Switcher', icon: User, action: () => switchPersona('client_guest'), shortcut: 'R 5' },
    { id: 'role-partner', label: 'Switch to Partner Deal Evaluator (Marcus Vance)', group: 'Role Switcher', icon: User, action: () => switchPersona('collaborator'), shortcut: 'R 6' }
  ];

  // Projects as dynamic items
  const projectItems = projects.slice(0, 8).map(p => ({
    id: `proj-${p.id}`,
    label: `${p.clientName} (${p.clientCompany || p.websiteType}) - $${p.finalPrice || p.estimatedPrice}`,
    group: 'Active Deals & Projects',
    icon: CheckCircle2,
    action: () => {
      setActiveTab('pipeline');
      showToast(`Viewing deal for ${p.clientName}`, 'info');
    },
    shortcut: p.status.toUpperCase()
  }));

  const allItems = [...navigationItems, ...actionItems, ...roleItems, ...projectItems];

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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Header Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60">
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
            placeholder="Type a command, screen name, deal, or shortcut..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-white/5">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-1">
              <Search className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
              <p className="font-bold text-slate-700 dark:text-slate-300">No matching commands or deals found</p>
              <p>Try searching for "Pipeline", "LeadFlow", "SOP", "Sync", or a client name.</p>
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
                  className={`p-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition ${
                    isSelected 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                      : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected 
                        ? 'bg-white/20 text-white' 
                        : 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400'
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
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5'
                    }`}>
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Legend */}
        <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#080c16] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>&uarr;&darr; Navigate</span>
            <span>&crarr; Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
            ALM Nexus Command Engine
          </span>
        </div>
      </div>
    </div>
  );
};
