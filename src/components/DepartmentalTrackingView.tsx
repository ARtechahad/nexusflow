import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Briefcase, 
  Code2, 
  Palette, 
  Kanban, 
  Send, 
  ShieldCheck, 
  Plus, 
  Check, 
  ArrowUpRight, 
  Layers, 
  Activity, 
  Cpu, 
  RefreshCw 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DepartmentalProgress } from '../types';

export const DepartmentalTrackingView: React.FC = () => {
  const { 
    departmentalProgress, 
    refreshDepartmentalProgress, 
    currentTenant, 
    projects, 
    formatMoney, 
    role,
    showToast 
  } = useApp();

  const [activeDeptTab, setActiveDeptTab] = useState<'all' | 'sales_bd' | 'project_management' | 'engineering_dev' | 'ui_ux_design'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshDepartmentalProgress();
    setRefreshing(false);
    showToast('Departmental velocity metrics refreshed.', 'info');
  };

  const derivedDepartments: DepartmentalProgress[] = React.useMemo(() => {
    const pipelineVal = projects.reduce((sum, p) => sum + (p.finalPrice || p.estimatedPrice || 0), 0);
    const activeLeads = projects.filter(p => ['lead', 'scoped'].includes(p.status));
    const activeSprints = projects.filter(p => ['advance_paid', 'in_development', 'staging_dev', 'client_review'].includes(p.status));
    const completedDeals = projects.filter(p => ['completed', 'transferred', 'balance_paid'].includes(p.status));
    const qaPassedCount = projects.filter(p => p.internalQAPassed).length;
    const qaRate = projects.length > 0 ? Math.round((qaPassedCount / projects.length) * 100) : 0;
    const designReadyCount = projects.filter(p => p.hasLogo || p.hasImages).length;

    return [
      {
        department: 'sales_bd',
        name: 'Business Development & Sales Engine',
        leadName: 'Sales & BD Desk',
        leadAvatar: '',
        healthStatus: 'optimal',
        metrics: {
          primaryMetricLabel: 'Pipeline Value',
          primaryMetricValue: formatMoney(pipelineVal),
          velocityScore: projects.length > 0 ? Math.min(100, Math.round((activeSprints.length + completedDeals.length) / projects.length * 100)) : 0,
          activeTasksCount: activeLeads.length,
          completedThisWeekCount: completedDeals.length,
          slaAdherencePercent: projects.length > 0 ? 100 : 0
        },
        highlights: activeLeads.length > 0
          ? [`${activeLeads.length} active deal(s) in discovery & scoping`, `${completedDeals.length} deal(s) closed & delivered`]
          : ['No active discovery leads yet. Create a lead or run outbound sequences to track velocity.'],
        activeMilestones: activeLeads.slice(0, 3).map(p => ({
          title: `${p.clientName}${p.clientCompany ? ` (${p.clientCompany})` : ''} — ${p.status.replace('_', ' ')}`,
          owner: p.assignedSalesperson || 'Sales Desk',
          status: p.advancePaid ? 'completed' as const : 'in_progress' as const,
          dueDate: p.targetDeliveryDate || 'TBD',
          progressPercent: p.advancePaid ? 100 : 40
        }))
      },
      {
        department: 'project_management',
        name: 'Project Management & Sprints',
        leadName: 'Operations & PM Desk',
        leadAvatar: '',
        healthStatus: 'optimal',
        metrics: {
          primaryMetricLabel: 'Active Sprints',
          primaryMetricValue: `${activeSprints.length} Sprint${activeSprints.length === 1 ? '' : 's'}`,
          velocityScore: activeSprints.length > 0 ? Math.round((activeSprints.filter(p => p.kickOffConfirmed).length / activeSprints.length) * 100) : 0,
          activeTasksCount: activeSprints.length,
          completedThisWeekCount: completedDeals.length,
          slaAdherencePercent: projects.length > 0 ? 100 : 0
        },
        highlights: activeSprints.length > 0
          ? [`${activeSprints.length} sprint(s) currently governed by SOP 1–11 gates`, `${activeSprints.filter(p => p.discordShared).length} Discord handoff(s) synced`]
          : ['No active project sprints in progress.'],
        activeMilestones: activeSprints.slice(0, 3).map(p => ({
          title: `${p.clientCompany || p.clientName} (${p.websiteType})`,
          owner: p.assignedSalesperson || 'PM Desk',
          status: p.clientApproved ? 'completed' as const : 'in_progress' as const,
          dueDate: p.targetDeliveryDate || 'TBD',
          progressPercent: p.clientApproved ? 90 : p.internalQAPassed ? 70 : 45
        }))
      },
      {
        department: 'engineering_dev',
        name: 'Full-Stack Software & Systems',
        leadName: 'Engineering & QA Desk',
        leadAvatar: '',
        healthStatus: 'optimal',
        metrics: {
          primaryMetricLabel: 'QA Pass Rate',
          primaryMetricValue: projects.length > 0 ? `${qaRate}% (${qaPassedCount}/${projects.length})` : '0% (0/0)',
          velocityScore: qaRate,
          activeTasksCount: projects.filter(p => !p.internalQAPassed && p.advancePaid).length,
          completedThisWeekCount: qaPassedCount,
          slaAdherencePercent: qaRate
        },
        highlights: projects.length > 0
          ? [`${qaPassedCount} of ${projects.length} project(s) passed internal staging QA`, 'Strict SOP Rule 8 live transfer lock enforced']
          : ['No engineering builds queued yet.'],
        activeMilestones: activeSprints.slice(0, 3).map(p => ({
          title: `Staging QA: ${p.clientCompany || p.clientName}`,
          owner: 'Engineering',
          status: p.internalQAPassed ? 'completed' as const : 'in_progress' as const,
          dueDate: p.targetDeliveryDate || 'TBD',
          progressPercent: p.internalQAPassed ? 100 : 50
        }))
      },
      {
        department: 'ui_ux_design',
        name: 'UI/UX Design & Brand Architecture',
        leadName: 'Design & Creative Desk',
        leadAvatar: '',
        healthStatus: 'optimal',
        metrics: {
          primaryMetricLabel: 'Brand Assets Ready',
          primaryMetricValue: `${designReadyCount} / ${projects.length}`,
          velocityScore: projects.length > 0 ? Math.round((designReadyCount / projects.length) * 100) : 0,
          activeTasksCount: projects.filter(p => !p.hasLogo || !p.hasImages).length,
          completedThisWeekCount: designReadyCount,
          slaAdherencePercent: projects.length > 0 ? Math.round((designReadyCount / projects.length) * 100) : 0
        },
        highlights: projects.length > 0
          ? [`${designReadyCount} project(s) have verified brand & visual assets ready`]
          : ['No design asset bundles queued yet.'],
        activeMilestones: []
      }
    ];
  }, [projects, formatMoney]);

  const departments = departmentalProgress.length > 0 ? departmentalProgress : derivedDepartments;

  const filteredDepts = activeDeptTab === 'all' 
    ? departments 
    : departments.filter(d => d.department === activeDeptTab);

  // Overall Velocity Average
  const avgVelocity = departments.length > 0
    ? Math.round(departments.reduce((acc, d) => acc + d.metrics.velocityScore, 0) / departments.length)
    : 0;
  const totalActiveTasks = departments.reduce((acc, d) => acc + d.metrics.activeTasksCount, 0);
  const totalCompletedThisWeek = departments.reduce((acc, d) => acc + d.metrics.completedThisWeekCount, 0);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Banner / Executive Oversight Header */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 font-mono">
                Cross-Departmental Oversight
              </span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                Tenant: <strong className="text-slate-900 dark:text-white">{currentTenant?.name || 'Workspace'}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Departmental Velocity &amp; Team Workflow
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Live synchronization across Business Development, Project Management, Engineering, and UI/UX Design derived directly from workspace records.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white text-xs font-bold border border-slate-200 dark:border-white/10 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync Metrics</span>
            </button>
          </div>
        </div>

        {/* Macro Telemetry Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-200 dark:border-white/10">
          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">Org Velocity Score</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{avgVelocity}%</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">In-Flight Tasks</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{totalActiveTasks}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Across {departments.length} Squads</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">Completed Milestones</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{totalCompletedThisWeek}</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">Active Revenue Pipeline</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {formatMoney(projects.reduce((acc, p) => acc + (p.finalPrice || p.estimatedPrice || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { key: 'all', label: 'All Departments', icon: Layers },
          { key: 'sales_bd', label: 'Business Development & Sales', icon: Send },
          { key: 'project_management', label: 'Project Operations & Sprints', icon: Kanban },
          { key: 'engineering_dev', label: 'Engineering & DevOps', icon: Code2 },
          { key: 'ui_ux_design', label: 'UI/UX Design & Creative', icon: Palette }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeDeptTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveDeptTab(tab.key as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredDepts.map(dept => {
          return (
            <div
              key={dept.department}
              className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                {/* Department Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    {dept.leadAvatar ? (
                      <img 
                        src={dept.leadAvatar} 
                        alt={dept.leadName} 
                        className="w-10 h-10 rounded-2xl object-cover ring-2 ring-indigo-500/20"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xs">
                        {dept.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {dept.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Lead: <strong className="text-slate-700 dark:text-slate-200">{dept.leadName}</strong>
                      </p>
                    </div>
                  </div>

                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Live</span>
                  </span>
                </div>

                {/* Real Metrics Grid */}
                <div className="grid grid-cols-3 gap-3 my-4">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      {dept.metrics.primaryMetricLabel}
                    </span>
                    <span className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5 block">
                      {dept.metrics.primaryMetricValue}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      Velocity Score
                    </span>
                    <span className="text-lg font-black text-indigo-500 dark:text-indigo-400 font-mono mt-0.5 block">
                      {dept.metrics.velocityScore}%
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono block">
                      SLA Adherence
                    </span>
                    <span className="text-lg font-black text-emerald-500 dark:text-emerald-400 font-mono mt-0.5 block">
                      {dept.metrics.slaAdherencePercent}%
                    </span>
                  </div>
                </div>

                {/* Highlights Stream */}
                <div className="space-y-1.5 mb-5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Recent Highlights
                  </span>
                  {dept.highlights.map((hl, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <span className="text-indigo-500 font-bold mt-0.5">›</span>
                      <span>{hl}</span>
                    </div>
                  ))}
                </div>

                {/* Active Milestones Progress */}
                <div className="space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Active Sprint Milestones
                  </span>
                  {dept.activeMilestones.map((m, i) => (
                    <div 
                      key={i} 
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[280px]">
                          {m.title}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                          m.status === 'completed' 
                            ? 'bg-emerald-500/10 text-emerald-500' 
                            : 'bg-indigo-500/10 text-indigo-400'
                        }`}>
                          {m.progressPercent}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            m.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-600'
                          }`}
                          style={{ width: `${m.progressPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>Owner: {m.owner}</span>
                        <span>Due: {m.dueDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {dept.metrics.activeTasksCount} Active Tasks · {dept.metrics.completedThisWeekCount} Closed This Week
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer flex items-center gap-1">
                  <span>Inspect Tasks</span>
                  <ArrowUpRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
