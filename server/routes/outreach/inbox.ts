import express, { Request, Response } from 'express';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { authenticateToken } from '../../middlewares/auth';
import { getOutreachPool } from '../../services/outreach/schema';
import { logger } from '../../logger';
import { decryptSecret } from '../../services/outreach/crypto';
import { checkAndReserve } from '../../services/outreach/capGuard';
import { getGeminiClient, DEFAULT_GEMINI_MODEL } from '../../services/geminiService';
import { realtimeEngine } from '../../services/realtimeEngine';
import { readDB, writeDB } from '../../db';

export const outreachInboxRouter = express.Router();

// ----------------------------------------------------
// 1. GET /inbox/threads — List threads with filters & search
// ----------------------------------------------------
outreachInboxRouter.get('/inbox/threads', authenticateToken, async (req: Request, res: Response) => {
  const tenantId = (req as any).user?.tenant_id || (req as any).user?.tenantId || 'tenant-alm-nexus';
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'Database unavailable' });
    return;
  }

  const { label, mailboxId, campaignId, unread, search, archived } = req.query;

  try {
    let query = `
      SELECT t.id, t.tenant_id, t.mailbox_id, t.prospect_email, t.subject,
             t.last_message_at, t.status, t.label, t.is_unread, t.is_archived,
             t.campaign_id, t.enrollment_id, t.snippet, t.created_at, t.updated_at,
             m.email as mailbox_email, m.sender_name as mailbox_sender_name,
             c.name as campaign_name,
             (SELECT COUNT(*) FROM ox_messages m2 WHERE m2.thread_id = t.id) as message_count
      FROM ox_threads t
      JOIN ox_mailboxes m ON m.id = t.mailbox_id
      LEFT JOIN ox_campaigns c ON c.id = t.campaign_id
      WHERE t.tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (archived === 'true') {
      query += ` AND t.is_archived = true`;
    } else {
      query += ` AND (t.is_archived IS NULL OR t.is_archived = false)`;
    }

    if (label && label !== 'all') {
      query += ` AND t.label = $${paramIdx++}`;
      params.push(label);
    }

    if (mailboxId && mailboxId !== 'all') {
      query += ` AND t.mailbox_id = $${paramIdx++}`;
      params.push(mailboxId);
    }

    if (campaignId && campaignId !== 'all') {
      query += ` AND t.campaign_id = $${paramIdx++}`;
      params.push(campaignId);
    }

    if (unread === 'true') {
      query += ` AND t.is_unread = true`;
    }

    if (search && typeof search === 'string' && search.trim()) {
      query += ` AND (t.prospect_email ILIKE $${paramIdx} OR t.subject ILIKE $${paramIdx} OR t.snippet ILIKE $${paramIdx})`;
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    query += ` ORDER BY t.last_message_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    // Also get quick count stats
    const statsRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_unread = true) as unread_count,
         COUNT(*) FILTER (WHERE label = 'interested') as interested_count,
         COUNT(*) FILTER (WHERE label = 'question') as question_count,
         COUNT(*) FILTER (WHERE label = 'not_interested') as not_interested_count,
         COUNT(*) as total_count
       FROM ox_threads
       WHERE tenant_id = $1 AND (is_archived IS NULL OR is_archived = false)`,
      [tenantId]
    );

    const stats = statsRes.rows[0] || {};

    res.json({
      success: true,
      threads: result.rows,
      stats: {
        total: parseInt(stats.total_count || '0', 10),
        unread: parseInt(stats.unread_count || '0', 10),
        interested: parseInt(stats.interested_count || '0', 10),
        question: parseInt(stats.question_count || '0', 10),
        notInterested: parseInt(stats.not_interested_count || '0', 10)
      }
    });
  } catch (err: any) {
    logger.error('Failed to list outreach inbox threads', { details: err?.message });
    res.status(500).json({ error: err?.message || 'Failed to list threads' });
  }
});

// ----------------------------------------------------
// 2. GET /inbox/threads/:id — Thread detail with all messages
// ----------------------------------------------------
outreachInboxRouter.get('/inbox/threads/:id', authenticateToken, async (req: Request, res: Response) => {
  const threadId = req.params.id;
  const tenantId = (req as any).user?.tenant_id || (req as any).user?.tenantId || 'tenant-alm-nexus';
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'Database unavailable' });
    return;
  }

  try {
    const threadRes = await pool.query(
      `SELECT t.*, m.email as mailbox_email, m.sender_name as mailbox_sender_name,
              c.name as campaign_name
       FROM ox_threads t
       JOIN ox_mailboxes m ON m.id = t.mailbox_id
       LEFT JOIN ox_campaigns c ON c.id = t.campaign_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [threadId, tenantId]
    );

    if (threadRes.rowCount === 0) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const thread = threadRes.rows[0];

    // Mark as read
    await pool.query(
      `UPDATE ox_threads SET is_unread = false, updated_at = NOW() WHERE id = $1`,
      [threadId]
    );

    // Fetch messages in this thread
    const msgRes = await pool.query(
      `SELECT id, thread_id, mailbox_id, direction, from_email, to_email,
              subject, body_text, body_html, message_id_header, received_at, created_at
       FROM ox_messages
       WHERE thread_id = $1 AND tenant_id = $2
       ORDER BY received_at ASC, created_at ASC`,
      [threadId, tenantId]
    );

    res.json({
      success: true,
      thread: {
        ...thread,
        is_unread: false
      },
      messages: msgRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch thread' });
  }
});

// ----------------------------------------------------
// 3. POST /inbox/threads/:id/reply — Send manual reply through Cap Guard
// ----------------------------------------------------
outreachInboxRouter.post('/inbox/threads/:id/reply', authenticateToken, async (req: Request, res: Response) => {
  const threadId = req.params.id;
  const tenantId = (req as any).user?.tenant_id || (req as any).user?.tenantId || 'tenant-alm-nexus';
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'Database unavailable' });
    return;
  }

  const { bodyText, subject: customSubject } = req.body;
  if (!bodyText || typeof bodyText !== 'string' || !bodyText.trim()) {
    res.status(400).json({ error: 'Message body is required' });
    return;
  }

  try {
    // 1. Fetch thread and mailbox
    const threadRes = await pool.query(
      `SELECT t.*, m.email as mailbox_email, m.sender_name as mailbox_sender_name,
              m.smtp_host, m.smtp_port, m.smtp_user, m.smtp_pass_encrypted, m.signature
       FROM ox_threads t
       JOIN ox_mailboxes m ON m.id = t.mailbox_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [threadId, tenantId]
    );

    if (threadRes.rowCount === 0) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const thread = threadRes.rows[0];

    // 2. Fetch last inbound message to construct In-Reply-To and References
    const lastMsgRes = await pool.query(
      `SELECT message_id_header, references_header
       FROM ox_messages
       WHERE thread_id = $1 AND direction = 'inbound'
       ORDER BY received_at DESC LIMIT 1`,
      [threadId]
    );
    const lastMsg = lastMsgRes.rows[0];

    // 3. Cap Guard validation
    const capCheck = await checkAndReserve({
      tenantId,
      mailboxId: thread.mailbox_id,
      campaignId: thread.campaign_id,
      prospectEmail: thread.prospect_email,
      kind: 'campaign',
      pool
    });

    if (!capCheck.allowed) {
      res.status(429).json({
        error: `Sending limit reached: ${capCheck.reason}. Please try again later.`,
        retryAt: capCheck.retryAt
      });
      return;
    }

    // 4. Decrypt SMTP secret
    let smtpPassword = '';
    try {
      smtpPassword = decryptSecret(thread.smtp_pass_encrypted);
    } catch {
      res.status(500).json({ error: 'Unable to decrypt mailbox credentials' });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: thread.smtp_host,
      port: thread.smtp_port || 587,
      secure: thread.smtp_port === 465,
      auth: {
        user: thread.smtp_user || thread.mailbox_email,
        pass: smtpPassword
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
        minVersion: 'TLSv1.2'
      }
    });

    const replySubject =
      customSubject ||
      (thread.subject?.toLowerCase().startsWith('re:') ? thread.subject : `Re: ${thread.subject || 'Outreach'}`);

    let formattedBodyHtml = bodyText.replace(/\n/g, '<br>');
    if (thread.signature) {
      formattedBodyHtml += `<br><br>${thread.signature}`;
    }

    const newMsgId = `<${crypto.randomUUID()}@${thread.mailbox_email.split('@')[1] || 'leadflow.ai'}>`;

    const referencesHeader = lastMsg?.references_header
      ? `${lastMsg.references_header} ${lastMsg.message_id_header || ''}`.trim()
      : lastMsg?.message_id_header || '';

    // 5. Send Email
    await transporter.sendMail({
      from: `"${thread.mailbox_sender_name}" <${thread.mailbox_email}>`,
      to: thread.prospect_email,
      subject: replySubject,
      text: bodyText + (thread.signature ? `\n\n${thread.signature}` : ''),
      html: formattedBodyHtml,
      messageId: newMsgId,
      inReplyTo: lastMsg?.message_id_header || undefined,
      references: referencesHeader || undefined
    });

    // 6. Record outbound message in ox_messages
    const newMsgRecordId = `msg_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO ox_messages
       (id, tenant_id, thread_id, mailbox_id, direction, from_email, to_email,
        subject, body_text, body_html, message_id_header, in_reply_to_header,
        references_header, received_at)
       VALUES ($1, $2, $3, $4, 'outbound', $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
      [
        newMsgRecordId,
        tenantId,
        threadId,
        thread.mailbox_id,
        thread.mailbox_email,
        thread.prospect_email,
        replySubject,
        bodyText,
        formattedBodyHtml,
        newMsgId,
        lastMsg?.message_id_header || null,
        referencesHeader || null
      ]
    );

    // 7. Update ox_threads
    await pool.query(
      `UPDATE ox_threads
       SET last_message_at = NOW(),
           snippet = $1,
           is_unread = false,
           updated_at = NOW()
       WHERE id = $2`,
      [bodyText.slice(0, 160), threadId]
    );

    res.json({
      success: true,
      messageId: newMsgId,
      message: 'Reply sent successfully'
    });
  } catch (err: any) {
    logger.error('Failed to send thread reply', { details: err?.message });
    res.status(500).json({ error: err?.message || 'Failed to send reply' });
  }
});

// ----------------------------------------------------
// 4. PATCH /inbox/threads/:id — Update label, read/unread, archive
// ----------------------------------------------------
outreachInboxRouter.patch('/inbox/threads/:id', authenticateToken, async (req: Request, res: Response) => {
  const threadId = req.params.id;
  const tenantId = (req as any).user?.tenant_id || (req as any).user?.tenantId || 'tenant-alm-nexus';
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'Database unavailable' });
    return;
  }

  const { label, is_unread, is_archived } = req.body;

  try {
    const threadRes = await pool.query(
      `SELECT * FROM ox_threads WHERE id = $1 AND tenant_id = $2`,
      [threadId, tenantId]
    );

    if (threadRes.rowCount === 0) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const thread = threadRes.rows[0];

    // If changing to 'unsubscribe', ensure added to suppression
    if (label === 'unsubscribe') {
      await pool.query(
        `INSERT INTO ox_suppressions (id, tenant_id, email, reason, source, created_at)
         VALUES ($1, $2, LOWER($3), 'unsubscribe', 'manual_thread_label', NOW())
         ON CONFLICT (tenant_id, email)
         DO UPDATE SET reason = 'unsubscribe', updated_at = NOW()`,
        [`sup_${crypto.randomUUID()}`, tenantId, thread.prospect_email]
      );

      await pool.query(
        `UPDATE ox_enrollments
         SET status = 'unsubscribed', updated_at = NOW()
         WHERE tenant_id = $1
           AND prospect_id IN (
             SELECT id FROM ox_prospects WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)
           )
           AND status = 'active'`,
        [tenantId, thread.prospect_email]
      );
    }

    const updateRes = await pool.query(
      `UPDATE ox_threads
       SET label = COALESCE($1, label),
           is_unread = COALESCE($2, is_unread),
           is_archived = COALESCE($3, is_archived),
           updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [label || null, is_unread ?? null, is_archived ?? null, threadId, tenantId]
    );

    res.json({
      success: true,
      thread: updateRes.rows[0]
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update thread' });
  }
});

// ----------------------------------------------------
// 5. POST /inbox/threads/:id/suggest-reply — AI Suggest Reply (Gemini)
// ----------------------------------------------------
outreachInboxRouter.post('/inbox/threads/:id/suggest-reply', authenticateToken, async (req: Request, res: Response) => {
  const threadId = req.params.id;
  const tenantId = (req as any).user?.tenant_id || (req as any).user?.tenantId || 'tenant-alm-nexus';
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'Database unavailable' });
    return;
  }

  try {
    const threadRes = await pool.query(
      `SELECT t.*, m.sender_name as mailbox_sender_name, m.email as mailbox_email
       FROM ox_threads t
       JOIN ox_mailboxes m ON m.id = t.mailbox_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [threadId, tenantId]
    );

    if (threadRes.rowCount === 0) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const thread = threadRes.rows[0];

    const msgsRes = await pool.query(
      `SELECT direction, from_email, to_email, subject, body_text
       FROM ox_messages
       WHERE thread_id = $1 AND tenant_id = $2
       ORDER BY received_at DESC LIMIT 5`,
      [threadId, tenantId]
    );

    const history = msgsRes.rows.reverse().map(m => `[${m.direction.toUpperCase()}]: ${m.body_text}`).join('\n\n');

    const ai = getGeminiClient();
    if (!ai) {
      // Deterministic fallback templates
      const fallbackSuggestions = [
        `Hi there,\n\nThanks for getting back to me! I would love to hop on a quick 15-minute call to show you how our platform works and see if it's a good fit.\n\nDoes Tuesday or Wednesday afternoon work for you?\n\nBest,\n${thread.mailbox_sender_name}`,
        `Hi,\n\nThanks for your note. Regarding your question, we offer seamless cold email delivery with multi-mailbox rotation and verified domain deliverability. Would you like me to send over our product overview deck?\n\nBest,\n${thread.mailbox_sender_name}`
      ];
      res.json({ success: true, suggestions: fallbackSuggestions, isFallback: true });
      return;
    }

    const prompt = `You are an expert enterprise outbound sales executive representing "${thread.mailbox_sender_name}".
Analyze the conversation history with recipient "${thread.prospect_email}" (Thread Subject: "${thread.subject}", Classification Label: "${thread.label}"):

CONVERSATION:
${history}

Draft 2 short, high-converting, professional reply options:
1. Option 1: Direct & warm call invitation (e.g. suggesting 15 minutes this week).
2. Option 2: Value-focused answer addressing any questions or hesitations directly.

Respond ONLY with valid JSON in this format:
{
  "suggestions": [
    "Option 1 reply text...",
    "Option 2 reply text..."
  ]
}`;

    const aiRes = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(aiRes.text?.trim() || '{"suggestions":[]}');
    res.json({
      success: true,
      suggestions: parsed.suggestions || [],
      isFallback: false
    });
  } catch (err: any) {
    logger.warn('AI reply generation fallback', { details: err?.message });
    res.json({
      success: true,
      suggestions: [
        `Hi,\n\nThanks for connecting! When would be a convenient time for a brief 15-minute discovery chat this week?\n\nBest,\nSales Team`
      ],
      isFallback: true
    });
  }
});

// ----------------------------------------------------
// 6. POST /inbox/threads/:id/create-lead — Convert interested thread to CRM lead
// ----------------------------------------------------
outreachInboxRouter.post('/inbox/threads/:id/create-lead', authenticateToken, async (req: Request, res: Response) => {
  const threadId = req.params.id;
  const tenantId = (req as any).user?.tenant_id || (req as any).user?.tenantId || 'tenant-alm-nexus';
  const pool = getOutreachPool();
  if (!pool) {
    res.status(500).json({ error: 'Database unavailable' });
    return;
  }

  try {
    const threadRes = await pool.query(
      `SELECT t.*, c.name as campaign_name
       FROM ox_threads t
       LEFT JOIN ox_campaigns c ON c.id = t.campaign_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [threadId, tenantId]
    );

    if (threadRes.rowCount === 0) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const thread = threadRes.rows[0];

    // Mark thread as interested
    await pool.query(
      `UPDATE ox_threads SET label = 'interested', updated_at = NOW() WHERE id = $1`,
      [threadId]
    );

    // Create lead in main DB
    const db = await readDB();
    const leadId = `lead_${crypto.randomUUID().slice(0, 8)}`;
    const emailParts = thread.prospect_email.split('@');
    const clientName = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
    const domain = emailParts[1] || 'Company';
    const companyName = domain.split('.')[0].toUpperCase();

    const newLead = {
      id: leadId,
      name: `${clientName} (${companyName})`,
      client: clientName,
      company: companyName,
      status: 'discovery',
      leadScore: 85,
      tenantId,
      email: thread.prospect_email,
      source: `Outreach Suite - ${thread.campaign_name || 'Cold Campaign'}`,
      description: `Inbound positive response: "${thread.snippet || thread.subject}"`,
      createdAt: new Date().toISOString()
    };

    if (!db.projects) db.projects = [];
    db.projects.push(newLead);
    await writeDB(db);

    res.json({
      success: true,
      leadId,
      message: `Lead created successfully in CRM Pipeline for ${thread.prospect_email}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create lead' });
  }
});
