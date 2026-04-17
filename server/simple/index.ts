/**
 * LTC Fast Track — Production Backend Server
 *
 * Stack: Express + better-sqlite3 + axios
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
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
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

// ─── Database Setup ───────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "ltc-fast-track.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    phoneNumber TEXT NOT NULL UNIQUE,
    country     TEXT NOT NULL DEFAULT 'ZMB',
    province    TEXT,
    city        TEXT,
    town        TEXT,
    fullAddress TEXT,
    createdAt   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- Migrate existing users table to add new columns if they don't exist
  -- SQLite doesn't support IF NOT EXISTS for columns, so we use a try/catch approach
  -- via separate ALTER TABLE calls below.

  CREATE TABLE IF NOT EXISTS wallets (
    id        TEXT PRIMARY KEY,
    userId    TEXT NOT NULL UNIQUE,
    balance   REAL NOT NULL DEFAULT 0,
    updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id         TEXT PRIMARY KEY,
    userId     TEXT NOT NULL,
    depositId  TEXT NOT NULL UNIQUE,
    amount     REAL NOT NULL,
    type       TEXT NOT NULL DEFAULT 'deposit',
    status     TEXT NOT NULL DEFAULT 'pending',
    provider   TEXT,
    phoneNumber TEXT,
    createdAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updatedAt  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS linked_accounts (
    id            TEXT PRIMARY KEY,
    userId        TEXT NOT NULL UNIQUE,
    phoneNumber   TEXT NOT NULL,
    provider      TEXT NOT NULL,
    withdrawalPin TEXT NOT NULL,
    isActive      INTEGER NOT NULL DEFAULT 1,
    createdAt     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updatedAt     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pickups (
    id            TEXT PRIMARY KEY,
    userId        TEXT NOT NULL,
    userName      TEXT,
    userPhone     TEXT,
    location      TEXT,
    latitude      REAL,
    longitude     REAL,
    wasteType     TEXT NOT NULL DEFAULT 'residential',
    notes         TEXT,
    status        TEXT NOT NULL DEFAULT 'pending',
    zoneId        TEXT,
    scheduledDate TEXT,
    scheduledTime TEXT,
    assignedTo    TEXT,
    completedAt   TEXT,
    createdAt     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updatedAt     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_userId     ON transactions(userId);
  CREATE INDEX IF NOT EXISTS idx_transactions_depositId  ON transactions(depositId);
  CREATE INDEX IF NOT EXISTS idx_transactions_status     ON transactions(status);
  CREATE INDEX IF NOT EXISTS idx_wallets_userId          ON wallets(userId);
  CREATE INDEX IF NOT EXISTS idx_linked_accounts_userId  ON linked_accounts(userId);
  CREATE INDEX IF NOT EXISTS idx_pickups_userId          ON pickups(userId);
  CREATE INDEX IF NOT EXISTS idx_pickups_status          ON pickups(status);
`);

// ─── Migrate existing users table ─────────────────────────────
for (const col of [
  "ALTER TABLE users ADD COLUMN country TEXT NOT NULL DEFAULT 'ZMB'",
  "ALTER TABLE users ADD COLUMN province TEXT",
  "ALTER TABLE users ADD COLUMN city TEXT",
  "ALTER TABLE users ADD COLUMN town TEXT",
  "ALTER TABLE users ADD COLUMN fullAddress TEXT",
]) {
  try { db.exec(col); } catch (_) {}
}

// ─── Migrate transactions table ─────────────────────────────

// add provider column
try {
  db.exec("ALTER TABLE transactions ADD COLUMN provider TEXT");
} catch (_) {}

// add phoneNumber column
try {
  db.exec("ALTER TABLE transactions ADD COLUMN phoneNumber TEXT");
} catch (_) {}

// add type column
try {
  db.exec("ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'deposit'");
} catch (_) {}

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

function getOrCreateUser(
  phoneNumber: string,
  opts?: { country?: string; province?: string; city?: string; town?: string; fullAddress?: string }
): User {
  const existing = db
    .prepare("SELECT * FROM users WHERE phoneNumber = ?")
    .get(phoneNumber) as User | undefined;
  if (existing) return existing;
  const userId = `user_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  db.prepare(
    `INSERT INTO users (id, phoneNumber, country, province, city, town, fullAddress)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    phoneNumber,
    opts?.country ?? "ZMB",
    opts?.province ?? null,
    opts?.city ?? null,
    opts?.town ?? null,
    opts?.fullAddress ?? null
  );
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as User;
}

function getUserById(userId: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as User | undefined;
}

function getOrCreateWallet(userId: string): Wallet {
  const existing = db
    .prepare("SELECT * FROM wallets WHERE userId = ?")
    .get(userId) as Wallet | undefined;
  if (existing) return existing;
  const walletId = `wallet_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  db.prepare("INSERT INTO wallets (id, userId, balance) VALUES (?, ?, 0)").run(walletId, userId);
  return db.prepare("SELECT * FROM wallets WHERE id = ?").get(walletId) as Wallet;
}

function getWalletByUserId(userId: string): Wallet | undefined {
  return db.prepare("SELECT * FROM wallets WHERE userId = ?").get(userId) as Wallet | undefined;
}

function updateWalletBalance(userId: string, delta: number): void {
  db.prepare(
    "UPDATE wallets SET balance = balance + ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE userId = ?"
  ).run(delta, userId);
}

function createTransaction(
  userId: string,
  depositId: string,
  amount: number,
  type: "deposit" | "withdrawal",
  provider?: string,
  phoneNumber?: string
): Transaction {
  const txnId = `txn_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  db.prepare(
    `INSERT INTO transactions (id, userId, depositId, amount, type, status, provider, phoneNumber)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(txnId, userId, depositId, amount, type, provider ?? null, phoneNumber ?? null);
  return db.prepare("SELECT * FROM transactions WHERE id = ?").get(txnId) as Transaction;
}

function getTransactionByDepositId(depositId: string): Transaction | undefined {
  return db
    .prepare("SELECT * FROM transactions WHERE depositId = ?")
    .get(depositId) as Transaction | undefined;
}

function updateTransactionStatus(depositId: string, status: string): void {
  db.prepare(
    "UPDATE transactions SET status = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE depositId = ?"
  ).run(status, depositId);
}

function getTransactionsByUserId(userId: string): Transaction[] {
  return db
    .prepare("SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC")
    .all(userId) as Transaction[];
}

function getLinkedAccount(userId: string): LinkedAccount | undefined {
  return db
    .prepare("SELECT * FROM linked_accounts WHERE userId = ? AND isActive = 1")
    .get(userId) as LinkedAccount | undefined;
}

function linkAccount(
  userId: string,
  phoneNumber: string,
  provider: string,
  withdrawalPin: string
): LinkedAccount {
  const accountId = `linked_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  db.prepare(
    `INSERT OR REPLACE INTO linked_accounts
       (id, userId, phoneNumber, provider, withdrawalPin, isActive)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(accountId, userId, phoneNumber, provider, withdrawalPin);
  return db
    .prepare("SELECT * FROM linked_accounts WHERE userId = ? AND isActive = 1")
    .get(userId) as LinkedAccount;
}

function unlinkAccount(userId: string): void {
  db.prepare(
    "UPDATE linked_accounts SET isActive = 0, updatedAt = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE userId = ?"
  ).run(userId);
}

// ─── Network Detection (multi-country) ────────────────────────────────────────────────────────────────────

/**
 * Detect the Zambian MNO from a phone number.
 * Accepts formats: 09XXXXXXXX, 07XXXXXXXX, 2609XXXXXXXX, +2609XXXXXXXX
 * Returns a PawaPay correspondent ID.
 */
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

/**
 * Detect the Tanzanian MNO from a phone number.
 * Accepts formats: 07XXXXXXXX, 06XXXXXXXX, 25507XXXXXXXX, +25507XXXXXXXX
 * Returns a PawaPay correspondent ID.
 */
function detectTanzaniaNetwork(rawPhone: string): string {
  let phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("255")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;

  const prefix3 = phone.substring(0, 3);
  // Vodacom: 074, 075, 076
  if (prefix3 === "074" || prefix3 === "075" || prefix3 === "076") return "VODACOM_TZA";
  // Airtel: 078
  if (prefix3 === "078") return "AIRTEL_OAPI_TZA";
  // Tigo: 071, 065
  if (prefix3 === "071" || prefix3 === "065") return "TIGO_TZA";
  // Halotel: 062
  if (prefix3 === "062") return "HALOTEL_TZA";

  return "VODACOM_TZA";
}

/**
 * Country-aware network detection.
 * Returns a PawaPay correspondent ID.
 */
function detectNetwork(countryCode: string, rawPhone: string): string {
  if (countryCode === "TZA") return detectTanzaniaNetwork(rawPhone);
  return detectZambiaNetwork(rawPhone);
}

/**
 * Normalise phone number to E.164 format for PawaPay.
 * Zambia: 0971234567 → 260971234567
 * Tanzania: 0741234567 → 255741234567
 */
function toE164(countryCode: string, rawPhone: string): string {
  const phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (countryCode === "TZA") {
    if (phone.startsWith("255")) return phone;
    if (phone.startsWith("0")) return "255" + phone.slice(1);
    return "255" + phone;
  }
  // Default: Zambia
  if (phone.startsWith("260")) return phone;
  if (phone.startsWith("0")) return "260" + phone.slice(1);
  return "260" + phone;
}

/**
 * Determine the PawaPay currency for a country.
 */
function currencyForCountry(countryCode: string): string {
  if (countryCode === "TZA") return "TZS";
  return "ZMW";
}

// ─── PawaPay API Client ───────────────────────────────────────────────────────

interface PawaPayDepositRequest {
  depositId: string;
  payer: {
    type: "MMO";
    accountDetails: {
      phoneNumber: string;
      provider: string;
    };
  };
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
  failureReason?: {
    failureCode: string;
    failureMessage: string;
  };
}

interface PawaPayDepositStatusResponse {
  depositId: string;
  status: "ACCEPTED" | "COMPLETED" | "FAILED" | "DUPLICATE_IGNORED";
  amount?: string;
  currency?: string;
  correspondent?: string;
  payer?: {
    type: string;
    accountDetails: {
      phoneNumber: string;
    };
  };
  created?: string;
  failureReason?: {
    failureCode: string;
    failureMessage: string;
  };
}

interface PawaPayPayoutRequest {
  payoutId: string;
  amount: string;
  currency: string;
  country: string;
  correspondent: string;
  recipient: {
    type: "MSISDN";
    address: {
      value: string;
    };
  };
  statementDescription?: string;
  clientReferenceId?: string;
  callbackUrl?: string;
}

interface PawaPayPayoutResponse {
  payoutId: string;
  status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED";
  created?: string;
  failureReason?: {
    failureCode: string;
    failureMessage: string;
  };
}

const pawaPayHeaders = () => ({
  Authorization: `Bearer ${PAWAPAY_API_KEY}`,
  "Content-Type": "application/json",
});

async function initiatePawaPayDeposit(
  params: PawaPayDepositRequest
): Promise<PawaPayDepositResponse> {
  const response = await axios.post<PawaPayDepositResponse>(
    `${PAWAPAY_BASE_URL}/v2/deposits`,
    params,
    { headers: pawaPayHeaders(), timeout: 30_000 }
  );
  return response.data;
}

async function fetchPawaPayDepositStatus(
  depositId: string
): Promise<PawaPayDepositStatusResponse | null> {
  try {
    const response = await axios.get<PawaPayDepositStatusResponse[]>(
      `${PAWAPAY_BASE_URL}/v2/deposits?depositId=${encodeURIComponent(depositId)}`,
      { headers: pawaPayHeaders(), timeout: 15_000 }
    );
    const results = response.data;
    return Array.isArray(results) && results.length > 0 ? results[0] : null;
  } catch {
    return null;
  }
}

async function initiatePawaPayPayout(
  params: PawaPayPayoutRequest
): Promise<PawaPayPayoutResponse> {
  const response = await axios.post<PawaPayPayoutResponse>(
    `${PAWAPAY_BASE_URL}/v1/payouts`,
    params,
    { headers: pawaPayHeaders(), timeout: 30_000 }
  );
  return response.data;
}

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10mb" }));
app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));

// CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Digest"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  log("INFO", `${req.method} ${req.path}`);
  next();
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    pawapay: PAWAPAY_API_KEY ? "configured" : "missing",
    timestamp: new Date().toISOString(),
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/users
 * Idempotent user creation — returns existing user if phone already registered.
 * Frontend calls this on first launch to obtain a stable backend userId.
 */
app.post("/api/users", (req: Request, res: Response) => {
  try {
    const { phoneNumber, country, province, city, town, fullAddress } = req.body as {
      phoneNumber?: string;
      country?: string;
      province?: string;
      city?: string;
      town?: string;
      fullAddress?: string;
    };

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: "Missing phoneNumber" });
    }

    const user = getOrCreateUser(phoneNumber, { country, province, city, town, fullAddress });
    getOrCreateWallet(user.id);

    return res.status(200).json({
      success: true,
      data: {
        userId: user.id,
        phoneNumber: user.phoneNumber,
        country: user.country,
        isNew: false, // always idempotent from the caller's perspective
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

/**
 * GET /api/users/:userId
 * Return a user record by ID.
 */
app.get("/api/users/:userId", (req: Request, res: Response) => {
  const { userId } = req.params as { userId: string };
  const user = getUserById(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  return res.json({ success: true, data: user });
});

// ─── Payments — PawaPay Deposit ─────────────────────────────────────────────────────

/**
 * POST /api/payments/pawapay
 * Initiate a mobile money deposit via the real PawaPay API.
 */
app.post("/api/payments/pawapay", async (req: Request, res: Response) => {
  const { amount, phoneNumber, userId: bodyUserId, country: bodyCountry } = req.body as {
    amount?: number;
    phoneNumber?: string;
    userId?: string;
    country?: string;
  };

  // Determine country: from body, or infer from phone prefix, defaulting to ZMB
  const countryCode = bodyCountry ?? (phoneNumber?.replace(/^\+/, "").startsWith("255") ? "TZA" : "ZMB");

  log("PAYMENT", "Deposit request received", {
    userId: bodyUserId,
    phoneNumber: phoneNumber ? `${phoneNumber.substring(0, 4)}****` : undefined,
    amount,
    country: countryCode,
  });

  try {
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
        errorCode: "INVALID_AMOUNT",
      });
    }

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Missing phoneNumber",
        errorCode: "MISSING_PHONE",
      });
    }

    // Resolve or create user
    const user = bodyUserId
      ? (getUserById(bodyUserId) ?? getOrCreateUser(phoneNumber, { country: countryCode }))
      : getOrCreateUser(phoneNumber, { country: countryCode });
    getOrCreateWallet(user.id);

    // Detect network and normalise phone (country-aware)
    const e164Phone = toE164(countryCode, phoneNumber);
    const correspondent = detectNetwork(countryCode, phoneNumber);
    const currency = currencyForCountry(countryCode);

    // Generate a stable UUIDv4 deposit ID
    const depositId = uuidv4();

    log("PAYMENT", "Calling PawaPay deposit API", {
      depositId,
      correspondent,
      amount,
      currency,
      country: countryCode,
      e164Phone: `${e164Phone.substring(0, 6)}****`,
    });

    // Call PawaPay
    const pawaPayResponse = await initiatePawaPayDeposit({
      depositId,
      payer: {
        type: "MMO",
        accountDetails: {
          phoneNumber: e164Phone,
          provider: correspondent,
        },
      },
      amount: String(Number(amount).toFixed(2)),
      currency,
      clientReferenceId: user.id,
      customerMessage: "LTC Fast Track payment",
    });

    log("PAYMENT", "PawaPay deposit response", {
      depositId,
      status: pawaPayResponse.status,
      failureCode: pawaPayResponse.failureReason?.failureCode,
    });

    if (pawaPayResponse.status === "REJECTED") {
      return res.status(422).json({
        success: false,
        message: pawaPayResponse.failureReason?.failureMessage ?? "Payment rejected by provider",
        errorCode: pawaPayResponse.failureReason?.failureCode ?? "REJECTED",
      });
    }

    // Persist transaction as pending
    const transaction = createTransaction(
      user.id,
      depositId,
      Number(amount),
      "deposit",
      correspondent,
      e164Phone
    );

    return res.status(201).json({
      success: true,
      data: {
        depositId,
        status: pawaPayResponse.status,
        amount: Number(amount),
        phoneNumber: e164Phone,
        provider: correspondent,
        userId: user.id,
        transactionId: transaction.id,
        createdAt: pawaPayResponse.created ?? new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
  let msg = "Internal server error";
  let details: any = null;

  if (axios.isAxiosError(error)) {
    msg = error.message;
    details = error.response?.data;
  } else if (error instanceof Error) {
    msg = error.message;
  }

  log("ERROR", "Deposit error", { msg, details });

  return res.status(500).json({
    success: false,
    message: msg,
    errorCode: "PAWAPAY_ERROR",
    details, // 👈 THIS IS THE IMPORTANT PART
  });
 }
});

// ─── Payments — Deposit Status ────────────────────────────────────────────────

/**
 * GET /api/payments/:depositId/status
 * Returns the status of a deposit from the local DB.
 * If ?verify=true is passed, also fetches the latest status from PawaPay and syncs it.
 */
app.get("/api/payments/:depositId/status", async (req: Request, res: Response) => {
  try {
    const depositId = req.params["depositId"] as string;
    const verify = req.query["verify"] === "true";

    const transaction = getTransactionByDepositId(depositId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
        errorCode: "NOT_FOUND",
      });
    }

    let liveStatus: string | undefined;

    if (verify) {
      log("PAYMENT", "Verifying deposit status with PawaPay", { depositId });
      const liveData = await fetchPawaPayDepositStatus(depositId);
      if (liveData) {
        liveStatus = liveData.status;
        // Sync DB if PawaPay reports a terminal state
        if (liveData.status === "COMPLETED" && transaction.status !== "completed") {
          updateTransactionStatus(depositId, "completed");
          updateWalletBalance(transaction.userId, transaction.amount);
          log("PAYMENT", "Deposit synced to COMPLETED via verify", { depositId });
        } else if (liveData.status === "FAILED" && transaction.status !== "failed") {
          updateTransactionStatus(depositId, "failed");
          log("PAYMENT", "Deposit synced to FAILED via verify", { depositId });
        }
      }
    }

    // Re-fetch after potential sync
    const updated = getTransactionByDepositId(depositId) ?? transaction;

    return res.json({
      success: true,
      data: {
        depositId: updated.depositId,
        transactionId: updated.id,
        userId: updated.userId,
        amount: updated.amount,
        status: updated.status,
        provider: updated.provider,
        phoneNumber: updated.phoneNumber,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
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

/**
 * POST /api/payments/pawapay/callback
 * Receives async deposit status updates from PawaPay.
 */
app.post("/api/payments/pawapay/callback", (req: Request, res: Response) => {
  try {
    const payload =
      Buffer.isBuffer(req.body)
        ? (JSON.parse(req.body.toString()) as Record<string, unknown>)
        : (req.body as Record<string, unknown>);

    // ✅ Support ALL PawaPay IDs
    const depositId = payload["depositId"];
    const payoutId = payload["payoutId"];
    const refundId = payload["refundId"]; // future-proof

    const referenceId = depositId || payoutId || refundId;
    const status = payload["status"];
    const amount = payload["amount"];

    log("CALLBACK", "PawaPay callback received", {
      referenceId,
      type: depositId ? "deposit" : payoutId ? "payout" : "refund",
      status,
      amount,
    });

    // ✅ Validate
    if (!referenceId || !status) {
      log("CALLBACK", "Missing referenceId or status", { payload });
      return res.status(400).json({
        success: false,
        message: "Missing referenceId or status",
      });
    }

    // ✅ Fetch transaction
    const transaction = getTransactionByDepositId(referenceId);

    if (!transaction) {
      log("CALLBACK", "Unknown transaction — acknowledged", { referenceId });
      return res.json({
        success: true,
        data: { received: true, referenceId },
        timestamp: new Date().toISOString(),
      });
    }

    // ✅ Prevent double-processing (VERY IMPORTANT)
    if (transaction.status === "completed" || transaction.status === "failed") {
      return res.json({
        success: true,
        data: { received: true, referenceId },
        timestamp: new Date().toISOString(),
      });
    }

    // ✅ HANDLE COMPLETED
    if (status === "COMPLETED") {
      if (transaction.type === "deposit") {
        // ➕ Credit wallet
        updateWalletBalance(
          transaction.userId,
          Number(amount ?? transaction.amount)
        );

        log("CALLBACK", "Deposit COMPLETED — wallet credited", {
          referenceId,
          userId: transaction.userId,
          amount: Number(amount ?? transaction.amount),
        });
      }

      if (transaction.type === "withdrawal") {
        // ❌ Do nothing (already deducted earlier)
        log("CALLBACK", "Withdrawal COMPLETED", {
          referenceId,
          userId: transaction.userId,
        });
      }

      updateTransactionStatus(referenceId, "completed");
    }

    // ✅ HANDLE FAILED
    else if (status === "FAILED") {
      if (transaction.type === "withdrawal") {
        // 🔥 Refund wallet
        updateWalletBalance(
          transaction.userId,
          Math.abs(transaction.amount)
        );

        log("CALLBACK", "Withdrawal FAILED — wallet refunded", {
          referenceId,
          userId: transaction.userId,
          amount: Math.abs(transaction.amount),
        });
      }

      updateTransactionStatus(referenceId, "failed");

      log("CALLBACK", "Transaction FAILED", {
        referenceId,
        userId: transaction.userId,
      });
    }

    // ✅ OTHER STATES
    else {
      log("CALLBACK", `Intermediate status: ${status}`, { referenceId });
    }

    return res.json({
      success: true,
      data: { received: true, referenceId },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Callback processing error";
    log("ERROR", "Callback error", { error: msg });
    return res.status(500).json({ success: false, message: msg });
  }
});

// ─── Wallet ───────────────────────────────────────────────────────────────────

app.get("/api/wallet/:userId", (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;
    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const wallet = getOrCreateWallet(userId);
    return res.json({
      success: true,
      data: {
        walletId: wallet.id,
        userId: wallet.userId,
        balance: wallet.balance,
        phoneNumber: user.phoneNumber,
        updatedAt: wallet.updatedAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

// ─── Transactions ─────────────────────────────────────────────────────────────

app.get("/api/transactions/:userId", (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;
    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const transactions = getTransactionsByUserId(userId);
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const completedAmount = transactions
      .filter((t) => t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    return res.json({
      success: true,
      data: {
        userId,
        phoneNumber: user.phoneNumber,
        transactions,
        total: transactions.length,
        totalAmount,
        completedAmount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

// ─── Linked Accounts ──────────────────────────────────────────────────────────

app.post("/api/linked-accounts/:userId/link", (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;
    const { phoneNumber, provider, withdrawalPin } = req.body as {
      phoneNumber?: string;
      provider?: string;
      withdrawalPin?: string;
    };

    if (!phoneNumber || phoneNumber.length < 10) {
      return res.status(400).json({ success: false, message: "Invalid phone number", errorCode: "INVALID_PHONE" });
    }
    if (!provider) {
      return res.status(400).json({ success: false, message: "Provider required", errorCode: "MISSING_PROVIDER" });
    }
    if (!withdrawalPin || withdrawalPin.length < 4) {
      return res.status(400).json({ success: false, message: "Invalid PIN", errorCode: "INVALID_PIN" });
    }

    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const linkedAccount = linkAccount(userId, phoneNumber, provider, withdrawalPin);
    return res.status(201).json({
      success: true,
      data: {
        id: linkedAccount.id,
        phoneNumber: linkedAccount.phoneNumber,
        provider: linkedAccount.provider,
        isActive: linkedAccount.isActive === 1,
        createdAt: linkedAccount.createdAt,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

app.get("/api/linked-accounts/:userId", (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;
    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const linkedAccount = getLinkedAccount(userId);
    return res.json({
      success: true,
      data: linkedAccount
        ? {
            id: linkedAccount.id,
            phoneNumber: linkedAccount.phoneNumber,
            provider: linkedAccount.provider,
            isActive: linkedAccount.isActive === 1,
            createdAt: linkedAccount.createdAt,
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

app.post("/api/linked-accounts/:userId/unlink", (req: Request, res: Response) => {
  try {
    const userId = req.params["userId"] as string;
    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    unlinkAccount(userId);
    return res.json({
      success: true,
      data: { unlinked: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

// ─── Withdrawals — PawaPay Payout ─────────────────────────────────────────────

/**
 * POST /api/withdrawals
 * Initiates a real PawaPay payout. Wallet is only deducted after PawaPay accepts the payout.
 * On rejection or error, the wallet is NOT touched.
 */
app.post("/api/withdrawals", async (req: Request, res: Response) => {
  const { userId, amount, withdrawalPin } = req.body as {
    userId?: string;
    amount?: number;
    withdrawalPin?: string;
  };

  log("WITHDRAWAL", "Withdrawal request received", {
    userId,
    amount,
  });

  try {
    if (!userId || !amount || !withdrawalPin) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
    }

    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const wallet = getWalletByUserId(userId);
    if (!wallet || wallet.balance < Number(amount)) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    const linkedAccount = getLinkedAccount(userId);
    if (!linkedAccount) {
      return res.status(400).json({ success: false, message: "No linked account found" });
    }
    if (linkedAccount.withdrawalPin !== withdrawalPin) {
      return res.status(400).json({ success: false, message: "Invalid withdrawal PIN" });
    }

    const payoutId = uuidv4();
    // Use country from the user record (set at registration) for correct network detection
    const userCountry = user.country ?? "ZMB";
    const e164Phone = toE164(userCountry, linkedAccount.phoneNumber);
    const correspondent = detectNetwork(userCountry, linkedAccount.phoneNumber);
    const currency = currencyForCountry(userCountry);

    log("WITHDRAWAL", "Calling PawaPay payout API", {
      payoutId,
      correspondent,
      amount,
      currency,
      country: userCountry,
      phone: `${e164Phone.substring(0, 6)}****`,
    });

    // Call PawaPay — wallet NOT yet deducted
    const pawaPayResponse = await initiatePawaPayPayout({
      payoutId,
      amount: String(Number(amount).toFixed(2)),
      currency,
      country: userCountry,
      correspondent,
      recipient: {
        type: "MSISDN",
        address: { value: e164Phone },
      },
      statementDescription: "LTC Fast Track withdrawal",
      clientReferenceId: userId,
    });

    log("WITHDRAWAL", "PawaPay payout response", {
      payoutId,
      status: pawaPayResponse.status,
      failureCode: pawaPayResponse.failureReason?.failureCode,
    });

    if (pawaPayResponse.status === "REJECTED") {
      log("WITHDRAWAL", "Payout REJECTED — wallet NOT deducted", {
        payoutId,
        reason: pawaPayResponse.failureReason?.failureCode,
      });
      return res.status(422).json({
        success: false,
        message: pawaPayResponse.failureReason?.failureMessage ?? "Withdrawal rejected by provider",
        errorCode: pawaPayResponse.failureReason?.failureCode ?? "REJECTED",
      });
    }

    // PawaPay accepted the payout — now deduct wallet and record transaction
    const txn = createTransaction(
      userId,
      payoutId,
      -Number(amount),
      "withdrawal",
      correspondent,
      e164Phone
    );

    // Deduct wallet only after PawaPay acceptance
    updateWalletBalance(userId, -Number(amount));
    updateTransactionStatus(payoutId, "processing");

    log("WITHDRAWAL", "Payout ACCEPTED — wallet deducted", {
      payoutId,
      userId,
      amount,
      newBalance: (wallet.balance - Number(amount)).toFixed(2),
    });

    return res.json({
      success: true,
      data: {
        withdrawalId: payoutId,
        transactionId: txn.id,
        status: "PROCESSING",
        amount: Number(amount),
        phoneNumber: e164Phone,
        provider: correspondent,
        createdAt: pawaPayResponse.created ?? new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    log("ERROR", "Withdrawal error — wallet NOT deducted", { error: msg, userId });
    return res.status(500).json({ success: false, message: msg, errorCode: "INTERNAL_ERROR" });
  }
});

// ─── Pickups ──────────────────────────────────────────────────────────────────

const VALID_PICKUP_STATUSES: PickupStatus[] = [
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "cancelled",
];

/**
 * GET /api/pickups
 * Returns all pickups. Supports optional ?userId= query filter.
 */
app.get("/api/pickups", (req: Request, res: Response) => {
  try {
    const rawUserId = req.query["userId"];
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    let pickups: Pickup[];
    if (userId) {
      pickups = db
        .prepare("SELECT * FROM pickups WHERE userId = ? ORDER BY createdAt DESC")
        .all(userId) as Pickup[];
    } else {
      pickups = db
        .prepare("SELECT * FROM pickups ORDER BY createdAt DESC")
        .all() as Pickup[];
    }
    return res.json(pickups);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

/**
 * POST /api/pickups
 * Create a new pickup request.
 */
app.post("/api/pickups", (req: Request, res: Response) => {
  try {
    const {
      userId,
      userName,
      userPhone,
      location,
      latitude,
      longitude,
      wasteType,
      notes,
      zoneId,
      scheduledDate,
      scheduledTime,
    } = req.body as {
      userId?: string;
      userName?: string;
      userPhone?: string;
      location?: string;
      latitude?: number;
      longitude?: number;
      wasteType?: string;
      notes?: string;
      zoneId?: string;
      scheduledDate?: string;
      scheduledTime?: string;
    };

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const id = `pickup_${uuidv4().replace(/-/g, "").substring(0, 16)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO pickups
         (id, userId, userName, userPhone, location, latitude, longitude,
          wasteType, notes, status, zoneId, scheduledDate, scheduledTime,
          createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
    ).run(
      id,
      userId,
      userName ?? null,
      userPhone ?? null,
      location ?? null,
      latitude ?? null,
      longitude ?? null,
      wasteType ?? "residential",
      notes ?? null,
      zoneId ?? null,
      scheduledDate ?? null,
      scheduledTime ?? null,
      now,
      now
    );

    const pickup = db.prepare("SELECT * FROM pickups WHERE id = ?").get(id) as Pickup;
    return res.status(201).json(pickup);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

/**
 * GET /api/pickups/:id
 * Fetch a single pickup by ID.
 */
app.get("/api/pickups/:id", (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const pickup = db.prepare("SELECT * FROM pickups WHERE id = ?").get(id) as Pickup | undefined;
    if (!pickup) {
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }
    return res.json(pickup);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

/**
 * PATCH /api/pickups/:id
 * Update pickup status and/or assignedTo field.
 * Allowed fields: status, assignedTo, notes, completedAt
 */
app.patch("/api/pickups/:id", (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string;
    const { status, assignedTo, notes, completedAt } = req.body as {
      status?: string;
      assignedTo?: string;
      notes?: string;
      completedAt?: string;
    };

    const pickup = db.prepare("SELECT * FROM pickups WHERE id = ?").get(id) as Pickup | undefined;
    if (!pickup) {
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }

    if (status !== undefined && !VALID_PICKUP_STATUSES.includes(status as PickupStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_PICKUP_STATUSES.join(", ")}`,
      });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (status !== undefined) { updates.push("status = ?"); values.push(status); }
    if (assignedTo !== undefined) { updates.push("assignedTo = ?"); values.push(assignedTo); }
    if (notes !== undefined) { updates.push("notes = ?"); values.push(notes); }
    if (completedAt !== undefined) { updates.push("completedAt = ?"); values.push(completedAt); }

    // Auto-set completedAt when status transitions to completed
    if (status === "completed" && completedAt === undefined) {
      updates.push("completedAt = ?");
      values.push(new Date().toISOString());
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    updates.push("updatedAt = strftime('%Y-%m-%dT%H:%M:%SZ','now')");
    values.push(id);

    db.prepare(`UPDATE pickups SET ${updates.join(", ")} WHERE id = ?`).run(...values);

    const updated = db.prepare("SELECT * FROM pickups WHERE id = ?").get(id) as Pickup;
    return res.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return res.status(500).json({ success: false, message: msg });
  }
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log("ERROR", "Unhandled error", { error: err.message });
  if (!res.headersSent) {
    res.status(500).json({ success: false, message: err.message ?? "Internal server error" });
  }
});

// ─── Server Startup ───────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  log("INFO", "Server started", {
    port: PORT,
    env: NODE_ENV,
    db: DB_PATH,
    pawapay: PAWAPAY_BASE_URL,
    callbackBase: CALLBACK_BASE_URL,
  });
});

const shutdown = () => {
  log("INFO", "Server shutting down gracefully");
  db.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
