import { CompanyRole, Department } from '../types';

const SALES_CLIENT_DEPT_PATTERN = /\b(sales|marketing|client[\s_-]*success|business[\s_-]*development|bd|growth|outreach|revenue|account[\s_-]*management|crm|partnerships)\b/i;

/**
 * Returns true if the department is a Sales, Marketing, or Client Success department
 * authorized to use Email Hub and Unified Client Inbox tools.
 */
export function isSalesOrClientDepartment(
  dept?: Pick<Department, 'name' | 'slug'> | null
): boolean {
  if (!dept) return false;
  const combined = `${dept.name || ''} ${dept.slug || ''}`.trim();
  if (!combined) return false;
  return SALES_CLIENT_DEPT_PATTERN.test(combined);
}

/**
 * Determines whether the active user/role can view Email Hub & Unified Client Inbox modules.
 * - Company Owners: always allowed
 * - Department Heads: allowed ONLY when operating in a Sales / Marketing / Client Success department
 * - Employees: never allowed
 */
export function canAccessEmailModules(
  companyRole: CompanyRole | null | undefined,
  activeDept?: Pick<Department, 'name' | 'slug'> | null,
  allUserDepartments?: Array<Pick<Department, 'name' | 'slug'>>
): boolean {
  if (companyRole === 'company_admin') return true;
  if (companyRole !== 'department_head') return false;
  if (activeDept) {
    return isSalesOrClientDepartment(activeDept);
  }
  if (Array.isArray(allUserDepartments) && allUserDepartments.length > 0) {
    return allUserDepartments.some((d) => isSalesOrClientDepartment(d));
  }
  return false;
}
