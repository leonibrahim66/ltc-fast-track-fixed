/**
 * lib/driver-arrival-alerts.ts
 *
 * Customer driver arrival alert service for LTC Fast Track.
 *
 * Triggers push notification payloads at the following pickup lifecycle events:
 *   1. ACCEPTED   — "Driver accepted your pickup request"
 *   2. STARTED    — "Driver is on the way to collect your garbage"
 *   3. NEAR       — "Driver is arriving in ~X minutes" (within 500 m)
 *   4. REACHED    — "Driver has arrived at your location" (within 100 m)
 *   5. COMPLETED  — "Pickup completed — thank you!"
 *
 * Architecture:
 *   - This module builds the notification payloads (client-side)
 *   - In production, payloads should be sent via the server to FCM
 *   - In the current local-first setup, payloads are stored in AsyncStorage
 *     so the customer's device can display them as local notifications
 *
 * Usage:
 *   import { triggerDriverArrivalAlert } from "@/lib/driver-arrival-alerts";
 *   await triggerDriverArrivalAlert("accepted", pickup, driver);
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ArrivalAlertEvent =
  | "accepted"
  | "started"
  | "near"
  | "reached"
  | "completed";

export interface ArrivalAlertContext {
  pickupId: string;
  householdName: string;
  address: string;
  driverName: string;
  driverPhone?: string;
  etaMinutes?: number;
  distanceMetres?: number;
}

export interface ArrivalAlertPayload {
  id: string;
  event: ArrivalAlertEvent;
  pickupId: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  data: Record<string, string>;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const ARRIVAL_ALERTS_KEY = "@ltc_arrival_alerts";

// ─── Payload Builders ─────────────────────────────────────────────────────────

function buildPayload(
  event: ArrivalAlertEvent,
  ctx: ArrivalAlertContext
): ArrivalAlertPayload {
  const id = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  const payloads: Record<ArrivalAlertEvent, { title: string; body: string }> = {
    accepted: {
      title: "Pickup Accepted 👍",
      body: `${ctx.driverName} has accepted your pickup request at ${ctx.address}.`,
    },
    started: {
      title: "Driver On The Way 🚛",
      body: `${ctx.driverName} has started your garbage pickup and is heading to you.`,
    },
    near: {
      title: `Driver Arriving in ~${ctx.etaMinutes ?? "a few"} min 🚛`,
      body: `${ctx.driverName} is ${ctx.distanceMetres != null ? `${Math.round(ctx.distanceMetres)} m` : "nearby"} from your location. Please have your bins ready.`,
    },
    reached: {
      title: "Driver Has Arrived ✅",
      body: `${ctx.driverName} has arrived at ${ctx.address}. Please bring your bins out.`,
    },
    completed: {
      title: "Pickup Completed ✓",
      body: `Your garbage has been collected by ${ctx.driverName}. Thank you for using LTC Fast Track!`,
    },
  };

  const { title, body } = payloads[event];

  return {
    id,
    event,
    pickupId: ctx.pickupId,
    title,
    body,
    timestamp,
    read: false,
    data: {
      eventType: "driver_arriving",
      pickupId: ctx.pickupId,
      driverName: ctx.driverName,
      event,
      ...(ctx.etaMinutes != null ? { etaMinutes: String(ctx.etaMinutes) } : {}),
    },
  };
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Trigger a driver arrival alert for a customer.
 *
 * Stores the alert in AsyncStorage so the customer's notification
 * centre can display it. In production, this would also send an
 * FCM push notification via the server.
 *
 * @param event   The lifecycle event that triggered the alert
 * @param ctx     Context about the pickup and driver
 */
export async function triggerDriverArrivalAlert(
  event: ArrivalAlertEvent,
  ctx: ArrivalAlertContext
): Promise<ArrivalAlertPayload> {
  const payload = buildPayload(event, ctx);

  try {
    const raw = await AsyncStorage.getItem(ARRIVAL_ALERTS_KEY);
    const alerts: ArrivalAlertPayload[] = raw ? JSON.parse(raw) : [];

    // Prepend new alert, keep last 100
    alerts.unshift(payload);
    await AsyncStorage.setItem(
      ARRIVAL_ALERTS_KEY,
      JSON.stringify(alerts.slice(0, 100))
    );

    if (__DEV__) {
      console.log(`[ArrivalAlert] ${event} → ${payload.title}`);
    }
  } catch (_e) {
    // Non-fatal
  }

  return payload;
}

/**
 * Get all stored arrival alerts for the current customer.
 */
export async function getArrivalAlerts(): Promise<ArrivalAlertPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(ARRIVAL_ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Mark an alert as read.
 */
export async function markAlertRead(alertId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ARRIVAL_ALERTS_KEY);
    const alerts: ArrivalAlertPayload[] = raw ? JSON.parse(raw) : [];
    const updated = alerts.map((a) =>
      a.id === alertId ? { ...a, read: true } : a
    );
    await AsyncStorage.setItem(ARRIVAL_ALERTS_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Mark all alerts as read.
 */
export async function markAllAlertsRead(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ARRIVAL_ALERTS_KEY);
    const alerts: ArrivalAlertPayload[] = raw ? JSON.parse(raw) : [];
    const updated = alerts.map((a) => ({ ...a, read: true }));
    await AsyncStorage.setItem(ARRIVAL_ALERTS_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Count unread arrival alerts.
 */
export async function getUnreadAlertCount(): Promise<number> {
  try {
    const alerts = await getArrivalAlerts();
    return alerts.filter((a) => !a.read).length;
  } catch {
    return 0;
  }
}

/**
 * Clear all stored arrival alerts.
 */
export async function clearArrivalAlerts(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ARRIVAL_ALERTS_KEY);
  } catch {}
}

// ─── Notification Event Mapping ───────────────────────────────────────────────

/**
 * Map a pickup status change to the corresponding arrival alert event.
 * Returns null if the status change should not trigger an alert.
 */
export function pickupStatusToAlertEvent(
  newStatus: string
): ArrivalAlertEvent | null {
  const map: Record<string, ArrivalAlertEvent> = {
    accepted: "accepted",
    in_progress: "started",
    completed: "completed",
  };
  return map[newStatus] ?? null;
}
