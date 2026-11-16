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
});
