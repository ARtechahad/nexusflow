import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

import { readDB, writeDB } from '../server/db';
import { authenticateToken } from '../server/middlewares/auth';
import authRoutes from '../server/routes/authRoutes';
import { companyRouter, invitePublicRouter } from '../server/routes/companyRoutes';
import { emailOutreachRouter } from '../server/routes/emailOutreachRoutes';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

let originalDbSnapshot: string | null = null;
let server: http.Server;
let baseUrl = '';

interface CapturedSmtpMail {
  rcptTo: string[];
  rawData: string;
}

function startLocalTestSmtpServer(): Promise<{
  port: number;
  captured: CapturedSmtpMail[];
  close: () => Promise<void>;
}> {
  const captured: CapturedSmtpMail[] = [];

  const smtpServer = net.createServer((socket) => {
    let buffer = '';
    let inDataMode = false;
    let currentMail: CapturedSmtpMail = { rcptTo: [], rawData: '' };

    socket.write('220 localhost TestSMTP Ready\r\n');

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      while (true) {
        if (inDataMode) {
          const endIdx = buffer.indexOf('\r\n.\r\n');
          if (endIdx === -1) break;
          currentMail.rawData += buffer.slice(0, endIdx);
          buffer = buffer.slice(endIdx + 5);
          inDataMode = false;
          captured.push(currentMail);
          currentMail = { rcptTo: [], rawData: '' };
          socket.write('250 2.0.0 OK queued\r\n');
          continue;
        }

        const lineEnd = buffer.indexOf('\r\n');
        if (lineEnd === -1) break;
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        const upper = line.toUpperCase();

        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          socket.write('250-localhost Hello\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n');
        } else if (upper.startsWith('AUTH PLAIN')) {
          socket.write('235 2.7.0 Authentication successful\r\n');
        } else if (upper.startsWith('AUTH LOGIN')) {
          socket.write('334 VXNlcm5hbWU6\r\n');
        } else if (upper.startsWith('MAIL FROM:')) {
          currentMail = { rcptTo: [], rawData: '' };
          socket.write('250 2.1.0 Originator OK\r\n');
        } else if (upper.startsWith('RCPT TO:')) {
          currentMail.rcptTo.push(line.slice(8).trim());
          socket.write('250 2.1.5 Recipient OK\r\n');
        } else if (upper === 'DATA') {
          inDataMode = true;
          socket.write('354 Start mail input; end with <CRLF>.<CRLF>\r\n');
        } else if (upper === 'QUIT') {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
        } else if (upper === 'NOOP' || upper === 'RSET') {
          socket.write('250 OK\r\n');
        } else {
          // Handle base64 username/password challenge responses in AUTH LOGIN
          if (line === 'bWFpbEB0ZXN0LmNvbQ==' || line.length > 0) {
            socket.write('235 2.7.0 Authentication successful\r\n');
          } else {
            socket.write('250 OK\r\n');
          }
        }
      }
    });
  });

  return new Promise((resolve) => {
    smtpServer.listen(0, '127.0.0.1', () => {
      const addr = smtpServer.address() as net.AddressInfo;
      resolve({
        port: addr.port,
        captured,
        close: () => new Promise<void>((res) => smtpServer.close(() => res()))
      });
    });
  });
}

async function api(
  pathname: string,
  options: {
    method?: string;
    token?: string;
    companyId?: string;
    body?: any;
  } = {}
) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.companyId) {
    headers['X-Tenant-Id'] = options.companyId;
  }
  const res = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

describe('Company Overview, Settings Toggle & Real SMTP Email Outreach Flow', () => {
  before(async () => {
    if (fs.existsSync(DB_FILE)) {
      originalDbSnapshot = fs.readFileSync(DB_FILE, 'utf-8');
    }

    const app = express();
    app.use(express.json());
    app.use(authenticateToken);
    app.use('/api/auth', authRoutes);
    app.use('/api/companies', companyRouter);
    app.use('/api/invites', invitePublicRouter);
    app.use('/api/email-outreach', emailOutreachRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (originalDbSnapshot !== null) {
      fs.writeFileSync(DB_FILE, originalDbSnapshot, 'utf-8');
      writeDB(JSON.parse(originalDbSnapshot));
    }
  });

  test('Clean company defaults (Email Outreach OFF), Overview real metrics, Settings toggle & real SMTP connect + send', async () => {
    const suffix = Date.now().toString(36);
    const ownerEmail = `owner.outreach.${suffix}@example.com`;
    const memberEmail = `member.outreach.${suffix}@example.com`;

    // 1. Register Company Owner & create fresh company
    const regOwner = await api('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'Zain Founder', email: ownerEmail, password: 'Password123!' }
    });
    assert.equal(regOwner.status, 200);
    const ownerToken = regOwner.data.token;

    const compRes = await api('/api/companies', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: `CleanOps Co ${suffix}`,
        industry: 'Software',
        size: '1-10',
        initialDepartments: ['Operations']
      }
    });
    assert.equal(compRes.status, 201);
    const companyId = compRes.data.company.id;
    const deptId = compRes.data.departments[0].id;

    // Verify new company has Email Outreach OFF by default & zero dummy accounts/campaigns
    assert.equal(compRes.data.company.settings.enableEmailOutreach, false);
    assert.equal(compRes.data.company.settings.enableClientInbox, false);

    // 2. Check /api/companies/:companyId/overview returns real zero metrics (no mock numbers)
    const ovRes = await api(`/api/companies/${companyId}/overview`, {
      token: ownerToken,
      companyId
    });
    assert.equal(ovRes.status, 200);
    assert.equal(ovRes.data.success, true);
    assert.equal(ovRes.data.counts.departments, 1);
    assert.equal(ovRes.data.counts.members, 1);
    assert.equal(ovRes.data.counts.tasksTotal, 0);
    assert.equal(ovRes.data.counts.tasksOpen, 0);
    assert.equal(ovRes.data.counts.tasksCompletedThisWeek, 0);
    assert.equal(ovRes.data.counts.emailAccounts, 0);
    assert.equal(ovRes.data.counts.campaignsSent, 0);
    assert.equal(ovRes.data.emailOutreachEnabled, false);
    assert.equal(ovRes.data.onboardingSteps.hasDepartments, true);
    assert.equal(ovRes.data.onboardingSteps.hasTeamMembers, false);
    assert.equal(ovRes.data.onboardingSteps.hasTasks, false);
    assert.ok(Array.isArray(ovRes.data.members));
    assert.equal(ovRes.data.members.length, 1);
    assert.ok(Array.isArray(ovRes.data.recentActivity));
    assert.ok(ovRes.data.departments[0].tasksOpen === 0);

    // 3. Company Owner enables Email Outreach via Company Settings PUT
    const settingsRes = await api(`/api/companies/${companyId}`, {
      method: 'PUT',
      token: ownerToken,
      companyId,
      body: {
        settings: { enableEmailOutreach: true }
      }
    });
    assert.equal(settingsRes.status, 200);
    assert.equal(settingsRes.data.company.settings.enableEmailOutreach, true);

    const ovAfterSettings = await api(`/api/companies/${companyId}/overview`, {
      token: ownerToken,
      companyId
    });
    assert.equal(ovAfterSettings.data.emailOutreachEnabled, true);

    // 4. Reject invalid/unreachable SMTP endpoint BEFORE saving (400 SMTP_VERIFY_FAILED)
    const badSmtpRes = await api('/api/email-outreach/accounts', {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: {
        provider: 'smtp',
        senderName: 'Zain',
        email: ownerEmail,
        smtpHost: '127.0.0.1',
        smtpPort: 1,
        smtpSecure: false,
        password: 'app-password-invalid'
      }
    });
    assert.equal(badSmtpRes.status, 400);
    assert.equal(badSmtpRes.data.code, 'SMTP_VERIFY_FAILED');

    const emptyAccountsCheck = await api('/api/email-outreach/accounts', {
      token: ownerToken,
      companyId
    });
    assert.equal(emptyAccountsCheck.status, 200);
    assert.equal(emptyAccountsCheck.data.accounts.length, 0);

    // 5. Connect real SMTP account against local SMTP server -> verifies & stores encrypted credentials
    const smtpServer = await startLocalTestSmtpServer();
    try {
      const connectSmtpRes = await api('/api/email-outreach/accounts', {
        method: 'POST',
        token: ownerToken,
        companyId,
        body: {
          provider: 'smtp',
          senderName: 'Zain Founder',
          email: 'outreach@cleanops.test',
          smtpHost: '127.0.0.1',
          smtpPort: smtpServer.port,
          smtpSecure: false,
          password: 'real-app-password-123'
        }
      });
      assert.equal(connectSmtpRes.status, 201);
      assert.equal(connectSmtpRes.data.account.status, 'verified');
      assert.equal(connectSmtpRes.data.account.email, 'outreach@cleanops.test');
      assert.equal(
        connectSmtpRes.data.account.encryptedPassword,
        undefined,
        'Encrypted SMTP password must NEVER be returned in API response'
      );
      const accountId = connectSmtpRes.data.account.id;

      // Verify persisted DB stores encryptedPassword cleanly (not plaintext password)
      const persisted = readDB().emailAccounts.find((a) => a.id === accountId);
      assert.ok(persisted);
      assert.ok(persisted.encryptedPassword);
      assert.notEqual(persisted.encryptedPassword, 'real-app-password-123');

      // 6. Invite employee in Operations (WITHOUT email_hub permission) -> blocked with 403 MODULE_ACCESS_DENIED
      const invEmp = await api(`/api/companies/${companyId}/invites`, {
        method: 'POST',
        token: ownerToken,
        companyId,
        body: { email: memberEmail, departmentId: deptId, role: 'employee', designation: 'Ops Specialist' }
      });
      assert.equal(invEmp.status, 201);

      const onboardEmp = await api(`/api/invites/${invEmp.data.invite.token}/complete-onboarding`, {
        method: 'POST',
        body: { fullName: 'Hira Ops', password: 'Password123!', phone: '+1-555-0199', title: 'Ops Specialist' }
      });
      assert.equal(onboardEmp.status, 200);
      const empToken = onboardEmp.data.token;

      const blockedEmpOutreach = await api('/api/email-outreach/accounts', {
        token: empToken,
        companyId
      });
      assert.equal(blockedEmpOutreach.status, 403);
      assert.equal(blockedEmpOutreach.data.code, 'MODULE_ACCESS_DENIED');

      // 7. Send 3-step Campaign using connected real SMTP account with {{name}} variable substitution
      const sendRes = await api('/api/email-outreach/campaigns/send', {
        method: 'POST',
        token: ownerToken,
        companyId,
        body: {
          accountId,
          recipientsRaw: 'Ahad Rana <ahad@client.test>, sarah@partner.test',
          subject: 'Partnership follow-up for {{name}}',
          body: 'Hi {{name}},\n\nChecking in from {{email}}.'
        }
      });
      assert.equal(sendRes.status, 200);
      assert.equal(sendRes.data.success, true);
      assert.equal(sendRes.data.campaign.totalRecipients, 2);
      assert.equal(sendRes.data.campaign.sentCount, 2);
      assert.equal(sendRes.data.campaign.failedCount, 0);
      assert.equal(sendRes.data.deliveryLogs.length, 2);
      assert.equal(sendRes.data.deliveryLogs[0].status, 'sent');

      // Confirm local SMTP server actually received both messages with personalized {{name}}
      assert.equal(smtpServer.captured.length, 2);
      assert.ok(smtpServer.captured[0].rawData.includes('Hi Ahad Rana,'));
      assert.ok(smtpServer.captured[1].rawData.includes('Hi Sarah,'));

      // Verify real delivery history & overview metrics updated dynamically
      const histRes = await api('/api/email-outreach/campaigns', {
        token: ownerToken,
        companyId
      });
      assert.equal(histRes.status, 200);
      assert.equal(histRes.data.campaigns.length, 1);
      assert.equal(histRes.data.campaigns[0].sentCount, 2);
      assert.equal(histRes.data.campaigns[0].failedCount, 0);

      const ovFinal = await api(`/api/companies/${companyId}/overview`, {
        token: ownerToken,
        companyId
      });
      assert.equal(ovFinal.data.counts.members, 2);
      assert.equal(ovFinal.data.counts.emailAccounts, 1);
      assert.equal(ovFinal.data.counts.campaignsSent, 1);
      assert.equal(ovFinal.data.counts.emailsDelivered, 2);
      assert.equal(ovFinal.data.onboardingSteps.hasTeamMembers, true);

      // 8. Delete connected account
      const delAccount = await api(`/api/email-outreach/accounts/${accountId}`, {
        method: 'DELETE',
        token: ownerToken,
        companyId
      });
      assert.equal(delAccount.status, 200);
      assert.equal(readDB().emailAccounts.filter((a) => a.id === accountId).length, 0);
    } finally {
      await smtpServer.close();
    }
  });
});
