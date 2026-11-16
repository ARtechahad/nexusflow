import { Router, Response } from 'express';
import crypto from 'crypto';
import { readDB, writeDB } from '../db';
import {
  AuthenticatedRequest,
  hasDepartmentAccess,
  requireCompanyAccess
} from '../middlewares/auth';
import { realtimeEngine } from '../services/realtimeEngine';

const router = Router();

function handleGetMessages(req: AuthenticatedRequest, res: Response) {
  const db = readDB();
  const companyId = req.companyId!;
  const channel = typeof req.query.channel === 'string' ? req.query.channel.trim() : '';
  const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId.trim() : '';

  if (departmentId) {
    const deptExists = (db.departments || []).some(
      (d: any) => d.id === departmentId && d.companyId === companyId
    );
    if (!deptExists) {
      return res.status(404).json({ success: false, error: 'Department not found in this company.' });
    }
    if (!hasDepartmentAccess(req.membership, departmentId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Private department chat is strictly restricted to department members.'
      });
    }
  }

  let messages = (db.chatMessages || []).filter(
    (m: any) => m.companyId === companyId || m.tenantId === companyId || m.tenant_id === companyId
  );

  if (departmentId) {
    messages = messages.filter((m: any) => m.departmentId === departmentId);
  } else if (req.companyRole !== 'company_admin') {
    const allowedDepts = req.membership?.departmentIds || [];
    messages = messages.filter((m: any) => m.departmentId && allowedDepts.includes(m.departmentId));
  }

  if (channel) {
    messages = messages.filter((m: any) => m.channel === channel);
  }

  return res.json({ success: true, messages });
}

const handleCreateChatMessage = (req: AuthenticatedRequest, res: Response) => {
  const db = readDB();
  const companyId = req.companyId!;
  const { channel, content, attachmentName, attachmentUrl, departmentId, isStatusUpdate } = req.body || {};

  if (!content || !String(content).trim()) {
    return res.status(400).json({ success: false, error: 'Message content is required.' });
  }

  const targetDeptId = typeof departmentId === 'string' ? departmentId.trim() : '';

  if (targetDeptId) {
    const deptExists = (db.departments || []).some(
      (d: any) => d.id === targetDeptId && d.companyId === companyId
    );
    if (!deptExists) {
      return res.status(404).json({ success: false, error: 'Department not found in this company.' });
    }
    if (!hasDepartmentAccess(req.membership, targetDeptId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You cannot post messages to another department chat.'
      });
    }
  } else if (req.companyRole !== 'company_admin') {
    return res.status(400).json({
      success: false,
      error: 'departmentId is required for department-scoped team members.'
    });
  }

  const newMessage = {
    id: `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    companyId,
    tenantId: companyId,
    tenant_id: companyId,
    departmentId: targetDeptId || undefined,
    senderId: req.user!.id,
    senderName: req.user!.name,
    senderRole: req.companyRole || req.user!.role,
    senderDesignation: req.membership?.designation || '',
    channel: channel || (isStatusUpdate ? 'work-status' : 'general'),
    isStatusUpdate: Boolean(isStatusUpdate),
    content: String(content).trim(),
    timestamp: new Date().toISOString(),
    attachmentName: attachmentName || undefined,
    attachmentUrl: attachmentUrl || undefined,
    reactions: {}
  };

  if (!Array.isArray(db.chatMessages)) db.chatMessages = [];
  db.chatMessages.push(newMessage);
  writeDB(db);

  if (targetDeptId) {
    realtimeEngine.broadcastToDepartment(companyId, targetDeptId, 'chat:message', newMessage);
  } else {
    realtimeEngine.broadcastToCompany(companyId, 'chat:message', newMessage);
  }

  return res.status(201).json({ success: true, message: newMessage });
};

router.get('/', requireCompanyAccess, handleGetMessages);
router.get('/messages', requireCompanyAccess, handleGetMessages);
router.post('/', requireCompanyAccess, handleCreateChatMessage);
router.post('/messages', requireCompanyAccess, handleCreateChatMessage);

export default router;
