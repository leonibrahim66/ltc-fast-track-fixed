/**
 * hooks/use-job-notifications.ts
 *
 * Unified hook for job-related push notifications in LTC Fast Track.
 *
 * Responsibilities:
 * 1. Register device for push notifications on mount
 * 2. Listen for notification taps and deep-link to the correct screen
 * 3. Expose helpers to trigger local notifications for each job event
 * 4. Sync badge count with unread notification count
 *
 * Usage:
 *   // In root layout (app/_layout.tsx) — registers once:
 *   useJobNotifications({ registerOnMount: true });
 *
 *   // In any screen — to send a notification:
 *   const { notifyDriverAssigned } = useJobNotifications();
 *   await notifyDriverAssigned({ pickupId, driverName });
 */

import { useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import {
  registerForPushNotificationsAsync,
  configureNotificationHandler,
  showLocalNotification,
  buildDriverAssignedNotif,
  buildDriverAcceptedNotif,
  buildDriverArrivingNotif,
  buildPickupCompletedNotif,
  buildNewPickupRequestNotif,
  buildEscalationNotif,
  buildManualAssignmentNotif,
  buildDriverApprovedNotif,
  buildDriverRejectedNotif,
  buildNewJobAvailableNotif,
  onNotificationTapped,
  getLastNotificationResponse,
  setBadgeCount,
  clearBadge,
} from "@/lib/push-notification-service";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PUSH_TOKEN_STORAGE_KEY = "@ltc_expo_push_token";

interface UseJobNotificationsOptions {
  /** If true, registers for push notifications on mount. Use in root layout only. */
  registerOnMount?: boolean;
  /** Current unread notification count — syncs to badge. */
  unreadCount?: number;
}

export function useJobNotifications(options: UseJobNotificationsOptions = {}) {
  const { registerOnMount = false, unreadCount } = options;
  const router = useRouter();
  const registeredRef = useRef(false);

  // ─── Configure handler once ──────────────────────────────────────────────
  useEffect(() => {
    configureNotificationHandler();
  }, []);

  // ─── Register for push notifications ────────────────────────────────────
  useEffect(() => {
    if (!registerOnMount || registeredRef.current) return;
    if (Platform.OS === "web") return;

    registeredRef.current = true;

    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) {
          // Store token for server-side push delivery
          AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token).catch(() => {});
        }
      })
      .catch((err) => {
        console.warn("[useJobNotifications] Registration failed:", err);
      });
  }, [registerOnMount]);

  // ─── Handle notification taps (deep linking) ─────────────────────────────
  useEffect(() => {
    // Handle notification that opened the app from closed state
    const lastResponse = getLastNotificationResponse();
    if (lastResponse?.notification) {
      handleNotificationTap(lastResponse.notification);
    }

    // Handle notification taps while app is running
    const unsub = onNotificationTapped((response) => {
      handleNotificationTap(response.notification);
    });

    return unsub;
  }, []);

  // ─── Sync badge count ────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (unreadCount !== undefined) {
      setBadgeCount(unreadCount).catch(() => {});
    }
  }, [unreadCount]);

  // ─── Deep link handler ───────────────────────────────────────────────────
  const handleNotificationTap = useCallback(
    (notification: Notifications.Notification) => {
      const data = notification.request.content.data as Record<string, string>;
      const url = data?.url;
      const event = data?.event;

      if (url && typeof url === "string") {
        try {
          router.push(url as any);
        } catch {
          // Navigation not ready yet — ignore
        }
        return;
      }

      // Fallback routing by event type
      if (event) {
        switch (event) {
          case "new_pickup_request":
          case "zone_manager_escalation":
            router.push("/(collector)/pickups" as any);
            break;
          case "driver_assigned":
          case "driver_accepted":
          case "driver_arriving":
          case "pickup_completed":
            router.push("/(tabs)/track-shipment" as any);
            break;
          case "manual_assignment":
            router.push("/(garbage-driver)" as any);
            break;
          case "driver_approved":
            router.push("/(garbage-driver)" as any);
            break;
          case "driver_rejected":
            router.push("/(auth)/register-garbage-driver" as any);
            break;
          case "payment_confirmed":
            router.push("/(tabs)/profile" as any);
            break;
        }
      }
    },
    [router]
  );

  // ─── Notification Trigger Helpers ────────────────────────────────────────

  /** Notify customer that a driver has been assigned to their pickup. */
  const notifyDriverAssigned = useCallback(
    async (params: { pickupId: string; driverName: string; etaMinutes?: number }) => {
      await showLocalNotification(buildDriverAssignedNotif(params));
    },
    []
  );

  /** Notify customer that the driver has accepted and is on the way. */
  const notifyDriverAccepted = useCallback(
    async (params: { pickupId: string; driverName: string; driverPhone?: string }) => {
      await showLocalNotification(buildDriverAcceptedNotif(params));
    },
    []
  );

  /** Notify customer that the driver is arriving. */
  const notifyDriverArriving = useCallback(
    async (params: { pickupId: string; driverName: string; etaMinutes: number }) => {
      await showLocalNotification(buildDriverArrivingNotif(params));
    },
    []
  );

  /** Notify customer that their pickup has been completed. */
  const notifyPickupCompleted = useCallback(
    async (params: { pickupId: string; driverName: string }) => {
      await showLocalNotification(buildPickupCompletedNotif(params));
    },
    []
  );

  /** Notify zone manager of a new pickup request in their zone. */
  const notifyNewPickupRequest = useCallback(
    async (params: {
      pickupId: string;
      customerName: string;
      address: string;
      zoneName: string;
    }) => {
      await showLocalNotification(buildNewPickupRequestNotif(params));
    },
    []
  );

  /** Notify zone manager that escalation is needed (no driver accepted). */
  const notifyEscalation = useCallback(
    async (params: {
      pickupId: string;
      customerName: string;
      address: string;
      minutesWaiting: number;
    }) => {
      await showLocalNotification(buildEscalationNotif(params));
    },
    []
  );

  /** Notify driver of a manual assignment from zone manager. */
  const notifyManualAssignment = useCallback(
    async (params: {
      pickupId: string;
      customerName: string;
      address: string;
      managerName: string;
    }) => {
      await showLocalNotification(buildManualAssignmentNotif(params));
    },
    []
  );

  /** Notify driver that their application has been approved. */
  const notifyDriverApproved = useCallback(
    async (params: { managerName: string; zoneName?: string }) => {
      await showLocalNotification(buildDriverApprovedNotif(params));
    },
    []
  );

  /** Notify driver that their application has been rejected. */
  const notifyDriverRejected = useCallback(
    async (params: { managerName: string; reason?: string }) => {
      await showLocalNotification(buildDriverRejectedNotif(params));
    },
    []
  );

  /** Notify driver that a new job is available in their zone. */
  const notifyNewJobAvailable = useCallback(
    async (params: {
      pickupId: string;
      customerName: string;
      address: string;
      distance?: string;
    }) => {
      await showLocalNotification(buildNewJobAvailableNotif(params));
    },
    []
  );

  /** Clear the app badge count. */
  const clearNotificationBadge = useCallback(async () => {
    await clearBadge();
  }, []);

  return {
    // Notification triggers
    notifyDriverAssigned,
    notifyDriverAccepted,
    notifyDriverArriving,
    notifyPickupCompleted,
    notifyNewPickupRequest,
    notifyEscalation,
    notifyManualAssignment,
    notifyDriverApproved,
    notifyDriverRejected,
    notifyNewJobAvailable,
    clearNotificationBadge,
  };
}
