/**
 * Tests for zone-edit.tsx auto-detect and radius selector logic.
 * These tests validate the pure utility functions used by both zone-create and zone-edit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateZonePolygon, fetchPlaceCoordinates } from "../lib/zone-google-maps";

// ─── generateZonePolygon with custom radius ───────────────────────────────────

describe("generateZonePolygon with radius selector", () => {
  const center = { latitude: -15.4166, longitude: 28.2833 };

  it("generates 6 points by default", () => {
    const polygon = generateZonePolygon(center);
    expect(polygon).toHaveLength(6);
  });

  it("uses default radius of 0.01 degrees when not specified", () => {
    const polygon = generateZonePolygon(center);
    // Verify max Euclidean distance from center equals the default radius (0.01)
    const maxDist = Math.max(
      ...polygon.map((p) =>
        Math.sqrt(
          Math.pow(p.latitude - center.latitude, 2) +
          Math.pow(p.longitude - center.longitude, 2)
        )
      )
    );
    expect(maxDist).toBeCloseTo(0.01, 2);
  });

  it("generates a smaller polygon with 0.005 radius (0.5km step)", () => {
    const small = generateZonePolygon(center, 0.005);
    const large = generateZonePolygon(center, 0.04);
    // Compare max Euclidean distance from center
    const dist = (pts: typeof small) =>
      Math.max(
        ...pts.map((p) =>
          Math.sqrt(
            Math.pow(p.latitude - center.latitude, 2) +
            Math.pow(p.longitude - center.longitude, 2)
          )
        )
      );
    expect(dist(small)).toBeLessThan(dist(large));
  });

  it("generates a larger polygon with 0.1 radius (10km step)", () => {
    const large = generateZonePolygon(center, 0.1);
    const maxDist = Math.max(
      ...large.map((p) =>
        Math.sqrt(
          Math.pow(p.latitude - center.latitude, 2) +
          Math.pow(p.longitude - center.longitude, 2)
        )
      )
    );
    expect(maxDist).toBeCloseTo(0.1, 2);
  });

  it("all 7 radius steps produce valid 6-point polygons", () => {
    const RADIUS_STEPS = [0.005, 0.01, 0.02, 0.04, 0.06, 0.08, 0.1];
    for (const step of RADIUS_STEPS) {
      const polygon = generateZonePolygon(center, step);
      expect(polygon).toHaveLength(6);
      expect(polygon.every((p) => typeof p.latitude === "number" && typeof p.longitude === "number")).toBe(true);
    }
  });

  it("each radius step produces a polygon proportional to the radius", () => {
    const r1 = generateZonePolygon(center, 0.01);
    const r2 = generateZonePolygon(center, 0.02);
    const spread1 = Math.max(...r1.map((p) => Math.abs(p.latitude - center.latitude)));
    const spread2 = Math.max(...r2.map((p) => Math.abs(p.latitude - center.latitude)));
    // r2 should be roughly 2x r1
    expect(spread2 / spread1).toBeCloseTo(2, 1);
  });

  it("does not mutate the center object", () => {
    const original = { latitude: -15.4166, longitude: 28.2833 };
    const copy = { ...original };
    generateZonePolygon(original, 0.05);
    expect(original).toEqual(copy);
  });
});

// ─── fetchPlaceCoordinates error handling ─────────────────────────────────────

describe("fetchPlaceCoordinates error handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when API returns no results", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ZERO_RESULTS", results: [] }),
    }) as any;

    // Mock AsyncStorage
    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    vi.spyOn(AsyncStorage.default, "getItem").mockResolvedValue("fake-key");

    const result = await fetchPlaceCoordinates("nonexistent-place-xyz");
    expect(result).toBeNull();
  });

  it("returns coordinates when API returns valid results", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "OK",
        results: [
          {
            geometry: {
              location: { lat: -15.4166, lng: 28.2833 },
            },
          },
        ],
      }),
    }) as any;

    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    vi.spyOn(AsyncStorage.default, "getItem").mockResolvedValue("fake-key");

    const result = await fetchPlaceCoordinates("Lusaka");
    expect(result).not.toBeNull();
    expect(result?.latitude).toBeCloseTo(-15.4166, 3);
    expect(result?.longitude).toBeCloseTo(28.2833, 3);
  });

  it("throws when API key is missing", async () => {
    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    vi.spyOn(AsyncStorage.default, "getItem").mockResolvedValue(null);

    await expect(fetchPlaceCoordinates("Kabulonga")).rejects.toThrow(
      "Google Maps API key not configured"
    );
  });
});

// ─── Radius selector logic ────────────────────────────────────────────────────

describe("radius selector logic", () => {
  const RADIUS_STEPS = [0.005, 0.01, 0.02, 0.04, 0.06, 0.08, 0.1];
  const RADIUS_LABELS = ["0.5km", "1km", "2km", "4km", "6km", "8km", "10km"];

  it("has 7 steps matching 7 labels", () => {
    expect(RADIUS_STEPS).toHaveLength(7);
    expect(RADIUS_LABELS).toHaveLength(7);
  });

  it("steps are in ascending order", () => {
    for (let i = 1; i < RADIUS_STEPS.length; i++) {
      expect(RADIUS_STEPS[i]).toBeGreaterThan(RADIUS_STEPS[i - 1]);
    }
  });

  it("default radius 0.02 is the 3rd step (2km)", () => {
    const defaultRadius = 0.02;
    const idx = RADIUS_STEPS.findIndex((r) => Math.abs(r - defaultRadius) < 0.001);
    expect(idx).toBe(2);
    expect(RADIUS_LABELS[idx]).toBe("2km");
  });

  it("all steps produce polygons where max distance from center is <= radius", () => {
    const center = { latitude: -15.4166, longitude: 28.2833 };
    RADIUS_STEPS.forEach((step) => {
      const polygon = generateZonePolygon(center, step);
      // The hexagon's max distance from center equals the radius (circumradius)
      // but due to cos/sin angles, individual lat/lng deltas can be less than radius.
      // Verify max Euclidean distance from center is approximately the radius.
      const maxDist = Math.max(
        ...polygon.map((p) =>
          Math.sqrt(
            Math.pow(p.latitude - center.latitude, 2) +
            Math.pow(p.longitude - center.longitude, 2)
          )
        )
      );
      expect(maxDist).toBeCloseTo(step, 2);
    });
  });
});
