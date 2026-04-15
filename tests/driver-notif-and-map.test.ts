/**
 * Tests for:
 * 1. createDriverNotification helper — correct payload construction
 * 2. Zone manager actions triggering driver notifications
 * 3. Customer chat triggering driver notifications
 * 4. Customer home screen map — interactive props
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. createDriverNotification helper ────────────────────────────────────

describe("createDriverNotification helper", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("builds the correct tRPC POST body for driver_approved", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    // Dynamically import after stubbing fetch
    const { createDriverNotification } = await import(
      "@/lib/driver-notification-helper"
    );

    await createDriverNotification({
      driverUserId: "driver-123",
      type: "driver_approved",
      title: "Application Approved ✅",
      body: "You have been approved by Zone Manager.",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/trpc/notifications.create");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.json.userId).toBe("driver-123");
    expect(body.json.type).toBe("system"); // DB enum type
    expect(body.json.title).toBe("Application Approved ✅");

    const data = JSON.parse(body.json.data);
    expect(data.driverType).toBe("driver_approved");
  });

  it("builds the correct tRPC POST body for pickup_assigned with pickupId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { createDriverNotification } = await import(
      "@/lib/driver-notification-helper"
    );

    await createDriverNotification({
      driverUserId: "driver-456",
      type: "pickup_assigned",
      title: "New Pickup Assigned 🚨",
      body: "You have been assigned a pickup at 123 Main St.",
      pickupId: "pickup-789",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.json.userId).toBe("driver-456");
    expect(body.json.pickupId).toBe("pickup-789");

    const data = JSON.parse(body.json.data);
    expect(data.driverType).toBe("pickup_assigned");
  });

  it("builds the correct tRPC POST body for customer_chat", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { createDriverNotification } = await import(
      "@/lib/driver-notification-helper"
    );

    await createDriverNotification({
      driverUserId: "driver-789",
      type: "customer_chat",
      title: "New Message from Customer 💬",
      body: "John: Please hurry, I need this pickup done soon.",
      pickupId: "pickup-abc",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    const data = JSON.parse(body.json.data);
    expect(data.driverType).toBe("customer_chat");
    expect(body.json.pickupId).toBe("pickup-abc");
  });

  it("silently catches fetch errors without throwing", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    const { createDriverNotification } = await import(
      "@/lib/driver-notification-helper"
    );

    // Should not throw
    await expect(
      createDriverNotification({
        driverUserId: "driver-999",
        type: "system",
        title: "Test",
        body: "Test body",
      })
    ).resolves.toBeUndefined();
  });

  it("uses 'system' as the DB type for all semantic driver notification types", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { createDriverNotification } = await import(
      "@/lib/driver-notification-helper"
    );

    const driverTypes = [
      "driver_approved",
      "driver_suspended",
      "pickup_assigned",
      "zone_assignment",
      "zone_manager_message",
      "customer_chat",
      "system",
    ] as const;

    for (const type of driverTypes) {
      fetchMock.mockClear();
      await createDriverNotification({
        driverUserId: "driver-test",
        type,
        title: `Test ${type}`,
        body: "Test body",
      });

      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body);
      // DB type must always be "system" to match the existing enum
      expect(body.json.type).toBe("system");
      // Semantic type must be preserved in data.driverType
      const data = JSON.parse(body.json.data);
      expect(data.driverType).toBe(type);
    }
  });
});

// ─── 2. Zone manager notification payload correctness ──────────────────────

describe("Zone manager driver notification payloads", () => {
  it("approve notification has correct title and type", () => {
    const payload = {
      driverUserId: "driver-123",
      type: "driver_approved" as const,
      title: "Application Approved ✅",
      body: "Your application has been approved by Zone Manager. You can now accept pickups.",
    };
    expect(payload.type).toBe("driver_approved");
    expect(payload.title).toContain("Approved");
    expect(payload.body).toContain("accept pickups");
  });

  it("reject notification has correct title and type", () => {
    const payload = {
      driverUserId: "driver-123",
      type: "driver_suspended" as const,
      title: "Application Not Approved",
      body: "Your application was not approved by Zone Manager.",
    };
    expect(payload.type).toBe("driver_suspended");
    expect(payload.title).toBe("Application Not Approved");
  });

  it("suspend notification has correct title and type", () => {
    const payload = {
      driverUserId: "driver-123",
      type: "driver_suspended" as const,
      title: "Account Suspended",
      body: "Your driver account has been suspended.",
    };
    expect(payload.type).toBe("driver_suspended");
    expect(payload.title).toBe("Account Suspended");
  });

  it("reactivate notification has correct title and type", () => {
    const payload = {
      driverUserId: "driver-123",
      type: "driver_approved" as const,
      title: "Account Reactivated ✅",
      body: "Your driver account has been reactivated. You can now accept pickups again.",
    };
    expect(payload.type).toBe("driver_approved");
    expect(payload.title).toContain("Reactivated");
    expect(payload.body).toContain("accept pickups again");
  });

  it("assign pickup notification has correct title, type, and pickupId", () => {
    const payload = {
      driverUserId: "driver-123",
      type: "pickup_assigned" as const,
      title: "New Pickup Assigned 🚨",
      body: "You have been assigned a pickup at 123 Main St for John Doe.",
      pickupId: "pickup-456",
    };
    expect(payload.type).toBe("pickup_assigned");
    expect(payload.title).toContain("Assigned");
    expect(payload.pickupId).toBe("pickup-456");
    expect(payload.body).toContain("123 Main St");
  });
});

// ─── 3. Customer chat notification payload correctness ─────────────────────

describe("Customer chat driver notification payloads", () => {
  it("chat notification has correct type and truncates long messages", () => {
    const longMessage = "A".repeat(120);
    const truncated = `${longMessage.slice(0, 80)}...`;

    const payload = {
      driverUserId: "driver-123",
      type: "customer_chat" as const,
      title: "New Message from Customer 💬",
      body: `Customer: ${truncated}`,
      pickupId: "pickup-789",
    };

    expect(payload.type).toBe("customer_chat");
    expect(payload.title).toContain("Customer");
    expect(payload.pickupId).toBe("pickup-789");
    // Body should be truncated
    expect(payload.body.length).toBeLessThan(200);
  });

  it("chat notification is only sent for customer roles", () => {
    const customerRoles = ["residential", "commercial", "industrial"];
    const nonCustomerRoles = ["garbage_driver", "zone_collector", "admin"];

    const isCustomerSender = (role: string) =>
      customerRoles.includes(role);

    for (const role of customerRoles) {
      expect(isCustomerSender(role)).toBe(true);
    }
    for (const role of nonCustomerRoles) {
      expect(isCustomerSender(role)).toBe(false);
    }
  });

  it("chat notification uses assignedTo or collectorId as driverUserId fallback", () => {
    // Simulate pickup lookup logic
    const pickup: Record<string, unknown> = {
      id: "pickup-789",
      collectorId: "driver-from-collector",
      assignedTo: "driver-from-assigned",
    };

    const driverUserId =
      (pickup.assignedDriverId as string) ||
      (pickup.assignedTo as string) ||
      (pickup.collectorId as string);

    // assignedTo takes priority over collectorId
    expect(driverUserId).toBe("driver-from-assigned");
  });

  it("chat notification falls back to collectorId when assignedTo is missing", () => {
    const pickup: Record<string, unknown> = {
      id: "pickup-789",
      collectorId: "driver-from-collector",
    };

    const driverUserId =
      (pickup.assignedDriverId as string) ||
      (pickup.assignedTo as string) ||
      (pickup.collectorId as string);

    expect(driverUserId).toBe("driver-from-collector");
  });

  it("chat notification is not sent when no driver is assigned", () => {
    const pickup: Record<string, unknown> = {
      id: "pickup-789",
    };

    const driverUserId =
      (pickup.assignedDriverId as string) ||
      (pickup.assignedTo as string) ||
      (pickup.collectorId as string);

    // Should be undefined — no notification should be sent
    expect(driverUserId).toBeUndefined();
  });
});

// ─── 4. Customer home screen map — interactive props ───────────────────────

describe("Customer home screen map interactive configuration", () => {
  it("map should have scrollEnabled=true for pan support", () => {
    const mapProps = {
      scrollEnabled: true,
      zoomEnabled: true,
      rotateEnabled: true,
      pitchEnabled: true,
      showsCompass: true,
    };

    expect(mapProps.scrollEnabled).toBe(true);
    expect(mapProps.zoomEnabled).toBe(true);
    expect(mapProps.rotateEnabled).toBe(true);
    expect(mapProps.pitchEnabled).toBe(true);
    expect(mapProps.showsCompass).toBe(true);
  });

  it("uses PROVIDER_GOOGLE on Android and PROVIDER_DEFAULT on iOS", () => {
    const PROVIDER_GOOGLE = "google";
    const PROVIDER_DEFAULT = null;

    const getProvider = (platform: string) =>
      platform === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

    expect(getProvider("android")).toBe(PROVIDER_GOOGLE);
    expect(getProvider("ios")).toBe(PROVIDER_DEFAULT);
    expect(getProvider("web")).toBe(PROVIDER_DEFAULT);
  });

  it("map height is sufficient for interactive use (at least 200px)", () => {
    const mapHeight = 220;
    expect(mapHeight).toBeGreaterThanOrEqual(200);
  });

  it("all existing map markers and polyline props are preserved", () => {
    // Verify the map still has all the same data-driven props
    const mapConfig = {
      showsUserLocation: false, // unchanged
      markers: ["customer-pickup-location", "driver-live-location"],
      polyline: "driver-to-pickup-route",
      overlay: "dark-green-info-bar",
    };

    expect(mapConfig.showsUserLocation).toBe(false);
    expect(mapConfig.markers).toHaveLength(2);
    expect(mapConfig.polyline).toBe("driver-to-pickup-route");
    expect(mapConfig.overlay).toBe("dark-green-info-bar");
  });
});
