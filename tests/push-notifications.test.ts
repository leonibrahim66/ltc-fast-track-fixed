/**
 * tests/push-notifications.test.ts
 *
 * Tests for the push notification service and useJobNotifications hook.
 * Validates all notification payloads, web guards, and event routing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock expo-notifications ─────────────────────────────────────────────────
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  scheduleNotificationAsync: vi.fn().mockResolvedValue("notif-id-123"),
  addNotificationReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
  addNotificationResponseReceivedListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
  getLastNotificationResponse: vi.fn().mockReturnValue(null),
  setBadgeCountAsync: vi.fn().mockResolvedValue(undefined),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: "granted" }),
  getExpoPushTokenAsync: vi.fn().mockResolvedValue({ data: "ExponentPushToken[test-token]" }),
  setNotificationChannelAsync: vi.fn().mockResolvedValue(undefined),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
}));

// ─── Mock expo-device ─────────────────────────────────────────────────────────
vi.mock("expo-device", () => ({
  isDevice: true,
}));

// ─── Mock expo-constants ──────────────────────────────────────────────────────
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { extra: { eas: { projectId: "test-project-id" } } },
  },
}));

// ─── Mock AsyncStorage ────────────────────────────────────────────────────────
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── Mock react-native Platform ───────────────────────────────────────────────
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import {
  configureNotificationHandler,
  showLocalNotification,
  onNotificationReceived,
  onNotificationTapped,
  getLastNotificationResponse,
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
} from "@/lib/push-notification-service";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// ─── Notification Payload Tests ───────────────────────────────────────────────

describe("Push Notification Payloads", () => {
  describe("Customer notifications", () => {
    it("builds driver assigned notification with correct fields", () => {
      const notif = buildDriverAssignedNotif({
        pickupId: "pickup-001",
        driverName: "John Doe",
        etaMinutes: 15,
      });
      expect(notif.event).toBe("driver_assigned");
      expect(notif.title).toContain("Driver");
      expect(notif.body).toContain("John Doe");
      expect(notif.body).toContain("15");
      expect(notif.data?.pickupId).toBe("pickup-001");
    });

    it("builds driver accepted notification", () => {
      const notif = buildDriverAcceptedNotif({
        pickupId: "pickup-002",
        driverName: "Jane Smith",
        driverPhone: "+260977000001",
      });
      expect(notif.event).toBe("driver_accepted");
      expect(notif.body).toContain("Jane Smith");
      expect(notif.data?.driverPhone).toBe("+260977000001");
    });

    it("builds driver arriving notification with ETA", () => {
      const notif = buildDriverArrivingNotif({
        pickupId: "pickup-003",
        driverName: "Bob Wilson",
        etaMinutes: 5,
      });
      expect(notif.event).toBe("driver_arriving");
      expect(notif.body).toContain("5");
      expect(notif.body).toContain("Bob Wilson");
    });

    it("builds pickup completed notification", () => {
      const notif = buildPickupCompletedNotif({
        pickupId: "pickup-004",
        driverName: "Alice Brown",
      });
      expect(notif.event).toBe("pickup_completed");
      expect(notif.body).toContain("Alice Brown");
      expect(notif.url).toBeDefined();
    });
  });

  describe("Zone manager notifications", () => {
    it("builds new pickup request notification with zone info", () => {
      const notif = buildNewPickupRequestNotif({
        pickupId: "pickup-005",
        customerName: "Customer A",
        address: "123 Main St, Lusaka",
        zoneName: "Zone North",
      });
      expect(notif.event).toBe("new_pickup_request");
      expect(notif.title).toContain("Pickup");
      expect(notif.body).toContain("Customer A");
      expect(notif.body).toContain("123 Main St");
      expect(notif.data?.zoneName).toBe("Zone North");
    });

    it("builds escalation notification with wait time", () => {
      const notif = buildEscalationNotif({
        pickupId: "pickup-006",
        customerName: "Customer B",
        address: "456 Oak Ave",
        minutesWaiting: 20,
      });
      expect(notif.event).toBe("zone_manager_escalation");
      expect(notif.body).toContain("20");
      expect(notif.body).toContain("Customer B");
    });
  });

  describe("Driver notifications", () => {
    it("builds manual assignment notification from manager", () => {
      const notif = buildManualAssignmentNotif({
        pickupId: "pickup-007",
        customerName: "Customer C",
        address: "789 Pine Rd",
        managerName: "Manager X",
      });
      expect(notif.event).toBe("manual_assignment");
      expect(notif.body).toContain("Manager X");
      expect(notif.body).toContain("Customer C");
      expect(notif.data?.pickupId).toBe("pickup-007");
    });

    it("builds new job available notification with distance", () => {
      const notif = buildNewJobAvailableNotif({
        pickupId: "pickup-008",
        customerName: "Customer D",
        address: "321 Elm St",
        distance: "2.3 km",
      });
      expect(notif.event).toBe("new_pickup_request");
      expect(notif.body).toContain("2.3 km");
      expect(notif.body).toContain("Customer D");
    });

    it("builds driver approved notification", () => {
      const notif = buildDriverApprovedNotif({
        managerName: "Manager Y",
        zoneName: "Zone South",
      });
      expect(notif.event).toBe("driver_approved");
      expect(notif.body).toContain("Manager Y");
      expect(notif.url).toContain("garbage-driver");
    });

    it("builds driver rejected notification with reason", () => {
      const notif = buildDriverRejectedNotif({
        managerName: "Manager Z",
        reason: "Incomplete documents",
      });
      expect(notif.event).toBe("driver_rejected");
      expect(notif.body).toContain("Manager Z");
      expect(notif.body).toContain("Incomplete documents");
    });
  });
});

// ─── Service Function Tests ───────────────────────────────────────────────────

describe("Push Notification Service Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to iOS (non-web)
    (Platform as any).OS = "ios";
  });

  describe("configureNotificationHandler", () => {
    it("sets notification handler on native platforms", () => {
      configureNotificationHandler();
      expect(Notifications.setNotificationHandler).toHaveBeenCalledOnce();
    });

    it("does NOT set notification handler on web", () => {
      (Platform as any).OS = "web";
      configureNotificationHandler();
      expect(Notifications.setNotificationHandler).not.toHaveBeenCalled();
    });
  });

  describe("showLocalNotification", () => {
    it("schedules notification on native platforms", async () => {
      const notif = buildDriverAssignedNotif({
        pickupId: "p1",
        driverName: "Test Driver",
      });
      const id = await showLocalNotification(notif);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledOnce();
      expect(id).toBe("notif-id-123");
    });

    it("returns web-noop on web without scheduling", async () => {
      (Platform as any).OS = "web";
      const notif = buildDriverAssignedNotif({
        pickupId: "p2",
        driverName: "Test Driver",
      });
      const id = await showLocalNotification(notif);
      expect(id).toBe("web-noop");
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe("onNotificationReceived", () => {
    it("subscribes to notifications on native", () => {
      const handler = vi.fn();
      const unsub = onNotificationReceived(handler);
      expect(Notifications.addNotificationReceivedListener).toHaveBeenCalledWith(handler);
      expect(typeof unsub).toBe("function");
    });

    it("returns no-op on web", () => {
      (Platform as any).OS = "web";
      const handler = vi.fn();
      const unsub = onNotificationReceived(handler);
      expect(Notifications.addNotificationReceivedListener).not.toHaveBeenCalled();
      expect(typeof unsub).toBe("function");
      // Calling the no-op should not throw
      expect(() => unsub()).not.toThrow();
    });
  });

  describe("onNotificationTapped", () => {
    it("subscribes to tap events on native", () => {
      const handler = vi.fn();
      const unsub = onNotificationTapped(handler);
      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalledWith(handler);
      expect(typeof unsub).toBe("function");
    });

    it("returns no-op on web", () => {
      (Platform as any).OS = "web";
      const handler = vi.fn();
      const unsub = onNotificationTapped(handler);
      expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
      expect(() => unsub()).not.toThrow();
    });
  });

  describe("getLastNotificationResponse", () => {
    it("calls expo API on native", () => {
      const result = getLastNotificationResponse();
      expect(Notifications.getLastNotificationResponse).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("returns null on web without calling expo API", () => {
      (Platform as any).OS = "web";
      const result = getLastNotificationResponse();
      expect(result).toBeNull();
      expect(Notifications.getLastNotificationResponse).not.toHaveBeenCalled();
    });
  });
});

// ─── End-to-End Workflow Notification Tests ───────────────────────────────────

describe("Notification Workflow Coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Platform as any).OS = "ios";
  });

  it("customer pins pickup → zone manager receives native push", async () => {
    const notif = buildNewPickupRequestNotif({
      pickupId: "pickup-e2e-001",
      customerName: "Alice",
      address: "10 Lusaka Rd",
      zoneName: "Zone A",
    });
    await showLocalNotification(notif);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: expect.stringContaining("Pickup"),
          data: expect.objectContaining({ event: "new_pickup_request" }),
        }),
      })
    );
  });

  it("zone manager assigns driver → driver receives native push", async () => {
    const notif = buildManualAssignmentNotif({
      pickupId: "pickup-e2e-002",
      customerName: "Bob",
      address: "20 Cairo Rd",
      managerName: "Manager Mike",
    });
    await showLocalNotification(notif);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({ event: "manual_assignment" }),
        }),
      })
    );
  });

  it("driver accepts pickup → customer receives native push", async () => {
    const notif = buildDriverAcceptedNotif({
      pickupId: "pickup-e2e-003",
      driverName: "Driver Dave",
    });
    await showLocalNotification(notif);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({ event: "driver_accepted" }),
        }),
      })
    );
  });

  it("driver completes pickup → customer receives native push", async () => {
    const notif = buildPickupCompletedNotif({
      pickupId: "pickup-e2e-004",
      driverName: "Driver Eve",
    });
    await showLocalNotification(notif);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({ event: "pickup_completed" }),
        }),
      })
    );
  });

  it("zone manager approves driver → driver receives native push", async () => {
    const notif = buildDriverApprovedNotif({
      managerName: "Manager Sarah",
      zoneName: "Zone B",
    });
    await showLocalNotification(notif);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({ event: "driver_approved" }),
        }),
      })
    );
  });

  it("zone manager rejects driver → driver receives native push", async () => {
    const notif = buildDriverRejectedNotif({
      managerName: "Manager Tom",
      reason: "Failed background check",
    });
    await showLocalNotification(notif);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({ event: "driver_rejected" }),
        }),
      })
    );
  });

  it("no-driver escalation → zone manager receives escalation push", async () => {
    const notif = buildEscalationNotif({
      pickupId: "pickup-e2e-005",
      customerName: "Carol",
      address: "30 Independence Ave",
      minutesWaiting: 30,
    });
    await showLocalNotification(notif);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: expect.objectContaining({ event: "zone_manager_escalation" }),
        }),
      })
    );
  });

  it("all notification types have required fields", () => {
    const builders = [
      buildDriverAssignedNotif({ pickupId: "p", driverName: "D" }),
      buildDriverAcceptedNotif({ pickupId: "p", driverName: "D" }),
      buildDriverArrivingNotif({ pickupId: "p", driverName: "D", etaMinutes: 5 }),
      buildPickupCompletedNotif({ pickupId: "p", driverName: "D" }),
      buildNewPickupRequestNotif({ pickupId: "p", customerName: "C", address: "A", zoneName: "Z" }),
      buildEscalationNotif({ pickupId: "p", customerName: "C", address: "A", minutesWaiting: 10 }),
      buildManualAssignmentNotif({ pickupId: "p", customerName: "C", address: "A", managerName: "M" }),
      buildDriverApprovedNotif({ managerName: "M" }),
      buildDriverRejectedNotif({ managerName: "M" }),
      buildNewJobAvailableNotif({ pickupId: "p", customerName: "C", address: "A" }),
    ];

    for (const notif of builders) {
      expect(notif).toHaveProperty("event");
      expect(notif).toHaveProperty("title");
      expect(notif).toHaveProperty("body");
      expect(notif.title.length).toBeGreaterThan(0);
      expect(notif.body.length).toBeGreaterThan(0);
    }
  });
});
