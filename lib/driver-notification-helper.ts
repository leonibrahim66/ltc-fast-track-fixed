/**
 * lib/driver-notification-helper.ts
 *
 * Shared helper to insert a notification into the user_notifications table
 * for a specific garbage collection driver.
 *
 * Calls the backend tRPC endpoint POST /api/trpc/notifications.create
 * directly via HTTP so it works from any screen without tRPC React hooks.
 *
 * The DB enum only has: pickup_update | driver_accepted | driver_arriving |
 *   pickup_completed | payment | subscription | system | support
 *
 * We use "system" as the DB type and encode the semantic driver type in the
 * `data` JSON field so the driver notifications screen can display the right
 * icon/colour without a DB migration.
 *
 * Semantic driver notification types (stored in data.driverType):
 *   driver_approved       — zone manager approved the driver
 *   driver_suspended      — zone manager suspended / rejected the driver
 *   pickup_assigned       — zone manager assigned a pickup to the driver
 *   zone_assignment       — driver was assigned to a zone
 *   zone_manager_message  — general message from zone manager
 *   customer_chat         — customer sent a chat message on an active pickup
 *   system                — fallback / generic
 */

import { getApiBaseUrl } from "@/constants/oauth";
import { Platform } from "react-native";

export type DriverNotifType =
  | "driver_approved"
  | "driver_suspended"
  | "pickup_assigned"
  | "zone_assignment"
  | "zone_manager_message"
  | "customer_chat"
  | "system";

export interface DriverNotifPayload {
  /** The driver's userId — recipient of the notification */
  driverUserId: string;
  type: DriverNotifType;
  title: string;
  body: string;
  /** Optional pickup ID for navigation on tap */
  pickupId?: string;
}

/**
 * Insert a driver notification by calling the backend tRPC endpoint directly.
 *
 * Errors are caught and logged silently so they never block the primary action.
 */
export async function createDriverNotification(
  payload: DriverNotifPayload
): Promise<void> {
  try {
    const baseUrl = getApiBaseUrl();
    // On native, use local loopback when no base URL is configured
    const apiBase =
      baseUrl ||
      (Platform.OS !== "web" ? "http://127.0.0.1:3000" : "");

    const url = `${apiBase}/api/trpc/notifications.create`;

    const body = JSON.stringify({
      json: {
        userId: payload.driverUserId,
        // Use "system" as the DB-level type; encode semantic type in data
        type: "system",
        title: payload.title,
        body: payload.body,
        pickupId: payload.pickupId,
        // Encode the semantic driver notification type so the UI can display
        // the correct icon and colour without a DB migration
        data: JSON.stringify({ driverType: payload.type }),
      },
    });

    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch (err) {
    // Non-fatal: notification delivery failure must never block the primary action
    console.warn("[createDriverNotification] Failed to insert notification:", err);
  }
}
