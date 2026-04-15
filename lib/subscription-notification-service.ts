/**
 * lib/subscription-notification-service.ts
 *
 * Local notification helpers for subscription approval events.
 * Uses expo-notifications to deliver an immediate on-device notification
 * when an admin approves or rejects a subscription request.
 *
 * These are LOCAL notifications (no FCM token required) — they fire
 * instantly on the device that submitted the request.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ── Notification channel (Android) ────────────────────────────────────────────
const CHANNEL_ID = "subscription_approvals";

async function ensureChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Subscription Approvals",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22C55E",
    });
  }
}

/**
 * Request notification permissions if not already granted.
 * Returns true if notifications are allowed.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/**
 * Fire an immediate local notification for subscription approval.
 */
export async function sendSubscriptionApprovedNotification(
  planName: string,
  requestId: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✅ Subscription Approved!",
        body: `Your ${planName} subscription has been approved. Your account is now active.`,
        data: { type: "subscription_approved", requestId },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL_ID }),
      },
      trigger: null, // fire immediately
    });
  } catch (err) {
    console.warn("[SubscriptionNotification] Failed to send approval notification:", err);
  }
}

/**
 * Fire an immediate local notification for subscription rejection.
 */
export async function sendSubscriptionRejectedNotification(
  planName: string,
  reason: string,
  requestId: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "❌ Subscription Request Rejected",
        body: `Your ${planName} subscription request was not approved. Reason: ${reason}`,
        data: { type: "subscription_rejected", requestId, reason },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL_ID }),
      },
      trigger: null, // fire immediately
    });
  } catch (err) {
    console.warn("[SubscriptionNotification] Failed to send rejection notification:", err);
  }
}

/**
 * Fire an immediate local notification when the account is activated.
 */
export async function sendSubscriptionActivatedNotification(
  planName: string,
  requestId: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🎉 Account Activated!",
        body: `Your ${planName} subscription is now active. You can start requesting pickups.`,
        data: { type: "subscription_activated", requestId },
        sound: true,
        ...(Platform.OS === "android" && { channelId: CHANNEL_ID }),
      },
      trigger: null, // fire immediately
    });
  } catch (err) {
    console.warn("[SubscriptionNotification] Failed to send activation notification:", err);
  }
}
