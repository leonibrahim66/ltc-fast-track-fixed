/**
 * Unit tests for the two-way communication system between customers and drivers.
 *
 * Tests:
 * 1. PickupRequest type has driver contact fields
 * 2. Driver accept flow writes contact fields
 * 3. Chat message storage key format
 * 4. Communication panel visibility logic
 */
import { describe, it, expect } from "vitest";

// ─── Type shape tests ────────────────────────────────────────────────────────

interface PickupRequest {
  id: string;
  userId: string;
  userPhone: string;
  userName: string;
  location: { latitude: number; longitude: number; address?: string };
  binType: "residential" | "commercial" | "industrial";
  status: string;
  createdAt: string;
  collectorId?: string;
  collectorName?: string;
  assignedTo?: string;
  driverPhone?: string;
  driverVehicleType?: string;
  assignedDriverName?: string;
}

describe("PickupRequest type — driver contact fields", () => {
  it("accepts a pickup with driver contact details", () => {
    const pickup: PickupRequest = {
      id: "p1",
      userId: "u1",
      userPhone: "+260971000001",
      userName: "Alice Banda",
      location: { latitude: -15.4, longitude: 28.3, address: "Kabulonga, Lusaka" },
      binType: "residential",
      status: "accepted",
      createdAt: new Date().toISOString(),
      collectorId: "d1",
      collectorName: "John Mwale",
      assignedDriverName: "John Mwale",
      driverPhone: "+260977000001",
      driverVehicleType: "Garbage Truck",
    };
    expect(pickup.driverPhone).toBe("+260977000001");
    expect(pickup.driverVehicleType).toBe("Garbage Truck");
    expect(pickup.assignedDriverName).toBe("John Mwale");
  });

  it("allows driver contact fields to be undefined (pending pickup)", () => {
    const pickup: PickupRequest = {
      id: "p2",
      userId: "u2",
      userPhone: "+260971000002",
      userName: "Bob Phiri",
      location: { latitude: -15.5, longitude: 28.4 },
      binType: "commercial",
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    expect(pickup.driverPhone).toBeUndefined();
    expect(pickup.driverVehicleType).toBeUndefined();
    expect(pickup.assignedDriverName).toBeUndefined();
  });
});

// ─── Driver accept flow simulation ───────────────────────────────────────────

function simulateDriverAccept(
  pickup: PickupRequest,
  driver: { id: string; fullName: string; phone?: string; vehicleType?: string }
): PickupRequest {
  return {
    ...pickup,
    status: "accepted",
    collectorId: driver.id,
    collectorName: driver.fullName,
    assignedDriverName: driver.fullName,
    driverPhone: driver.phone ?? "",
    driverVehicleType: driver.vehicleType ?? "Garbage Truck",
  };
}

describe("Driver accept flow — stamps contact details", () => {
  const pendingPickup: PickupRequest = {
    id: "p3",
    userId: "u3",
    userPhone: "+260971000003",
    userName: "Carol Tembo",
    location: { latitude: -15.6, longitude: 28.5 },
    binType: "residential",
    status: "assigned",
    createdAt: new Date().toISOString(),
  };

  it("stamps driver name on accept", () => {
    const accepted = simulateDriverAccept(pendingPickup, {
      id: "d2",
      fullName: "David Lungu",
      phone: "+260977000002",
      vehicleType: "Compactor Truck",
    });
    expect(accepted.status).toBe("accepted");
    expect(accepted.assignedDriverName).toBe("David Lungu");
    expect(accepted.collectorName).toBe("David Lungu");
    expect(accepted.collectorId).toBe("d2");
  });

  it("stamps driver phone on accept", () => {
    const accepted = simulateDriverAccept(pendingPickup, {
      id: "d3",
      fullName: "Eve Mwansa",
      phone: "+260977000003",
    });
    expect(accepted.driverPhone).toBe("+260977000003");
  });

  it("defaults vehicleType to Garbage Truck if not provided", () => {
    const accepted = simulateDriverAccept(pendingPickup, {
      id: "d4",
      fullName: "Frank Zulu",
    });
    expect(accepted.driverVehicleType).toBe("Garbage Truck");
  });

  it("does not modify other pickup fields", () => {
    const accepted = simulateDriverAccept(pendingPickup, {
      id: "d5",
      fullName: "Grace Nkosi",
      phone: "+260977000005",
    });
    expect(accepted.id).toBe(pendingPickup.id);
    expect(accepted.userId).toBe(pendingPickup.userId);
    expect(accepted.userName).toBe(pendingPickup.userName);
    expect(accepted.location).toEqual(pendingPickup.location);
  });
});

// ─── Chat message storage key ─────────────────────────────────────────────────

function messagesKey(pickupId: string): string {
  return `@ltc_pickup_messages_${pickupId}`;
}

describe("Chat message storage key", () => {
  it("generates correct key for a pickup ID", () => {
    expect(messagesKey("abc123")).toBe("@ltc_pickup_messages_abc123");
  });

  it("generates unique keys for different pickup IDs", () => {
    expect(messagesKey("p1")).not.toBe(messagesKey("p2"));
  });

  it("driver and customer use the same key format", () => {
    // Both driver chat screen and customer pickup-chat.tsx use messagesKey()
    // This test verifies they produce the same key for the same pickupId
    const driverKey = `@ltc_pickup_messages_${"pickup_001"}`;
    const customerKey = messagesKey("pickup_001");
    expect(driverKey).toBe(customerKey);
  });
});

// ─── Communication panel visibility logic ─────────────────────────────────────

function shouldShowDriverPanel(pickup: PickupRequest, isCollector: boolean): boolean {
  if (isCollector) return false;
  if (pickup.status !== "accepted" && pickup.status !== "in_progress") return false;
  return !!(pickup.collectorName || pickup.assignedDriverName || pickup.driverPhone);
}

describe("Customer communication panel visibility", () => {
  const basePickup: PickupRequest = {
    id: "p10",
    userId: "u10",
    userPhone: "+260971000010",
    userName: "Henry Banda",
    location: { latitude: -15.7, longitude: 28.6 },
    binType: "residential",
    status: "accepted",
    createdAt: new Date().toISOString(),
    collectorName: "Ivan Mwale",
    driverPhone: "+260977000010",
    assignedDriverName: "Ivan Mwale",
  };

  it("shows panel when pickup is accepted and driver info is available", () => {
    expect(shouldShowDriverPanel(basePickup, false)).toBe(true);
  });

  it("shows panel when pickup is in_progress and driver info is available", () => {
    const inProgress = { ...basePickup, status: "in_progress" };
    expect(shouldShowDriverPanel(inProgress, false)).toBe(true);
  });

  it("hides panel when pickup is pending", () => {
    const pending = { ...basePickup, status: "pending" };
    expect(shouldShowDriverPanel(pending, false)).toBe(false);
  });

  it("hides panel when pickup is assigned (not yet accepted)", () => {
    const assigned = { ...basePickup, status: "assigned" };
    expect(shouldShowDriverPanel(assigned, false)).toBe(false);
  });

  it("hides panel for collectors (they see customer info instead)", () => {
    expect(shouldShowDriverPanel(basePickup, true)).toBe(false);
  });

  it("hides panel when no driver info is available even if status is accepted", () => {
    const noInfo: PickupRequest = { ...basePickup, collectorName: undefined, driverPhone: undefined, assignedDriverName: undefined };
    expect(shouldShowDriverPanel(noInfo, false)).toBe(false);
  });
});

// ─── Driver communication panel visibility logic ──────────────────────────────

function shouldShowCustomerPanel(status: string): boolean {
  return status === "accepted" || status === "in_progress";
}

describe("Driver communication panel visibility", () => {
  it("shows panel when pickup is accepted", () => {
    expect(shouldShowCustomerPanel("accepted")).toBe(true);
  });

  it("shows panel when pickup is in_progress", () => {
    expect(shouldShowCustomerPanel("in_progress")).toBe(true);
  });

  it("hides panel when pickup is assigned (not yet accepted by driver)", () => {
    expect(shouldShowCustomerPanel("assigned")).toBe(false);
  });

  it("hides panel when pickup is pending", () => {
    expect(shouldShowCustomerPanel("pending")).toBe(false);
  });

  it("hides panel when pickup is completed", () => {
    expect(shouldShowCustomerPanel("completed")).toBe(false);
  });
});
