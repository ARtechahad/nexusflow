import React, { useState, useEffect } from 'react';
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  Users,
  Layers,
  Mail,
  Kanban,
  Send,
  Coins,
  Database,
  Plus,
  Briefcase,
  MessageSquare,
  User,
  Phone,
  FileText,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AvailabilityStatus } from '../types';
import { hasModuleAccess, isEmailOutreachVisible } from '../utils/departmentAccess';

export const UserProfileDashboard: React.FC = () => {
  const {
    currentUser,
    companyRole,
    tenants,
    currentTenant,
    departments,
    selectedDepartmentId,
    pendingInvites,
    switchTenant,
    acceptInvite,
    updateMyAvailability,
    updateMyProfile,
    updateCompanySettings,
    setActiveTab,
    setIsOnboardingModalOpen,
    unreadInboxCount,
    logout,
    showToast
  } = useApp();

  const isAdmin = companyRole === 'company_admin';
  const isDeptHead = companyRole === 'department_head';

  const activeDept =
    departments.find((d) => d.id === selectedDepartmentId) ||
    (departments.length === 1 ? departments[0] : null);
  const canOps = hasModuleAccess(companyRole, 'operations', activeDept, departments);
  const canChat = hasModuleAccess(companyRole, 'chat', activeDept, departments);
  const canEmailHub = hasModuleAccess(companyRole, 'email_hub', activeDept, departments);
  const canClientInbox = hasModuleAccess(companyRole, 'client_inbox', activeDept, departments);
  const canFinancials = hasModuleAccess(companyRole, 'financials', activeDept, departments);

  const [fullName, setFullName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [title, setTitle] = useState(currentUser?.title || currentTenant?.myDesignation || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileStatusMsg, setProfileStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.name || '');
      setPhone(currentUser.phone || '');
      setTitle(currentUser.title || currentTenant?.myDesignation || '');
      setBio(currentUser.bio || '');
    }
  }, [currentUser, currentTenant?.myDesignation]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatusMsg(null);
    if (fullName.trim().length < 2) {
      setProfileStatusMsg({ type: 'error', text: 'Full Name must be at least 2 characters.' });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setProfileStatusMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }

    setSavingProfile(true);
    const res = await updateMyProfile({
      fullName: fullName.trim(),
      phone: phone.trim(),
      title: title.trim(),
      bio: bio.trim(),
      currentPassword: newPassword ? currentPassword : undefined,
      newPassword: newPassword || undefined
    });
    setSavingProfile(false);

    if (res.success) {
      setCurrentPassword('');
      setNewPassword('');
      setProfileStatusMsg({ type: 'success', text: res.message || 'Personal profile saved.' });
    } else {
      setProfileStatusMsg({ type: 'error', text: res.message || 'Could not update profile.' });
    }
  };

  const [savingSettingsKey, setSavingSettingsKey] = useState<string | null>(null);

  const outreachVisible = isEmailOutreachVisible(
    companyRole,
    currentTenant?.settings,
    activeDept,
    departments
  );

  const handleToggleCompanySetting = async (
    key: 'enableEmailOutreach' | 'enableClientInbox' | 'enableFinancials' | 'enableDealsPipeline',
    label: string
  ) => {
    if (!currentTenant?.id) return;
    const currentValue = Boolean(currentTenant.settings?.[key]);
    const nextValue = !currentValue;
    setSavingSettingsKey(key);
    const res = await updateCompanySettings(currentTenant.id, { [key]: nextValue });
    setSavingSettingsKey(null);
    if (res.success) {
      showToast(`${label} ${nextValue ? 'enabled' : 'disabled'} for ${currentTenant.name}.`, 'success');
    } else {
      showToast(res.message || `Could not update ${label}.`, 'error');
    }
  };

  const handleEnterWorkspace = async (tenant: typeof currentTenant) => {
    if (tenant) {
      await switchTenant(tenant.id);
    }
  };

  const roleShortcuts = isAdmin
    ? [
        { id: 'overview', title: 'Company Overview', desc: 'Real metrics & onboarding steps', icon: Building2 },
        { id: 'departments', title: 'Departments & Team', desc: 'Structure, permissions & invites', icon: Users },
        { id: 'departmental', title: 'Operations & Tasks', desc: 'Assign & track team progress', icon: Layers },
        ...(outreachVisible
          ? [{ id: 'outreach_suite', title: 'Email Outreach', desc: 'SMTP / Resend & real campaigns', icon: Send }]
          : [])
      ]
    : [
        ...(canOps
          ? [{ id: 'departmental', title: isDeptHead ? 'Department Operations' : 'My Department', desc: isDeptHead ? 'Roster, employees & tasks' : 'My assigned tasks & team roster', icon: Users }]
          : []),
        ...(canChat
          ? [{ id: 'chat', title: 'Department Chat', desc: 'Private room & work updates', icon: MessageSquare }]
          : []),
        ...(canEmailHub
          ? [{ id: 'outreach_suite', title: 'Email Outreach', desc: 'Connected mailboxes & campaigns', icon: Send }]
          : []),
        ...(canClientInbox
          ? [{ id: 'inbox', title: 'Client Inbox', desc: `${unreadInboxCount} unread threads`, icon: Mail }]
          : []),
        ...(canFinancials
          ? [{ id: 'commissions', title: 'Financials & Ledgers', desc: 'Commissions & revenue metrics', icon: Coins }]
          : [])
      ];

  return (
    <div className="max-w-7xl mx-auto py-2 space-y-6 animate-fadeIn">
      {/* 1. Account Identity Banner */}
      <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-2xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shrink-0 overflow-hidden shadow-xs">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{currentUser?.name ? currentUser.name[0].toUpperCase() : 'U'}</span>
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {currentUser?.name || 'Workspace Member'}
                </h1>
                <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                  {companyRole === 'company_admin'
                    ? 'COMPANY OWNER'
                    : companyRole === 'department_head'
                    ? 'DEPARTMENT HEAD'
                    : companyRole === 'employee'
                    ? 'EMPLOYEE'
                    : 'VERIFIED ACCOUNT'}
                </span>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  &bull; Session Verified
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium">
                {currentUser?.email || 'No email configured'}
                {currentUser?.phone ? ` · ${currentUser.phone}` : ''}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {companyRole === 'company_admin'
                  ? 'Company Owner'
                  : currentTenant?.myDesignation || currentUser?.title || 'Personal Profile'}
                {activeDept ? ` · ${activeDept.name}` : ''}
                {isAdmin ? ` · ${tenants.length} Company ${tenants.length === 1 ? 'Membership' : 'Memberships'}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <select
              value={currentUser?.availabilityStatus || 'Available'}
              onChange={(e) => updateMyAvailability(e.target.value as AvailabilityStatus)}
              aria-label="My Availability Status"
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <option value="Available">Status: Available</option>
              <option value="In a Meeting">Status: In a Meeting</option>
              <option value="Busy">Status: Busy</option>
              <option value="Offline">Status: Offline</option>
            </select>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="btn-tactile-secondary px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                Company Overview
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="btn-tactile-secondary px-3.5 py-2 rounded-lg hover:text-red-600 dark:hover:text-red-400 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Workspace Configuration Status Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            )}
            <span>
              {isAdmin ? (
                <>
                  Tenant Boundary: <strong className="text-slate-950 dark:text-white">Strictly Isolated</strong>
                </>
              ) : (
                <>
                  Assigned Company:{' '}
                  <strong className="text-slate-950 dark:text-white">{currentTenant?.name || 'Assigned'}</strong>
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              {isAdmin ? (
                <>
                  Account Status: <strong className="text-slate-950 dark:text-white">Email OTP Verified</strong>
                </>
              ) : (
                <>
                  Department:{' '}
                  <strong className="text-slate-950 dark:text-white">
                    {activeDept?.name || departments.map((d) => d.name).join(', ') || 'Assigned'}
                  </strong>
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>
              Live Availability:{' '}
              <strong className="text-slate-950 dark:text-white">
                {currentUser?.availabilityStatus || 'Available'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Pending Invitations Banner */}
      {pendingInvites.length > 0 && (
        <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-indigo-200 dark:border-indigo-800 p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Pending Company Invitations ({pendingInvites.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-950 dark:text-white truncate">
                    {inv.companyName} &middot; {inv.departmentName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {inv.role === 'department_head' ? 'Department Head' : 'Employee'} ({inv.designation})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => acceptInvite(inv.token)}
                  className="btn-tactile-primary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Accept &amp; Join
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NON-OWNER VIEW: Clean "My Profile & Basic Details" Editor + Read-Only Assigned Department Card */}
      {!isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-8 rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>My Profile &amp; Basic Details</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Keep your contact details, job title, and department bio up to date for your teammates.
                </p>
              </div>
            </div>

            {profileStatusMsg && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                  profileStatusMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileStatusMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 234-5678"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Job Title
                </label>
                <div className="relative">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Sales Lead, Frontend Engineer"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Short Bio
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Share your focus area or working hours with your department..."
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password (if changing password)
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password (Optional)
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-xs text-slate-950 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-tactile-primary px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>

          {/* Read-Only Assigned Company & Department Card */}
          <div className="lg:col-span-4 rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Assigned Workspace</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Your current company &amp; department assignment
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Company</span>
                  <span className="font-bold text-slate-950 dark:text-white">
                    {currentTenant?.name || 'Not assigned'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Department(s)
                  </span>
                  <span className="font-bold text-slate-950 dark:text-white">
                    {departments.length > 0 ? departments.map((d) => d.name).join(', ') : 'None assigned'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Role &amp; Designation
                  </span>
                  <span className="font-bold text-slate-950 dark:text-white">
                    {isDeptHead ? 'Department Head' : 'Department Employee'}
                    {currentTenant?.myDesignation ? ` · ${currentTenant.myDesignation}` : ''}
                  </span>
                </div>
              </div>

              {tenants.length > 1 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                    Switch Assigned Company
                  </span>
                  <div className="space-y-1.5">
                    {tenants.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleEnterWorkspace(t)}
                        className={`w-full px-3 py-2 rounded-lg text-left text-xs font-semibold border transition cursor-pointer flex items-center justify-between ${
                          currentTenant?.id === t.id
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate">{t.name}</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  (canOps
                    ? 'departmental'
                    : canChat
                    ? 'chat'
                    : canEmailHub
                    ? 'outreach_suite'
                    : canClientInbox
                    ? 'inbox'
                    : canFinancials
                    ? 'commissions'
                    : 'profile') as any
                )
              }
              className="btn-tactile-secondary w-full py-2 px-3 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Open Department Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ADMIN-ONLY VIEW: Company Settings & Optional Modules + Register New Company + Companies Grid */}
      {isAdmin && (
        <>
          {currentTenant && (
            <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Company Settings &amp; Optional Modules</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Keep your sidebar clean by enabling optional tools only when {currentTenant.name} needs them.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    key: 'enableEmailOutreach' as const,
                    title: 'Enable Email Outreach',
                    desc: 'Show Email Outreach in the sidebar to connect real SMTP / Resend accounts and send campaigns.',
                    icon: Send
                  },
                  {
                    key: 'enableClientInbox' as const,
                    title: 'Unified Client Inbox',
                    desc: 'Show shared client reply inbox in the sidebar.',
                    icon: Mail
                  },
                  {
                    key: 'enableFinancials' as const,
                    title: 'Financials & Commission Ledgers',
                    desc: 'Show commission splits, payout schedules, and revenue analytics.',
                    icon: Coins
                  },
                  {
                    key: 'enableDealsPipeline' as const,
                    title: 'Deals & SOP Pipeline',
                    desc: 'Show executive deal pipeline, SOP stage gates, client portal, and webhooks.',
                    icon: Kanban
                  }
                ].map((opt) => {
                  const Icon = opt.icon;
                  const enabled = Boolean(currentTenant.settings?.[opt.key]);
                  const isBusy = savingSettingsKey === opt.key;
                  return (
                    <label
                      key={opt.key}
                      className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                        enabled
                          ? 'border-indigo-500/60 bg-indigo-50/40 dark:bg-indigo-950/20'
                          : 'border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#090D16]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-950 dark:text-white">
                            {opt.title}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            {opt.desc}
                          </p>
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={isBusy}
                        onChange={() => handleToggleCompanySetting(opt.key, opt.title)}
                        aria-label={opt.title}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <h2 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                  Register Another Company Under Your Account
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Every company gets its own isolated departments, team hierarchy, connected mailboxes, client pipeline, and financial ledger.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOnboardingModalOpen(true)}
                className="btn-tactile-secondary inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Company</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Your Companies &amp; Workspaces</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Switch between companies you own or manage
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOnboardingModalOpen(true)}
                className="btn-tactile-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Company</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tenants.map((t) => {
                const isCurrent = currentTenant?.id === t.id;
                const roleLabel =
                  t.myRole === 'company_admin'
                    ? 'Owner'
                    : t.myRole === 'department_head'
                    ? 'Dept Head'
                    : 'Employee';
                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border p-5 transition flex flex-col justify-between bg-[#FFFFFF] dark:bg-[#111827] ${
                      isCurrent
                        ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] dark:bg-[#090D16] border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-xs text-slate-800 dark:text-white shrink-0">
                            {t.name ? t.name.slice(0, 2).toUpperCase() : 'CO'}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-slate-950 dark:text-white truncate">
                              {t.name}
                            </h4>
                            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate block">
                              {roleLabel}
                              {t.myDesignation ? ` · ${t.myDesignation}` : ''}
                            </span>
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {t.businessInfo?.description || 'Multi-tenant company operations & department workspace.'}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                          {t.industry || t.businessInfo?.industry || 'B2B Operations'}
                        </span>
                        <span className="flex items-center gap-1 font-mono tabular-nums">
                          <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          {t.activeMembersCount || 1} {t.activeMembersCount === 1 ? 'Member' : 'Members'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-400 truncate">
                        {t.departmentsCount ?? 0} Depts
                      </span>

                      <button
                        type="button"
                        onClick={() => handleEnterWorkspace(t)}
                        className="btn-tactile-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* 4. Role & Department-Filtered Module Shortcuts */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Authorized Modules</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {roleShortcuts.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveTab(mod.id as any)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#FFFFFF] dark:bg-[#111827] hover:border-indigo-300 dark:hover:border-slate-700 text-left transition cursor-pointer space-y-2"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-950 dark:text-white">{mod.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono tabular-nums">{mod.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
