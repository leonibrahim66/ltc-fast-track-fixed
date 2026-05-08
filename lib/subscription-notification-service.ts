/**
 * lib/subscription-notification-service.ts
 *
 * Expo Go SAFE local notification helpers.
 * expo-notifications is imported ONLY at runtime when needed.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

const CHANNEL_ID = "subscription_approvals";

function isExpoGo(): boolean {
  return (
    Constants.appOwnership === "expo" ||
    Constants.executionEnvironment === "storeClient"
  );
}

async function getNotificationsModule(): Promise<any | null> {
  if (Platform.OS === "web") return null;
  if (isExpoGo()) return null;

  try {
    const mod = await import("expo-notifications");
    return mod;
  } catch {
    return null;
  }
}

async function ensureChannel(Notifications: any) {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Subscription Approvals",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#22C55E",
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return false;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

async function fireNotification(
  title: string,
  body: string,
  data: Record<string, any>
) {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    await ensureChannel(Notifications);

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch {}
}

export async function sendSubscriptionApprovedNotification(
  planName: string,
  requestId: string
): Promise<void> {
  await fireNotification(
    "✅ Subscription Approved!",
    `Your ${planName} subscription has been approved. Your account is now active.`,
    { type: "subscription_approved", requestId }
  );
}

export async function sendSubscriptionRejectedNotification(
  planName: string,
  reason: string,
  requestId: string
): Promise<void> {
  await fireNotification(
    "❌ Subscription Request Rejected",
    `Your ${planName} subscription request was not approved. Reason: ${reason}`,
    { type: "subscription_rejected", requestId, reason }
  );
}

export async function sendSubscriptionActivatedNotification(
  planName: string,
  requestId: string
): Promise<void> {
  await fireNotification(
    "🎉 Account Activated!",
    `Your ${planName} subscription is now active. You can start requesting pickups.`,
    { type: "subscription_activated", requestId }
  );
}