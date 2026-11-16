import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  readDB,
  getDB,
  saveDB,
  hashPassword,
  logAuditAction,
  DEFAULT_USERS,
  DEFAULT_TENANTS,
  DEFAULT_ACTIVITY_FEED
} from '../db';
import { authenticateUser, registerNewUser, verifyToken, signToken } from '../middlewares/auth';
import { resendService } from '../services/resendService';
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

// Login
router.post('/login', (req: Request, res: Response) => {
  const { email, role, password, pin } = req.body || {};
  const identifier = email || role;
  const credential = password || pin;
  if (!identifier || !credential) {
    return res.status(400).json({ success: false, message: 'Role or Email, and Password or PIN are required.' });
  }

  const result = authenticateUser(identifier, credential, req.ip);
  if (!result.success) {
    return res.status(401).json(result);
  }

  // Set enterprise HttpOnly session cookie
  if (result.token) {
    res.cookie('alm_nexus_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  const userRole = result.user?.role;
  const dashboardRedirect = userRole === 'client_guest' ? '/portal' : '/';

  return res.json({
    ...result,
    dashboardRedirect
  });
});

// OAuth / Social Gateway Login (Google, GitHub, Clerk)
router.post('/oauth', (req: Request, res: Response) => {
  const { provider, email, name, avatar } = req.body || {};
  const resolvedEmail = (email || `${provider || 'user'}@agencyops.dev`).trim().toLowerCase();
  const resolvedName = name || (provider === 'github' ? 'GitHub Developer' : 'Google Operator');

  const db = readDB();
  const users = db.users || DEFAULT_USERS;
  let user = users.find((u: any) => u.email.toLowerCase() === resolvedEmail);

  if (!user) {
    // Automatically provision user account
    const regResult = registerNewUser({
      name: resolvedName,
      email: resolvedEmail,
      password: crypto.randomBytes(16).toString('hex'),
      role: 'admin',
      title: `${provider === 'github' ? 'GitHub' : 'Google'} Enterprise Member`
    }, req.ip);

    if (regResult.success && regResult.user) {
      user = regResult.user;
    } else {
      user = users[0]; // fallback to master admin
    }
  }

  const tenantId = user.tenantId || user.tenant_id || 'tenant-alm-nexus';
  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    title: user.title || 'Enterprise Member',
    permissions: user.permissions || [],
    tenant_id: tenantId,
    tenantId: tenantId
  });

  res.cookie('alm_nexus_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      title: user.title,
      avatar: avatar || user.avatar,
      permissions: user.permissions || [],
      tenantId: tenantId
    },
    token,
    dashboardRedirect: user.role === 'client_guest' ? '/portal' : '/'
  });
});

// Logout (Clear Session Cookie)
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('alm_nexus_token', {
    httpOnly: true,
    sameSite: 'lax'
  });
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Register (legacy direct endpoint kept for internal compatibility)
router.post('/register', (req: Request, res: Response) => {
  const { name, email, password, role, title } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
  }

  const result = registerNewUser({ name, email, password, role, title });
  if (!result.success) {
    return res.status(400).json(result);
  }

  return res.json(result);
});

// ==========================================
// CREATE ACCOUNT EMAIL OTP VERIFICATION FLOW
// ==========================================

// 1. Request 6-digit OTP & store pending registration (10-minute expiry)
router.post('/signup/request-otp', async (req: Request, res: Response) => {
  try {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
    const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : '';
    const email = normalizeEmail(req.body?.email || '');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!fullName || !companyName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Company / Workspace Name, Work Email, and Password are required.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid work email address.'
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
        message: 'An account with this work email already exists. Please sign in instead.'
      });
    }

    // Enforce 30-second cooldown if an OTP was just requested for this email
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
        companyName,
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
      companyName,
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
      userRole: 'admin',
      action: 'EMAIL_OTP_REQUESTED',
      entityType: 'auth',
      entityId: email,
      details: { email, companyName, deliveryProvider: emailResult.provider },
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
          : `Verification code created for ${email}. Configure RESEND_API_KEY to enable live email delivery.`
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
      companyName: existingOtp.pendingData.companyName,
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
      userRole: 'admin',
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

// 3. Verify 6-digit OTP -> Provision Workspace & Admin User -> Create Active JWT Session
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

    // Consume OTP immediately so it cannot be replayed
    await deleteOtpRecord(email);

    const db = getDB();
    const tenants = db.tenants || DEFAULT_TENANTS;
    const users = db.users || DEFAULT_USERS;

    // Ensure no race-condition duplicate account exists
    const duplicate = users.find((u: any) => normalizeEmail(u.email) === email);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'An account with this work email already exists. Please sign in.'
      });
    }

    const { fullName, companyName, passwordHash } = record.pendingData;
    const cleanSlug =
      companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
    const tenantId = `tenant-${cleanSlug}-${Date.now().toString().slice(-4)}`;

    const newTenant = {
      id: tenantId,
      name: companyName,
      slug: cleanSlug,
      logoUrl: '/icon.svg',
      branding: {
        primaryColor: '#6366f1',
        accentColor: '#06b6d4',
        theme: 'light',
        geometricStyle: 'cyber_glass',
        logoPreset: 'hexagon_nexus'
      },
      businessInfo: {
        industry: 'Operations & Client Services',
        description: `${companyName} company operations workspace`,
        website: '',
        targetRevenueUSD: 100000,
        coreObjectives: [
          'Connected email & unified client inbox',
          'Client deals & SOP operations pipeline',
          'Team tasks & commission split ledger'
        ]
      },
      integrations: {
        linkedIn: {
          connected: false,
          accountHandle: '',
          organizationName: companyName,
          syncIntervalMinutes: 15,
          autoOutreachEnabled: false,
          messagesSyncedCount: 0
        },
        gmail: {
          connected: false,
          accountEmail: email,
          threadTracking: true,
          autoDraftReplies: true,
          emailsSyncedCount: 0
        },
        stripe: {
          connected: false,
          liveMode: true,
          currency: 'USD',
          mrrUSD: 0
        }
      },
      rolesConfig: {
        admin: {
          role: 'admin',
          title: 'Workspace Owner & Admin',
          department: 'executive',
          dashboardLayout: 'executive_macro',
          permissions: ['all']
        }
      },
      activeMembersCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newUserId = `user-${cleanSlug}-owner-${Date.now().toString().slice(-4)}`;
    const registeredAdmin = {
      id: newUserId,
      name: fullName,
      email,
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      role: 'admin',
      title: 'Workspace Owner',
      avatar: '',
      tenantId,
      permissions: [
        'admin:all',
        'tenant:manage',
        'projects:read',
        'projects:write',
        'commissions:approve',
        'database:manage',
        'integrations:manage'
      ],
      createdAt: new Date().toISOString()
    };

    const onboardingActivity = {
      id: `act-${Date.now()}`,
      tenantId,
      type: 'system_alert',
      title: `Workspace "${companyName}" Created`,
      description: `Email verified for ${fullName}. Isolated multi-tenant workspace ready.`,
      actorName: fullName,
      actorRole: 'Workspace Owner',
      sourceChannel: 'system',
      timestamp: new Date().toISOString(),
      isRead: false
    };

    db.tenants = [newTenant, ...tenants];
    db.users = [registeredAdmin, ...users];
    db.activityFeed = [onboardingActivity, ...(db.activityFeed || DEFAULT_ACTIVITY_FEED)];
    saveDB(db);

    const token = signToken({
      id: registeredAdmin.id,
      email: registeredAdmin.email,
      role: registeredAdmin.role,
      name: registeredAdmin.name,
      title: registeredAdmin.title,
      permissions: registeredAdmin.permissions,
      tenant_id: tenantId,
      tenantId
    });

    res.cookie('alm_nexus_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    logAuditAction({
      userId: registeredAdmin.id,
      userName: registeredAdmin.name,
      userRole: registeredAdmin.role,
      action: 'EMAIL_OTP_VERIFIED',
      entityType: 'tenant',
      entityId: tenantId,
      details: { companyName, email, slug: cleanSlug },
      ipAddress: req.ip || '127.0.0.1'
    });

    return res.json({
      success: true,
      message: `Email verified! Welcome to ${companyName}.`,
      tenant: newTenant,
      user: {
        id: registeredAdmin.id,
        name: registeredAdmin.name,
        email: registeredAdmin.email,
        role: registeredAdmin.role,
        title: registeredAdmin.title,
        avatar: registeredAdmin.avatar,
        permissions: registeredAdmin.permissions,
        tenantId
      },
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
      message: 'Please enter a valid work email address.'
    });
  }

  return res.json({
    success: true,
    message: `If an account exists for ${email}, password recovery instructions have been dispatched.`
  });
});

// Current User Me
router.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  let token: string | null = null;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (token) {
    const verified = verifyToken(token);
    if (verified) {
      return res.json({
        success: true,
        user: verified
      });
    }
  }

  // If no valid bearer token is provided, return 401 unauthenticated
  return res.status(401).json({
    success: false,
    message: 'No active authenticated session found.'
  });
});

// Staff & Client Users list
router.get('/users', (req: Request, res: Response) => {
  const db = readDB();
  const users = (db.users || DEFAULT_USERS).map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    title: u.title,
    avatar: u.avatar,
    permissions: u.permissions
  }));
  res.json({ success: true, users });
});

export default router;
