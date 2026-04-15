/**
 * Central API client for the LTC Fast Track backend.
 *
 * All API calls MUST go through this module so that:
 *  1. The base URL is read from EXPO_PUBLIC_API_URL (never hardcoded).
 *  2. Every request automatically includes the correct Content-Type header.
 *  3. Non-2xx responses are thrown as Error objects with the server message.
 *
 * Usage:
 *   import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
 *   const pickups = await apiGet<ApiPickup[]>("/api/pickups?userId=user_abc");
 *   const result  = await apiPost("/api/payments/pawapay", { amount, phoneNumber });
 */

// ─── Base URL ─────────────────────────────────────────────────────────────────

/**
 * Read from EXPO_PUBLIC_API_URL.
 * Falls back to EXPO_PUBLIC_API_BASE_URL for backward compatibility,
 * then throws at call time (never silently falls back to localhost in production).
 */
export function getApiBaseUrl(): string {
  const url =
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!url) {
    throw new Error(
      "[api-client] EXPO_PUBLIC_API_URL is not set. " +
        "Add it to your .env file or Secrets panel."
    );
  }
  // Strip trailing slash so callers can always prefix paths with "/"
  return url.replace(/\/$/, "");
}

// ─── Core request helper ──────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...options,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message ?? body?.error ?? message;
    } catch {
      // ignore JSON parse errors on error responses
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/** GET request — returns parsed JSON body. */
export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

/** POST request — serialises body to JSON. */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** PATCH request — serialises body to JSON. */
export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** DELETE request. */
export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}
