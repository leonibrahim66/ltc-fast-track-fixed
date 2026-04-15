/**
 * Zone Boundary Validation — Unit Tests
 *
 * Tests the logic added to:
 *   - zone-create.tsx / zone-edit.tsx  (boundary point count guard + getBoundingBox guard)
 *   - lib/zone-boundary.ts             (isInsideZone, getBoundingBox)
 */
import { describe, it, expect } from "vitest";
import { isInsideZone, getBoundingBox } from "../lib/zone-boundary";

// ─── getBoundingBox ───────────────────────────────────────────────────────────

describe("getBoundingBox", () => {
  it("returns null for empty array", () => {
    expect(getBoundingBox([])).toBeNull();
  });

  it("returns a valid box for a single point", () => {
    const box = getBoundingBox([{ lat: -15.4, lng: 28.3 }]);
    expect(box).not.toBeNull();
    expect(box!.minLat).toBe(-15.4);
    expect(box!.maxLat).toBe(-15.4);
  });

  it("returns correct min/max for multiple points", () => {
    const points = [
      { lat: -15.4, lng: 28.2 },
      { lat: -15.5, lng: 28.4 },
      { lat: -15.3, lng: 28.3 },
    ];
    const box = getBoundingBox(points);
    expect(box).not.toBeNull();
    expect(box!.minLat).toBe(-15.5);
    expect(box!.maxLat).toBe(-15.3);
    expect(box!.minLng).toBe(28.2);
    expect(box!.maxLng).toBe(28.4);
  });
});

// ─── isInsideZone ─────────────────────────────────────────────────────────────

describe("isInsideZone", () => {
  const lusaka = [
    { lat: -15.5, lng: 28.2 },
    { lat: -15.3, lng: 28.2 },
    { lat: -15.3, lng: 28.5 },
    { lat: -15.5, lng: 28.5 },
  ];

  it("returns true for a point inside the bounding box", () => {
    expect(isInsideZone(-15.4, 28.35, lusaka)).toBe(true);
  });

  it("returns false for a point north of the bounding box", () => {
    expect(isInsideZone(-15.1, 28.35, lusaka)).toBe(false);
  });

  it("returns false for a point south of the bounding box", () => {
    expect(isInsideZone(-15.7, 28.35, lusaka)).toBe(false);
  });

  it("returns false for a point west of the bounding box", () => {
    expect(isInsideZone(-15.4, 28.0, lusaka)).toBe(false);
  });

  it("returns false for a point east of the bounding box", () => {
    expect(isInsideZone(-15.4, 28.7, lusaka)).toBe(false);
  });

  it("returns false for empty boundary array", () => {
    expect(isInsideZone(-15.4, 28.35, [])).toBe(false);
  });

  it("returns false for a single-point boundary (< 2 points)", () => {
    expect(isInsideZone(-15.4, 28.35, [{ lat: -15.4, lng: 28.35 }])).toBe(false);
  });

  it("returns true for a point exactly on the boundary edge", () => {
    expect(isInsideZone(-15.5, 28.2, lusaka)).toBe(true);
  });
});

// ─── Boundary validation logic (mirrors zone-create / zone-edit guard) ────────

describe("Boundary validation guard (zone-create / zone-edit logic)", () => {
  function validateBoundaries(parsed: any): { valid: boolean; reason?: string } {
    if (parsed === undefined) return { valid: true }; // no boundaries provided — OK
    if (!Array.isArray(parsed) || parsed.length < 3) {
      return { valid: false, reason: "at_least_3_points" };
    }
    const box = getBoundingBox(parsed);
    if (!box) {
      return { valid: false, reason: "no_bounding_box" };
    }
    return { valid: true };
  }

  it("passes when no boundaries are provided", () => {
    expect(validateBoundaries(undefined).valid).toBe(true);
  });

  it("fails when fewer than 3 points are provided", () => {
    const result = validateBoundaries([{ lat: -15.4, lng: 28.3 }, { lat: -15.5, lng: 28.4 }]);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("at_least_3_points");
  });

  it("fails when boundaries is not an array", () => {
    const result = validateBoundaries("not-an-array");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("at_least_3_points");
  });

  it("passes when 3 or more valid points are provided", () => {
    const points = [
      { lat: -15.4, lng: 28.2 },
      { lat: -15.5, lng: 28.4 },
      { lat: -15.3, lng: 28.3 },
    ];
    expect(validateBoundaries(points).valid).toBe(true);
  });
});
