import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getDB,
  saveDB,
  hashPassword,
  logAuditAction,
  DEFAULT_USERS
} from '../db';
import {
  authenticateUser,
  registerNewUser,
  verifyToken,
  signToken,
  requireAuth,
  requireCompanyAccess,
  getUserCompaniesSummary,
  getUserMemberships,
  AuthenticatedRequest,
  AvailabilityStatus
} from '../middlewares/auth';
import { resendService } from '../services/resendService';
import { realtimeEngine } from '../services/realtimeEngine';
import {
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  normalizeEmail,
  generateSixDigitOtp,
  hashOtp,
  verifyOtpHash,
  getOtpRecord,
  saveOtpRecord,
  deleteOtpRecord,
  dispatchOtpEmail
} from '../services/emailOtpService';

const router = Router();
const VALID_AVAILABILITY: AvailabilityStatus[] = ['Available', 'In a Meeting', 'Busy', 'Offline'];

// Login strictly by verified email + password
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email address and password are required.' });
  }

  const result = authenticateUser(email, password, req.ip);
  if (!result.success) {
    return res.status(401).json(result);
  }

  if (result.token) {
    res.cookie('alm_nexus_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }

  return res.json({
    ...result,
    dashboardRedirect: '/'
  });
});

// Logout (Clear Session Cookie)
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('alm_nexus_token', {
    httpOnly: true,
    sameSite: 'lax'
  });
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Direct registration endpoint (creates individual user only, zero companies auto-created)
router.post('/register', (req: Request, res: Response) => {
  const { name, fullName, email, password, title } = req.body || {};
  const resolvedName = (fullName || name || '').trim();
  if (!resolvedName || !email || !password) {
    return res.status(400).json({ success: false, message: 'Full name, email, and password are required.' });
  }

  const result = registerNewUser({ name: resolvedName, email, password, title }, req.ip);
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// ==========================================
// INDIVIDUAL ACCOUNT EMAIL OTP VERIFICATION FLOW
// ==========================================

// 1. Request 6-digit OTP for individual registration (Full Name, Email, Password ONLY)
router.post('/signup/request-otp', async (req: Request, res: Response) => {
  try {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = normalizeEmail(req.body?.email || '');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Email Address, and Password are required.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.'
      });
    }

    const db = getDB();
    const existingUsers = Array.isArray(db.users) ? db.users : DEFAULT_USERS;
    const alreadyExists = existingUsers.some((u: any) => normalizeEmail(u.email) === email);
    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please sign in instead.'
      });
    }

    const existingOtp = await getOtpRecord(email);
    if (existingOtp) {
      const elapsedMs = Date.now() - new Date(existingOtp.lastSentAt).getTime();
      if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.max(1, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000));
        return res.status(429).json({
          success: false,
          retryAfterSeconds,
          message: `Verification code already sent. Please wait ${retryAfterSeconds}s before requesting another.`
        });
      }
    }

    const otpCode = generateSixDigitOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS).toISOString();
    const passwordHash = hashPassword(password);

    await saveOtpRecord({
      email,
      otpHash: hashOtp(email, otpCode),
      pendingData: {
        fullName,
        email,
        passwordHash
      },
      attempts: 0,
      expiresAt,
      lastSentAt: now.toISOString(),
      createdAt: now.toISOString()
    });

    const emailResult = await dispatchOtpEmail({
      email,
      fullName,
      otpCode
    });

    if (resendService.isConfigured() && !emailResult.success) {
      await deleteOtpRecord(email);
      return res.status(502).json({
        success: false,
        message: `Could not send verification email: ${emailResult.error || 'Email delivery failed. Please check your email address and try again.'}`
      });
    }

    logAuditAction({
      userId: 'pending-signup',
      userName: fullName,
      userRole: 'team_member',
      action: 'EMAIL_OTP_REQUESTED',
      entityType: 'auth',
      entityId: email,
      details: { email, deliveryProvider: emailResult.provider },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({
      success: true,
      requiresVerification: true,
      email,
      expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
      cooldownSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
      deliveryProvider: emailResult.provider,
      message:
        emailResult.provider === 'resend'
          ? `We sent a 6-digit verification code to ${email}.`
          : `Verification code created for ${email}.`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unable to initiate email verification.'
    });
  }
});

// 2. Resend 6-digit OTP (enforces 30-second cooldown)
router.post('/signup/resend-otp', async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email || '');
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.'
      });
    }

    const existingOtp = await getOtpRecord(email);
    if (!existingOtp) {
      return res.status(404).json({
        success: false,
        message: 'No pending registration found for this email. Please submit Create Account again.'
      });
    }

    const elapsedMs = Date.now() - new Date(existingOtp.lastSentAt).getTime();
    if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000));
      return res.status(429).json({
        success: false,
        retryAfterSeconds,
        message: `Please wait ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} before requesting a new code.`
      });
    }

    const freshOtp = generateSixDigitOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS).toISOString();

    await saveOtpRecord({
      ...existingOtp,
      otpHash: hashOtp(email, freshOtp),
      attempts: 0,
      expiresAt,
      lastSentAt: now.toISOString()
    });

    const emailResult = await dispatchOtpEmail({
      email,
      fullName: existingOtp.pendingData.fullName,
      otpCode: freshOtp
    });

    if (resendService.isConfigured() && !emailResult.success) {
      return res.status(502).json({
        success: false,
        message: `Could not resend verification email: ${emailResult.error || 'Email delivery failed.'}`
      });
    }

    logAuditAction({
      userId: 'pending-signup',
      userName: existingOtp.pendingData.fullName,
      userRole: 'team_member',
      action: 'EMAIL_OTP_RESENT',
      entityType: 'auth',
      entityId: email,
      details: { email, deliveryProvider: emailResult.provider },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({
      success: true,
      email,
      expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
      cooldownSeconds: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
      deliveryProvider: emailResult.provider,
      message:
        emailResult.provider === 'resend'
          ? `A new 6-digit verification code was sent to ${email}.`
          : `A new verification code was generated for ${email}.`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unable to resend verification code.'
    });
  }
});

// 3. Verify 6-digit OTP -> Activate Individual Personal Account (0 auto-created companies) -> Issue JWT
router.post('/signup/verify-otp', async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email || '');
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\s+/g, '') : '';

    if (!email || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter the complete 6-digit verification code.'
      });
    }

    const record = await getOtpRecord(email);
    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'Verification session not found or already used. Please create your account again.'
      });
    }

    if (Date.now() > new Date(record.expiresAt).getTime()) {
      return res.status(400).json({
        success: false,
        expired: true,
        message: 'This verification code has expired (10-minute limit). Please click "Resend Code".'
      });
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: 'Too many invalid attempts. Please click "Resend Code" to receive a new code.'
      });
    }

    const isMatch = verifyOtpHash(email, code, record.otpHash);
    if (!isMatch) {
      const nextAttempts = record.attempts + 1;
      await saveOtpRecord({
        ...record,
        attempts: nextAttempts
      });

      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - nextAttempts);
      return res.status(400).json({
        success: false,
        message:
          remaining > 0
            ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : 'Too many invalid attempts. Please click "Resend Code" to receive a new code.'
      });
    }

    await deleteOtpRecord(email);

    const db = getDB();
    const users = Array.isArray(db.users) ? db.users : DEFAULT_USERS;
    const duplicate = users.find((u: any) => normalizeEmail(u.email) === email);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please sign in.'
      });
    }

    const { fullName, passwordHash } = record.pendingData;
    const now = new Date().toISOString();
    const newUserId = `user-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

    const registeredUser = {
      id: newUserId,
      name: fullName,
      email,
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: now,
      role: 'team_member',
      title: 'Personal Account',
      avatar: '',
      availabilityStatus: 'Available' as AvailabilityStatus,
      availabilityUpdatedAt: now,
      permissions: ['workspace:member'],
      createdAt: now
    };

    db.users = [registeredUser, ...users];
    saveDB(db);

    const { companies, pendingInvites } = getUserCompaniesSummary(registeredUser.id, registeredUser.email);

    const token = signToken({
      id: registeredUser.id,
      email: registeredUser.email,
      role: registeredUser.role,
      name: registeredUser.name,
      title: registeredUser.title,
      permissions: registeredUser.permissions
    });

    res.cookie('alm_nexus_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logAuditAction({
      userId: registeredUser.id,
      userName: registeredUser.name,
      userRole: registeredUser.role,
      action: 'EMAIL_OTP_VERIFIED',
      entityType: 'user',
      entityId: registeredUser.id,
      details: { email },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({
      success: true,
      message: `Email verified! Welcome to ClientOps, ${fullName}.`,
      user: {
        id: registeredUser.id,
        name: registeredUser.name,
        email: registeredUser.email,
        role: registeredUser.role,
        title: registeredUser.title,
        avatar: registeredUser.avatar,
        availabilityStatus: registeredUser.availabilityStatus,
        availabilityUpdatedAt: registeredUser.availabilityUpdatedAt,
        permissions: registeredUser.permissions
      },
      companies,
      pendingInvites,
      token
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unable to verify email code.'
    });
  }
});

// Forgot Password Recovery Dispatch
router.post('/forgot-password', (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid email address.'
    });
  }

  return res.json({
    success: true,
    message: `If an account exists for ${email}, password recovery instructions have been dispatched.`
  });
});

// Current Authenticated User Profile + Strict Company Memberships + Pending Invites
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  let token: string | null = null;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies?.alm_nexus_token) {
    token = req.cookies.alm_nexus_token;
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No active authenticated session found.'
    });
  }

  const verified = verifyToken(token);
  if (!verified) {
    return res.status(401).json({
      success: false,
      message: 'Session expired or invalid.'
    });
  }

  const db = getDB();
  const dbUser = (db.users || []).find((u: any) => u.id === verified.id);
  if (!dbUser) {
    return res.status(401).json({
      success: false,
      message: 'User account no longer exists.'
    });
  }

  const { companies, memberships, pendingInvites } = getUserCompaniesSummary(dbUser.id, dbUser.email);

  return res.json({
    success: true,
    user: {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      title: dbUser.title || 'Workspace Member',
      avatar: dbUser.avatar || '',
      availabilityStatus: dbUser.availabilityStatus || 'Available',
      availabilityUpdatedAt: dbUser.availabilityUpdatedAt || dbUser.createdAt,
      permissions: dbUser.permissions || []
    },
    companies,
    memberships,
    pendingInvites
  });
});

// Update own availability status (Available, In a Meeting, Busy, Offline)
router.patch('/me/availability', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const status = req.body?.availabilityStatus as AvailabilityStatus;
  if (!VALID_AVAILABILITY.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid availability status. Allowed: ${VALID_AVAILABILITY.join(', ')}`
    });
  }

  const db = getDB();
  const dbUser = (db.users || []).find((u: any) => u.id === req.user!.id);
  if (!dbUser) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const now = new Date().toISOString();
  dbUser.availabilityStatus = status;
  dbUser.availabilityUpdatedAt = now;
  saveDB(db);

  // Broadcast live availability update strictly to companies/departments this user belongs to
  const memberships = getUserMemberships(dbUser.id);
  for (const m of memberships) {
    if (Array.isArray(m.departmentIds) && m.departmentIds.length > 0) {
      for (const deptId of m.departmentIds) {
        realtimeEngine.broadcastToDepartment(m.companyId, deptId, 'availability:updated', {
          companyId: m.companyId,
          departmentId: deptId,
          userId: dbUser.id,
          name: dbUser.name,
          availabilityStatus: status,
          availabilityUpdatedAt: now
        });
      }
    } else {
      realtimeEngine.broadcastToCompany(m.companyId, 'availability:updated', {
        companyId: m.companyId,
        userId: dbUser.id,
        name: dbUser.name,
        availabilityStatus: status,
        availabilityUpdatedAt: now
      });
    }
  }

  return res.json({
    success: true,
    availabilityStatus: status,
    availabilityUpdatedAt: now
  });
});

// Company-scoped Users Directory (strictly returns only members of req.companyId)
router.get('/users', requireCompanyAccess, (req: AuthenticatedRequest, res: Response) => {
  const db = getDB();
  const companyId = req.companyId!;
  const memberships = (db.companyMemberships || []).filter((m: any) => m.companyId === companyId);

  // If department_head or employee, filter users to only those sharing at least one department
  const scopedMemberships =
    req.companyRole === 'company_admin'
      ? memberships
      : memberships.filter((m: any) =>
          (m.departmentIds || []).some((dId: string) => (req.membership?.departmentIds || []).includes(dId))
        );

  const memberIds = new Set(scopedMemberships.map((m: any) => m.userId));
  const users = (db.users || [])
    .filter((u: any) => memberIds.has(u.id))
    .map((u: any) => {
      const m = scopedMemberships.find((mem: any) => mem.userId === u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: m?.role || 'employee',
        designation: m?.designation || '',
        departmentIds: m?.departmentIds || [],
        title: m?.designation || u.title,
        avatar: u.avatar || '',
        availabilityStatus: u.availabilityStatus || 'Available',
        availabilityUpdatedAt: u.availabilityUpdatedAt || u.createdAt
      };
    });

  return res.json({ success: true, users });
});

export default router;
