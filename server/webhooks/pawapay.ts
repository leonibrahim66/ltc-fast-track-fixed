/**
 * PawaPay Webhook Handlers
 *
 * Handles inbound POST callbacks from PawaPay for:
 *   - Deposit completions/failures  → POST /api/payments/pawapay/deposit
 *   - Refund completions/failures   → POST /api/payments/pawapay/refund
 *   - Signed callbacks (optional)   → POST /api/payments/pawapay/callback
 *
 * Body parsing strategy (set in server/index.ts):
 *   /deposit  — express.json() parses body → req.body is a plain object
 *   /refund   — express.json() parses body → req.body is a plain object
 *   /callback — express.raw()  parses body → req.body is a Buffer (for signature verification)
 *   /health   — no body
 *
 * PawaPay docs: https://docs.pawapay.io/v1/api-reference/deposits/deposit-callback
 *
 * Environment variables:
 *   PAWAPAY_API_KEY  — PawaPay API key
 *   DATABASE_URL     — MySQL connection string
 *   JWT_SECRET       — JWT signing secret
 */

import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  paymentTransactions,
  providerWallets,
  platformWallet,
} from "../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PawaPayDepositCallback {
  depositId: string;
  status: "COMPLETED" | "FAILED";
  requestedAmount: string;
  currency: string;
  country: string;
  correspondent: string;
  payer: {
    type: "MSISDN";
    address: { value: string };
  };
  customerTimestamp: string;
  created: string;
  statementDescription?: string;
  depositedAmount?: string;
  respondedByPayer?: string;
  correspondentIds?: Record<string, string>;
  suspiciousActivityReport?: Array<{ activityType: string; comment: string }>;
  failureReason?: { failureCode: string; failureMessage: string };
  metadata?: Record<string, string>;
}

export interface PawaPayRefundCallback {
  refundId: string;
  status: "COMPLETED" | "FAILED";
  amount: string;
  currency: string;
  country: string;
  correspondent: string;
  recipient: {
    type: "MSISDN";
    address: { value: string };
  };
  customerTimestamp: string;
  created: string;
  statementDescription?: string;
  receivedByRecipient?: string;
  correspondentIds?: Record<string, string>;
  failureReason?: { failureCode: string; failureMessage: string };
  metadata?: Record<string, string>;
}

type DbType = NonNullable<Awaited<ReturnType<typeof getDb>>>;

// ─── Signature Verification ───────────────────────────────────────────────────

/**
 * Verifies the Content-Digest header against the raw request body (Buffer).
 * Used only on the /callback endpoint where express.raw() captures the body.
 * Returns true if verification passes or if no digest header is present.
 */
function verifyContentDigest(
  rawBody: Buffer,
  contentDigestHeader: string | undefined,
): boolean {
  if (!contentDigestHeader) return true; // Signed callbacks not enabled — skip
  try {
    // Header format: "sha-256=:<base64>:" or "sha-512=:<base64>:"
    const match = contentDigestHeader.match(/^(sha-256|sha-512)=:([^:]+):$/);
    if (!match) return false;
    const [, algorithm, expectedBase64] = match;
    const hashAlgo = algorithm === "sha-512" ? "sha512" : "sha256";
    const actualDigest = crypto
      .createHash(hashAlgo)
      .update(rawBody)
      .digest("base64");
    return actualDigest === expectedBase64;
  } catch {
    return false;
  }
}

// ─── Database helpers ─────────────────────────────────────────────────────────

async function creditProviderWallet(db: DbType, providerId: number, amount: number) {
  await db
    .update(providerWallets)
    .set({ availableBalance: sql`availableBalance + ${amount}` })
    .where(eq(providerWallets.providerId, providerId));
}

async function creditPlatformWallet(db: DbType, amount: number) {
  await db
    .update(platformWallet)
    .set({ availableBalance: sql`availableBalance + ${amount}` });
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = Router();

// ─── GET /health ──────────────────────────────────────────────────────────────

/**
 * GET /api/payments/pawapay/health
 * Always returns 200 if the server is running.
 */
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: "pawapay-webhooks",
    endpoints: {
      deposit: "POST /api/payments/pawapay/deposit",
      refund: "POST /api/payments/pawapay/refund",
      callback: "POST /api/payments/pawapay/callback",
    },
    correspondents: {
      mtn: "MTN_MOMO_ZMB",
      airtel: "AIRTEL_OAPI_ZMB",
      zamtel: "ZAMTEL_ZMB",
    },
    env: {
      hasPawapayApiKey: !!process.env.PAWAPAY_API_KEY,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasJwtSecret: !!process.env.JWT_SECRET,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /deposit ────────────────────────────────────────────────────────────

/**
 * POST /api/payments/pawapay/deposit
 *
 * Body is parsed by express.json() (global middleware in index.ts).
 * req.body is already a plain JavaScript object — use it directly.
 * Do NOT call JSON.parse() or any custom body reader here.
 *
 * Configure in: PawaPay Dashboard → System configuration → Callback URLs → Deposits
 */
router.post("/deposit", async (req: Request, res: Response) => {
  const startTime = Date.now();

  // req.body is already parsed by express.json() — use directly, no JSON.parse needed
  const payload = req.body as PawaPayDepositCallback;

  if (!payload?.depositId || !payload?.status) {
    console.warn("[PawaPay] Deposit callback: missing depositId or status. Body:", JSON.stringify(req.body));
    res.status(400).json({ error: "Invalid payload: depositId and status are required" });
    return;
  }

  const { depositId, status } = payload;
  console.log(
    `[PawaPay] Deposit callback received: depositId=${depositId} status=${status} correspondent=${payload.correspondent}`,
  );

  try {
    // DB connection — fail gracefully if DB is unavailable
    let db: DbType | null = null;
    try {
      db = await getDb();
    } catch (dbErr) {
      console.error("[PawaPay] Deposit: DB connection error:", dbErr instanceof Error ? dbErr.stack : dbErr);
    }

    if (!db) {
      console.error(
        `[PawaPay] Deposit: database unavailable for depositId=${depositId}. ` +
        `DATABASE_URL is ${process.env.DATABASE_URL ? "set" : "NOT SET"}.`,
      );
      // Return 503 so PawaPay retries later
      res.status(503).json({ error: "Database unavailable — will retry" });
      return;
    }

    // Look up transaction by referenceId (depositId)
    const transactions = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.referenceId, depositId))
      .limit(1);

    if (transactions.length === 0) {
      console.warn(`[PawaPay] Deposit: no transaction found for depositId=${depositId}`);
      res.status(200).json({ received: true, depositId, note: "Transaction not found in local DB" });
      return;
    }

    const txn = transactions[0];

    // Idempotency check
    const finalStatuses = ["completed", "released", "failed", "refunded", "cancelled"];
    if (finalStatuses.includes(txn.status)) {
      console.log(`[PawaPay] Deposit: already finalized (${txn.status}) for depositId=${depositId}`);
      res.status(200).json({ received: true, depositId, idempotent: true, status: txn.status });
      return;
    }

    // Apply status update
    if (status === "COMPLETED") {
      const providerAmount = parseFloat(txn.providerAmount ?? "0");
      const commission = parseFloat(txn.platformCommission ?? "0");

      await db
        .update(paymentTransactions)
        .set({
          status: "completed",
          notes: `Payment confirmed via PawaPay. Correspondent: ${payload.correspondent}. Deposited: ${payload.depositedAmount ?? payload.requestedAmount} ${payload.currency}`,
          callbackPayload: JSON.stringify(payload),
        })
        .where(eq(paymentTransactions.id, txn.id));

      await creditProviderWallet(db, txn.providerId, providerAmount);
      await creditPlatformWallet(db, commission);

      console.log(
        `[PawaPay] Deposit COMPLETED: depositId=${depositId} providerAmount=${providerAmount} commission=${commission} (${Date.now() - startTime}ms)`,
      );
    } else if (status === "FAILED") {
      const failureMsg = payload.failureReason?.failureMessage ?? "Unknown failure";
      const failureCode = payload.failureReason?.failureCode ?? "UNKNOWN";

      await db
        .update(paymentTransactions)
        .set({
          status: "failed",
          notes: `Payment failed via PawaPay. Code: ${failureCode}. Message: ${failureMsg}`,
          callbackPayload: JSON.stringify(payload),
        })
        .where(eq(paymentTransactions.id, txn.id));

      console.log(`[PawaPay] Deposit FAILED: depositId=${depositId} code=${failureCode} msg=${failureMsg}`);
    }

    res.status(200).json({ received: true, depositId, status });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error(`[PawaPay] Deposit error for depositId=${depositId}: ${errMsg}`);
    if (errStack) console.error(errStack);
    res.status(500).json({ error: errMsg || "Internal server error" });
  }
});

// ─── POST /refund ─────────────────────────────────────────────────────────────

/**
 * POST /api/payments/pawapay/refund
 *
 * Body is parsed by express.json() (global middleware in index.ts).
 * req.body is already a plain JavaScript object — use it directly.
 *
 * Configure in: PawaPay Dashboard → System configuration → Callback URLs → Refunds
 */
router.post("/refund", async (req: Request, res: Response) => {
  const startTime = Date.now();

  // req.body is already parsed by express.json() — use directly
  const payload = req.body as PawaPayRefundCallback;

  if (!payload?.refundId || !payload?.status) {
    console.warn("[PawaPay] Refund callback: missing refundId or status. Body:", JSON.stringify(req.body));
    res.status(400).json({ error: "Invalid payload: refundId and status are required" });
    return;
  }

  const { refundId, status } = payload;
  console.log(
    `[PawaPay] Refund callback received: refundId=${refundId} status=${status} correspondent=${payload.correspondent}`,
  );

  try {
    let db: DbType | null = null;
    try {
      db = await getDb();
    } catch (dbErr) {
      console.error("[PawaPay] Refund: DB connection error:", dbErr instanceof Error ? dbErr.stack : dbErr);
    }

    if (!db) {
      console.error(
        `[PawaPay] Refund: database unavailable for refundId=${refundId}. ` +
        `DATABASE_URL is ${process.env.DATABASE_URL ? "set" : "NOT SET"}.`,
      );
      res.status(503).json({ error: "Database unavailable — will retry" });
      return;
    }

    const transactions = await db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.referenceId, refundId))
      .limit(1);

    if (transactions.length === 0) {
      console.warn(`[PawaPay] Refund: no transaction found for refundId=${refundId}`);
      res.status(200).json({ received: true, refundId, note: "Transaction not found in local DB" });
      return;
    }

    const txn = transactions[0];

    // Idempotency check
    if (txn.status === "refunded" || txn.status === "failed") {
      console.log(`[PawaPay] Refund: already finalized (${txn.status}) for refundId=${refundId}`);
      res.status(200).json({ received: true, refundId, idempotent: true, status: txn.status });
      return;
    }

    if (status === "COMPLETED") {
      await db
        .update(paymentTransactions)
        .set({
          status: "refunded",
          notes: `Refund confirmed via PawaPay. Correspondent: ${payload.correspondent}. Amount: ${payload.amount} ${payload.currency}`,
          callbackPayload: JSON.stringify(payload),
        })
        .where(eq(paymentTransactions.id, txn.id));

      console.log(
        `[PawaPay] Refund COMPLETED: refundId=${refundId} amount=${payload.amount} ${payload.currency} (${Date.now() - startTime}ms)`,
      );
    } else if (status === "FAILED") {
      const failureMsg = payload.failureReason?.failureMessage ?? "Unknown failure";
      const failureCode = payload.failureReason?.failureCode ?? "UNKNOWN";

      await db
        .update(paymentTransactions)
        .set({
          status: "failed",
          notes: `Refund failed via PawaPay. Code: ${failureCode}. Message: ${failureMsg}`,
          callbackPayload: JSON.stringify(payload),
        })
        .where(eq(paymentTransactions.id, txn.id));

      console.log(`[PawaPay] Refund FAILED: refundId=${refundId} code=${failureCode} msg=${failureMsg}`);
    }

    res.status(200).json({ received: true, refundId, status });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    console.error(`[PawaPay] Refund error for refundId=${refundId}: ${errMsg}`);
    if (errStack) console.error(errStack);
    res.status(500).json({ error: errMsg || "Internal server error" });
  }
});

// ─── POST /callback ───────────────────────────────────────────────────────────

/**
 * POST /api/payments/pawapay/callback
 *
 * Signed-callback endpoint for when "Signed Callbacks" are enabled in the
 * PawaPay dashboard. express.raw() in index.ts captures req.body as a Buffer
 * for this path only — so we can verify the Content-Digest signature before
 * processing.
 *
 * req.body here is a Buffer (NOT a parsed object) because express.raw() runs
 * instead of express.json() for this specific path.
 */
router.post("/callback", async (req: Request, res: Response) => {
  // req.body is a raw Buffer from express.raw() — verify signature first
  const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? "");

  const digestHeader = req.headers["content-digest"] as string | undefined;
  if (digestHeader) {
    if (!verifyContentDigest(rawBody, digestHeader)) {
      console.error("[PawaPay] /callback: Content-Digest verification failed");
      res.status(401).json({ error: "Signature verification failed" });
      return;
    }
    console.log("[PawaPay] /callback: Content-Digest verified");
  }

  // Parse JSON from the raw Buffer
  let payload: (PawaPayDepositCallback & PawaPayRefundCallback) | null = null;
  try {
    payload = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    console.warn("[PawaPay] /callback: body is not valid JSON");
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  if (!payload) {
    res.status(400).json({ error: "Empty payload" });
    return;
  }

  // Route to deposit or refund logic based on payload shape
  if ("depositId" in payload && payload.depositId) {
    const depositId = payload.depositId;
    const status = payload.status;
    console.log(`[PawaPay] /callback: deposit callback for depositId=${depositId}`);

    try {
      let db: DbType | null = null;
      try { db = await getDb(); } catch { /* handled below */ }
      if (!db) {
        res.status(503).json({ error: "Database unavailable — will retry" });
        return;
      }
      const txns = await db.select().from(paymentTransactions).where(eq(paymentTransactions.referenceId, depositId)).limit(1);
      if (txns.length === 0) {
        res.status(200).json({ received: true, depositId, note: "Transaction not found" });
        return;
      }
      const txn = txns[0];
      if (["completed", "released", "failed", "refunded", "cancelled"].includes(txn.status)) {
        res.status(200).json({ received: true, depositId, idempotent: true });
        return;
      }
      if (status === "COMPLETED") {
        await db.update(paymentTransactions).set({ status: "completed", callbackPayload: JSON.stringify(payload) }).where(eq(paymentTransactions.id, txn.id));
        await creditProviderWallet(db, txn.providerId, parseFloat(txn.providerAmount ?? "0"));
        await creditPlatformWallet(db, parseFloat(txn.platformCommission ?? "0"));
      } else if (status === "FAILED") {
        await db.update(paymentTransactions).set({ status: "failed", callbackPayload: JSON.stringify(payload) }).where(eq(paymentTransactions.id, txn.id));
      }
      res.status(200).json({ received: true, depositId, status });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[PawaPay] /callback deposit error: ${errMsg}`, err instanceof Error ? err.stack : "");
      res.status(500).json({ error: errMsg });
    }

  } else if ("refundId" in payload && payload.refundId) {
    const refundId = payload.refundId;
    const status = payload.status;
    console.log(`[PawaPay] /callback: refund callback for refundId=${refundId}`);

    try {
      let db: DbType | null = null;
      try { db = await getDb(); } catch { /* handled below */ }
      if (!db) {
        res.status(503).json({ error: "Database unavailable — will retry" });
        return;
      }
      const txns = await db.select().from(paymentTransactions).where(eq(paymentTransactions.referenceId, refundId)).limit(1);
      if (txns.length === 0) {
        res.status(200).json({ received: true, refundId, note: "Transaction not found" });
        return;
      }
      const txn = txns[0];
      if (txn.status === "refunded" || txn.status === "failed") {
        res.status(200).json({ received: true, refundId, idempotent: true });
        return;
      }
      if (status === "COMPLETED") {
        await db.update(paymentTransactions).set({ status: "refunded", callbackPayload: JSON.stringify(payload) }).where(eq(paymentTransactions.id, txn.id));
      } else if (status === "FAILED") {
        await db.update(paymentTransactions).set({ status: "failed", callbackPayload: JSON.stringify(payload) }).where(eq(paymentTransactions.id, txn.id));
      }
      res.status(200).json({ received: true, refundId, status });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[PawaPay] /callback refund error: ${errMsg}`, err instanceof Error ? err.stack : "");
      res.status(500).json({ error: errMsg });
    }

  } else {
    console.warn("[PawaPay] /callback: payload has neither depositId nor refundId:", JSON.stringify(payload));
    res.status(400).json({ error: "Cannot determine callback type: missing depositId or refundId" });
  }
});

export default router;
