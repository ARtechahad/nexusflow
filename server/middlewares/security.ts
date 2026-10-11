import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { RequestHandler } from 'express';

// Standard dynamic CORS Whitelist for Multi-Tenant Domains & AI Studio Sandbox
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://clientops.agency',
  'https://alm-nexus.dev'
];

export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: false, // Disabled for Vite preview & iframe embedding in AI Studio
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
});

export const dynamicCors: RequestHandler = cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests, mobile webview, AI Studio previews, and whitelisted origins
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.run.app') || origin.endsWith('.railway.app') || origin.endsWith('.dev')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive in preview sandbox
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'Tenant-Id', 'X-API-Key', 'X-Correlation-ID', 'X-Requested-With']
});

export const globalRateLimiter: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allow 1000 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    default: false
  },
  keyGenerator: (req) => {
    const rawForwarded = req.headers['x-forwarded-for'];
    if (typeof rawForwarded === 'string' && rawForwarded.length > 0) {
      return rawForwarded.split(',')[0].trim();
    }
    return req.ip || '127.0.0.1';
  },
  message: {
    success: false,
    error: 'Rate limit exceeded: Too many requests from this IP address. Please try again after 15 minutes.',
    meta: { retryAfterSeconds: 900 }
  }
});

export const apiRateLimiter: RequestHandler = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute per IP for high-frequency dashboard polling
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    default: false
  },
  keyGenerator: (req) => {
    const rawForwarded = req.headers['x-forwarded-for'];
    if (typeof rawForwarded === 'string' && rawForwarded.length > 0) {
      return rawForwarded.split(',')[0].trim();
    }
    return req.ip || '127.0.0.1';
  },
  message: {
    success: false,
    error: 'API Rate limit exceeded: Please slow down your requests.',
    meta: { retryAfterSeconds: 60 }
  }
});

export const compressionMiddleware: RequestHandler = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6
});

export const parseCookies: RequestHandler = cookieParser(process.env.COOKIE_SECRET || 'alm_nexus_cookie_secret_2026');
