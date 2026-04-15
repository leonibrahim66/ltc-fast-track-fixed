/**
 * lib/push-notification-service.ts
 *
 * Native push notification service for LTC Fast Track.
 *
 * Architecture:
 * - Uses expo-notifications for native device-level push alerts
 * - Works even when the app is in background or closed
 * - Complements the Supabase Realtime in-app system (global-notification-context)
 * - Handles all 4 user roles: customer, zone_manager, garbage_driver, admin
 *
 * Notification Events:
 * ┌─────────────────────────────┬──────────────────────────────────────────┐
 * │ Event                       │ Recipients                               │
 * ├─────────────────────────────┼──────────────────────────────────────────┤
 * │ new_pickup_request          │ Zone managers + nearby drivers           │
 * │ driver_assigned             │ Customer                                 │
 * │ driver_accepted             │ Customer + Zone manager                  │
 * │ driver_arriving             │ Customer                                 │
 * │ pickup_completed            │ Customer + Zone manager                  │
 * │ driver_approved             │ Driver                                   │
 * │ driver_rejected             │ Driver                                   │
 * │ manual_assignment           │ Driver                                   │
 * │ payment_confirmed           │ Customer                                 │
 * └─────────────────────────────┴──────────────────────────────────────────┘
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const PUSH_TOKEN_KEY = "@ltc_expo_push_token";
const PUSH_TOKEN_UPDATED_KEY = "@ltc_expo_push_token_updated_at";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobNotificationEvent =
  | "new_pickup_request"
  | "driver_assigned"
  | "driver_accepted"
  | "driver_arriving"
  | "pickup_completed"
  | "pickup_cancelled"
  | "driver_approved"
  | "driver_rejected"
  | "manual_assignment"
  | "payment_confirmed"
  | "zone_manager_escalation";

export interface JobNotificationPayload {
  event: JobNotificationEvent;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Deep link URL to navigate to on tap */
  url?: string;
}

export interface PushTokenInfo {
  token: string;
  updatedAt: string;
  platform: string;
}

// ─── Notification Handler ─────────────────────────────────────────────────────

/**
 * Configure how notifications behave when the app is in the foreground.
 * Call this once at app startup (e.g., in app/_layout.tsx).
 */
export function configureNotificationHandler() {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// ─── Android Channel Setup ────────────────────────────────────────────────────

/**
 * Set up Android notification channels for different priority levels.
 * Must be called before scheduling notifications on Android.
 */
export async function setupAndroidChannels() {
  if (Platform.OS !== "android") return;

  // High priority channel for job alerts
  await Notifications.setNotificationChannelAsync("job_alerts", {
    name: "Job Alerts",
    description: "Real-time job and pickup notifications",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0a7ea4",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });

  // Default channel for general notifications
  await Notifications.setNotificationChannelAsync("default", {
    name: "General",
    description: "General app notifications",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0a7ea4",
  });

  // Payment channel
  await Notifications.setNotificationChannelAsync("payments", {
    name: "Payments",
    description: "Payment confirmations and updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#22C55E",
  });
}

// ─── Permission & Token Registration ─────────────────────────────────────────

/**
 * Request notification permissions and register for push notifications.
 * Returns the Expo push token or null if unavailable/denied.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.warn("[PushNotif] Must use physical device for push notifications");
    return null;
  }

  // Web is not supported
  if (Platform.OS === "web") {
    return null;
  }

  // Set up Android channels
  await setupAndroidChannels();

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[PushNotif] Permission not granted for push notifications");
    return null;
  }

  // Get Expo push token
  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    const token = tokenData.data;

    // Store token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    await AsyncStorage.setItem(
      PUSH_TOKEN_UPDATED_KEY,
      new Date().toISOString()
    );

    console.log("[PushNotif] Token registered:", token.substring(0, 30) + "...");
    return token;
  } catch (error) {
    console.error("[PushNotif] Token registration failed:", error);
    return null;
  }
}

/**
 * Get the stored push token from AsyncStorage.
 */
export async function getStoredPushToken(): Promise<PushTokenInfo | null> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    const updatedAt = await AsyncStorage.getItem(PUSH_TOKEN_UPDATED_KEY);
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

// ─── Local Notification Scheduling ───────────────────────────────────────────

/**
 * Show an immediate local notification (works without internet).
 * Used as fallback when Supabase/FCM is unavailable.
 */
export async function showLocalNotification(
  payload: JobNotificationPayload
): Promise<string> {
  if (Platform.OS === "web") return "web-noop";
  const channelId = getChannelForEvent(payload.event);

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body: payload.body,
      data: {
        event: payload.event,
        url: payload.url ?? "",
        ...(payload.data ?? {}),
      },
      sound: "default",
      badge: 1,
    },
    trigger: null, // immediate
    ...(Platform.OS === "android" ? { channelId } : {}),
  });

  return notifId;
}

/**
 * Get the appropriate Android channel for a notification event.
 */
function getChannelForEvent(event: JobNotificationEvent): string {
  switch (event) {
    case "new_pickup_request":
    case "driver_assigned":
    case "driver_accepted":
    case "driver_arriving":
    case "manual_assignment":
    case "zone_manager_escalation":
      return "job_alerts";
    case "payment_confirmed":
      return "payments";
    default:
      return "default";
  }
}

// ─── Role-Specific Notification Builders ─────────────────────────────────────

/**
 * Build notification payload for customer when a driver is assigned.
 */
export function buildDriverAssignedNotif(params: {
  pickupId: string;
  driverName: string;
  etaMinutes?: number;
}): JobNotificationPayload {
  return {
    event: "driver_assigned",
    title: "Driver Assigned 🚛",
    body: `${params.driverName} has been assigned to your pickup request${params.etaMinutes ? ` and will arrive in ~${params.etaMinutes} min` : ""}.`,
    data: { pickupId: params.pickupId, driverName: params.driverName },
    url: "/(tabs)/track-shipment",
  };
}

/**
 * Build notification payload for customer when driver accepts the job.
 */
export function buildDriverAcceptedNotif(params: {
  pickupId: string;
  driverName: string;
  driverPhone?: string;
}): JobNotificationPayload {
  return {
    event: "driver_accepted",
    title: "Driver On The Way ✓",
    body: `${params.driverName} has accepted your pickup and is heading to you.`,
    data: {
      pickupId: params.pickupId,
      driverName: params.driverName,
      driverPhone: params.driverPhone ?? "",
    },
    url: "/(tabs)/track-shipment",
  };
}

/**
 * Build notification payload for customer when driver is arriving.
 */
export function buildDriverArrivingNotif(params: {
  pickupId: string;
  driverName: string;
  etaMinutes: number;
}): JobNotificationPayload {
  return {
    event: "driver_arriving",
    title: "Driver Arriving Soon 🚛",
    body: `${params.driverName} is arriving in approximately ${params.etaMinutes} minute${params.etaMinutes !== 1 ? "s" : ""}. Please have your bins ready.`,
    data: {
      pickupId: params.pickupId,
      driverName: params.driverName,
      etaMinutes: String(params.etaMinutes),
    },
    url: "/(tabs)/track-shipment",
  };
}

/**
 * Build notification payload for customer when pickup is completed.
 */
export function buildPickupCompletedNotif(params: {
  pickupId: string;
  driverName: string;
}): JobNotificationPayload {
  return {
    event: "pickup_completed",
    title: "Pickup Completed ✓",
    body: `Your garbage has been collected by ${params.driverName}. Thank you for using LTC Fast Track!`,
    data: { pickupId: params.pickupId, driverName: params.driverName },
    url: "/(tabs)/profile",
  };
}

/**
 * Build notification payload for zone manager when a new pickup is requested.
 */
export function buildNewPickupRequestNotif(params: {
  pickupId: string;
  customerName: string;
  address: string;
  zoneName: string;
}): JobNotificationPayload {
  return {
    event: "new_pickup_request",
    title: "New Pickup Request 📍",
    body: `${params.customerName} at ${params.address} has requested a pickup in ${params.zoneName}.`,
    data: {
      pickupId: params.pickupId,
      customerName: params.customerName,
      address: params.address,
      zoneName: params.zoneName,
    },
    url: "/(collector)/pickups",
  };
}

/**
 * Build notification payload for zone manager when escalation occurs
 * (no driver accepted within timeout).
 */
export function buildEscalationNotif(params: {
  pickupId: string;
  customerName: string;
  address: string;
  minutesWaiting: number;
}): JobNotificationPayload {
  return {
    event: "zone_manager_escalation",
    title: "⚠️ Pickup Needs Manual Assignment",
    body: `No driver has accepted the pickup for ${params.customerName} at ${params.address} after ${params.minutesWaiting} minutes. Please assign manually.`,
    data: {
      pickupId: params.pickupId,
      customerName: params.customerName,
      address: params.address,
      minutesWaiting: String(params.minutesWaiting),
    },
    url: "/(collector)/pickups",
  };
}

/**
 * Build notification payload for driver when manually assigned to a pickup.
 */
export function buildManualAssignmentNotif(params: {
  pickupId: string;
  customerName: string;
  address: string;
  managerName: string;
}): JobNotificationPayload {
  return {
    event: "manual_assignment",
    title: "New Job Assigned 📋",
    body: `${params.managerName} has assigned you to pick up ${params.customerName} at ${params.address}.`,
    data: {
      pickupId: params.pickupId,
      customerName: params.customerName,
      address: params.address,
      managerName: params.managerName,
    },
    url: "/(garbage-driver)",
  };
}

/**
 * Build notification payload for driver when approved by zone manager.
 */
export function buildDriverApprovedNotif(params: {
  managerName: string;
  zoneName?: string;
}): JobNotificationPayload {
  return {
    event: "driver_approved",
    title: "Application Approved ✓",
    body: `${params.managerName} has approved your driver application${params.zoneName ? ` for ${params.zoneName}` : ""}. You can now start accepting pickups!`,
    data: {
      managerName: params.managerName,
      zoneName: params.zoneName ?? "",
    },
    url: "/(garbage-driver)",
  };
}

/**
 * Build notification payload for driver when rejected by zone manager.
 */
export function buildDriverRejectedNotif(params: {
  managerName: string;
  reason?: string;
}): JobNotificationPayload {
  return {
    event: "driver_rejected",
    title: "Application Not Approved",
    body: `Your driver application was not approved by ${params.managerName}${params.reason ? `. Reason: ${params.reason}` : ""}. Please contact your zone manager.`,
    data: {
      managerName: params.managerName,
      reason: params.reason ?? "",
    },
    url: "/(auth)/register-garbage-driver",
  };
}

/**
 * Build notification payload for driver when a new pickup is available in their zone.
 */
export function buildNewJobAvailableNotif(params: {
  pickupId: string;
  customerName: string;
  address: string;
  distance?: string;
}): JobNotificationPayload {
  return {
    event: "new_pickup_request",
    title: "New Job Available 🗑️",
    body: `Pickup request from ${params.customerName} at ${params.address}${params.distance ? ` (${params.distance} away)` : ""}. Tap to accept.`,
    data: {
      pickupId: params.pickupId,
      customerName: params.customerName,
      address: params.address,
      distance: params.distance ?? "",
    },
    url: "/(garbage-driver)",
  };
}

// ─── Notification Listeners ───────────────────────────────────────────────────

/**
 * Subscribe to notification received events (foreground).
 * Returns an unsubscribe function.
 */
export function onNotificationReceived(
  handler: (notification: Notifications.Notification) => void
): () => void {
  if (Platform.OS === "web") return () => {};
  const subscription = Notifications.addNotificationReceivedListener(handler);
  return () => subscription.remove();
}

/**
 * Subscribe to notification response events (user tapped notification).
 * Returns an unsubscribe function.
 */
export function onNotificationTapped(
  handler: (response: Notifications.NotificationResponse) => void
): () => void {
  if (Platform.OS === "web") return () => {};
  const subscription =
    Notifications.addNotificationResponseReceivedListener(handler);
  return () => subscription.remove();
}

/**
 * Get the last notification response (app opened from notification).
 * Returns null on web since the API is not available.
 */
export function getLastNotificationResponse():
  | Notifications.NotificationResponse
  | null
  | undefined {
  if (Platform.OS === "web") {
    // getLastNotificationResponse is not available on web
    return null;
  }
  return Notifications.getLastNotificationResponse();
}

// ─── Badge Management ─────────────────────────────────────────────────────────

/**
 * Set the app badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Badge not supported on all platforms
  }
}

/**
 * Clear the app badge.
 */
export async function clearBadge(): Promise<void> {
  await setBadgeCount(0);
}

// ─── Dismiss Notifications ────────────────────────────────────────────────────

/**
 * Dismiss all delivered notifications from the notification tray.
 */
export async function dismissAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}
