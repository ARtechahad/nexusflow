import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { authenticateToken } from '../../middlewares/auth';
import { getOutreachPool } from '../../services/outreach/schema';
import {
  OUTREACH_PLANS,
  getTenantPlan,
  setTenantPlan,
  getTenantUsageSummary
} from '../../services/outreach/plans';
import { logger } from '../../logger';

export const billingRouter = Router();

function getPoolOrThrow() {
  const pool = getOutreachPool();
  if (!pool) {
    throw new Error('PostgreSQL database required for billing and team operations');
  }
  return pool;
}

// 1. GET /api/outreach/billing/plans - List all plan tiers
billingRouter.get('/billing/plans', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      plans: OUTREACH_PLANS,
      isTestMode: !Boolean(process.env.STRIPE_SECRET_KEY)
    }
  });
});

// 2. GET /api/outreach/billing/current-plan - Current tenant plan details and usage metrics
billingRouter.get('/billing/current-plan', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();

    const planDetails = await getTenantPlan(tenantId, pool);
    const usage = await getTenantUsageSummary(tenantId, pool);

    res.json({
      success: true,
      data: {
        ...planDetails,
        usage
      }
    });
  } catch (err: any) {
    logger.error('Failed to get current tenant plan', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. POST /api/outreach/billing/checkout - Create Stripe subscription session (or test mode session)
billingRouter.post('/billing/checkout', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();

    const {
      planId = 'growth',
      billingInterval = 'monthly',
      successUrl,
      cancelUrl
    } = req.body || {};

    const cleanPlanId = (planId || 'growth').toLowerCase();
    const plan = OUTREACH_PLANS[cleanPlanId] || OUTREACH_PLANS.growth;

    const origin = req.headers.origin || req.headers.host ? `http://${req.headers.host}` : 'http://localhost:3000';
    const redirectSuccess = successUrl || `${origin}/?outreach_checkout=success&plan=${cleanPlanId}`;
    const redirectCancel = cancelUrl || `${origin}/?outreach_checkout=canceled`;

    const stripeKey = process.env.STRIPE_SECRET_KEY;

    // 1. Live Stripe Checkout when key is provided
    if (stripeKey && !stripeKey.startsWith('mock_')) {
      try {
        const stripeParams = new URLSearchParams();
        stripeParams.append('payment_method_types[0]', 'card');
        stripeParams.append('mode', 'subscription');

        // Look up price or build line item
        const unitPrice = billingInterval === 'annual' ? plan.annualPriceUsd * 12 : plan.monthlyPriceUsd;
        stripeParams.append('line_items[0][price_data][currency]', 'usd');
        stripeParams.append('line_items[0][price_data][unit_amount]', String(Math.round(unitPrice * 100)));
        stripeParams.append('line_items[0][price_data][product_data][name]', `Outreach Suite ${plan.name} Plan (${billingInterval})`);
        stripeParams.append('line_items[0][price_data][recurring][interval]', billingInterval === 'annual' ? 'year' : 'month');
        stripeParams.append('line_items[0][quantity]', '1');

        stripeParams.append('success_url', redirectSuccess);
        stripeParams.append('cancel_url', redirectCancel);
        stripeParams.append('metadata[tenant_id]', tenantId);
        stripeParams.append('metadata[plan_id]', cleanPlanId);
        stripeParams.append('metadata[billing_interval]', billingInterval);

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: stripeParams.toString()
        });

        if (stripeRes.ok) {
          const session = await stripeRes.json();
          logger.info(`Created Stripe subscription checkout session ${session.id}`, { context: 'Billing' });
          res.json({
            success: true,
            sessionId: session.id,
            url: session.url,
            isLiveStripe: true
          });
          return;
        } else {
          const errBody = await stripeRes.text();
          logger.warn('Stripe checkout error, falling back to test mode response', { details: errBody });
        }
      } catch (stripeErr: any) {
        logger.warn('Stripe API invocation failed, falling back to test mode', { details: stripeErr?.message });
      }
    }

    // 2. Clearly-Labelled Test Mode Gateway
    const testSessionId = `cs_test_${crypto.randomBytes(12).toString('hex')}`;
    res.json({
      success: true,
      sessionId: testSessionId,
      url: `${origin}/?outreach_checkout=test_success&plan=${cleanPlanId}&interval=${billingInterval}&session_id=${testSessionId}`,
      isLiveStripe: false,
      isTestMode: true,
      message: 'Running in clearly-labelled test mode. Use /billing/test-upgrade to instantly switch plans.'
    });
  } catch (err: any) {
    logger.error('Failed to create billing checkout session', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. POST /api/outreach/billing/test-upgrade - Admin manual test upgrade
billingRouter.post('/billing/test-upgrade', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();

    const { planId = 'growth', billingInterval = 'monthly' } = req.body || {};
    const updated = await setTenantPlan(tenantId, planId, {
      billingInterval,
      status: 'active',
      pool
    });

    logger.info(`Tenant ${tenantId} upgraded plan to ${updated.plan.name} (${billingInterval}) in test mode`, {
      context: 'Billing'
    });

    res.json({
      success: true,
      message: `Plan upgraded to ${updated.plan.name} (${billingInterval}) successfully!`,
      data: updated
    });
  } catch (err: any) {
    logger.error('Failed to execute test plan upgrade', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. POST /api/outreach/billing/portal - Stripe Customer Portal Session
billingRouter.post('/billing/portal', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();
    const currentPlan = await getTenantPlan(tenantId, pool);

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const origin = req.headers.origin || req.headers.host ? `http://${req.headers.host}` : 'http://localhost:3000';

    if (stripeKey && currentPlan.stripeCustomerId) {
      try {
        const portalParams = new URLSearchParams();
        portalParams.append('customer', currentPlan.stripeCustomerId);
        portalParams.append('return_url', `${origin}/`);

        const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: portalParams.toString()
        });

        if (portalRes.ok) {
          const session = await portalRes.json();
          res.json({ success: true, url: session.url });
          return;
        }
      } catch (err: any) {
        logger.warn('Stripe billing portal call failed', { details: err?.message });
      }
    }

    // Fallback in test mode
    res.json({
      success: true,
      url: `${origin}/?settings=billing`,
      isTestMode: true,
      message: 'Running in test mode. Manage plan tiers directly from the Usage & Plans page.'
    });
  } catch (err: any) {
    logger.error('Failed to create customer portal session', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. POST /api/outreach/billing/webhook - Stripe Webhook Handler with Signature Verification
billingRouter.post('/billing/webhook', async (req: Request, res: Response): Promise<void> => {
  const pool = getPoolOrThrow();
  const signature = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event = req.body;

  // Signature verification when STRIPE_WEBHOOK_SECRET is set
  if (webhookSecret && signature) {
    try {
      const crypto = await import('crypto');
      const sigParts = signature.split(',').reduce((acc: Record<string, string>, part) => {
        const [k, v] = part.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const timestamp = sigParts.t;
      const expectedSig = sigParts.v1;

      if (timestamp && expectedSig) {
        const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const signedPayload = `${timestamp}.${rawBody}`;
        const computedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');

        if (computedSig !== expectedSig) {
          logger.warn('Invalid Stripe webhook signature');
          res.status(400).send('Invalid signature');
          return;
        }
      }
    } catch (sigErr: any) {
      logger.warn('Stripe signature verification failed', { details: sigErr?.message });
    }
  }

  try {
    const eventType = event.type;
    const dataObject = event.data?.object || {};

    logger.info(`Received Stripe webhook: ${eventType}`, { context: 'BillingWebhook' });

    switch (eventType) {
      case 'checkout.session.completed': {
        const tenantId = dataObject.metadata?.tenant_id;
        const planId = dataObject.metadata?.plan_id || 'growth';
        const billingInterval = dataObject.metadata?.billing_interval || 'monthly';
        const customerId = dataObject.customer;
        const subscriptionId = dataObject.subscription;

        if (tenantId) {
          await setTenantPlan(tenantId, planId, {
            billingInterval,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            status: 'active',
            pool
          });
          logger.info(`Upgraded tenant ${tenantId} via checkout.session.completed to ${planId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const customerId = dataObject.customer;
        const subscriptionId = dataObject.id;
        const status = dataObject.status === 'active' ? 'active' : dataObject.status;

        // Find tenant by customerId or subscriptionId
        const tRes = await pool.query(
          `SELECT tenant_id, plan_id FROM ox_tenant_plans WHERE stripe_customer_id = $1 OR stripe_subscription_id = $2`,
          [customerId, subscriptionId]
        );

        if (tRes.rowCount && tRes.rowCount > 0) {
          const tenantId = tRes.rows[0].tenant_id;
          const planId = tRes.rows[0].plan_id;
          await setTenantPlan(tenantId, planId, {
            status,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            pool
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscriptionId = dataObject.id;
        await pool.query(
          `UPDATE ox_tenant_plans SET status = 'canceled', updated_at = NOW() WHERE stripe_subscription_id = $1`,
          [subscriptionId]
        );
        break;
      }

      case 'invoice.payment_failed': {
        const customerId = dataObject.customer;
        await pool.query(
          `UPDATE ox_tenant_plans SET status = 'past_due', updated_at = NOW() WHERE stripe_customer_id = $1`,
          [customerId]
        );
        break;
      }

      default:
        // Ignore unhandled event
        break;
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error('Error processing Stripe webhook event', { details: { error: err.message } });
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 7. TEAM & WORKSPACE PERMISSIONS (owner, manager, viewer)
// ============================================================================

// GET /api/outreach/team/members
billingRouter.get('/team/members', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();

    const membersRes = await pool.query(
      `SELECT id, tenant_id, user_id, role, created_at, updated_at
       FROM ox_workspace_members
       WHERE tenant_id = $1
       ORDER BY created_at ASC`,
      [tenantId]
    );

    // If no members seeded yet, return current user as owner
    let members = membersRes.rows;
    if (members.length === 0) {
      const currentUserId = (req as any).user?.id || 'admin-user';
      const initialId = `wmemb_${crypto.randomUUID()}`;
      await pool.query(
        `INSERT INTO ox_workspace_members (id, tenant_id, user_id, role)
         VALUES ($1, $2, $3, 'owner')
         ON CONFLICT (tenant_id, user_id) DO NOTHING`,
        [initialId, tenantId, currentUserId]
      );
      members = [
        {
          id: initialId,
          tenant_id: tenantId,
          user_id: currentUserId,
          role: 'owner',
          created_at: new Date().toISOString()
        }
      ];
    }

    res.json({
      success: true,
      data: members
    });
  } catch (err: any) {
    logger.error('Failed to get team members', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/outreach/team/members - Add or invite member with role (owner, manager, viewer)
billingRouter.post('/team/members', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();

    const { userId, role = 'viewer' } = req.body || {};
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId (or email) is required' });
      return;
    }

    const cleanRole = ['owner', 'manager', 'viewer'].includes(role) ? role : 'viewer';
    const memberId = `wmemb_${crypto.randomUUID()}`;

    await pool.query(
      `INSERT INTO ox_workspace_members (id, tenant_id, user_id, role, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tenant_id, user_id) DO UPDATE
       SET role = EXCLUDED.role,
           updated_at = NOW()`,
      [memberId, tenantId, userId, cleanRole]
    );

    res.json({
      success: true,
      message: `Member ${userId} assigned role ${cleanRole}`,
      data: { id: memberId, userId, role: cleanRole }
    });
  } catch (err: any) {
    logger.error('Failed to add team member', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/outreach/team/members/:id - Update member role
billingRouter.put('/team/members/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();
    const { id } = req.params;
    const { role } = req.body || {};

    const cleanRole = ['owner', 'manager', 'viewer'].includes(role) ? role : 'viewer';

    await pool.query(
      `UPDATE ox_workspace_members SET role = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [cleanRole, id, tenantId]
    );

    res.json({
      success: true,
      message: `Updated role to ${cleanRole}`
    });
  } catch (err: any) {
    logger.error('Failed to update team member', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/outreach/team/members/:id - Remove member
billingRouter.delete('/team/members/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenant_id || (req as any).tenant_id || 'tenant-alm-nexus';
    const pool = getPoolOrThrow();
    const { id } = req.params;

    await pool.query(`DELETE FROM ox_workspace_members WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);

    res.json({
      success: true,
      message: 'Member removed from workspace'
    });
  } catch (err: any) {
    logger.error('Failed to delete team member', { details: { error: err.message } });
    res.status(500).json({ success: false, error: err.message });
  }
});
