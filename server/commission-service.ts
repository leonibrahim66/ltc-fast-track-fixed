/**
 * CommissionService — Platform Commission Configuration Engine
 *
 * SECURITY CONTRACT:
 *   - All commission rates are stored and read server-side only.
 *   - Frontend cannot modify or read raw commission rates.
 *   - Only superadmin role can update commission rates.
 *   - All rate changes are recorded in commission_audit_log.
 *
 * Platform payout account:
 *   MSISDN: 0960819993
 *   Currency: ZMW
 *
 * Default commission rates (overrideable per service type):
 *   garbage    → 10%
 *   carrier    → 10%
 *   subscription → 10%
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db";
import { commissionRules, commissionAuditLog } from "../drizzle/schema";

// ─── Platform Config ──────────────────────────────────────────────────────────

export const PLATFORM_CONFIG = {
  msisdn: "0960819993",
  currency: "ZMW",
  defaultCommissionRate: 0.10, // 10% fallback when no rule is configured
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommissionServiceType = "garbage" | "carrier" | "subscription";

export interface CommissionRule {
  id: number;
  serviceType: CommissionServiceType;
  rate: number;           // e.g. 0.10 = 10%
  ratePercent: number;    // e.g. 10
  isActive: boolean;
  description?: string | null;
  createdBy: string;
  updatedAt: Date;
}

export interface CommissionAuditEntry {
  id: number;
  serviceType: CommissionServiceType;
  oldRate: number;
  newRate: number;
  changedBy: string;
  reason?: string | null;
  createdAt: Date;
}

export interface CommissionCalculation {
  amountTotal: number;
  serviceType: CommissionServiceType;
  appliedRate: number;
  ratePercent: number;
  platformCommission: number;
  providerAmount: number;
  platformAmount: number;   // alias for platformCommission (for tracking fields)
  transactionSource: CommissionServiceType;
}

export interface UpdateCommissionRuleInput {
  serviceType: CommissionServiceType;
  newRatePercent: number;   // 0–100
  changedBy: string;        // admin username
  reason?: string;
}

// ─── In-Memory Rate Cache ─────────────────────────────────────────────────────
// Rates are cached for 5 minutes to avoid DB round-trips on every payment.

interface RateCache {
  rates: Record<CommissionServiceType, number>;
  cachedAt: number;
}

let rateCache: RateCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function invalidateCache(): void {
  rateCache = null;
}

// ─── Core Rate Lookup ─────────────────────────────────────────────────────────

/**
 * Get the effective commission rate for a service type.
 * Falls back to PLATFORM_CONFIG.defaultCommissionRate if no rule is configured.
 */
export async function getCommissionRate(
  serviceType: CommissionServiceType,
): Promise<number> {
  // Check cache
  if (rateCache && Date.now() - rateCache.cachedAt < CACHE_TTL_MS) {
    return rateCache.rates[serviceType] ?? PLATFORM_CONFIG.defaultCommissionRate;
  }

  const db = await getDb();
  if (!db) {
    // DB unavailable — use default
    return PLATFORM_CONFIG.defaultCommissionRate;
  }

  // Load all active rules
  const rules = await db
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.isActive, true));

  const rates: Record<CommissionServiceType, number> = {
    garbage: PLATFORM_CONFIG.defaultCommissionRate,
    carrier: PLATFORM_CONFIG.defaultCommissionRate,
    subscription: PLATFORM_CONFIG.defaultCommissionRate,
  };

  for (const rule of rules) {
    const st = rule.serviceType as CommissionServiceType;
    rates[st] = parseFloat(rule.rate);
  }

  rateCache = { rates, cachedAt: Date.now() };
  return rates[serviceType] ?? PLATFORM_CONFIG.defaultCommissionRate;
}

// ─── Commission Calculator ────────────────────────────────────────────────────

/**
 * Calculate commission for a given amount and service type.
 * Always called server-side; never trust frontend commission values.
 */
export async function calculateCommission(
  amountTotal: number,
  serviceType: CommissionServiceType,
): Promise<CommissionCalculation> {
  const appliedRate = await getCommissionRate(serviceType);
  const platformCommission = parseFloat((amountTotal * appliedRate).toFixed(2));
  const providerAmount = parseFloat((amountTotal - platformCommission).toFixed(2));

  return {
    amountTotal,
    serviceType,
    appliedRate,
    ratePercent: parseFloat((appliedRate * 100).toFixed(2)),
    platformCommission,
    providerAmount,
    platformAmount: platformCommission,
    transactionSource: serviceType,
  };
}

/**
 * Synchronous commission calculation using a known rate.
 * Used when the rate has already been fetched (e.g. in a batch).
 */
export function calculateCommissionSync(
  amountTotal: number,
  serviceType: CommissionServiceType,
  rate: number = PLATFORM_CONFIG.defaultCommissionRate,
): CommissionCalculation {
  const platformCommission = parseFloat((amountTotal * rate).toFixed(2));
  const providerAmount = parseFloat((amountTotal - platformCommission).toFixed(2));

  return {
    amountTotal,
    serviceType,
    appliedRate: rate,
    ratePercent: parseFloat((rate * 100).toFixed(2)),
    platformCommission,
    providerAmount,
    platformAmount: platformCommission,
    transactionSource: serviceType,
  };
}

// ─── Rule Management ──────────────────────────────────────────────────────────

/**
 * Get all commission rules (active and inactive).
 * Returns default rules if none are configured in DB.
 */
export async function getAllCommissionRules(): Promise<CommissionRule[]> {
  const db = await getDb();

  const defaults: CommissionRule[] = (
    ["garbage", "carrier", "subscription"] as CommissionServiceType[]
  ).map((st, i) => ({
    id: i + 1,
    serviceType: st,
    rate: PLATFORM_CONFIG.defaultCommissionRate,
    ratePercent: 10,
    isActive: true,
    description: `Default 10% commission for ${st} services`,
    createdBy: "system",
    updatedAt: new Date(),
  }));

  if (!db) return defaults;

  const rules = await db
    .select()
    .from(commissionRules)
    .orderBy(commissionRules.serviceType);

  if (rules.length === 0) {
    // Seed default rules
    await seedDefaultRules(db);
    return defaults;
  }

  return rules.map((r) => ({
    id: r.id,
    serviceType: r.serviceType as CommissionServiceType,
    rate: parseFloat(r.rate),
    ratePercent: parseFloat((parseFloat(r.rate) * 100).toFixed(2)),
    isActive: r.isActive,
    description: r.description,
    createdBy: r.createdBy,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Update a commission rule. Only callable by superadmin.
 * Records the change in commission_audit_log.
 */
export async function updateCommissionRule(
  input: UpdateCommissionRuleInput,
): Promise<{ success: boolean; rule: CommissionRule }> {
  if (input.newRatePercent < 0 || input.newRatePercent > 100) {
    throw new Error("Commission rate must be between 0% and 100%");
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const newRate = parseFloat((input.newRatePercent / 100).toFixed(4));

  // Get existing rule
  const [existing] = await db
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.serviceType, input.serviceType))
    .limit(1);

  const oldRate = existing ? parseFloat(existing.rate) : PLATFORM_CONFIG.defaultCommissionRate;

  if (existing) {
    await db
      .update(commissionRules)
      .set({
        rate: newRate.toFixed(4),
        updatedBy: input.changedBy,
        updatedAt: new Date(),
      })
      .where(eq(commissionRules.serviceType, input.serviceType));
  } else {
    await db.insert(commissionRules).values({
      serviceType: input.serviceType,
      rate: newRate.toFixed(4),
      isActive: true,
      description: `${input.serviceType} service commission`,
      createdBy: input.changedBy,
      updatedBy: input.changedBy,
    });
  }

  // Record audit log entry
  await db.insert(commissionAuditLog).values({
    serviceType: input.serviceType,
    oldRate: oldRate.toFixed(4),
    newRate: newRate.toFixed(4),
    changedBy: input.changedBy,
    reason: input.reason ?? null,
  });

  // Invalidate cache so next payment uses the new rate
  invalidateCache();

  const [updated] = await db
    .select()
    .from(commissionRules)
    .where(eq(commissionRules.serviceType, input.serviceType))
    .limit(1);

  return {
    success: true,
    rule: {
      id: updated.id,
      serviceType: updated.serviceType as CommissionServiceType,
      rate: parseFloat(updated.rate),
      ratePercent: parseFloat((parseFloat(updated.rate) * 100).toFixed(2)),
      isActive: updated.isActive,
      description: updated.description,
      createdBy: updated.createdBy,
      updatedAt: updated.updatedAt,
    },
  };
}

/**
 * Get commission audit log entries (most recent first).
 */
export async function getCommissionAuditLog(
  limit = 50,
): Promise<CommissionAuditEntry[]> {
  const db = await getDb();
  if (!db) return [];

  const entries = await db
    .select()
    .from(commissionAuditLog)
    .orderBy(desc(commissionAuditLog.createdAt))
    .limit(limit);

  return entries.map((e) => ({
    id: e.id,
    serviceType: e.serviceType as CommissionServiceType,
    oldRate: parseFloat(e.oldRate),
    newRate: parseFloat(e.newRate),
    changedBy: e.changedBy,
    reason: e.reason,
    createdAt: e.createdAt,
  }));
}

// ─── Seed Helpers ─────────────────────────────────────────────────────────────

async function seedDefaultRules(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
): Promise<void> {
  const serviceTypes: CommissionServiceType[] = ["garbage", "carrier", "subscription"];
  for (const st of serviceTypes) {
    const [existing] = await db
      .select()
      .from(commissionRules)
      .where(eq(commissionRules.serviceType, st))
      .limit(1);

    if (!existing) {
      await db.insert(commissionRules).values({
        serviceType: st,
        rate: PLATFORM_CONFIG.defaultCommissionRate.toFixed(4),
        isActive: true,
        description: `Default 10% commission for ${st} services`,
        createdBy: "system",
        updatedBy: "system",
      });
    }
  }
}

/**
 * Ensure default commission rules exist in the DB.
 * Call once at server startup.
 */
export async function ensureDefaultCommissionRules(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await seedDefaultRules(db);
}
