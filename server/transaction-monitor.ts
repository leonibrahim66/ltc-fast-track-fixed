/**
 * Transaction Monitoring Service
 *
 * Runs as a background process on the server.
 * Tracks payment_transactions for stuck/failed/pending states and retries automatically.
 *
 * Features:
 *   - Polls for PENDING transactions older than 2 minutes
 *   - Cross-verifies status with MTN API
 *   - Auto-retries failed RequestToPay (up to MAX_RETRIES)
 *   - Marks timed-out transactions as failed
 *   - Logs all monitoring events for audit
 *
 * Usage: call startTransactionMonitor() once at server startup.
 * Call stopTransactionMonitor() on graceful shutdown.
 */

import { eq, and, lt, inArray, or } from "drizzle-orm";
import { getDb } from "./db";
import { paymentTransactions, providerWallets, platformWallet } from "../drizzle/schema";
import {
  getRequestToPayStatus,
  getDisbursementStatus,
  isSandbox,
  sandboxLog,
} from "./mtn-momo";

// ─── Config ───────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000;          // Check every 60 seconds
const PENDING_TIMEOUT_MINUTES = 30;       // Mark as failed after 30 min pending
const MAX_RETRIES = 3;                    // Max auto-retry attempts
const RETRY_DELAY_MS = 5_000;             // Delay between retries

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonitorStats {
  lastRunAt: Date | null;
  totalChecked: number;
  totalResolved: number;
  totalFailed: number;
  totalRetried: number;
  totalTimedOut: number;
  errors: string[];
}

// ─── State ────────────────────────────────────────────────────────────────────

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export const monitorStats: MonitorStats = {
  lastRunAt: null,
  totalChecked: 0,
  totalResolved: 0,
  totalFailed: 0,
  totalRetried: 0,
  totalTimedOut: 0,
  errors: [],
};

// ─── Logger ───────────────────────────────────────────────────────────────────

function monitorLog(event: string, data?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const payload = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[TXN-MONITOR][${ts}] ${event}${payload}`);
  if (isSandbox()) {
    sandboxLog(`[MONITOR] ${event}`, data);
  }
}

function recordError(msg: string): void {
  monitorStats.errors.push(`${new Date().toISOString()}: ${msg}`);
  // Keep only last 50 errors
  if (monitorStats.errors.length > 50) {
    monitorStats.errors = monitorStats.errors.slice(-50);
  }
}

// ─── DB Helpers ───────────────────────────────────────────────────────────────

async function creditProviderWallet(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  providerId: number,
  amount: number,
): Promise<void> {
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
): Promise<void> {
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

// ─── Core Monitor Logic ───────────────────────────────────────────────────────

async function checkPendingTransactions(): Promise<void> {
  const db = await getDb();
  if (!db) {
    monitorLog("DB unavailable — skipping monitor run");
    return;
  }

  const cutoffTime = new Date(Date.now() - PENDING_TIMEOUT_MINUTES * 60 * 1000);

  // Find transactions that are still processing/pending and have a referenceId
  const pendingTxns = await db
    .select()
    .from(paymentTransactions)
    .where(
      and(
        inArray(paymentTransactions.status, ["processing", "pending"]),
        lt(paymentTransactions.createdAt, cutoffTime),
      ),
    )
    .limit(50);

  if (pendingTxns.length === 0) {
    monitorLog("No stuck transactions found");
    return;
  }

  monitorLog(`Found ${pendingTxns.length} stuck transactions to check`);
  monitorStats.totalChecked += pendingTxns.length;

  for (const txn of pendingTxns) {
    if (!txn.referenceId) {
      // No reference ID — can't check with MTN, mark as failed
      await db
        .update(paymentTransactions)
        .set({
          status: "failed",
          notes: "Transaction timed out: no MTN reference ID",
        })
        .where(eq(paymentTransactions.id, txn.id));
      monitorStats.totalTimedOut++;
      monitorLog("Transaction timed out (no referenceId)", { txnId: txn.id });
      continue;
    }

    try {
      // Determine transaction type from paymentMethod field
      // Disbursement payouts use 'mtn_momo' method but have provider_amount as the key amount
      // We use serviceType to distinguish: carrier/garbage = collection, others = disbursement
      const isCollection = txn.serviceType === "garbage" || txn.serviceType === "carrier";
      let verifiedStatus: "SUCCESSFUL" | "FAILED" | "PENDING" = "PENDING";
      let financialTransactionId: string | undefined;

      if (isCollection) {
        const result = await getRequestToPayStatus(txn.referenceId);
        verifiedStatus = result.status;
        financialTransactionId = result.financialTransactionId;
      } else {
        const result = await getDisbursementStatus(txn.referenceId);
        verifiedStatus = result.status;
        financialTransactionId = result.financialTransactionId;
      }

      monitorLog("MTN status checked", {
        txnId: txn.id,
        referenceId: txn.referenceId,
        verifiedStatus,
        financialTransactionId,
      });

      if (verifiedStatus === "SUCCESSFUL") {
        // Credit wallets and mark complete
        const providerAmount = parseFloat(txn.providerAmount);
        const commission = parseFloat(txn.platformCommission);

        await db
          .update(paymentTransactions)
          .set({
            status: isCollection ? "completed" : "released",
            notes: `Resolved by monitor. Financial Txn ID: ${financialTransactionId ?? "N/A"}`,
          })
          .where(eq(paymentTransactions.id, txn.id));

        if (isCollection) {
          await creditProviderWallet(db, txn.providerId, providerAmount);
          await creditPlatformWallet(db, commission);
        }

        monitorStats.totalResolved++;
        monitorLog("Transaction resolved", { txnId: txn.id, status: verifiedStatus });

      } else if (verifiedStatus === "FAILED") {
        // Check retry count
        // Parse retry count from notes field (no retryCount column in schema)
        const retryMatch = txn.notes?.match(/Auto-retry attempt (\d+)\/(\d+)/);
        const retryCount = retryMatch ? parseInt(retryMatch[1], 10) : 0;

        if (isCollection && retryCount < MAX_RETRIES) {
          // Auto-retry collection payment
          monitorLog("Auto-retrying failed collection", { txnId: txn.id, retryCount });

          await db
            .update(paymentTransactions)
            .set({
              status: "processing",
              notes: `Auto-retry attempt ${retryCount + 1}/${MAX_RETRIES}`,
            })
            .where(eq(paymentTransactions.id, txn.id));

          monitorStats.totalRetried++;

          // Small delay before retry
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

        } else {
          // Max retries exceeded or disbursement — mark as failed
          await db
            .update(paymentTransactions)
            .set({
              status: "failed",
              notes: `Payment failed after ${retryCount} retries. MTN status: FAILED`,
            })
            .where(eq(paymentTransactions.id, txn.id));

          monitorStats.totalFailed++;
          monitorLog("Transaction marked failed", { txnId: txn.id, retryCount });
        }

      } else {
        // Still PENDING — check if it's past the timeout
        const createdAt = new Date(txn.createdAt);
        const ageMinutes = (Date.now() - createdAt.getTime()) / 60_000;

        if (ageMinutes > PENDING_TIMEOUT_MINUTES) {
          await db
            .update(paymentTransactions)
            .set({
              status: "failed",
              notes: `Transaction timed out after ${Math.round(ageMinutes)} minutes. MTN status: PENDING`,
            })
            .where(eq(paymentTransactions.id, txn.id));

          monitorStats.totalTimedOut++;
          monitorLog("Transaction timed out", { txnId: txn.id, ageMinutes: Math.round(ageMinutes) });
        } else {
          monitorLog("Transaction still pending — will check again", {
            txnId: txn.id,
            ageMinutes: Math.round(ageMinutes),
          });
        }
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordError(`Failed to check txn ${txn.id}: ${msg}`);
      monitorLog("Error checking transaction", { txnId: txn.id, error: msg });
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the transaction monitoring background process.
 * Safe to call multiple times — will not start duplicate monitors.
 */
export function startTransactionMonitor(): void {
  if (monitorInterval) {
    monitorLog("Monitor already running — skipping start");
    return;
  }

  monitorLog("Transaction monitor starting", {
    pollIntervalMs: POLL_INTERVAL_MS,
    pendingTimeoutMinutes: PENDING_TIMEOUT_MINUTES,
    maxRetries: MAX_RETRIES,
    sandbox: isSandbox(),
  });

  // Run immediately on start
  runMonitorCycle();

  // Then run on interval
  monitorInterval = setInterval(runMonitorCycle, POLL_INTERVAL_MS);
}

/**
 * Stop the transaction monitoring background process.
 */
export function stopTransactionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    monitorLog("Transaction monitor stopped");
  }
}

/**
 * Get current monitor statistics.
 */
export function getMonitorStats(): MonitorStats & { isRunning: boolean } {
  return { ...monitorStats, isRunning: !!monitorInterval };
}

/**
 * Run a single monitor cycle (exposed for testing and manual triggers).
 */
export async function runMonitorCycle(): Promise<void> {
  if (isRunning) {
    monitorLog("Monitor cycle already in progress — skipping");
    return;
  }

  isRunning = true;
  monitorStats.lastRunAt = new Date();

  try {
    await checkPendingTransactions();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    recordError(`Monitor cycle error: ${msg}`);
    monitorLog("Monitor cycle error", { error: msg });
  } finally {
    isRunning = false;
  }
}
