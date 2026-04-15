/**
 * lib/firebase-notifications.ts
 *
 * Firebase Cloud Messaging (FCM) notification service for LTC Fast Track.
 *
 * Handles:
 *  - FCM token registration and storage
 *  - Foreground message handling
 *  - Background/quit-state notification tap handling
 *  - 6 typed push notification event builders
 *
 * Push notification events:
 *  1. payment_confirmation      — Customer payment confirmed
 *  2. new_pickup_request        — New pickup request for zone managers
 *  3. garbage_pickup_scheduled  — Garbage pickup scheduled for customer
 *  4. garbage_pickup_completed  — Garbage pickup completed
 *  5. driver_arriving           — Driver arriving notification
 *  6. withdrawal_status         — Withdrawal approval or rejection
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { messaging } from "./firebase";
import { FirebaseMessage } from "./firebase";

// ─── Storage key ──────────────────────────────────────────────────────────────

const FCM_TOKEN_KEY = "@ltc_fcm_token";
const FCM_TOKEN_UPDATED_KEY = "@ltc_fcm_token_updated_at";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationEventType =
  | "payment_confirmation"
  | "new_pickup_request"
  | "garbage_pickup_scheduled"
  | "garbage_pickup_completed"
  | "driver_arriving"
  | "withdrawal_status";

export interface LTCNotificationPayload {
  eventType: NotificationEventType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FCMTokenInfo {
  token: string;
  updatedAt: string;
  platform: string;
}

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * Request FCM permission and register the device token.
 * Returns the token string or null if unavailable/denied.
 */
export async function registerFCMToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const granted = await messaging.requestPermission();
    if (!granted) {
      console.warn("[FCM] Notification permission denied.");
      return null;
    }

    const token = await messaging.getToken();
    if (!token) return null;

    // Persist token locally for server sync
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    await AsyncStorage.setItem(FCM_TOKEN_UPDATED_KEY, new Date().toISOString());

    if (__DEV__) {
      console.log("[FCM] Token registered:", token.substring(0, 20) + "...");
    }

    return token;
  } catch (error) {
    console.error("[FCM] Token registration error:", error);
    return null;
  }
}

/**
 * Retrieve the stored FCM token from AsyncStorage.
 */
export async function getStoredFCMToken(): Promise<FCMTokenInfo | null> {
  try {
    const token = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    const updatedAt = await AsyncStorage.getItem(FCM_TOKEN_UPDATED_KEY);
    if (!token) return null;
    return {
      token,
      updatedAt: updatedAt ?? new Date().toISOString(),
      platform: Platform.OS,
    };
  } catch {
    return null;
  }
}

/**
 * Clear the stored FCM token (call on logout).
 */
export async function clearFCMToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(FCM_TOKEN_KEY);
    await AsyncStorage.removeItem(FCM_TOKEN_UPDATED_KEY);
  } catch {}
}

// ─── Notification Handlers ────────────────────────────────────────────────────

type NotificationHandler = (payload: LTCNotificationPayload) => void;

const _handlers: NotificationHandler[] = [];

/**
 * Register a global notification handler.
 * Returns an unsubscribe function.
 */
export function onNotification(handler: NotificationHandler): () => void {
  _handlers.push(handler);
  return () => {
    const idx = _handlers.indexOf(handler);
    if (idx !== -1) _handlers.splice(idx, 1);
  };
}

function _dispatch(message: FirebaseMessage): void {
  const eventType = (message.data?.eventType ?? "payment_confirmation") as NotificationEventType;
  const payload: LTCNotificationPayload = {
    eventType,
    title: message.notification?.title ?? "",
    body: message.notification?.body ?? "",
    data: message.data,
  };
  _handlers.forEach((h) => h(payload));
}

/**
 * Initialize FCM listeners.
 * Call once from app _layout.tsx after authentication.
 * Returns a cleanup function.
 */
export function initFCMListeners(): () => void {
  // Foreground messages
  const unsubForeground = messaging.onMessage((message) => {
    if (__DEV__) console.log("[FCM] Foreground message:", message.messageId);
    _dispatch(message);
  });

  // Background → app opened via notification tap
  const unsubBackground = messaging.onNotificationOpenedApp((message) => {
    if (__DEV__) console.log("[FCM] App opened from background notification:", message.messageId);
    _dispatch(message);
  });

  // Background message handler (app in background/killed)
  messaging.setBackgroundMessageHandler(async (message) => {
    if (__DEV__) console.log("[FCM] Background message received:", message.messageId);
    // Background messages are handled by the OS notification tray
    // No UI dispatch needed here
  });

  // Check if app was opened from a quit-state notification
  messaging.getInitialNotification().then((message) => {
    if (message) {
      if (__DEV__) console.log("[FCM] App opened from quit-state notification:", message.messageId);
      _dispatch(message);
    }
  });

  return () => {
    unsubForeground();
    unsubBackground();
  };
}

// ─── Notification Event Builders ──────────────────────────────────────────────
// These are used server-side to construct FCM payloads.
// Exported here as typed builders for use in server/notification-service.ts.

/**
 * 1. Payment Confirmation
 * Sent to customer after a successful payment.
 */
export function buildPaymentConfirmationPayload(params: {
  amount: number;
  currency: string;
  referenceId: string;
  serviceType: string;
}): LTCNotificationPayload {
  return {
    eventType: "payment_confirmation",
    title: "Payment Confirmed ✓",
    body: `Your payment of ${params.currency} ${params.amount.toFixed(2)} for ${params.serviceType} has been confirmed.`,
    data: {
      eventType: "payment_confirmation",
      referenceId: params.referenceId,
      amount: String(params.amount),
      currency: params.currency,
      serviceType: params.serviceType,
    },
  };
}

/**
 * 2. New Pickup Request (for Zone Managers)
 * Sent to zone manager when a new pickup is requested in their zone.
 */
export function buildNewPickupRequestPayload(params: {
  pickupId: string;
  customerName: string;
  address: string;
  zoneName: string;
}): LTCNotificationPayload {
  return {
    eventType: "new_pickup_request",
    title: "New Pickup Request",
    body: `${params.customerName} at ${params.address} has requested a pickup in ${params.zoneName}.`,
    data: {
      eventType: "new_pickup_request",
      pickupId: params.pickupId,
      customerName: params.customerName,
      address: params.address,
      zoneName: params.zoneName,
    },
  };
}

/**
 * 3. Garbage Pickup Scheduled
 * Sent to customer when their pickup has been scheduled.
 */
export function buildPickupScheduledPayload(params: {
  pickupId: string;
  scheduledDate: string;
  driverName: string;
  zoneName: string;
}): LTCNotificationPayload {
  return {
    eventType: "garbage_pickup_scheduled",
    title: "Pickup Scheduled",
    body: `Your garbage pickup is scheduled for ${params.scheduledDate}. Driver: ${params.driverName}.`,
    data: {
      eventType: "garbage_pickup_scheduled",
      pickupId: params.pickupId,
      scheduledDate: params.scheduledDate,
      driverName: params.driverName,
      zoneName: params.zoneName,
    },
  };
}

/**
 * 4. Garbage Pickup Completed
 * Sent to customer when their pickup has been completed.
 */
export function buildPickupCompletedPayload(params: {
  pickupId: string;
  completedAt: string;
  driverName: string;
}): LTCNotificationPayload {
  return {
    eventType: "garbage_pickup_completed",
    title: "Pickup Completed ✓",
    body: `Your garbage has been collected by ${params.driverName}. Thank you for using LTC Fast Track!`,
    data: {
      eventType: "garbage_pickup_completed",
      pickupId: params.pickupId,
      completedAt: params.completedAt,
      driverName: params.driverName,
    },
  };
}

/**
 * 5. Driver Arriving
 * Sent to customer when the driver is en route and nearby.
 */
export function buildDriverArrivingPayload(params: {
  pickupId: string;
  driverName: string;
  etaMinutes: number;
}): LTCNotificationPayload {
  return {
    eventType: "driver_arriving",
    title: "Driver On The Way 🚛",
    body: `${params.driverName} is arriving in approximately ${params.etaMinutes} minute${params.etaMinutes !== 1 ? "s" : ""}. Please have your bins ready.`,
    data: {
      eventType: "driver_arriving",
      pickupId: params.pickupId,
      driverName: params.driverName,
      etaMinutes: String(params.etaMinutes),
    },
  };
}

/**
 * 6. Withdrawal Status (Approval or Rejection)
 * Sent to provider when their withdrawal request is processed.
 */
export function buildWithdrawalStatusPayload(params: {
  withdrawalId: string;
  status: "approved" | "rejected";
  amount: number;
  currency: string;
  reason?: string;
}): LTCNotificationPayload {
  const approved = params.status === "approved";
  return {
    eventType: "withdrawal_status",
    title: approved ? "Withdrawal Approved ✓" : "Withdrawal Rejected",
    body: approved
      ? `Your withdrawal of ${params.currency} ${params.amount.toFixed(2)} has been approved and is being processed.`
      : `Your withdrawal of ${params.currency} ${params.amount.toFixed(2)} was rejected.${params.reason ? ` Reason: ${params.reason}` : ""}`,
    data: {
      eventType: "withdrawal_status",
      withdrawalId: params.withdrawalId,
      status: params.status,
      amount: String(params.amount),
      currency: params.currency,
      ...(params.reason ? { reason: params.reason } : {}),
    },
  };
}
