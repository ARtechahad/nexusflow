import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  UserPlus,
  Users,
  CheckCircle2,
  Clock,
  RefreshCw,
  Edit3,
  Check,
  X,
  Copy,
  Link2,
  Mail,
  ListTodo,
  AlertCircle,
  MessageSquare,
  SlidersHorizontal
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { buildAuthHeaders } from '../lib/api';
import {
  DEPARTMENT_MODULE_DEFINITIONS,
  DEFAULT_DEPARTMENT_MODULES,
  getDepartmentAllowedModules,
  hasModuleAccess
} from '../utils/departmentAccess';
import {
  Department,
  DepartmentMember,
  DepartmentModuleKey,
  DepartmentTask,
  CompanyInvite,
  AvailabilityStatus
} from '../types';

const AVAILABILITY_DOT: Record<AvailabilityStatus, string> = {
  Available: 'bg-emerald-500',
  'In a Meeting': 'bg-amber-500',
  Busy: 'bg-rose-500',
  Offline: 'bg-slate-400'
};

const TASK_STATUS_LABEL: Record<DepartmentTask['status'], string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  completed: 'Completed'
};

const PRIORITY_TEXT_CLASS: Record<DepartmentTask['priority'], string> = {
  low: 'text-slate-500 dark:text-slate-400',
  medium: 'text-indigo-600 dark:text-indigo-400',
  high: 'text-amber-600 dark:text-amber-400',
  urgent: 'text-rose-600 dark:text-rose-400'
};

interface DepartmentalTrackingViewProps {
  mode?: 'departments_team' | 'operations_tasks';
}

export const DepartmentalTrackingView: React.FC<DepartmentalTrackingViewProps> = ({
  mode = 'operations_tasks'
}) => {
  const {
    currentUser,
    currentTenant,
    companyRole,
    departments,
    selectedDepartmentId,
    setSelectedDepartmentId,
    refreshDepartments,
    createDepartment,
    updateDepartmentPermissions,
    deleteDepartment,
    updateMyAvailability,
    setActiveTab,
    showToast
  } = useApp();

  const isAdmin = companyRole === 'company_admin';
  const isDeptHead = companyRole === 'department_head';
  const canManageTeam = isAdmin || isDeptHead;

  const activeDept: Department | null =
    departments.find((d) => d.id === selectedDepartmentId) || departments[0] || null;

  const chatEnabled = hasModuleAccess(companyRole, 'chat', activeDept, departments);

  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [tasks, setTasks] = useState<DepartmentTask[]>([]);
  const [taskSummary, setTaskSummary] = useState({
    total: 0,
    todo: 0,
    inProgress: 0,
    review: 0,
    completed: 0,
    completionPercent: 0
  });
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [taskFilter, setTaskFilter] = useState<'all' | DepartmentTask['status']>('all');

  // Create Department inline modal state (Company Owner only)
  const [isCreateDeptOpen, setIsCreateDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptDesc, setNewDeptDesc] = useState('');
  const [newDeptModules, setNewDeptModules] = useState<DepartmentModuleKey[]>(DEFAULT_DEPARTMENT_MODULES);
  const [creatingDept, setCreatingDept] = useState(false);

  // Edit Department Permissions modal state (Company Owner only)
  const [editingPermsDept, setEditingPermsDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptDesc, setEditDeptDesc] = useState('');
  const [editDeptModules, setEditDeptModules] = useState<DepartmentModuleKey[]>(DEFAULT_DEPARTMENT_MODULES);
  const [savingDeptPerms, setSavingDeptPerms] = useState(false);

  // Confirm Department delete
  const [confirmDeleteDeptId, setConfirmDeleteDeptId] = useState<string | null>(null);
  const [deletingDept, setDeletingDept] = useState(false);

  // Invite Member modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'department_head' | 'employee'>('employee');
  const [inviteDeptId, setInviteDeptId] = useState<string>('');
  const [inviteDesignation, setInviteDesignation] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [lastCreatedInviteUrl, setLastCreatedInviteUrl] = useState<string | null>(null);

  // Inline designation editor state
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingDesignation, setEditingDesignation] = useState('');

  // New Task form state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<DepartmentTask['priority']>('medium');
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  const loadDepartmentWorkspace = useCallback(async () => {
    if (!currentTenant?.id || !activeDept?.id) {
      setMembers([]);
      setTasks([]);
      setInvites([]);
      return;
    }
    setLoading(true);
    try {
      const headers = buildAuthHeaders();
      const requests: Promise<Response>[] = [
        fetch(
          `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(
            activeDept.id
          )}/members`,
          { headers }
        ),
        fetch(
          `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(
            activeDept.id
          )}/tasks`,
          { headers }
        )
      ];

      if (canManageTeam) {
        requests.push(
          fetch(`/api/companies/${encodeURIComponent(currentTenant.id)}/invites`, { headers })
        );
      }

      const [membersRes, tasksRes, invitesRes] = await Promise.all(requests);

      if (membersRes.ok) {
        const mData = await membersRes.json();
        setMembers(Array.isArray(mData.members) ? mData.members : []);
      } else {
        setMembers([]);
      }

      if (tasksRes.ok) {
        const tData = await tasksRes.json();
        setTasks(Array.isArray(tData.tasks) ? tData.tasks : []);
        if (tData.summary) {
          setTaskSummary(tData.summary);
        }
      } else {
        setTasks([]);
      }

      if (invitesRes && invitesRes.ok) {
        const iData = await invitesRes.json();
        const allInvites: CompanyInvite[] = Array.isArray(iData.invites) ? iData.invites : [];
        setInvites(
          allInvites.filter(
            (inv) =>
              inv.departmentId === activeDept.id &&
              (inv.effectiveStatus || inv.status) === 'pending'
          )
        );
      } else {
        setInvites([]);
      }
    } catch (err) {
      console.warn('Error loading department workspace:', err);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, activeDept?.id, canManageTeam]);

  useEffect(() => {
    loadDepartmentWorkspace();
  }, [loadDepartmentWorkspace]);

  // Real-time SSE updates for availability, tasks, and department membership
  useEffect(() => {
    const onAvailability = (ev: any) => {
      const detail = ev.detail;
      if (!detail || detail.companyId !== currentTenant?.id) return;
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === detail.userId
            ? {
                ...m,
                availabilityStatus: detail.availabilityStatus,
                availabilityUpdatedAt: detail.availabilityUpdatedAt
              }
            : m
        )
      );
    };

    const onTaskUpdated = (ev: any) => {
      const detail = ev.detail;
      if (!detail || detail.companyId !== currentTenant?.id || detail.departmentId !== activeDept?.id) {
        return;
      }
      loadDepartmentWorkspace();
    };

    const onDepartmentUpdated = (ev: any) => {
      const detail = ev.detail;
      if (!detail || detail.companyId !== currentTenant?.id) return;
      if (!detail.departmentId || detail.departmentId === activeDept?.id) {
        loadDepartmentWorkspace();
      }
    };

    window.addEventListener('clientops:sse:availability', onAvailability);
    window.addEventListener('clientops:sse:task', onTaskUpdated);
    window.addEventListener('clientops:sse:department', onDepartmentUpdated);
    return () => {
      window.removeEventListener('clientops:sse:availability', onAvailability);
      window.removeEventListener('clientops:sse:task', onTaskUpdated);
      window.removeEventListener('clientops:sse:department', onDepartmentUpdated);
    };
  }, [currentTenant?.id, activeDept?.id, loadDepartmentWorkspace]);

  const toggleModuleSelection = (
    list: DepartmentModuleKey[],
    key: DepartmentModuleKey
  ): DepartmentModuleKey[] => {
    return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    setCreatingDept(true);
    const res = await createDepartment(newDeptName.trim(), newDeptDesc.trim(), newDeptModules);
    setCreatingDept(false);
    if (res.success) {
      setNewDeptName('');
      setNewDeptDesc('');
      setNewDeptModules(DEFAULT_DEPARTMENT_MODULES);
      setIsCreateDeptOpen(false);
      await refreshDepartments();
    } else {
      showToast(res.message || 'Could not create department.', 'error');
    }
  };

  const openEditPermissionsModal = (dept: Department) => {
    setEditingPermsDept(dept);
    setEditDeptName(dept.name || '');
    setEditDeptDesc(dept.description || '');
    setEditDeptModules(getDepartmentAllowedModules(dept));
  };

  const handleSaveDepartmentPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermsDept || !editDeptName.trim()) return;
    setSavingDeptPerms(true);
    const res = await updateDepartmentPermissions(editingPermsDept.id, {
      name: editDeptName.trim(),
      description: editDeptDesc.trim(),
      allowed_modules: editDeptModules
    });
    setSavingDeptPerms(false);
    if (res.success) {
      setEditingPermsDept(null);
      await refreshDepartments();
    } else {
      showToast(res.message || 'Could not save department permissions.', 'error');
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    setDeletingDept(true);
    const res = await deleteDepartment(deptId);
    setDeletingDept(false);
    setConfirmDeleteDeptId(null);
    if (!res.success) {
      showToast(res.message || 'Could not delete department.', 'error');
    }
  };

  const openInviteModal = () => {
    setInviteDeptId(activeDept?.id || departments[0]?.id || '');
    setInviteRole(isAdmin ? 'employee' : 'employee');
    setInviteEmail('');
    setInviteDesignation('');
    setLastCreatedInviteUrl(null);
    setIsInviteModalOpen(true);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant?.id || !inviteEmail.trim() || !inviteDeptId) return;
    setSendingInvite(true);
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(currentTenant.id)}/invites`, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email: inviteEmail.trim(),
          departmentId: inviteDeptId,
          role: isAdmin ? inviteRole : 'employee',
          designation: inviteDesignation.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Invitation sent!', 'success');
        setLastCreatedInviteUrl(data.invite?.inviteUrl || null);
        setInviteEmail('');
        setInviteDesignation('');
        loadDepartmentWorkspace();
      } else {
        showToast(data.error || data.message || 'Could not send invitation.', 'error');
      }
    } catch {
      showToast('Network error sending invitation.', 'error');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!currentTenant?.id) return;
    try {
      const res = await fetch(
        `/api/companies/${encodeURIComponent(currentTenant.id)}/invites/${encodeURIComponent(inviteId)}`,
        { method: 'DELETE', headers: buildAuthHeaders() }
      );
      if (res.ok) {
        showToast('Invitation revoked.', 'info');
        loadDepartmentWorkspace();
      }
    } catch {
      showToast('Failed to revoke invitation.', 'error');
    }
  };

  const handleSaveDesignation = async (userId: string) => {
    if (!currentTenant?.id || !activeDept?.id || !editingDesignation.trim()) return;
    try {
      const res = await fetch(
        `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(
          activeDept.id
        )}/members/${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ designation: editingDesignation.trim() })
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === userId ? { ...m, designation: data.member.designation } : m
          )
        );
        setEditingMemberId(null);
        showToast('Designation updated.', 'success');
      } else {
        showToast(data.error || data.message || 'Could not update designation.', 'error');
      }
    } catch {
      showToast('Network error updating designation.', 'error');
    }
  };

  const handleRemoveMember = async (member: DepartmentMember) => {
    if (!currentTenant?.id || !activeDept?.id) return;
    try {
      const res = await fetch(
        `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(
          activeDept.id
        )}/members/${encodeURIComponent(member.userId)}`,
        { method: 'DELETE', headers: buildAuthHeaders() }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`${member.name} removed from ${activeDept.name}.`, 'info');
        loadDepartmentWorkspace();
        refreshDepartments();
      } else {
        showToast(data.error || data.message || 'Could not remove member.', 'error');
      }
    } catch {
      showToast('Network error removing member.', 'error');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant?.id || !activeDept?.id || !taskTitle.trim()) return;
    setCreatingTask(true);
    try {
      const res = await fetch(
        `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(
          activeDept.id
        )}/tasks`,
        {
          method: 'POST',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            title: taskTitle.trim(),
            description: taskDesc.trim(),
            priority: taskPriority,
            assigneeUserId: taskAssigneeId || currentUser?.id,
            dueDate: taskDueDate || undefined
          })
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setTaskTitle('');
        setTaskDesc('');
        setTaskDueDate('');
        setIsTaskModalOpen(false);
        showToast('Department task created.', 'success');
        loadDepartmentWorkspace();
        refreshDepartments();
      } else {
        showToast(data.error || data.message || 'Failed to create task.', 'error');
      }
    } catch {
      showToast('Network error creating task.', 'error');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: DepartmentTask['status']) => {
    if (!currentTenant?.id || !activeDept?.id) return;
    try {
      const res = await fetch(
        `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(
          activeDept.id
        )}/tasks/${encodeURIComponent(taskId)}`,
        {
          method: 'PATCH',
          headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status })
        }
      );
      if (res.ok) {
        loadDepartmentWorkspace();
        refreshDepartments();
      }
    } catch {
      showToast('Failed to update task status.', 'error');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!currentTenant?.id || !activeDept?.id) return;
    try {
      const res = await fetch(
        `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(
          activeDept.id
        )}/tasks/${encodeURIComponent(taskId)}`,
        { method: 'DELETE', headers: buildAuthHeaders() }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Task removed.', 'info');
        loadDepartmentWorkspace();
        refreshDepartments();
      } else {
        showToast(data.error || data.message || 'Cannot delete task.', 'error');
      }
    } catch {
      showToast('Network error deleting task.', 'error');
    }
  };

  const handleCopyInviteUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Invite link copied to clipboard.', 'success');
    } catch {
      showToast('Could not copy automatically. Select and copy manually.', 'info');
    }
  };

  const scopedTasks = canManageTeam
    ? tasks
    : tasks.filter((t) => t.assigneeUserId === currentUser?.id);

  const filteredTasks =
    taskFilter === 'all' ? scopedTasks : scopedTasks.filter((t) => t.status === taskFilter);

  const onlineMembersCount = members.filter((m) => m.availabilityStatus !== 'Offline').length;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. Department Header & Control Bar */}
      <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-semibold text-slate-900 dark:text-white">
                {currentTenant?.name || 'Company'}
              </span>
              <span>&middot;</span>
              <span>
                {companyRole === 'company_admin'
                  ? 'Company Owner View'
                  : companyRole === 'department_head'
                  ? 'Department Head View'
                  : 'Department Member View'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-white tracking-tight">
              {mode === 'departments_team'
                ? 'Departments & Team'
                : activeDept
                ? `${activeDept.name} Operations`
                : 'Department Operations'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mode === 'departments_team'
                ? 'Create departments, configure per-department module permissions (including Email Outreach), and invite heads or team members.'
                : activeDept?.description ||
                  'Manage department members, live availability status, task completion metrics, and team workflow.'}
            </p>
            {activeDept && mode !== 'departments_team' && (
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-0.5">
                Enabled Modules:{' '}
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  {DEPARTMENT_MODULE_DEFINITIONS
                    .filter((m) => getDepartmentAllowedModules(activeDept).includes(m.key))
                    .map((m) => m.label)
                    .join(' · ') || 'None'}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {isAdmin && mode === 'departments_team' && (
              <button
                type="button"
                onClick={() => {
                  setNewDeptName('');
                  setNewDeptDesc('');
                  setNewDeptModules(DEFAULT_DEPARTMENT_MODULES);
                  setIsCreateDeptOpen(true);
                }}
                className="btn-tactile-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Department</span>
              </button>
            )}

            {chatEnabled && mode !== 'departments_team' && (
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Department Chat</span>
              </button>
            )}

            {canManageTeam && activeDept && (
              <button
                type="button"
                onClick={openInviteModal}
                className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{isAdmin ? 'Invite Member' : 'Invite Employee'}</span>
              </button>
            )}

            {canManageTeam && activeDept && mode !== 'departments_team' && (
              <button
                type="button"
                onClick={() => {
                  setTaskAssigneeId(members[0]?.userId || currentUser?.id || '');
                  setIsTaskModalOpen(true);
                }}
                className="btn-tactile-primary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Department Switcher Tabs + Admin Create/Edit/Delete Department Controls */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {departments.map((dept) => {
              const isSelected = activeDept?.id === dept.id;
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setSelectedDepartmentId(dept.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-[#F8FAFC] dark:bg-[#090D16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {dept.name}
                  <span className="ml-1.5 font-mono text-[11px] opacity-80 tabular-nums">
                    {dept.memberCount ?? 0}
                  </span>
                </button>
              );
            })}

            {isAdmin && (
              <button
                type="button"
                id="btn-new-department"
                onClick={() => {
                  setNewDeptName('');
                  setNewDeptDesc('');
                  setNewDeptModules(DEFAULT_DEPARTMENT_MODULES);
                  setIsCreateDeptOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition cursor-pointer whitespace-nowrap inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Department</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && activeDept && (
              <button
                type="button"
                id="btn-edit-department-permissions"
                onClick={() => openEditPermissionsModal(activeDept)}
                className="btn-tactile-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Edit Permissions</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadDepartmentWorkspace}
              disabled={loading}
              className="btn-tactile-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {isAdmin && activeDept && departments.length > 1 && (
              <button
                type="button"
                onClick={() => setConfirmDeleteDeptId(activeDept.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-slate-200 dark:border-slate-800 transition cursor-pointer whitespace-nowrap"
                title="Delete this department"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Dept</span>
              </button>
            )}
          </div>
        </div>

        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Team Members
            </span>
            <span className="text-xl font-bold text-slate-950 dark:text-white font-mono tabular-nums mt-0.5 block">
              {members.length}{' '}
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                ({onlineMembersCount} active)
              </span>
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              {canManageTeam ? 'Department Tasks' : 'My Assigned Tasks'}
            </span>
            <span className="text-xl font-bold text-slate-950 dark:text-white font-mono tabular-nums mt-0.5 block">
              {taskSummary.total}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              In Progress / Review
            </span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums mt-0.5 block">
              {taskSummary.inProgress + taskSummary.review}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Completion Rate
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5 block">
              {taskSummary.completionPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Company Departments Directory Grid (Departments & Team mode) */}
      {isAdmin && mode === 'departments_team' && departments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const isSelected = activeDept?.id === dept.id;
            const enabledModules = getDepartmentAllowedModules(dept);
            const moduleNames = DEPARTMENT_MODULE_DEFINITIONS
              .filter((m) => enabledModules.includes(m.key))
              .map((m) => m.label);

            return (
              <div
                key={dept.id}
                onClick={() => setSelectedDepartmentId(dept.id)}
                className={`rounded-xl border p-5 bg-[#FFFFFF] dark:bg-[#111827] transition cursor-pointer flex flex-col justify-between gap-4 ${
                  isSelected
                    ? 'border-indigo-500 ring-1 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-950 dark:text-white truncate">
                        {dept.name}
                      </h3>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {dept.memberCount ?? 0} Members &middot; {dept.tasksCompleted ?? 0}/{dept.tasksTotal ?? 0} Tasks
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                        SELECTED
                      </span>
                    )}
                  </div>

                  {dept.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {dept.description}
                    </p>
                  )}

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Modules: </span>
                    {moduleNames.length > 0 ? moduleNames.join(' · ') : 'None enabled'}
                  </p>
                </div>

                <div
                  className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditPermissionsModal(dept)}
                      className="btn-tactile-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Permissions</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDepartmentId(dept.id);
                        setActiveTab('departmental');
                      }}
                      className="btn-tactile-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer"
                    >
                      Tasks
                    </button>
                  </div>

                  {departments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteDeptId(dept.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                      title={`Delete ${dept.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state if admin deleted all or none exist */}
      {!activeDept ? (
        <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-950 dark:text-white">
            No departments available
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {isAdmin
              ? 'Create your first department to organize team members, tasks, and private department chat.'
              : 'You have not been assigned to a department in this company yet.'}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCreateDeptOpen(true)}
              className="btn-tactile-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Department</span>
            </button>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${mode === 'departments_team' ? 'lg:grid-cols-1' : 'lg:grid-cols-12'} gap-6`}>
          {/* LEFT: Live Member Roster & Availability */}
          <div className={`${mode === 'departments_team' ? 'space-y-4' : 'lg:col-span-5 space-y-4'}`}>
            <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Department Roster &amp; Live Status</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Individual task completion and real-time availability
                  </p>
                </div>
                {currentUser && (
                  <select
                    value={currentUser.availabilityStatus || 'Available'}
                    onChange={(e) => updateMyAvailability(e.target.value as AvailabilityStatus)}
                    aria-label="Update my status"
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="Available">Available</option>
                    <option value="In a Meeting">In a Meeting</option>
                    <option value="Busy">Busy</option>
                    <option value="Offline">Offline</option>
                  </select>
                )}
              </div>

              {members.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No members assigned to {activeDept.name} yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((member) => {
                    const isSelf = member.userId === currentUser?.id;
                    const canEditMember =
                      canManageTeam &&
                      (isAdmin || (isDeptHead && member.role !== 'company_admin'));
                    const canRemoveMember =
                      canManageTeam &&
                      member.role !== 'company_admin' &&
                      !isSelf &&
                      (isAdmin || member.role === 'employee');

                    return (
                      <div key={member.userId} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-800 dark:text-slate-200 shrink-0">
                              {member.name.slice(0, 2).toUpperCase()}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#111827] ${
                                  AVAILABILITY_DOT[member.availabilityStatus] || 'bg-slate-400'
                                }`}
                                title={member.availabilityStatus}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-950 dark:text-white truncate">
                                  {member.name}
                                  {isSelf ? ' (You)' : ''}
                                </span>
                                <span className="text-[10px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                  {member.role === 'company_admin'
                                    ? 'Owner'
                                    : member.role === 'department_head'
                                    ? 'Head'
                                    : 'Member'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {member.email}
                              </div>
                            </div>
                          </div>

                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 shrink-0 flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                AVAILABILITY_DOT[member.availabilityStatus] || 'bg-slate-400'
                              }`}
                            />
                            {member.availabilityStatus}
                          </span>
                        </div>

                        {/* Designation Row */}
                        <div className="flex items-center justify-between gap-2 pl-12">
                          {editingMemberId === member.userId ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingDesignation}
                                onChange={(e) => setEditingDesignation(e.target.value)}
                                className="flex-1 px-2 py-1 text-xs rounded border border-indigo-500 bg-white dark:bg-[#090D16] text-slate-900 dark:text-white"
                                placeholder="e.g. Senior Backend Engineer"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveDesignation(member.userId)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded cursor-pointer"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingMemberId(null)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                              <span>Role: {member.designation}</span>
                              {canEditMember && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMemberId(member.userId);
                                    setEditingDesignation(member.designation);
                                  }}
                                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                                  title="Edit designation"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}

                          {canRemoveMember && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              className="text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer shrink-0"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {/* Individual Task Completion Progress Bar */}
                        <div className="pl-12 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            <span>
                              {member.tasksCompleted}/{member.tasksAssigned} Tasks Completed
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {member.completionPercent}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
                              style={{ width: `${member.completionPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Department Invites Card (Admin & Dept Head only) */}
            {canManageTeam && invites.length > 0 && (
              <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Pending Invitations ({invites.length})</span>
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invites.map((inv) => (
                    <div key={inv.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {inv.email}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {inv.role === 'department_head' ? 'Dept Head' : 'Employee'} &middot; {inv.designation}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {inv.inviteUrl && (
                          <button
                            type="button"
                            onClick={() => handleCopyInviteUrl(inv.inviteUrl!)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            title="Copy invite link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline px-1.5 cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Department Work & Progress Board (7 cols - Operations & Tasks view) */}
          {mode !== 'departments_team' && (
          <div className="lg:col-span-7">
            <div className="bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
                    <ListTodo className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{canManageTeam ? 'Department Work & Task Progress' : 'My Assigned Tasks'}</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {canManageTeam
                      ? `Scoped strictly to ${activeDept.name}`
                      : `Tasks assigned to you in ${activeDept.name}`}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {(['all', 'todo', 'in_progress', 'review', 'completed'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTaskFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer transition ${
                        taskFilter === st
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#F8FAFC] dark:bg-[#090D16] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {st === 'all' ? `All (${scopedTasks.length})` : TASK_STATUS_LABEL[st]}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="py-12 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <CheckCircle2 className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No tasks in this view
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {canManageTeam
                      ? `Click “Assign Task” to create work items for ${activeDept.name}.`
                      : `No tasks have been assigned to you in ${activeDept.name} yet.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTasks.map((task) => {
                    const canDelete = canManageTeam;

                    return (
                      <div
                        key={task.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-950 dark:text-white">
                              {task.title}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold uppercase ${
                                PRIORITY_TEXT_CLASS[task.priority]
                              }`}
                            >
                              {task.priority}
                            </span>
                          </div>
                          {task.description && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            <span>Assignee: {task.assigneeName || 'Unassigned'}</span>
                            {task.dueDate && <span>Due: {task.dueDate}</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={task.status}
                            onChange={(e) =>
                              handleUpdateTaskStatus(
                                task.id,
                                e.target.value as DepartmentTask['status']
                              )
                            }
                            aria-label="Task status"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                          >
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">In Review</option>
                            <option value="completed">Completed</option>
                          </select>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-[#111827] cursor-pointer"
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {/* Modal: Create Department (Company Owner) */}
      {isAdmin && isCreateDeptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Create New Department
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateDeptOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="e.g. Engineering, Sales, Design"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newDeptDesc}
                  onChange={(e) => setNewDeptDesc(e.target.value)}
                  placeholder="Scope of work for this department"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Module Access Permissions
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {newDeptModules.length}/{DEPARTMENT_MODULE_DEFINITIONS.length} enabled
                  </span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {DEPARTMENT_MODULE_DEFINITIONS.map((mod) => {
                    const checked = newDeptModules.includes(mod.key);
                    return (
                      <label
                        key={mod.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                          checked
                            ? 'border-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setNewDeptModules((prev) => toggleModuleSelection(prev, mod.key))}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                            {mod.label}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
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
                  onClick={() => setIsCreateDeptOpen(false)}
                  className="btn-tactile-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDept || !newDeptName.trim()}
                  className="btn-tactile-primary px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {creatingDept ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Department Module Permissions (Company Owner) */}
      {isAdmin && editingPermsDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Edit Department Permissions
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Control which modules Department Heads and Employees in this department can access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPermsDept(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartmentPermissions} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={editDeptName}
                  onChange={(e) => setEditDeptName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editDeptDesc}
                  onChange={(e) => setEditDeptDesc(e.target.value)}
                  placeholder="Scope of work for this department"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Enabled Modules for {editDeptName || editingPermsDept.name}
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {editDeptModules.length}/{DEPARTMENT_MODULE_DEFINITIONS.length} enabled
                  </span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {DEPARTMENT_MODULE_DEFINITIONS.map((mod) => {
                    const checked = editDeptModules.includes(mod.key);
                    return (
                      <label
                        key={mod.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                          checked
                            ? 'border-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-950/20'
                            : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setEditDeptModules((prev) => toggleModuleSelection(prev, mod.key))}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-900 dark:text-white">
                            {mod.label}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400">
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
                  onClick={() => setEditingPermsDept(null)}
                  className="btn-tactile-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDeptPerms || !editDeptName.trim()}
                  className="btn-tactile-primary px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {savingDeptPerms ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Department */}
      {isAdmin && confirmDeleteDeptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Delete Department?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  This permanently removes the department, its tasks, pending invites, and private chat history.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDeptId(null)}
                className="btn-tactile-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingDept}
                onClick={() => handleDeleteDepartment(confirmDeleteDeptId)}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                {deletingDept ? 'Deleting...' : 'Delete Department'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Invite Team Member */}
      {canManageTeam && isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                {isAdmin ? 'Invite Department Head or Employee' : 'Invite Employee to Department'}
              </h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={inviteDeptId}
                    onChange={(e) => setInviteDeptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Access Role
                  </label>
                  {isAdmin ? (
                    <select
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as 'department_head' | 'employee')
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                    >
                      <option value="employee">Employee</option>
                      <option value="department_head">Department Head</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      value="Employee"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Job Title / Designation
                </label>
                <input
                  type="text"
                  value={inviteDesignation}
                  onChange={(e) => setInviteDesignation(e.target.value)}
                  placeholder="e.g. Product Designer, Backend Engineer"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                />
              </div>

              {lastCreatedInviteUrl && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5" /> 7-Day Invite Link Ready
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyInviteUrl(lastCreatedInviteUrl)}
                      className="underline cursor-pointer"
                    >
                      Copy Link
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 break-all">
                    {lastCreatedInviteUrl}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="btn-tactile-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={sendingInvite || !inviteEmail.trim()}
                  className="btn-tactile-primary px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {sendingInvite ? 'Sending Invite...' : 'Send 7-Day Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Department Task */}
      {canManageTeam && isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-950 dark:text-white">
                Assign Task · {activeDept?.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Finalize API integration & QA verification"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Deliverable Details
                </label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Clear acceptance criteria or SOP steps"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assignee
                  </label>
                  <select
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                  >
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name} ({m.designation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as DepartmentTask['priority'])}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="btn-tactile-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTask || !taskTitle.trim()}
                  className="btn-tactile-primary px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {creatingTask ? 'Assigning...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
