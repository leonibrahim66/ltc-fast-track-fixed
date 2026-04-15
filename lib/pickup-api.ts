/**
 * LTC Fast Track — Pickup API client
 *
 * All pickup-related network calls go through this module.
 * The base URL is resolved from EXPO_PUBLIC_API_URL via the central api-client —
 * no hardcoded URLs or fallbacks to localhost.
 *
 * Backend contract:
 *   GET  /api/pickups            → ApiPickup[]
 *   GET  /api/pickups?userId=X   → ApiPickup[] (filtered)
 *   POST /api/pickups            → ApiPickup  (201)
 *   GET  /api/pickups/:id        → ApiPickup
 *   PATCH /api/pickups/:id       → ApiPickup
 */

import { apiGet, apiPost, apiPatch } from "@/lib/api-client";

// ─── Types ───────────────────────────────────────────────────────────────────

/** Shape returned by the backend for a single pickup record. */
export interface ApiPickup {
  id: string;
  /** Free-text address string (e.g. "Lusaka CBD") */
  location?: string;
  userId?: string;
  /** Waste / bin type: household | commercial | industrial */
  wasteType?: string;
  notes?: string;
  status?: "pending" | "accepted" | "in_progress" | "completed";
  /** ISO-8601 timestamp */
  createdAt: string;
  updatedAt?: string;
  // Legacy fields that may appear on older records
  amount?: number;
  phoneNumber?: string;
}

/** Payload sent to POST /api/pickups */
export interface CreatePickupPayload {
  userId: string;
  location: string;
  wasteType: string;
  notes?: string;
  /** User's full name — stored as metadata */
  userName?: string;
  /** User's phone number */
  userPhone?: string;
  /** Latitude of the pickup pin */
  latitude?: number;
  /** Longitude of the pickup pin */
  longitude?: number;
  /** Zone ID for routing to the correct zone manager */
  zoneId?: string;
  /** Scheduled date (ISO string) */
  scheduledDate?: string;
  /** Scheduled time slot: morning | afternoon | evening */
  scheduledTime?: string;
}

/** Payload sent to PATCH /api/pickups/:id */
export interface UpdatePickupPayload {
  status?: "pending" | "accepted" | "in_progress" | "completed";
  notes?: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all pickups from the backend.
 * Pass userId to filter to a specific user's pickups.
 */
export async function fetchPickups(userId?: string): Promise<ApiPickup[]> {
  const path = userId
    ? `/api/pickups?userId=${encodeURIComponent(userId)}`
    : "/api/pickups";
  return apiGet<ApiPickup[]>(path);
}

/**
 * Fetch a single pickup by its ID.
 */
export async function fetchPickupById(id: string): Promise<ApiPickup> {
  return apiGet<ApiPickup>(`/api/pickups/${encodeURIComponent(id)}`);
}

/**
 * Create a new pickup on the backend.
 * Returns the created ApiPickup (id + createdAt assigned by server).
 */
export async function createPickupOnServer(
  payload: CreatePickupPayload
): Promise<ApiPickup> {
  return apiPost<ApiPickup>("/api/pickups", payload);
}

/**
 * Update a pickup's status or notes.
 */
export async function updatePickup(
  id: string,
  payload: UpdatePickupPayload
): Promise<ApiPickup> {
  return apiPatch<ApiPickup>(`/api/pickups/${encodeURIComponent(id)}`, payload);
}
