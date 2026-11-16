import { Router, Response } from 'express';
import { readDB, writeDB } from '../db';
import { AuthenticatedRequest, requireCompanyRole } from '../middlewares/auth';

export const invoiceRouter = Router();
export const commissionRouter = Router();
export const analyticsRouter = Router();

function isSameCompany(record: any, companyId: string): boolean {
  return (
    record?.companyId === companyId ||
    record?.tenantId === companyId ||
    record?.tenant_id === companyId
  );
}

// ==========================================
// 1. Automated PDF Invoices & Receipts (/api/invoices) - Company Admin Only
// ==========================================

invoiceRouter.get('/', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const { projectId, status } = req.query;

  let list = (db.invoices || []).filter((inv: any) => isSameCompany(inv, companyId));
  if (projectId) list = list.filter((inv: any) => inv.projectId === projectId);
  if (status && status !== 'all') list = list.filter((inv: any) => inv.status === status);

  return res.json({ success: true, count: list.length, invoices: list });
});

invoiceRouter.get('/:id', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const inv = (db.invoices || []).find(
    (i: any) => i.id === req.params.id && isSameCompany(i, req.companyId!)
  );
  if (!inv) {
    return res.status(404).json({ success: false, message: 'Invoice not found.' });
  }
  return res.json({ success: true, invoice: inv });
});

invoiceRouter.get('/project/:projectId', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const { projectId } = req.params;
  const p: any = (db.projects || []).find((proj: any) => proj.id === projectId && isSameCompany(proj, companyId));
  if (!p) {
    return res.status(404).json({ success: false, message: 'Project not found.' });
  }

  if (!db.invoices) db.invoices = [];
  let projectInvoices = db.invoices.filter((i: any) => i.projectId === projectId && isSameCompany(i, companyId));

  if (projectInvoices.length === 0) {
    const half = Number((p.finalPrice * 0.5).toFixed(2));
    const inv1 = {
      id: `inv-auto-adv-${p.id}`,
      companyId,
      tenantId: companyId,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      projectId: p.id,
      clientName: p.clientName,
      clientCompany: p.clientCompany || `${p.clientName} Brand`,
      clientEmail: p.clientEmail,
      clientAddress: 'Verified International Client Address',
      issueDate: p.startDate || new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      status: p.advancePaid ? 'paid' : 'issued',
      milestoneType: 'advance_50',
      currency: p.currency || 'USD',
      items: [
        {
          id: `item-adv-${p.id}`,
          description: `${String(p.websiteType || 'Project').toUpperCase()} - 50% Kick-Off Deposit`,
          category: 'development',
          quantity: 1,
          unitPrice: half,
          total: half
        }
      ],
      subtotal: half,
      taxRatePercent: 0,
      taxAmount: 0,
      totalAmount: half,
      amountPaid: p.advancePaid ? half : 0,
      balanceDue: p.advancePaid ? 0 : half,
      paymentMethod: p.paymentMethod || 'paypal',
      paymentClearedAt: p.advancePaid ? (p.createdAt || new Date().toISOString()) : undefined,
      transactionId: p.advanceTxId || (p.advancePaid ? `TX-${Date.now()}` : undefined),
      receiptNumber: p.advancePaid ? `RCPT-${Math.floor(10000 + Math.random() * 90000)}` : undefined,
      notes: 'Standard 50% milestone deposit required prior to staging setup.',
      terms: 'Staging deployment guaranteed within 48h upon payment clearance.'
    };

    const inv2: any = {
      id: `inv-auto-bal-${p.id}`,
      companyId,
      tenantId: companyId,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      projectId: p.id,
      clientName: p.clientName,
      clientCompany: p.clientCompany || `${p.clientName} Brand`,
      clientEmail: p.clientEmail,
      clientAddress: 'Verified International Client Address',
      issueDate: p.targetDeliveryDate || new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      status: p.balancePaid ? 'paid' : p.clientApproved ? 'issued' : 'draft',
      milestoneType: 'balance_50',
      currency: p.currency || 'USD',
      items: [
        {
          id: `item-bal-${p.id}`,
          description: `${String(p.websiteType || 'Project').toUpperCase()} - 50% Final Balance Clearance`,
          category: 'development',
          quantity: 1,
          unitPrice: half,
          total: half
        }
      ],
      subtotal: half,
      taxRatePercent: 0,
      taxAmount: 0,
      totalAmount: half,
      amountPaid: p.balancePaid ? half : 0,
      balanceDue: p.balancePaid ? 0 : half,
      paymentMethod: p.paymentMethod || 'paypal',
      paymentClearedAt: p.balancePaid ? new Date().toISOString() : undefined,
      transactionId: p.balanceTxId || (p.balancePaid ? `TX-${Date.now()}` : undefined),
      receiptNumber: p.balancePaid ? `RCPT-${Math.floor(10000 + Math.random() * 90000)}` : undefined,
      notes: 'Final balance clearance unlocks live server credentials transfer.',
      terms: 'Payment due upon staging review sign-off.'
    };

    db.invoices.push(inv1 as any, inv2 as any);
    writeDB(db);
    projectInvoices = [inv1, inv2];
  }

  return res.json({ success: true, count: projectInvoices.length, invoices: projectInvoices });
});

invoiceRouter.post('/generate', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const {
    projectId,
    clientName,
    clientCompany,
    clientEmail,
    clientAddress,
    milestoneType,
    items,
    taxRatePercent,
    currency,
    notes,
    terms
  } = req.body || {};

  if (!db.invoices) db.invoices = [];
  const subtotal = (items || []).reduce((acc: number, it: any) => acc + (Number(it.total) || 0), 0);
  const taxRate = Number(taxRatePercent) || 0;
  const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));

  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newInvoice = {
    id: `inv-${Date.now()}`,
    companyId,
    tenantId: companyId,
    invoiceNumber,
    projectId: projectId || 'general',
    clientName: clientName || 'Client',
    clientCompany,
    clientEmail: clientEmail || '',
    clientAddress: clientAddress || '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    status: 'issued',
    milestoneType: milestoneType || 'advance_50',
    currency: currency || 'USD',
    items: items || [],
    subtotal,
    taxRatePercent: taxRate,
    taxAmount,
    totalAmount,
    amountPaid: 0,
    balanceDue: totalAmount,
    paymentMethod: req.body?.paymentMethod || 'bank_transfer',
    paymentClearedAt: undefined,
    notes: notes || 'Thank you for your business.',
    terms: terms || 'Standard company payment terms.'
  };

  db.invoices.push(newInvoice as any);
  writeDB(db);

  return res.json({ success: true, message: `Invoice ${invoiceNumber} created successfully`, invoice: newInvoice });
});

invoiceRouter.post('/mark-paid/:id', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const { id } = req.params;
  const { paymentMethod, transactionId } = req.body || {};

  const inv: any = (db.invoices || []).find((i: any) => i.id === id && isSameCompany(i, companyId));
  if (!inv) {
    return res.status(404).json({ success: false, message: 'Invoice not found.' });
  }

  inv.status = 'paid';
  inv.amountPaid = inv.totalAmount;
  inv.balanceDue = 0;
  inv.paymentClearedAt = new Date().toISOString();
  inv.paymentMethod = paymentMethod || inv.paymentMethod || 'paypal';
  inv.transactionId = transactionId || `TX-${Date.now()}`;
  inv.receiptNumber = `RCPT-${Math.floor(10000 + Math.random() * 90000)}`;

  if (inv.projectId) {
    const p: any = (db.projects || []).find((proj: any) => proj.id === inv.projectId && isSameCompany(proj, companyId));
    if (p) {
      if (inv.milestoneType === 'advance_50') {
        p.advancePaid = true;
        p.advanceAmount = inv.totalAmount;
        p.advanceTxId = inv.transactionId;
        if (p.status === 'lead' || p.status === 'scoped') p.status = 'advance_paid';
      } else if (inv.milestoneType === 'balance_50') {
        p.balancePaid = true;
        p.balanceAmount = inv.totalAmount;
        p.balanceTxId = inv.transactionId;
        if (p.status === 'staging_dev' || p.status === 'client_review') p.status = 'balance_paid';
      }
    }
  }

  writeDB(db);
  return res.json({ success: true, message: `Invoice ${inv.invoiceNumber} marked as PAID.`, invoice: inv });
});

invoiceRouter.post('/dispatch-email/:id', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const inv: any = (db.invoices || []).find((i: any) => i.id === req.params.id && isSameCompany(i, req.companyId!));
  if (!inv) {
    return res.status(404).json({ success: false, message: 'Invoice not found.' });
  }

  const subject = encodeURIComponent(`Invoice & Payment Details: ${inv.invoiceNumber}`);
  const body = encodeURIComponent(`Dear ${inv.clientName},\n\nInvoice ${inv.invoiceNumber}: ${inv.totalAmount} ${inv.currency}.`);
  return res.json({
    success: true,
    message: `Invoice dispatch prepared for ${inv.clientEmail}`,
    mailtoUrl: `mailto:${inv.clientEmail}?subject=${subject}&body=${body}`,
    invoiceNumber: inv.invoiceNumber
  });
});

// ==========================================
// 2. Commission Ledger (/api/commissions) - Strictly Company Owner/Admin ONLY
// ==========================================

commissionRouter.get('/', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const projects = (Array.isArray(db.projects) ? [...db.projects] : []).filter((p: any) =>
    isSameCompany(p, companyId)
  );

  const totalCommission = projects.reduce((acc, p) => acc + (p.commissionAmount || 0), 0);
  const paidCommission = projects
    .filter((p) => p.commissionStatus === 'paid')
    .reduce((acc, p) => acc + (p.commissionAmount || 0), 0);
  const pendingCommission = totalCommission - paidCommission;

  const bySalesperson: Record<string, { totalEarned: number; dealsClosed: number; pending: number }> = {};
  projects.forEach((p) => {
    const sp = p.assignedSalesperson || 'General Team';
    if (!bySalesperson[sp]) {
      bySalesperson[sp] = { totalEarned: 0, dealsClosed: 0, pending: 0 };
    }
    bySalesperson[sp].totalEarned += p.commissionAmount || 0;
    bySalesperson[sp].dealsClosed += 1;
    if (p.commissionStatus !== 'paid') {
      bySalesperson[sp].pending += p.commissionAmount || 0;
    }
  });

  return res.json({
    success: true,
    summary: {
      totalCommission,
      paidCommission,
      pendingCommission,
      tiers: [
        { tier: 'Tier 1: <= $300', rate: '25%', count: projects.filter((p) => (p.finalPrice || 0) <= 300).length },
        { tier: 'Tier 2: $300 - $700', rate: '30%', count: projects.filter((p) => (p.finalPrice || 0) > 300 && (p.finalPrice || 0) <= 700).length },
        { tier: 'Tier 3: > $700', rate: '35%', count: projects.filter((p) => (p.finalPrice || 0) > 700).length }
      ]
    },
    bySalesperson,
    ledger: projects.map((p) => ({
      projectId: p.id,
      clientName: p.clientName,
      salesperson: p.assignedSalesperson,
      projectValue: p.finalPrice,
      commissionRate: p.commissionRate,
      commissionAmount: p.commissionAmount,
      commissionStatus: p.commissionStatus
    }))
  });
});

commissionRouter.post('/:projectId/payout', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const project = (db.projects || []).find(
    (p: any) => p.id === req.params.projectId && isSameCompany(p, req.companyId!)
  );
  if (!project) return res.status(404).json({ error: 'Project not found' });

  project.commissionStatus = req.body.status || 'paid';
  project.updatedAt = new Date().toISOString();
  writeDB(db);

  return res.json({ success: true, project });
});

commissionRouter.get('/payouts', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const { status, salesperson } = req.query;
  let payouts = (db.commissionPayouts || []).filter((p: any) => isSameCompany(p, companyId));

  if (status && status !== 'all') payouts = payouts.filter((p: any) => p.status === status);
  if (salesperson && salesperson !== 'all') payouts = payouts.filter((p: any) => p.salesperson === salesperson);

  return res.json({ success: true, count: payouts.length, payouts });
});

commissionRouter.post('/approve/:id', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const payout: any = (db.commissionPayouts || []).find(
    (p: any) => p.id === req.params.id && isSameCompany(p, companyId)
  );
  if (!payout) {
    return res.status(404).json({ success: false, message: 'Payout record not found.' });
  }

  const prevStatus = payout.status;
  payout.status = 'approved';
  payout.approvedBy = req.user!.name;
  payout.approvedAt = new Date().toISOString();
  if (req.body?.adminNotes) payout.adminNotes = req.body.adminNotes;

  if (!db.commissionAuditLogs) db.commissionAuditLogs = [];
  db.commissionAuditLogs.unshift({
    id: `audit-${Date.now()}`,
    companyId,
    timestamp: new Date().toISOString(),
    adminUser: req.user!.name,
    action: 'approved',
    salesperson: payout.salesperson,
    projectId: payout.projectId,
    details: `Approved commission payout of $${payout.commissionAmount.toFixed(2)} USD for ${payout.salesperson}.`,
    previousValue: prevStatus,
    newValue: 'approved'
  });

  writeDB(db);
  return res.json({ success: true, message: `Payout for ${payout.salesperson} approved.`, payout });
});

commissionRouter.post('/mark-paid/:id', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const { payoutMethod, payoutTxRef } = req.body || {};

  const payout: any = (db.commissionPayouts || []).find(
    (p: any) => p.id === req.params.id && isSameCompany(p, companyId)
  );
  if (!payout) {
    return res.status(404).json({ success: false, message: 'Payout record not found.' });
  }

  const prevStatus = payout.status;
  payout.status = 'paid';
  payout.paidAt = new Date().toISOString();
  payout.payoutMethod = payoutMethod || payout.payoutMethod || 'Bank Wire Transfer';
  payout.payoutTxRef = payoutTxRef || `TX-COMM-${Date.now()}`;

  if (!db.commissionAuditLogs) db.commissionAuditLogs = [];
  db.commissionAuditLogs.unshift({
    id: `audit-${Date.now()}`,
    companyId,
    timestamp: new Date().toISOString(),
    adminUser: req.user!.name,
    action: 'paid',
    salesperson: payout.salesperson,
    projectId: payout.projectId,
    details: `Executed commission transfer ($${payout.commissionAmount.toFixed(2)} USD via ${payout.payoutMethod}).`,
    previousValue: prevStatus,
    newValue: 'paid'
  });

  writeDB(db);
  return res.json({ success: true, message: `Payout marked as PAID.`, payout });
});

commissionRouter.post('/tier-boost', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const { salesperson, boostPercent, reason } = req.body || {};

  const profile: any = (db.salespersonProfiles || []).find(
    (s: any) => s.name === salesperson && isSameCompany(s, companyId)
  );
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Salesperson profile not found.' });
  }

  const oldRate = profile.effectiveRate;
  const boost = Number(boostPercent) || 5;
  profile.bonusBoostRate = boost;
  profile.effectiveRate = Math.min(45, profile.baseRate + boost);
  profile.isBoostApproved = true;
  profile.currentTier = 'VIP High Performer';

  if (!db.commissionAuditLogs) db.commissionAuditLogs = [];
  db.commissionAuditLogs.unshift({
    id: `audit-${Date.now()}`,
    companyId,
    timestamp: new Date().toISOString(),
    adminUser: req.user!.name,
    action: 'tier_boost',
    salesperson,
    projectId: 'SYS_CONFIG',
    details: `Promoted ${salesperson} with +${boost}% boost. Reason: ${reason || 'High performance'}.`,
    previousValue: `${oldRate}%`,
    newValue: `${profile.effectiveRate}%`
  });

  writeDB(db);
  return res.json({ success: true, message: `${salesperson} boosted to ${profile.effectiveRate}%.`, profile });
});

commissionRouter.get('/audit-logs', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const logs = (db.commissionAuditLogs || []).filter((l: any) => isSameCompany(l, req.companyId!));
  return res.json({ success: true, logs });
});

commissionRouter.get('/sales-profiles', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const profiles = (db.salespersonProfiles || []).filter((p: any) => isSameCompany(p, req.companyId!));
  return res.json({ success: true, profiles });
});

// ==========================================
// 3. Executive Revenue Analytics (/api/analytics) - Strictly Company Owner/Admin ONLY
// ==========================================

analyticsRouter.get('/advanced', requireCompanyRole(['company_admin']), (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const dateRange = typeof req.query.dateRange === 'string' ? req.query.dateRange : 'all';
  const salesperson = typeof req.query.salesperson === 'string' ? req.query.salesperson : 'all';
  const tier = typeof req.query.tier === 'string' ? req.query.tier : 'all';

  let filtered = ((db.projects as any[]) || []).filter((p) => isSameCompany(p, companyId));

  if (salesperson !== 'all') {
    filtered = filtered.filter((p) => p.assignedSalesperson === salesperson);
  }
  if (tier === 'tier1') filtered = filtered.filter((p) => p.finalPrice <= 300);
  else if (tier === 'tier2') filtered = filtered.filter((p) => p.finalPrice > 300 && p.finalPrice <= 700);
  else if (tier === 'tier3') filtered = filtered.filter((p) => p.finalPrice > 700);

  const now = Date.now();
  if (dateRange === '7d') {
    filtered = filtered.filter((p) => now - new Date(p.createdAt || now).getTime() <= 7 * 86400000);
  } else if (dateRange === '30d') {
    filtered = filtered.filter((p) => now - new Date(p.createdAt || now).getTime() <= 30 * 86400000);
  } else if (dateRange === 'this_month') {
    const currentMonth = new Date().getMonth();
    filtered = filtered.filter((p) => new Date(p.createdAt || now).getMonth() === currentMonth);
  }

  const totalPipeline = filtered.reduce((acc, p) => acc + (p.finalPrice || 0), 0);
  const closedRevenue = filtered
    .filter((p) => p.domainTransferred || p.status === 'completed')
    .reduce((acc, p) => acc + (p.finalPrice || 0), 0);
  const advanceCollected = filtered.reduce((acc, p) => acc + (p.advancePaid ? p.advanceAmount || 0 : 0), 0);
  const balanceCollected = filtered.reduce((acc, p) => acc + (p.balancePaid ? p.balanceAmount || 0 : 0), 0);
  const totalCollected = advanceCollected + balanceCollected;
  const totalCommission = filtered.reduce((acc, p) => acc + (p.commissionAmount || 0), 0);
  const commissionPaid = filtered
    .filter((p) => p.commissionStatus === 'paid')
    .reduce((acc, p) => acc + (p.commissionAmount || 0), 0);
  const commissionPending = totalCommission - commissionPaid;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const slots = ['Morning (08-12)', 'Midday (12-16)', 'Afternoon (16-20)', 'Night (20-00)'];
  const heatmap: any[] = [];
  days.forEach((day) => {
    slots.forEach((slot) => {
      heatmap.push({ day, timeSlot: slot, activityCount: 0, revenueValue: 0 });
    });
  });

  const repStats: Record<string, any> = {};
  filtered.forEach((p) => {
    const rep = p.assignedSalesperson || 'General Team';
    if (!repStats[rep]) {
      repStats[rep] = {
        name: rep,
        dealsCount: 0,
        totalRevenue: 0,
        closedRevenue: 0,
        commissionsEarned: 0,
        tier1Deals: 0,
        tier2Deals: 0,
        tier3Deals: 0
      };
    }
    repStats[rep].dealsCount += 1;
    repStats[rep].totalRevenue += p.finalPrice || 0;
    if (p.domainTransferred || p.status === 'completed') repStats[rep].closedRevenue += p.finalPrice || 0;
    repStats[rep].commissionsEarned += p.commissionAmount || 0;
    if ((p.finalPrice || 0) <= 300) repStats[rep].tier1Deals += 1;
    else if ((p.finalPrice || 0) <= 700) repStats[rep].tier2Deals += 1;
    else repStats[rep].tier3Deals += 1;
  });

  return res.json({
    success: true,
    filtersApplied: { dateRange, salesperson, tier },
    kpis: {
      totalDeals: filtered.length,
      totalPipeline,
      closedRevenue,
      totalCollected,
      totalCommission,
      commissionPaid,
      commissionPending,
      avgDealSize: filtered.length ? Math.round(totalPipeline / filtered.length) : 0,
      conversionRate: filtered.length ? Math.round((closedRevenue / (totalPipeline || 1)) * 100) : 0
    },
    heatmap,
    repLeaderboard: Object.values(repStats)
  });
});

export default invoiceRouter;
