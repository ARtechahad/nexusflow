import { CompanyRole, Department, DepartmentModuleKey } from '../types';

export interface DepartmentModuleDefinition {
  key: DepartmentModuleKey;
  label: string;
  description: string;
}

export const DEPARTMENT_MODULE_DEFINITIONS: DepartmentModuleDefinition[] = [
  {
    key: 'operations',
    label: 'Department Operations',
    description: 'Team roster, availability status, and department task tracking'
  },
  {
    key: 'chat',
    label: 'Department Chat',
    description: 'Private department messaging room and daily work updates'
  },
  {
    key: 'email_hub',
    label: 'Enable Email Outreach',
    description: 'Connect business SMTP / Resend email accounts and launch real outreach campaigns'
  },
  {
    key: 'client_inbox',
    label: 'Unified Client Inbox',
    description: 'Shared client reply threads and multi-channel inbox'
  },
  {
    key: 'financials',
    label: 'Financials & Ledgers',
    description: 'Commission ledger, payout schedules, and revenue analytics'
  }
];

export const DEFAULT_DEPARTMENT_MODULES: DepartmentModuleKey[] = ['operations', 'chat'];

export function getDepartmentAllowedModules(
  dept?: Pick<Department, 'allowed_modules'> | null
): DepartmentModuleKey[] {
  if (!dept || !Array.isArray(dept.allowed_modules)) {
    return [...DEFAULT_DEPARTMENT_MODULES];
  }
  return dept.allowed_modules;
}

/**
 * Checks whether the current user/role can access a specific module key
 * based on the active department's `allowed_modules` configuration.
 * - Company Owners (`company_admin`): always full access across all modules.
 * - Department Heads & Employees: strictly governed by `allowed_modules`.
 */
export function hasModuleAccess(
  companyRole: CompanyRole | null | undefined,
  moduleKey: DepartmentModuleKey,
  activeDept?: Pick<Department, 'allowed_modules'> | null,
  allUserDepartments?: Array<Pick<Department, 'allowed_modules'>>
): boolean {
  if (companyRole === 'company_admin') return true;
  if (!companyRole) return false;
  if (activeDept) {
    return getDepartmentAllowedModules(activeDept).includes(moduleKey);
  }
  if (Array.isArray(allUserDepartments) && allUserDepartments.length > 0) {
    return allUserDepartments.some((d) => getDepartmentAllowedModules(d).includes(moduleKey));
  }
  return false;
}

/**
 * Determines whether Email Outreach should appear in the sidebar for the active workspace:
 * - Off by default for new companies.
 * - Shown for Company Owner ONLY if `tenant.settings.enableEmailOutreach === true` OR any department has `email_hub` checked.
 * - Shown for Department Heads / Employees ONLY if their active department has `email_hub` checked.
 */
export function isEmailOutreachVisible(
  companyRole: CompanyRole | null | undefined,
  companySettings?: { enableEmailOutreach?: boolean } | null,
  activeDept?: Pick<Department, 'allowed_modules'> | null,
  allDepartments?: Array<Pick<Department, 'allowed_modules'>>
): boolean {
  if (companyRole === 'company_admin') {
    if (companySettings?.enableEmailOutreach) return true;
    return Array.isArray(allDepartments)
      ? allDepartments.some((d) => getDepartmentAllowedModules(d).includes('email_hub'))
      : false;
  }
  return hasModuleAccess(companyRole, 'email_hub', activeDept, allDepartments);
}

/**
 * Convenience helper for Email Outreach or Client Inbox access checks.
 */
export function canAccessEmailModules(
  companyRole: CompanyRole | null | undefined,
  activeDept?: Pick<Department, 'allowed_modules'> | null,
  allUserDepartments?: Array<Pick<Department, 'allowed_modules'>>
): boolean {
  return (
    hasModuleAccess(companyRole, 'email_hub', activeDept, allUserDepartments) ||
    hasModuleAccess(companyRole, 'client_inbox', activeDept, allUserDepartments)
  );
}
