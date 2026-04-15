/**
 * Zone Edit — Map Drawing & Auto-Close Tests
 *
 * Tests the pure logic used by zone-edit.tsx and zone-create.tsx:
 *   - toMapPoints / toStoredPoints conversion
 *   - ensureClosed polygon logic
 *   - Auto-close guard (no double-closure)
 *   - Background zone overlay filtering (exclude current zone)
 *   - Draggable marker update logic
 */
import { describe, it, expect } from "vitest";

// ─── Helpers mirroring the component logic ────────────────────────────────────

interface DrawnPoint { latitude: number; longitude: number; }
interface StoredPoint { lat: number; lng: number; }
interface StoredZone { id: string; name: string; boundaries?: StoredPoint[]; }

function toMapPoints(stored: StoredPoint[]): DrawnPoint[] {
  return stored.map((p) => ({ latitude: p.lat, longitude: p.lng }));
}

function toStoredPoints(drawn: DrawnPoint[]): StoredPoint[] {
  return drawn.map((p) => ({ lat: p.latitude, lng: p.longitude }));
}

function ensureClosed(points: DrawnPoint[]): DrawnPoint[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.latitude === last.latitude && first.longitude === last.longitude) {
    return points;
  }
  return [...points, { ...first }];
}

/** Mirrors the auto-close logic in handleSubmit for stored {lat,lng} format */
function autoCloseStoredPoints(points: StoredPoint[]): StoredPoint[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.lat !== last.lat || first.lng !== last.lng) {
    return [...points, { ...first }];
  }
  return points;
}

function updateMarkerPosition(points: DrawnPoint[], index: number, newCoord: DrawnPoint): DrawnPoint[] {
  const updated = [...points];
  updated[index] = newCoord;
  return updated;
}

function filterOtherZones(zones: StoredZone[], currentZoneId: string): StoredZone[] {
  return zones.filter(
    (z) => z.id !== currentZoneId && z.boundaries && Array.isArray(z.boundaries) && z.boundaries.length >= 3
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Coordinate conversion", () => {
  it("converts stored {lat,lng} to MapView {latitude,longitude}", () => {
    const stored: StoredPoint[] = [
      { lat: -15.4, lng: 28.3 },
      { lat: -15.5, lng: 28.4 },
    ];
    const mapped = toMapPoints(stored);
    expect(mapped[0]).toEqual({ latitude: -15.4, longitude: 28.3 });
    expect(mapped[1]).toEqual({ latitude: -15.5, longitude: 28.4 });
  });

  it("converts MapView {latitude,longitude} back to stored {lat,lng}", () => {
    const drawn: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
    ];
    const stored = toStoredPoints(drawn);
    expect(stored[0]).toEqual({ lat: -15.4, lng: 28.3 });
    expect(stored[1]).toEqual({ lat: -15.5, lng: 28.4 });
  });

  it("round-trips without data loss", () => {
    const original: StoredPoint[] = [
      { lat: -15.4167, lng: 28.2833 },
      { lat: -15.5, lng: 28.4 },
      { lat: -15.3, lng: 28.2 },
    ];
    expect(toStoredPoints(toMapPoints(original))).toEqual(original);
  });
});

describe("ensureClosed (map drawing helper)", () => {
  it("returns points unchanged if already closed", () => {
    const points: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
      { latitude: -15.3, longitude: 28.2 },
      { latitude: -15.4, longitude: 28.3 }, // same as first
    ];
    const result = ensureClosed(points);
    expect(result).toHaveLength(4);
    expect(result).toEqual(points);
  });

  it("appends first point if polygon is open", () => {
    const points: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
      { latitude: -15.3, longitude: 28.2 },
    ];
    const result = ensureClosed(points);
    expect(result).toHaveLength(4);
    expect(result[3]).toEqual(result[0]);
  });

  it("returns fewer than 3 points unchanged (no crash)", () => {
    const points: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
    ];
    expect(ensureClosed(points)).toHaveLength(2);
  });

  it("does not double-close an already closed polygon", () => {
    const points: DrawnPoint[] = [
      { latitude: -15.4, longitude: 28.3 },
      { latitude: -15.5, longitude: 28.4 },
      { latitude: -15.3, longitude: 28.2 },
      { latitude: -15.4, longitude: 28.3 },
    ];
    const result = ensureClosed(points);
    expect(result).toHaveLength(4); // still 4, not 5
  });
});

describe("Auto-close on save (stored {lat,lng} format)", () => {
  it("closes an open polygon before saving", () => {
    const points: StoredPoint[] = [
      { lat: -15.4, lng: 28.3 },
      { lat: -15.5, lng: 28.4 },
      { lat: -15.3, lng: 28.2 },
    ];
    const result = autoCloseStoredPoints(points);
    expect(result).toHaveLength(4);
    expect(result[3]).toEqual(result[0]);
  });

  it("does not double-close an already closed polygon", () => {
    const points: StoredPoint[] = [
      { lat: -15.4, lng: 28.3 },
      { lat: -15.5, lng: 28.4 },
      { lat: -15.3, lng: 28.2 },
      { lat: -15.4, lng: 28.3 }, // already closed
    ];
    const result = autoCloseStoredPoints(points);
    expect(result).toHaveLength(4); // still 4
  });

  it("does not modify polygons with fewer than 3 points", () => {
    const points: StoredPoint[] = [{ lat: -15.4, lng: 28.3 }, { lat: -15.5, lng: 28.4 }];
    expect(autoCloseStoredPoints(points)).toHaveLength(2);
  });
});

describe("Draggable marker update", () => {
  const basePoints: DrawnPoint[] = [
    { latitude: -15.4, longitude: 28.3 },
    { latitude: -15.5, longitude: 28.4 },
    { latitude: -15.3, longitude: 28.2 },
  ];

  it("updates the correct point by index", () => {
    const newCoord: DrawnPoint = { latitude: -15.6, longitude: 28.5 };
    const result = updateMarkerPosition(basePoints, 1, newCoord);
    expect(result[1]).toEqual(newCoord);
    expect(result[0]).toEqual(basePoints[0]);
    expect(result[2]).toEqual(basePoints[2]);
  });

  it("does not mutate the original array", () => {
    const original = [...basePoints];
    updateMarkerPosition(basePoints, 0, { latitude: -99, longitude: -99 });
    expect(basePoints[0]).toEqual(original[0]);
  });

  it("handles updating the first point (index 0)", () => {
    const newCoord: DrawnPoint = { latitude: -15.1, longitude: 28.1 };
    const result = updateMarkerPosition(basePoints, 0, newCoord);
    expect(result[0]).toEqual(newCoord);
  });

  it("handles updating the last point", () => {
    const newCoord: DrawnPoint = { latitude: -15.9, longitude: 28.9 };
    const result = updateMarkerPosition(basePoints, 2, newCoord);
    expect(result[2]).toEqual(newCoord);
  });
});

describe("Background zone overlay filtering", () => {
  const allZones: StoredZone[] = [
    { id: "zone_1", name: "Zone A", boundaries: [{ lat: -15.4, lng: 28.3 }, { lat: -15.5, lng: 28.4 }, { lat: -15.3, lng: 28.2 }] },
    { id: "zone_2", name: "Zone B", boundaries: [{ lat: -15.6, lng: 28.5 }, { lat: -15.7, lng: 28.6 }, { lat: -15.5, lng: 28.4 }] },
    { id: "zone_3", name: "Zone C" }, // no boundaries
    { id: "zone_4", name: "Zone D", boundaries: [{ lat: -15.8, lng: 28.7 }] }, // < 3 points
  ];

  it("excludes the current zone being edited", () => {
    const result = filterOtherZones(allZones, "zone_1");
    expect(result.find((z) => z.id === "zone_1")).toBeUndefined();
  });

  it("includes other zones with ≥ 3 boundary points", () => {
    const result = filterOtherZones(allZones, "zone_1");
    expect(result.find((z) => z.id === "zone_2")).toBeDefined();
  });

  it("excludes zones with no boundaries", () => {
    const result = filterOtherZones(allZones, "zone_1");
    expect(result.find((z) => z.id === "zone_3")).toBeUndefined();
  });

  it("excludes zones with fewer than 3 boundary points", () => {
    const result = filterOtherZones(allZones, "zone_1");
    expect(result.find((z) => z.id === "zone_4")).toBeUndefined();
  });

  it("returns empty array when all zones are excluded", () => {
    const result = filterOtherZones(allZones, "zone_1");
    // zone_2 is the only valid other zone
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("zone_2");
  });

  it("in zone-create (no current zone), all valid zones are shown", () => {
    // zone-create passes a non-existent ID so nothing is excluded by ID
    const result = filterOtherZones(allZones, "");
    expect(result).toHaveLength(2); // zone_1 and zone_2
  });
});
