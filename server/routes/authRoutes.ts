import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { readDB, DEFAULT_USERS } from '../db';
import { authenticateUser, registerNewUser, verifyToken, signToken } from '../middlewares/auth';

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
  const dashboardRedirect = userRole === 'client_guest' ? '/portal' : '/profile';

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
    dashboardRedirect: user.role === 'client_guest' ? '/portal' : '/profile'
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

// Register
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
