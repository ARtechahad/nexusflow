import pg from 'pg';
import crypto from 'node:crypto';
import { logger } from '../../logger';
import { getOutreachPool } from './schema';

export type ConditionRuleType =
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'not_opened'
  | 'not_clicked'
  | 'link_clicked'
  | 'replied_positive';

export interface ConditionRule {
  type: ConditionRuleType;
  stepRef?: string | number; // ID or step_number of referenced step
  withinHours?: number;      // Window in hours from email sent time
  linkUrl?: string;          // Specific link target for link_clicked
}

export interface StepCondition {
  op: 'AND' | 'OR';
  rules: ConditionRule[];
}

export interface StepBranchEvaluation {
  hasCondition: boolean;
  isMatch: boolean;
  nextStepId: string | null;
  branchTaken: 'true_branch' | 'false_branch' | 'linear';
  ruleResults: Array<{ rule: ConditionRule; matched: boolean }>;
}

/**
 * Validates that sequence steps contain no infinite loops or cycles.
 * Uses Depth-First-Search (DFS) cycle detection.
 */
export function validateSequenceCycles(steps: Array<{
  id: string;
  step_number: number;
  condition?: StepCondition | null;
  on_true_step?: string | null;
  on_false_step?: string | null;
}>): { isValid: boolean; cyclePath?: string[]; error?: string } {
  const stepMap = new Map<string, typeof steps[0]>();
  for (const s of steps) {
    stepMap.set(s.id, s);
    stepMap.set(String(s.step_number), s);
  }

  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const neighbors: string[] = [];

    if (s.on_true_step && stepMap.has(s.on_true_step)) {
      neighbors.push(stepMap.get(s.on_true_step)!.id);
    }
    if (s.on_false_step && stepMap.has(s.on_false_step)) {
      neighbors.push(stepMap.get(s.on_false_step)!.id);
    }

    // Default linear forward neighbor if not explicit branch or both branches absent
    if (!s.on_true_step && !s.on_false_step && i < steps.length - 1) {
      neighbors.push(steps[i + 1].id);
    }

    adj.set(s.id, neighbors);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        path.push(neighbor);
        return true; // Cycle detected
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return false;
  }

  for (const s of steps) {
    if (!visited.has(s.id)) {
      if (dfs(s.id)) {
        return {
          isValid: false,
          cyclePath: path,
          error: `Circular loop detected in sequence: ${path.join(' -> ')}`
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Evaluates step conditions against prospect events in ox_events and ox_sent_emails.
 */
export async function evaluateStepCondition(
  enrollmentId: string,
  condition: StepCondition | null | undefined,
  options: {
    pool?: pg.Pool;
    tenantId?: string;
    onTrueStep?: string | null;
    onFalseStep?: string | null;
    campaignId?: string;
  }
): Promise<StepBranchEvaluation> {
  if (!condition || !Array.isArray(condition.rules) || condition.rules.length === 0) {
    return {
      hasCondition: false,
      isMatch: false,
      nextStepId: null,
      branchTaken: 'linear',
      ruleResults: []
    };
  }

  const pool = options.pool || getOutreachPool();
  if (!pool) {
    throw new Error('Database pool unavailable for condition evaluation');
  }

  // 1. Fetch all emails sent for this enrollment
  const sentRes = await pool.query(
    `SELECT id, step_id, sent_at, opened_at, clicked_at, replied_at, bounced_at
     FROM ox_sent_emails
     WHERE enrollment_id = $1
     ORDER BY sent_at DESC`,
    [enrollmentId]
  );
  const sentEmails = sentRes.rows;

  // 2. Fetch all raw events for this enrollment
  const eventsRes = await pool.query(
    `SELECT e.id, e.sent_email_id, e.type, e.metadata, e.occurred_at
     FROM ox_events e
     JOIN ox_sent_emails se ON e.sent_email_id = se.id
     WHERE se.enrollment_id = $1
     ORDER BY e.occurred_at DESC`,
    [enrollmentId]
  );
  const events = eventsRes.rows;

  const ruleResults: Array<{ rule: ConditionRule; matched: boolean }> = [];

  for (const rule of condition.rules) {
    let matched = false;

    // Filter relevant sent email if stepRef specified
    const targetEmails = rule.stepRef
      ? sentEmails.filter((se) => se.step_id === rule.stepRef || String(se.step_id) === String(rule.stepRef))
      : sentEmails;

    const targetSentEmailIds = new Set(targetEmails.map((se) => se.id));
    const targetEvents = events.filter((ev) => targetSentEmailIds.has(ev.sent_email_id));

    // Time window check helper
    const isWithinHours = (occurredAt: Date, sentAt?: Date): boolean => {
      if (!rule.withinHours || rule.withinHours <= 0) return true;
      const refTime = sentAt ? sentAt.getTime() : occurredAt.getTime();
      const diffMs = Math.abs(occurredAt.getTime() - refTime);
      return diffMs <= rule.withinHours * 60 * 60 * 1000;
    };

    switch (rule.type) {
      case 'opened': {
        const hasOpen = targetEmails.some((se) => {
          if (!se.opened_at) return false;
          return isWithinHours(new Date(se.opened_at), se.sent_at ? new Date(se.sent_at) : undefined);
        }) || targetEvents.some((ev) => ev.type === 'email_opened' && isWithinHours(new Date(ev.occurred_at)));
        matched = hasOpen;
        break;
      }

      case 'not_opened': {
        const hasOpen = targetEmails.some((se) => se.opened_at) || targetEvents.some((ev) => ev.type === 'email_opened');
        matched = !hasOpen;
        break;
      }

      case 'clicked': {
        const hasClick = targetEmails.some((se) => se.clicked_at) || targetEvents.some((ev) => ev.type === 'email_clicked');
        matched = hasClick;
        break;
      }

      case 'not_clicked': {
        const hasClick = targetEmails.some((se) => se.clicked_at) || targetEvents.some((ev) => ev.type === 'email_clicked');
        matched = !hasClick;
        break;
      }

      case 'link_clicked': {
        const clickEvents = targetEvents.filter((ev) => ev.type === 'email_clicked');
        if (rule.linkUrl) {
          matched = clickEvents.some((ev) => {
            const meta = typeof ev.metadata === 'string' ? JSON.parse(ev.metadata) : (ev.metadata || {});
            return (meta.url || meta.link || '').toLowerCase().includes(rule.linkUrl!.toLowerCase());
          });
        } else {
          matched = clickEvents.length > 0;
        }
        break;
      }

      case 'replied': {
        const hasReply = targetEmails.some((se) => se.replied_at) || targetEvents.some((ev) => ev.type === 'email_replied');
        matched = hasReply;
        break;
      }

      case 'replied_positive': {
        const replyEvents = targetEvents.filter((ev) => ev.type === 'email_replied');
        matched = replyEvents.some((ev) => {
          const meta = typeof ev.metadata === 'string' ? JSON.parse(ev.metadata) : (ev.metadata || {});
          const sentiment = (meta.sentiment || meta.classification || meta.intent || '').toLowerCase();
          return sentiment === 'positive' || sentiment === 'interested' || sentiment === 'meeting_requested';
        });
        break;
      }

      case 'bounced': {
        const hasBounce = targetEmails.some((se) => se.bounced_at) || targetEvents.some((ev) => ev.type === 'email_bounced');
        matched = hasBounce;
        break;
      }

      default:
        matched = false;
    }

    ruleResults.push({ rule, matched });
  }

  // Combine rules with AND / OR operator
  let isOverallMatch = false;
  if (condition.op === 'OR') {
    isOverallMatch = ruleResults.some((r) => r.matched);
  } else {
    // Default AND
    isOverallMatch = ruleResults.length > 0 && ruleResults.every((r) => r.matched);
  }

  let nextStepId: string | null = null;
  let branchTaken: 'true_branch' | 'false_branch' | 'linear' = 'linear';

  if (isOverallMatch && options.onTrueStep) {
    nextStepId = options.onTrueStep;
    branchTaken = 'true_branch';
  } else if (!isOverallMatch && options.onFalseStep) {
    nextStepId = options.onFalseStep;
    branchTaken = 'false_branch';
  }

  return {
    hasCondition: true,
    isMatch: isOverallMatch,
    nextStepId,
    branchTaken,
    ruleResults
  };
}

/**
 * A–Z Variant Assignment: Weighted Round-Robin (Stable per Enrollment)
 * Supports up to 26 variants ('A' to 'Z').
 */
export async function assignStableVariant(
  enrollmentId: string,
  stepId: string,
  pool?: pg.Pool
): Promise<any> {
  const targetPool = pool || getOutreachPool();
  if (!targetPool) {
    throw new Error('Database pool unavailable for variant assignment');
  }

  // 1. Check existing assignment on enrollment
  const enrRes = await targetPool.query(
    `SELECT variant_assignments FROM ox_enrollments WHERE id = $1`,
    [enrollmentId]
  );

  let assignments: Record<string, string> = {};
  if (enrRes.rows.length > 0 && enrRes.rows[0].variant_assignments) {
    assignments = typeof enrRes.rows[0].variant_assignments === 'string'
      ? JSON.parse(enrRes.rows[0].variant_assignments)
      : enrRes.rows[0].variant_assignments;
  }

  if (assignments[stepId]) {
    const varRes = await targetPool.query(
      `SELECT * FROM ox_step_variants WHERE id = $1`,
      [assignments[stepId]]
    );
    if (varRes.rows.length > 0) {
      return varRes.rows[0];
    }
  }

  // 2. Query all variants for step (sorted A-Z)
  const allVarRes = await targetPool.query(
    `SELECT * FROM ox_step_variants WHERE step_id = $1 ORDER BY variant_label ASC`,
    [stepId]
  );

  if (allVarRes.rows.length === 0) {
    throw new Error(`Step ${stepId} has no message variants`);
  }

  const variants = allVarRes.rows;
  if (variants.length === 1) {
    assignments[stepId] = variants[0].id;
    await targetPool.query(
      `UPDATE ox_enrollments SET variant_assignments = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(assignments), enrollmentId]
    );
    return variants[0];
  }

  // 3. Weighted selection using cumulative distribution
  const totalWeight = variants.reduce((sum, v) => sum + Math.max(1, v.weight || 0), 0);
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  let chosen = variants[0];

  for (const v of variants) {
    cumulative += Math.max(1, v.weight || 0);
    if (rand <= cumulative) {
      chosen = v;
      break;
    }
  }

  // 4. Save stable assignment on enrollment
  assignments[stepId] = chosen.id;
  await targetPool.query(
    `UPDATE ox_enrollments SET variant_assignments = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(assignments), enrollmentId]
  );

  return chosen;
}

/**
 * Auto-optimise: Bayesian (Beta posterior) comparison for step variants.
 * Requirements:
 * - Minimum ≥ 100 sends per variant
 * - Never drop a variant below 5% weight
 * - Shift weights toward highest expected reply rate: E[θ] = (replies + 1) / (sends + 2)
 * - Record decision log in ox_steps.optimization_log
 */
export async function autoOptimiseStepVariants(
  stepId: string,
  options?: { pool?: pg.Pool; minSendsThreshold?: number }
): Promise<{
  optimized: boolean;
  reason: string;
  previousWeights: Record<string, number>;
  newWeights: Record<string, number>;
  metrics: Record<string, { sends: number; replies: number; posteriorScore: number }>;
}> {
  const pool = options?.pool || getOutreachPool();
  if (!pool) {
    throw new Error('Database pool unavailable for variant auto-optimization');
  }

  const minSends = options?.minSendsThreshold ?? 100;

  // 1. Fetch step and variants
  const stepRes = await pool.query(`SELECT * FROM ox_steps WHERE id = $1`, [stepId]);
  if (stepRes.rows.length === 0) {
    return {
      optimized: false,
      reason: 'Step not found',
      previousWeights: {},
      newWeights: {},
      metrics: {}
    };
  }

  const step = stepRes.rows[0];
  const varRes = await pool.query(
    `SELECT * FROM ox_step_variants WHERE step_id = $1 ORDER BY variant_label ASC`,
    [stepId]
  );

  const variants = varRes.rows;
  if (variants.length <= 1) {
    return {
      optimized: false,
      reason: 'Step has only 1 variant. Multi-variant optimization requires ≥ 2 variants.',
      previousWeights: {},
      newWeights: {},
      metrics: {}
    };
  }

  // 2. Compute metrics for each variant
  const metrics: Record<string, { sends: number; replies: number; posteriorScore: number }> = {};
  const previousWeights: Record<string, number> = {};
  let allMeetThreshold = true;

  for (const v of variants) {
    previousWeights[v.variant_label] = v.weight;

    const statsRes = await pool.query(
      `SELECT
         COUNT(DISTINCT se.id)::int as sends,
         COUNT(DISTINCT CASE WHEN se.replied_at IS NOT NULL THEN se.id END)::int as replies
       FROM ox_sent_emails se
       WHERE se.step_id = $1 AND se.variant_id = $2`,
      [stepId, v.id]
    );

    const sends = statsRes.rows[0]?.sends ?? 0;
    const replies = statsRes.rows[0]?.replies ?? 0;

    // Beta(1 + replies, 1 + (sends - replies)) Expected Value: (replies + 1) / (sends + 2)
    const posteriorScore = (replies + 1) / (sends + 2);

    metrics[v.variant_label] = {
      sends,
      replies,
      posteriorScore
    };

    if (sends < minSends) {
      allMeetThreshold = false;
    }
  }

  if (!allMeetThreshold) {
    return {
      optimized: false,
      reason: `Minimum sample threshold not reached (each variant requires ≥ ${minSends} sends).`,
      previousWeights,
      newWeights: previousWeights,
      metrics
    };
  }

  // 3. Shift weights using Bayesian posterior expected values
  // Constraint: Floor of 5% weight per variant
  const MIN_WEIGHT = 5;
  const n = variants.length;
  const reservedWeight = MIN_WEIGHT * n;
  const availableWeight = 100 - reservedWeight;

  const totalScore = Object.values(metrics).reduce((sum, m) => sum + m.posteriorScore, 0);

  const newWeights: Record<string, number> = {};
  let allocatedTotal = 0;

  variants.forEach((v) => {
    const proportion = totalScore > 0 ? metrics[v.variant_label].posteriorScore / totalScore : 1 / n;
    const dynamicAdd = Math.round(proportion * availableWeight);
    const finalWeight = MIN_WEIGHT + dynamicAdd;
    newWeights[v.variant_label] = finalWeight;
    allocatedTotal += finalWeight;
  });

  // Normalize rounding difference to sum to exactly 100
  const diff = 100 - allocatedTotal;
  const bestVariantLabel = Object.keys(metrics).reduce((best, curr) =>
    metrics[curr].posteriorScore > metrics[best].posteriorScore ? curr : best
  );
  newWeights[bestVariantLabel] += diff;

  // 4. Update variants in DB
  for (const v of variants) {
    const updatedWeight = newWeights[v.variant_label];
    await pool.query(
      `UPDATE ox_step_variants SET weight = $1, updated_at = NOW() WHERE id = $2`,
      [updatedWeight, v.id]
    );
  }

  // 5. Append decision log in ox_steps
  const existingLog = Array.isArray(step.optimization_log)
    ? step.optimization_log
    : (typeof step.optimization_log === 'string' ? JSON.parse(step.optimization_log) : []);

  const logEntry = {
    timestamp: new Date().toISOString(),
    previousWeights,
    newWeights,
    metrics,
    bestVariant: bestVariantLabel,
    sampleSizeTotal: Object.values(metrics).reduce((sum, m) => sum + m.sends, 0)
  };

  const updatedLog = [logEntry, ...existingLog].slice(0, 50); // Keep last 50 logs

  await pool.query(
    `UPDATE ox_steps SET optimization_log = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(updatedLog), stepId]
  );

  logger.info(`Auto-optimized variants for step ${stepId}: shifted toward variant ${bestVariantLabel}`, {
    context: 'BranchingOptimizer',
    details: logEntry
  });

  return {
    optimized: true,
    reason: `Shifted weights toward Variant ${bestVariantLabel} based on Bayesian posterior reply rate.`,
    previousWeights,
    newWeights,
    metrics
  };
}
