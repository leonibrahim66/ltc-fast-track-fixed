import { useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import { onNotification, LTCNotificationPayload } from "@/lib/firebase-notifications";

interface UseJobNotificationsOptions {
  registerOnMount?: boolean;
  unreadCount?: number;
}

export function useJobNotifications(options: UseJobNotificationsOptions = {}) {
  const router = useRouter();

  // Listen to Firebase notification taps / foreground dispatches only
  useEffect(() => {
    const unsub = onNotification((payload: LTCNotificationPayload) => {
      handleFirebaseRoute(payload);
    });

    return unsub;
  }, []);

  const handleFirebaseRoute = useCallback(
    (payload: LTCNotificationPayload) => {
      const event = payload.eventType;
      const data = payload.data || {};

      switch (event) {
        case "new_pickup_request":
          router.push("/(collector)/pickups" as any);
          break;

        case "garbage_pickup_scheduled":
        case "driver_arriving":
        case "garbage_pickup_completed":
          router.push("/(tabs)/track-shipment" as any);
          break;

        case "payment_confirmation":
          router.push("/(tabs)/wallet" as any);
          break;

        case "withdrawal_status":
          router.push("/(tabs)/wallet" as any);
          break;

        default:
          break;
      }
    },
    [router]
  );

  // Stub local helper methods so existing app calls don't crash
  const noop = useCallback(async () => {}, []);

  return {
    notifyDriverAssigned: noop,
    notifyDriverAccepted: noop,
    notifyDriverArriving: noop,
    notifyPickupCompleted: noop,
    notifyNewPickupRequest: noop,
    notifyEscalation: noop,
    notifyManualAssignment: noop,
    notifyDriverApproved: noop,
    notifyDriverRejected: noop,
    notifyNewJobAvailable: noop,
    clearNotificationBadge: noop,
  };
}