/**
 * MTN MoMo Client — Collection + Disbursement APIs
 *
 * Collection: RequestToPay (customer payments)
 * Disbursement: Transfer (provider payouts / withdrawals)
 *
 * Documentation:
 *   https://momodeveloper.mtn.com/docs/services/collection
 *   https://momodeveloper.mtn.com/docs/services/disbursement
 *
 * Collection Flow:
 *   1. getAccessToken()         — Bearer token for Collection (cached)
 *   2. requestToPay()           — POST /collection/v1_0/requesttopay
 *   3. getRequestToPayStatus()  — GET  /collection/v1_0/requesttopay/{referenceId}
 *
 * Disbursement Flow:
 *   1. getDisbursementToken()   — Bearer token for Disbursement (separate cache)
 *   2. disbursementTransfer()   — POST /disbursement/v1_0/transfer
 *   3. getDisbursementStatus()  — GET  /disbursement/v1_0/transfer/{referenceId}
 *
 * Sandbox test MSISDNs:
 *   46733123450  → SUCCESSFUL
 *   56733123450  → FAILED
 *   36733123450  → PENDING (times out)
 *
 * Environment variables:
 *   MTN_BASE_URL                      — e.g. https://sandbox.momodeveloper.mtn.com
 *   MTN_COLLECTION_SUBSCRIPTION_KEY   — Ocp-Apim-Subscription-Key for Collection
 *   MTN_COLLECTION_KEY                — Alias for MTN_COLLECTION_SUBSCRIPTION_KEY
 *   MTN_DISBURSEMENT_SUBSCRIPTION_KEY — Ocp-Apim-Subscription-Key for Disbursement
 *   MTN_DISBURSEMENT_KEY              — Alias for MTN_DISBURSEMENT_SUBSCRIPTION_KEY
 *   MTN_API_USER                      — UUID from provisioning API
 *   MTN_API_KEY                       — API key paired with MTN_API_USER
 *
 * SECURITY:
 *   - All tokens are cached in-process and refreshed before expiry.
 *   - No token or key is ever sent to the frontend.
 *   - All calls are made server-side only.
 */

import axios, { AxiosError } from "axios";

// ─── Sandbox Mode ────────────────────────────────────────────────────────────

/**
 * Returns true when running in sandbox / development mode.
 * Controlled by APP_ENV environment variable.
 * Sandbox mode enables verbose transaction logging.
 */
export function isSandbox(): boolean {
  const env = (process.env.APP_ENV ?? process.env.NODE_ENV ?? "production").toLowerCase();
  return env === "sandbox" || env === "development" || env === "test";
}

/**
 * Sandbox-aware logger. Logs only when APP_ENV=sandbox|development|test.
 * Prefixes all messages with [MTN-SANDBOX] for easy filtering.
 */
export function sandboxLog(event: string, data?: Record<string, unknown>): void {
  if (!isSandbox()) return;
  const ts = new Date().toISOString();
  const payload = data ? ` ${JSON.stringify(data, null, 0)}` : "";
  console.log(`[MTN-SANDBOX][${ts}] ${event}${payload}`);
}

/**
 * Sandbox test MSISDNs (MTN MoMo Developer Portal):
 *   46733123450  → SUCCESSFUL
 *   56733123450  → FAILED
 *   36733123450  → PENDING (times out)
 */
export const SANDBOX_TEST_MSISDNS = {
  SUCCESS: "46733123450",
  FAILED: "56733123450",
  PENDING: "36733123450",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type MtnPaymentStatus =
  | "PENDING"
  | "SUCCESSFUL"
  | "FAILED";

export interface MtnRequestToPayInput {
  /** Internal LTC reference ID (UUID format recommended, max 36 chars) */
  referenceId: string;
  /** Payment amount in ZMW */
  amount: number;
  /** Customer MSISDN (phone number without +, e.g. "260971234567") */
  customerMsisdn: string;
  /** Short description shown to customer on their phone */
  payerMessage?: string;
  /** Note stored on the payee side */
  payeeNote?: string;
  /** External ID for reconciliation (can be same as referenceId) */
  externalId?: string;
}

export interface MtnRequestToPayResult {
  /** The referenceId used — same as input */
  referenceId: string;
  /** HTTP status from MTN (202 = accepted, 4xx/5xx = error) */
  accepted: boolean;
  /** Error message if not accepted */
  error?: string;
}

export interface MtnPaymentStatusResult {
  referenceId: string;
  status: MtnPaymentStatus;
  /** Populated when status = FAILED */
  reason?: string;
  /** Populated when status = SUCCESSFUL */
  financialTransactionId?: string;
  /** Raw response from MTN for audit */
  raw?: Record<string, unknown>;
}

// ─── Token Cache ──────────────────────────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number; // Unix ms
}

let _tokenCache: TokenCache | null = null;

// Separate token cache for Disbursement (different product, different token endpoint)
let _disbursementTokenCache: TokenCache | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMtnConfig(): {
  baseUrl: string;
  collectionKey: string;
  apiUser: string;
  apiKey: string;
  targetEnvironment: string;
} {
  const baseUrl = process.env.MTN_BASE_URL?.trim();
  const collectionKey = (
    process.env.MTN_COLLECTION_SUBSCRIPTION_KEY?.trim() ||
    process.env.MTN_COLLECTION_KEY?.trim()
  );
  const apiUser = process.env.MTN_API_USER?.trim();
  const apiKey = process.env.MTN_API_KEY?.trim();

  if (!baseUrl || !collectionKey || !apiUser || !apiKey) {
    throw new Error(
      "MTN MoMo is not configured. Set MTN_BASE_URL, MTN_COLLECTION_SUBSCRIPTION_KEY (or MTN_COLLECTION_KEY), MTN_API_USER, and MTN_API_KEY.",
    );
  }

  // Determine target environment from base URL
  const targetEnvironment = baseUrl.includes("sandbox") ? "sandbox" : "mtnzambia";

  return { baseUrl, collectionKey, apiUser, apiKey, targetEnvironment };
}

/**
 * Returns true if MTN MoMo Collection credentials are configured.
 * Used to decide whether to call MTN Collection or fall back to manual mode.
 */
export function isMtnConfigured(): boolean {
  return !!(
    process.env.MTN_BASE_URL?.trim() &&
    (process.env.MTN_COLLECTION_SUBSCRIPTION_KEY?.trim() || process.env.MTN_COLLECTION_KEY?.trim()) &&
    process.env.MTN_API_USER?.trim() &&
    process.env.MTN_API_KEY?.trim()
  );
}

/**
 * Returns true if MTN MoMo Disbursement credentials are configured.
 * Used to decide whether to call MTN Disbursement or fall back to manual mode.
 */
export function isMtnDisbursementConfigured(): boolean {
  return !!(
    process.env.MTN_BASE_URL?.trim() &&
    (process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY?.trim() || process.env.MTN_DISBURSEMENT_KEY?.trim()) &&
    process.env.MTN_API_USER?.trim() &&
    process.env.MTN_API_KEY?.trim()
  );
}

/**
 * Returns the Disbursement subscription key from env vars.
 * Accepts both MTN_DISBURSEMENT_SUBSCRIPTION_KEY and MTN_DISBURSEMENT_KEY as aliases.
 */
function getDisbursementConfig(): {
  baseUrl: string;
  disbursementKey: string;
  apiUser: string;
  apiKey: string;
  targetEnvironment: string;
} {
  const baseUrl = process.env.MTN_BASE_URL?.trim();
  const disbursementKey = (
    process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY?.trim() ||
    process.env.MTN_DISBURSEMENT_KEY?.trim()
  );
  const apiUser = process.env.MTN_API_USER?.trim();
  const apiKey = process.env.MTN_API_KEY?.trim();

  if (!baseUrl || !disbursementKey || !apiUser || !apiKey) {
    throw new Error(
      "MTN Disbursement is not configured. Set MTN_BASE_URL, MTN_DISBURSEMENT_SUBSCRIPTION_KEY (or MTN_DISBURSEMENT_KEY), MTN_API_USER, and MTN_API_KEY.",
    );
  }

  const targetEnvironment = baseUrl.includes("sandbox") ? "sandbox" : "mtnzambia";
  return { baseUrl, disbursementKey, apiUser, apiKey, targetEnvironment };
}

// ─── Token Provisioning ───────────────────────────────────────────────────────

/**
 * Obtains a Bearer access token from the MTN Collection API.
 * Tokens are valid for 3600 seconds. This function caches the token
 * in-process and refreshes it 60 seconds before expiry.
 *
 * Endpoint: POST /collection/token/
 * Auth: Basic base64(apiUser:apiKey)
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (_tokenCache && _tokenCache.expiresAt > now + 60_000) {
    return _tokenCache.token;
  }

  const { baseUrl, collectionKey, apiUser, apiKey } = getMtnConfig();

  const credentials = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  try {
    const response = await axios.post<{ access_token: string; expires_in: number }>(
      `${baseUrl}/collection/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Ocp-Apim-Subscription-Key": collectionKey,
          "Content-Type": "application/json",
        },
        timeout: 10_000,
      },
    );

    const { access_token, expires_in } = response.data;
    _tokenCache = {
      token: access_token,
      expiresAt: now + expires_in * 1000,
    };

    return access_token;
  } catch (err) {
    const axiosErr = err as AxiosError;
    const detail = axiosErr.response?.data
      ? JSON.stringify(axiosErr.response.data)
      : axiosErr.message;
    throw new Error(`MTN token request failed: ${detail}`);
  }
}

// ─── RequestToPay ─────────────────────────────────────────────────────────────

/**
 * Sends a RequestToPay to the customer's MTN MoMo account.
 *
 * Endpoint: POST /collection/v1_0/requesttopay
 *
 * Headers:
 *   Authorization: Bearer <access_token>
 *   X-Reference-Id: <referenceId>   (UUID, must be unique per transaction)
 *   X-Target-Environment: sandbox | mtnzambia
 *   Ocp-Apim-Subscription-Key: <MTN_COLLECTION_SUBSCRIPTION_KEY>
 *   Content-Type: application/json
 *
 * A 202 Accepted response means the request was received — NOT that payment succeeded.
 * Poll getRequestToPayStatus() to confirm the final status.
 *
 * Sandbox test MSISDNs:
 *   46733123450 → SUCCESSFUL
 *   56733123450 → FAILED
 *   36733123450 → PENDING (times out after ~60s)
 */
export async function requestToPay(
  input: MtnRequestToPayInput,
): Promise<MtnRequestToPayResult> {
  const { baseUrl, collectionKey, targetEnvironment } = getMtnConfig();
  const accessToken = await getAccessToken();

  // Normalize MSISDN: strip leading + if present
  const msisdn = input.customerMsisdn.replace(/^\+/, "");

  sandboxLog("RequestToPay initiated", {
    referenceId: input.referenceId,
    amount: input.amount,
    msisdn,
    targetEnvironment,
    isSandboxMsisdn: Object.values(SANDBOX_TEST_MSISDNS).includes(msisdn as never),
  });

  const body = {
    amount: input.amount.toFixed(2),
    currency: "ZMW",
    externalId: input.externalId ?? input.referenceId,
    payer: {
      partyIdType: "MSISDN",
      partyId: msisdn,
    },
    payerMessage: input.payerMessage ?? "LTC Fast Track Payment",
    payeeNote: input.payeeNote ?? "Waste collection service",
  };

  try {
    await axios.post(`${baseUrl}/collection/v1_0/requesttopay`, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": input.referenceId,
        "X-Target-Environment": targetEnvironment,
        "Ocp-Apim-Subscription-Key": collectionKey,
        "Content-Type": "application/json",
      },
      timeout: 15_000,
    });

    // 202 Accepted — request received, payment pending on customer's phone
    sandboxLog("RequestToPay accepted (202)", { referenceId: input.referenceId });
    return { referenceId: input.referenceId, accepted: true };
  } catch (err) {
    const axiosErr = err as AxiosError;
    const status = axiosErr.response?.status;
    const detail = axiosErr.response?.data
      ? JSON.stringify(axiosErr.response.data)
      : axiosErr.message;

    // 409 Conflict = duplicate referenceId
    if (status === 409) {
      sandboxLog("RequestToPay duplicate referenceId", { referenceId: input.referenceId, status });
      return {
        referenceId: input.referenceId,
        accepted: false,
        error: `Duplicate referenceId: ${input.referenceId}`,
      };
    }

    sandboxLog("RequestToPay failed", { referenceId: input.referenceId, status, detail });
    return {
      referenceId: input.referenceId,
      accepted: false,
      error: `MTN RequestToPay failed (HTTP ${status ?? "unknown"}): ${detail}`,
    };
  }
}

// ─── Status Polling ───────────────────────────────────────────────────────────

/**
 * Polls the status of a RequestToPay transaction.
 *
 * Endpoint: GET /collection/v1_0/requesttopay/{referenceId}
 *
 * Returns one of: PENDING | SUCCESSFUL | FAILED
 *
 * Recommended polling strategy:
 *   - Poll every 5s for up to 120s (24 attempts)
 *   - If still PENDING after 120s, treat as timeout/failed
 */
export async function getRequestToPayStatus(
  referenceId: string,
): Promise<MtnPaymentStatusResult> {
  const { baseUrl, collectionKey, targetEnvironment } = getMtnConfig();
  const accessToken = await getAccessToken();

  try {
    const response = await axios.get<{
      status: MtnPaymentStatus;
      reason?: string;
      [key: string]: unknown;
    }>(`${baseUrl}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Target-Environment": targetEnvironment,
        "Ocp-Apim-Subscription-Key": collectionKey,
      },
      timeout: 10_000,
    });

    return {
      referenceId,
      status: response.data.status,
      reason: response.data.reason,
      raw: response.data as Record<string, unknown>,
    };
  } catch (err) {
    const axiosErr = err as AxiosError;
    const detail = axiosErr.response?.data
      ? JSON.stringify(axiosErr.response.data)
      : axiosErr.message;
    throw new Error(`MTN status check failed for ${referenceId}: ${detail}`);
  }
}

// ─── Polling Helper ───────────────────────────────────────────────────────────

/**
 * Polls RequestToPay status until SUCCESSFUL or FAILED (or timeout).
 *
 * @param referenceId  The X-Reference-Id used in requestToPay()
 * @param intervalMs   Polling interval in ms (default: 5000)
 * @param maxAttempts  Max number of polls before giving up (default: 24 = 2 min)
 * @returns Final status result
 */
export async function pollUntilFinal(
  referenceId: string,
  intervalMs = 5_000,
  maxAttempts = 24,
): Promise<MtnPaymentStatusResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await getRequestToPayStatus(referenceId);

    if (result.status === "SUCCESSFUL" || result.status === "FAILED") {
      return result;
    }

    // Still PENDING — wait before next poll
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // Timed out
  return {
    referenceId,
    status: "FAILED",
    reason: `Payment timed out after ${maxAttempts} polling attempts (${(maxAttempts * intervalMs) / 1000}s)`,
  };
}

// ─── Disbursement Types ───────────────────────────────────────────────────────

export interface MtnDisbursementInput {
  /** Unique withdrawal reference ID (max 36 chars, UUID recommended) */
  referenceId: string;
  /** Withdrawal amount in ZMW */
  amount: number;
  /** Provider MSISDN (phone number without +, e.g. "260971234567") */
  providerMsisdn: string;
  /** Message shown to payer (LTC platform) */
  payerMessage?: string;
  /** Note shown to payee (provider) */
  payeeNote?: string;
  /** External ID for reconciliation */
  externalId?: string;
}

export interface MtnDisbursementResult {
  referenceId: string;
  accepted: boolean;
  error?: string;
}

export interface MtnDisbursementStatusResult {
  referenceId: string;
  status: MtnPaymentStatus;
  reason?: string;
  financialTransactionId?: string;
  raw?: Record<string, unknown>;
}

// ─── Disbursement Token ───────────────────────────────────────────────────────

/**
 * Obtains a Bearer access token from the MTN Disbursement API.
 * Uses a separate token cache from the Collection token.
 *
 * Endpoint: POST /disbursement/token/
 * Auth: Basic base64(apiUser:apiKey)
 */
export async function getDisbursementToken(): Promise<string> {
  const now = Date.now();

  if (_disbursementTokenCache && _disbursementTokenCache.expiresAt > now + 60_000) {
    return _disbursementTokenCache.token;
  }

  const { baseUrl, disbursementKey, apiUser, apiKey } = getDisbursementConfig();
  const credentials = Buffer.from(`${apiUser}:${apiKey}`).toString("base64");

  try {
    const response = await axios.post<{ access_token: string; expires_in: number }>(
      `${baseUrl}/disbursement/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Ocp-Apim-Subscription-Key": disbursementKey,
          "Content-Type": "application/json",
        },
        timeout: 10_000,
      },
    );

    const { access_token, expires_in } = response.data;
    _disbursementTokenCache = {
      token: access_token,
      expiresAt: now + expires_in * 1000,
    };

    return access_token;
  } catch (err) {
    const axiosErr = err as AxiosError;
    const detail = axiosErr.response?.data
      ? JSON.stringify(axiosErr.response.data)
      : axiosErr.message;
    throw new Error(`MTN Disbursement token request failed: ${detail}`);
  }
}

// ─── Disbursement Transfer ────────────────────────────────────────────────────

/**
 * Sends a Transfer (payout) to a provider's MTN MoMo account.
 *
 * Endpoint: POST /disbursement/v1_0/transfer
 *
 * Headers:
 *   Authorization: Bearer <disbursement_access_token>
 *   X-Reference-Id: <referenceId>   (UUID, must be unique per transfer)
 *   X-Target-Environment: sandbox | mtnzambia
 *   Ocp-Apim-Subscription-Key: <MTN_DISBURSEMENT_SUBSCRIPTION_KEY>
 *   Content-Type: application/json
 *
 * A 202 Accepted response means the transfer was queued — NOT that it succeeded.
 * Poll getDisbursementStatus() to confirm the final status.
 *
 * Sandbox test MSISDNs:
 *   46733123450 → SUCCESSFUL
 *   56733123450 → FAILED
 *   36733123450 → PENDING (times out)
 */
export async function disbursementTransfer(
  input: MtnDisbursementInput,
): Promise<MtnDisbursementResult> {
  const { baseUrl, disbursementKey, targetEnvironment } = getDisbursementConfig();
  const accessToken = await getDisbursementToken();

  // Normalize MSISDN: strip leading + if present
  const msisdn = input.providerMsisdn.replace(/^\+/, "");

  sandboxLog("Disbursement Transfer initiated", {
    referenceId: input.referenceId,
    amount: input.amount,
    msisdn,
    targetEnvironment,
    isSandboxMsisdn: Object.values(SANDBOX_TEST_MSISDNS).includes(msisdn as never),
  });

  const body = {
    amount: input.amount.toFixed(2),
    currency: "ZMW",
    externalId: input.externalId ?? input.referenceId,
    payee: {
      partyIdType: "MSISDN",
      partyId: msisdn,
    },
    payerMessage: input.payerMessage ?? "LTC Fast Track Withdrawal",
    payeeNote: input.payeeNote ?? "Provider payout",
  };

  try {
    await axios.post(`${baseUrl}/disbursement/v1_0/transfer`, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Reference-Id": input.referenceId,
        "X-Target-Environment": targetEnvironment,
        "Ocp-Apim-Subscription-Key": disbursementKey,
        "Content-Type": "application/json",
      },
      timeout: 15_000,
    });

    // 202 Accepted — transfer queued
    sandboxLog("Disbursement Transfer accepted (202)", { referenceId: input.referenceId });
    return { referenceId: input.referenceId, accepted: true };
  } catch (err) {
    const axiosErr = err as AxiosError;
    const status = axiosErr.response?.status;
    const detail = axiosErr.response?.data
      ? JSON.stringify(axiosErr.response.data)
      : axiosErr.message;

    if (status === 409) {
      sandboxLog("Disbursement Transfer duplicate referenceId", { referenceId: input.referenceId, status });
      return {
        referenceId: input.referenceId,
        accepted: false,
        error: `Duplicate referenceId: ${input.referenceId}`,
      };
    }

    sandboxLog("Disbursement Transfer failed", { referenceId: input.referenceId, status, detail });
    return {
      referenceId: input.referenceId,
      accepted: false,
      error: `MTN Disbursement Transfer failed (HTTP ${status ?? "unknown"}): ${detail}`,
    };
  }
}

// ─── Disbursement Status ──────────────────────────────────────────────────────

/**
 * Polls the status of a Disbursement Transfer.
 *
 * Endpoint: GET /disbursement/v1_0/transfer/{referenceId}
 *
 * Returns one of: PENDING | SUCCESSFUL | FAILED
 */
export async function getDisbursementStatus(
  referenceId: string,
): Promise<MtnDisbursementStatusResult> {
  const { baseUrl, disbursementKey, targetEnvironment } = getDisbursementConfig();
  const accessToken = await getDisbursementToken();

  try {
    const response = await axios.get<{
      status: MtnPaymentStatus;
      reason?: string;
      financialTransactionId?: string;
      [key: string]: unknown;
    }>(`${baseUrl}/disbursement/v1_0/transfer/${referenceId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Target-Environment": targetEnvironment,
        "Ocp-Apim-Subscription-Key": disbursementKey,
      },
      timeout: 10_000,
    });

    return {
      referenceId,
      status: response.data.status,
      reason: response.data.reason,
      financialTransactionId: response.data.financialTransactionId,
      raw: response.data as Record<string, unknown>,
    };
  } catch (err) {
    const axiosErr = err as AxiosError;
    const detail = axiosErr.response?.data
      ? JSON.stringify(axiosErr.response.data)
      : axiosErr.message;
    throw new Error(`MTN Disbursement status check failed for ${referenceId}: ${detail}`);
  }
}

/**
 * Polls Disbursement Transfer status until SUCCESSFUL or FAILED (or timeout).
 *
 * @param referenceId  The X-Reference-Id used in disbursementTransfer()
 * @param intervalMs   Polling interval in ms (default: 5000)
 * @param maxAttempts  Max polls before giving up (default: 24 = 2 min)
 */
export async function pollDisbursementUntilFinal(
  referenceId: string,
  intervalMs = 5_000,
  maxAttempts = 24,
): Promise<MtnDisbursementStatusResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await getDisbursementStatus(referenceId);

    if (result.status === "SUCCESSFUL" || result.status === "FAILED") {
      return result;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  return {
    referenceId,
    status: "FAILED",
    reason: `Disbursement timed out after ${maxAttempts} polling attempts (${(maxAttempts * intervalMs) / 1000}s)`,
  };
}

// ─── Sandbox Utilities ────────────────────────────────────────────────────────

/**
 * MTN Sandbox test MSISDNs.
 * Use these phone numbers in sandbox mode to simulate payment outcomes.
 */
export const MTN_SANDBOX_TEST_NUMBERS = {
  /** Always returns SUCCESSFUL */
  SUCCESS: "46733123450",
  /** Always returns FAILED */
  FAILED: "56733123450",
  /** Returns PENDING (times out) */
  PENDING: "36733123450",
} as const;

/**
 * Returns true if the given MSISDN is a known sandbox test number.
 */
export function isSandboxTestNumber(msisdn: string): boolean {
  const normalized = msisdn.replace(/^\+/, "");
  return Object.values(MTN_SANDBOX_TEST_NUMBERS).includes(
    normalized as (typeof MTN_SANDBOX_TEST_NUMBERS)[keyof typeof MTN_SANDBOX_TEST_NUMBERS],
  );
}
