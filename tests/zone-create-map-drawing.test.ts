/**
 * Zone Create — Map Drawing Logic Tests
 *
 * Tests the pure logic functions used by zone-create.tsx:
 *   - Point accumulation (addPoint, undoLastPoint, clearDrawing)
 *   - Sync from drawn points to JSON boundaries string
 *   - Boundary validation guard (≥ 3 points required)
 */
import { describe, it, expect } from "vitest";
import { getBoundingBox } from "../lib/zone-boundary";

// ─── Helpers that mirror the component's logic ────────────────────────────────

type DrawnPoint = { latitude: number; longitude: number };

function addPoint(points: DrawnPoint[], coordinate: DrawnPoint): DrawnPoint[] {
  return [...points, coordinate];
}

function undoLastPoint(points: DrawnPoint[]): DrawnPoint[] {
  return points.slice(0, -1);
}

function clearDrawing(): DrawnPoint[] {
  return [];
}

function syncToBoundariesJSON(points: DrawnPoint[]): string {
  if (points.length === 0) return "";
  const asZoneBoundaries = points.map((p) => ({ lat: p.latitude, lng: p.longitude }));
  return JSON.stringify(asZoneBoundaries);
}

function validateBeforeSave(boundaries: string): { valid: boolean; reason?: string } {
  if (!boundaries.trim()) return { valid: true }; // no boundaries — OK
  let parsed: any;
  try {
    parsed = JSON.parse(boundaries);
  } catch (_e) {
    return { valid: false, reason: "invalid_json" };
  }
  if (!Array.isArray(parsed) || parsed.length < 3) {
    return { valid: false, reason: "at_least_3_points" };
  }
  const box = getBoundingBox(parsed);
  if (!box) {
    return { valid: false, reason: "no_bounding_box" };
  }
  return { valid: true };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Map drawing — point management", () => {
  it("adds a point to an empty array", () => {
    const result = addPoint([], { latitude: -15.4, longitude: 28.3 });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ latitude: -15.4, longitude: 28.3 });
  });

  it("adds multiple points without mutating the original array", () => {
    const original: DrawnPoint[] = [{ latitude: -15.4, longitude: 28.3 }];
    const result = addPoint(original, { latitude: -15.5, longitude: 28.4 });
    expect(result).toHaveLength(2);
    expect(original).toHaveLength(1); // original unchanged
  });

  it("undoes the last point", () => {
    const points: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
    ];
    const result = undoLastPoint(points);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ latitude: -15.4, longitude: 28.3 });
  });

  it("undo on empty array returns empty array (no crash)", () => {
    expect(undoLastPoint([])).toHaveLength(0);
  });

  it("clears all points", () => {
    const points: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
      { latitude: -15.3, longitude: 28.2 },
    ];
    expect(clearDrawing()).toHaveLength(0);
    expect(points).toHaveLength(3); // original unchanged
  });
});

describe("Map drawing — JSON sync", () => {
  it("returns empty string when no points", () => {
    expect(syncToBoundariesJSON([])).toBe("");
  });

  it("converts drawn points to {lat, lng} JSON", () => {
    const points: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
    ];
    const json = syncToBoundariesJSON(points);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ lat: -15.4, lng: 28.3 });
    expect(parsed[1]).toEqual({ lat: -15.5, lng: 28.4 });
  });

  it("produces valid JSON parseable string", () => {
    const points: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
      { latitude: -15.3, longitude: 28.2 },
    ];
    expect(() => JSON.parse(syncToBoundariesJSON(points))).not.toThrow();
  });
});

describe("Boundary validation before save", () => {
  it("passes when no boundaries provided", () => {
    expect(validateBeforeSave("").valid).toBe(true);
    expect(validateBeforeSave("   ").valid).toBe(true);
  });

  it("fails on invalid JSON", () => {
    const result = validateBeforeSave("not-json");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("invalid_json");
  });

  it("fails when fewer than 3 points", () => {
    const json = JSON.stringify([{ lat: -15.4, lng: 28.3 }, { lat: -15.5, lng: 28.4 }]);
    const result = validateBeforeSave(json);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("at_least_3_points");
  });

  it("passes with 3 valid points", () => {
    const json = JSON.stringify([
      { lat: -15.4, lng: 28.3 },
      { lat: -15.5, lng: 28.4 },
      { lat: -15.3, lng: 28.2 },
    ]);
    expect(validateBeforeSave(json).valid).toBe(true);
  });

  it("passes with 4+ valid points", () => {
    const points = Array.from({ length: 6 }, (_, i) => ({
      lat: -15.4 + i * 0.01,
      lng: 28.3 + i * 0.01,
    }));
    expect(validateBeforeSave(JSON.stringify(points)).valid).toBe(true);
  });

  it("round-trip: drawn points → JSON → validation passes", () => {
    const drawn: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
      { latitude: -15.3, longitude: 28.2 },
    ];
    const json = syncToBoundariesJSON(drawn);
    expect(validateBeforeSave(json).valid).toBe(true);
  });
});
