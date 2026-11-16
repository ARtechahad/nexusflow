import crypto from 'node:crypto';
import { getDB, saveDB, getPgPool } from '../db';
import { getNeonPool } from './db';
import { resendService, DEFAULT_EMAIL_FROM } from './resendService';
import { logger } from '../logger';

export const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
export const OTP_MAX_ATTEMPTS = 5;

export interface PendingSignupData {
  fullName: string;
  companyName: string;
  email: string;
  passwordHash: string;
}

export interface EmailOtpRecord {
  email: string;
  otpHash: string;
  pendingData: PendingSignupData;
  attempts: number;
  expiresAt: string;
  lastSentAt: string;
  createdAt: string;
}

let pgOtpTableReady = false;

function getActivePool() {
  return getNeonPool() || getPgPool();
}

async function ensurePgOtpTable(): Promise<void> {
  const pool = getActivePool();
  if (!pool || pgOtpTableReady) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_otps (
        email VARCHAR(255) PRIMARY KEY,
        otp_hash VARCHAR(128) NOT NULL,
        pending_data JSONB NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    pgOtpTableReady = true;
  } catch (err: any) {
    logger.warn(`[EmailOTP] Could not verify PostgreSQL OTP table: ${err?.message}`);
  }
}

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export function generateSixDigitOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(email: string, code: string): string {
  const normalized = normalizeEmail(email);
  const cleanCode = (code || '').trim();
  const secret = process.env.JWT_SECRET || 'clientops-otp-salt-v1';
  return crypto
    .createHmac('sha256', secret)
    .update(`${normalized}:${cleanCode}`)
    .digest('hex');
}

export function verifyOtpHash(email: string, code: string, storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const candidate = hashOtp(email, code);
  try {
    const bufA = Buffer.from(candidate, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function getOtpRecord(email: string): Promise<EmailOtpRecord | null> {
  const normalized = normalizeEmail(email);
  const pool = getActivePool();

  if (pool) {
    try {
      await ensurePgOtpTable();
      const res = await pool.query(
        `SELECT email, otp_hash, pending_data, attempts, expires_at, last_sent_at, created_at
         FROM email_verification_otps
         WHERE email = $1
         LIMIT 1`,
        [normalized]
      );
      if (res.rows && res.rows.length > 0) {
        const row = res.rows[0];
        return {
          email: row.email,
          otpHash: row.otp_hash,
          pendingData: typeof row.pending_data === 'string' ? JSON.parse(row.pending_data) : row.pending_data,
          attempts: Number(row.attempts) || 0,
          expiresAt: new Date(row.expires_at).toISOString(),
          lastSentAt: new Date(row.last_sent_at).toISOString(),
          createdAt: new Date(row.created_at).toISOString()
        };
      }
    } catch (err: any) {
      logger.warn(`[EmailOTP] Postgres getOtpRecord fallback to local store: ${err?.message}`);
    }
  }

  const db = getDB();
  const list: EmailOtpRecord[] = Array.isArray(db.emailVerificationOtps) ? db.emailVerificationOtps : [];
  return list.find((item) => normalizeEmail(item.email) === normalized) || null;
}

export async function saveOtpRecord(record: EmailOtpRecord): Promise<void> {
  const normalized = normalizeEmail(record.email);
  const cleanRecord: EmailOtpRecord = {
    ...record,
    email: normalized
  };

  const pool = getActivePool();
  if (pool) {
    try {
      await ensurePgOtpTable();
      await pool.query(
        `INSERT INTO email_verification_otps
         (email, otp_hash, pending_data, attempts, expires_at, last_sent_at, created_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET
           otp_hash = EXCLUDED.otp_hash,
           pending_data = EXCLUDED.pending_data,
           attempts = EXCLUDED.attempts,
           expires_at = EXCLUDED.expires_at,
           last_sent_at = EXCLUDED.last_sent_at`,
        [
          normalized,
          cleanRecord.otpHash,
          JSON.stringify(cleanRecord.pendingData),
          cleanRecord.attempts,
          cleanRecord.expiresAt,
          cleanRecord.lastSentAt,
          cleanRecord.createdAt
        ]
      );
    } catch (err: any) {
      logger.warn(`[EmailOTP] Postgres saveOtpRecord warning: ${err?.message}`);
    }
  }

  const db = getDB();
  if (!Array.isArray(db.emailVerificationOtps)) {
    db.emailVerificationOtps = [];
  }
  const filtered = db.emailVerificationOtps.filter(
    (item: EmailOtpRecord) => normalizeEmail(item.email) !== normalized
  );
  filtered.unshift(cleanRecord);
  // Keep expired records pruned (max 500 entries)
  const now = Date.now();
  db.emailVerificationOtps = filtered
    .filter((item: EmailOtpRecord) => new Date(item.expiresAt).getTime() + 60 * 60 * 1000 > now)
    .slice(0, 500);
  saveDB(db);
}

export async function deleteOtpRecord(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  const pool = getActivePool();
  if (pool) {
    try {
      await ensurePgOtpTable();
      await pool.query(`DELETE FROM email_verification_otps WHERE email = $1`, [normalized]);
    } catch (err: any) {
      logger.warn(`[EmailOTP] Postgres deleteOtpRecord warning: ${err?.message}`);
    }
  }

  const db = getDB();
  if (Array.isArray(db.emailVerificationOtps)) {
    db.emailVerificationOtps = db.emailVerificationOtps.filter(
      (item: EmailOtpRecord) => normalizeEmail(item.email) !== normalized
    );
    saveDB(db);
  }
}

export async function dispatchOtpEmail(params: {
  email: string;
  fullName: string;
  companyName: string;
  otpCode: string;
}) {
  const fromAddress =
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM_ADDRESS ||
    DEFAULT_EMAIL_FROM;

  const escapedName = params.fullName.replace(/[<>&"]/g, '');
  const escapedCompany = params.companyName.replace(/[<>&"]/g, '');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background-color: #f8fafc; color: #0f172a;">
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;">
        <div style="font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px;">
          ClientOps Verification
        </div>
        <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0f172a;">
          Verify your email address
        </h1>
        <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #475569;">
          Hi ${escapedName}, use the 6-digit verification code below to finish creating the workspace <strong>${escapedCompany}</strong>:
        </p>
        <div style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.3em; color: #0f172a;">
            ${params.otpCode}
          </span>
        </div>
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">
          This verification code expires in <strong>10 minutes</strong>.
        </p>
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          If you did not request this workspace, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;

  const text = `Hi ${params.fullName},\n\nYour ClientOps verification code for ${params.companyName} is: ${params.otpCode}\n\nThis code expires in 10 minutes. If you did not request this, you can safely ignore this email.`;

  return resendService.sendEmail({
    to: params.email,
    from: fromAddress,
    subject: `${params.otpCode} is your ClientOps verification code`,
    html,
    text,
    template: 'email_verification_otp',
    metadata: {
      email: params.email,
      companyName: params.companyName,
      expiresInMinutes: 10
    }
  });
}
