/**
 * LTC Fast Track — Production Backend Server
 *
 * Stack: Express + pg (PostgreSQL) + axios
 *
 * Routes:
 *   GET  /api/health
 *   POST /api/payments/pawapay               ← initiate deposit (real PawaPay API)
 *   GET  /api/payments/:depositId/status     ← check deposit status (DB + optional PawaPay verify)
 *   POST /api/payments/pawapay/callback      ← PawaPay async deposit callback
 *   GET  /api/wallet/:userId
 *   GET  /api/transactions/:userId
 *   POST /api/linked-accounts/:userId/link
 *   GET  /api/linked-accounts/:userId
 *   POST /api/linked-accounts/:userId/unlink
 *   POST /api/withdrawals                    ← PawaPay payout; wallet deducted only on success
 *   GET  /api/pickups                        ← supports ?userId= filter
 *   POST /api/pickups
 *   GET  /api/pickups/:id
 *   PATCH /api/pickups/:id
 */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

// ─── Environment Validation ───────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const NODE_ENV = process.env.NODE_ENV ?? "development";
const PAWAPAY_API_KEY = process.env.PAWAPAY_API_KEY ?? "";

if (!PAWAPAY_API_KEY) {
  console.error(
    "[FATAL] PAWAPAY_API_KEY environment variable is not set. " +
      "Set it before starting the server."
  );
  process.exit(1);
}

const PAWAPAY_BASE_URL =
  NODE_ENV === "production"
    ? "https://api.pawapay.io"
    : "https://api.sandbox.pawapay.io";

const CALLBACK_BASE_URL =
  process.env.CALLBACK_BASE_URL ?? `http://localhost:${PORT}`;

// ─── Structured Logger ────────────────────────────────────────────────────────

type LogLevel = "INFO" | "WARN" | "ERROR" | "PAYMENT" | "CALLBACK" | "WITHDRAWAL";

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  if (level === "ERROR") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ─── Database Setup (PostgreSQL) ──────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") || NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

// ── Schema Migration ──────────────────────────────────────────────────────────

async function initDB(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id           TEXT PRIMARY KEY,
        "phoneNumber" TEXT NOT NULL UNIQUE,
        country      TEXT NOT NULL DEFAULT 'ZMB',
        province     TEXT,
        city         TEXT,
        town         TEXT,
        "fullAddress" TEXT,
        "createdAt"  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      );

      CREATE TABLE IF NOT EXISTS wallets (
        id         TEXT PRIMARY KEY,
        "userId"   TEXT NOT NULL UNIQUE,
        balance    NUMERIC NOT NULL DEFAULT 0,
        "updatedAt" TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id           TEXT PRIMARY KEY,
        "userId"     TEXT NOT NULL,
        "depositId"  TEXT NOT NULL UNIQUE,
        amount       NUMERIC NOT NULL,
        type         TEXT NOT NULL DEFAULT 'deposit',
        status       TEXT NOT NULL DEFAULT 'pending',
        provider     TEXT,
        "phoneNumber" TEXT,
        "createdAt"  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        "updatedAt"  TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      );

      CREATE TABLE IF NOT EXISTS linked_accounts (
        id              TEXT PRIMARY KEY,
        "userId"        TEXT NOT NULL UNIQUE,
        "phoneNumber"   TEXT NOT NULL,
        provider        TEXT NOT NULL,
        "withdrawalPin" TEXT NOT NULL,
        "isActive"      INTEGER NOT NULL DEFAULT 1,
        "createdAt"     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        "updatedAt"     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      );

      CREATE TABLE IF NOT EXISTS pickups (
        id              TEXT PRIMARY KEY,
        "userId"        TEXT NOT NULL,
        "userName"      TEXT,
        "userPhone"     TEXT,
        location        TEXT,
        latitude        NUMERIC,
        longitude       NUMERIC,
        "wasteType"     TEXT NOT NULL DEFAULT 'residential',
        notes           TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        "zoneId"        TEXT,
        "scheduledDate" TEXT,
        "scheduledTime" TEXT,
        "assignedTo"    TEXT,
        "completedAt"   TEXT,
        "createdAt"     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        "updatedAt"     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_userId    ON transactions("userId");
      CREATE INDEX IF NOT EXISTS idx_transactions_depositId ON transactions("depositId");
      CREATE INDEX IF NOT EXISTS idx_transactions_status    ON transactions(status);
      CREATE INDEX IF NOT EXISTS idx_wallets_userId         ON wallets("userId");
      CREATE INDEX IF NOT EXISTS idx_linked_accounts_userId ON linked_accounts("userId");
      CREATE INDEX IF NOT EXISTS idx_pickups_userId         ON pickups("userId");
      CREATE INDEX IF NOT EXISTS idx_pickups_status         ON pickups(status);
     );

    // Safe column migrations
    const alterStatements = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'ZMB'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS province TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS town TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "fullAddress" TEXT`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider TEXT`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT`,
      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'deposit'`,
    ];
    for (const stmt of alterStatements) {
      try { await client.query(stmt); } catch (_) {}
    }

    log("INFO", "Database initialized successfully");
  } finally {
    client.release();
  }
}

// ─── TypeScript Interfaces ────────────────────────────────────────────────────

interface User {
  id: string;
  phoneNumber: string;
  country: string;
  province?: string;
  city?: string;
  town?: string;
  fullAddress?: string;
  createdAt: string;
}

interface Wallet {
  id: string;
  userId: string;
  balance: number;
  updatedAt: string;
}

interface Transaction {
  id: string;
  userId: string;
  depositId: string;
  amount: number;
  type: string;
  status: string;
  provider: string | null;
  phoneNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LinkedAccount {
  id: string;
  userId: string;
  phoneNumber: string;
  provider: string;
  withdrawalPin: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

type PickupStatus = "pending" | "accepted" | "in_progress" | "completed" | "cancelled";

interface Pickup {
  id: string;
  userId: string;
  userName: string | null;
  userPhone: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  wasteType: string;
  notes: string | null;
  status: PickupStatus;
  zoneId: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  assignedTo: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Database Helpers ─────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString().replace("T", "T").replace(/\.\d{3}Z$/, "Z");
}

async function getOrCreateUser(
  phoneNumber: string,
  opts?: { country?: string; province?: string; city?: string; town?: string; fullAddress?: string }
): Promise<User> {
  const existing = await pool.query<User>(
    `SELECT * FROM users WHERE "phoneNumber" = $1`, [phoneNumber]
  );
  if (existing.rows[0]) return existing.rows[0];

  const userId = `user_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  await pool.query(
    `INSERT INTO users (id, "phoneNumber", country, province, city, town, "fullAddress", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, phoneNumber, opts?.country ?? "ZMB", opts?.province ?? null,
     opts?.city ?? null, opts?.town ?? null, opts?.fullAddress ?? null, now()]
  );
  const result = await pool.query<User>(`SELECT * FROM users WHERE id = $1`, [userId]);
  return result.rows[0];
}

async function getUserById(userId: string): Promise<User | undefined> {
  const result = await pool.query<User>(`SELECT * FROM users WHERE id = $1`, [userId]);
  return result.rows[0];
}

async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const existing = await pool.query<Wallet>(
    `SELECT * FROM wallets WHERE "userId" = $1`, [userId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const walletId = `wallet_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  await pool.query(
    `INSERT INTO wallets (id, "userId", balance, "updatedAt") VALUES ($1, $2, 0, $3)`,
    [walletId, userId, now()]
  );
  const result = await pool.query<Wallet>(`SELECT * FROM wallets WHERE id = $1`, [walletId]);
  return result.rows[0];
}

async function getWalletByUserId(userId: string): Promise<Wallet | undefined> {
  const result = await pool.query<Wallet>(
    `SELECT * FROM wallets WHERE "userId" = $1`, [userId]
  );
  return result.rows[0];
}

async function updateWalletBalance(userId: string, delta: number): Promise<void> {
  await pool.query(
    `UPDATE wallets SET balance = balance + $1, "updatedAt" = $2 WHERE "userId" = $3`,
    [delta, now(), userId]
  );
}

async function createTransaction(
  userId: string,
  depositId: string,
  amount: number,
  type: "deposit" | "withdrawal",
  provider?: string,
  phoneNumber?: string
): Promise<Transaction> {
  const txnId = `txn_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  const n = now();
  await pool.query(
    `INSERT INTO transactions (id, "userId", "depositId", amount, type, status, provider, "phoneNumber", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9)`,
    [txnId, userId, depositId, amount, type, provider ?? null, phoneNumber ?? null, n, n]
  );
  const result = await pool.query<Transaction>(
    `SELECT * FROM transactions WHERE id = $1`, [txnId]
  );
  return result.rows[0];
}

async function getTransactionByDepositId(depositId: string): Promise<Transaction | undefined> {
  const result = await pool.query<Transaction>(
    `SELECT * FROM transactions WHERE "depositId" = $1`, [depositId]
  );
  return result.rows[0];
}

async function updateTransactionStatus(depositId: string, status: string): Promise<void> {
  await pool.query(
    `UPDATE transactions SET status = $1, "updatedAt" = $2 WHERE "depositId" = $3`,
    [status, now(), depositId]
  );
}

async function getTransactionsByUserId(userId: string): Promise<Transaction[]> {
  const result = await pool.query<Transaction>(
    `SELECT * FROM transactions WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]
  );
  return result.rows;
}

async function getLinkedAccount(userId: string): Promise<LinkedAccount | undefined> {
  const result = await pool.query<LinkedAccount>(
    `SELECT * FROM linked_accounts WHERE "userId" = $1 AND "isActive" = 1`, [userId]
  );
  return result.rows[0];
}

async function linkAccount(
  userId: string,
  phoneNumber: string,
  provider: string,
  withdrawalPin: string
): Promise<LinkedAccount> {
  const accountId = `linked_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  const n = now();
  await pool.query(
    `INSERT INTO linked_accounts (id, "userId", "phoneNumber", provider, "withdrawalPin", "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 1, $6, $7)
     ON CONFLICT ("userId") DO UPDATE SET
       "phoneNumber" = EXCLUDED."phoneNumber",
       provider = EXCLUDED.provider,
       "withdrawalPin" = EXCLUDED."withdrawalPin",
       "isActive" = 1,
       "updatedAt" = EXCLUDED."updatedAt"`,
    [accountId, userId, phoneNumber, provider, withdrawalPin, n, n]
  );
  const result = await pool.query<LinkedAccount>(
    `SELECT * FROM linked_accounts WHERE "userId" = $1 AND "isActive" = 1`, [userId]
  );
  return result.rows[0];
}

async function unlinkAccount(userId: string): Promise<void> {
  await pool.query(
    `UPDATE linked_accounts SET "isActive" = 0, "updatedAt" = $1 WHERE "userId" = $2`,
    [now(), userId]
  );
}

// ─── Network Detection ────────────────────────────────────────────────────────

function detectZambiaNetwork(rawPhone: string): string {
  let phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("260")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;

  const prefix3 = phone.substring(0, 3);
  if (prefix3 === "096" || prefix3 === "076") return "MTN_MOMO_ZMB";
  if (prefix3 === "097" || prefix3 === "077") return "AIRTEL_OAPI_ZMB";
  if (prefix3 === "095" || prefix3 === "075") return "ZAMTEL_ZMB";

  const prefix2 = phone.substring(1, 3);
  if (prefix2 === "96" || prefix2 === "76") return "MTN_MOMO_ZMB";
  if (prefix2 === "97" || prefix2 === "77") return "AIRTEL_OAPI_ZMB";
  if (prefix2 === "95" || prefix2 === "75") return "ZAMTEL_ZMB";

  return "MTN_MOMO_ZMB";
}

function detectTanzaniaNetwork(rawPhone: string): string {
  let phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("255")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;

  const prefix3 = phone.substring(0, 3);
  if (["074", "075", "076"].includes(prefix3)) return "VODACOM_TZ";
  if (prefix3 === "078") return "AIRTEL_TZ";
  if (prefix3 === "071" || prefix3 === "065") return "TIGO_TZ";
  if (prefix3 === "062") return "HALOTEL_TZ";
  return "VODACOM_TZ";
}

function detectNetwork(countryCode: string, rawPhone: string): string {
  if (countryCode === "TZA") return detectTanzaniaNetwork(rawPhone);
  return detectZambiaNetwork(rawPhone);
}

function toE164(countryCode: string, rawPhone: string): string {
  const phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (countryCode === "TZA") {
    if (phone.startsWith("255")) return phone;
    if (phone.startsWith("0")) return "255" + phone.slice(1);
    return "255" + phone;
  }
  if (phone.startsWith("260")) return phone;
  if (phone.startsWith("0")) return "260" + phone.slice(1);
  return "260" + phone;
}

function currencyForCountry(countryCode: string): string {
  if (countryCode === "TZA") return "TZS";
  return "ZMW";
}

// ─── PawaPay API Client ───────────────────────────────────────────────────────

interface PawaPayDepositRequest {
  depositId: string;
  payer: { type: "MMO"; accountDetails: { phoneNumber: string; provider: string } };
  amount: string;
  currency: string;
  statementDescription?: string;
  clientReferenceId?: string;
  customerMessage?: string;
  callbackUrl?: string;
}

interface PawaPayDepositResponse {
  depositId: string;
  status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
  created?: string;
  failureReason?: { failureCode: string; failureMessage: string };
}

interface PawaPayDepositStatusResponse {
  depositId: string;
  status: "ACCEPTED" | "COMPLETED" | "FAILED" | "DUPLICATE_IGNORED";
  amount?: string;
  currency?: string;
  correspondent?: string;
  payer?: { type: string; accountDetails: { phoneNumber: string } };
  created?: string;
  failureReason?: { failureCode: string; failureMessage: string };
}

interface PawaPayPayoutRequest {
  payoutId: string;
  amount: string;
  currency: string;
  country: string;
  correspondent: string;
  recipient: { type: "MSISDN"; address: { value: string } };
  statementDescription?: string;
  clientReferenceId?: string;
  callbackUrl?: string;
}

interface PawaPayPayoutResponse {
  payoutId: string;
  status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
  created?: string;
  failureReason?: { failureCode: string; failureMessage: string };
}

const pawaPayHeaders = () => ({
  Authorization: `Bearer ${process.env.PAWAPAY_PAYOUT_TOKEN || process.env.PAWAPAY_TOKEN || process.env.PAWAPAY_API_KEY}`,
  "Content-Type": "application/json",
});

async function initiatePawaPayDeposit(params: PawaPayDepositRequest): Promise<PawaPayDepositResponse> {
  const response = await axios.post<PawaPayDepositResponse>(
    `${PAWAPAY_BASE_URL}/v2/deposits`, params,
    { headers: pawaPayHeaders(), timeout: 30_000 }
  );
  return response.data;
}

async function fetchPawaPayDepositStatus(depositId: string): Promise<PawaPayDepositStatusResponse | null> {
  try {
    const response = await axios.get<PawaPayDepositStatusResponse>(
      `${PAWAPAY_BASE_URL}/v1/deposits/${depositId}`,
      { headers: pawaPayHeaders(), timeout: 15000 }
    );
    return response.data;
  } catch (error: any) {
    console.error("PawaPay fetch error:", error.response?.data || error.message);
    return null;
  }
}

async function initiatePawaPayPayout(params: PawaPayPayoutRequest): Promise<PawaPayPayoutResponse> {
  const response = await axios.post<PawaPayPayoutResponse>(
    `${PAWAPAY_BASE_URL}/v1/payouts`, params,
    { headers: pawaPayHeaders(), timeout: 30_000 }
  );
  return response.data;
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));

// CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Digest");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});

app.use((req: Request, _res: Response, next: NextFunction) => {
  log("INFO", `${req.method} ${req.path}`);
  next();
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, env: NODE_ENV, pawapay: PAWAPAY_API_KEY ? "configured" : "missing", timestamp: new Date().toISOString() });
});

// ─── Users ────────────────────────────────────────────────────────────────────

app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, country, province, city, town, fullAddress } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, message: "Missing phoneNumber" });

    const user = await getOrCreateUser(phoneNumber, { country, province, city, town, fullAddress });
    await getOrCreateWallet(user.id);

    return res.status(200).json({
      success: true,
      data: { userId: user.id, phoneNumber: user.phoneNumber, country: user.country, isNew: false },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

app.get("/api/users/:userId", async (req: Request, res: Response) => {
  const user = await getUserById(req.params["userId"]);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  return res.json({ success: true, data: user });
});

// ─── Payments — PawaPay Deposit ───────────────────────────────────────────────

app.post("/api/payments/pawapay", async (req: Request, res: Response) => {
  const { amount, phoneNumber, userId: bodyUserId, country: bodyCountry } = req.body;
  const countryCode = bodyCountry ?? (phoneNumber?.replace(/^\+/, "").startsWith("255") ? "TZA" : "ZMB");

  log("PAYMENT", "Deposit request received", { userId: bodyUserId, amount, country: countryCode });

  try {
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ success: false, message: "Invalid amount", errorCode: "INVALID_AMOUNT" });
    if (!phoneNumber)
      return res.status(400).json({ success: false, message: "Missing phoneNumber", errorCode: "MISSING_PHONE" });

    const user = bodyUserId
      ? ((await getUserById(bodyUserId)) ?? (await getOrCreateUser(phoneNumber, { country: countryCode })))
      : await getOrCreateUser(phoneNumber, { country: countryCode });
    await getOrCreateWallet(user.id);

    const e164Phone = toE164(countryCode, phoneNumber);
    const correspondent = detectNetwork(countryCode, phoneNumber);
    const currency = currencyForCountry(countryCode);
    const depositId = uuidv4();

    const pawaPayResponse = await initiatePawaPayDeposit({
      depositId,
      payer: { type: "MMO", accountDetails: { phoneNumber: e164Phone, provider: correspondent } },
      amount: String(Number(amount).toFixed(2)),
      currency,
      clientReferenceId: user.id,
      customerMessage: "LTC Fast Track payment",
    });

    if (pawaPayResponse.status === "REJECTED") {
      return res.status(422).json({
        success: false,
        message: pawaPayResponse.failureReason?.failureMessage ?? "Payment rejected by provider",
        errorCode: pawaPayResponse.failureReason?.failureCode ?? "REJECTED",
      });
    }

    const transaction = await createTransaction(user.id, depositId, Number(amount), "deposit", correspondent, e164Phone);

    return res.status(201).json({
      success: true,
      data: {
        depositId, status: pawaPayResponse.status, amount: Number(amount),
        phoneNumber: e164Phone, provider: correspondent, userId: user.id,
        transactionId: transaction.id, createdAt: pawaPayResponse.created ?? new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    const msg = axios.isAxiosError(error) ? error.message : (error instanceof Error ? error.message : "Internal server error");
    const details = axios.isAxiosError(error) ? error.response?.data : null;
    log("ERROR", "Deposit error", { msg, details });
    return res.status(500).json({ success: false, message: msg, errorCode: "PAWAPAY_ERROR", details });
  }
});

// ─── Payments — Deposit Status ────────────────────────────────────────────────

app.get("/api/payments/:depositId/status", async (req: Request, res: Response) => {
  try {
    const depositId = req.params["depositId"];
    const verify = req.query["verify"] === "true";

    const transaction = await getTransactionByDepositId(depositId);
    if (!transaction) return res.status(404).json({ success: false, message: "Transaction not found", errorCode: "NOT_FOUND" });

    let liveStatus: string | undefined;

    if (verify) {
      const liveData = await fetchPawaPayDepositStatus(depositId);
      if (liveData) {
        liveStatus = liveData.status;
        if (liveData.status === "COMPLETED") {
          await updateTransactionStatus(depositId, "completed");
          await updateWalletBalance(transaction.userId, transaction.amount);
        } else if (liveData.status === "FAILED") {
          await updateTransactionStatus(depositId, "failed");
        } else if (liveData.status === "ACCEPTED") {
          const createdAt = new Date(transaction.createdAt).getTime();
          if (Date.now() - createdAt > 60 * 1000) await updateTransactionStatus(depositId, "failed");
        }
      } else {
        const createdAt = new Date(transaction.createdAt).getTime();
        if (Date.now() - createdAt > 60 * 1000) {
          await updateTransactionStatus(depositId, "failed");
          log("PAYMENT", "Deposit auto-expired (no PIN entered)", { depositId });
        }
      }
    }

    const updated = (await getTransactionByDepositId(depositId)) ?? transaction;
    return res.json({
      success: true,
      data: {
        depositId: updated.depositId, transactionId: updated.id, userId: updated.userId,
        amount: updated.amount, status: updated.status, provider: updated.provider,
        phoneNumber: updated.phoneNumber, createdAt: updated.createdAt, updatedAt: updated.updatedAt,
        ...(liveStatus !== undefined ? { liveStatus } : {}),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    log("ERROR", "Deposit status error", { error: msg });
    return res.status(500).json({ success: false, message: msg, errorCode: "INTERNAL_ERROR" });
  }
});

// ─── Payments — PawaPay Callback ──────────────────────────────────────────────

app.post("/api/payments/pawapay/callback", async (req: Request, res: Response) => {
  try {
    const payload = Buffer.isBuffer(req.body)
      ? (JSON.parse(req.body.toString()) as Record<string, unknown>)
      : (req.body as Record<string, unknown>);

    const depositId = payload["depositId"];
    const payoutId = payload["payoutId"];
    const refundId = payload["refundId"];
    const referenceId = (depositId || payoutId || refundId) as string;
    const status = payload["status"];
    const amount = payload["amount"];

    log("CALLBACK", "PawaPay callback received", {
      referenceId, type: depositId ? "deposit" : payoutId ? "payout" : "refund", status, amount,
    });

    if (!referenceId || !status)
      return res.status(400).json({ success: false, message: "Missing referenceId or status" });

    const transaction = await getTransactionByDepositId(referenceId);
    if (!transaction)
      return res.json({ success: true, data: { received: true, referenceId }, timestamp: new Date().toISOString() });

    if (transaction.status === "completed" || transaction.status === "failed")
      return res.json({ success: true, data: { received: true, referenceId }, timestamp: new Date().toISOString() });

    if (status === "COMPLETED") {
      if (transaction.type === "deposit") {
        await updateWalletBalance(transaction.userId, Number(amount ?? transaction.amount));
        log("CALLBACK", "Deposit COMPLETED — wallet credited", { referenceId, userId: transaction.userId });
      } else {
        log("CALLBACK", "Withdrawal COMPLETED", { referenceId, userId: transaction.userId });
      }
      await updateTransactionStatus(referenceId, "completed");
    } else if (status === "FAILED") {
      if (transaction.type === "withdrawal") {
        await updateWalletBalance(transaction.userId, Math.abs(transaction.amount));
        log("CALLBACK", "Withdrawal FAILED — wallet refunded", { referenceId, userId: transaction.userId });
      }
      await updateTransactionStatus(referenceId, "failed");
      log("CALLBACK", "Transaction FAILED", { referenceId, userId: transaction.userId });
    } else {
      log("CALLBACK", `Intermediate status: ${status}`, { referenceId });
    }

    return res.json({ success: true, data: { received: true, referenceId }, timestamp: new Date().toISOString() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Callback processing error";
    log("ERROR", "Callback error", { error: msg });
    return res.status(500).json({ success: false, message: msg });
  }
});

// ─── Wallet ───────────────────────────────────────────────────────────────────

app.get("/api/wallet/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"];
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const wallet = await getOrCreateWallet(userId);
    return res.json({
      success: true,
      data: { walletId: wallet.id, userId: wallet.userId, balance: wallet.balance, phoneNumber: user.phoneNumber, updatedAt: wallet.updatedAt },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

app.get("/api/transactions/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"];
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const transactions = await getTransactionsByUserId(userId);
    const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const completedAmount = transactions.filter((t) => t.status === "completed").reduce((sum, t) => sum + Number(t.amount), 0);
    return res.json({ success: true, data: { userId, phoneNumber: user.phoneNumber, transactions, total: transactions.length, totalAmount, completedAmount }, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── Linked Accounts ──────────────────────────────────────────────────────────

app.post("/api/linked-accounts/:userId/link", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"];
    const { phoneNumber, provider, withdrawalPin } = req.body;

    if (!phoneNumber || phoneNumber.length < 10)
      return res.status(400).json({ success: false, message: "Invalid phone number", errorCode: "INVALID_PHONE" });
    if (!provider)
      return res.status(400).json({ success: false, message: "Provider required", errorCode: "MISSING_PROVIDER" });
    if (!withdrawalPin || withdrawalPin.length < 4)
      return res.status(400).json({ success: false, message: "Invalid PIN", errorCode: "INVALID_PIN" });

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const linkedAccount = await linkAccount(userId, phoneNumber, provider, withdrawalPin);
    return res.status(201).json({
      success: true,
      data: { id: linkedAccount.id, phoneNumber: linkedAccount.phoneNumber, provider: linkedAccount.provider, isActive: linkedAccount.isActive === 1, createdAt: linkedAccount.createdAt },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" });
  }
});

app.get("/api/linked-accounts/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"];
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const linkedAccount = await getLinkedAccount(userId);
    return res.json({
      success: true,
      data: linkedAccount ? { id: linkedAccount.id, phoneNumber: linkedAccount.phoneNumber, provider: linkedAccount.provider, isActive: linkedAccount.isActive === 1, createdAt: linkedAccount.createdAt } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" });
  }
});

app.post("/api/linked-accounts/:userId/unlink", async (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"];
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    await unlinkAccount(userId);
    return res.json({ success: true, data: { unlinked: true }, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── Withdrawals ──────────────────────────────────────────────────────────────

app.post("/api/withdrawals", async (req: Request, res: Response) => {
  const { userId, amount, withdrawalPin } = req.body;
  log("WITHDRAWAL", "Withdrawal request received", { userId, amount });

  try {
    if (!userId || !amount || !withdrawalPin)
      return res.status(400).json({ success: false, message: "Missing required fields" });
    if (Number(amount) <= 0)
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const wallet = await getWalletByUserId(userId);
    if (!wallet || Number(wallet.balance) < Number(amount))
      return res.status(400).json({ success: false, message: "Insufficient balance" });

    const linkedAccount = await getLinkedAccount(userId);
    if (!linkedAccount) return res.status(400).json({ success: false, message: "No linked account found" });
    if (linkedAccount.withdrawalPin !== withdrawalPin)
      return res.status(400).json({ success: false, message: "Invalid withdrawal PIN" });

    const payoutId = uuidv4();
    const userCountry = user.country ?? "ZMB";
    const e164Phone = toE164(userCountry, linkedAccount.phoneNumber);
    const correspondent = detectNetwork(userCountry, linkedAccount.phoneNumber);
    const currency = currencyForCountry(userCountry);

    const pawaPayResponse = await initiatePawaPayPayout({
      payoutId,
      amount: String(Number(amount).toFixed(2)),
      currency, country: userCountry, correspondent,
      recipient: { type: "MSISDN", address: { value: e164Phone } },
      statementDescription: "LTC Fast Track withdrawal",
      clientReferenceId: userId,
    });

    if (pawaPayResponse.status === "REJECTED") {
      return res.status(422).json({
        success: false,
        message: pawaPayResponse.failureReason?.failureMessage ?? "Withdrawal rejected by provider",
        errorCode: pawaPayResponse.failureReason?.failureCode ?? "REJECTED",
      });
    }

    const txn = await createTransaction(userId, payoutId, -Number(amount), "withdrawal", correspondent, e164Phone);
    await updateWalletBalance(userId, -Number(amount));
    await updateTransactionStatus(payoutId, "processing");

    return res.json({
      success: true,
      data: {
        withdrawalId: payoutId, transactionId: txn.id, status: "PROCESSING",
        amount: Number(amount), phoneNumber: e164Phone, provider: correspondent,
        createdAt: pawaPayResponse.created ?? new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("PawaPay FULL ERROR:", error.response?.data || error.message);
    if (axios.isAxiosError(error))
      return res.status(400).json({ success: false, message: "PawaPay error", details: error.response?.data });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ─── Pickups ──────────────────────────────────────────────────────────────────

const VALID_PICKUP_STATUSES: PickupStatus[] = ["pending", "accepted", "in_progress", "completed", "cancelled"];

app.get("/api/pickups", async (req: Request, res: Response) => {
  try {
    const rawUserId = req.query["userId"];
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    let result;
    if (userId) {
      result = await pool.query<Pickup>(`SELECT * FROM pickups WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]);
    } else {
      result = await pool.query<Pickup>(`SELECT * FROM pickups ORDER BY "createdAt" DESC`);
    }
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" });
  }
});

app.post("/api/pickups", async (req: Request, res: Response) => {
  try {
    const { userId, userName, userPhone, location, latitude, longitude, wasteType, notes, zoneId, scheduledDate, scheduledTime } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });

    const id = `pickup_${uuidv4().replace(/-/g, "").substring(0, 16)}`;
    const n = now();

    await pool.query(
      `INSERT INTO pickups (id, "userId", "userName", "userPhone", location, latitude, longitude, "wasteType", notes, status, "zoneId", "scheduledDate", "scheduledTime", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12, $13, $14)`,
      [id, userId, userName ?? null, userPhone ?? null, location ?? null, latitude ?? null, longitude ?? null, wasteType ?? "residential", notes ?? null, zoneId ?? null, scheduledDate ?? null, scheduledTime ?? null, n, n]
    );

    const result = await pool.query<Pickup>(`SELECT * FROM pickups WHERE id = $1`, [id]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" });
  }
});

app.get("/api/pickups/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query<Pickup>(`SELECT * FROM pickups WHERE id = $1`, [req.params["id"]]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "Pickup not found" });
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" });
  }
});

app.patch("/api/pickups/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"];
    const { status, assignedTo, notes, completedAt } = req.body;

    const existing = await pool.query<Pickup>(`SELECT * FROM pickups WHERE id = $1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ success: false, message: "Pickup not found" });

    if (status !== undefined && !VALID_PICKUP_STATUSES.includes(status as PickupStatus))
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_PICKUP_STATUSES.join(", ")}` });

    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
    if (assignedTo !== undefined) { updates.push(`"assignedTo" = $${i++}`); values.push(assignedTo); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); values.push(notes); }
    if (completedAt !== undefined) { updates.push(`"completedAt" = $${i++}`); values.push(completedAt); }
    if (status === "completed" && completedAt === undefined) { updates.push(`"completedAt" = $${i++}`); values.push(new Date().toISOString()); }

    if (updates.length === 0)
      return res.status(400).json({ success: false, message: "No valid fields to update" });

    updates.push(`"updatedAt" = $${i++}`);
    values.push(now());
    values.push(id);

    await pool.query(`UPDATE pickups SET ${updates.join(", ")} WHERE id = $${i}`, values);
    const result = await pool.query<Pickup>(`SELECT * FROM pickups WHERE id = $1`, [id]);
    return res.json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" });
  }
});

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log("ERROR", "Unhandled error", { error: err.message });
  if (!res.headersSent) res.status(500).json({ success: false, message: err.message ?? "Internal server error" });
});

// ─── Server Startup ───────────────────────────────────────────────────────────

initDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    log("INFO", "Server started", { port: PORT, env: NODE_ENV, pawapay: PAWAPAY_BASE_URL, callbackBase: CALLBACK_BASE_URL });
  });
}).catch((err) => {
  console.error("[FATAL] Database initialization failed:", err);
  process.exit(1);
});

const shutdown = async () => {
  log("INFO", "Server shutting down gracefully");
  await pool.end();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
