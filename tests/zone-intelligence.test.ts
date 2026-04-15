/**
 * Zone Intelligence System — Unit Tests
 *
 * Tests for:
 *   - lib/zone-boundary.ts  (isInsideZone, getBoundingBox)
 *   - lib/zone-auto-assignment.ts  (isPickupAllowed)
 */
import { describe, it, expect } from "vitest";
import { isInsideZone, getBoundingBox } from "../lib/zone-boundary";
import { isPickupAllowed } from "../lib/zone-auto-assignment";

// ─── zone-boundary ────────────────────────────────────────────────────────────

describe("isInsideZone", () => {
  const bounds = [
    { lat: -15.45, lng: 28.25 },
    { lat: -15.40, lng: 28.25 },
    { lat: -15.40, lng: 28.35 },
    { lat: -15.45, lng: 28.35 },
  ];

  it("returns true for a point inside the bounding box", () => {
    expect(isInsideZone(-15.42, 28.30, bounds)).toBe(true);
  });

  it("returns false for a point outside the bounding box", () => {
    expect(isInsideZone(-15.50, 28.30, bounds)).toBe(false);
    expect(isInsideZone(-15.42, 28.40, bounds)).toBe(false);
  });

  it("returns true for a point exactly on the boundary edge", () => {
    expect(isInsideZone(-15.45, 28.25, bounds)).toBe(true);
    expect(isInsideZone(-15.40, 28.35, bounds)).toBe(true);
  });

  it("returns false when bounds array is empty", () => {
    expect(isInsideZone(-15.42, 28.30, [])).toBe(false);
  });

  it("returns false when bounds array has only one point", () => {
    expect(isInsideZone(-15.42, 28.30, [{ lat: -15.42, lng: 28.30 }])).toBe(false);
  });
});

describe("getBoundingBox", () => {
  it("returns correct min/max for a set of points", () => {
    const bounds = [
      { lat: -15.45, lng: 28.25 },
      { lat: -15.40, lng: 28.35 },
    ];
    const box = getBoundingBox(bounds);
    expect(box).not.toBeNull();
    expect(box!.minLat).toBeCloseTo(-15.45);
    expect(box!.maxLat).toBeCloseTo(-15.40);
    expect(box!.minLng).toBeCloseTo(28.25);
    expect(box!.maxLng).toBeCloseTo(28.35);
  });

  it("returns null for an empty array", () => {
    expect(getBoundingBox([])).toBeNull();
  });
});

// ─── zone-auto-assignment ─────────────────────────────────────────────────────

describe("isPickupAllowed", () => {
  it("returns true when driver zone equals pickup zone", () => {
    expect(isPickupAllowed("zone_001", "zone_001")).toBe(true);
  });

  it("returns false when zones differ", () => {
    expect(isPickupAllowed("zone_001", "zone_002")).toBe(false);
  });

  it("returns false when driver zone is undefined", () => {
    expect(isPickupAllowed(undefined, "zone_001")).toBe(false);
  });

  it("returns false when pickup zone is undefined", () => {
    expect(isPickupAllowed("zone_001", undefined)).toBe(false);
  });

  it("returns false when both are undefined", () => {
    expect(isPickupAllowed(undefined, undefined)).toBe(false);
  });

  it("returns false when either value is an empty string", () => {
    expect(isPickupAllowed("", "zone_001")).toBe(false);
    expect(isPickupAllowed("zone_001", "")).toBe(false);
  });
});
