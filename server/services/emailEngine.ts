import { Router, Request, Response } from 'express';
import { readDB, writeDB } from '../db';
import { logger } from '../logger';
import { queueEngine } from './queueEngine';

export interface EmailDispatchOptions {
  tenantId: string;
  to: string;
  clientName?: string;
  subject: string;
  template: 'proposal' | 'advance_reminder' | 'staging_ready' | 'invoice_receipt' | 'general';
  variables?: Record<string, any>;
}

export function renderEmailTemplate(template: string, vars: Record<string, any> = {}): string {
  const cName = vars.clientName || 'Valued Client';
  const cCompany = vars.clientCompany || 'your business';
  const amount = vars.amount ? `$${vars.amount.toLocaleString()}` : '$250';

  if (template === 'proposal') {
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #4f46e5; margin-top: 0;">Web Development Proposal & Scoping</h2>
      <p>Dear ${cName},</p>
      <p>Thank you for consulting with ClientOps regarding ${cCompany}'s web development project.</p>
      <p><strong>Proposed Scope:</strong> ${vars.websiteType || 'Custom Website Development'}</p>
      <p><strong>Investment:</strong> ${amount} USD</p>
      <p><strong>Milestones (SOP Rule 5):</strong></p>
      <ul>
        <li>50% upfront deposit to initiate sprint dates</li>
        <li>50% balance payment upon final staging approval before domain transfer</li>
      </ul>
      <p>Best regards,<br>Sales & Coordination Team</p>
    </div>`;
  }

  if (template === 'advance_reminder') {
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f59e0b; border-radius: 12px; background-color: #fffbeb;">
      <h2 style="color: #d97706; margin-top: 0;">Reminder: 50% Kick-Off Milestone Pending</h2>
      <p>Hello ${cName},</p>
      <p>Just a quick update regarding ${cCompany}'s website setup. Your dedicated staging slot is ready for activation upon clearance of the 50% advance deposit (${amount} USD).</p>
      <p>Best regards,<br>Client Operations</p>
    </div>`;
  }

  if (template === 'roi_breakdown') {
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #4f46e5, #2563eb); padding: 18px; border-radius: 12px; color: #ffffff; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 800;">LeadFlow &bull; Outbound Pipeline ROI Projection</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Custom Revenue & Pipeline Velocity Modeling for ${cCompany}</p>
      </div>
      <p>Dear ${cName},</p>
      <p>Thank you for modeling your pipeline with the LeadFlow Outbound ROI Simulator. Below is your detailed revenue projection breakdown:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b;">Average Deal Size (ACV):</td><td style="padding: 10px 0; font-weight: bold; text-align: right;">$${(vars.dealSize || 6500).toLocaleString()}</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b;">Monthly Verified Prospects:</td><td style="padding: 10px 0; font-weight: bold; text-align: right;">${(vars.prospectsPerMonth || 2500).toLocaleString()}</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b;">Projected Qualified SQLs / mo:</td><td style="padding: 10px 0; font-weight: bold; text-align: right; color: #4f46e5;">${vars.projectedMeetings || 18} meetings</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b;">Monthly Pipeline Velocity:</td><td style="padding: 10px 0; font-weight: bold; text-align: right;">$${((vars.monthlyPipeline || 117000) / 1000).toFixed(0)}k</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b;">Projected Closed Revenue / mo:</td><td style="padding: 10px 0; font-weight: bold; text-align: right; color: #10b981; font-size: 16px;">$${((vars.projectedRevenue || 26000) / 1000).toFixed(0)}k</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b;">Estimated Net Profit:</td><td style="padding: 10px 0; font-weight: bold; text-align: right; color: #10b981;">+$${((vars.netProfit || 23010) / 1000).toFixed(0)}k</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 0; color: #64748b;">Expected Revenue Multiple:</td><td style="padding: 10px 0; font-weight: bold; text-align: right; color: #4f46e5; font-size: 16px;">${vars.roiMultiple || 8.7}x ROI</td></tr>
      </table>
      <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px; border-radius: 6px; font-size: 13px; color: #475569; margin: 20px 0;">
        <strong>Next Step:</strong> Our team handles prospect research, copy testing, inbox warmup, and reply handling on a managed retainer. You can launch your campaign in 7 business days.
      </div>
      <p style="font-size: 13px; color: #64748b;">Best regards,<br><strong>LeadFlow Outbound Team</strong> &bull; ALM Nexus Enterprise</p>
    </div>`;
  }

  return `<div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
    <p>Dear ${cName},</p>
    <p>${vars.body || 'Thank you for connecting with ClientOps.'}</p>
  </div>`;
}

import { resendService } from './resendService';
import { requireClerkAuth } from '../middlewares/clerkAuth';

export const emailRouter = Router();

// POST /api/email/send or /api/emails/send - Dispatch email via Resend (guarded by requireClerkAuth)
emailRouter.post(['/send', '/dispatch'], requireClerkAuth, async (req: Request, res: Response) => {
  const body: EmailDispatchOptions & {
    html?: string;
    text?: string;
    from?: string;
    fromName?: string;
    replyTo?: string;
    immediate?: boolean;
    attachments?: any[];
    tags?: any[];
  } = req.body;

  if (!body.to || !body.subject) {
    res.status(400).json({ success: false, error: 'Recipient email (to) and subject are required.' });
    return;
  }

  const tenantId = (req as any).userId ? ((req as any).orgId || (req as any).tenant_id || 'tenant-alm-nexus') : ((req as any).tenant_id || 'tenant-alm-nexus');
  const htmlContent = body.html || renderEmailTemplate(body.template || 'general', {
    clientName: body.clientName,
    ...body.variables
  });

  try {
    // If client requested immediate direct dispatch (default: true for Resend)
    const result = await resendService.sendEmail({
      to: body.to,
      subject: body.subject,
      html: htmlContent,
      text: body.text,
      from: body.from,
      fromName: body.fromName,
      replyTo: body.replyTo,
      attachments: body.attachments,
      tags: body.tags,
      tenantId,
      template: body.template || 'transactional',
      metadata: {
        clientName: body.clientName,
        queuedBy: (req as any).userId || (req as any).user?.id || 'system'
      }
    });

    res.json({
      success: result.success,
      message: result.success
        ? `Email successfully dispatched via Resend to ${body.to}`
        : `Email queued with resilient fallback: ${result.error || 'Simulated delivery'}`,
      data: {
        messageId: result.messageId,
        recipient: body.to,
        from: result.from,
        subject: body.subject,
        provider: result.provider,
        status: result.success ? 'delivered' : 'pending_retry',
        telemetryId: result.telemetryId
      }
    });
  } catch (err: any) {
    logger.error(`[EmailEngine] Unexpected dispatch error: ${err.message}`, { context: 'EmailEngine' });
    res.status(500).json({
      success: false,
      error: `Failed to dispatch email: ${err.message}`
    });
  }
});

// GET /api/email/logs - Retrieve recent email telemetry from Neon Database
emailRouter.get('/logs', requireClerkAuth, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).orgId || (req as any).tenant_id || 'tenant-alm-nexus';
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const logs = await resendService.getRecentLogs(tenantId, limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/email/status - Resend engine diagnostic health check
emailRouter.get(['/status', '/test'], async (req: Request, res: Response) => {
  try {
    const testRes = await resendService.testConnection();
    res.json({ success: testRes.ok, ...testRes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/email/track/:id - Open pixel tracking simulation
emailRouter.get('/track/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info(`Email tracking pixel opened for message ${id}`, { context: 'EmailEngine' });

  const transparentPixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': transparentPixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private'
  });
  res.end(transparentPixel);
});
