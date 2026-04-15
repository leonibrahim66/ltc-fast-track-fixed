/**
 * MTN MoMo Webhook Handler
 *
 * Secure endpoint: POST /api/mtn/webhook
 *
 * Security layers:
 *   1. Signature validation  — HMAC-SHA256 of raw body using MTN_WEBHOOK_SECRET
 *   2. MTN status cross-verification — re-fetches status from MTN API before updating DB
 *   3. Idempotency — ignores duplicate callbacks for already-finalized transactions
 *   4. Sandbox logging — verbose logs when APP_ENV=sandbox
 *
 * Flow:
 *   MTN sends callback → validate signature → cross-verify with MTN status API
 *   → update payment_transactions → credit provider_wallets / platform_wallet
 */

import type { Request, Response } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { paymentTransactions, providerWallets, platformWallet } from "../drizzle/schema";
import { getRequestToPayStatus, getDisbursementStatus, sandboxLog, isSandbox } from "./mtn-momo";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MtnWebhookPayload {
  /** Transaction reference ID (X-Reference-Id used in the original request) */
  referenceId?: string;
  externalId?: string;
  financialTransactionId?: string;
  status?: string;
  reason?: string;
  amount?: string | number;
  currency?: string;
  /** Payer info (Collection callbacks) */
  payer?: { partyIdType: string; partyId: string };
  /** Payee info (Disbursement callbacks) */
  payee?: { partyIdType: string; partyId: string };
  [key: string]: unknown;
}

type WebhookType = "collection" | "disbursement" | "unknown";

// ─── Signature Validation ─────────────────────────────────────────────────────

/**
 * Validates the MTN webhook HMAC-SHA256 signature.
 *
 * MTN signs the raw request body with the shared webhook secret.
 * The signature is sent in the X-Callback-Signature header.
 *
 * In sandbox mode, signature validation is skipped if MTN_WEBHOOK_SECRET is not set.
 */
function validateWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): { valid: boolean; reason?: string } {
  const secret = process.env.MTN_WEBHOOK_SECRET?.trim();

  if (!secret) {
    if (isSandbox()) {
      // Sandbox: allow unsigned callbacks for testing
      sandboxLog("Webhook signature skipped (no MTN_WEBHOOK_SECRET set — sandbox mode)");
      return { valid: true };
    }
    return { valid: false, reason: "MTN_WEBHOOK_SECRET not configured" };
  }

  if (!signatureHeader) {
    return { valid: false, reason: "Missing X-Callback-Signature header" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signatureHeader.replace(/^sha256=/, ""), "hex");
  const expBuffer = Buffer.from(expected, "hex");

  if (sigBuffer.length !== expBuffer.length) {
    return { valid: false, reason: "Signature length mismatch" };
  }

  const match = crypto.timingSafeEqual(sigBuffer, expBuffer);
  return match ? { valid: true } : { valid: false, reason: "Signature mismatch" };
}

// ─── Webhook Type Detection ───────────────────────────────────────────────────

function detectWebhookType(payload: MtnWebhookPayload): WebhookType {
  if (payload.payer) return "collection";
  if (payload.payee) return "disbursement";
  return "unknown";
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

async function findTransactionByReference(
  db: Awaited<ReturnType<typeof getDb>>,
  referenceId: string,
) {
  if (!db) return null;
  const [txn] = await db
    .select()
    .from(paymentTransactions)
    .where(eq(paymentTransactions.referenceId, referenceId))
    .limit(1);
  return txn ?? null;
}

async function creditProviderWallet(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  providerId: number,
  amount: number,
) {
  const [wallet] = await db
    .select()
    .from(providerWallets)
    .where(eq(providerWallets.providerId, providerId))
    .limit(1);

  if (!wallet) return;

  const newAvailable = parseFloat(wallet.availableBalance) + amount;
  const newTotal = parseFloat(wallet.totalEarned) + amount;

  await db
    .update(providerWallets)
    .set({
      availableBalance: newAvailable.toFixed(2),
      totalEarned: newTotal.toFixed(2),
    })
    .where(eq(providerWallets.providerId, providerId));
}

async function creditPlatformWallet(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  commission: number,
) {
  const [wallet] = await db.select().from(platformWallet).limit(1);
  if (!wallet) return;

  const newAvailable = parseFloat(wallet.availableBalance) + commission;
  const newTotal = parseFloat(wallet.totalCommissionEarned) + commission;

  await db
    .update(platformWallet)
    .set({
      availableBalance: newAvailable.toFixed(2),
      totalCommissionEarned: newTotal.toFixed(2),
    })
    .where(eq(platformWallet.id, wallet.id));
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────

export async function handleMtnWebhook(req: Request, res: Response): Promise<void> {
  const rawBody: Buffer = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
  const signatureHeader = req.headers["x-callback-signature"] as string | undefined;
  const payload = req.body as MtnWebhookPayload;

  sandboxLog("Webhook received", {
    headers: {
      "x-callback-signature": signatureHeader ? "[present]" : "[absent]",
      "content-type": req.headers["content-type"],
    },
    payload,
  });

  // ── 1. Signature Validation ──────────────────────────────────────────────────
  const sigResult = validateWebhookSignature(rawBody, signatureHeader);
  if (!sigResult.valid) {
    sandboxLog("Webhook signature invalid", { reason: sigResult.reason });
    res.status(401).json({ error: "Invalid webhook signature", reason: sigResult.reason });
    return;
  }

  // ── 2. Extract Reference ID ──────────────────────────────────────────────────
  const referenceId = payload.referenceId ?? payload.externalId;
  if (!referenceId) {
    sandboxLog("Webhook missing referenceId");
    res.status(400).json({ error: "Missing referenceId or externalId in payload" });
    return;
  }

  const webhookType = detectWebhookType(payload);
  sandboxLog("Webhook type detected", { webhookType, referenceId });

  // ── 3. Cross-Verify with MTN Status API ──────────────────────────────────────
  // Never trust the callback payload alone — always re-fetch from MTN.
  let verifiedStatus: "SUCCESSFUL" | "FAILED" | "PENDING" = "PENDING";
  let financialTransactionId: string | undefined;

  try {
    if (webhookType === "collection") {
      const statusResult = await getRequestToPayStatus(referenceId);
      verifiedStatus = statusResult.status;
      financialTransactionId = statusResult.financialTransactionId;
      sandboxLog("Collection status verified", { referenceId, verifiedStatus, financialTransactionId });
    } else if (webhookType === "disbursement") {
      const statusResult = await getDisbursementStatus(referenceId);
      verifiedStatus = statusResult.status;
      financialTransactionId = statusResult.financialTransactionId;
      sandboxLog("Disbursement status verified", { referenceId, verifiedStatus, financialTransactionId });
    } else {
      // Unknown type — try Collection first, then Disbursement
      try {
        const statusResult = await getRequestToPayStatus(referenceId);
        verifiedStatus = statusResult.status;
        financialTransactionId = statusResult.financialTransactionId;
      } catch {
        const statusResult = await getDisbursementStatus(referenceId);
        verifiedStatus = statusResult.status;
        financialTransactionId = statusResult.financialTransactionId;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    sandboxLog("Webhook MTN status cross-verify failed", { referenceId, error: msg });
    // Return 200 to prevent MTN from retrying — log the failure for manual review
    res.status(200).json({ received: true, warning: "MTN status verification failed — logged for review" });
    return;
  }

  // ── 4. Update Database ───────────────────────────────────────────────────────
  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }

  const txn = await findTransactionByReference(db, referenceId);
  if (!txn) {
    sandboxLog("Webhook transaction not found in DB", { referenceId });
    // Return 200 — MTN should not retry for unknown transactions
    res.status(200).json({ received: true, warning: "Transaction not found" });
    return;
  }

  // ── 5. Idempotency Check ─────────────────────────────────────────────────────
  const finalStatuses = ["completed", "released", "failed", "refunded", "cancelled"];
  if (finalStatuses.includes(txn.status)) {
    sandboxLog("Webhook idempotency — transaction already finalized", { referenceId, status: txn.status });
    res.status(200).json({ received: true, idempotent: true, status: txn.status });
    return;
  }

  // ── 6. Apply Status Update ───────────────────────────────────────────────────
  if (verifiedStatus === "SUCCESSFUL") {
    if (webhookType === "collection" || webhookType === "unknown") {
      // Payment received — credit provider and platform wallets
      const providerAmount = parseFloat(txn.providerAmount);
      const commission = parseFloat(txn.platformCommission);

      await db
        .update(paymentTransactions)
        .set({
          status: "completed",
          notes: `Payment confirmed via MTN webhook. Financial Txn ID: ${financialTransactionId ?? "N/A"}`,
          callbackPayload: JSON.stringify(payload),
        })
        .where(eq(paymentTransactions.id, txn.id));

      await creditProviderWallet(db, txn.providerId, providerAmount);
      await creditPlatformWallet(db, commission);

      sandboxLog("Webhook: payment completed, wallets credited", {
        referenceId,
        providerAmount,
        commission,
        providerId: txn.providerId,
      });
    } else if (webhookType === "disbursement") {
      // Withdrawal payout confirmed
      await db
        .update(paymentTransactions)
        .set({
          status: "released",
          withdrawalCompletedAt: new Date(),
          notes: `Disbursement confirmed via MTN webhook. Financial Txn ID: ${financialTransactionId ?? "N/A"}`,
          callbackPayload: JSON.stringify(payload),
        })
        .where(eq(paymentTransactions.id, txn.id));

      sandboxLog("Webhook: disbursement released", { referenceId, financialTransactionId });
    }
  } else if (verifiedStatus === "FAILED") {
    await db
      .update(paymentTransactions)
      .set({
        status: "failed",
        notes: `Payment failed via MTN webhook. Reason: ${payload.reason ?? "unknown"}`,
        callbackPayload: JSON.stringify(payload),
      })
      .where(eq(paymentTransactions.id, txn.id));

    sandboxLog("Webhook: payment failed", { referenceId, reason: payload.reason });
  } else {
    // Still PENDING — update notes but keep current status
    await db
      .update(paymentTransactions)
      .set({
        notes: `Webhook received (PENDING). Waiting for final status. Ref: ${referenceId}`,
        callbackPayload: JSON.stringify(payload),
      })
      .where(eq(paymentTransactions.id, txn.id));

    sandboxLog("Webhook: payment still pending", { referenceId });
  }

  // Always return 200 to MTN to acknowledge receipt
  res.status(200).json({ received: true, referenceId, verifiedStatus });
}
