import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Setup test encryption key
const TEST_KEY_BYTES = crypto.randomBytes(32);
process.env.ENCRYPTION_KEY = TEST_KEY_BYTES.toString('base64');
process.env.NODE_ENV = 'test';

// Import modules to test
import {
  encryptSecret,
  decryptSecret,
  signToken,
  verifyToken,
  getEncryptionKey
} from '../server/services/outreach/crypto.ts';

import {
  hashPassword,
  verifyPassword
} from '../server/db.ts';

import {
  isPrivateOrReservedIP,
  validateSafeUrlForSSRF
} from '../server/routes/gtmToolsRoutes.ts';

describe('Phase 0: Security, Cryptography & Password Hashing Unit Tests', () => {

  describe('1. AES-256-GCM & Token Cryptography (server/services/outreach/crypto.ts)', () => {
    test('getEncryptionKey successfully extracts 32-byte Buffer from base64 env', () => {
      const key = getEncryptionKey();
      assert.equal(Buffer.isBuffer(key), true);
      assert.equal(key.length, 32);
    });

    test('encryptSecret and decryptSecret perform perfect round-trip for sensitive credentials', () => {
      const secretPassword = 'MySuperSecretSmtpPass!#2026';
      const encrypted = encryptSecret(secretPassword);

      assert.equal(Buffer.isBuffer(encrypted), true);
      // IV (12) + Auth Tag (16) + Ciphertext (> 0)
      assert.ok(encrypted.length > 28);

      const decrypted = decryptSecret(encrypted);
      assert.equal(decrypted, secretPassword);
    });

    test('decryptSecret supports Base64 string representations', () => {
      const plain = 'OAuth2_Refresh_Token_xyz123abc';
      const encryptedBuf = encryptSecret(plain);
      const b64 = encryptedBuf.toString('base64');

      const decrypted = decryptSecret(b64);
      assert.equal(decrypted, plain);
    });

    test('decryptSecret rejects tampered ciphertext with authentication error', () => {
      const plain = 'SafePayload123';
      const encrypted = encryptSecret(plain);

      // Flip a bit in the ciphertext
      encrypted[encrypted.length - 1] ^= 0x01;

      assert.throws(() => {
        decryptSecret(encrypted);
      }, /Unsupported state or unable to authenticate data/);
    });

    test('signToken and verifyToken generate and validate HMAC-SHA256 signed tracking tokens', () => {
      const payload = {
        tenantId: 'tenant-acme',
        campaignId: 'camp-101',
        recipientEmail: 'alex@lumina.co.uk',
        action: 'unsubscribe'
      };

      const token = signToken(payload, 3600); // 1 hour expiry
      assert.ok(typeof token === 'string' && token.includes('.'));

      const verification = verifyToken(token);
      assert.equal(verification.valid, true);
      assert.equal(verification.payload?.tenantId, 'tenant-acme');
      assert.equal(verification.payload?.action, 'unsubscribe');
      assert.ok(verification.payload?.exp > Math.floor(Date.now() / 1000));
    });

    test('verifyToken rejects tampered signature or data', () => {
      const token = signToken({ user: 'target' }, 60);
      const parts = token.split('.');
      const tampered = `${parts[0]}x.${parts[1]}`;

      const res = verifyToken(tampered);
      assert.equal(res.valid, false);
      assert.ok(res.error);
    });

    test('verifyToken detects expired tokens', () => {
      // Create token with negative expiry (-10 seconds)
      const expiredToken = signToken({ action: 'click' }, -10);
      const res = verifyToken(expiredToken);

      assert.equal(res.valid, false);
      assert.match(res.error, /expired/i);
    });
  });

  describe('2. Node Crypto Scrypt Password Hashing & Transparent Upgrade (server/db.ts)', () => {
    test('hashPassword produces modern scrypt format: scrypt$<saltHex>$<hashHex>', () => {
      const hash = hashPassword('Admin@12345');
      assert.ok(hash.startsWith('scrypt$'));
      const parts = hash.split('$');
      assert.equal(parts.length, 3);
      assert.equal(parts[0], 'scrypt');
      assert.equal(parts[1].length, 32); // 16 bytes = 32 hex chars
      assert.equal(parts[2].length, 128); // 64 bytes = 128 hex chars
    });

    test('verifyPassword validates scrypt hash and indicates needsUpgrade: false', () => {
      const plain = 'StrongPass#987';
      const hash = hashPassword(plain);

      const check = verifyPassword(plain, hash);
      assert.equal(check.valid, true);
      assert.equal(check.needsUpgrade, false);

      const wrong = verifyPassword('WrongPassword', hash);
      assert.equal(wrong.valid, false);
      assert.equal(wrong.needsUpgrade, false);
    });

    test('verifyPassword validates legacy HMAC hashes and flags needsUpgrade: true for transparent migration', () => {
      const plain = 'Admin@12345';
      const legacyHmac = crypto.createHmac('sha256', 'agency_salt_2026').update(plain).digest('hex');

      const check = verifyPassword(plain, legacyHmac);
      assert.equal(check.valid, true);
      assert.equal(check.needsUpgrade, true);

      // Upgrade simulation
      const upgradedHash = hashPassword(plain);
      const upgradedCheck = verifyPassword(plain, upgradedHash);
      assert.equal(upgradedCheck.valid, true);
      assert.equal(upgradedCheck.needsUpgrade, false);
    });

    test('Seeded demo users verify correctly with Admin@12345 and Sales@12345', () => {
      const adminHash = hashPassword('Admin@12345');
      const salesHash = hashPassword('Sales@12345');

      assert.equal(verifyPassword('Admin@12345', adminHash).valid, true);
      assert.equal(verifyPassword('Sales@12345', salesHash).valid, true);
      assert.equal(verifyPassword('WrongPass', adminHash).valid, false);
    });
  });

  describe('3. SSRF Defense & IP Range Restrictions (server/routes/gtmToolsRoutes.ts)', () => {
    test('isPrivateOrReservedIP detects IPv4 loopback, private, link-local, and CGNAT', () => {
      // Loopback
      assert.equal(isPrivateOrReservedIP('127.0.0.1'), true);
      assert.equal(isPrivateOrReservedIP('127.255.255.255'), true);

      // Private 10/8, 172.16/12, 192.168/16
      assert.equal(isPrivateOrReservedIP('10.0.0.1'), true);
      assert.equal(isPrivateOrReservedIP('172.16.0.1'), true);
      assert.equal(isPrivateOrReservedIP('172.31.255.255'), true);
      assert.equal(isPrivateOrReservedIP('192.168.1.1'), true);

      // Link-local & CGNAT
      assert.equal(isPrivateOrReservedIP('169.254.169.254'), true);
      assert.equal(isPrivateOrReservedIP('100.64.0.1'), true);
      assert.equal(isPrivateOrReservedIP('100.127.255.254'), true);

      // Public IP addresses must NOT be blocked
      assert.equal(isPrivateOrReservedIP('8.8.8.8'), false);
      assert.equal(isPrivateOrReservedIP('1.1.1.1'), false);
      assert.equal(isPrivateOrReservedIP('142.250.190.46'), false);
    });

    test('isPrivateOrReservedIP detects IPv6 loopback, ULA, and link-local', () => {
      assert.equal(isPrivateOrReservedIP('::1'), true);
      assert.equal(isPrivateOrReservedIP('fe80::1'), true);
      assert.equal(isPrivateOrReservedIP('fc00::1'), true);
      assert.equal(isPrivateOrReservedIP('fd12:3456:789a::1'), true);
      assert.equal(isPrivateOrReservedIP('::ffff:127.0.0.1'), true);
      assert.equal(isPrivateOrReservedIP('::ffff:192.168.1.1'), true);
    });

    test('validateSafeUrlForSSRF rejects non-HTTP schemes and non-standard ports', async () => {
      const ftpCheck = await validateSafeUrlForSSRF('ftp://example.com');
      assert.equal(ftpCheck.safe, false);

      const portCheck = await validateSafeUrlForSSRF('https://example.com:8080');
      assert.equal(portCheck.safe, false);

      const sshPortCheck = await validateSafeUrlForSSRF('http://example.com:22');
      assert.equal(sshPortCheck.safe, false);
    });
  });
});
