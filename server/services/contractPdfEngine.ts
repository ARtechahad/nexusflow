import { Router, Request, Response } from 'express';
import { readDB } from '../db';
import { logger } from '../logger';
import { AuditLogService } from './auditLogService';

export interface ContractGenerationRequest {
  projectId?: string;
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  websiteType: string;
  agreedPrice: number;
  paymentTerms?: string;
  deliverables?: string[];
  governingLaw?: string;
}

export function generateContractHTML(req: ContractGenerationRequest): string {
  const cName = req.clientName || 'Client';
  const cCompany = req.clientCompany ? ` (${req.clientCompany})` : '';
  const price = req.agreedPrice || 250;
  const advance = Number((price * 0.5).toFixed(2));
  const deliverables = req.deliverables?.length
    ? req.deliverables.map(d => `<li>${d}</li>`).join('')
    : `<li>Custom, mobile-responsive ${req.websiteType.toUpperCase()} website architecture</li>
       <li>Internal Staging Environment testing & QA prior to domain transfer</li>
       <li>Hostinger / Namecheap DNS & SSL certificate configuration</li>
       <li>Licensed stock imagery & copywriting assistance included</li>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Master Services Agreement - ${cName}${cCompany}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.6; }
    .header { border-b: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 22px; font-weight: bold; color: #4f46e5; }
    .title { font-size: 26px; font-weight: bold; margin-bottom: 10px; color: #0f172a; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: bold; color: #4f46e5; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 12px; }
    .price-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-top: 15px; }
    .signature-grid { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .sig-box { width: 45%; }
    .sig-line { border-bottom: 1px solid #0f172a; margin-top: 40px; margin-bottom: 5px; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">AgencyOps ALM &bull; Client Operations Suite</div>
    <div>Document Ref: MSA-${Date.now().toString().slice(-6)}</div>
  </div>

  <div class="title">WEB DEVELOPMENT MASTER SERVICES AGREEMENT</div>
  <p>This Master Services Agreement ("Agreement") is entered into as of <strong>${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</strong> by and between <strong>ClientOps Web Operations</strong> ("Agency") and <strong>${cName}${cCompany}</strong> ("Client").</p>

  <div class="section">
    <div class="section-title">1. PROJECT SCOPE & DELIVERABLES</div>
    <p>Agency agrees to perform design, engineering, and deployment services for Client's <strong>${req.websiteType.toUpperCase()}</strong> project according to the following inclusions:</p>
    <ul>
      ${deliverables}
    </ul>
  </div>

  <div class="section">
    <div class="section-title">2. FINANCIAL CONSIDERATION & MILESTONES (SOP RULE 5 & 8)</div>
    <p>Total Agreed Investment: <strong>$${price.toLocaleString()} USD</strong></p>
    <div class="price-box">
      <p><strong>Payment Milestone Breakdown:</strong></p>
      <p>&bull; <strong>50% Kick-Off Deposit ($${advance.toLocaleString()} USD):</strong> Due prior to initial discovery and internal staging environment activation.</p>
      <p>&bull; <strong>50% Final Balance Deposit ($${advance.toLocaleString()} USD):</strong> Due upon final staging sign-off, prior to live domain cutover and transfer.</p>
      <p><em>Strict SOP Section 8 Protocol: Live website transfer is strictly prohibited until final 50% balance is verified and cleared.</em></p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">3. GOVERNING LAW & ACCEPTANCE</div>
    <p>This Agreement shall be governed by international commercial standards and ${req.governingLaw || 'Delaware, USA jurisdiction'}. Both parties confirm acceptance of these terms.</p>
  </div>

  <div class="signature-grid">
    <div class="sig-box">
      <p><strong>For Agency:</strong></p>
      <p>Tariq Mehmood, Lead Director</p>
      <div class="sig-line"></div>
      <p>Authorized Signature & Date</p>
    </div>
    <div class="sig-box">
      <p><strong>For Client:</strong></p>
      <p>${cName}${cCompany}</p>
      <div class="sig-line"></div>
      <p>Authorized Signature & Date</p>
    </div>
  </div>
</body>
</html>`;
}

export const contractRouter = Router();

// POST /api/contracts/generate - Render dynamic client agreement
contractRouter.post('/generate', (req: Request, res: Response) => {
  const body: ContractGenerationRequest = req.body;
  if (!body.clientName || !body.websiteType) {
    return res.status(400).json({ success: false, error: 'clientName and websiteType are required.' });
  }

  const tenantId = (req as any).tenant_id || 'tenant-alm-nexus';
  const html = generateContractHTML(body);

  AuditLogService.log({
    tenantId,
    actorId: (req as any).user?.id || 'sales-user',
    actorName: (req as any).user?.name || 'Sales Director',
    actorRole: (req as any).user?.role || 'sales',
    action: 'CONTRACT_GENERATED',
    entityType: 'project',
    entityId: body.projectId || `contract_${Date.now()}`,
    ipAddress: req.ip || '127.0.0.1',
    details: { clientName: body.clientName, websiteType: body.websiteType, agreedPrice: body.agreedPrice }
  });

  res.json({
    success: true,
    data: {
      contractId: `contract_${Date.now()}`,
      clientName: body.clientName,
      websiteType: body.websiteType,
      agreedPrice: body.agreedPrice,
      htmlContent: html,
      generatedAt: new Date().toISOString()
    }
  });
});

// GET /api/contracts/:id/pdf - Return formatted agreement printable document
contractRouter.get('/:id/pdf', (req: Request, res: Response) => {
  const db = readDB();
  const proj = (db.projects || []).find((p: any) => p.id === req.params.id);

  const reqData: ContractGenerationRequest = {
    projectId: req.params.id,
    clientName: proj ? proj.clientName : 'Valued Client',
    clientCompany: proj ? proj.clientCompany : 'Client Enterprise',
    websiteType: proj ? proj.websiteType : 'corporate',
    agreedPrice: proj ? proj.finalPrice : 500
  };

  const html = generateContractHTML(reqData);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
