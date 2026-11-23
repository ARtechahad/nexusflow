import React, { useState } from 'react';
import { Check, FolderKanban, KeyRound, Lock, Mail, Shield, Users } from 'lucide-react';

type PreviewTabId = 'portal' | 'rbac' | 'pipeline' | 'outbound';

interface PreviewTab {
  id: PreviewTabId;
  label: string;
}

const PREVIEW_TABS: PreviewTab[] = [
  { id: 'portal', label: 'Client Portal' },
  { id: 'rbac', label: 'Department RBAC' },
  { id: 'pipeline', label: 'Deal Pipeline' },
  { id: 'outbound', label: 'Outbound Sequences' }
];

const WORKSPACE_PRESETS = [
  {
    id: 'ws-saas',
    name: 'Client Portal — SaaS Build',
    isolation: 'Tenant isolated · PostgreSQL schema scoped',
    deliverables: [
      { name: 'Auth & Role Permissions', stage: 'Delivered', artifact: 'PR #42 merged' },
      { name: 'Admin Console & Audit Log', stage: 'In staging', artifact: 'Staging build' },
      { name: 'AWS Deployment & Handoff', stage: 'Scheduled', artifact: 'Runbook & credentials' }
    ]
  },
  {
    id: 'ws-data',
    name: 'Client Portal — B2B Data Sprint',
    isolation: 'Tenant isolated · BYOK vault active',
    deliverables: [
      { name: 'Python Scraper Pipeline', stage: 'Delivered', artifact: 'Entity-resolved CSV' },
      { name: 'DNS / MX / SMTP Verification', stage: 'Delivered', artifact: 'Verified list ready' },
      { name: 'CRM Webhook Sync', stage: 'In staging', artifact: 'Signed webhook' }
    ]
  }
] as const;

type DeptKey = 'Engineering' | 'Data Operations' | 'Outbound';
type ModuleKey = 'Client Portal' | 'Deal Pipeline' | 'Email Hub' | 'BYOK Vault';

const INITIAL_RBAC: Record<DeptKey, Record<ModuleKey, boolean>> = {
  Engineering: {
    'Client Portal': true,
    'Deal Pipeline': false,
    'Email Hub': false,
    'BYOK Vault': true
  },
  'Data Operations': {
    'Client Portal': true,
    'Deal Pipeline': true,
    'Email Hub': false,
    'BYOK Vault': false
  },
  Outbound: {
    'Client Portal': false,
    'Deal Pipeline': true,
    'Email Hub': true,
    'BYOK Vault': false
  }
};

const PIPELINE_STAGES = [
  {
    stage: 'Intake',
    items: [
      { title: 'Web MVP Specification', tag: 'Web & Mobile' },
      { title: 'Niche Directory Extractor', tag: 'Python Data' }
    ]
  },
  {
    stage: 'Scoped',
    items: [
      { title: 'Unity Physics Prototype', tag: 'Unity C#' },
      { title: 'RAG Document Indexer', tag: 'AI Agents' }
    ]
  },
  {
    stage: 'Active Sprint',
    items: [
      { title: 'Multi-Tenant Portal Build', tag: 'TypeScript' },
      { title: 'CRM Webhook Triage', tag: 'Automation' }
    ]
  },
  {
    stage: 'Delivered',
    items: [
      { title: 'Verified B2B Dataset', tag: 'SMTP Checked' },
      { title: 'Resend Domain Warm-Up', tag: 'SPF / DKIM' }
    ]
  }
] as const;

export const NexusFlowPreviewWindow: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PreviewTabId>('portal');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<'ws-saas' | 'ws-data'>('ws-saas');
  const [rbacMatrix, setRbacMatrix] = useState<Record<DeptKey, Record<ModuleKey, boolean>>>(INITIAL_RBAC);
  const [selectedStage, setSelectedStage] = useState<string>('Active Sprint');
  const [mailProvider, setMailProvider] = useState<'resend' | 'smtp'>('resend');

  const activeWorkspace =
    WORKSPACE_PRESETS.find((w) => w.id === selectedWorkspaceId) || WORKSPACE_PRESETS[0];

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % PREVIEW_TABS.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + PREVIEW_TABS.length) % PREVIEW_TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = PREVIEW_TABS.length - 1;
    else return;

    e.preventDefault();
    const nextId = PREVIEW_TABS[next].id;
    setActiveTab(nextId);
    if (typeof document !== 'undefined') {
      document.getElementById(`nf-preview-tab-${nextId}`)?.focus();
    }
  };

  const toggleRbacPermission = (dept: DeptKey, mod: ModuleKey) => {
    setRbacMatrix((prev) => ({
      ...prev,
      [dept]: {
        ...prev[dept],
        [mod]: !prev[dept][mod]
      }
    }));
  };

  return (
    <div className="rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D131F] overflow-hidden">
      {/* Window Header Bar */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="px-3 py-1 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] text-[12px] font-mono text-slate-600 dark:text-slate-300 truncate max-w-full">
          app.almnexus.tech / nexusflow
        </div>

        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
          Multi-Tenant Workspace
        </span>
      </div>

      {/* Interactive Module Tabs */}
      <div
        role="tablist"
        aria-label="NexusFlow workspace views"
        className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]"
      >
        {PREVIEW_TABS.map((tab, idx) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nf-preview-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`nf-preview-panel-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                isSelected
                  ? 'border-[var(--accent)] text-slate-900 dark:text-white bg-white dark:bg-[#0D131F]'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Interactive View Stage */}
      <div
        id={`nf-preview-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`nf-preview-tab-${activeTab}`}
        className="p-5 sm:p-6 min-h-[260px]"
      >
        {activeTab === 'portal' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Users className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.75} aria-hidden="true" />
                <span>{activeWorkspace.name}</span>
              </div>

              <div className="inline-flex rounded-[6px] border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-[#0B0F17]">
                {WORKSPACE_PRESETS.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setSelectedWorkspaceId(ws.id)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-[4px] transition-colors cursor-pointer ${
                      selectedWorkspaceId === ws.id
                        ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {ws.id === 'ws-saas' ? 'Workspace A' : 'Workspace B'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {activeWorkspace.isolation}
            </p>

            <div className="border border-slate-200 dark:border-slate-800 rounded-[6px] divide-y divide-slate-200 dark:divide-slate-800">
              {activeWorkspace.deliverables.map((item) => (
                <div
                  key={item.name}
                  className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                >
                  <span className="font-medium text-slate-900 dark:text-slate-100">{item.name}</span>
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                    <span>{item.artifact}</span>
                    <span className="text-slate-900 dark:text-slate-200 font-semibold">
                      {item.stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'rbac' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Shield className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.75} aria-hidden="true" />
                <span>Department Module Access Matrix</span>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Click cells to toggle scope
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-[6px]">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827]">
                    <th className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-200">
                      Department
                    </th>
                    {(['Client Portal', 'Deal Pipeline', 'Email Hub', 'BYOK Vault'] as ModuleKey[]).map(
                      (mod) => (
                        <th
                          key={mod}
                          className="py-2.5 px-3 font-mono text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
                        >
                          {mod}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(['Engineering', 'Data Operations', 'Outbound'] as DeptKey[]).map((dept) => (
                    <tr key={dept}>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {dept}
                      </td>
                      {(['Client Portal', 'Deal Pipeline', 'Email Hub', 'BYOK Vault'] as ModuleKey[]).map(
                        (mod) => {
                          const enabled = rbacMatrix[dept][mod];
                          return (
                            <td key={mod} className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={() => toggleRbacPermission(dept, mod)}
                                aria-pressed={enabled}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border text-xs font-mono transition-colors cursor-pointer ${
                                  enabled
                                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-transparent'
                                }`}
                              >
                                {enabled ? (
                                  <Check className="w-3 h-3" strokeWidth={2} aria-hidden="true" />
                                ) : (
                                  <Lock className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
                                )}
                                <span>{enabled ? 'Allowed' : 'Locked'}</span>
                              </button>
                            </td>
                          );
                        }
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <FolderKanban className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.75} aria-hidden="true" />
                <span>Pipeline &amp; Delivery Stages</span>
              </div>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Selected stage: {selectedStage}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PIPELINE_STAGES.map((col) => {
                const isActive = selectedStage === col.stage;
                return (
                  <button
                    key={col.stage}
                    type="button"
                    onClick={() => setSelectedStage(col.stage)}
                    className={`text-left p-3 rounded-[6px] border transition-colors cursor-pointer space-y-2.5 ${
                      isActive
                        ? 'border-[var(--accent)] bg-slate-50 dark:bg-[#111827]'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17]'
                    }`}
                  >
                    <div className="text-xs font-mono font-semibold text-slate-900 dark:text-white pb-1.5 border-b border-slate-200 dark:border-slate-800">
                      {col.stage}
                    </div>
                    <div className="space-y-2">
                      {col.items.map((card) => (
                        <div
                          key={card.title}
                          className="p-2 rounded-[4px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D131F] space-y-1"
                        >
                          <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                            {card.title}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {card.tag}
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'outbound' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Mail className="w-4 h-4 text-[var(--accent)]" strokeWidth={1.75} aria-hidden="true" />
                <span>Outbound Mail Transport &amp; BYOK Vault</span>
              </div>

              <div className="inline-flex rounded-[6px] border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-[#0B0F17]">
                <button
                  type="button"
                  onClick={() => setMailProvider('resend')}
                  className={`px-2.5 py-1 text-xs font-mono rounded-[4px] cursor-pointer ${
                    mailProvider === 'resend'
                      ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Resend API
                </button>
                <button
                  type="button"
                  onClick={() => setMailProvider('smtp')}
                  className={`px-2.5 py-1 text-xs font-mono rounded-[4px] cursor-pointer ${
                    mailProvider === 'smtp'
                      ? 'bg-white dark:bg-[#111827] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Custom SMTP
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-[6px] border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <KeyRound className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                  <span>{mailProvider === 'resend' ? 'Resend Tenant Key' : 'SMTP Credential Pool'}</span>
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {mailProvider === 'resend'
                    ? 'Encrypted BYOK vault connected to almnexus.tech sending domain'
                    : 'Dedicated TLS/STARTTLS mailbox rotation with per-domain warm-up'}
                </p>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  DNS checks: SPF · DKIM · DMARC verified
                </p>
              </div>

              <div className="p-4 rounded-[6px] border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Sequence &amp; Inbox Triage
                </div>
                <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                  <li>Step 1 — Initial domain-verified outreach</li>
                  <li>Step 2 — Automated follow-up on non-reply</li>
                  <li>Reply Sync — Unified inbox &amp; CRM webhook trigger</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
