export interface OutreachPlan {
  id: string;
  name: string;
  tier: 'starter' | 'growth' | 'scale';
  monthlyPriceUsd: number;
  annualPriceUsd: number; // Price per month if billed annually
  mailboxLimit: number;
  monthlySendLimit: number;
  dailySendLimit: number;
  verificationQuota: number;
  features: {
    warmup: boolean;
    a_b_testing: boolean;
    conditional_branching: boolean;
    auto_optimize: boolean;
    dedicated_tracking_domain: boolean;
    advanced_analytics: boolean;
    priority_support: boolean;
  };
  stripeMonthlyPriceId?: string;
  stripeAnnualPriceId?: string;
}

/**
 * Section 7.3 Canonical Outreach Plans
 * Configured as editable constants in one file.
 */
export const OUTREACH_PLANS: Record<string, OutreachPlan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    tier: 'starter',
    monthlyPriceUsd: 49,
    annualPriceUsd: 39,
    mailboxLimit: 3,
    monthlySendLimit: 5000,
    dailySendLimit: 250,
    verificationQuota: 1000,
    features: {
      warmup: true,
      a_b_testing: true,
      conditional_branching: false,
      auto_optimize: false,
      dedicated_tracking_domain: false,
      advanced_analytics: false,
      priority_support: false
    },
    stripeMonthlyPriceId: 'price_starter_monthly',
    stripeAnnualPriceId: 'price_starter_annual'
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tier: 'growth',
    monthlyPriceUsd: 99,
    annualPriceUsd: 79,
    mailboxLimit: 10,
    monthlySendLimit: 25000,
    dailySendLimit: 1000,
    verificationQuota: 5000,
    features: {
      warmup: true,
      a_b_testing: true,
      conditional_branching: true,
      auto_optimize: true,
      dedicated_tracking_domain: true,
      advanced_analytics: true,
      priority_support: false
    },
    stripeMonthlyPriceId: 'price_growth_monthly',
    stripeAnnualPriceId: 'price_growth_annual'
  },
  scale: {
    id: 'scale',
    name: 'Scale',
    tier: 'scale',
    monthlyPriceUsd: 249,
    annualPriceUsd: 199,
    mailboxLimit: 50,
    monthlySendLimit: 100000,
    dailySendLimit: 5000,
    verificationQuota: 25000,
    features: {
      warmup: true,
      a_b_testing: true,
      conditional_branching: true,
      auto_optimize: true,
      dedicated_tracking_domain: true,
      advanced_analytics: true,
      priority_support: true
    },
    stripeMonthlyPriceId: 'price_scale_monthly',
    stripeAnnualPriceId: 'price_scale_annual'
  }
};
