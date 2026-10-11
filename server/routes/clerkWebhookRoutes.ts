import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../logger';
import { syncClerkUserToDatabase } from '../middlewares/clerkAuth';
import { getNeonPool } from '../services/db';

export const clerkWebhookRouter = express.Router();

/**
 * Validates Svix / Clerk webhook signature if CLERK_WEBHOOK_SECRET is configured
 */
function verifyClerkWebhookSignature(payload: string, headers: Record<string, any>, secret: string): boolean {
  const svixId = headers['svix-id'] as string;
  const svixTimestamp = headers['svix-timestamp'] as string;
  const svixSignature = headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  // Check timestamp drift (5 minutes tolerance)
  const ts = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    return false;
  }

  try {
    // Secret starts with 'whsec_'
    const secretKey = secret.startsWith('whsec_') ? secret.substring(6) : secret;
    const secretBytes = Buffer.from(secretKey, 'base64');

    const toSign = `${svixId}.${svixTimestamp}.${payload}`;
    const expectedSig = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

    const passedSignatures = svixSignature.split(' ').map(sig => sig.replace(/^v1,/, ''));
    return passedSignatures.some(sig => {
      try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
      } catch {
        return false;
      }
    });
  } catch (err: any) {
    logger.warn('[Clerk Webhook] Signature verification parsing error:', { details: err?.message });
    return false;
  }
}

/**
 * POST /api/webhooks/clerk
 * Ingests Clerk events (user.created, user.updated, user.deleted) and syncs to Neon PostgreSQL
 */
clerkWebhookRouter.post(['/clerk', '/'], async (req: Request, res: Response) => {
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (webhookSecret) {
    const isValid = verifyClerkWebhookSignature(rawBody, req.headers, webhookSecret);
    if (!isValid) {
      logger.warn('[Clerk Webhook] Rejected webhook with invalid signature');
      return res.status(400).json({ success: false, error: 'Invalid webhook signature.' });
    }
  }

  const event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
  const eventType = event.type;
  const data = event.data || {};

  logger.info(`[Clerk Webhook] Received event: ${eventType} for user ${data.id}`, {
    context: 'ClerkWebhook',
    details: { eventType, userId: data.id }
  });

  try {
    switch (eventType) {
      case 'user.created':
      case 'user.updated': {
        const userId = data.id;
        const primaryEmailObj = data.primary_email_address_id
          ? data.email_addresses?.find((e: any) => e.id === data.primary_email_address_id)
          : null;
        const email =
          primaryEmailObj?.email_address ||
          data.email_addresses?.[0]?.email_address ||
          data.email;

        if (!userId || !email) {
          return res.status(400).json({ success: false, error: 'Missing user ID or primary email address.' });
        }

        const firstName = data.first_name || '';
        const lastName = data.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || email.split('@')[0];
        const avatar = data.image_url || data.profile_image_url;
        const role = data.public_metadata?.role || 'collaborator';
        const tenantId = data.public_metadata?.tenantId || data.public_metadata?.tenant_id || 'tenant-alm-nexus';

        // Synchronize with Neon Database
        await syncClerkUserToDatabase({
          userId,
          email,
          name: fullName,
          avatar,
          role,
          tenantId
        });

        return res.json({
          success: true,
          event: eventType,
          userId,
          email,
          message: `User ${email} synchronized to Neon database successfully.`
        });
      }

      case 'user.deleted': {
        const userId = data.id;
        const pool = getNeonPool();
        if (pool && userId) {
          await pool.query(`DELETE FROM clerk_users_sync WHERE clerk_id = $1`, [userId]);
          await pool.query(`UPDATE users SET clerk_user_id = NULL, updated_at = NOW() WHERE clerk_user_id = $1`, [userId]);
        }
        return res.json({ success: true, event: 'user.deleted', userId });
      }

      default:
        return res.json({ success: true, received: true, eventType });
    }
  } catch (err: any) {
    logger.error('[Clerk Webhook] Error processing event:', { details: err?.message });
    return res.status(500).json({ success: false, error: err?.message || 'Failed to process Clerk webhook' });
  }
});
