import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { readDB, writeDB } from '../server/db';
import { authenticateToken } from '../server/middlewares/auth';
import authRoutes from '../server/routes/authRoutes';
import { companyRouter, invitePublicRouter } from '../server/routes/companyRoutes';
import chatRouter from '../server/routes/chatRoutes';
import { projectRouter } from '../server/routes/projectRoutes';
import { fileRouter } from '../server/routes/fileRoutes';
import { invoiceRouter, commissionRouter, analyticsRouter } from '../server/routes/invoiceRoutes';
import { inboxRouter } from '../server/routes/aiRoutes';
import { dripRouter } from '../server/routes/dripRoutes';

const DB_FILE = path.join(process.cwd(), 'data', 'db.json');

let originalDbSnapshot: string | null = null;
let server: http.Server;
let baseUrl = '';

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

describe('Enterprise Multi-Tenant, Multi-Company & Department RBAC Integration', () => {
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
    app.use('/api/chat', chatRouter);
    app.use('/api/projects', projectRouter);
    app.use('/api/files', fileRouter);
    app.use('/api/invoices', invoiceRouter);
    app.use('/api/commissions', commissionRouter);
    app.use('/api/analytics', analyticsRouter);
    app.use('/api/inbox', inboxRouter);
    app.use('/api/drip', dripRouter);

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

  test('Full isolation lifecycle: Individual signup -> Multi-Company -> Dept Creation -> Role Hierarchy -> Availability & Chat', async () => {
    const suffix = Date.now().toString(36);
    const emailA = `ahad.${suffix}@example.com`;
    const emailB = `ahmad.${suffix}@example.com`;
    const emailHead = `head.${suffix}@example.com`;
    const emailEmp = `emp.${suffix}@example.com`;

    // 1. Register User A (Ahad) via /api/auth/register -> personal account ONLY, zero auto-created companies
    const regA = await api('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'Ahad Khan', email: emailA, password: 'Password123!' }
    });
    assert.equal(regA.status, 200);
    assert.equal(regA.data.success, true);
    assert.ok(regA.data.token);
    assert.equal((regA.data.companies || []).length, 0, 'Individual signup must create 0 companies initially');
    const tokenA = regA.data.token;
    const userAId = regA.data.user.id;

    // 2. Register User B (Ahmad) separately
    const regB = await api('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'Ahmad Raza', email: emailB, password: 'Password123!' }
    });
    assert.equal(regB.status, 200);
    assert.equal((regB.data.companies || []).length, 0);
    const tokenB = regB.data.token;

    // 3. Unauthenticated request must fail with 401
    const unauth = await api('/api/companies');
    assert.equal(unauth.status, 401);

    // 4. User A creates TWO companies under single personal account
    const compA1Res = await api('/api/companies', {
      method: 'POST',
      token: tokenA,
      body: {
        name: `Ahad Ventures ${suffix}`,
        industry: 'SaaS',
        size: '11-50',
        initialDepartments: ['Engineering', 'Sales']
      }
    });
    assert.equal(compA1Res.status, 201);
    const compA1Id = compA1Res.data.company.id;
    const engDeptId = compA1Res.data.departments.find((d: any) => d.name === 'Engineering').id;
    const salesDeptId = compA1Res.data.departments.find((d: any) => d.name === 'Sales').id;

    const compA2Res = await api('/api/companies', {
      method: 'POST',
      token: tokenA,
      body: {
        name: `Ahad Holdings ${suffix}`,
        industry: 'Consulting',
        size: '1-10',
        initialDepartments: ['Operations']
      }
    });
    assert.equal(compA2Res.status, 201);
    const compA2Id = compA2Res.data.company.id;
    assert.notEqual(compA1Id, compA2Id);

    // 5. User B creates separate company & private project
    const compBRes = await api('/api/companies', {
      method: 'POST',
      token: tokenB,
      body: {
        name: `Ahmad Studio ${suffix}`,
        industry: 'Design',
        size: '1-10',
        initialDepartments: ['Design']
      }
    });
    assert.equal(compBRes.status, 201);
    const compBId = compBRes.data.company.id;

    // User A creates a deal in compA1
    const projARes = await api('/api/projects', {
      method: 'POST',
      token: tokenA,
      companyId: compA1Id,
      body: {
        clientName: 'Confidential Client Alpha',
        clientEmail: 'alpha@client.com',
        websiteType: 'corporate',
        finalPrice: 2400
      }
    });
    assert.ok(projARes.status === 200 || projARes.status === 201);

    // STRICT TENANT ISOLATION CHECK:
    // User B must see ONLY Ahmad Studio in /api/companies
    const listB = await api('/api/companies', { token: tokenB });
    assert.equal(listB.status, 200);
    assert.equal(listB.data.companies.length, 1);
    assert.equal(listB.data.companies[0].id, compBId);

    // User B trying to access User A's company projects, departments, or files with X-Tenant-Id: compA1Id MUST receive 403 Forbidden
    const crossProjects = await api('/api/projects', { token: tokenB, companyId: compA1Id });
    assert.equal(crossProjects.status, 403);

    const crossDepts = await api(`/api/companies/${compA1Id}/departments`, { token: tokenB, companyId: compA1Id });
    assert.equal(crossDepts.status, 403);

    const crossFiles = await api('/api/files', { token: tokenB, companyId: compA1Id });
    assert.equal(crossFiles.status, 403);

    // User A switching to compA2 must NOT see projects from compA1
    const a2Projects = await api('/api/projects', { token: tokenA, companyId: compA2Id });
    assert.equal(a2Projects.status, 200);
    assert.equal(a2Projects.data.projects.length, 0);

    // 6. Company Owner creates and deletes a department in compA1
    const tempDeptRes = await api(`/api/companies/${compA1Id}/departments`, {
      method: 'POST',
      token: tokenA,
      companyId: compA1Id,
      body: { name: 'Temporary QA', description: 'QA squad' }
    });
    assert.equal(tempDeptRes.status, 201);
    const tempDeptId = tempDeptRes.data.department.id;

    const delDeptRes = await api(`/api/companies/${compA1Id}/departments/${tempDeptId}`, {
      method: 'DELETE',
      token: tokenA,
      companyId: compA1Id
    });
    assert.equal(delDeptRes.status, 200);

    // 7. Company Owner invites Department Head (Engineering) & Employee (Engineering)
    const invHeadRes = await api(`/api/companies/${compA1Id}/invites`, {
      method: 'POST',
      token: tokenA,
      companyId: compA1Id,
      body: {
        email: emailHead,
        departmentId: engDeptId,
        role: 'department_head',
        designation: 'VP Engineering'
      }
    });
    assert.equal(invHeadRes.status, 201);
    const headTokenValue = invHeadRes.data.invite.token;
    assert.ok(invHeadRes.data.invite.inviteUrl.includes(`?invite=${headTokenValue}`));

    // Register Dept Head & Wrong-Email check on invite acceptance
    const regHead = await api('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'Hina Malik', email: emailHead, password: 'Password123!' }
    });
    const tokenHead = regHead.data.token;

    // User B trying to accept Head's invite token must be rejected (403)
    const hijackRes = await api(`/api/invites/${headTokenValue}/accept`, {
      method: 'POST',
      token: tokenB
    });
    assert.equal(hijackRes.status, 403);

    // Head accepts their own invite
    const acceptHead = await api(`/api/invites/${headTokenValue}/accept`, {
      method: 'POST',
      token: tokenHead
    });
    assert.equal(acceptHead.status, 200);
    assert.equal(acceptHead.data.companies[0].myRole, 'department_head');

    // 8. Department Head permissions & boundaries
    // Head CAN invite an employee to Engineering (own dept)
    const invEmpRes = await api(`/api/companies/${compA1Id}/invites`, {
      method: 'POST',
      token: tokenHead,
      companyId: compA1Id,
      body: {
        email: emailEmp,
        departmentId: engDeptId,
        role: 'employee',
        designation: 'Full-Stack Developer'
      }
    });
    assert.equal(invEmpRes.status, 201);
    const empTokenValue = invEmpRes.data.invite.token;

    // Head CANNOT invite another department_head (403)
    const headInviteHead = await api(`/api/companies/${compA1Id}/invites`, {
      method: 'POST',
      token: tokenHead,
      companyId: compA1Id,
      body: {
        email: `otherhead.${suffix}@example.com`,
        departmentId: engDeptId,
        role: 'department_head',
        designation: 'Co-Head'
      }
    });
    assert.equal(headInviteHead.status, 403);

    // Head CANNOT invite into Sales dept they don't belong to (403)
    const headInviteSales = await api(`/api/companies/${compA1Id}/invites`, {
      method: 'POST',
      token: tokenHead,
      companyId: compA1Id,
      body: {
        email: `salesemp.${suffix}@example.com`,
        departmentId: salesDeptId,
        role: 'employee',
        designation: 'AE'
      }
    });
    assert.equal(headInviteSales.status, 403);

    // Head CANNOT view company-wide financials, commissions, or analytics (403)
    assert.equal((await api('/api/commissions', { token: tokenHead, companyId: compA1Id })).status, 403);
    assert.equal((await api('/api/analytics/advanced', { token: tokenHead, companyId: compA1Id })).status, 403);
    assert.equal((await api('/api/invoices', { token: tokenHead, companyId: compA1Id })).status, 403);

    // Head CANNOT read Sales dept tasks or chat (403)
    assert.equal(
      (await api(`/api/companies/${compA1Id}/departments/${salesDeptId}/tasks`, { token: tokenHead, companyId: compA1Id })).status,
      403
    );
    assert.equal(
      (await api(`/api/chat?departmentId=${salesDeptId}&channel=general`, { token: tokenHead, companyId: compA1Id })).status,
      403
    );

    // 9. Register Employee & Accept Invite
    const regEmp = await api('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'Bilal Dev', email: emailEmp, password: 'Password123!' }
    });
    const tokenEmp = regEmp.data.token;
    const empUserId = regEmp.data.user.id;

    const acceptEmp = await api(`/api/invites/${empTokenValue}/accept`, {
      method: 'POST',
      token: tokenEmp
    });
    assert.equal(acceptEmp.status, 200);
    assert.equal(acceptEmp.data.companies[0].myRole, 'employee');

    // Employee CANNOT view deals/projects, financials, or send invites (403)
    assert.equal((await api('/api/projects', { token: tokenEmp, companyId: compA1Id })).status, 403);
    assert.equal((await api('/api/commissions', { token: tokenEmp, companyId: compA1Id })).status, 403);
    assert.equal(
      (await api(`/api/companies/${compA1Id}/invites`, {
        method: 'POST',
        token: tokenEmp,
        companyId: compA1Id,
        body: { email: 'x@y.com', departmentId: engDeptId, role: 'employee' }
      })).status,
      403
    );

    // 10. Department Head creates task for Employee & edits Employee designation
    const taskRes = await api(`/api/companies/${compA1Id}/departments/${engDeptId}/tasks`, {
      method: 'POST',
      token: tokenHead,
      companyId: compA1Id,
      body: {
        title: 'Ship multi-tenant SSE stream',
        priority: 'high',
        assigneeUserId: empUserId
      }
    });
    assert.equal(taskRes.status, 201);
    const taskId = taskRes.data.task.id;

    const patchDesig = await api(
      `/api/companies/${compA1Id}/departments/${engDeptId}/members/${empUserId}`,
      {
        method: 'PATCH',
        token: tokenHead,
        companyId: compA1Id,
        body: { designation: 'Senior Platform Engineer' }
      }
    );
    assert.equal(patchDesig.status, 200);
    assert.equal(patchDesig.data.member.designation, 'Senior Platform Engineer');

    // Employee updates own task to completed & updates own availability
    const patchTask = await api(
      `/api/companies/${compA1Id}/departments/${engDeptId}/tasks/${taskId}`,
      {
        method: 'PATCH',
        token: tokenEmp,
        companyId: compA1Id,
        body: { status: 'completed' }
      }
    );
    assert.equal(patchTask.status, 200);
    assert.equal(patchTask.data.task.status, 'completed');

    const availRes = await api('/api/auth/me/availability', {
      method: 'PATCH',
      token: tokenEmp,
      body: { availabilityStatus: 'In a Meeting' }
    });
    assert.equal(availRes.status, 200);
    assert.equal(availRes.data.availabilityStatus, 'In a Meeting');

    // Verify member roster shows 100% task completion and updated availability
    const rosterRes = await api(`/api/companies/${compA1Id}/departments/${engDeptId}/members`, {
      token: tokenHead,
      companyId: compA1Id
    });
    assert.equal(rosterRes.status, 200);
    const empRow = rosterRes.data.members.find((m: any) => m.userId === empUserId);
    assert.equal(empRow.designation, 'Senior Platform Engineer');
    assert.equal(empRow.availabilityStatus, 'In a Meeting');
    assert.equal(empRow.completionPercent, 100);

    // 11. Employee posts Daily Work Status update to private Engineering chat
    const chatPost = await api('/api/chat', {
      method: 'POST',
      token: tokenEmp,
      companyId: compA1Id,
      body: {
        departmentId: engDeptId,
        channel: 'work-status',
        content: 'Completed multi-tenant SSE stream & unit checks.',
        isStatusUpdate: true
      }
    });
    assert.equal(chatPost.status, 201);
    assert.equal(chatPost.data.message.isStatusUpdate, true);
    assert.equal(chatPost.data.message.departmentId, engDeptId);

    // Owner (Ahad) in Engineering chat sees it, while Sales dept chat remains empty & User B gets 403
    const engChatGet = await api(`/api/chat?departmentId=${engDeptId}&channel=work-status`, {
      token: tokenA,
      companyId: compA1Id
    });
    assert.equal(engChatGet.status, 200);
    assert.equal(engChatGet.data.messages.length, 1);

    const salesChatGet = await api(`/api/chat?departmentId=${salesDeptId}&channel=work-status`, {
      token: tokenA,
      companyId: compA1Id
    });
    assert.equal(salesChatGet.status, 200);
    assert.equal(salesChatGet.data.messages.length, 0);

    // 12. Department Head removes Employee from department
    const removeEmp = await api(
      `/api/companies/${compA1Id}/departments/${engDeptId}/members/${empUserId}`,
      {
        method: 'DELETE',
        token: tokenHead,
        companyId: compA1Id
      }
    );
    assert.equal(removeEmp.status, 200);

    // Removed employee now gets 403 accessing Engineering dept
    const empAfterRemove = await api(`/api/companies/${compA1Id}/departments/${engDeptId}/tasks`, {
      token: tokenEmp,
      companyId: compA1Id
    });
    assert.equal(empAfterRemove.status, 403);

    // Sanity verify Owner still sees own user id cleanly
    assert.ok(userAId);
  });

  test('Invited onboarding profile setup, profile edit, department-specific Email Hub & employee task isolation', async () => {
    const suffix = `${Date.now().toString(36)}2`;
    const ownerEmail = `owner2.${suffix}@example.com`;
    const salesHeadEmail = `saleshead.${suffix}@example.com`;
    const opsHeadEmail = `opshead.${suffix}@example.com`;
    const opsEmpEmail = `opsemp.${suffix}@example.com`;
    const salesEmpEmail = `salesemp.${suffix}@example.com`;

    // 1. Register Company Owner & create company with Sales + Engineering departments
    const regOwner = await api('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'Tariq Owner', email: ownerEmail, password: 'Password123!' }
    });
    assert.equal(regOwner.status, 200);
    const ownerToken = regOwner.data.token;

    const compRes = await api('/api/companies', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: `Nexus Ops ${suffix}`,
        industry: 'Technology',
        size: '11-50',
        initialDepartments: ['Sales', 'Engineering']
      }
    });
    assert.equal(compRes.status, 201);
    const companyId = compRes.data.company.id;
    const salesDept = compRes.data.departments.find((d: any) => d.name === 'Sales');
    const engDept = compRes.data.departments.find((d: any) => d.name === 'Engineering');
    assert.deepEqual(salesDept.allowed_modules, ['operations', 'chat']);
    assert.deepEqual(engDept.allowed_modules, ['operations', 'chat']);
    const salesDeptId = salesDept.id;
    const engDeptId = engDept.id;

    // 2. Owner invites Sales Head, Engineering Head, Engineering Employee, and Sales Employee
    const invSalesHead = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: salesHeadEmail, departmentId: salesDeptId, role: 'department_head', designation: 'VP of Sales' }
    });
    const invEngHead = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: opsHeadEmail, departmentId: engDeptId, role: 'department_head', designation: 'Head of Engineering' }
    });
    const invEngEmp = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: opsEmpEmail, departmentId: engDeptId, role: 'employee', designation: 'Platform Engineer' }
    });
    const invSalesEmp = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: salesEmpEmail, departmentId: salesDeptId, role: 'employee', designation: 'SDR' }
    });
    assert.equal(invSalesHead.status, 201);
    assert.equal(invEngHead.status, 201);
    assert.equal(invEngEmp.status, 201);
    assert.equal(invSalesEmp.status, 201);

    const salesHeadInviteToken = invSalesHead.data.invite.token;
    const engHeadInviteToken = invEngHead.data.invite.token;
    const engEmpInviteToken = invEngEmp.data.invite.token;
    const salesEmpInviteToken = invSalesEmp.data.invite.token;

    // 3. Public preview shows userExists: false before onboarding
    const previewRes = await api(`/api/invites/${salesHeadInviteToken}`);
    assert.equal(previewRes.status, 200);
    assert.equal(previewRes.data.invite.userExists, false);

    // 4. Invited users complete profile onboarding directly via /api/invites/:token/complete-onboarding
    const onboardSalesHead = await api(`/api/invites/${salesHeadInviteToken}/complete-onboarding`, {
      method: 'POST',
      body: {
        fullName: 'Zainab Sales',
        password: 'Password123!',
        phone: '+1-555-0101',
        title: 'VP of Sales',
        bio: 'Leading enterprise outbound and client expansion.'
      }
    });
    assert.equal(onboardSalesHead.status, 200);
    assert.ok(onboardSalesHead.data.token);
    assert.equal(onboardSalesHead.data.user.phone, '+1-555-0101');
    assert.equal(onboardSalesHead.data.user.bio, 'Leading enterprise outbound and client expansion.');
    assert.equal(onboardSalesHead.data.departmentId, salesDeptId);
    assert.equal(onboardSalesHead.data.companies[0].myRole, 'department_head');
    const salesHeadToken = onboardSalesHead.data.token;

    const onboardEngHead = await api(`/api/invites/${engHeadInviteToken}/complete-onboarding`, {
      method: 'POST',
      body: {
        fullName: 'Omar Engineering',
        password: 'Password123!',
        phone: '+1-555-0102',
        title: 'Head of Engineering',
        bio: 'Managing core infrastructure and sprint delivery.'
      }
    });
    assert.equal(onboardEngHead.status, 200);
    const engHeadToken = onboardEngHead.data.token;

    const onboardEngEmp = await api(`/api/invites/${engEmpInviteToken}/complete-onboarding`, {
      method: 'POST',
      body: {
        fullName: 'Ayesha Dev',
        password: 'Password123!',
        phone: '+1-555-0103',
        title: 'Platform Engineer',
        bio: 'Backend reliability engineer.'
      }
    });
    assert.equal(onboardEngEmp.status, 200);
    const engEmpToken = onboardEngEmp.data.token;
    const engEmpId = onboardEngEmp.data.user.id;

    const onboardSalesEmp = await api(`/api/invites/${salesEmpInviteToken}/complete-onboarding`, {
      method: 'POST',
      body: {
        fullName: 'Kamran SDR',
        password: 'Password123!',
        phone: '+1-555-0104',
        title: 'SDR'
      }
    });
    assert.equal(onboardSalesEmp.status, 200);
    const salesEmpToken = onboardSalesEmp.data.token;

    // 5. Personal profile update endpoint works for invited staff
    const profPatch = await api('/api/auth/me/profile', {
      method: 'PATCH',
      token: engEmpToken,
      body: {
        fullName: 'Ayesha Khan',
        phone: '+1-555-9999',
        title: 'Senior Platform Engineer',
        bio: 'Updated reliability bio'
      }
    });
    assert.equal(profPatch.status, 200);
    assert.equal(profPatch.data.user.name, 'Ayesha Khan');
    assert.equal(profPatch.data.user.phone, '+1-555-9999');
    assert.equal(profPatch.data.user.bio, 'Updated reliability bio');

    // 6. Dynamic Department Module Access Control (`allowed_modules`)
    // Owner always has full access across every module
    assert.equal((await api('/api/inbox/messages', { token: ownerToken, companyId })).status, 200, 'Owner can access Inbox');
    assert.equal((await api('/api/drip/campaigns', { token: ownerToken, companyId })).status, 200, 'Owner can access Email Hub');

    // Before Owner enables email_hub / client_inbox on Sales, Sales Head & Employee get 403 too
    assert.equal((await api('/api/inbox/messages', { token: salesHeadToken, companyId })).status, 403, 'Sales Head blocked before client_inbox enabled');
    assert.equal((await api('/api/inbox/messages', { token: salesEmpToken, companyId })).status, 403, 'Sales Employee blocked before client_inbox enabled');
    assert.equal((await api('/api/drip/campaigns', { token: salesHeadToken, companyId })).status, 403, 'Sales Head blocked before email_hub enabled');

    // Non-owner cannot edit department permissions
    const forbiddenPermPatch = await api(`/api/companies/${companyId}/departments/${salesDeptId}`, {
      method: 'PATCH',
      token: salesHeadToken,
      companyId,
      body: { allowed_modules: ['operations', 'chat', 'email_hub', 'client_inbox'] }
    });
    assert.equal(forbiddenPermPatch.status, 403, 'Only Company Owner can modify department allowed_modules');

    // Owner enables email_hub + client_inbox for Sales department
    const enableSalesModules = await api(`/api/companies/${companyId}/departments/${salesDeptId}`, {
      method: 'PATCH',
      token: ownerToken,
      companyId,
      body: { allowed_modules: ['operations', 'chat', 'email_hub', 'client_inbox'] }
    });
    assert.equal(enableSalesModules.status, 200);
    assert.deepEqual(
      enableSalesModules.data.department.allowed_modules,
      ['operations', 'chat', 'email_hub', 'client_inbox']
    );

    assert.equal((await api('/api/inbox/messages', { token: salesHeadToken, companyId })).status, 200, 'Sales Head can access Inbox once enabled');
    assert.equal((await api('/api/inbox/messages', { token: salesEmpToken, companyId })).status, 200, 'Sales Employee can access Inbox once enabled');
    assert.equal((await api('/api/drip/campaigns', { token: salesHeadToken, companyId })).status, 200, 'Sales Head can access Email Hub once enabled');
    assert.equal((await api('/api/drip/campaigns', { token: salesEmpToken, companyId })).status, 200, 'Sales Employee can access Email Hub once enabled');
    assert.equal((await api('/api/inbox/messages', { token: engHeadToken, companyId })).status, 403, 'Engineering Head must NOT access Inbox');
    assert.equal((await api('/api/inbox/messages', { token: engEmpToken, companyId })).status, 403, 'Engineering Employee must NOT access Inbox');

    // 7. Employee Task Isolation (only sees own assigned tasks, cannot create or delete tasks)
    const empTaskCreate = await api(`/api/companies/${companyId}/departments/${engDeptId}/tasks`, {
      method: 'POST',
      token: engHeadToken,
      companyId,
      body: { title: 'Task for Ayesha', priority: 'high', assigneeUserId: engEmpId }
    });
    assert.equal(empTaskCreate.status, 201);
    const ayeshaTaskId = empTaskCreate.data.task.id;

    const headTaskCreate = await api(`/api/companies/${companyId}/departments/${engDeptId}/tasks`, {
      method: 'POST',
      token: engHeadToken,
      companyId,
      body: { title: 'Private Lead Architecture Review', priority: 'medium', assigneeUserId: onboardEngHead.data.user.id }
    });
    assert.equal(headTaskCreate.status, 201);

    const headTasksList = await api(`/api/companies/${companyId}/departments/${engDeptId}/tasks`, {
      token: engHeadToken,
      companyId
    });
    assert.equal(headTasksList.status, 200);
    assert.equal(headTasksList.data.tasks.length, 2);

    const empTasksList = await api(`/api/companies/${companyId}/departments/${engDeptId}/tasks`, {
      token: engEmpToken,
      companyId
    });
    assert.equal(empTasksList.status, 200);
    assert.equal(empTasksList.data.tasks.length, 1, 'Employee must ONLY see tasks assigned to themselves');
    assert.equal(empTasksList.data.tasks[0].id, ayeshaTaskId);

    const empPostTask = await api(`/api/companies/${companyId}/departments/${engDeptId}/tasks`, {
      method: 'POST',
      token: engEmpToken,
      companyId,
      body: { title: 'Unauthorized employee task' }
    });
    assert.equal(empPostTask.status, 403);

    const empDeleteTask = await api(`/api/companies/${companyId}/departments/${engDeptId}/tasks/${ayeshaTaskId}`, {
      method: 'DELETE',
      token: engEmpToken,
      companyId
    });
    assert.equal(empDeleteTask.status, 403);
  });

  test('Customizable allowed_modules: create department with custom modules & toggle financials/chat/operations dynamically', async () => {
    const suffix = `${Date.now().toString(36)}3`;
    const ownerEmail = `owner3.${suffix}@example.com`;
    const finHeadEmail = `finhead.${suffix}@example.com`;
    const finEmpEmail = `finemp.${suffix}@example.com`;

    const regOwner = await api('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'Hina Owner', email: ownerEmail, password: 'Password123!' }
    });
    assert.equal(regOwner.status, 200);
    const ownerToken = regOwner.data.token;

    const compRes = await api('/api/companies', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: `FinOps Holdings ${suffix}`,
        industry: 'Finance',
        size: '11-50',
        initialDepartments: ['Operations']
      }
    });
    assert.equal(compRes.status, 201);
    const companyId = compRes.data.company.id;

    // 1. Owner creates Finance department with custom allowed_modules including 'financials'
    const createFinDept = await api(`/api/companies/${companyId}/departments`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: {
        name: 'Finance & RevOps',
        description: 'Revenue tracking & commission ledgers',
        allowed_modules: ['operations', 'chat', 'financials']
      }
    });
    assert.equal(createFinDept.status, 201);
    const finDeptId = createFinDept.data.department.id;
    assert.deepEqual(createFinDept.data.department.allowed_modules, ['operations', 'chat', 'financials']);

    // Invite + onboard Finance Head and Finance Employee
    const invHead = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: finHeadEmail, departmentId: finDeptId, role: 'department_head', designation: 'Finance Lead' }
    });
    const invEmp = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: finEmpEmail, departmentId: finDeptId, role: 'employee', designation: 'Billing Analyst' }
    });
    assert.equal(invHead.status, 201);
    assert.equal(invEmp.status, 201);

    const onboardHead = await api(`/api/invites/${invHead.data.invite.token}/complete-onboarding`, {
      method: 'POST',
      body: { fullName: 'Bilal Finance', password: 'Password123!', phone: '+1-555-0201', title: 'Finance Lead' }
    });
    const onboardEmp = await api(`/api/invites/${invEmp.data.invite.token}/complete-onboarding`, {
      method: 'POST',
      body: { fullName: 'Sana Analyst', password: 'Password123!', phone: '+1-555-0202', title: 'Billing Analyst' }
    });
    assert.equal(onboardHead.status, 200);
    assert.equal(onboardEmp.status, 200);
    const finHeadToken = onboardHead.data.token;
    const finEmpToken = onboardEmp.data.token;

    // 2. Financials allowed for Finance members, Email Hub / Client Inbox still blocked
    assert.equal((await api('/api/commissions', { token: finHeadToken, companyId })).status, 200);
    assert.equal((await api('/api/commissions', { token: finEmpToken, companyId })).status, 200);
    assert.equal((await api('/api/analytics/advanced', { token: finHeadToken, companyId })).status, 200);
    assert.equal((await api('/api/analytics/advanced', { token: finEmpToken, companyId })).status, 200);
    assert.equal((await api('/api/drip/campaigns', { token: finHeadToken, companyId })).status, 403);
    assert.equal((await api('/api/inbox/messages', { token: finEmpToken, companyId })).status, 403);

    // Financial payout/admin mutations remain strictly company_admin only
    const headBoostAttempt = await api('/api/commissions/tier-boost', {
      method: 'POST',
      token: finHeadToken,
      companyId,
      body: { salespersonName: 'Bilal', targetTier: 'tier3' }
    });
    assert.equal(headBoostAttempt.status, 403, 'Non-owners cannot trigger commission tier-boost mutation');

    // 3. Owner revokes 'financials' -> Finance members immediately get 403 MODULE_ACCESS_DENIED
    const disableFin = await api(`/api/companies/${companyId}/departments/${finDeptId}`, {
      method: 'PATCH',
      token: ownerToken,
      companyId,
      body: { allowed_modules: ['operations', 'chat'] }
    });
    assert.equal(disableFin.status, 200);

    const blockedComm = await api('/api/commissions', { token: finHeadToken, companyId });
    assert.equal(blockedComm.status, 403);
    assert.equal(blockedComm.data.code, 'MODULE_ACCESS_DENIED');
    assert.equal((await api('/api/analytics/advanced', { token: finEmpToken, companyId })).status, 403);
    // Owner keeps full access regardless
    assert.equal((await api('/api/commissions', { token: ownerToken, companyId })).status, 200);

    // 4. Owner disables 'chat' & 'operations' (leaving only ['financials']) -> chat & tasks blocked with 403
    const onlyFinancials = await api(`/api/companies/${companyId}/departments/${finDeptId}`, {
      method: 'PATCH',
      token: ownerToken,
      companyId,
      body: { allowed_modules: ['financials'] }
    });
    assert.equal(onlyFinancials.status, 200);

    const blockedChatGet = await api(`/api/chat?departmentId=${finDeptId}`, { token: finEmpToken, companyId });
    assert.equal(blockedChatGet.status, 403);
    assert.equal(blockedChatGet.data.code, 'MODULE_ACCESS_DENIED');

    const blockedChatPost = await api('/api/chat', {
      method: 'POST',
      token: finHeadToken,
      companyId,
      body: { departmentId: finDeptId, content: 'Should fail when chat disabled' }
    });
    assert.equal(blockedChatPost.status, 403);

    const blockedTasks = await api(`/api/companies/${companyId}/departments/${finDeptId}/tasks`, {
      token: finHeadToken,
      companyId
    });
    assert.equal(blockedTasks.status, 403);

    // 5. Owner restores ['operations', 'chat', 'financials'] -> all three modules work again
    const restoreModules = await api(`/api/companies/${companyId}/departments/${finDeptId}`, {
      method: 'PATCH',
      token: ownerToken,
      companyId,
      body: { allowed_modules: ['operations', 'chat', 'financials'] }
    });
    assert.equal(restoreModules.status, 200);
    assert.equal((await api(`/api/chat?departmentId=${finDeptId}`, { token: finEmpToken, companyId })).status, 200);
    assert.equal((await api(`/api/companies/${companyId}/departments/${finDeptId}/tasks`, { token: finHeadToken, companyId })).status, 200);
    assert.equal((await api('/api/commissions', { token: finEmpToken, companyId })).status, 200);
  });

  test('Self-invite prevention, duplicate pending invite rejection, smart invite metadata & 1-step new-user onboarding', async () => {
    const suffix = `${Date.now().toString(36)}4`;
    const ownerEmail = `owner4.${suffix}@example.com`;
    const newTeammateEmail = `newbie4.${suffix}@example.com`;
    const existingUserEmail = `existing4.${suffix}@example.com`;

    // 1. Register Company Owner & existing external user
    const regOwner = await api('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'Bilal Owner', email: ownerEmail, password: 'Password123!' }
    });
    assert.equal(regOwner.status, 200);
    const ownerToken = regOwner.data.token;
    const ownerUserId = regOwner.data.user.id;

    const regExisting = await api('/api/auth/register', {
      method: 'POST',
      body: { fullName: 'Existing Peer', email: existingUserEmail, password: 'Password123!' }
    });
    assert.equal(regExisting.status, 200);

    const compRes = await api('/api/companies', {
      method: 'POST',
      token: ownerToken,
      body: {
        name: `Guardrails Inc ${suffix}`,
        industry: 'Software',
        size: '1-10',
        initialDepartments: ['Operations']
      }
    });
    assert.equal(compRes.status, 201);
    const companyId = compRes.data.company.id;
    const deptId = compRes.data.departments[0].id;

    // 2. Self-invite MUST fail with 400 SELF_INVITE_NOT_ALLOWED
    const selfInvite = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: ownerEmail, departmentId: deptId, role: 'department_head', designation: 'head Operations' }
    });
    assert.equal(selfInvite.status, 400);
    assert.equal(selfInvite.data.code, 'SELF_INVITE_NOT_ALLOWED');

    // Company Owner primary role badge cannot be overwritten via member PATCH
    const patchOwnerDesig = await api(
      `/api/companies/${companyId}/departments/${deptId}/members/${ownerUserId}`,
      {
        method: 'PATCH',
        token: ownerToken,
        companyId,
        body: { designation: 'head Operations' }
      }
    );
    assert.equal(patchOwnerDesig.status, 403);

    // 3. First invite to newTeammateEmail succeeds
    const inv1 = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: newTeammateEmail, departmentId: deptId, role: 'employee' }
    });
    assert.equal(inv1.status, 201);
    const newInviteToken = inv1.data.invite.token;

    // Duplicate pending invite MUST fail with 400 DUPLICATE_PENDING_INVITE
    const dupInv = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: newTeammateEmail.toUpperCase(), departmentId: deptId, role: 'department_head' }
    });
    assert.equal(dupInv.status, 400);
    assert.equal(dupInv.data.code, 'DUPLICATE_PENDING_INVITE');

    // 4. GET /api/invites/:token returns clean top-level metadata with userExists: false (Case C)
    const metaNew = await api(`/api/invites/${newInviteToken}`);
    assert.equal(metaNew.status, 200);
    assert.equal(metaNew.data.valid, true);
    assert.equal(metaNew.data.companyName, `Guardrails Inc ${suffix}`);
    assert.equal(metaNew.data.departmentName, 'Operations');
    assert.equal(metaNew.data.role, 'employee');
    assert.equal(metaNew.data.email, newTeammateEmail);
    assert.equal(metaNew.data.userExists, false);

    // Case C: Brand new teammate sets up account with ONLY fullName + password (no phone required)
    const oneStepJoin = await api(`/api/invites/${newInviteToken}/complete-onboarding`, {
      method: 'POST',
      body: { fullName: 'Sana Newcomer', password: 'Password123!' }
    });
    assert.equal(oneStepJoin.status, 200);
    assert.ok(oneStepJoin.data.token);
    assert.equal(oneStepJoin.data.departmentId, deptId);
    assert.equal(oneStepJoin.data.companies[0].myRole, 'employee');

    // Re-inviting an already-active member MUST fail with 400 SELF_INVITE_NOT_ALLOWED
    const inviteActiveMember = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: newTeammateEmail, departmentId: deptId, role: 'employee' }
    });
    assert.equal(inviteActiveMember.status, 400);
    assert.equal(inviteActiveMember.data.code, 'SELF_INVITE_NOT_ALLOWED');

    // 5. Invite existing registered user -> GET /api/invites/:token reports userExists: true (Case B)
    const invExisting = await api(`/api/companies/${companyId}/invites`, {
      method: 'POST',
      token: ownerToken,
      companyId,
      body: { email: existingUserEmail, departmentId: deptId, role: 'department_head' }
    });
    assert.equal(invExisting.status, 201);
    const metaExisting = await api(`/api/invites/${invExisting.data.invite.token}`);
    assert.equal(metaExisting.status, 200);
    assert.equal(metaExisting.data.valid, true);
    assert.equal(metaExisting.data.userExists, true);
    assert.equal(metaExisting.data.role, 'department_head');
  });
});
