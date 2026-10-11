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

  const departments = departmentalProgress.length > 0 ? departmentalProgress : [
    {
      department: 'sales_bd' as const,
      name: 'Business Development & Sales Engine',
      leadName: 'Hamza Farooq',
      leadAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      healthStatus: 'optimal' as const,
      metrics: {
        primaryMetricLabel: 'Pipeline Value',
        primaryMetricValue: '$14,250',
        velocityScore: 94,
        activeTasksCount: 18,
        completedThisWeekCount: 12,
        slaAdherencePercent: 97
      },
      highlights: [
        'LinkedIn scraper captured 24 qualified leads today',
        'InMail discovery response time averaging 14 mins',
        '2 deals currently negotiating 50% advance invoice'
      ],
      activeMilestones: [
        { title: 'Scale LinkedIn InMail campaign to 50 founders/day', owner: 'Hamza Farooq', status: 'in_progress' as const, dueDate: '2026-09-30', progressPercent: 75 },
        { title: 'Finalize Nordic Art Pottery contract amendment', owner: 'Hamza Farooq', status: 'completed' as const, dueDate: '2026-09-26', progressPercent: 100 },
        { title: 'Upwork Enterprise RFP response for FinTech landing page', owner: 'Hamza Farooq', status: 'in_progress' as const, dueDate: '2026-09-28', progressPercent: 60 }
      ]
    },
    {
      department: 'project_management' as const,
      name: 'Project Management & Sprints',
      leadName: 'Fatima Noor',
      leadAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      healthStatus: 'optimal' as const,
      metrics: {
        primaryMetricLabel: 'Active Sprints',
        primaryMetricValue: '4 Sprints',
        velocityScore: 92,
        activeTasksCount: 14,
        completedThisWeekCount: 9,
        slaAdherencePercent: 99
      },
      highlights: [
        '100% SOP Step 1–11 protocol adherence maintained',
        'Zero unauthorized live transfers without balance clearance',
        'Automated Discord milestone broadcasts running smoothly'
      ],
      activeMilestones: [
        { title: 'Lumina Health Staging QA verification sign-off', owner: 'Fatima Noor', status: 'completed' as const, dueDate: '2026-09-25', progressPercent: 100 },
        { title: 'Prepare kickoff briefing for GreenLeaf Solar', owner: 'Fatima Noor', status: 'in_progress' as const, dueDate: '2026-09-28', progressPercent: 60 },
        { title: 'Conduct bi-weekly sprint velocity retrospective', owner: 'Fatima Noor', status: 'in_progress' as const, dueDate: '2026-09-29', progressPercent: 40 }
      ]
    },
    {
      department: 'engineering_dev' as const,
      name: 'Full-Stack Software & Systems',
      leadName: 'Zain Ul Abideen',
      leadAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      healthStatus: 'optimal' as const,
      metrics: {
        primaryMetricLabel: 'QA Pass Rate',
        primaryMetricValue: '100% (17/17)',
        velocityScore: 96,
        activeTasksCount: 22,
        completedThisWeekCount: 16,
        slaAdherencePercent: 98
      },
      highlights: [
        'Staging subdomains running with auto-provisioned SSL',
        'Dual persistence active (PostgreSQL pool + atomic JSON fallback)',
        'Sub-50ms API response time across all tenant routes'
      ],
      activeMilestones: [
        { title: 'Multi-tenant database foreign key partitioning', owner: 'Zain Ul Abideen', status: 'completed' as const, dueDate: '2026-09-27', progressPercent: 100 },
        { title: 'Cloudflare DNS auto-cutover automation test', owner: 'Zain Ul Abideen', status: 'in_progress' as const, dueDate: '2026-09-29', progressPercent: 80 },
        { title: 'Webhook retry worker with exponential backoff', owner: 'Zain Ul Abideen', status: 'in_progress' as const, dueDate: '2026-10-02', progressPercent: 50 }
      ]
    },
    {
      department: 'ui_ux_design' as const,
      name: 'UI/UX Design & Brand Architecture',
      leadName: 'Sara Jenkins',
      leadAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      healthStatus: 'optimal' as const,
      metrics: {
        primaryMetricLabel: 'Design Deliverables',
        primaryMetricValue: '14 Approved',
        velocityScore: 89,
        activeTasksCount: 11,
        completedThisWeekCount: 8,
        slaAdherencePercent: 95
      },
      highlights: [
        'Minimalist dark-mode geometric design library published',
        'Responsive wireframes for Lumina Health 9-page clinic portal',
        'Client presentation decks prepared for high-ticket pitches'
      ],
      activeMilestones: [
        { title: 'Interactive design mockup for FinTech SaaS client', owner: 'Sara Jenkins', status: 'in_progress' as const, dueDate: '2026-09-30', progressPercent: 65 },
        { title: 'Social share cards & OpenGraph asset bundle', owner: 'Sara Jenkins', status: 'completed' as const, dueDate: '2026-09-26', progressPercent: 100 }
      ]
    }
  ];

  const filteredDepts = activeDeptTab === 'all' 
    ? departments 
    : departments.filter(d => d.department === activeDeptTab);

  // Overall Velocity Average
  const avgVelocity = Math.round(departments.reduce((acc, d) => acc + d.metrics.velocityScore, 0) / departments.length);
  const totalActiveTasks = departments.reduce((acc, d) => acc + d.metrics.activeTasksCount, 0);
  const totalCompletedThisWeek = departments.reduce((acc, d) => acc + d.metrics.completedThisWeekCount, 0);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Top Banner / Executive Oversight Header */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900/90 to-slate-950/80 border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
                Cross-Departmental Oversight
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Tenant: <strong className="text-white">{currentTenant?.name || 'ALM Nexus'}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Departmental Velocity &amp; Team Workflow
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
              Real-time synchronization across Business Development, Project Management, Engineering, and UI/UX Design without micromanagement.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-900 dark:text-white text-xs font-bold border border-slate-200 dark:border-white/10 transition cursor-pointer"
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
              <span className="text-2xl font-black text-indigo-400 font-mono">{avgVelocity}%</span>
              <span className="text-[10px] text-emerald-400 font-bold font-mono">+4.2%</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">In-Flight Tasks</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{totalActiveTasks}</span>
              <span className="text-[10px] text-slate-400">Across 4 Squads</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">Completed This Week</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-400 font-mono">{totalCompletedThisWeek}</span>
              <span className="text-[10px] text-emerald-400 font-bold font-mono">100% On-Time</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium block">Active Revenue Pipeline</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-400 font-mono">
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
              className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl shadow-slate-900/5 flex flex-col justify-between"
            >
              <div>
                {/* Department Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <img 
                      src={dept.leadAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                      alt={dept.leadName} 
                      className="w-10 h-10 rounded-2xl object-cover ring-2 ring-indigo-500/20"
                    />
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
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Optimal</span>
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
