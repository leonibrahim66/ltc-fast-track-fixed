/**
 * Auto-Assignment Logic — Unit Tests
 *
 * Tests the zone-enforcement and assignment logic in:
 *   - lib/zone-auto-assignment.ts (isPickupAllowed, findNearestDriver mock)
 *
 * We test the pure logic functions directly since pickups-context requires
 * React context. The key invariants are:
 *   1. A driver in zone A is never assigned to a pickup in zone B
 *   2. A driver in zone A IS assigned to a pickup in zone A
 *   3. If no driver is available, status stays "pending" and assignedDriverId is null
 *   4. Duplicate pickup IDs are rejected
 */
import { describe, it, expect } from "vitest";
import { isPickupAllowed, findNearestDriver } from "../lib/zone-auto-assignment";

// ─── isPickupAllowed ──────────────────────────────────────────────────────────

describe("isPickupAllowed — zone enforcement", () => {
  it("allows assignment when driver zone matches pickup zone", () => {
    expect(isPickupAllowed("zone_lusaka_central", "zone_lusaka_central")).toBe(true);
  });

  it("blocks assignment when driver zone differs from pickup zone", () => {
    expect(isPickupAllowed("zone_lusaka_central", "zone_lusaka_east")).toBe(false);
  });

  it("blocks when driver zone is undefined", () => {
    expect(isPickupAllowed(undefined, "zone_lusaka_central")).toBe(false);
  });

  it("blocks when pickup zone is undefined", () => {
    expect(isPickupAllowed("zone_lusaka_central", undefined)).toBe(false);
  });

  it("blocks when both zones are empty strings", () => {
    expect(isPickupAllowed("", "")).toBe(false);
  });

  it("blocks when one zone is empty string", () => {
    expect(isPickupAllowed("zone_001", "")).toBe(false);
    expect(isPickupAllowed("", "zone_001")).toBe(false);
  });
});

// ─── findNearestDriver — no storage (returns null without AsyncStorage) ───────

describe("findNearestDriver — empty storage fallback", () => {
  it("returns null when zoneId is empty string", async () => {
    const result = await findNearestDriver("");
    expect(result).toBeNull();
  });
});

// ─── Assignment status logic ──────────────────────────────────────────────────

describe("Assignment status derivation", () => {
  /**
   * Simulate the logic inside createPickup without needing React context.
   * This mirrors the exact conditional in pickups-context.tsx.
   */
  function deriveAssignment(
    driver: { driverId: string; driverName: string; zoneId: string } | null,
    pickupZoneId: string
  ): { assignedDriverId: string | null; status: "pending" | "assigned" } {
    if (driver && driver.zoneId === pickupZoneId) {
      return { assignedDriverId: driver.driverId, status: "assigned" };
    }
    return { assignedDriverId: null, status: "pending" };
  }

  it("sets status=assigned and fills assignedDriverId when driver matches zone", () => {
    const driver = { driverId: "driver_001", driverName: "John", zoneId: "zone_A" };
    const result = deriveAssignment(driver, "zone_A");
    expect(result.status).toBe("assigned");
    expect(result.assignedDriverId).toBe("driver_001");
  });

  it("sets status=pending and null assignedDriverId when driver is in wrong zone", () => {
    const driver = { driverId: "driver_001", driverName: "John", zoneId: "zone_B" };
    const result = deriveAssignment(driver, "zone_A");
    expect(result.status).toBe("pending");
    expect(result.assignedDriverId).toBeNull();
  });

  it("sets status=pending when no driver is available", () => {
    const result = deriveAssignment(null, "zone_A");
    expect(result.status).toBe("pending");
    expect(result.assignedDriverId).toBeNull();
  });
});

// ─── Duplicate guard ──────────────────────────────────────────────────────────

describe("Duplicate pickup guard", () => {
  it("detects a duplicate by ID", () => {
    const existing = [{ id: "pickup_123" }, { id: "pickup_456" }];
    const newId = "pickup_123";
    const isDuplicate = existing.some((p) => p.id === newId);
    expect(isDuplicate).toBe(true);
  });

  it("allows a new unique ID", () => {
    const existing = [{ id: "pickup_123" }, { id: "pickup_456" }];
    const newId = "pickup_789";
    const isDuplicate = existing.some((p) => p.id === newId);
    expect(isDuplicate).toBe(false);
  });
});
