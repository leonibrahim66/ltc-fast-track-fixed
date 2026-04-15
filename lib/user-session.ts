/**
 * Backend userId persistence layer.
 *
 * The backend assigns its own userId (e.g. "user_abc123") when a phone number
 * is first seen.  This module persists that ID in AsyncStorage so the same
 * device always reuses the same backend user — preventing duplicate user
 * creation on every app restart.
 *
 * Key design decisions:
 *  - Keyed by phone number so different accounts on the same device are
 *    isolated.
 *  - Falls back to creating a new user via POST /api/users if no stored ID
 *    is found for the given phone.
 *  - All callers should use `getOrCreateBackendUserId()` — never call
 *    POST /api/users directly.
 *
 * Usage:
 *   import { getOrCreateBackendUserId, clearBackendUserId } from "@/lib/user-session";
 *
 *   // On login / registration — ensures backend user exists and is persisted
 *   const backendUserId = await getOrCreateBackendUserId(phone);
 *
 *   // On logout — clear the stored ID for this phone
 *   await clearBackendUserId(phone);
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiPost } from "@/lib/api-client";

// ─── Storage key ──────────────────────────────────────────────────────────────

/** Returns the AsyncStorage key for a given phone number. */
function storageKey(phone: string): string {
  // Normalise: strip spaces and leading +
  const normalised = phone.replace(/\s+/g, "").replace(/^\+/, "");
  return `@ltc_backend_user_id:${normalised}`;
}

// ─── Backend user creation response ──────────────────────────────────────────

interface CreateUserResponse {
  success: boolean;
  data: {
    userId: string;
    phoneNumber: string;
    isNew: boolean;
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load the persisted backend userId for a phone number.
 * Returns null if no ID has been stored yet.
 */
export async function loadBackendUserId(phone: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(storageKey(phone));
  } catch {
    return null;
  }
}

/**
 * Persist the backend userId for a phone number.
 */
export async function saveBackendUserId(
  phone: string,
  userId: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(phone), userId);
  } catch (err) {
    console.warn("[user-session] Failed to persist backend userId:", err);
  }
}

/**
 * Clear the persisted backend userId for a phone number.
 * Call this on logout if the user should start fresh.
 */
export async function clearBackendUserId(phone: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(phone));
  } catch {
    // ignore
  }
}

/**
 * Get the backend userId for a phone number, creating a new backend user if
 * none is stored.
 *
 * - First call for a phone: calls POST /api/users, stores the returned ID.
 * - Subsequent calls: returns the stored ID immediately (no network call).
 * - If the backend returns an existing user for the phone (idempotent), the
 *   returned ID is stored and reused.
 *
 * @param phone  E.164 or local format phone number (will be normalised)
 * @param opts   Optional registration metadata (country, province, city, town)
 */
export async function getOrCreateBackendUserId(
  phone: string,
  opts?: {
    country?: string;
    province?: string;
    city?: string;
    town?: string;
    fullAddress?: string;
  }
): Promise<string> {
  // 1. Check storage first — avoids creating duplicate users on restart
  const stored = await loadBackendUserId(phone);
  if (stored) {
    return stored;
  }

  // 2. No stored ID — call POST /api/users to get or create a backend user
  const result = await apiPost<CreateUserResponse>("/api/users", {
    phoneNumber: phone,
    country: opts?.country ?? "ZMB",
    province: opts?.province,
    city: opts?.city,
    town: opts?.town,
    fullAddress: opts?.fullAddress,
  });

  const userId = result.data.userId;

  // 3. Persist so future calls skip the network
  await saveBackendUserId(phone, userId);

  return userId;
}
