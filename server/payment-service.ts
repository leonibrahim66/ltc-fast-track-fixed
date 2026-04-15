/**
 * PaymentService — Secure backend payment layer
 *
 * SECURITY CONTRACT:
 *   - All commission calculations happen here, never on the frontend.
 *   - Frontend provides: payerId, providerId, providerRole, serviceType, amountTotal, serviceReferenceId.
 *   - platformCommission and providerAmount are ALWAYS recalculated here, ignoring any frontend values.
 *   - No financial logic is modified for existing carrier/commission flows.
 *
 * Commission rule:
 *   platformCommission = amountTotal * PLATFORM_COMMISSION_RATE  (10%)
 *   providerAmount     = amountTotal - platformCommission         (90%)
 *
 * Payment flow:
 *   Customer pays → Platform Wallet (holds full amount)
 *   → 10% stays in Platform Wallet as commission
 *   → 90% credited to Provider Wallet on release
 *
 * MTN MoMo integration: ACTIVE when MTN_BASE_URL + MTN_COLLECTION_SUBSCRIPTION_KEY +
 *   MTN_API_USER + MTN_API_KEY are set. Falls back to manual mode when unconfigured.
 */

import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { getDb } from "./db";
import {
  isMtnConfigured,
  isMtnDisbursementConfigured,
  requestToPay,
  pollUntilFinal,
  getRequestToPayStatus,
  disbursementTransfer,
  getDisbursementStatus,
} from "./mtn-momo";
import {
  paymentTransactions,
  providerWallets,
  platformWallet,
  InsertPaymentTransaction,
  PaymentTransaction,
} from "../drizzle/schema";
import {
  calculateCommission as calcCommissionAsync,
  ensureDefaultCommissionRules,
  PLATFORM_CONFIG,
  type CommissionServiceType,
} from "./commission-service";
import crypto from "crypto";

// ─── Constants ───────────────────────────────────────────────────────────────

export const PLATFORM_COMMISSION_RATE = 0.10; // 10% default — actual rate loaded from commission_rules table via CommissionService

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RequestPaymentInput {
  payerId: number;
  providerId: number;
  providerRole: "zone_manager" | "carrier_driver";
  serviceType: "garbage" | "carrier" | "subscription";
  serviceReferenceId?: number;
  amountTotal: number; // ZMW, two decimal places
  paymentMethod?: "mtn_momo" | "airtel_money" | "zamtel_money" | "bank_transfer" | "manual";
  /** Customer MSISDN for MTN MoMo RequestToPay (e.g. "260971234567") */
  customerPhone?: string;
  notes?: string;
}

export interface RequestPaymentResult {
  transactionId: number;
  referenceId: string;
  amountTotal: number;
  platformCommission: number;
  providerAmount: number;
  status: string;
  /** Present when MTN MoMo RequestToPay was initiated */
  mtnAccepted?: boolean;
  /** Present when MTN is not configured — payment must be confirmed manually */
  manualMode?: boolean;
}

export interface ReleasePaymentInput {
  transactionId: number;
  /** Optional gateway reference returned after external payment confirmation */
  externalReference?: string;
}

export interface WithdrawInput {
  providerId: number;
  providerRole: "zone_manager" | "carrier_driver";
  amount: number;
  withdrawalMethod: "mtn_momo" | "airtel_money" | "zamtel_money" | "bank_transfer";
  /** Provider MSISDN for MTN MoMo Disbursement (e.g. "260971234567") */
  accountNumber: string;
  accountName?: string;
}

export interface CallbackInput {
  referenceId: string;
  status: "completed" | "failed";
  gatewayPayload: Record<string, unknown>;
}

// ─── Commission Calculator ────────────────────────────────────────────────────

/**
 * Calculates platform commission and provider payout from a gross amount.
 * Always called server-side; never trust frontend commission values.
 */
export function calculateCommission(amountTotal: number): {
  platformCommission: number;
  providerAmount: number;
} {
  const platformCommission = parseFloat((amountTotal * PLATFORM_COMMISSION_RATE).toFixed(2));
  const providerAmount = parseFloat((amountTotal - platformCommission).toFixed(2));
  return { platformCommission, providerAmount };
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

async function ensurePlatformWallet(db: ReturnType<typeof drizzle>) {
  if (!db) throw new Error("Database not available");
  const [existing] = await db.select().from(platformWallet).limit(1);
  if (!existing) {
    await db.insert(platformWallet).values({
      totalCommissionEarned: "0.00",
      availableBalance: "0.00",
      totalWithdrawn: "0.00",
    });
    const [created] = await db.select().from(platformWallet).limit(1);
    return created;
  }
  return existing;
}

async function ensureProviderWallet(
  db: ReturnType<typeof drizzle>,
  providerId: number,
  providerRole: "zone_manager" | "carrier_driver",
) {
  if (!db) throw new Error("Database not available");
  const [existing] = await db
    .select()
    .from(providerWallets)
    .where(eq(providerWallets.providerId, providerId));
  if (!existing) {
    await db.insert(providerWallets).values({
      providerId,
      providerRole,
      availableBalance: "0.00",
      totalEarned: "0.00",
      totalWithdrawn: "0.00",
      pendingBalance: "0.00",
    });
    const [created] = await db
      .select()
      .from(providerWallets)
      .where(eq(providerWallets.providerId, providerId));
    return created;
  }
  return existing;
}

// ─── Service Methods ──────────────────────────────────────────────────────────

/**
 * POST /api/request-payment
 *
 * Creates a pending payment transaction with server-calculated commission.
 * The transaction is logged BEFORE any payout occurs (audit requirement).
 *
 * MTN integration point: After creating the transaction, this is where
 * the MTN Collection API call will be made using MTN_COLLECTION_KEY.
 */
export async function requestPayment(
  input: RequestPaymentInput,
): Promise<RequestPaymentResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ── Server-side commission calculation (NEVER trust frontend values) ──
  // Uses CommissionService which reads per-service rates from commission_rules table
  const commissionCalc = await calcCommissionAsync(
    input.amountTotal,
    input.serviceType as CommissionServiceType,
  );
  const { platformCommission, providerAmount, appliedRate, transactionSource } = {
    platformCommission: commissionCalc.platformCommission,
    providerAmount: commissionCalc.providerAmount,
    appliedRate: commissionCalc.appliedRate,
    transactionSource: commissionCalc.transactionSource,
  };

  // ── Generate unique internal reference ──
  const referenceId = `LTC-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  // ── Log transaction BEFORE any payout (audit requirement) ──
  const insertData: InsertPaymentTransaction = {
    payerId: input.payerId,
    providerId: input.providerId,
    providerRole: input.providerRole,
    serviceType: input.serviceType as "garbage" | "carrier",
    serviceReferenceId: input.serviceReferenceId ?? null,
    amountTotal: input.amountTotal.toFixed(2),
    platformCommission: platformCommission.toFixed(2),
    providerAmount: providerAmount.toFixed(2),
    // Commission tracking fields
    commissionAmount: platformCommission.toFixed(2),
    platformAmount: platformCommission.toFixed(2),
    transactionSource: transactionSource as "garbage" | "carrier" | "subscription",
    appliedCommissionRate: appliedRate.toFixed(4),
    paymentMethod: input.paymentMethod ?? "manual",
    referenceId,
    status: "pending",
    notes: input.notes ?? null,
  };

  const result = await db.insert(paymentTransactions).values(insertData);
  const transactionId = result[0].insertId;

  // ── MTN MoMo RequestToPay ──────────────────────────────────────────────────
  // If MTN credentials are configured AND the payment method is mtn_momo,
  // initiate a RequestToPay on the customer's phone.
  // Falls back to manual mode when credentials are absent (e.g. during development).

  if (input.paymentMethod === "mtn_momo" && isMtnConfigured()) {
    if (!input.customerPhone) {
      throw new Error("customerPhone is required for MTN MoMo payments");
    }

    const mtnResult = await requestToPay({
      referenceId,
      amount: input.amountTotal,
      customerMsisdn: input.customerPhone,
      payerMessage: `LTC Fast Track - ${input.serviceType === "garbage" ? "Waste Collection" : "Carrier Service"} Payment`,
      payeeNote: `LTC-${input.serviceType}-${transactionId}`,
      externalId: referenceId,
    });

    if (!mtnResult.accepted) {
      // MTN rejected the request — mark transaction as failed
      await db
        .update(paymentTransactions)
        .set({ status: "failed", notes: mtnResult.error ?? "MTN RequestToPay rejected" })
        .where(eq(paymentTransactions.id, transactionId));
      throw new Error(mtnResult.error ?? "MTN RequestToPay was not accepted");
    }

    // MTN accepted (202) — update status to processing
    await db
      .update(paymentTransactions)
      .set({ status: "processing" })
      .where(eq(paymentTransactions.id, transactionId));

    return {
      transactionId,
      referenceId,
      amountTotal: input.amountTotal,
      platformCommission,
      providerAmount,
      status: "processing",
      mtnAccepted: true,
    };
  }

  // Manual / non-MTN mode — transaction stays pending until manually released
  return {
    transactionId,
    referenceId,
    amountTotal: input.amountTotal,
    platformCommission,
    providerAmount,
    status: "pending",
    manualMode: !isMtnConfigured(),
  };
}

/**
 * POST /api/release-payment
 *
 * Confirms a payment and credits the provider's wallet with 90%.
 * Platform wallet receives the 10% commission.
 * Transaction must be in "pending" or "processing" state.
 *
 * MTN integration point: After confirming payment, this is where
 * the MTN Disbursement API call will be made using MTN_DISBURSEMENT_KEY.
 */
export async function releasePayment(input: ReleasePaymentInput): Promise<{
  success: boolean;
  transactionId: number;
  providerAmount: number;
  platformCommission: number;
  newProviderBalance: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ── Fetch and validate transaction ──
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, input.transactionId));

  if (!txn) throw new Error(`Transaction ${input.transactionId} not found`);
  if (txn.status === "completed" || txn.status === "released") {
    throw new Error(`Transaction ${input.transactionId} already released`);
  }
  if (txn.status === "failed" || txn.status === "cancelled") {
    throw new Error(`Cannot release transaction in status: ${txn.status}`);
  }

  const providerAmount = parseFloat(txn.providerAmount);
  const platformCommission = parseFloat(txn.platformCommission);

  // ── Ensure wallets exist ──
  await ensurePlatformWallet(db);
  const providerWallet = await ensureProviderWallet(db, txn.providerId, txn.providerRole);

  // ── Credit provider wallet ──
  const newProviderBalance = parseFloat(providerWallet.availableBalance) + providerAmount;
  const newProviderTotal = parseFloat(providerWallet.totalEarned) + providerAmount;

  await db
    .update(providerWallets)
    .set({
      availableBalance: newProviderBalance.toFixed(2),
      totalEarned: newProviderTotal.toFixed(2),
    })
    .where(eq(providerWallets.providerId, txn.providerId));

  // ── Credit platform wallet commission ──
  await db
    .update(platformWallet)
    .set({
      totalCommissionEarned: sql`totalCommissionEarned + ${platformCommission.toFixed(2)}`,
      availableBalance: sql`availableBalance + ${platformCommission.toFixed(2)}`,
    });

  // ── Mark transaction as completed ──
  await db
    .update(paymentTransactions)
    .set({
      status: "completed",
      ...(input.externalReference ? { referenceId: input.externalReference } : {}),
    })
    .where(eq(paymentTransactions.id, input.transactionId));

  // ── MTN Disbursement stub ──
  // TODO: When MTN_DISBURSEMENT_KEY is set, call MTN Disbursement API here to
  //   push providerAmount to the provider's registered mobile money account.

  return {
    success: true,
    transactionId: input.transactionId,
    providerAmount,
    platformCommission,
    newProviderBalance,
  };
}

/**
 * POST /api/withdraw
 *
 * Provider requests a withdrawal of their available balance.
 * Validates sufficient balance before creating the withdrawal record.
 *
 * MTN integration point: This is where the MTN Disbursement API will be
 * called to push funds to the provider's mobile money account.
 */
export async function requestWithdrawal(input: WithdrawInput): Promise<{
  success: boolean;
  withdrawalReference: string;
  amount: number;
  newBalance: number;
  mtnDisbursementAccepted: boolean;
  mtnDisbursementError?: string;
  manualMode: boolean;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const wallet = await ensureProviderWallet(db, input.providerId, input.providerRole);
  const available = parseFloat(wallet.availableBalance);

  if (input.amount <= 0) throw new Error("Withdrawal amount must be greater than 0");
  if (input.amount > available) {
    throw new Error(
      `Insufficient balance. Available: ZMW ${available.toFixed(2)}, Requested: ZMW ${input.amount.toFixed(2)}`,
    );
  }

  const withdrawalReference = `WD-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const newBalance = available - input.amount;
  const newTotalWithdrawn = parseFloat(wallet.totalWithdrawn) + input.amount;

  // ── Deduct from provider wallet ──
  await db
    .update(providerWallets)
    .set({
      availableBalance: newBalance.toFixed(2),
      totalWithdrawn: newTotalWithdrawn.toFixed(2),
    })
    .where(eq(providerWallets.providerId, input.providerId));

  // ── Log withdrawal against a completed transaction (find latest released) ──
  // Mark the withdrawal reference on the most recent completed transaction for this provider
  const [latestTxn] = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        eq(paymentTransactions.providerId, input.providerId),
        eq(paymentTransactions.status, "completed"),
      ),
    )
    .orderBy(sql`createdAt DESC`)
    .limit(1);

  if (latestTxn) {
    await db
      .update(paymentTransactions)
      .set({
        status: "released",
        withdrawalRequestedAt: new Date(),
        withdrawalReference,
      })
      .where(eq(paymentTransactions.id, latestTxn.id));
  }

  // ── MTN MoMo Disbursement Transfer ──────────────────────────────────────────────────
  // When MTN Disbursement is configured AND the withdrawal method is mtn_momo,
  // initiate a Transfer to the provider's MTN MoMo account.
  // Falls back to manual mode when credentials are absent.

  let mtnDisbursementAccepted = false;
  let mtnDisbursementError: string | undefined;

  if (input.withdrawalMethod === "mtn_momo" && isMtnDisbursementConfigured()) {
    const mtnResult = await disbursementTransfer({
      referenceId: withdrawalReference,
      amount: input.amount,
      providerMsisdn: input.accountNumber,
      payerMessage: "LTC Fast Track Withdrawal",
      payeeNote: `Provider payout — ${input.providerRole} ID ${input.providerId}`,
      externalId: withdrawalReference,
    });

    if (!mtnResult.accepted) {
      // MTN rejected the transfer — restore the deducted balance
      await db
        .update(providerWallets)
        .set({
          availableBalance: available.toFixed(2),
          totalWithdrawn: parseFloat(wallet.totalWithdrawn).toFixed(2),
        })
        .where(eq(providerWallets.providerId, input.providerId));

      // Revert the withdrawal reference on the transaction if it was set
      if (latestTxn) {
        await db
          .update(paymentTransactions)
          .set({ status: "completed", withdrawalReference: null, withdrawalRequestedAt: null })
          .where(eq(paymentTransactions.id, latestTxn.id));
      }

      throw new Error(mtnResult.error ?? "MTN Disbursement Transfer was not accepted");
    }

    mtnDisbursementAccepted = true;

    // Update the withdrawal transaction record with MTN disbursement status
    if (latestTxn) {
      await db
        .update(paymentTransactions)
        .set({
          status: "released",
          notes: `MTN Disbursement Transfer accepted. Reference: ${withdrawalReference}`,
        })
        .where(eq(paymentTransactions.id, latestTxn.id));
    }
  } else if (input.withdrawalMethod === "mtn_momo" && !isMtnDisbursementConfigured()) {
    mtnDisbursementError = "MTN Disbursement not configured — manual payout required";
  }

  return {
    success: true,
    withdrawalReference,
    amount: input.amount,
    newBalance,
    mtnDisbursementAccepted,
    ...(mtnDisbursementError ? { mtnDisbursementError } : {}),
    manualMode: input.withdrawalMethod !== "mtn_momo" || !isMtnDisbursementConfigured(),
  };
}

/**
 * POST /api/payment-callback
 *
 * Receives webhook callbacks from the payment gateway (MTN MoMo etc.).
 * Validates the referenceId and updates transaction status accordingly.
 * On success → triggers releasePayment automatically (commission split runs here).
 *
 * MTN integration:
 *   - When MTN is configured, the callback status is cross-verified against the
 *     MTN status API before releasing funds (prevents spoofed callbacks).
 *   - When MTN is not configured, the status from the input is trusted directly
 *     (manual/test mode).
 */
export async function handlePaymentCallback(input: CallbackInput): Promise<{
  processed: boolean;
  transactionId: number;
  status: string;
  mtnVerified?: boolean;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // ── Find transaction by referenceId ──
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.referenceId, input.referenceId));

  if (!txn) throw new Error(`No transaction found for referenceId: ${input.referenceId}`);

  // ── Store raw callback payload for audit ──
  await db
    .update(paymentTransactions)
    .set({ callbackPayload: JSON.stringify(input.gatewayPayload) })
    .where(eq(paymentTransactions.id, txn.id));

  // ── MTN Cross-Verification ──────────────────────────────────────────────────
  // When MTN is configured, verify the callback against the MTN status API
  // to prevent spoofed/forged callbacks from releasing funds.
  let resolvedStatus = input.status;
  let mtnVerified = false;

  if (isMtnConfigured() && txn.paymentMethod === "mtn_momo") {
    try {
      const mtnStatus = await getRequestToPayStatus(input.referenceId);
      mtnVerified = true;

      if (mtnStatus.status === "SUCCESSFUL") {
        resolvedStatus = "completed";
      } else if (mtnStatus.status === "FAILED") {
        resolvedStatus = "failed";
      } else {
        // Still PENDING — do not release yet, update status and return
        await db
          .update(paymentTransactions)
          .set({ status: "processing" })
          .where(eq(paymentTransactions.id, txn.id));
        return { processed: false, transactionId: txn.id, status: "processing", mtnVerified };
      }
    } catch {
      // MTN status check failed — fall back to trusting the callback input
      // but log the failure in the notes field
      await db
        .update(paymentTransactions)
        .set({ notes: `MTN verification failed; trusting callback status: ${input.status}` })
        .where(eq(paymentTransactions.id, txn.id));
    }
  }

  if (resolvedStatus === "completed") {
    // ── Auto-release: credit provider 90% and platform 10% ──
    await releasePayment({
      transactionId: txn.id,
      externalReference: (input.gatewayPayload?.financialTransactionId as string) ?? undefined,
    });
    return { processed: true, transactionId: txn.id, status: "completed", mtnVerified };
  } else {
    // ── Mark as failed ──
    await db
      .update(paymentTransactions)
      .set({ status: "failed" })
      .where(eq(paymentTransactions.id, txn.id));
    return { processed: true, transactionId: txn.id, status: "failed", mtnVerified };
  }
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

export async function getProviderWalletBalance(providerId: number): Promise<{
  availableBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  pendingBalance: number;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const [wallet] = await db
    .select()
    .from(providerWallets)
    .where(eq(providerWallets.providerId, providerId));
  if (!wallet) return null;
  return {
    availableBalance: parseFloat(wallet.availableBalance),
    totalEarned: parseFloat(wallet.totalEarned),
    totalWithdrawn: parseFloat(wallet.totalWithdrawn),
    pendingBalance: parseFloat(wallet.pendingBalance),
  };
}

export async function getTransactionsByProvider(
  providerId: number,
  limit = 50,
): Promise<PaymentTransaction[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.providerId, providerId))
    .orderBy(sql`createdAt DESC`)
    .limit(limit);
}

export async function getTransactionsByPayer(
  payerId: number,
  limit = 50,
): Promise<PaymentTransaction[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.payerId, payerId))
    .orderBy(sql`createdAt DESC`)
    .limit(limit);
}

export async function getPlatformWalletSummary(): Promise<{
  totalCommissionEarned: number;
  availableBalance: number;
  totalWithdrawn: number;
} | null> {
  const db = await getDb();
  if (!db) return null;
  const [wallet] = await db.select().from(platformWallet).limit(1);
  if (!wallet) return null;
  return {
    totalCommissionEarned: parseFloat(wallet.totalCommissionEarned),
    availableBalance: parseFloat(wallet.availableBalance),
    totalWithdrawn: parseFloat(wallet.totalWithdrawn),
  };
}

/**
 * Get all payment transactions (admin use — most recent first).
 */
export async function getAllTransactions(limit = 200): Promise<PaymentTransaction[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(paymentTransactions)
    .orderBy(sql`createdAt DESC`)
    .limit(limit);
}

/**
 * Commission statistics for the admin Commission Dashboard.
 * Returns total, daily, monthly, and per-transaction commission data.
 */
export async function getCommissionStats(): Promise<{
  totalCommission: number;
  dailyCommission: number;
  monthlyCommission: number;
  totalTransactions: number;
  completedTransactions: number;
  avgCommissionPerTransaction: number;
  byServiceType: { serviceType: string; total: number; count: number }[];
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalCommission: 0,
      dailyCommission: 0,
      monthlyCommission: 0,
      totalTransactions: 0,
      completedTransactions: 0,
      avgCommissionPerTransaction: 0,
      byServiceType: [],
    };
  }

  const allTxns = await db
    .select()
    .from(paymentTransactions)
    .orderBy(sql`createdAt DESC`);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalCommission = 0;
  let dailyCommission = 0;
  let monthlyCommission = 0;
  let completedCount = 0;
  const byServiceMap: Record<string, { total: number; count: number }> = {};

  for (const txn of allTxns) {
    const commission = parseFloat((txn as any).platformCommission ?? "0");
    const createdAt = new Date((txn as any).createdAt);
    const serviceType = (txn as any).transactionSource ?? (txn as any).serviceType ?? "unknown";

    if ((txn as any).status === "completed" || (txn as any).status === "released") {
      totalCommission += commission;
      completedCount++;

      if (createdAt >= todayStart) dailyCommission += commission;
      if (createdAt >= monthStart) monthlyCommission += commission;

      if (!byServiceMap[serviceType]) byServiceMap[serviceType] = { total: 0, count: 0 };
      byServiceMap[serviceType].total += commission;
      byServiceMap[serviceType].count++;
    }
  }

  const byServiceType = Object.entries(byServiceMap).map(([serviceType, data]) => ({
    serviceType,
    total: Math.round(data.total * 100) / 100,
    count: data.count,
  }));

  return {
    totalCommission: Math.round(totalCommission * 100) / 100,
    dailyCommission: Math.round(dailyCommission * 100) / 100,
    monthlyCommission: Math.round(monthlyCommission * 100) / 100,
    totalTransactions: allTxns.length,
    completedTransactions: completedCount,
    avgCommissionPerTransaction:
      completedCount > 0
        ? Math.round((totalCommission / completedCount) * 100) / 100
        : 0,
    byServiceType,
  };
}
