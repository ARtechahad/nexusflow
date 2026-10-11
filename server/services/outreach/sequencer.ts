import pg from 'pg';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';
import { enqueue, registerHandler } from './queue';
import { handleSendCampaignEmailJob, SendCampaignEmailPayload } from './sender';

let sequencerIntervalId: NodeJS.Timeout | null = null;
let isSequencerTicking = false;

/**
 * Initializes the sequencer background loop and registers the queue handler.
 */
export function initSequencer(pool: pg.Pool): void {
  // Register the durable job handler for send_campaign_email
  registerHandler('send_campaign_email', async (job) => {
    await handleSendCampaignEmailJob(job.payload as SendCampaignEmailPayload, job.tenant_id);
  });

  // Start 30-second sequencer tick
  if (sequencerIntervalId) {
    clearInterval(sequencerIntervalId);
  }

  sequencerIntervalId = setInterval(async () => {
    if (isSequencerTicking) return;
    isSequencerTicking = true;
    try {
      await runSequencerTick(pool);
    } catch (err: any) {
      logger.error('Error in sequencer tick', {
        context: 'Sequencer',
        details: { error: err?.message }
      });
    } finally {
      isSequencerTicking = false;
    }
  }, 30000);

  logger.info('Outreach campaign sequencer initialized (30s interval tick)', {
    context: 'Sequencer'
  });
}

/**
 * Core sequencer tick:
 * 1. Finds enrollments ready for delivery (status = 'active' AND next_send_at <= NOW())
 *    in currently active campaigns.
 * 2. Locks rows using FOR UPDATE SKIP LOCKED.
 * 3. Rotates across the campaign's active mailboxes that have available budget today.
 * 4. Enqueues send_campaign_email job.
 * 5. Bumps next_send_at forward to prevent double enqueueing.
 */
export async function runSequencerTick(pool: pg.Pool, batchLimit = 50): Promise<number> {
  const client = await pool.connect();
  let enqueuedCount = 0;

  try {
    await client.query('BEGIN');

    // Select due enrollments for active campaigns with current steps
    const dueEnrollmentsQuery = `
      SELECT e.id as enrollment_id, e.tenant_id, e.campaign_id, e.current_step_id, e.prospect_id,
             c.status as campaign_status
      FROM ox_enrollments e
      JOIN ox_campaigns c ON e.campaign_id = c.id
      WHERE e.status = 'active'
        AND c.status = 'active'
        AND (e.next_send_at IS NULL OR e.next_send_at <= NOW())
        AND e.current_step_id IS NOT NULL
      ORDER BY e.next_send_at ASC NULLS FIRST
      LIMIT $1
      FOR UPDATE OF e SKIP LOCKED;
    `;

    const dueRes = await client.query(dueEnrollmentsQuery, [batchLimit]);

    if (dueRes.rows.length === 0) {
      await client.query('COMMIT');
      return 0;
    }

    const todayUtc = new Date().toISOString().slice(0, 10);

    for (const enr of dueRes.rows) {
      try {
        // Find campaign mailboxes sorted by fewest sent today
        const mailboxesQuery = `
          SELECT m.id, m.email, m.daily_cap,
                 COALESCE(d.campaign_sent_count + d.warmup_sent_count, 0)::int as sent_today
          FROM ox_campaign_mailboxes cm
          JOIN ox_mailboxes m ON cm.mailbox_id = m.id
          LEFT JOIN ox_mailbox_daily d ON d.mailbox_id = m.id AND d.date_utc = $2
          WHERE cm.campaign_id = $1
            AND cm.is_active = true
            AND m.is_deleted = false
            AND m.status = 'active'
            AND m.health_status != 'error'
          ORDER BY sent_today ASC, m.last_sent_at ASC NULLS FIRST;
        `;

        const mbxRes = await client.query(mailboxesQuery, [enr.campaign_id, todayUtc]);

        if (mbxRes.rows.length === 0) {
          // No active mailboxes available for this campaign right now
          await client.query(
            `UPDATE ox_enrollments
             SET next_send_at = NOW() + INTERVAL '30 minutes',
                 defer_reason = 'No active mailboxes available for campaign',
                 updated_at = NOW()
             WHERE id = $1`,
            [enr.enrollment_id]
          );
          continue;
        }

        // Pick the mailbox with the most remaining capacity
        const chosenMailbox = mbxRes.rows.find((mb) => mb.sent_today < mb.daily_cap) || mbxRes.rows[0];

        // Enqueue the durable job
        const payload: SendCampaignEmailPayload = {
          enrollmentId: enr.enrollment_id,
          campaignId: enr.campaign_id,
          stepId: enr.current_step_id,
          mailboxId: chosenMailbox.id
        };

        await enqueue('send_campaign_email', payload, {
          tenantId: enr.tenant_id,
          pool
        });

        // Set next_send_at to 10 minutes in the future to prevent duplicate enqueue while in flight
        await client.query(
          `UPDATE ox_enrollments
           SET next_send_at = NOW() + INTERVAL '10 minutes',
               updated_at = NOW()
           WHERE id = $1`,
          [enr.enrollment_id]
        );

        enqueuedCount++;
      } catch (err: any) {
        logger.error(`Sequencer error processing enrollment ${enr.enrollment_id}`, {
          context: 'Sequencer',
          details: { error: err?.message }
        });
      }
    }

    await client.query('COMMIT');
    return enqueuedCount;
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Failed to execute sequencer batch', {
      context: 'Sequencer',
      details: { error: err?.message }
    });
    return 0;
  } finally {
    client.release();
  }
}
