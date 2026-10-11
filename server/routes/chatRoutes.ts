import { Router, Request, Response } from 'express';
import { readDB, writeDB } from '../db';

const router = Router();

// GET /api/chat & /api/chat/messages
router.get('/', (req: Request, res: Response) => {
  const db = readDB();
  const channel = typeof req.query.channel === 'string' ? req.query.channel : '';
  const tenantId = (req as any).tenant_id || (req.query.tenant_id as string) || (req.query.tenantId as string);
  let messages = db.chatMessages || [];
  if (tenantId && tenantId !== 'all') {
    messages = messages.filter((m: any) => !m.tenantId || m.tenantId === tenantId || m.tenant_id === tenantId);
  }
  if (channel) {
    messages = messages.filter((m: any) => m.channel === channel);
  }
  res.json({ success: true, messages });
});

router.get('/messages', (req: Request, res: Response) => {
  const db = readDB();
  const channel = typeof req.query.channel === 'string' ? req.query.channel : '';
  const tenantId = (req as any).tenant_id || (req.query.tenant_id as string) || (req.query.tenantId as string);
  let messages = db.chatMessages || [];
  if (tenantId && tenantId !== 'all') {
    messages = messages.filter((m: any) => !m.tenantId || m.tenantId === tenantId || m.tenant_id === tenantId);
  }
  if (channel) {
    messages = messages.filter((m: any) => m.channel === channel);
  }
  res.json({ success: true, messages });
});

// POST /api/chat & /api/chat/messages
const handleCreateChatMessage = (req: Request, res: Response) => {
  const db = readDB();
  const { senderId, senderName, senderRole, channel, content, attachmentName, attachmentUrl, tenantId: bodyTenantId } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  const activeTenantId = bodyTenantId || (req as any).tenant_id || 'tenant-alm-nexus';

  const newMessage = {
    id: `msg-${Date.now()}`,
    tenantId: activeTenantId,
    tenant_id: activeTenantId,
    senderId: senderId || 'user-anon',
    senderName: senderName || 'Team Member',
    senderRole: senderRole || 'sales',
    channel: channel || 'general',
    content: content.trim(),
    timestamp: new Date().toISOString(),
    attachmentName: attachmentName || undefined,
    attachmentUrl: attachmentUrl || undefined,
    reactions: {}
  };

  if (!Array.isArray(db.chatMessages)) db.chatMessages = [];
  (db.chatMessages as any).push(newMessage);
  writeDB(db);

  res.status(201).json({ success: true, message: newMessage });
};

router.post('/', handleCreateChatMessage);
router.post('/messages', handleCreateChatMessage);

export default router;
