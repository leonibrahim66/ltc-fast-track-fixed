/**
 * Payment Router — Secure backend payment endpoints
 *
 * Exposes 4 tRPC procedures that map to the required REST-style endpoints:
 *
 *   POST /api/request-payment   → payments.requestPayment
 *   POST /api/release-payment   → payments.releasePayment
 *   POST /api/withdraw          → payments.withdraw
 *   POST /api/payment-callback  → payments.callback
 *
 * SECURITY:
 *   - All commission calculations are performed in PaymentService (server-side only).
 *   - Frontend input NEVER includes platformCommission or providerAmount.
 *   - Transactions are logged BEFORE any payout occurs.
 *   - No financial logic from existing carrier/commission flows is modified.
 *
 * MTN MoMo: NOT YET INTEGRATED. Stubs are in PaymentService.
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  requestPayment,
  releasePayment,
  requestWithdrawal,
  handlePaymentCallback,
  getProviderWalletBalance,
  getTransactionsByProvider,
  getTransactionsByPayer,
  getPlatformWalletSummary,
  calculateCommission,
  PLATFORM_COMMISSION_RATE,
  getAllTransactions,
  getCommissionStats,
} from "./payment-service";

// ─── Input Schemas ────────────────────────────────────────────────────────────

const ProviderRoleSchema = z.enum(["zone_manager", "carrier_driver"]);
const ServiceTypeSchema = z.enum(["garbage", "carrier"]);
const PaymentMethodSchema = z.enum([
  "mtn_momo",
  "airtel_money",
  "zamtel_money",
  "bank_transfer",
  "manual",
]);

/**
 * POST /api/request-payment
 * Frontend provides: payerId, providerId, providerRole, serviceType, amountTotal.
 * Backend calculates: platformCommission (10%), providerAmount (90%).
 */
const RequestPaymentSchema = z.object({
  payerId: z.number().int().positive(),
  providerId: z.number().int().positive(),
  providerRole: ProviderRoleSchema,
  serviceType: ServiceTypeSchema,
  serviceReferenceId: z.number().int().positive().optional(),
  amountTotal: z.number().positive("Amount must be greater than 0"),
  paymentMethod: PaymentMethodSchema.optional().default("manual"),
  notes: z.string().max(500).optional(),
});

/**
 * POST /api/release-payment
 */
const ReleasePaymentSchema = z.object({
  transactionId: z.number().int().positive(),
  externalReference: z.string().max(128).optional(),
});

/**
 * POST /api/withdraw
 */
const WithdrawSchema = z.object({
  providerId: z.number().int().positive(),
  providerRole: ProviderRoleSchema,
  amount: z.number().positive("Withdrawal amount must be greater than 0"),
  withdrawalMethod: z.enum(["mtn_momo", "airtel_money", "zamtel_money", "bank_transfer"]),
  accountNumber: z.string().min(5).max(50),
  accountName: z.string().max(255).optional(),
});

/**
 * POST /api/payment-callback
 * Called by the payment gateway (MTN MoMo etc.) via webhook.
 */
const CallbackSchema = z.object({
  referenceId: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  gatewayPayload: z.record(z.string(), z.unknown()),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const paymentRouter = router({
  /**
   * POST /api/request-payment
   *
   * Creates a pending payment transaction with server-calculated 10% commission.
   * Transaction is logged BEFORE any payout (audit requirement).
   *
   * Returns referenceId for use with the payment gateway (MTN MoMo etc.).
   */
  requestPayment: publicProcedure
    .input(RequestPaymentSchema)
    .mutation(async ({ input }) => {
      const result = await requestPayment({
        payerId: input.payerId,
        providerId: input.providerId,
        providerRole: input.providerRole,
        serviceType: input.serviceType,
        serviceReferenceId: input.serviceReferenceId,
        amountTotal: input.amountTotal,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
      });

      return {
        success: true,
        transactionId: result.transactionId,
        referenceId: result.referenceId,
        breakdown: {
          amountTotal: result.amountTotal,
          platformCommission: result.platformCommission,
          providerAmount: result.providerAmount,
          commissionRate: `${PLATFORM_COMMISSION_RATE * 100}%`,
        },
        status: result.status,
        message: "Payment transaction created. Awaiting payment confirmation.",
      };
    }),

  /**
   * POST /api/release-payment
   *
   * Confirms a payment and credits:
   *   - Provider wallet: 90% of amountTotal
   *   - Platform wallet: 10% commission
   *
   * Must be called after payment gateway confirms receipt.
   * For MTN MoMo: this will be triggered automatically by the callback endpoint.
   */
  releasePayment: publicProcedure
    .input(ReleasePaymentSchema)
    .mutation(async ({ input }) => {
      const result = await releasePayment({
        transactionId: input.transactionId,
        externalReference: input.externalReference,
      });

      return {
        success: result.success,
        transactionId: result.transactionId,
        breakdown: {
          providerAmount: result.providerAmount,
          platformCommission: result.platformCommission,
          newProviderBalance: result.newProviderBalance,
        },
        message: `Payment released. Provider credited ZMW ${result.providerAmount.toFixed(2)}.`,
      };
    }),

  /**
   * POST /api/withdraw
   *
   * Provider requests withdrawal of their available balance.
   * Validates sufficient funds before deducting.
   *
   * MTN integration: Will call MTN Disbursement API when keys are configured.
   */
  withdraw: publicProcedure
    .input(WithdrawSchema)
    .mutation(async ({ input }) => {
      const result = await requestWithdrawal({
        providerId: input.providerId,
        providerRole: input.providerRole,
        amount: input.amount,
        withdrawalMethod: input.withdrawalMethod,
        accountNumber: input.accountNumber,
        accountName: input.accountName,
      });

      return {
        success: result.success,
        withdrawalReference: result.withdrawalReference,
        amount: result.amount,
        newBalance: result.newBalance,
        message: `Withdrawal of ZMW ${result.amount.toFixed(2)} initiated. Reference: ${result.withdrawalReference}`,
      };
    }),

  /**
   * POST /api/payment-callback
   *
   * Webhook endpoint for payment gateway callbacks (MTN MoMo, Airtel, etc.).
   * On "completed" → automatically triggers releasePayment.
   * On "failed"    → marks transaction as failed.
   *
   * MTN integration: MTN will POST to this endpoint after payment confirmation.
   * Validate callback signature using MTN_API_KEY before processing.
   */
  callback: publicProcedure
    .input(CallbackSchema)
    .mutation(async ({ input }) => {
      const result = await handlePaymentCallback({
        referenceId: input.referenceId,
        status: input.status,
        gatewayPayload: input.gatewayPayload as Record<string, unknown>,
      });

      return {
        processed: result.processed,
        transactionId: result.transactionId,
        status: result.status,
        message: `Callback processed. Transaction ${result.transactionId} is now ${result.status}.`,
      };
    }),

  // ─── Query Helpers ──────────────────────────────────────────────────────────

  /**
   * Get provider wallet balance
   */
  providerBalance: publicProcedure
    .input(z.object({ providerId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const balance = await getProviderWalletBalance(input.providerId);
      if (!balance) {
        return {
          availableBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          pendingBalance: 0,
        };
      }
      return balance;
    }),

  /**
   * Get transactions for a provider
   */
  providerTransactions: publicProcedure
    .input(z.object({
      providerId: z.number().int().positive(),
      limit: z.number().int().min(1).max(200).optional().default(50),
    }))
    .query(async ({ input }) => {
      return getTransactionsByProvider(input.providerId, input.limit);
    }),

  /**
   * Get transactions for a payer (customer)
   */
  payerTransactions: publicProcedure
    .input(z.object({
      payerId: z.number().int().positive(),
      limit: z.number().int().min(1).max(200).optional().default(50),
    }))
    .query(async ({ input }) => {
      return getTransactionsByPayer(input.payerId, input.limit);
    }),

  /**
   * Platform wallet summary (admin use)
   */
  platformSummary: publicProcedure.query(async () => {
    const summary = await getPlatformWalletSummary();
    return summary ?? {
      totalCommissionEarned: 0,
      availableBalance: 0,
      totalWithdrawn: 0,
    };
  }),

  /**
   * Preview commission breakdown for a given amount (no DB write)
   */
  previewCommission: publicProcedure
    .input(z.object({ amountTotal: z.number().positive() }))
    .query(({ input }) => {
      const { platformCommission, providerAmount } = calculateCommission(input.amountTotal);
      return {
        amountTotal: input.amountTotal,
        platformCommission,
        providerAmount,
        commissionRate: `${PLATFORM_COMMISSION_RATE * 100}%`,
      };
    }),
  /**
   * Get all transactions (admin use — most recent first)
   */
  adminAllTransactions: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(500).optional().default(200) }))
    .query(async ({ input }) => {
      return getAllTransactions(input.limit);
    }),

  /**
   * Commission statistics for the admin Commission Dashboard
   */
  adminCommissionStats: publicProcedure.query(async () => {
    return getCommissionStats();
  }),
});

export type PaymentRouter = typeof paymentRouter;
