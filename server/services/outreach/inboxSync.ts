import pg from 'pg';
import crypto from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';
import { decryptSecret } from './crypto';
import { classifyInboundReply, OutreachReplyLabel } from './classifier';
import { realtimeEngine } from '../realtimeEngine';

export interface DsnBounceResult {
  isBounce: boolean;
  isHardBounce: boolean;
  bouncedEmail?: string;
  diagnosticCode?: string;
}

/**
 * Robust detection of DSN / Mail Delivery Subsystem bounces
 */
export function isDsnBounceMessage(
  headers: Map<string, any> | Record<string, any>,
  subject: string = '',
  fromEmail: string = '',
  bodyText: string = ''
): DsnBounceResult {
  const getHeader = (name: string): string => {
    if (headers instanceof Map) {
      return String(headers.get(name) || '');
    }
    return String((headers as any)[name] || '');
  };

  const contentType = getHeader('content-type').toLowerCase();
  const lowerFrom = fromEmail.toLowerCase();
  const lowerSubj = subject.toLowerCase();
  const lowerBody = bodyText.toLowerCase();

  const isBounceSender =
    lowerFrom.includes('mailer-daemon') ||
    lowerFrom.includes('postmaster') ||
    lowerFrom.includes('mail delivery subsystem') ||
    lowerFrom.includes('mail delivery system') ||
    lowerFrom.includes('noreply') && lowerSubj.includes('undelivered');

  const isBounceContentType =
    contentType.includes('multipart/report') ||
    contentType.includes('message/delivery-status');

  const isBounceSubject =
    lowerSubj.includes('delivery status notification') ||
    lowerSubj.includes('undelivered mail returned') ||
    lowerSubj.includes('mail delivery failed') ||
    lowerSubj.includes('returned mail: see transcript') ||
    lowerSubj.includes('failure notice') ||
    lowerSubj.includes('undeliverable:') ||
    lowerSubj.includes('permanent delivery failure');

  const isBounce = isBounceSender || isBounceContentType || isBounceSubject;
  if (!isBounce) {
    return { isBounce: false, isHardBounce: false };
  }

  // Detect hard bounce vs soft bounce (5.x.x status or mailbox unavailable)
  const isHardBounce =
    lowerBody.includes('5.1.1') ||
    lowerBody.includes('5.0.0') ||
    lowerBody.includes('user unknown') ||
    lowerBody.includes('recipient address rejected') ||
    lowerBody.includes('no such user') ||
    lowerBody.includes('does not exist') ||
    lowerBody.includes('mailbox unavailable') ||
    lowerBody.includes('permanent failure') ||
    !lowerBody.includes('temporary');

  // Extract bounced recipient email address
  let bouncedEmail: string | undefined;

  // Pattern 1: Final-Recipient: rfc822; user@domain.com
  const finalRecipientMatch = bodyText.match(/final-recipient:[^;]+;\s*([^\s\r\n<>]+@[^\s\r\n<>]+)/i);
  if (finalRecipientMatch) {
    bouncedEmail = finalRecipientMatch[1].trim();
  }

  // Pattern 2: Original-Recipient: rfc822; user@domain.com
  if (!bouncedEmail) {
    const origRecipientMatch = bodyText.match(/original-recipient:[^;]+;\s*([^\s\r\n<>]+@[^\s\r\n<>]+)/i);
    if (origRecipientMatch) {
      bouncedEmail = origRecipientMatch[1].trim();
    }
  }

  // Pattern 3: Look for email after "was not delivered to:" or "<user@domain.com>"
  if (!bouncedEmail) {
    const genericEmailMatch = bodyText.match(/(?:to|address|recipient):?\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/i) ||
      bodyText.match(/<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>:\s*(?:5\.\d\.\d|user unknown|no such user)/i);
    if (genericEmailMatch) {
      bouncedEmail = genericEmailMatch[1].trim();
    }
  }

  return {
    isBounce: true,
    isHardBounce,
    bouncedEmail,
    diagnosticCode: lowerBody.slice(0, 300)
  };
}

/**
 * Detects automated absence / out-of-office auto-replies
 */
export function isAutoReplyMessage(
  headers: Map<string, any> | Record<string, any>,
  subject: string = '',
  bodyText: string = ''
): boolean {
  const getHeader = (name: string): string => {
    if (headers instanceof Map) {
      return String(headers.get(name) || '');
    }
    return String((headers as any)[name] || '');
  };

  const autoSubmitted = getHeader('auto-submitted').toLowerCase();
  const xAutoReply = getHeader('x-autoreply').toLowerCase();
  const precedence = getHeader('precedence').toLowerCase();
  const lowerSubj = subject.toLowerCase();

  if (autoSubmitted && autoSubmitted !== 'no') {
    return true;
  }

  if (xAutoReply === 'yes' || xAutoReply === 'true') {
    return true;
  }

  if (
    lowerSubj.includes('out of office') ||
    lowerSubj.includes('automatic reply:') ||
    lowerSubj.includes('autoreply:') ||
    lowerSubj.includes('away from the office') ||
    lowerSubj.includes('on vacation')
  ) {
    return true;
  }

  if (precedence === 'auto_reply' || precedence === 'bulk') {
    if (lowerSubj.includes('auto') || /out of (the )?office/i.test(bodyText)) {
      return true;
    }
  }

  return false;
}

/**
 * Core processor for parsing a single incoming RFC 822 email message
 */
export async function processInboundEmail(
  rawEmailSource: string | Buffer,
  mailbox: any,
  pool: pg.Pool
): Promise<{ handled: boolean; type: string; details?: any }> {
  const parsed: ParsedMail = await simpleParser(rawEmailSource);

  // 1. FILTER: Ignore warmup network messages carrying X-Warmup-Tag
  const hasWarmupHeader =
    parsed.headers.has('x-warmup-tag') ||
    parsed.headers.has('x-warmup-id') ||
    (parsed.subject || '').includes('__WARMUP_TOKEN_');

  if (hasWarmupHeader) {
    logger.debug('Ignored incoming message carrying X-Warmup-Tag', {
      context: 'InboxSync',
      details: { mailbox: mailbox.email }
    });
    return { handled: true, type: 'warmup_ignored' };
  }

  const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase() || '';
  const subject = parsed.subject || '';
  const bodyText = parsed.text || '';
  const bodyHtml = (parsed.html as string) || '';
  const messageIdHeader = parsed.messageId || '';
  const inReplyTo = parsed.inReplyTo || '';
  const references = Array.isArray(parsed.references) ? parsed.references.join(' ') : (parsed.references || '');

  // 2. BOUNCE / DSN DETECTION
  const bounceCheck = isDsnBounceMessage(parsed.headers, subject, fromEmail, bodyText);
  if (bounceCheck.isBounce) {
    const bouncedRecipient = bounceCheck.bouncedEmail || fromEmail;
    logger.warn(`DSN bounce detected for ${bouncedRecipient}`, {
      context: 'InboxSync',
      details: { hardBounce: bounceCheck.isHardBounce, mailbox: mailbox.email }
    });

    if (bouncedRecipient && bounceCheck.isHardBounce) {
      // Add to suppressions
      await pool.query(
        `INSERT INTO ox_suppressions (id, tenant_id, email, reason, source, created_at)
         VALUES ($1, $2, LOWER($3), 'bounce', 'dsn_detector', NOW())
         ON CONFLICT (tenant_id, email)
         DO UPDATE SET reason = 'bounce', updated_at = NOW()`,
        [`sup_${crypto.randomUUID()}`, mailbox.tenant_id, bouncedRecipient]
      );

      // Stop active enrollments
      await pool.query(
        `UPDATE ox_enrollments
         SET status = 'bounced', updated_at = NOW()
         WHERE tenant_id = $1
           AND prospect_id IN (
             SELECT id FROM ox_prospects WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)
           )
           AND status = 'active'`,
        [mailbox.tenant_id, bouncedRecipient]
      );

      // Record bounce event
      await pool.query(
        `INSERT INTO ox_events (id, tenant_id, type, metadata, occurred_at)
         VALUES ($1, $2, 'bounce', $3, NOW())`,
        [
          `evt_${crypto.randomUUID()}`,
          mailbox.tenant_id,
          JSON.stringify({
            email: bouncedRecipient,
            diagnostic: bounceCheck.diagnosticCode?.slice(0, 200),
            mailboxId: mailbox.id
          })
        ]
      );

      // Emit realtime SSE event to tenant
      realtimeEngine.broadcastToTenant(mailbox.tenant_id, 'campaign_event', {
        type: 'bounce',
        email: bouncedRecipient,
        mailboxId: mailbox.id
      });
    }

    return { handled: true, type: 'bounce', details: bounceCheck };
  }

  // 3. AUTO-REPLY / OUT-OF-OFFICE DETECTION
  const isAuto = isAutoReplyMessage(parsed.headers, subject, bodyText);
  if (isAuto) {
    logger.info(`Out of office auto-reply received from ${fromEmail}; pausing sequence for 3 days`, {
      context: 'InboxSync',
      details: { mailbox: mailbox.email }
    });

    // Pause prospect's enrollment for 3 days without stopping or counting as positive reply
    await pool.query(
      `UPDATE ox_enrollments
       SET next_send_at = NOW() + INTERVAL '3 days',
           defer_reason = 'Out of office auto-reply received; sequence paused for 3 days',
           updated_at = NOW()
       WHERE tenant_id = $1
         AND prospect_id IN (
           SELECT id FROM ox_prospects WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)
         )
         AND status = 'active'`,
      [mailbox.tenant_id, fromEmail]
    );

    return { handled: true, type: 'out_of_office_paused' };
  }

  // 4. CAMPAIGN REPLY MATCHING
  // Try matching In-Reply-To or References to an existing ox_sent_emails.message_id_header
  let matchedSentEmail: any = null;

  if (inReplyTo) {
    const sentRes = await pool.query(
      `SELECT * FROM ox_sent_emails
       WHERE tenant_id = $1 AND message_id_header = $2
       LIMIT 1`,
      [mailbox.tenant_id, inReplyTo]
    );
    if (sentRes.rowCount && sentRes.rowCount > 0) {
      matchedSentEmail = sentRes.rows[0];
    }
  }

  if (!matchedSentEmail && references) {
    const refTokens = references.split(/\s+/).filter(Boolean);
    for (const refToken of refTokens) {
      const sentRes = await pool.query(
        `SELECT * FROM ox_sent_emails
         WHERE tenant_id = $1 AND message_id_header = $2
         LIMIT 1`,
        [mailbox.tenant_id, refToken]
      );
      if (sentRes.rowCount && sentRes.rowCount > 0) {
        matchedSentEmail = sentRes.rows[0];
        break;
      }
    }
  }

  // Fallback: match by sender prospect email against recent sent email from this mailbox
  if (!matchedSentEmail && fromEmail) {
    const sentRes = await pool.query(
      `SELECT * FROM ox_sent_emails
       WHERE tenant_id = $1 AND mailbox_id = $2 AND LOWER(recipient_email) = LOWER($3)
       ORDER BY sent_at DESC
       LIMIT 1`,
      [mailbox.tenant_id, mailbox.id, fromEmail]
    );
    if (sentRes.rowCount && sentRes.rowCount > 0) {
      matchedSentEmail = sentRes.rows[0];
    }
  }

  const campaignId = matchedSentEmail?.campaign_id || null;
  const enrollmentId = matchedSentEmail?.enrollment_id || null;

  // 5. AI CLASSIFICATION (Gemini with deterministic keyword fallback)
  const classification = await classifyInboundReply({
    subject,
    bodyText,
    senderEmail: fromEmail
  });

  // If classified as unsubscribe, add to suppression immediately
  if (classification.label === 'unsubscribe') {
    await pool.query(
      `INSERT INTO ox_suppressions (id, tenant_id, email, reason, source, created_at)
       VALUES ($1, $2, LOWER($3), 'unsubscribe', 'ai_classifier', NOW())
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET reason = 'unsubscribe', updated_at = NOW()`,
      [`sup_${crypto.randomUUID()}`, mailbox.tenant_id, fromEmail]
    );

    await pool.query(
      `UPDATE ox_enrollments
       SET status = 'unsubscribed', updated_at = NOW()
       WHERE tenant_id = $1
         AND prospect_id IN (
           SELECT id FROM ox_prospects WHERE tenant_id = $1 AND LOWER(email) = LOWER($2)
         )
         AND status = 'active'`,
      [mailbox.tenant_id, fromEmail]
    );
  }

  // If enrollment matched, mark replied and stop future sequence steps
  if (enrollmentId) {
    await pool.query(
      `UPDATE ox_enrollments
       SET status = 'replied', updated_at = NOW()
       WHERE id = $1`,
      [enrollmentId]
    );
  }

  // Record 'reply' event in ox_events
  await pool.query(
    `INSERT INTO ox_events (id, tenant_id, sent_email_id, type, metadata, occurred_at)
     VALUES ($1, $2, $3, 'reply', $4, NOW())`,
    [
      `evt_${crypto.randomUUID()}`,
      mailbox.tenant_id,
      matchedSentEmail?.id || null,
      JSON.stringify({
        campaignId,
        enrollmentId,
        fromEmail,
        label: classification.label,
        confidence: classification.confidence,
        source: classification.source
      })
    ]
  );

  // 6. CREATE / UPDATE THREAD (ox_threads) & MESSAGE (ox_messages)
  const snippet = bodyText.replace(/\s+/g, ' ').trim().slice(0, 160);

  let threadId: string;
  const existingThread = await pool.query(
    `SELECT id FROM ox_threads
     WHERE tenant_id = $1 AND mailbox_id = $2 AND LOWER(prospect_email) = LOWER($3)
     LIMIT 1`,
    [mailbox.tenant_id, mailbox.id, fromEmail]
  );

  if (existingThread.rowCount && existingThread.rowCount > 0) {
    threadId = existingThread.rows[0].id;
    await pool.query(
      `UPDATE ox_threads
       SET last_message_at = NOW(),
           subject = COALESCE($1, subject),
           label = $2,
           is_unread = true,
           is_archived = false,
           status = 'open',
           snippet = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [subject || null, classification.label, snippet, threadId]
    );
  } else {
    threadId = `th_${crypto.randomUUID()}`;
    await pool.query(
      `INSERT INTO ox_threads
       (id, tenant_id, mailbox_id, prospect_email, subject, last_message_at,
        status, label, is_unread, is_archived, campaign_id, enrollment_id, snippet)
       VALUES ($1, $2, $3, $4, $5, NOW(), 'open', $6, true, false, $7, $8, $9)`,
      [
        threadId,
        mailbox.tenant_id,
        mailbox.id,
        fromEmail,
        subject,
        classification.label,
        campaignId,
        enrollmentId,
        snippet
      ]
    );
  }

  // Insert message into ox_messages
  const messageId = `msg_${crypto.randomUUID()}`;
  await pool.query(
    `INSERT INTO ox_messages
     (id, tenant_id, thread_id, mailbox_id, direction, from_email, to_email,
      subject, body_text, body_html, message_id_header, in_reply_to_header,
      references_header, raw_headers, received_at)
     VALUES ($1, $2, $3, $4, 'inbound', $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
    [
      messageId,
      mailbox.tenant_id,
      threadId,
      mailbox.id,
      fromEmail,
      mailbox.email,
      subject,
      bodyText,
      bodyHtml,
      messageIdHeader,
      inReplyTo,
      references,
      JSON.stringify(Object.fromEntries(parsed.headers.entries()))
    ]
  );

  // 7. EMIT REALTIME SSE NOTIFICATIONS
  realtimeEngine.broadcastToTenant(mailbox.tenant_id, 'reply_received', {
    threadId,
    messageId,
    mailboxId: mailbox.id,
    campaignId,
    prospectEmail: fromEmail,
    label: classification.label,
    subject,
    snippet
  });

  realtimeEngine.broadcastToTenant(mailbox.tenant_id, 'campaign_event', {
    type: 'reply',
    campaignId,
    enrollmentId,
    email: fromEmail,
    label: classification.label
  });

  logger.info(`Processed inbound reply from ${fromEmail} (Label: ${classification.label})`, {
    context: 'InboxSync',
    details: { threadId, mailbox: mailbox.email }
  });

  return {
    handled: true,
    type: 'reply',
    details: { threadId, label: classification.label, fromEmail }
  };
}

// ----------------------------------------------------
// IMAP SYNC MANAGER: Active Connection Pool & IDLE / Fallback Loop
// ----------------------------------------------------
interface ActiveImapSession {
  client: ImapFlow;
  mailboxId: string;
  email: string;
  tenantId: string;
  isPolling: boolean;
  reconnectAttempts: number;
}

export class InboxSyncManager {
  private sessions = new Map<string, ActiveImapSession>();
  private syncIntervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private maxConcurrentConnections: number;

  constructor(maxConcurrent = 20) {
    this.maxConcurrentConnections = Number(process.env.IMAP_MAX_CONNECTIONS) || maxConcurrent;
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info('Starting InboxSyncManager for active outreach mailboxes...', {
      context: 'InboxSync'
    });

    // Initial sync
    await this.syncMailboxConnections();

    // Check mailbox list every 60 seconds to connect new or drop removed mailboxes
    this.syncIntervalTimer = setInterval(() => {
      this.syncMailboxConnections().catch(err => {
        logger.error('Error in mailbox connections sync tick', {
          context: 'InboxSync',
          details: err?.message
        });
      });
    }, 60 * 1000);
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.syncIntervalTimer) {
      clearInterval(this.syncIntervalTimer);
      this.syncIntervalTimer = null;
    }

    for (const [id, session] of this.sessions.entries()) {
      try {
        await session.client.logout();
      } catch {}
      this.sessions.delete(id);
    }
  }

  /**
   * Refreshes active mailboxes from DB and maintains IMAP connections
   */
  public async syncMailboxConnections(): Promise<void> {
    const pool = getOutreachPool();
    if (!pool) return;

    try {
      const mbxRes = await pool.query(
        `SELECT id, tenant_id, email, imap_host, imap_port, imap_user, imap_pass_encrypted, status, is_deleted
         FROM ox_mailboxes
         WHERE status = 'active' AND (is_deleted IS NULL OR is_deleted = false)
         LIMIT $1`,
        [this.maxConcurrentConnections]
      );

      const activeIds = new Set(mbxRes.rows.map(r => r.id));

      // Disconnect mailboxes that are no longer active
      for (const [id, session] of this.sessions.entries()) {
        if (!activeIds.has(id)) {
          logger.info(`Disconnecting IMAP for inactive mailbox ${session.email}`, {
            context: 'InboxSync'
          });
          session.client.logout().catch(() => {});
          this.sessions.delete(id);
        }
      }

      // Connect any new active mailboxes
      for (const mbx of mbxRes.rows) {
        if (!this.sessions.has(mbx.id) && mbx.imap_host && mbx.imap_pass_encrypted) {
          this.connectMailbox(mbx).catch(err => {
            logger.warn(`Failed initial IMAP connect for ${mbx.email}: ${err?.message}`, {
              context: 'InboxSync'
            });
          });
        }
      }
    } catch (err: any) {
      logger.error('Failed to sync mailbox connections', {
        context: 'InboxSync',
        details: err?.message
      });
    }
  }

  private async connectMailbox(mbx: any): Promise<void> {
    let password = '';
    try {
      password = decryptSecret(mbx.imap_pass_encrypted);
    } catch {
      return;
    }

    const client = new ImapFlow({
      host: mbx.imap_host,
      port: mbx.imap_port || 993,
      secure: mbx.imap_port === 993,
      auth: {
        user: mbx.imap_user || mbx.email,
        pass: password
      },
      logger: false,
      connectionTimeout: 15000
    });

    const session: ActiveImapSession = {
      client,
      mailboxId: mbx.id,
      email: mbx.email,
      tenantId: mbx.tenant_id,
      isPolling: false,
      reconnectAttempts: 0
    };

    this.sessions.set(mbx.id, session);

    try {
      await client.connect();
      logger.info(`IMAP connected successfully for ${mbx.email}`, { context: 'InboxSync' });

      // Open INBOX
      const lock = await client.getMailboxLock('INBOX');

      // Listen for incoming messages via IDLE exists event
      client.on('exists', async data => {
        logger.debug(`IMAP exists event triggered on ${mbx.email} (${data.count} messages)`, {
          context: 'InboxSync'
        });
        await this.fetchLatestUnseenMessages(client, mbx);
      });

      // Release lock initially; client.idle() or periodic check handles monitoring
      lock.release();

      // 60-second fallback polling interval
      const pollTimer = setInterval(async () => {
        if (!this.isRunning || !this.sessions.has(mbx.id)) {
          clearInterval(pollTimer);
          return;
        }
        await this.fetchLatestUnseenMessages(client, mbx);
      }, 60 * 1000);

      client.on('close', () => {
        clearInterval(pollTimer);
        this.sessions.delete(mbx.id);
        // Exponential backoff reconnect
        if (this.isRunning) {
          const delay = Math.min(60000, 5000 * Math.pow(1.5, session.reconnectAttempts));
          session.reconnectAttempts++;
          setTimeout(() => {
            if (this.isRunning) this.connectMailbox(mbx).catch(() => {});
          }, delay);
        }
      });
    } catch (err: any) {
      this.sessions.delete(mbx.id);
      logger.warn(`IMAP connection error on ${mbx.email}: ${err?.message}`, {
        context: 'InboxSync'
      });
    }
  }

  private async fetchLatestUnseenMessages(client: ImapFlow, mbx: any): Promise<void> {
    const pool = getOutreachPool();
    if (!pool) return;

    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Fetch last 10 messages from INBOX to inspect for replies / bounces
        const status = await client.status('INBOX', { messages: true });
        const total = status.messages || 0;
        if (total === 0) return;

        const startSeq = Math.max(1, total - 9);
        const sequence = `${startSeq}:${total}`;

        for await (const message of client.fetch(sequence, { source: true, envelope: true })) {
          if (message.source) {
            await processInboundEmail(message.source, mbx, pool).catch(err => {
              logger.warn(`Error processing inbound message on ${mbx.email}: ${err?.message}`, {
                context: 'InboxSync'
              });
            });
          }
        }
      } finally {
        lock.release();
      }
    } catch (err: any) {
      logger.debug(`Fetch error during IMAP cycle for ${mbx.email}: ${err?.message}`, {
        context: 'InboxSync'
      });
    }
  }
}

export const inboxSyncManager = new InboxSyncManager();
