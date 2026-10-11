import crypto from 'node:crypto';

/**
 * Retrieves and validates the 32-byte AES-256-GCM encryption key from process.env.ENCRYPTION_KEY.
 * The key must be base64-encoded (or 32 raw UTF-8 bytes).
 */
export function getEncryptionKey(): Buffer {
  const rawKey = process.env.ENCRYPTION_KEY;
  if (!rawKey || rawKey.trim().length === 0) {
    throw new Error('ENCRYPTION_KEY environment variable is missing. Outreach Suite refuses to start without a secure 32-byte key.');
  }

  // Attempt Base64 decode first
  try {
    const b64Buf = Buffer.from(rawKey.trim(), 'base64');
    if (b64Buf.length === 32) {
      return b64Buf;
    }
  } catch {
    // Fall through to utf-8 length check
  }

  // Check if raw UTF-8 string is exactly 32 bytes
  const utf8Buf = Buffer.from(rawKey.trim(), 'utf8');
  if (utf8Buf.length === 32) {
    return utf8Buf;
  }

  throw new Error(`ENCRYPTION_KEY must be exactly 32 bytes (base64 encoded or 32 characters). Got length ${utf8Buf.length}.`);
}

/**
 * Validates encryption key without throwing, returning a boolean status.
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts a sensitive string (mailbox password, OAuth tokens) using AES-256-GCM.
 * Output format: Buffer concatenation of [12-byte IV] + [16-byte Auth Tag] + [Ciphertext]
 */
export function encryptSecret(plain: string): Buffer {
  if (typeof plain !== 'string') {
    throw new TypeError('encryptSecret expects a string argument');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag(); // 16 bytes

  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypts a Buffer or Base64 string produced by encryptSecret using AES-256-GCM.
 */
export function decryptSecret(buf: Buffer | Uint8Array | string): string {
  let source: Buffer;
  if (typeof buf === 'string') {
    source = Buffer.from(buf, 'base64');
  } else if (Buffer.isBuffer(buf)) {
    source = buf;
  } else {
    source = Buffer.from(buf);
  }

  if (source.length < 28) {
    throw new Error('Invalid encrypted payload: buffer too short for IV and Auth Tag.');
  }

  const key = getEncryptionKey();
  const iv = source.subarray(0, 12);
  const authTag = source.subarray(12, 28);
  const ciphertext = source.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Sign payload with HMAC-SHA256, base64url encoding, with expiry in seconds.
 * Used for unsubscribe links, tracking pixels, and secure click redirects.
 */
export function signToken(payload: Record<string, any>, expiresInSeconds: number = 86400 * 30): string {
  const key = getEncryptionKey();
  const fullPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };

  const dataStr = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', key).update(dataStr).digest('base64url');

  return `${dataStr}.${signature}`;
}

/**
 * Verifies and decodes an HMAC-SHA256 signed token.
 */
export function verifyToken(token: string): { valid: boolean; payload?: any; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token must be a non-empty string' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed token structure' };
  }

  const [dataStr, signature] = parts;

  try {
    const key = getEncryptionKey();
    const expectedSig = crypto.createHmac('sha256', key).update(dataStr).digest('base64url');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payloadJson = Buffer.from(dataStr, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);

    if (payload.exp && typeof payload.exp === 'number') {
      const now = Math.floor(Date.now() / 1000);
      if (now > payload.exp) {
        return { valid: false, error: 'Token has expired', payload };
      }
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Failed to verify token' };
  }
}
