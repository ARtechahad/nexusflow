import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import {
  getDB,
  saveDB,
  hashPassword,
  verifyPassword,
  DEFAULT_USERS,
  logAuditAction,
  verifyApiToken
} from '../db';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length > 0) {
    return secret.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable is missing in production. App cannot start securely.');
  }
  const generated = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️ [Auth Security Warning] JWT_SECRET is not set. Generated a random secret for this process session.');
  return generated;
}

const JWT_SECRET = getJwtSecret();

export type CompanyRole = 'company_admin' | 'department_head' | 'employee';
export type AvailabilityStatus = 'Available' | 'In a Meeting' | 'Busy' | 'Offline';

export interface CompanyMembership {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyRole;
  departmentIds: string[];
  designation: string;
  joinedAt: string;
}

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  name: string;
  title: string;
  phone?: string;
  bio?: string;
  permissions: string[];
  tenant_id?: string;
  tenantId?: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  requestedCompanyId?: string;
  companyId?: string;
  tenant_id?: string;
  tenantId?: string;
  membership?: CompanyMembership;
  companyRole?: CompanyRole;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export function signToken(payload: Omit<TokenPayload, 'exp'>, expiresInSeconds: number = 86400 * 7): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToVerify = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToVerify)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getUserMemberships(userId: string): CompanyMembership[] {
  if (!userId) return [];
  const db = getDB();
  const list: CompanyMembership[] = Array.isArray(db.companyMemberships) ? db.companyMemberships : [];
  return list.filter((m) => m.userId === userId);
}

export function getUserCompaniesSummary(userId: string, userEmail?: string) {
  const db = getDB();
  const memberships = getUserMemberships(userId);
  const tenants = Array.isArray(db.tenants) ? db.tenants : [];
  const departments = Array.isArray(db.departments) ? db.departments : [];
  const allMemberships = Array.isArray(db.companyMemberships) ? db.companyMemberships : [];
  const invites = Array.isArray(db.companyInvites) ? db.companyInvites : [];

  const companies = memberships
    .map((m) => {
      const company = tenants.find((t: any) => t.id === m.companyId);
      if (!company) return null;
      const companyDepts = departments.filter((d: any) => d.companyId === company.id);
      const companyMembers = allMemberships.filter((cm: any) => cm.companyId === company.id);
      return {
        ...company,
        myRole: m.role,
        myDepartmentIds: Array.isArray(m.departmentIds) ? m.departmentIds : [],
        myDesignation: m.designation || '',
        departmentsCount: companyDepts.length,
        activeMembersCount: companyMembers.length || 1
      };
    })
    .filter(Boolean);

  const normalizedEmail = (userEmail || '').trim().toLowerCase();
  const now = Date.now();
  const pendingInvites = normalizedEmail
    ? invites
        .filter((inv: any) => {
          const isEmailMatch = (inv.email || '').trim().toLowerCase() === normalizedEmail;
          const isPending = inv.status === 'pending';
          const isNotExpired = !inv.expiresAt || new Date(inv.expiresAt).getTime() > now;
          return isEmailMatch && isPending && isNotExpired;
        })
        .map((inv: any) => {
          const company = tenants.find((t: any) => t.id === inv.companyId);
          const dept = departments.find((d: any) => d.id === inv.departmentId);
          return {
            id: inv.id,
            token: inv.token,
            companyId: inv.companyId,
            companyName: company?.name || inv.companyName || 'Company',
            departmentId: inv.departmentId,
            departmentName: dept?.name || inv.departmentName || 'Department',
            role: inv.role,
            designation: inv.designation || '',
            invitedByName: inv.invitedByName || 'Administrator',
            expiresAt: inv.expiresAt,
            createdAt: inv.createdAt
          };
        })
    : [];

  return { companies, memberships, pendingInvites };
}

export function hasDepartmentAccess(membership: CompanyMembership | undefined, departmentId: string): boolean {
  if (!membership) return false;
  if (membership.role === 'company_admin') return true;
  return Array.isArray(membership.departmentIds) && membership.departmentIds.includes(departmentId);
}

const SALES_CLIENT_DEPT_PATTERN = /\b(sales|marketing|client[\s_-]*success|business[\s_-]*development|bd|growth|outreach|revenue|account[\s_-]*management|crm|partnerships)\b/i;

export function isSalesOrClientDepartmentName(name?: string, slug?: string): boolean {
  const combined = `${name || ''} ${slug || ''}`.trim();
  if (!combined) return false;
  return SALES_CLIENT_DEPT_PATTERN.test(combined);
}

export function hasSalesEmailAccess(req: AuthenticatedRequest): boolean {
  if (req.companyRole === 'company_admin') return true;
  if (req.companyRole !== 'department_head' || !req.membership || !req.companyId) return false;
  const db = getDB();
  const deptIds = Array.isArray(req.membership.departmentIds) ? req.membership.departmentIds : [];
  const companyDepts = (db.departments || []).filter(
    (d: any) => d.companyId === req.companyId && deptIds.includes(d.id)
  );
  return companyDepts.some((d: any) => isSalesOrClientDepartmentName(d.name, d.slug));
}

/**
 * Extract bearer/cookie/query JWT token and requested company ID without inventing any default tenant fallback.
 */
export function authenticateToken(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const headerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = req.cookies?.alm_nexus_token || null;
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : null;
  const token = headerToken || cookieToken || queryToken;

  const rawRequested =
    (req.headers['x-company-id'] as string) ||
    (req.headers['x-tenant-id'] as string) ||
    (req.headers['tenant-id'] as string) ||
    (req.query?.companyId as string) ||
    (req.query?.tenantId as string) ||
    (req.query?.tenant_id as string) ||
    undefined;

  const requestedCompanyId =
    rawRequested && rawRequested !== 'undefined' && rawRequested !== 'null' && rawRequested !== 'all'
      ? rawRequested.trim()
      : undefined;

  if (requestedCompanyId) {
    req.requestedCompanyId = requestedCompanyId;
  }

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      const db = getDB();
      const dbUser = (db.users || []).find((u: any) => u.id === decoded.id);
      if (dbUser) {
        req.user = {
          ...decoded,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
          title: dbUser.title || decoded.title,
          phone: dbUser.phone || '',
          bio: dbUser.bio || '',
          permissions: dbUser.permissions || decoded.permissions || []
        };
      } else {
        req.user = decoded;
      }

      const memberships = getUserMemberships(req.user.id);
      const targetCompanyId = requestedCompanyId || decoded.tenant_id || decoded.tenantId;
      const matchedMembership = targetCompanyId
        ? memberships.find((m) => m.companyId === targetCompanyId)
        : memberships[0];

      if (matchedMembership) {
        req.membership = matchedMembership;
        req.companyId = matchedMembership.companyId;
        req.tenant_id = matchedMembership.companyId;
        req.tenantId = matchedMembership.companyId;
        req.companyRole = matchedMembership.role;
      }
    }
  }

  next();
}

/**
 * Require a verified logged-in user (returns 401 if unauthenticated).
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid authenticated session required.'
    });
    return;
  }
  next();
}

/**
 * Resolve & enforce company membership isolation on every tenant-scoped endpoint.
 * Rejects unauthenticated calls (401), users with 0 companies (403 NO_COMPANY_MEMBERSHIP),
 * and any attempt to access a company the user does not belong to (403 Cross-tenant access denied).
 */
export function requireCompanyAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Valid authenticated session required.'
    });
    return;
  }

  const explicitCompanyId =
    (req.params?.companyId as string) ||
    req.requestedCompanyId ||
    (req.body?.companyId as string) ||
    (req.body?.tenantId as string) ||
    (req.body?.tenant_id as string) ||
    undefined;

  const memberships = getUserMemberships(req.user.id);

  if (explicitCompanyId) {
    const cleanId = explicitCompanyId.trim();
    if (cleanId === 'all') {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Cross-company wildcard queries are not permitted.'
      });
      return;
    }
    const found = memberships.find((m) => m.companyId === cleanId);
    if (!found) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have access to the requested company workspace.'
      });
      return;
    }
    req.membership = found;
    req.companyId = found.companyId;
    req.tenant_id = found.companyId;
    req.tenantId = found.companyId;
    req.companyRole = found.role;
    next();
    return;
  }

  const fallbackMembership =
    (req.user.tenant_id ? memberships.find((m) => m.companyId === req.user!.tenant_id) : undefined) ||
    memberships[0];

  if (!fallbackMembership) {
    res.status(403).json({
      success: false,
      code: 'NO_COMPANY_MEMBERSHIP',
      error: 'Forbidden: You do not belong to any company yet. Create or join a company first.'
    });
    return;
  }

  req.membership = fallbackMembership;
  req.companyId = fallbackMembership.companyId;
  req.tenant_id = fallbackMembership.companyId;
  req.tenantId = fallbackMembership.companyId;
  req.companyRole = fallbackMembership.role;
  next();
}

/**
 * Enforce strict company role tier (company_admin / department_head / employee).
 */
export function requireCompanyRole(allowedCompanyRoles: CompanyRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    requireCompanyAccess(req, res, () => {
      if (!req.companyRole || !allowedCompanyRoles.includes(req.companyRole)) {
        return res.status(403).json({
          success: false,
          error: `Forbidden: Access restricted to [${allowedCompanyRoles.join(', ')}]. Current company role: ${req.companyRole || 'none'}`
        });
      }
      return next();
    });
  };
}

/**
 * Enforce Email Hub / Unified Client Inbox access:
 * Permitted for Company Owners and Department Heads of Sales / Marketing / Client Success departments.
 */
export function requireSalesOrAdminEmailAccess() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    requireCompanyAccess(req, res, () => {
      if (req.companyRole === 'company_admin') {
        return next();
      }
      if (req.companyRole === 'department_head' && hasSalesEmailAccess(req)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Email Hub and Client Inbox are restricted to Company Owners and Sales, Marketing, or Client Success Department Heads.'
      });
    });
  };
}

/**
 * Compatibility role guard for legacy routes (enforces membership role + legacy user role strictly).
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Valid Bearer session token required.'
      });
    }

    // Ensure company membership is resolved before checking permissions
    const memberships = getUserMemberships(req.user.id);
    const targetCompanyId = req.requestedCompanyId || req.companyId || req.user.tenant_id || req.user.tenantId;
    const membership = targetCompanyId
      ? memberships.find((m) => m.companyId === targetCompanyId)
      : memberships[0];

    if (req.requestedCompanyId && !membership) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not belong to the requested company workspace.'
      });
    }

    if (membership) {
      req.membership = membership;
      req.companyId = membership.companyId;
      req.tenant_id = membership.companyId;
      req.tenantId = membership.companyId;
      req.companyRole = membership.role;

      if (membership.role === 'company_admin') {
        return next();
      }
      if (membership.role === 'department_head') {
        const headMatches = allowedRoles.some((r) => ['department_head', 'coordinator', 'sales', 'team_member'].includes(r));
        if (headMatches) return next();
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Company Owner/Admin privileges are required for this resource.'
        });
      }
      // employee
      const empMatches = allowedRoles.some((r) => ['employee', 'team_member', 'developer', 'designer'].includes(r));
      if (empMatches) return next();
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Insufficient privileges for your employee account.'
      });
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}].`
    });
  };
}

export function authenticateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['authorization'];
  let rawToken: string | null = null;

  if (typeof apiKeyHeader === 'string') {
    rawToken = apiKeyHeader.startsWith('Bearer ') ? apiKeyHeader.substring(7) : apiKeyHeader;
  } else if (req.query?.api_key && typeof req.query.api_key === 'string') {
    rawToken = req.query.api_key;
  }

  if (!rawToken) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing API key. Provide via X-API-Key header, Authorization: Bearer <token>, or ?api_key=<token>'
    });
    return;
  }

  const check = verifyApiToken(rawToken);
  if (!check.valid || !check.token) {
    res.status(401).json({
      success: false,
      error: check.error || 'Unauthorized: Invalid API token. Access denied.'
    });
    return;
  }

  (req as any).apiToken = check.token;
  if (check.token.tenantId || check.token.companyId) {
    (req as any).companyId = check.token.companyId || check.token.tenantId;
    (req as any).tenant_id = (req as any).companyId;
    (req as any).tenantId = (req as any).companyId;
  }
  next();
}

/**
 * Authenticate login credentials strictly by verified email + password hash (zero PIN/role backdoors).
 */
export function authenticateUser(
  identifier: string,
  passwordPlain: string,
  ipAddress?: string
): { success: boolean; user?: any; token?: string; companies?: any[]; pendingInvites?: any[]; message?: string } {
  const db = getDB();
  const users = db.users || DEFAULT_USERS;
  const cleanEmail = (identifier || '').trim().toLowerCase();

  const user = users.find((u: any) => (u.email || '').trim().toLowerCase() === cleanEmail);

  if (!user) {
    logAuditAction({
      userId: 'anonymous',
      userName: cleanEmail,
      userRole: 'unknown',
      action: 'AUTH_LOGIN_FAILURE',
      entityType: 'auth',
      entityId: cleanEmail,
      details: { attemptedIdentifier: cleanEmail, reason: 'Account not found' },
      ipAddress: ipAddress || '127.0.0.1'
    });
    return { success: false, message: 'Invalid work email or password.' };
  }

  const verification = verifyPassword(passwordPlain, user.passwordHash);
  if (!verification.valid) {
    logAuditAction({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: 'AUTH_LOGIN_FAILURE',
      entityType: 'auth',
      entityId: user.id,
      details: { attemptedIdentifier: cleanEmail, reason: 'Incorrect password' },
      ipAddress: ipAddress || '127.0.0.1'
    });
    return { success: false, message: 'Invalid work email or password.' };
  }

  if (verification.needsUpgrade) {
    try {
      const dbUser = db.users?.find((u: any) => u.id === user.id);
      if (dbUser) {
        dbUser.passwordHash = hashPassword(passwordPlain);
        user.passwordHash = dbUser.passwordHash;
        saveDB(db);
      }
    } catch {
      // Non-fatal
    }
  }

  const { companies, memberships, pendingInvites } = getUserCompaniesSummary(user.id, user.email);
  const primaryCompanyId = memberships[0]?.companyId;

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role || 'team_member',
    name: user.name,
    title: user.title || 'Workspace Member',
    permissions: user.permissions || [],
    tenant_id: primaryCompanyId,
    tenantId: primaryCompanyId
  });

  const sanitizedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'team_member',
    title: user.title || 'Workspace Member',
    phone: user.phone || '',
    bio: user.bio || '',
    avatar: user.avatar || '',
    availabilityStatus: user.availabilityStatus || 'Available',
    availabilityUpdatedAt: user.availabilityUpdatedAt || user.createdAt,
    permissions: user.permissions || [],
    tenantId: primaryCompanyId,
    tenant_id: primaryCompanyId
  };

  logAuditAction({
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'user',
    entityId: user.id,
    details: { email: user.email },
    ipAddress: ipAddress || '127.0.0.1'
  });

  return {
    success: true,
    user: sanitizedUser,
    token,
    companies,
    pendingInvites
  };
}

/**
 * Register a new individual personal account (zero companies auto-created).
 */
export function registerNewUser(
  data: {
    name: string;
    email: string;
    password: string;
    role?: string;
    title?: string;
    phone?: string;
    bio?: string;
    emailVerified?: boolean;
  },
  ipAddress?: string
): { success: boolean; user?: any; token?: string; companies?: any[]; pendingInvites?: any[]; message?: string } {
  const db = getDB();
  if (!Array.isArray(db.users)) db.users = [...DEFAULT_USERS];

  const normalizedEmail = data.email.trim().toLowerCase();
  const existing = db.users.find((u: any) => (u.email || '').toLowerCase() === normalizedEmail);
  if (existing) {
    return { success: false, message: 'An account with this email address already exists.' };
  }

  const now = new Date().toISOString();
  const newUser = {
    id: `user-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    name: data.name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(data.password),
    emailVerified: Boolean(data.emailVerified ?? true),
    emailVerifiedAt: now,
    role: data.role || 'team_member',
    title: data.title?.trim() || 'Workspace Member',
    phone: data.phone?.trim() || '',
    bio: data.bio?.trim() || '',
    avatar: '',
    availabilityStatus: 'Available' as AvailabilityStatus,
    availabilityUpdatedAt: now,
    permissions: ['workspace:member'],
    createdAt: now
  };

  db.users.push(newUser);
  saveDB(db);

  logAuditAction({
    userId: newUser.id,
    userName: newUser.name,
    userRole: newUser.role,
    action: 'USER_REGISTERED',
    entityType: 'user',
    entityId: newUser.id,
    details: { email: newUser.email },
    ipAddress: ipAddress || '127.0.0.1'
  });

  const { companies, pendingInvites } = getUserCompaniesSummary(newUser.id, newUser.email);

  const token = signToken({
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
    name: newUser.name,
    title: newUser.title,
    permissions: newUser.permissions
  });

  const sanitized = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    title: newUser.title,
    phone: newUser.phone,
    bio: newUser.bio,
    avatar: newUser.avatar,
    availabilityStatus: newUser.availabilityStatus,
    availabilityUpdatedAt: newUser.availabilityUpdatedAt,
    permissions: newUser.permissions
  };

  return {
    success: true,
    user: sanitized,
    token,
    companies,
    pendingInvites,
    message: 'Personal account created successfully.'
  };
}
