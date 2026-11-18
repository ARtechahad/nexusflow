import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Layers,
  Users,
  ListTodo,
  Check,
  ArrowRight,
  RefreshCw,
  UserPlus,
  Plus,
  Settings,
  MessageSquare,
  SlidersHorizontal,
  X,
  Copy,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildAuthHeaders } from '../lib/api';
import { Department, DepartmentModuleKey } from '../types';
import {
  DEPARTMENT_MODULE_DEFINITIONS,
  DEFAULT_DEPARTMENT_MODULES,
  getDepartmentAllowedModules
} from '../utils/departmentAccess';

interface OverviewMemberSummary {
  userId: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  departmentIds: string[];
  availabilityStatus: string;
}

interface OverviewActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
}

interface OverviewResponse {
  success: boolean;
  company: {
    id: string;
    name: string;
    industry: string;
    companySize: string;
    settings?: {
      enableEmailOutreach?: boolean;
      enableClientInbox?: boolean;
      enableFinancials?: boolean;
      enableDealsPipeline?: boolean;
    };
    createdAt: string;
  };
  counts: {
    departments: number;
    members: number;
    availableMembers: number;
    pendingInvites: number;
    tasksTotal: number;
    tasksOpen: number;
    tasksTodo: number;
    tasksInProgress: number;
    tasksCompleted: number;
    tasksCompletedThisWeek: number;
    emailAccounts: number;
    campaignsSent: number;
    emailsDelivered: number;
  };
  onboardingSteps: {
    hasDepartments: boolean;
    hasTeamMembers: boolean;
    hasTasks: boolean;
  };
  emailOutreachEnabled: boolean;
  departments: (Department & { tasksOpen?: number })[];
  members?: OverviewMemberSummary[];
  recentActivity?: OverviewActivityItem[];
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

export const CompanyOverviewView: React.FC = () => {
  const {
    authToken,
    currentUser,
    currentTenant,
    departments: contextDepartments,
    setActiveTab,
    setSelectedDepartmentId,
    createDepartment,
    refreshDepartments,
    showToast
  } = useApp();

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [skipSetup, setSkipSetup] = useState<boolean>(false);

  // Quick Task inline form (Operational Dashboard)
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskDeptId, setQuickTaskDeptId] = useState('');
  const [quickTaskAssigneeId, setQuickTaskAssigneeId] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [creatingTask, setCreatingTask] = useState(false);

  // Add Department Modal
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [newDeptModules, setNewDeptModules] = useState<DepartmentModuleKey[]>(DEFAULT_DEPARTMENT_MODULES);
  const [creatingDept, setCreatingDept] = useState(false);

  // Invite Team Member Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDeptId, setInviteDeptId] = useState('');
  const [inviteRole, setInviteRole] = useState<'department_head' | 'employee'>('employee');
  const [inviteDesignation, setInviteDesignation] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenant?.id) return;
    try {
      const saved = localStorage.getItem(`clientops_skip_setup_${currentTenant.id}`);
      setSkipSetup(saved === 'true');
    } catch {
      setSkipSetup(false);
    }
  }, [currentTenant?.id]);

  const handleToggleSkipSetup = (skip: boolean) => {
    setSkipSetup(skip);
    if (!currentTenant?.id) return;
    try {
      if (skip) {
        localStorage.setItem(`clientops_skip_setup_${currentTenant.id}`, 'true');
      } else {
        localStorage.removeItem(`clientops_skip_setup_${currentTenant.id}`);
      }
    } catch {
      // Ignore storage failures in private browsing
    }
  };

  const loadOverview = useCallback(async () => {
    if (!authToken || !currentTenant?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(currentTenant.id)}/overview`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Tenant-Id': currentTenant.id
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          setOverview(data);
        }
      }
    } catch (err) {
      console.warn('Could not load company overview', err);
    } finally {
      setLoading(false);
    }
  }, [authToken, currentTenant?.id]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview, contextDepartments.length]);

  const deptList = overview?.departments || contextDepartments;
  const membersList = overview?.members || [];
  const recentActivity = overview?.recentActivity || [];

  useEffect(() => {
    if (!quickTaskDeptId && deptList.length > 0) {
      setQuickTaskDeptId(deptList[0].id);
    }
    if (!inviteDeptId && deptList.length > 0) {
      setInviteDeptId(deptList[0].id);
    }
  }, [deptList, quickTaskDeptId, inviteDeptId]);

  useEffect(() => {
    if (!quickTaskAssigneeId && currentUser?.id) {
      setQuickTaskAssigneeId(currentUser.id);
    }
  }, [currentUser?.id, quickTaskAssigneeId]);

  const counts = overview?.counts || {
    departments: contextDepartments.length,
    members: currentTenant?.activeMembersCount || 1,
    availableMembers: 1,
    pendingInvites: 0,
    tasksTotal: 0,
    tasksOpen: 0,
    tasksTodo: 0,
    tasksInProgress: 0,
    tasksCompleted: 0,
    tasksCompletedThisWeek: 0,
    emailAccounts: 0,
    campaignsSent: 0,
    emailsDelivered: 0
  };

  const steps = overview?.onboardingSteps || {
    hasDepartments: contextDepartments.length > 0,
    hasTeamMembers: (currentTenant?.activeMembersCount || 1) > 1,
    hasTasks: false
  };

  const companyName = currentTenant?.name || 'Your Company';
  const emailOutreachEnabled =
    overview?.emailOutreachEnabled ?? Boolean(currentTenant?.settings?.enableEmailOutreach);

  // First-run progressive state: 0 tasks AND <= 1 active member AND setup not skipped
  const isFirstRunCondition = counts.tasksTotal === 0 && counts.members <= 1;
  const showFirstRunHero = isFirstRunCondition && !skipSetup;

  const openInviteModal = (preferredDeptId?: string) => {
    setInviteDeptId(preferredDeptId || deptList[0]?.id || '');
    setInviteEmail('');
    setInviteDesignation('');
    setInviteRole('employee');
    setGeneratedInviteUrl(null);
    setInviteError(null);
    setIsInviteOpen(true);
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setCreatingDept(true);
    const res = await createDepartment(newDeptName.trim(), newDeptDesc.trim(), newDeptModules);
    setCreatingDept(false);
    if (res.success) {
      setNewDeptName('');
      setNewDeptDesc('');
      setNewDeptModules(DEFAULT_DEPARTMENT_MODULES);
      setIsAddDeptOpen(false);
      await refreshDepartments();
      await loadOverview();
    } else {
      showToast(res.message || 'Could not create department.', 'error');
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant?.id || !inviteEmail.trim() || !inviteDeptId) return;
    setSendingInvite(true);
    setInviteError(null);
    setGeneratedInviteUrl(null);
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(currentTenant.id)}/invites`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email: inviteEmail.trim(),
          departmentId: inviteDeptId,
          role: inviteRole,
          designation: inviteDesignation.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Invitation created.', 'success');
        setGeneratedInviteUrl(data.invite?.inviteUrl || null);
        setInviteEmail('');
        setInviteDesignation('');
        await loadOverview();
      } else {
        const msg = data.message || data.error || 'Failed to send invitation.';
        setInviteError(msg);
      }
    } catch {
      setInviteError('Network error sending invitation.');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleQuickCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetDeptId = quickTaskDeptId || deptList[0]?.id;
    if (!currentTenant?.id || !targetDeptId || !quickTaskTitle.trim()) return;

    setCreatingTask(true);
    try {
      const res = await fetch(
        `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(
          targetDeptId
        )}/tasks`,
        {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            title: quickTaskTitle.trim(),
            priority: quickTaskPriority,
            assigneeUserId: quickTaskAssigneeId || currentUser?.id
          })
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setQuickTaskTitle('');
        showToast('Task created and assigned.', 'success');
        await refreshDepartments();
        await loadOverview();
      } else {
        showToast(data.error || data.message || 'Could not create task.', 'error');
      }
    } catch {
      showToast('Network error creating task.', 'error');
    } finally {
      setCreatingTask(false);
    }
  };

  const copyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Invite link copied to clipboard.', 'success');
    } catch {
      showToast('Select and copy the invite link manually.', 'info');
    }
  };

  const setupSteps = [
    {
      num: 1,
      label: steps.hasDepartments ? 'Departments Ready' : 'Create Departments',
      done: steps.hasDepartments,
      active: !steps.hasDepartments,
      onClick: () => setIsAddDeptOpen(true)
    },
    {
      num: 2,
      label: 'Invite Your Team',
      done: steps.hasTeamMembers,
      active: steps.hasDepartments && !steps.hasTeamMembers,
      onClick: () => openInviteModal()
    },
    {
      num: 3,
      label: 'Create First Task',
      done: steps.hasTasks,
      active: steps.hasDepartments && steps.hasTeamMembers && !steps.hasTasks,
      onClick: () => {
        if (deptList[0]) setSelectedDepartmentId(deptList[0].id);
        setActiveTab('departmental');
      }
    }
  ];

  // Filter assignee choices to those belonging to the selected quickTaskDeptId (fallback to all members + self)
  const scopedAssignees = membersList.filter(
    (m) => !quickTaskDeptId || m.departmentIds.includes(quickTaskDeptId)
  );
  const assigneeOptions =
    scopedAssignees.length > 0
      ? scopedAssignees
      : currentUser
      ? [{ userId: currentUser.id, name: currentUser.name, designation: 'Owner' }]
      : [];

  return (
    <div className="pb-12 space-y-6">
      {showFirstRunHero ? (
        /* =========================================================
           MODE A: PROGRESSIVE FIRST-RUN EXPERIENCE (ZERO CLUTTER)
           ========================================================= */
        <div className="max-w-4xl mx-auto pt-2 space-y-6">
          {/* Welcome Setup Hero */}
          <section className="card-elevated rounded-xl p-8 sm:p-10 text-center space-y-7">
            <div className="space-y-2.5 max-w-2xl mx-auto">
              <p className="text-xs font-medium text-[#4F46E5] dark:text-indigo-400">
                Workspace Setup &middot; {currentTenant?.businessInfo?.industry || 'Company Operations'}
              </p>
              <h1
                className="text-2xl sm:text-3xl font-bold text-[#0F172A] dark:text-white tracking-tight leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Welcome to {companyName} — let&apos;s get your workspace ready
              </h1>
              <p className="text-sm text-[#64748B] dark:text-slate-400 leading-relaxed">
                Your workspace is active and isolated. Bring your team onboard or configure additional departments to begin tracking daily execution.
              </p>
            </div>

            {/* Single Horizontal 3-Step Interactive Setup Bar */}
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#090D16] border border-[#E2E8F0] dark:border-slate-800">
                {setupSteps.map((step) => (
                  <button
                    key={step.num}
                    type="button"
                    onClick={step.onClick}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                      step.active
                        ? 'bg-[#FFFFFF] dark:bg-[#111827] text-[#0F172A] dark:text-white border border-[#E2E8F0] dark:border-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)]'
                        : step.done
                        ? 'text-emerald-700 dark:text-emerald-400 hover:bg-white/60 dark:hover:bg-slate-800/40'
                        : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono tabular-nums shrink-0 ${
                        step.done
                          ? 'bg-emerald-600 text-white'
                          : step.active
                          ? 'bg-[#4F46E5] text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-[#64748B] dark:text-slate-400'
                      }`}
                    >
                      {step.done ? <Check className="w-3 h-3" /> : step.num}
                    </span>
                    <span className="truncate">{step.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Single Primary CTA + Subtle Skip Toggle */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-1">
              <button
                id="btn-hero-invite-team"
                type="button"
                onClick={() =>
                  steps.hasDepartments
                    ? openInviteModal()
                    : setIsAddDeptOpen(true)
                }
                className="btn-tactile-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" />
                <span>{steps.hasDepartments ? 'Invite Team Members' : 'Create First Department'}</span>
              </button>

              <button
                id="btn-skip-setup"
                type="button"
                onClick={() => handleToggleSkipSetup(true)}
                className="text-xs font-medium text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white transition cursor-pointer whitespace-nowrap"
              >
                Skip setup &amp; view dashboard
              </button>
            </div>
          </section>

          {/* Compact Departments List (ONLY below hero in first-run mode) */}
          <section className="card-elevated rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white tracking-tight">
                  Departments
                </h2>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Your active workspaces and module permissions
                </p>
              </div>
              <button
                id="btn-first-run-add-dept"
                type="button"
                onClick={() => setIsAddDeptOpen(true)}
                className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" />
                <span>Add Department</span>
              </button>
            </div>

            {deptList.length === 0 ? (
              <div className="px-6 py-10 text-center space-y-2">
                <p className="text-xs font-medium text-[#0F172A] dark:text-white">
                  No departments configured yet
                </p>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  Add a department to begin inviting heads and assigning work.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                {deptList.map((dept) => {
                  const allowedMods = getDepartmentAllowedModules(dept);
                  const modLabels = DEPARTMENT_MODULE_DEFINITIONS
                    .filter((m) => allowedMods.includes(m.key))
                    .map((m) => m.label);

                  return (
                    <div
                      key={dept.id}
                      className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A] dark:text-white">
                          <span className="truncate">{dept.name}</span>
                        </div>
                        <p className="text-xs text-[#64748B] dark:text-slate-400 truncate">
                          <span className="font-mono tabular-nums">{dept.memberCount ?? 1} member</span>
                          <span className="mx-1.5" aria-hidden="true">&middot;</span>
                          <span>{modLabels.join(' · ')}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => openInviteModal(dept.id)}
                          className="text-xs font-semibold text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          Invite Member
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDepartmentId(dept.id);
                            setActiveTab('departments');
                          }}
                          className="text-xs font-medium text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <span>Configure</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* =========================================================
           MODE B: CLEAN OPERATIONAL DASHBOARD (ONCE SETUP COMPLETE/SKIPPED)
           ========================================================= */
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Page Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-slate-400">
                <span>{currentTenant?.businessInfo?.industry || 'Operations Workspace'}</span>
                <span aria-hidden="true">&middot;</span>
                <span>Owner: {currentUser?.name || 'Account Owner'}</span>
              </div>
              <h1 className="text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight">
                {companyName}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isFirstRunCondition && skipSetup && (
                <button
                  type="button"
                  onClick={() => handleToggleSkipSetup(false)}
                  className="text-xs font-medium text-[#4F46E5] dark:text-indigo-400 hover:underline px-2 py-1.5 cursor-pointer whitespace-nowrap"
                >
                  Show setup guide
                </button>
              )}
              <button
                type="button"
                onClick={loadOverview}
                disabled={loading}
                className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => openInviteModal()}
                className="btn-tactile-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Team Member</span>
              </button>
            </div>
          </div>

          {/* Compact 3-Metric Summary Strip */}
          <section className="card-elevated rounded-xl grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E8F0] dark:divide-slate-800">
            <div className="p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#64748B] dark:text-slate-400 block">
                  Active Team
                </span>
                <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-mono tabular-nums">
                  {counts.members}
                </div>
                <span className="text-xs text-[#64748B] dark:text-slate-400 font-mono tabular-nums block">
                  {counts.availableMembers} available &middot; {counts.pendingInvites} pending invites
                </span>
              </div>
              <Users className="w-5 h-5 text-[#4F46E5] dark:text-indigo-400 shrink-0" />
            </div>

            <div className="p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#64748B] dark:text-slate-400 block">
                  Open Tasks
                </span>
                <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-mono tabular-nums">
                  {counts.tasksOpen}
                </div>
                <span className="text-xs text-[#64748B] dark:text-slate-400 font-mono tabular-nums block">
                  {counts.tasksTodo} to do &middot; {counts.tasksInProgress} in progress
                </span>
              </div>
              <ListTodo className="w-5 h-5 text-[#4F46E5] dark:text-indigo-400 shrink-0" />
            </div>

            <div className="p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#64748B] dark:text-slate-400 block">
                  Completed This Week
                </span>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {counts.tasksCompletedThisWeek}
                </div>
                <span className="text-xs text-[#64748B] dark:text-slate-400 font-mono tabular-nums block">
                  {counts.tasksCompleted} total completed
                </span>
              </div>
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
          </section>

          {/* 2-Column Operational Grid: Left 65% (8 cols) | Right 35% (4 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT (65%): Active Departments & Quick Task Creation */}
            <section className="lg:col-span-8 card-elevated rounded-xl overflow-hidden">
              {/* Quick Task Creation Strip */}
              <form
                onSubmit={handleQuickCreateTask}
                className="p-5 bg-[#FFFFFF] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-slate-800 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white tracking-tight">
                    Quick Task Creation
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('departmental')}
                    className="text-xs font-medium text-[#4F46E5] dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Full task board &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <input
                    id="input-quick-task-title"
                    type="text"
                    required
                    value={quickTaskTitle}
                    onChange={(e) => setQuickTaskTitle(e.target.value)}
                    placeholder="What needs to get done?"
                    disabled={deptList.length === 0 || creatingTask}
                    className="sm:col-span-5 px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white placeholder-[#64748B] focus:outline-hidden focus:border-[#4F46E5]"
                  />

                  <select
                    value={quickTaskDeptId}
                    onChange={(e) => setQuickTaskDeptId(e.target.value)}
                    aria-label="Task Department"
                    disabled={deptList.length === 0}
                    className="sm:col-span-3 px-2.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-medium text-[#0F172A] dark:text-white cursor-pointer"
                  >
                    {deptList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={quickTaskAssigneeId}
                    onChange={(e) => setQuickTaskAssigneeId(e.target.value)}
                    aria-label="Task Assignee"
                    className="sm:col-span-2 px-2.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-medium text-[#0F172A] dark:text-white cursor-pointer"
                  >
                    {assigneeOptions.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>

                  <button
                    id="btn-quick-add-task"
                    type="submit"
                    disabled={creatingTask || deptList.length === 0 || !quickTaskTitle.trim()}
                    className="sm:col-span-2 btn-tactile-primary px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {creatingTask ? 'Adding...' : 'Add Task'}
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-[#64748B] dark:text-slate-400">
                  <span>Priority:</span>
                  {(['low', 'medium', 'high'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setQuickTaskPriority(lvl)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize cursor-pointer transition ${
                        quickTaskPriority === lvl
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-[#4F46E5] dark:text-indigo-300 font-semibold'
                          : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </form>

              {/* Active Departments List */}
              <div className="px-5 py-4 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white tracking-tight">
                    Active Departments
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    Click a department to inspect its tasks or adjust permissions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddDeptOpen(true)}
                  className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 text-[#4F46E5] dark:text-indigo-400" />
                  <span>Add Department</span>
                </button>
              </div>

              {deptList.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <Layers className="w-7 h-7 text-slate-400 mx-auto" />
                  <p className="text-xs font-medium text-[#0F172A] dark:text-white">
                    No departments created yet
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddDeptOpen(true)}
                    className="btn-tactile-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Department</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                  {deptList.map((dept) => {
                    const allowedMods = getDepartmentAllowedModules(dept);
                    const modLabels = DEPARTMENT_MODULE_DEFINITIONS
                      .filter((m) => allowedMods.includes(m.key))
                      .map((m) => m.label);
                    const openTasks =
                      dept.tasksOpen ?? Math.max(0, (dept.tasksTotal ?? 0) - (dept.tasksCompleted ?? 0));

                    return (
                      <div
                        key={dept.id}
                        className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-sm font-semibold text-[#0F172A] dark:text-white truncate">
                              {dept.name}
                            </h3>
                            <span className="text-xs text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
                              {dept.memberCount ?? 0} {(dept.memberCount ?? 0) === 1 ? 'member' : 'members'}
                            </span>
                          </div>
                          <p className="text-xs text-[#64748B] dark:text-slate-400 truncate">
                            {modLabels.join(' · ') || 'No modules enabled'}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right font-mono tabular-nums">
                            <span className="text-xs font-semibold text-[#0F172A] dark:text-white block">
                              {openTasks} open
                            </span>
                            <span className="text-[11px] text-[#64748B] dark:text-slate-400 block">
                              {dept.tasksCompleted ?? 0} done
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDepartmentId(dept.id);
                                setActiveTab('departments');
                              }}
                              className="p-1.5 rounded-lg border border-[#E2E8F0] dark:border-slate-700 text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
                              title="Department & Module Permissions"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDepartmentId(dept.id);
                                setActiveTab('departmental');
                              }}
                              className="btn-tactile-secondary px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            >
                              <span>Tasks</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* RIGHT (35%): Recent Activity & Quick Actions */}
            <aside className="lg:col-span-4 space-y-6">
              {/* Recent Activity */}
              <div className="card-elevated rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white tracking-tight">
                    Recent Activity
                  </h2>
                  <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400 tabular-nums">
                    {recentActivity.length} events
                  </span>
                </div>

                {recentActivity.length === 0 ? (
                  <div className="px-5 py-8 text-center space-y-1.5">
                    <Clock className="w-5 h-5 text-slate-400 mx-auto" />
                    <p className="text-xs font-medium text-[#0F172A] dark:text-white">
                      No recent activity yet
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                      Team invites, tasks, and department updates will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                    {recentActivity.slice(0, 6).map((item) => (
                      <div key={item.id} className="px-5 py-3 space-y-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium text-[#0F172A] dark:text-white leading-snug">
                            {item.title}
                          </span>
                          <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400 tabular-nums shrink-0">
                            {formatRelativeTime(item.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] dark:text-slate-400 line-clamp-1">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="card-elevated rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] dark:border-slate-800">
                  <h2 className="text-sm font-semibold text-[#0F172A] dark:text-white tracking-tight">
                    Quick Actions
                  </h2>
                </div>

                <div className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                  <button
                    type="button"
                    onClick={() => openInviteModal()}
                    className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserPlus className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-[#0F172A] dark:text-white block">
                          Invite Team Member
                        </span>
                        <span className="text-[11px] text-[#64748B] dark:text-slate-400 block truncate">
                          Send department head or staff invite link
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('departments')}
                    className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2 className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-[#0F172A] dark:text-white block">
                          Departments &amp; Permissions
                        </span>
                        <span className="text-[11px] text-[#64748B] dark:text-slate-400 block truncate">
                          Configure department module access
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('chat')}
                    className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MessageSquare className="w-4 h-4 text-[#4F46E5] dark:text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-[#0F172A] dark:text-white block">
                          Department Chat
                        </span>
                        <span className="text-[11px] text-[#64748B] dark:text-slate-400 block truncate">
                          Private messaging &amp; work status updates
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-[#F8FAFC] dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Settings className="w-4 h-4 text-[#64748B] dark:text-slate-400 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-[#0F172A] dark:text-white block">
                          Settings &amp; Integrations
                        </span>
                        <span className="text-[11px] text-[#64748B] dark:text-slate-400 block truncate">
                          {emailOutreachEnabled
                            ? 'Email Outreach active · manage optional modules'
                            : 'Optional add-ons (Email Outreach, Inbox, Financials)'}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Modal: Quick Add Department */}
      {isAddDeptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setIsAddDeptOpen(false)}
        >
          <div
            className="w-full max-w-lg card-elevated rounded-xl shadow-2xl p-6 space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight">
                Add Department
              </h3>
              <button
                type="button"
                onClick={() => setIsAddDeptOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Engineering, Sales, Product Design"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white focus:outline-hidden focus:border-[#4F46E5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newDeptDesc}
                  onChange={(e) => setNewDeptDesc(e.target.value)}
                  placeholder="Scope of work for this team"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white focus:outline-hidden focus:border-[#4F46E5]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                  Department Module Permissions
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {DEPARTMENT_MODULE_DEFINITIONS.map((mod) => {
                    const checked = newDeptModules.includes(mod.key);
                    return (
                      <label
                        key={mod.key}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-[#E2E8F0] dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setNewDeptModules((prev) =>
                              prev.includes(mod.key)
                                ? prev.filter((k) => k !== mod.key)
                                : [...prev, mod.key]
                            )
                          }
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-[#4F46E5]"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-[#0F172A] dark:text-white block">
                            {mod.label}
                          </span>
                          <span className="text-[11px] text-[#64748B] dark:text-slate-400 block">
                            {mod.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddDeptOpen(false)}
                  className="btn-tactile-secondary px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDept}
                  className="btn-tactile-primary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {creatingDept ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Invite Team Member */}
      {isInviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
          onClick={() => setIsInviteOpen(false)}
        >
          <div
            className="w-full max-w-md card-elevated rounded-xl shadow-2xl p-6 space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight">
                Invite Team Member
              </h3>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-3.5">
              {inviteError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{inviteError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1">
                  Work Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white focus:outline-hidden focus:border-[#4F46E5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1">
                    Department
                  </label>
                  <select
                    value={inviteDeptId}
                    onChange={(e) => setInviteDeptId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white"
                  >
                    {deptList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1">
                    Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'department_head' | 'employee')}
                    className="w-full px-2.5 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white"
                  >
                    <option value="employee">Team Member</option>
                    <option value="department_head">Department Head</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200 mb-1">
                  Job Title (Optional)
                </label>
                <input
                  type="text"
                  value={inviteDesignation}
                  onChange={(e) => setInviteDesignation(e.target.value)}
                  placeholder="e.g. Operations Lead, Account Executive"
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-[#0F172A] dark:text-white focus:outline-hidden focus:border-[#4F46E5]"
                />
              </div>

              {generatedInviteUrl && (
                <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 space-y-1.5">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">
                    Invite Link Ready
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedInviteUrl}
                      className="flex-1 px-2 py-1 text-[11px] font-mono rounded border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-[#090D16] text-[#0F172A] dark:text-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => copyInviteLink(generatedInviteUrl)}
                      className="btn-tactile-secondary px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="btn-tactile-secondary px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite}
                  className="btn-tactile-primary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {sendingInvite ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
