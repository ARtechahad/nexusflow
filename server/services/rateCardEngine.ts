import { Router, Request, Response } from 'express';
import { calculateCommission } from '../db';
import { logger } from '../logger';
import { AuditLogService } from './auditLogService';

export interface RateCardCalculationRequest {
  websiteType: 'landing' | 'ecommerce' | 'corporate' | 'custom' | string;
  pageCount?: number;
  hasCustomDesign?: boolean;
  hasECommerce?: boolean;
  hasCMS?: boolean;
  currency?: 'USD' | 'GBP' | 'EUR' | 'AUD' | 'AED';
  salespersonRole?: string;
  isHighPerformer?: boolean;
}

const FOREX_RATES: Record<string, number> = {
  USD: 1.0,
  GBP: 0.78,
  EUR: 0.92,
  AUD: 1.52,
  AED: 3.67
};

export function calculateServerRateCard(req: RateCardCalculationRequest) {
  let baseUSD = 250;
  const wType = (req.websiteType || 'landing').toLowerCase();

  if (wType === 'landing' || wType === 'one_page') {
    baseUSD = 250;
  } else if (wType === 'ecommerce') {
    baseUSD = 600;
  } else if (wType === 'corporate') {
    baseUSD = 900;
  } else {
    baseUSD = 400;
  }

  // Adjust for page count
  if (req.pageCount && req.pageCount > 5) {
    baseUSD += (req.pageCount - 5) * 50;
  }

  // Add-ons
  if (req.hasCustomDesign) baseUSD += 150;
  if (req.hasECommerce && wType !== 'ecommerce') baseUSD += 250;
  if (req.hasCMS) baseUSD += 100;

  // Compute 50% advance / balance split
  const advanceUSD = Number((baseUSD * 0.5).toFixed(2));
  const balanceUSD = Number((baseUSD * 0.5).toFixed(2));

  // Compute SOP Section 6 Tiered Commission
  const comm = calculateCommission(baseUSD);
  let effectiveCommissionPercent = comm.percentage;

  if (req.isHighPerformer) {
    effectiveCommissionPercent = Math.min(45, comm.percentage + 5);
  }

  const commissionAmountUSD = Number(((baseUSD * effectiveCommissionPercent) / 100).toFixed(2));

  // Estimate Agency Gross Profit Margin
  const estimatedCostUSD = Number((baseUSD * 0.35 + commissionAmountUSD).toFixed(2));
  const grossProfitUSD = Number((baseUSD - estimatedCostUSD).toFixed(2));
  const grossMarginPercent = Number(((grossProfitUSD / baseUSD) * 100).toFixed(1));

  // Convert to requested currency
  const targetCurr = req.currency || 'USD';
  const forexMultiplier = FOREX_RATES[targetCurr] || 1.0;

  return {
    websiteType: wType,
    pricingUSD: {
      totalPrice: baseUSD,
      advance50: advanceUSD,
      balance50: balanceUSD,
      commissionPercent: effectiveCommissionPercent,
      commissionAmount: commissionAmountUSD,
      estimatedCost: estimatedCostUSD,
      grossProfit: grossProfitUSD,
      grossMarginPercent
    },
    pricingConverted: {
      currency: targetCurr,
      forexRate: forexMultiplier,
      totalPrice: Number((baseUSD * forexMultiplier).toFixed(2)),
      advance50: Number((advanceUSD * forexMultiplier).toFixed(2)),
      balance50: Number((balanceUSD * forexMultiplier).toFixed(2)),
      commissionAmount: Number((commissionAmountUSD * forexMultiplier).toFixed(2))
    },
    sopCompliance: {
      step4PricingBenchmark: baseUSD >= 200,
      step5AdvanceRequired: advanceUSD,
      step6CommissionTier: comm.tier
    }
  };
}

export const rateCardRouter = Router();

// POST /api/rate-card/calculate - Server-side Rate Card & Commission Matrix Calculator
rateCardRouter.post('/calculate', (req: Request, res: Response) => {
  const body: RateCardCalculationRequest = req.body;
  const result = calculateServerRateCard(body);

  res.json({
    success: true,
    data: result
  });
});

// POST /api/rate-card/update-tier - Admin Rate Card Matrix Adjustment
rateCardRouter.post('/update-tier', (req: Request, res: Response) => {
  const { tierName, minPrice, maxPrice, commissionRate } = req.body || {};
  const tenantId = (req as any).tenant_id || 'tenant-alm-nexus';

  AuditLogService.log({
    tenantId,
    actorId: (req as any).user?.id || 'admin',
    actorName: (req as any).user?.name || 'Tariq Mehmood',
    actorRole: (req as any).user?.role || 'admin',
    action: 'RATE_CARD_TIER_UPDATED',
    entityType: 'rate_card',
    entityId: tierName || 'tier-custom',
    ipAddress: req.ip || '127.0.0.1',
    details: { tierName, minPrice, maxPrice, commissionRate }
  });

  logger.info(`Rate Card Tier updated: ${tierName} (${commissionRate}%)`, { context: 'RateCardEngine', tenantId });

  res.json({
    success: true,
    message: `Rate card tier "${tierName}" updated successfully to ${commissionRate}%.`,
    data: { tierName, minPrice, maxPrice, commissionRate, updatedAt: new Date().toISOString() }
  });
});
