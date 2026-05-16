/**
 * LTC Fast Track — Production Backend Server
 * Stack: Express + pg (PostgreSQL) + axios
 * Uses ltc_* prefixed tables to avoid conflicts with existing schema
 */

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const NODE_ENV = process.env.NODE_ENV ?? "development";
const PAWAPAY_API_KEY = process.env.PAWAPAY_API_KEY ?? "";

if (!PAWAPAY_API_KEY) { console.error("[FATAL] PAWAPAY_API_KEY is not set."); process.exit(1); }

const PAWAPAY_BASE_URL = NODE_ENV === "production" ? "https://api.pawapay.io" : "https://api.sandbox.pawapay.io";
const CALLBACK_BASE_URL = process.env.CALLBACK_BASE_URL ?? `http://localhost:${PORT}`;

type LogLevel = "INFO" | "WARN" | "ERROR" | "PAYMENT" | "CALLBACK" | "WITHDRAWAL";
function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = { ts: new Date().toISOString(), level, message, ...(meta ? { meta } : {}) };
  level === "ERROR" ? console.error(JSON.stringify(entry)) : console.log(JSON.stringify(entry));
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") || NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initDB(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ltc_users (
        id            TEXT PRIMARY KEY,
        "phoneNumber" TEXT NOT NULL UNIQUE,
        country       TEXT NOT NULL DEFAULT 'ZMB',
        province      TEXT,
        city          TEXT,
        town          TEXT,
        "fullAddress" TEXT,
        "createdAt"   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      );
      CREATE TABLE IF NOT EXISTS ltc_wallets (
        id          TEXT PRIMARY KEY,
        "userId"    TEXT NOT NULL UNIQUE REFERENCES ltc_users(id) ON DELETE CASCADE,
        balance     NUMERIC NOT NULL DEFAULT 0,
        "updatedAt" TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      );
      CREATE TABLE IF NOT EXISTS ltc_transactions (
        id            TEXT PRIMARY KEY,
        "userId"      TEXT NOT NULL REFERENCES ltc_users(id) ON DELETE CASCADE,
        "depositId"   TEXT NOT NULL UNIQUE,
        amount        NUMERIC NOT NULL,
        type          TEXT NOT NULL DEFAULT 'deposit',
        status        TEXT NOT NULL DEFAULT 'pending',
        provider      TEXT,
        "phoneNumber" TEXT,
        "createdAt"   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        "updatedAt"   TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      );
      CREATE TABLE IF NOT EXISTS ltc_linked_accounts (
        id              TEXT PRIMARY KEY,
        "userId"        TEXT NOT NULL UNIQUE REFERENCES ltc_users(id) ON DELETE CASCADE,
        "phoneNumber"   TEXT NOT NULL,
        provider        TEXT NOT NULL,
        "withdrawalPin" TEXT NOT NULL,
        "isActive"      INTEGER NOT NULL DEFAULT 1,
        "createdAt"     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        "updatedAt"     TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      );
      CREATE TABLE IF NOT EXISTS ltc_pickups (
        id              TEXT PRIMARY KEY,
        "userId"        TEXT NOT NULL REFERENCES ltc_users(id) ON DELETE CASCADE,
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
      CREATE INDEX IF NOT EXISTS idx_ltc_txn_uid    ON ltc_transactions("userId");
      CREATE INDEX IF NOT EXISTS idx_ltc_txn_depid  ON ltc_transactions("depositId");
      CREATE INDEX IF NOT EXISTS idx_ltc_txn_status ON ltc_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_ltc_wal_uid    ON ltc_wallets("userId");
      CREATE INDEX IF NOT EXISTS idx_ltc_lnk_uid    ON ltc_linked_accounts("userId");
      CREATE INDEX IF NOT EXISTS idx_ltc_pck_uid    ON ltc_pickups("userId");
      CREATE INDEX IF NOT EXISTS idx_ltc_pck_status ON ltc_pickups(status);
    `);
    log("INFO", "Database initialized successfully");
  } finally { client.release(); }
}

interface User { id: string; phoneNumber: string; country: string; province?: string; city?: string; town?: string; fullAddress?: string; createdAt: string; }
interface Wallet { id: string; userId: string; balance: string; updatedAt: string; }
interface Transaction { id: string; userId: string; depositId: string; amount: string; type: string; status: string; provider: string | null; phoneNumber: string | null; createdAt: string; updatedAt: string; }
interface LinkedAccount { id: string; userId: string; phoneNumber: string; provider: string; withdrawalPin: string; isActive: number; createdAt: string; updatedAt: string; }
type PickupStatus = "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
interface Pickup { id: string; userId: string; userName: string | null; userPhone: string | null; location: string | null; latitude: number | null; longitude: number | null; wasteType: string; notes: string | null; status: PickupStatus; zoneId: string | null; scheduledDate: string | null; scheduledTime: string | null; assignedTo: string | null; completedAt: string | null; createdAt: string; updatedAt: string; }

function now(): string { return new Date().toISOString().replace(/\.\d{3}Z$/, "Z"); }

async function getOrCreateUser(phoneNumber: string, opts?: { country?: string; province?: string; city?: string; town?: string; fullAddress?: string }): Promise<User> {
  const existing = await pool.query<User>(`SELECT * FROM ltc_users WHERE "phoneNumber" = $1`, [phoneNumber]);
  if (existing.rows[0]) return existing.rows[0];
  const userId = `user_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  await pool.query(`INSERT INTO ltc_users (id, "phoneNumber", country, province, city, town, "fullAddress", "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [userId, phoneNumber, opts?.country ?? "ZMB", opts?.province ?? null, opts?.city ?? null, opts?.town ?? null, opts?.fullAddress ?? null, now()]);
  const result = await pool.query<User>(`SELECT * FROM ltc_users WHERE id = $1`, [userId]);
  return result.rows[0];
}

async function getUserById(userId: string): Promise<User | undefined> {
  const result = await pool.query<User>(`SELECT * FROM ltc_users WHERE id = $1`, [userId]);
  return result.rows[0];
}

async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const existing = await pool.query<Wallet>(`SELECT * FROM ltc_wallets WHERE "userId" = $1`, [userId]);
  if (existing.rows[0]) return existing.rows[0];
  const walletId = `wallet_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  await pool.query(`INSERT INTO ltc_wallets (id, "userId", balance, "updatedAt") VALUES ($1,$2,0,$3)`, [walletId, userId, now()]);
  const result = await pool.query<Wallet>(`SELECT * FROM ltc_wallets WHERE id = $1`, [walletId]);
  return result.rows[0];
}

async function getWalletByUserId(userId: string): Promise<Wallet | undefined> {
  const result = await pool.query<Wallet>(`SELECT * FROM ltc_wallets WHERE "userId" = $1`, [userId]);
  return result.rows[0];
}

async function updateWalletBalance(userId: string, delta: number): Promise<void> {
  await pool.query(`UPDATE ltc_wallets SET balance = balance + $1, "updatedAt" = $2 WHERE "userId" = $3`, [delta, now(), userId]);
}

async function createTransaction(userId: string, depositId: string, amount: number, type: "deposit" | "withdrawal", provider?: string, phoneNumber?: string): Promise<Transaction> {
  const txnId = `txn_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  const n = now();
  await pool.query(`INSERT INTO ltc_transactions (id, "userId", "depositId", amount, type, status, provider, "phoneNumber", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9)`,
    [txnId, userId, depositId, amount, type, provider ?? null, phoneNumber ?? null, n, n]);
  const result = await pool.query<Transaction>(`SELECT * FROM ltc_transactions WHERE id = $1`, [txnId]);
  return result.rows[0];
}

async function getTransactionByDepositId(depositId: string): Promise<Transaction | undefined> {
  const result = await pool.query<Transaction>(`SELECT * FROM ltc_transactions WHERE "depositId" = $1`, [depositId]);
  return result.rows[0];
}

async function updateTransactionStatus(depositId: string, status: string): Promise<void> {
  await pool.query(`UPDATE ltc_transactions SET status = $1, "updatedAt" = $2 WHERE "depositId" = $3`, [status, now(), depositId]);
}

async function getTransactionsByUserId(userId: string): Promise<Transaction[]> {
  const result = await pool.query<Transaction>(`SELECT * FROM ltc_transactions WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId]);
  return result.rows;
}

async function getLinkedAccount(userId: string): Promise<LinkedAccount | undefined> {
  const result = await pool.query<LinkedAccount>(`SELECT * FROM ltc_linked_accounts WHERE "userId" = $1 AND "isActive" = 1`, [userId]);
  return result.rows[0];
}

async function linkAccount(userId: string, phoneNumber: string, provider: string, withdrawalPin: string): Promise<LinkedAccount> {
  const accountId = `linked_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
  const n = now();
  await pool.query(
    `INSERT INTO ltc_linked_accounts (id, "userId", "phoneNumber", provider, "withdrawalPin", "isActive", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,1,$6,$7)
     ON CONFLICT ("userId") DO UPDATE SET "phoneNumber"=EXCLUDED."phoneNumber", provider=EXCLUDED.provider, "withdrawalPin"=EXCLUDED."withdrawalPin", "isActive"=1, "updatedAt"=EXCLUDED."updatedAt"`,
    [accountId, userId, phoneNumber, provider, withdrawalPin, n, n]);
  const result = await pool.query<LinkedAccount>(`SELECT * FROM ltc_linked_accounts WHERE "userId" = $1 AND "isActive" = 1`, [userId]);
  return result.rows[0];
}

async function unlinkAccount(userId: string): Promise<void> {
  await pool.query(`UPDATE ltc_linked_accounts SET "isActive" = 0, "updatedAt" = $1 WHERE "userId" = $2`, [now(), userId]);
}

function detectZambiaNetwork(rawPhone: string): string {
  let phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("260")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;
  const p3 = phone.substring(0, 3);
  if (p3 === "096" || p3 === "076") return "MTN_MOMO_ZMB";
  if (p3 === "097" || p3 === "077") return "AIRTEL_OAPI_ZMB";
  if (p3 === "095" || p3 === "075") return "ZAMTEL_ZMB";
  return "MTN_MOMO_ZMB";
}

function detectTanzaniaNetwork(rawPhone: string): string {
  let phone = rawPhone.replace(/\s+/g, "").replace(/^\+/, "");
  if (phone.startsWith("255")) phone = "0" + phone.slice(3);
  if (!phone.startsWith("0")) phone = "0" + phone;
  const p3 = phone.substring(0, 3);
  if (["074","075","076"].includes(p3)) return "VODACOM_TZ";
  if (p3 === "078") return "AIRTEL_TZ";
  if (p3 === "071" || p3 === "065") return "TIGO_TZ";
  return "VODACOM_TZ";
}

function detectNetwork(c: string, p: string): string { return c === "TZA" ? detectTanzaniaNetwork(p) : detectZambiaNetwork(p); }
function toE164(c: string, p: string): string {
  const phone = p.replace(/\s+/g, "").replace(/^\+/, "");
  if (c === "TZA") { if (phone.startsWith("255")) return phone; return phone.startsWith("0") ? "255" + phone.slice(1) : "255" + phone; }
  if (phone.startsWith("260")) return phone; return phone.startsWith("0") ? "260" + phone.slice(1) : "260" + phone;
}
function currencyForCountry(c: string): string { return c === "TZA" ? "TZS" : "ZMW"; }

interface PawaPayDepositRequest { depositId: string; payer: { type: "MMO"; accountDetails: { phoneNumber: string; provider: string } }; amount: string; currency: string; statementDescription?: string; clientReferenceId?: string; customerMessage?: string; callbackUrl?: string; }
interface PawaPayDepositResponse { depositId: string; status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED"; created?: string; failureReason?: { failureCode: string; failureMessage: string }; }
interface PawaPayDepositStatusResponse { depositId: string; status: "ACCEPTED" | "COMPLETED" | "FAILED" | "DUPLICATE_IGNORED"; amount?: string; currency?: string; correspondent?: string; payer?: { type: string; accountDetails: { phoneNumber: string } }; created?: string; failureReason?: { failureCode: string; failureMessage: string }; }
interface PawaPayPayoutRequest { payoutId: string; amount: string; currency: string; country: string; correspondent: string; recipient: { type: "MSISDN"; address: { value: string } }; statementDescription?: string; clientReferenceId?: string; callbackUrl?: string; }
interface PawaPayPayoutResponse { payoutId: string; status: "ACCEPTED" | "REJECTED" | "DUPLICATE_IGNORED"; created?: string; failureReason?: { failureCode: string; failureMessage: string }; }

const pawaPayHeaders = () => ({ Authorization: `Bearer ${process.env.PAWAPAY_PAYOUT_TOKEN || process.env.PAWAPAY_TOKEN || process.env.PAWAPAY_API_KEY}`, "Content-Type": "application/json" });

async function initiatePawaPayDeposit(params: PawaPayDepositRequest): Promise<PawaPayDepositResponse> {
  const r = await axios.post<PawaPayDepositResponse>(`${PAWAPAY_BASE_URL}/v2/deposits`, params, { headers: pawaPayHeaders(), timeout: 30_000 });
  return r.data;
}
async function fetchPawaPayDepositStatus(depositId: string): Promise<PawaPayDepositStatusResponse | null> {
  try { const r = await axios.get<PawaPayDepositStatusResponse>(`${PAWAPAY_BASE_URL}/v1/deposits/${depositId}`, { headers: pawaPayHeaders(), timeout: 15000 }); return r.data; }
  catch (e: any) { console.error("PawaPay fetch error:", e.response?.data || e.message); return null; }
}
async function initiatePawaPayPayout(params: PawaPayPayoutRequest): Promise<PawaPayPayoutResponse> {
  const r = await axios.post<PawaPayPayoutResponse>(`${PAWAPAY_BASE_URL}/v1/payouts`, params, { headers: pawaPayHeaders(), timeout: 30_000 });
  return r.data;
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.raw({ type: "application/octet-stream", limit: "10mb" }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Digest");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});
app.use((req: Request, _res: Response, next: NextFunction) => { log("INFO", `${req.method} ${req.path}`); next(); });

app.get("/api/health", (_req, res) => res.json({ ok: true, env: NODE_ENV, pawapay: PAWAPAY_API_KEY ? "configured" : "missing", timestamp: new Date().toISOString() }));

app.post("/api/users", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, country, province, city, town, fullAddress } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, message: "Missing phoneNumber" });
    const user = await getOrCreateUser(phoneNumber, { country, province, city, town, fullAddress });
    await getOrCreateWallet(user.id);
    return res.status(200).json({ success: true, data: { userId: user.id, phoneNumber: user.phoneNumber, country: user.country, isNew: false } });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.get("/api/users/:userId", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, data: user });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/payments/pawapay", async (req: Request, res: Response) => {
  const { amount, phoneNumber, userId: bodyUserId, country: bodyCountry } = req.body;
  const countryCode = bodyCountry ?? (phoneNumber?.replace(/^\+/, "").startsWith("255") ? "TZA" : "ZMB");
  try {
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "Invalid amount", errorCode: "INVALID_AMOUNT" });
    if (!phoneNumber) return res.status(400).json({ success: false, message: "Missing phoneNumber", errorCode: "MISSING_PHONE" });
    const user = bodyUserId ? ((await getUserById(bodyUserId)) ?? (await getOrCreateUser(phoneNumber, { country: countryCode }))) : await getOrCreateUser(phoneNumber, { country: countryCode });
    await getOrCreateWallet(user.id);
    const e164Phone = toE164(countryCode, phoneNumber);
    const correspondent = detectNetwork(countryCode, phoneNumber);
    const currency = currencyForCountry(countryCode);
    const depoitId = uuidv4();
    const depositId = `LTC-DEP-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const pawaPayResponse = await initiatePawaPayDeposit({ depositId, payer: { type: "MMO", accountDetails: { phoneNumber: e164Phone, provider: correspondent } }, amount: String(Number(amount).toFixed(2)), currency, clientReferenceId: user.id, customerMessage: "LTC Fast Track payment" });
    if (pawaPayResponse.status === "REJECTED") return res.status(422).json({ success: false, message: pawaPayResponse.failureReason?.failureMessage ?? "Payment rejected", errorCode: pawaPayResponse.failureReason?.failureCode ?? "REJECTED" });
    const transaction = await createTransaction(user.id, depositId, Number(amount), "deposit", correspondent, e164Phone);
    return res.status(201).json({ success: true, data: { depositId: displayDepositId, providerDepositId: depositId, status: pawaPayResponse.status, amount: Number(amount), phoneNumber: e164Phone, provider: correspondent, userId: user.id, transactionId: transaction.id, createdAt: pawaPayResponse.created ?? new Date().toISOString() }, timestamp: new Date().toISOString() });
  } catch (error: any) {
    const msg = axios.isAxiosError(error) ? error.message : (error instanceof Error ? error.message : "Internal server error");
    return res.status(500).json({ success: false, message: msg, errorCode: "PAWAPAY_ERROR", details: axios.isAxiosError(error) ? error.response?.data : null });
  }
});

app.get("/api/payments/:depositId/status", async (req: Request, res: Response) => {
  try {
    const depositId = req.params["depositId"];
    const verify = req.query["verify"] === "true";
    const transaction = await getTransactionByDepositId(depositId);
    if (!transaction) return res.status(404).json({ success: false, message: "Transaction not found" });
    let liveStatus: string | undefined;
    if (verify) {
      const liveData = await fetchPawaPayDepositStatus(depositId);
      if (liveData) {
        liveStatus = liveData.status;
        if (liveData.status === "COMPLETED" && transaction.status !== "completed") {
          await updateWalletBalance(transaction.userId, transaction.amount);
          await updateTransactionStatus(depositId, "completed");
        }
        else if (liveData.status === "FAILED") await updateTransactionStatus(depositId, "failed");
        else if (liveData.status === "ACCEPTED" && Date.now() - new Date(transaction.createdAt).getTime() > 60000) await updateTransactionStatus(depositId, "failed");
      } else if (Date.now() - new Date(transaction.createdAt).getTime() > 60000) await updateTransactionStatus(depositId, "failed");
    }
    const updated = (await getTransactionByDepositId(depositId)) ?? transaction;
    return res.json({ success: true, data: { depositId: updated.depositId, transactionId: updated.id, userId: updated.userId, amount: updated.amount, status: updated.status, provider: updated.provider, phoneNumber: updated.phoneNumber, createdAt: updated.createdAt, updatedAt: updated.updatedAt, ...(liveStatus ? { liveStatus } : {}) }, timestamp: new Date().toISOString() });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/payments/pawapay/callback", async (req: Request, res: Response) => {
  try {
    const payload = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body;
    const referenceId = (payload["depositId"] || payload["payoutId"] || payload["refundId"]) as string;
    const status = payload["status"]; const amount = payload["amount"];
    if (!referenceId || !status) return res.status(400).json({ success: false, message: "Missing referenceId or status" });
    const transaction = await getTransactionByDepositId(referenceId);
    if (!transaction) return res.json({ success: true, data: { received: true, referenceId } });
    if (transaction.status === "completed" || transaction.status === "failed") return res.json({ success: true, data: { received: true, referenceId } });
    if (status === "COMPLETED") { if (transaction.type === "deposit") await updateWalletBalance(transaction.userId, Number(amount ?? transaction.amount)); await updateTransactionStatus(referenceId, "completed"); }
    else if (status === "FAILED") { if (transaction.type === "withdrawal") await updateWalletBalance(transaction.userId, Math.abs(transaction.amount)); await updateTransactionStatus(referenceId, "failed"); }
    return res.json({ success: true, data: { received: true, referenceId } });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Callback error" }); }
});

app.get("/api/wallet/:userId", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const wallet = await getOrCreateWallet(req.params["userId"]);
    return res.json({ success: true, data: { walletId: wallet.id, userId: wallet.userId, balance: Number(wallet.balance), totalBalance: Number(wallet.balance), phoneNumber: user.phoneNumber, updatedAt: wallet.updatedAt } });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.get("/api/transactions/:userId", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const transactions = await getTransactionsByUserId(req.params["userId"]);
    return res.json({ success: true, data: { userId: req.params["userId"], phoneNumber: user.phoneNumber, transactions, total: transactions.length, totalAmount: transactions.reduce((s, t) => s + Number(t.amount), 0), completedAmount: transactions.filter(t => t.status === "completed").reduce((s, t) => s + Number(t.amount), 0) } });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/linked-accounts/:userId/link", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, provider, withdrawalPin } = req.body;
    if (!phoneNumber || phoneNumber.length < 10) return res.status(400).json({ success: false, message: "Invalid phone number" });
    if (!provider) return res.status(400).json({ success: false, message: "Provider required" });
    if (!withdrawalPin || withdrawalPin.length < 4) return res.status(400).json({ success: false, message: "Invalid PIN" });
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const linked = await linkAccount(req.params["userId"], phoneNumber, provider, withdrawalPin);
    return res.status(201).json({ success: true, data: { id: linked.id, phoneNumber: linked.phoneNumber, provider: linked.provider, isActive: linked.isActive === 1, createdAt: linked.createdAt } });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.get("/api/linked-accounts/:userId", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const linked = await getLinkedAccount(req.params["userId"]);
    return res.json({ success: true, data: linked ? { id: linked.id, phoneNumber: linked.phoneNumber, provider: linked.provider, isActive: linked.isActive === 1, createdAt: linked.createdAt } : null });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/linked-accounts/:userId/unlink", async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params["userId"]);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    await unlinkAccount(req.params["userId"]);
    return res.json({ success: true, data: { unlinked: true } });
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/withdrawals", async (req: Request, res: Response) => {
  const { userId, amount, withdrawalPin } = req.body;
  try {
    if (!userId || !amount || !withdrawalPin) return res.status(400).json({ success: false, message: "Missing required fields" });
    if (Number(amount) <= 0) return res.status(400).json({ success: false, message: "Amount must be > 0" });
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const wallet = await getWalletByUserId(userId);
    if (!wallet || Number(wallet.balance) < Number(amount)) return res.status(400).json({ success: false, message: "Insufficient balance" });
    const linked = await getLinkedAccount(userId);
    if (!linked) return res.status(400).json({ success: false, message: "No linked account found" });
    if (linked.withdrawalPin !== withdrawalPin) return res.status(400).json({ success: false, message: "Invalid withdrawal PIN" });
    const payoutId = uuidv4();
    const payoutId = `LTC-WD-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const userCountry = user.country ?? "ZMB";
    const e164Phone = toE164(userCountry, linked.phoneNumber);
    const correspondent = detectNetwork(userCountry, linked.phoneNumber);
    const currency = currencyForCountry(userCountry);
    const pawaPayResponse = await initiatePawaPayPayout({ payoutId, amount: String(Number(amount).toFixed(2)), currency, country: userCountry, correspondent, recipient: { type: "MSISDN", address: { value: e164Phone } }, statementDescription: "LTC Fast Track withdrawal", clientReferenceId: userId });
    if (pawaPayResponse.status === "REJECTED") return res.status(422).json({ success: false, message: pawaPayResponse.failureReason?.failureMessage ?? "Withdrawal rejected", errorCode: pawaPayResponse.failureReason?.failureCode ?? "REJECTED" });
    const txn = await createTransaction(userId, payoutId, -Number(amount), "withdrawal", correspondent, e164Phone);
    await updateWalletBalance(userId, -Number(amount));
    await updateTransactionStatus(payoutId, "processing");
    return res.json({ success: true, data: { withdrawalId: displayWithdrawalId, providerWithdrawalId: payoutId, transactionId: txn.id, status: "PROCESSING", amount: Number(amount), phoneNumber: e164Phone, provider: correspondent, createdAt: pawaPayResponse.created ?? new Date().toISOString() } });
  } catch (error: any) {
    if (axios.isAxiosError(error)) return res.status(400).json({ success: false, message: "PawaPay error", details: error.response?.data });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

const VALID_STATUSES: PickupStatus[] = ["pending", "accepted", "in_progress", "completed", "cancelled"];

app.get("/api/pickups", async (req: Request, res: Response) => {
  try {
    const userId = Array.isArray(req.query["userId"]) ? req.query["userId"][0] : req.query["userId"] as string | undefined;
    const result = userId
      ? await pool.query<Pickup>(`SELECT * FROM ltc_pickups WHERE "userId" = $1 ORDER BY "createdAt" DESC`, [userId])
      : await pool.query<Pickup>(`SELECT * FROM ltc_pickups ORDER BY "createdAt" DESC`);
    return res.json(result.rows);
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.post("/api/pickups", async (req: Request, res: Response) => {
  try {
    const { userId, userName, userPhone, location, latitude, longitude, wasteType, notes, zoneId, scheduledDate, scheduledTime } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "userId is required" });
    const id = `pickup_${uuidv4().replace(/-/g, "").substring(0, 16)}`;
    const n = now();
    await pool.query(`INSERT INTO ltc_pickups (id,"userId","userName","userPhone",location,latitude,longitude,"wasteType",notes,status,"zoneId","scheduledDate","scheduledTime","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14)`,
      [id, userId, userName ?? null, userPhone ?? null, location ?? null, latitude ?? null, longitude ?? null, wasteType ?? "residential", notes ?? null, zoneId ?? null, scheduledDate ?? null, scheduledTime ?? null, n, n]);
    const result = await pool.query<Pickup>(`SELECT * FROM ltc_pickups WHERE id = $1`, [id]);
    return res.status(201).json(result.rows[0]);
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.get("/api/pickups/:id", async (req: Request, res: Response) => {
  try {
    const result = await pool.query<Pickup>(`SELECT * FROM ltc_pickups WHERE id = $1`, [req.params["id"]]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: "Pickup not found" });
    return res.json(result.rows[0]);
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.patch("/api/pickups/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params["id"];
    const { status, assignedTo, notes, completedAt } = req.body;
    const existing = await pool.query<Pickup>(`SELECT * FROM ltc_pickups WHERE id = $1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ success: false, message: "Pickup not found" });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ success: false, message: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}` });
    const updates: string[] = []; const values: unknown[] = []; let i = 1;
    if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
    if (assignedTo !== undefined) { updates.push(`"assignedTo" = $${i++}`); values.push(assignedTo); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); values.push(notes); }
    if (completedAt !== undefined) { updates.push(`"completedAt" = $${i++}`); values.push(completedAt); }
    if (status === "completed" && !completedAt) { updates.push(`"completedAt" = $${i++}`); values.push(new Date().toISOString()); }
    if (updates.length === 0) return res.status(400).json({ success: false, message: "No valid fields to update" });
    updates.push(`"updatedAt" = $${i++}`); values.push(now()); values.push(id);
    await pool.query(`UPDATE ltc_pickups SET ${updates.join(", ")} WHERE id = $${i}`, values);
    const result = await pool.query<Pickup>(`SELECT * FROM ltc_pickups WHERE id = $1`, [id]);
    return res.json(result.rows[0]);
  } catch (error) { return res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Internal server error" }); }
});

app.use((_req, res) => res.status(404).json({ success: false, message: "Route not found" }));
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => { if (!res.headersSent) res.status(500).json({ success: false, message: err.message }); });

initDB().then(() => {
  app.listen(PORT, "0.0.0.0", () => { log("INFO", "Server started", { port: PORT, env: NODE_ENV, pawapay: PAWAPAY_BASE_URL }); });
}).catch((err) => { console.error("[FATAL] DB init failed:", err); process.exit(1); });

process.on("SIGTERM", async () => { await pool.end(); process.exit(0); });
process.on("SIGINT", async () => { await pool.end(); process.exit(0); });
