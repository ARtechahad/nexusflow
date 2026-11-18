import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  ProjectLead,
  UserRole,
  CompanyRole,
  AvailabilityStatus,
  Department,
  DepartmentModuleKey,
  PendingInvitePreview,
  SupportedLanguage,
  SupportedCurrency,
  AgencyScaleMode,
  AISettings,
  AuthUser,
  DatabaseEngineStatus,
  ThemeMode,
  Tenant,
  ActivityFeedItem,
  WikiDocument,
  DepartmentalProgress
} from '../types';
import { TRANSLATIONS } from '../data/translations';
import { getSavedAISettings, saveAISettings } from '../services/aiService';
import { ToastItem, ToastType } from '../components/ToastNotification';
import {
  auth,
  signInWithGoogle,
  signOutFirebase,
  syncUserProfile,
  saveUserPreferences,
  getUserPreferences,
  loadProjectsFromFirestore,
  saveProjectToFirestore,
  seedProjectsToFirestore,
  subscribeProjectsFromFirestore
} from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { offlineSyncService } from '../services/offlineSyncService';
import { googleSheetsService } from '../services/googleSheetsService';
import { localDatabase } from '../services/localDatabaseFallback';
import { clearOutreachTelemetryCache } from '../hooks/useOutreachTelemetry';
import { DEFAULT_DEPARTMENT_MODULES, hasModuleAccess } from '../utils/departmentAccess';

export type AppNavTab =
  | 'overview'
  | 'departments'
  | 'sop'
  | 'pipeline'
  | 'outreach'
  | 'outreach_suite'
  | 'docs'
  | 'inbox'
  | 'analytics'
  | 'integrations'
  | 'commissions'
  | 'chat'
  | 'vault'
  | 'portal'
  | 'free_apis'
  | 'gmail'
  | 'departmental'
  | 'wiki'
  | 'leadflow'
  | 'profile';

export function mapCompanyRoleToUserRole(companyRole: CompanyRole | null | undefined, fallback?: UserRole): UserRole {
  if (companyRole === 'company_admin') return 'admin';
  if (companyRole === 'department_head') return 'coordinator';
  if (companyRole === 'employee') return 'developer';
  return fallback || 'team_member';
}

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  companyRole: CompanyRole | null;
  currentUser: AuthUser | null;
  authToken: string | null;
  isAuthenticated: boolean;
  firebaseUser: FirebaseUser | null;
  isFirebaseConnected: boolean;
  loginWithGoogle: () => Promise<{ success: boolean; message?: string; cancelled?: boolean }>;
  loginWithOAuth: (
    provider: 'github' | 'google',
    fallbackUser?: { name: string; email: string; avatar?: string }
  ) => Promise<{ success: boolean; message?: string }>;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message?: string; companies?: Tenant[]; pendingInvites?: PendingInvitePreview[] }>;
  logout: () => void;
  switchPersona: (role: UserRole) => Promise<void>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  // Multi-Company & Department Architecture
  currentTenant: Tenant | null;
  tenants: Tenant[];
  departments: Department[];
  selectedDepartmentId: string | null;
  setSelectedDepartmentId: (deptId: string | null) => void;
  refreshDepartments: (companyId?: string, tokenOverride?: string | null) => Promise<Department[]>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenants: () => Promise<void>;
  createCompany: (payload: {
    name: string;
    industry?: string;
    size?: string;
    description?: string;
    initialDepartments?: string[];
  }) => Promise<{ success: boolean; message?: string; company?: Tenant }>;
  updateCompanySettings: (
    companyId: string,
    settings: {
      enableEmailOutreach?: boolean;
      enableClientInbox?: boolean;
      enableFinancials?: boolean;
      enableDealsPipeline?: boolean;
    }
  ) => Promise<{ success: boolean; message?: string; company?: Tenant }>;
  createDepartment: (
    name: string,
    description?: string,
    allowedModules?: DepartmentModuleKey[]
  ) => Promise<{ success: boolean; message?: string; department?: Department }>;
  updateDepartmentPermissions: (
    deptId: string,
    payload: {
      name?: string;
      description?: string;
      allowed_modules: DepartmentModuleKey[];
    }
  ) => Promise<{ success: boolean; message?: string; department?: Department }>;
  deleteDepartment: (deptId: string) => Promise<{ success: boolean; message?: string }>;
  pendingInvites: PendingInvitePreview[];
  inviteToken: string | null;
  setInviteToken: (token: string | null) => void;
  invitePreview: PendingInvitePreview | null;
  inviteLoading: boolean;
  inviteError: string | null;
  acceptInvite: (
    token: string
  ) => Promise<{ success: boolean; message?: string; companyId?: string; departmentId?: string }>;
  completeInviteOnboarding: (
    token: string,
    payload: {
      fullName: string;
      password: string;
      phone?: string;
      title?: string;
      bio?: string;
    }
  ) => Promise<{
    success: boolean;
    message?: string;
    code?: string;
    companyId?: string;
    departmentId?: string;
  }>;
  updateMyProfile: (payload: {
    fullName?: string;
    phone?: string;
    title?: string;
    bio?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  updateMyAvailability: (status: AvailabilityStatus) => Promise<boolean>;
  isOnboardingModalOpen: boolean;
  setIsOnboardingModalOpen: (open: boolean) => void;
  onboardNewTenant: (data: any) => Promise<{ success: boolean; message?: string; tenant?: Tenant }>;
  // Individual-first Email OTP Registration
  requestSignupOtp: (data: {
    fullName: string;
    email: string;
    password: string;
  }) => Promise<{
    success: boolean;
    message?: string;
    email?: string;
    cooldownSeconds?: number;
    expiresInSeconds?: number;
    retryAfterSeconds?: number;
    deliveryProvider?: string;
  }>;
  resendSignupOtp: (email: string) => Promise<{
    success: boolean;
    message?: string;
    cooldownSeconds?: number;
    retryAfterSeconds?: number;
  }>;
  verifySignupOtp: (
    email: string,
    code: string
  ) => Promise<{
    success: boolean;
    message?: string;
    expired?: boolean;
    companies?: Tenant[];
    pendingInvites?: PendingInvitePreview[];
  }>;
  // Real-time Activity Feed & System Alerts
  isActivityFeedOpen: boolean;
  setIsActivityFeedOpen: (open: boolean) => void;
  activityFeed: ActivityFeedItem[];
  unreadActivityCount: number;
  markActivityAsRead: (id?: string) => void;
  refreshActivityFeed: () => Promise<void>;
  // Global Company Wiki / Knowledge Base
  isWikiModalOpen: boolean;
  setIsWikiModalOpen: (open: boolean) => void;
  wikiDocs: WikiDocument[];
  refreshWikiDocs: () => Promise<void>;
  // Departmental Progress & Real-Time Tracking
  departmentalProgress: DepartmentalProgress[];
  refreshDepartmentalProgress: () => Promise<void>;
  // Platform Health Monitor
  isPlatformHealthModalOpen: boolean;
  setIsPlatformHealthModalOpen: (open: boolean) => void;
  databaseStatus: DatabaseEngineStatus | null;
  refreshDatabaseStatus: () => Promise<void>;
  isDatabaseModalOpen: boolean;
  setIsDatabaseModalOpen: (open: boolean) => void;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  toggleTheme: () => void;
  activeTab: AppNavTab;
  setActiveTab: (tab: AppNavTab) => void;
  activePortalProjectId: string | null;
  setActivePortalProjectId: (id: string | null) => void;
  openClientPortal: (projectId: string) => void;
  unreadInboxCount: number;
  setUnreadInboxCount: (count: number) => void;
  projects: ProjectLead[];
  loadingProjects: boolean;
  refreshProjects: () => Promise<void>;
  updateProject: (id: string, updates: Partial<ProjectLead>) => Promise<boolean>;
  transferProject: (id: string) => Promise<{ success: boolean; message: string }>;
  isOnline: boolean;
  toastMessage: string | null;
  toasts: ToastItem[];
  dismissToast: (id: string) => void;
  showToast: (msg: string, type?: ToastType) => void;
  isTestModalOpen: boolean;
  setIsTestModalOpen: (open: boolean) => void;
  isGDPRModalOpen: boolean;
  setIsGDPRModalOpen: (open: boolean) => void;
  isAIModalOpen: boolean;
  setIsAIModalOpen: (open: boolean) => void;
  isAISettingsModalOpen: boolean;
  setIsAISettingsModalOpen: (open: boolean) => void;
  aiSettings: AISettings;
  setAISettings: (settings: AISettings) => void;
  updateAISettings: (updates: Partial<AISettings>) => void;
  aiInitialData: { clientName?: string; websiteType?: string; channel?: string; mode?: string } | null;
  openAIModal: (data?: { clientName?: string; websiteType?: string; channel?: string; mode?: string }) => void;
  outreachInitialData: any;
  setOutreachInitialData: (data: any) => void;
  openOutreachWithData: (data: any) => void;
  isNewLeadModalOpen: boolean;
  setIsNewLeadModalOpen: (open: boolean) => void;
  discordExportModalData: ProjectLead | null;
  setDiscordExportModalData: (proj: ProjectLead | null) => void;
  automatedTestsPassedCount: number;
  currency: SupportedCurrency;
  setCurrency: (c: SupportedCurrency) => void;
  formatMoney: (amount: number, overrideCurr?: SupportedCurrency) => string;
  scaleMode: AgencyScaleMode;
  setScaleMode: (mode: AgencyScaleMode) => Promise<void>;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isCreativeStudioOpen: boolean;
  setIsCreativeStudioOpen: (open: boolean) => void;
  showSetupChecklist: boolean;
  dismissSetupChecklist: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function getDefaultTabForCompanyRole(companyRole: CompanyRole | null | undefined): AppNavTab {
  if (companyRole === 'company_admin') return 'overview';
  if (companyRole === 'department_head' || companyRole === 'employee') return 'departmental';
  return 'departmental';
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('alm_nexus_token') || null;
    }
    return null;
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('alm_nexus_token');
      const savedUser = localStorage.getItem('alm_nexus_user');
      if (token && savedUser) {
        try {
          return JSON.parse(savedUser);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const [role, setRoleState] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('alm_nexus_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed?.role) return parsed.role;
        } catch {}
      }
    }
    return 'team_member';
  });

  const [databaseStatus, setDatabaseStatus] = useState<DatabaseEngineStatus | null>(null);
  const [isDatabaseModalOpen, setIsDatabaseModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [currency, setCurrency] = useState<SupportedCurrency>('USD');
  const [scaleMode, setScaleModeState] = useState<AgencyScaleMode>('enterprise');

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('clientops_theme_mode') as ThemeMode;
      if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
        return savedMode;
      }
      const legacy = localStorage.getItem('clientops_theme');
      if (legacy === 'light' || legacy === 'dark') {
        return legacy as ThemeMode;
      }
    }
    return 'light';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const isDark = themeMode === 'system' ? systemPrefersDark : themeMode === 'dark';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
    localStorage.setItem('clientops_theme_mode', themeMode);
    localStorage.setItem('clientops_theme', isDark ? 'dark' : 'light');
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#090D16' : '#ffffff');
    }
  }, [isDark, themeMode]);

  const setThemeMode = (mode: ThemeMode) => setThemeModeState(mode);
  const setIsDark = (dark: boolean) => setThemeModeState(dark ? 'dark' : 'light');
  const toggleTheme = () => setThemeModeState(isDark ? 'light' : 'dark');

  const [activeTab, setActiveTabState] = useState<AppNavTab>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('portal')) return 'portal';
      const tabParam = params.get('tab');
      if (
        tabParam &&
        [
          'overview',
          'departments',
          'sop',
          'pipeline',
          'outreach',
          'outreach_suite',
          'inbox',
          'analytics',
          'integrations',
          'commissions',
          'chat',
          'vault',
          'portal',
          'free_apis',
          'gmail',
          'departmental',
          'wiki',
          'profile'
        ].includes(tabParam)
      ) {
        return tabParam as AppNavTab;
      }
    }
    return 'overview';
  });

  // Multi-Company & Department State
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentIdState] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvitePreview[]>([]);
  const [inviteToken, setInviteToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('invite') || null;
    }
    return null;
  });
  const [invitePreview, setInvitePreview] = useState<PendingInvitePreview | null>(null);
  const [inviteLoading, setInviteLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get('invite'));
    }
    return false;
  });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);

  const companyRole: CompanyRole | null = currentTenant?.myRole || null;

  const setSelectedDepartmentId = useCallback((deptId: string | null) => {
    setSelectedDepartmentIdState(deptId);
    if (typeof window !== 'undefined') {
      if (deptId) {
        localStorage.setItem('alm_nexus_dept_id', deptId);
      } else {
        localStorage.removeItem('alm_nexus_dept_id');
      }
    }
  }, []);

  // Activity, Wiki & Dept Telemetry
  const [isActivityFeedOpen, setIsActivityFeedOpen] = useState<boolean>(false);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [unreadActivityCount, setUnreadActivityCount] = useState<number>(0);
  const [isWikiModalOpen, setIsWikiModalOpen] = useState<boolean>(false);
  const [wikiDocs, setWikiDocs] = useState<WikiDocument[]>([]);
  const [departmentalProgress, setDepartmentalProgress] = useState<DepartmentalProgress[]>([]);
  const [isPlatformHealthModalOpen, setIsPlatformHealthModalOpen] = useState<boolean>(false);

  const [activePortalProjectId, setActivePortalProjectId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('portal') || null;
    }
    return null;
  });
  const [unreadInboxCount, setUnreadInboxCount] = useState<number>(0);
  const [projects, setProjects] = useState<ProjectLead[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [outreachInitialData, setOutreachInitialData] = useState<any>(null);

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isGDPRModalOpen, setIsGDPRModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState(false);
  const [aiSettings, setAISettingsState] = useState<AISettings>(() => getSavedAISettings());
  const [aiInitialData, setAiInitialData] = useState<{
    clientName?: string;
    websiteType?: string;
    channel?: string;
    mode?: string;
  } | null>(null);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [discordExportModalData, setDiscordExportModalData] = useState<ProjectLead | null>(null);
  const [automatedTestsPassedCount] = useState<number>(17);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCreativeStudioOpen, setIsCreativeStudioOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('clientops_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const setSidebarCollapsed = (collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('clientops_sidebar_collapsed', String(collapsed));
    }
  };

  const [showSetupChecklist, setShowSetupChecklist] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('clientops_setup_checklist') === 'true';
    }
    return false;
  });

  const dismissSetupChecklist = () => {
    setShowSetupChecklist(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('clientops_setup_checklist');
    }
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    setToastMessage(msg);
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { id, message: msg, type, duration: 4200 };
    setToasts(prev => [...prev.slice(-4), newToast]);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 4200);
  }, []);

  const getTabRequiredModule = (tab: AppNavTab): DepartmentModuleKey | null => {
    if (tab === 'departmental') return 'operations';
    if (tab === 'chat') return 'chat';
    if (tab === 'outreach' || tab === 'outreach_suite') return 'email_hub';
    if (tab === 'inbox') return 'client_inbox';
    if (tab === 'commissions' || tab === 'analytics') return 'financials';
    return null;
  };

  const getFallbackTabForMember = (
    cRole: CompanyRole | null,
    activeDeptObj: Department | null,
    deptList: Department[]
  ): AppNavTab => {
    if (cRole === 'company_admin') return 'overview';
    const candidates: Array<{ tab: AppNavTab; mod: DepartmentModuleKey }> = [
      { tab: 'departmental', mod: 'operations' },
      { tab: 'chat', mod: 'chat' },
      { tab: 'outreach_suite', mod: 'email_hub' },
      { tab: 'inbox', mod: 'client_inbox' },
      { tab: 'commissions', mod: 'financials' }
    ];
    const match = candidates.find((c) => hasModuleAccess(cRole, c.mod, activeDeptObj, deptList));
    return match ? match.tab : 'profile';
  };

  const setActiveTab = (tab: AppNavTab) => {
    if (role === 'client_guest' && tab !== 'portal') {
      showToast('Restricted: Guest client access is isolated to the Client Portal.', 'warning');
      return;
    }
    if (
      companyRole !== 'company_admin' &&
      ['overview', 'departments', 'pipeline', 'sop', 'vault', 'gmail', 'portal', 'integrations'].includes(tab)
    ) {
      showToast('Restricted: Company-wide settings and admin tools require Company Owner access.', 'warning');
      return;
    }
    if (companyRole !== 'company_admin') {
      const requiredMod = getTabRequiredModule(tab);
      if (requiredMod) {
        const activeDept =
          departments.find((d) => d.id === selectedDepartmentId) ||
          (departments.length === 1 ? departments[0] : null);
        if (!hasModuleAccess(companyRole, requiredMod, activeDept, departments)) {
          showToast(
            'Restricted: This module is not enabled for your department. Contact your Company Owner to enable it.',
            'warning'
          );
          return;
        }
      }
    }
    setActiveTabState(tab);
  };

  // Auto-redirect if active role/department no longer authorizes current tab
  useEffect(() => {
    if (!currentUser || !currentTenant || role === 'client_guest' || !companyRole) return;
    if (companyRole === 'company_admin') return;

    const activeDept =
      departments.find((d) => d.id === selectedDepartmentId) ||
      (departments.length === 1 ? departments[0] : null);

    if (['overview', 'departments', 'pipeline', 'sop', 'vault', 'gmail', 'portal', 'integrations'].includes(activeTab)) {
      setActiveTabState(getFallbackTabForMember(companyRole, activeDept, departments));
      return;
    }

    const requiredMod = getTabRequiredModule(activeTab);
    if (requiredMod && departments.length > 0 && !hasModuleAccess(companyRole, requiredMod, activeDept, departments)) {
      setActiveTabState(getFallbackTabForMember(companyRole, activeDept, departments));
    }
  }, [currentUser, currentTenant, companyRole, role, departments, selectedDepartmentId, activeTab]);

  // Sync localDatabase scope key
  useEffect(() => {
    localDatabase.setActiveScope(currentUser?.id, currentTenant?.id);
  }, [currentUser?.id, currentTenant?.id]);

  // Keep localStorage alm_nexus_tenant_id synced strictly to active company
  const applyActiveCompany = useCallback(
    (company: Tenant | null, userBaseRole?: UserRole) => {
      setCurrentTenant(company);
      clearOutreachTelemetryCache();
      if (typeof window !== 'undefined') {
        if (company?.id) {
          localStorage.setItem('alm_nexus_tenant_id', company.id);
        } else {
          localStorage.removeItem('alm_nexus_tenant_id');
        }
      }
      if (company) {
        const mapped = mapCompanyRoleToUserRole(company.myRole, userBaseRole);
        setRoleState(mapped);
      } else {
        setRoleState(userBaseRole || 'team_member');
      }
    },
    []
  );

  // Fetch invite preview if URL contains ?invite=<token>
  useEffect(() => {
    if (!inviteToken) {
      setInvitePreview(null);
      setInviteLoading(false);
      setInviteError(null);
      return;
    }
    let active = true;
    setInviteLoading(true);
    setInviteError(null);
    fetch(`/api/invites/${encodeURIComponent(inviteToken)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, data };
      })
      .then(({ ok, data }) => {
        if (!active) return;
        if (ok && data?.success && data.invite) {
          if (data.invite.status === 'pending') {
            setInvitePreview({ ...data.invite, token: inviteToken });
            setInviteError(null);
          } else {
            setInvitePreview(null);
            setInviteError(`This invitation is ${data.invite.status} and can no longer be used.`);
          }
        } else {
          setInvitePreview(null);
          setInviteError(data?.message || 'Invitation link not found or invalid.');
        }
      })
      .catch(() => {
        if (active) {
          setInvitePreview(null);
          setInviteError('Unable to verify invitation link right now.');
        }
      })
      .finally(() => {
        if (active) setInviteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [inviteToken]);

  const refreshDepartments = useCallback(
    async (companyIdOverride?: string, tokenOverride?: string | null): Promise<Department[]> => {
      const targetCompanyId = companyIdOverride || currentTenant?.id;
      const token = tokenOverride !== undefined ? tokenOverride : authToken;
      if (!targetCompanyId || !token) {
        setDepartments([]);
        setSelectedDepartmentId(null);
        return [];
      }

      try {
        const res = await fetch(`/api/companies/${encodeURIComponent(targetCompanyId)}/departments`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-Id': targetCompanyId
          }
        });
        if (!res.ok) {
          setDepartments([]);
          return [];
        }
        const data = await res.json();
        const deptList: Department[] = Array.isArray(data.departments) ? data.departments : [];
        setDepartments(deptList);

        const savedDeptId =
          typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_dept_id') : null;
        const activeRole =
          tenants.find((t) => t.id === targetCompanyId)?.myRole || currentTenant?.myRole;

        if (deptList.length === 0) {
          setSelectedDepartmentId(null);
        } else if (activeRole === 'company_admin') {
          const validSaved = deptList.find((d) => d.id === savedDeptId);
          setSelectedDepartmentId(validSaved ? validSaved.id : deptList[0].id);
        } else if (deptList.length === 1) {
          setSelectedDepartmentId(deptList[0].id);
        } else {
          // Multi-department non-admin: restore only if saved & belonging to current company, else show selector
          const validSaved = deptList.find((d) => d.id === savedDeptId);
          setSelectedDepartmentId(validSaved ? validSaved.id : null);
        }

        return deptList;
      } catch (err) {
        console.warn('Could not load departments', err);
        setDepartments([]);
        return [];
      }
    },
    [authToken, currentTenant?.id, currentTenant?.myRole, tenants, setSelectedDepartmentId]
  );

  // Load authenticated user's companies strictly from /api/companies
  const refreshTenants = useCallback(async () => {
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    if (!token) {
      setTenants([]);
      applyActiveCompany(null);
      return;
    }

    try {
      const res = await fetch('/api/companies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const companyList: Tenant[] = Array.isArray(data.companies) ? data.companies : [];
        const invitesList: PendingInvitePreview[] = Array.isArray(data.pendingInvites)
          ? data.pendingInvites
          : [];
        setTenants(companyList);
        setPendingInvites(invitesList);

        const savedTenantId =
          typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_tenant_id') : null;
        const found = companyList.find((t) => t.id === savedTenantId) || companyList[0] || null;
        applyActiveCompany(found, currentUser?.role);
        if (found) {
          await refreshDepartments(found.id, token);
        } else {
          setDepartments([]);
          setSelectedDepartmentId(null);
        }
      }
    } catch (e) {
      console.warn('Could not fetch companies list', e);
    }
  }, [authToken, currentUser?.role, applyActiveCompany, refreshDepartments, setSelectedDepartmentId]);

  const refreshActivityFeed = useCallback(async () => {
    const tid = currentTenant?.id;
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    if (!tid || !token) {
      setActivityFeed([]);
      setUnreadActivityCount(0);
      return;
    }
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tid)}/activity`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tid
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.activity)) {
          setActivityFeed(data.activity);
          setUnreadActivityCount(data.activity.filter((a: ActivityFeedItem) => !a.isRead).length);
        }
      }
    } catch (e) {
      console.warn('Could not fetch activity feed', e);
    }
  }, [authToken, currentTenant?.id]);

  const refreshWikiDocs = useCallback(async () => {
    const tid = currentTenant?.id;
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    if (!tid || !token) {
      setWikiDocs([]);
      return;
    }
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tid)}/wiki`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tid
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.wikiDocs)) {
          setWikiDocs(data.wikiDocs);
        }
      }
    } catch (e) {
      console.warn('Could not fetch wiki docs', e);
    }
  }, [authToken, currentTenant?.id]);

  const refreshDepartmentalProgress = useCallback(async () => {
    const tid = currentTenant?.id;
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    if (!tid || !token) {
      setDepartmentalProgress([]);
      return;
    }
    try {
      const res = await fetch(`/api/tenants/${encodeURIComponent(tid)}/departmental`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tid
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.departments)) {
          setDepartmentalProgress(data.departments);
        }
      }
    } catch (e) {
      console.warn('Could not fetch departmental progress', e);
    }
  }, [authToken, currentTenant?.id]);

  const refreshDatabaseStatus = useCallback(async () => {
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    const tid = currentTenant?.id;
    if (!token || !tid || currentTenant?.myRole !== 'company_admin') {
      return;
    }
    try {
      const res = await fetch('/api/database/status', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tid
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.status) {
          setDatabaseStatus(data.status);
        }
      }
    } catch (e) {
      console.warn('Failed to load database status', e);
    }
  }, [authToken, currentTenant?.id, currentTenant?.myRole]);

  const refreshProjects = useCallback(async () => {
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    const tid = currentTenant?.id;
    if (!token || !tid || currentTenant?.myRole === 'employee') {
      setProjects([]);
      return;
    }

    setLoadingProjects(true);
    try {
      if (auth.currentUser) {
        try {
          const firestoreProjects = await loadProjectsFromFirestore();
          if (firestoreProjects && firestoreProjects.length > 0) {
            setProjects(firestoreProjects);
            localDatabase.saveProjects(firestoreProjects, `${currentUser?.id || 'u'}::${tid}`);
            setLoadingProjects(false);
            return;
          }
        } catch {
          // fallback to API
        }
      }

      const res = await fetch('/api/projects', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tid
        }
      });
      if (res.ok) {
        const data = await res.json();
        const projs = Array.isArray(data.projects) ? data.projects : [];
        setProjects(projs);
        localDatabase.saveProjects(projs, `${currentUser?.id || 'u'}::${tid}`);
        if (auth.currentUser && projs.length > 0) {
          seedProjectsToFirestore(projs).catch(() => {});
        }
      } else {
        setProjects([]);
      }
    } catch {
      const local = localDatabase.getProjects(`${currentUser?.id || 'u'}::${tid}`);
      setProjects(local);
    } finally {
      setLoadingProjects(false);
    }
  }, [authToken, currentTenant?.id, currentTenant?.myRole, currentUser?.id]);

  const switchTenant = async (tenantId: string) => {
    const target = tenants.find((t) => t.id === tenantId);
    if (!target) return;

    setSelectedDepartmentId(null);
    applyActiveCompany(target, currentUser?.role);
    setActiveTabState(getDefaultTabForCompanyRole(target.myRole));
    showToast(`Switched active workspace to "${target.name}"`, 'info');
  };

  // Trigger scoped workspace loads whenever active company changes
  useEffect(() => {
    if (!authToken || !currentTenant?.id) {
      setProjects([]);
      setActivityFeed([]);
      setUnreadActivityCount(0);
      setWikiDocs([]);
      setDepartmentalProgress([]);
      setDepartments([]);
      return;
    }

    refreshDepartments(currentTenant.id, authToken);
    refreshActivityFeed();
    refreshWikiDocs();
    refreshDepartmentalProgress();
    if (currentTenant.myRole !== 'employee') {
      refreshProjects();
    } else {
      setProjects([]);
    }
    if (currentTenant.myRole === 'company_admin') {
      refreshDatabaseStatus();
    }
  }, [
    authToken,
    currentTenant?.id,
    currentTenant?.myRole,
    refreshDepartments,
    refreshActivityFeed,
    refreshWikiDocs,
    refreshDepartmentalProgress,
    refreshProjects,
    refreshDatabaseStatus
  ]);

  // Authenticated Company-Scoped Real-time SSE Subscription
  useEffect(() => {
    if (!authToken || !currentTenant?.id || typeof EventSource === 'undefined') {
      return;
    }

    const url = `/api/events/stream?token=${encodeURIComponent(authToken)}&companyId=${encodeURIComponent(
      currentTenant.id
    )}`;
    const es = new EventSource(url);

    const dispatchSse = (eventName: string, rawData: string) => {
      try {
        const parsed = JSON.parse(rawData);
        window.dispatchEvent(new CustomEvent(`clientops:sse:${eventName}`, { detail: parsed }));
        return parsed;
      } catch {
        return null;
      }
    };

    es.addEventListener('availability:updated', (ev: any) => {
      const payload = dispatchSse('availability', ev.data);
      if (payload && currentUser && payload.userId === currentUser.id && payload.availabilityStatus) {
        setCurrentUser((prev) =>
          prev
            ? {
                ...prev,
                availabilityStatus: payload.availabilityStatus,
                availabilityUpdatedAt: payload.availabilityUpdatedAt
              }
            : prev
        );
      }
    });

    es.addEventListener('chat:message', (ev: any) => {
      dispatchSse('chat', ev.data);
    });

    es.addEventListener('task:updated', (ev: any) => {
      dispatchSse('task', ev.data);
    });

    es.addEventListener('department:updated', (ev: any) => {
      const payload = dispatchSse('department', ev.data);
      if (payload?.companyId === currentTenant.id) {
        refreshDepartments(currentTenant.id, authToken);
      }
    });

    return () => {
      es.close();
    };
  }, [authToken, currentTenant?.id, currentUser?.id, refreshDepartments]);

  const createCompany = async (payload: {
    name: string;
    industry?: string;
    size?: string;
    description?: string;
    initialDepartments?: string[];
  }): Promise<{ success: boolean; message?: string; company?: Tenant }> => {
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    if (!token) {
      return { success: false, message: 'You must be signed in to create a company.' };
    }
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success && data.company) {
        const nextCompanies: Tenant[] = Array.isArray(data.companies)
          ? data.companies
          : [data.company, ...tenants];
        setTenants(nextCompanies);
        setSelectedDepartmentId(data.departments?.[0]?.id || null);
        applyActiveCompany(data.company, currentUser?.role);
        setActiveTabState('overview');
        if (typeof window !== 'undefined') {
          localStorage.setItem('clientops_setup_checklist', 'true');
        }
        setShowSetupChecklist(true);
        showToast(`Company "${data.company.name}" registered!`, 'success');
        return { success: true, company: data.company };
      }
      return { success: false, message: data.message || 'Could not create company.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error while creating company.' };
    }
  };

  const updateCompanySettings = async (
    companyId: string,
    settings: {
      enableEmailOutreach?: boolean;
      enableClientInbox?: boolean;
      enableFinancials?: boolean;
      enableDealsPipeline?: boolean;
    }
  ): Promise<{ success: boolean; message?: string; company?: Tenant }> => {
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    if (!token || !companyId) {
      return { success: false, message: 'No active company session.' };
    }
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(companyId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': companyId
        },
        body: JSON.stringify({ settings })
      });
      const data = await res.json();
      if (res.ok && data.success && data.company) {
        if (Array.isArray(data.companies)) {
          setTenants(data.companies);
        } else {
          setTenants((prev) => prev.map((t) => (t.id === companyId ? { ...t, ...data.company } : t)));
        }
        if (currentTenant?.id === companyId) {
          applyActiveCompany(data.company, currentUser?.role);
        }
        return { success: true, company: data.company };
      }
      return { success: false, message: data.message || 'Could not update company settings.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error updating settings.' };
    }
  };

  const createDepartment = async (
    name: string,
    description?: string,
    allowedModules?: DepartmentModuleKey[]
  ): Promise<{ success: boolean; message?: string; department?: Department }> => {
    if (!authToken || !currentTenant?.id) {
      return { success: false, message: 'Select a company first.' };
    }
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(currentTenant.id)}/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'X-Tenant-Id': currentTenant.id
        },
        body: JSON.stringify({
          name,
          description,
          allowed_modules: allowedModules ?? DEFAULT_DEPARTMENT_MODULES
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.department) {
        setDepartments((prev) => [...prev, data.department]);
        setSelectedDepartmentId(data.department.id);
        showToast(`Department "${data.department.name}" created.`, 'success');
        return { success: true, department: data.department };
      }
      return { success: false, message: data.message || data.error || 'Could not create department.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error while creating department.' };
    }
  };

  const updateDepartmentPermissions = async (
    deptId: string,
    payload: {
      name?: string;
      description?: string;
      allowed_modules: DepartmentModuleKey[];
    }
  ): Promise<{ success: boolean; message?: string; department?: Department }> => {
    if (!authToken || !currentTenant?.id) {
      return { success: false, message: 'Select a company first.' };
    }
    try {
      const res = await fetch(
        `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(deptId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            'X-Tenant-Id': currentTenant.id
          },
          body: JSON.stringify(payload)
        }
      );
      const data = await res.json();
      if (res.ok && data.success && data.department) {
        setDepartments((prev) =>
          prev.map((d) => (d.id === deptId ? { ...d, ...data.department } : d))
        );
        showToast(data.message || 'Department permissions updated.', 'success');
        return { success: true, department: data.department };
      }
      return { success: false, message: data.message || data.error || 'Could not update department permissions.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error while updating department.' };
    }
  };

  const deleteDepartment = async (
    deptId: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (!authToken || !currentTenant?.id) {
      return { success: false, message: 'Select a company first.' };
    }
    try {
      const res = await fetch(
        `/api/companies/${encodeURIComponent(currentTenant.id)}/departments/${encodeURIComponent(deptId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'X-Tenant-Id': currentTenant.id
          }
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        const remaining = departments.filter((d) => d.id !== deptId);
        setDepartments(remaining);
        if (selectedDepartmentId === deptId) {
          setSelectedDepartmentId(remaining[0]?.id || null);
        }
        showToast(data.message || 'Department deleted.', 'info');
        return { success: true };
      }
      return { success: false, message: data.message || data.error || 'Could not delete department.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error while deleting department.' };
    }
  };

  const acceptInvite = async (
    tokenValue: string
  ): Promise<{ success: boolean; message?: string; companyId?: string; departmentId?: string }> => {
    const token =
      (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null) || authToken;
    if (!token) {
      return { success: false, message: 'Please sign in first to accept this invitation.' };
    }
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(tokenValue)}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const nextCompanies: Tenant[] = Array.isArray(data.companies) ? data.companies : tenants;
        const nextInvites: PendingInvitePreview[] = Array.isArray(data.pendingInvites)
          ? data.pendingInvites
          : pendingInvites.filter((i) => i.token !== tokenValue);
        setTenants(nextCompanies);
        setPendingInvites(nextInvites);
        setInviteToken(null);
        setInvitePreview(null);
        setInviteError(null);
        if (typeof window !== 'undefined' && window.location.search.includes('invite=')) {
          const url = new URL(window.location.href);
          url.searchParams.delete('invite');
          window.history.replaceState({}, '', url.pathname + url.search);
        }

        const joinedCompany = nextCompanies.find((c) => c.id === data.companyId) || nextCompanies[0] || null;
        if (data.departmentId) {
          setSelectedDepartmentId(data.departmentId);
        }
        if (joinedCompany) {
          applyActiveCompany(joinedCompany, currentUser?.role);
          await refreshDepartments(joinedCompany.id, token);
          setActiveTabState(
            joinedCompany.myRole === 'company_admin'
              ? 'overview'
              : getDefaultTabForCompanyRole(joinedCompany.myRole)
          );
        }
        showToast(data.message || 'Invitation accepted!', 'success');
        return { success: true, companyId: data.companyId, departmentId: data.departmentId };
      }
      return { success: false, message: data.message || 'Could not accept invitation.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error accepting invitation.' };
    }
  };

  const completeInviteOnboarding = async (
    tokenValue: string,
    payload: {
      fullName: string;
      password: string;
      phone?: string;
      title?: string;
      bio?: string;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    code?: string;
    companyId?: string;
    departmentId?: string;
  }> => {
    const existingToken =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (existingToken) {
        headers['Authorization'] = `Bearer ${existingToken}`;
      }
      const res = await fetch(`/api/invites/${encodeURIComponent(tokenValue)}/complete-onboarding`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success && data.token && data.user) {
        const nextCompanies: Tenant[] = Array.isArray(data.companies) ? data.companies : [];
        const nextInvites: PendingInvitePreview[] = Array.isArray(data.pendingInvites)
          ? data.pendingInvites
          : [];

        clearOutreachTelemetryCache();
        setAuthToken(data.token);
        setCurrentUser(data.user);
        setTenants(nextCompanies);
        setPendingInvites(nextInvites);
        setInviteToken(null);
        setInvitePreview(null);
        setInviteError(null);

        if (typeof window !== 'undefined') {
          localStorage.setItem('alm_nexus_token', data.token);
          localStorage.setItem('alm_nexus_user', JSON.stringify(data.user));
          if (window.location.search.includes('invite=')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('invite');
            window.history.replaceState({}, '', url.pathname + url.search);
          }
        }

        const joinedCompany =
          nextCompanies.find((c) => c.id === data.companyId) || nextCompanies[0] || null;
        if (joinedCompany) {
          applyActiveCompany(joinedCompany, data.user.role);
        }
        if (data.departmentId) {
          setSelectedDepartmentId(data.departmentId);
        }
        setActiveTabState('departmental');
        showToast(data.message || 'Profile completed! Welcome to your department.', 'success');
        return {
          success: true,
          message: data.message,
          companyId: data.companyId,
          departmentId: data.departmentId
        };
      }
      return {
        success: false,
        code: data.code,
        message: data.message || 'Could not complete profile setup.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Network error completing profile setup.'
      };
    }
  };

  const updateMyProfile = async (payload: {
    fullName?: string;
    phone?: string;
    title?: string;
    bio?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ success: boolean; message?: string }> => {
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    if (!token) {
      return { success: false, message: 'You must be signed in to update your profile.' };
    }
    try {
      const res = await fetch('/api/auth/me/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setCurrentUser(data.user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('alm_nexus_user', JSON.stringify(data.user));
        }
        showToast(data.message || 'Profile saved.', 'success');
        return { success: true, message: data.message };
      }
      return { success: false, message: data.message || 'Could not update profile.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error saving profile.' };
    }
  };

  const updateMyAvailability = async (status: AvailabilityStatus): Promise<boolean> => {
    const token =
      authToken || (typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_token') : null);
    if (!token) return false;
    try {
      const res = await fetch('/api/auth/me/availability', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ availabilityStatus: status })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            availabilityStatus: data.availabilityStatus,
            availabilityUpdatedAt: data.availabilityUpdatedAt
          };
          localStorage.setItem('alm_nexus_user', JSON.stringify(updated));
          return updated;
        });
        showToast(`Status updated to ${status}`, 'info');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Legacy onboard wrapper delegates to createCompany when authenticated
  const onboardNewTenant = async (
    onboardingData: any
  ): Promise<{ success: boolean; message?: string; tenant?: Tenant }> => {
    const res = await createCompany({
      name: onboardingData.companyName || onboardingData.name,
      industry: onboardingData.businessInfo?.industry || onboardingData.industry,
      size: onboardingData.size,
      description: onboardingData.businessInfo?.description || onboardingData.description,
      initialDepartments: onboardingData.initialDepartments
    });
    return {
      success: res.success,
      message: res.message,
      tenant: res.company
    };
  };

  // Individual-first signup OTP request (NO companyName)
  const requestSignupOtp = async (payload: {
    fullName: string;
    email: string;
    password: string;
  }) => {
    try {
      const res = await fetch('/api/auth/signup/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          message: data.message,
          email: data.email,
          cooldownSeconds: data.cooldownSeconds || 30,
          expiresInSeconds: data.expiresInSeconds || 600,
          deliveryProvider: data.deliveryProvider
        };
      }
      return {
        success: false,
        message: data.message || 'Could not send verification code.',
        retryAfterSeconds: data.retryAfterSeconds
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Network error while requesting verification code.'
      };
    }
  };

  const resendSignupOtp = async (email: string) => {
    try {
      const res = await fetch('/api/auth/signup/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return {
          success: true,
          message: data.message,
          cooldownSeconds: data.cooldownSeconds || 30
        };
      }
      return {
        success: false,
        message: data.message || 'Could not resend verification code.',
        retryAfterSeconds: data.retryAfterSeconds
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Network error while resending verification code.'
      };
    }
  };

  const verifySignupOtp = async (email: string, code: string) => {
    try {
      const res = await fetch('/api/auth/signup/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token && data.user) {
        const nextCompanies: Tenant[] = Array.isArray(data.companies) ? data.companies : [];
        const nextInvites: PendingInvitePreview[] = Array.isArray(data.pendingInvites)
          ? data.pendingInvites
          : [];

        clearOutreachTelemetryCache();
        setAuthToken(data.token);
        setCurrentUser(data.user);
        setTenants(nextCompanies);
        setPendingInvites(nextInvites);
        localStorage.setItem('alm_nexus_token', data.token);
        localStorage.setItem('alm_nexus_user', JSON.stringify(data.user));
        localStorage.removeItem('alm_nexus_tenant_id');
        localStorage.removeItem('alm_nexus_dept_id');

        const firstCompany = nextCompanies[0] || null;
        applyActiveCompany(firstCompany, data.user.role);
        if (firstCompany) {
          setActiveTabState(getDefaultTabForCompanyRole(firstCompany.myRole));
        }
        showToast(data.message || `Email verified! Welcome, ${data.user.name}.`, 'success');
        return {
          success: true,
          message: data.message,
          companies: nextCompanies,
          pendingInvites: nextInvites
        };
      }
      return {
        success: false,
        message: data.message || 'Invalid or expired verification code.',
        expired: Boolean(data.expired)
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Network error while verifying code.'
      };
    }
  };

  // Verify existing JWT session strictly via /api/auth/me
  const verifySession = useCallback(
    async (tokenToUse?: string | null) => {
      const token = tokenToUse !== undefined ? tokenToUse : authToken;
      if (!token) {
        setCurrentUser(null);
        setTenants([]);
        applyActiveCompany(null);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setCurrentUser(data.user);
            localStorage.setItem('alm_nexus_user', JSON.stringify(data.user));

            const companyList: Tenant[] = Array.isArray(data.companies) ? data.companies : [];
            const invitesList: PendingInvitePreview[] = Array.isArray(data.pendingInvites)
              ? data.pendingInvites
              : [];
            setTenants(companyList);
            setPendingInvites(invitesList);

            const savedTenantId =
              typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_tenant_id') : null;
            const foundCompany =
              companyList.find((c) => c.id === savedTenantId) || companyList[0] || null;
            applyActiveCompany(foundCompany, data.user.role);

            if (foundCompany) {
              if (data.user.role === 'client_guest') {
                setActiveTabState('portal');
              } else if (foundCompany.myRole === 'company_admin') {
                setActiveTabState((prev) => (prev === 'pipeline' || !prev ? 'overview' : prev));
              } else {
                setActiveTabState((prev) =>
                  ['overview', 'departments', 'pipeline', 'sop', 'vault', 'gmail', 'portal', 'integrations'].includes(prev)
                    ? 'departmental'
                    : prev
                );
              }
            }
            return;
          }
        }
        // Invalid or expired session -> purge cleanly
        setCurrentUser(null);
        setAuthToken(null);
        setTenants([]);
        applyActiveCompany(null);
        localStorage.removeItem('alm_nexus_token');
        localStorage.removeItem('alm_nexus_user');
        localStorage.removeItem('alm_nexus_tenant_id');
        localStorage.removeItem('alm_nexus_dept_id');
      } catch (e) {
        console.warn('Failed to verify session', e);
      }
    },
    [authToken, applyActiveCompany]
  );

  // Firebase Auth listener (strictly optional secondary sync)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setIsFirebaseConnected(true);
        try {
          await syncUserProfile(fbUser, role || 'team_member');
          const prefs = await getUserPreferences(fbUser.uid);
          if (prefs) {
            if (prefs.theme && ['light', 'dark', 'system'].includes(prefs.theme)) {
              setThemeModeState(prefs.theme as ThemeMode);
            }
            if (prefs.currency) setCurrency(prefs.currency as SupportedCurrency);
            if (prefs.language) setLanguage(prefs.language as SupportedLanguage);
          }
        } catch (err) {
          console.warn('Error syncing Firebase preferences:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    verifySession();
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      saveUserPreferences(auth.currentUser.uid, {
        theme: themeMode,
        language,
        currency,
        scaleMode
      }).catch(() => {});
    }
  }, [themeMode, language, currency, scaleMode]);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole === 'client_guest') {
      setActiveTabState('portal');
    }
  };

  const loginWithGoogle = async (): Promise<{
    success: boolean;
    message?: string;
    cancelled?: boolean;
  }> => {
    try {
      const res = await signInWithGoogle();
      if (res.success && res.user) {
        showToast('Google authentication verified.', 'success');
        return { success: true };
      }
      if (res.cancelled) {
        showToast('Google sign-in was cancelled.', 'info');
        return { success: false, message: 'Google sign-in cancelled.', cancelled: true };
      }
      return { success: false, message: res.error || 'Google Sign-In failed.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Authentication error.' };
    }
  };

  const loginWithOAuth = async (): Promise<{ success: boolean; message?: string }> => {
    return {
      success: false,
      message: 'Please sign in with your verified email address and password.'
    };
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    message?: string;
    companies?: Tenant[];
    pendingInvites?: PendingInvitePreview[];
  }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token && data.user) {
        clearOutreachTelemetryCache();
        setAuthToken(data.token);
        setCurrentUser(data.user);
        localStorage.setItem('alm_nexus_token', data.token);
        localStorage.setItem('alm_nexus_user', JSON.stringify(data.user));
        localStorage.removeItem('alm_nexus_dept_id');

        const companyList: Tenant[] = Array.isArray(data.companies) ? data.companies : [];
        const invitesList: PendingInvitePreview[] = Array.isArray(data.pendingInvites)
          ? data.pendingInvites
          : [];
        setTenants(companyList);
        setPendingInvites(invitesList);

        const savedTenantId =
          typeof window !== 'undefined' ? localStorage.getItem('alm_nexus_tenant_id') : null;
        const activeComp =
          companyList.find((c) => c.id === savedTenantId) || companyList[0] || null;
        applyActiveCompany(activeComp, data.user.role);

        if (activeComp) {
          setActiveTabState(
            data.user.role === 'client_guest'
              ? 'portal'
              : getDefaultTabForCompanyRole(activeComp.myRole)
          );
        }

        showToast(`Welcome back, ${data.user.name}!`);
        return {
          success: true,
          companies: companyList,
          pendingInvites: invitesList
        };
      }
      return { success: false, message: data.message || 'Invalid email or password.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Authentication error.' };
    }
  };

  const logout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    signOutFirebase().catch(() => {});
    clearOutreachTelemetryCache();
    localDatabase.clearScopedCaches();
    localDatabase.setActiveScope(null, null);

    setFirebaseUser(null);
    setAuthToken(null);
    setCurrentUser(null);
    setTenants([]);
    setCurrentTenant(null);
    setDepartments([]);
    setSelectedDepartmentId(null);
    setPendingInvites([]);
    setProjects([]);
    setActivityFeed([]);
    setUnreadActivityCount(0);
    setWikiDocs([]);
    setDepartmentalProgress([]);
    setDatabaseStatus(null);
    setRoleState('team_member');
    setActiveTabState('overview');

    if (typeof window !== 'undefined') {
      localStorage.removeItem('alm_nexus_token');
      localStorage.removeItem('alm_nexus_user');
      localStorage.removeItem('alm_nexus_tenant_id');
      localStorage.removeItem('alm_nexus_dept_id');
      localStorage.removeItem('clientops_setup_checklist');
    }

    showToast('Logged out successfully.');
  };

  const switchPersona = async () => {
    showToast('Demo persona switching is disabled in strict multi-tenant mode.', 'info');
  };

  const setAISettings = (newSettings: AISettings) => {
    setAISettingsState(newSettings);
    saveAISettings(newSettings);
  };

  const updateAISettings = (updates: Partial<AISettings>) => {
    setAISettingsState((prev) => {
      const merged = { ...prev, ...updates };
      saveAISettings(merged);
      return merged;
    });
  };

  const t = (key: string): string => {
    const langDict = TRANSLATIONS[language] || TRANSLATIONS.en;
    return langDict[key] || TRANSLATIONS.en[key] || key;
  };

  const markActivityAsRead = (id?: string) => {
    if (id) {
      setActivityFeed((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)));
    } else {
      setActivityFeed((prev) => prev.map((a) => ({ ...a, isRead: true })));
      setUnreadActivityCount(0);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Connection restored: Synchronized with server.', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Offline mode active. Using scoped local cache.', 'warning');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  useEffect(() => {
    if (!firebaseUser || !currentTenant?.id) return;
    const unsubscribe = subscribeProjectsFromFirestore((liveProjects) => {
      if (liveProjects && liveProjects.length > 0) {
        setProjects(liveProjects);
        localDatabase.saveProjects(
          liveProjects,
          `${currentUser?.id || 'u'}::${currentTenant.id}`
        );
      }
    });
    return () => unsubscribe();
  }, [firebaseUser, currentTenant?.id, currentUser?.id]);

  useEffect(() => {
    if (projects.length === 0) return;
    const timer = setTimeout(() => {
      googleSheetsService.triggerAutoSyncIfConfigured(projects);
    }, 2500);
    return () => clearTimeout(timer);
  }, [projects]);

  const updateProject = async (id: string, updates: Partial<ProjectLead>): Promise<boolean> => {
    const tid = currentTenant?.id;
    const token = authToken;
    if (!tid || !token) return false;
    try {
      setProjects((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
        localDatabase.saveProjects(next, `${currentUser?.id || 'u'}::${tid}`);
        return next;
      });
      saveProjectToFirestore({ id, ...updates }).catch(() => {});

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        offlineSyncService.enqueue('project', 'update', id, updates);
        showToast('Offline Mode: Changes saved locally.', 'info');
        return true;
      }

      const res = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tid
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setProjects((prev) => {
          const next = prev.map((p) => (p.id === id ? data.project : p));
          localDatabase.saveProjects(next, `${currentUser?.id || 'u'}::${tid}`);
          return next;
        });
        showToast('Project updated & saved.');
        return true;
      }
      const errData = await res.json().catch(() => ({}));
      showToast(errData.error || errData.message || 'Could not update project.', 'error');
      return false;
    } catch {
      offlineSyncService.enqueue('project', 'update', id, updates);
      showToast('Saved locally.', 'info');
      return true;
    }
  };

  const transferProject = async (id: string): Promise<{ success: boolean; message: string }> => {
    const tid = currentTenant?.id;
    const token = authToken;
    if (!tid || !token) {
      return { success: false, message: 'No active company selected.' };
    }
    try {
      const res = await fetch(`/api/projects/${id}/transfer`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-Id': tid
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProjects((prev) => prev.map((p) => (p.id === id ? data.project : p)));
        saveProjectToFirestore({
          id,
          status: 'transferred',
          domainTransferred: true,
          transferCompletedAt: new Date().toISOString()
        }).catch(() => {});
        showToast('SOP Rule 8 Passed: Website transferred to live client domain and logged!');
        return { success: true, message: data.message };
      }
      showToast(`Transfer Rejected: ${data.error || data.message}`, 'error');
      return { success: false, message: data.error || data.message };
    } catch (e: any) {
      showToast('Network error verifying transfer.', 'error');
      return { success: false, message: e.message };
    }
  };

  const openAIModal = (data?: {
    clientName?: string;
    websiteType?: string;
    channel?: string;
    mode?: string;
  }) => {
    setAiInitialData(data || null);
    setIsAIModalOpen(true);
  };

  const openOutreachWithData = (data: any) => {
    setOutreachInitialData(data);
    setActiveTab('outreach');
  };

  const openClientPortal = (projectId: string) => {
    setActivePortalProjectId(projectId);
    setActiveTab('portal');
  };

  const formatMoney = (amountUSD: number, overrideCurr?: SupportedCurrency): string => {
    const selected = overrideCurr || currency;
    const rates: Record<SupportedCurrency, { rate: number; prefix: string }> = {
      USD: { rate: 1.0, prefix: '$' },
      GBP: { rate: 0.79, prefix: '£' },
      EUR: { rate: 0.92, prefix: '€' },
      AUD: { rate: 1.53, prefix: 'A$' },
      AED: { rate: 3.67, prefix: 'AED ' }
    };
    const cfg = rates[selected] || rates.USD;
    const converted = (Number(amountUSD) || 0) * cfg.rate;
    return `${cfg.prefix}${Math.round(converted).toLocaleString()}`;
  };

  const setScaleMode = async (newMode: AgencyScaleMode) => {
    setScaleModeState(newMode);
    if (!authToken || !currentTenant?.id) return;
    try {
      const res = await fetch('/api/agency/set-scale-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
          'X-Tenant-Id': currentTenant.id
        },
        body: JSON.stringify({ mode: newMode })
      });
      if (res.ok) {
        showToast(`Workspace scale mode set to ${newMode.toUpperCase()}.`);
        await refreshProjects();
      }
    } catch (e) {
      console.warn('Failed to persist scale mode change', e);
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        companyRole,
        currentUser,
        authToken,
        isAuthenticated: !!currentUser,
        firebaseUser,
        isFirebaseConnected,
        loginWithGoogle,
        loginWithOAuth,
        login,
        logout,
        switchPersona,
        isAuthModalOpen,
        setIsAuthModalOpen,
        currentTenant,
        tenants,
        departments,
        selectedDepartmentId,
        setSelectedDepartmentId,
        refreshDepartments,
        switchTenant,
        refreshTenants,
        createCompany,
        updateCompanySettings,
        createDepartment,
        updateDepartmentPermissions,
        deleteDepartment,
        pendingInvites,
        inviteToken,
        setInviteToken,
        invitePreview,
        inviteLoading,
        inviteError,
        acceptInvite,
        completeInviteOnboarding,
        updateMyProfile,
        updateMyAvailability,
        isOnboardingModalOpen,
        setIsOnboardingModalOpen,
        onboardNewTenant,
        requestSignupOtp,
        resendSignupOtp,
        verifySignupOtp,
        isActivityFeedOpen,
        setIsActivityFeedOpen,
        activityFeed,
        unreadActivityCount,
        markActivityAsRead,
        refreshActivityFeed,
        isWikiModalOpen,
        setIsWikiModalOpen,
        wikiDocs,
        refreshWikiDocs,
        departmentalProgress,
        refreshDepartmentalProgress,
        isPlatformHealthModalOpen,
        setIsPlatformHealthModalOpen,
        databaseStatus,
        refreshDatabaseStatus,
        isDatabaseModalOpen,
        setIsDatabaseModalOpen,
        language,
        setLanguage,
        t,
        isDark,
        setIsDark,
        themeMode,
        setThemeMode,
        toggleTheme,
        activeTab,
        setActiveTab,
        activePortalProjectId,
        setActivePortalProjectId,
        openClientPortal,
        unreadInboxCount,
        setUnreadInboxCount,
        projects,
        loadingProjects,
        refreshProjects,
        updateProject,
        transferProject,
        isOnline,
        toastMessage,
        toasts,
        dismissToast,
        showToast,
        isTestModalOpen,
        setIsTestModalOpen,
        isGDPRModalOpen,
        setIsGDPRModalOpen,
        isAIModalOpen,
        setIsAIModalOpen,
        isAISettingsModalOpen,
        setIsAISettingsModalOpen,
        aiSettings,
        setAISettings,
        updateAISettings,
        aiInitialData,
        openAIModal,
        outreachInitialData,
        setOutreachInitialData,
        openOutreachWithData,
        isNewLeadModalOpen,
        setIsNewLeadModalOpen,
        discordExportModalData,
        setDiscordExportModalData,
        automatedTestsPassedCount,
        currency,
        setCurrency,
        formatMoney,
        scaleMode,
        setScaleMode,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        isCreativeStudioOpen,
        setIsCreativeStudioOpen,
        showSetupChecklist,
        dismissSetupChecklist
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
