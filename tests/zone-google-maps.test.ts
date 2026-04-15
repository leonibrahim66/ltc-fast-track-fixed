/**
 * Zone Google Maps Utilities — Unit Tests
 *
 * Tests generateZonePolygon purely (no network).
 * Tests fetchPlaceCoordinates with a mocked fetch and mocked AsyncStorage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock AsyncStorage ────────────────────────────────────────────────────────
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

// ─── Mock global fetch ────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchPlaceCoordinates, generateZonePolygon, type LatLng } from "../lib/zone-google-maps";

// ─── generateZonePolygon tests ────────────────────────────────────────────────

describe("generateZonePolygon", () => {
  const center: LatLng = { latitude: -15.4167, longitude: 28.2833 };

  it("returns the correct number of points for a hexagon (default)", () => {
    const polygon = generateZonePolygon(center);
    expect(polygon).toHaveLength(6);
  });

  it("returns the correct number of points for a custom side count", () => {
    expect(generateZonePolygon(center, 0.01, 3)).toHaveLength(3);
    expect(generateZonePolygon(center, 0.01, 8)).toHaveLength(8);
    expect(generateZonePolygon(center, 0.01, 12)).toHaveLength(12);
  });

  it("all points are within radius + small floating-point tolerance", () => {
    const radius = 0.01;
    const polygon = generateZonePolygon(center, radius);
    for (const point of polygon) {
      const dLat = point.latitude - center.latitude;
      const dLng = point.longitude - center.longitude;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      expect(dist).toBeCloseTo(radius, 8);
    }
  });

  it("all points have latitude and longitude properties", () => {
    const polygon = generateZonePolygon(center);
    for (const point of polygon) {
      expect(typeof point.latitude).toBe("number");
      expect(typeof point.longitude).toBe("number");
    }
  });

  it("polygon is NOT auto-closed (first !== last)", () => {
    const polygon = generateZonePolygon(center);
    const first = polygon[0];
    const last = polygon[polygon.length - 1];
    // They should differ (not the same point)
    expect(first.latitude).not.toBeCloseTo(last.latitude, 8);
  });

  it("uses custom radius correctly", () => {
    const smallRadius = 0.005;
    const largeRadius = 0.05;
    const small = generateZonePolygon(center, smallRadius);
    const large = generateZonePolygon(center, largeRadius);
    // Measure max Euclidean distance from center across all points
    const maxDist = (pts: LatLng[]) =>
      Math.max(...pts.map((p) => {
        const dLat = p.latitude - center.latitude;
        const dLng = p.longitude - center.longitude;
        return Math.sqrt(dLat * dLat + dLng * dLng);
      }));
    expect(maxDist(large)).toBeGreaterThan(maxDist(small));
  });

  it("throws when sides < 3", () => {
    expect(() => generateZonePolygon(center, 0.01, 2)).toThrow("at least 3 sides");
  });

  it("throws when radius <= 0", () => {
    expect(() => generateZonePolygon(center, 0)).toThrow("positive number");
    expect(() => generateZonePolygon(center, -0.01)).toThrow("positive number");
  });

  it("works at the equator (latitude 0, longitude 0)", () => {
    const equator: LatLng = { latitude: 0, longitude: 0 };
    const polygon = generateZonePolygon(equator, 0.01, 4);
    expect(polygon).toHaveLength(4);
  });

  it("works at negative coordinates (southern hemisphere)", () => {
    const polygon = generateZonePolygon({ latitude: -15.4167, longitude: 28.2833 }, 0.01, 6);
    expect(polygon).toHaveLength(6);
    // All latitudes should be near -15.4167
    for (const p of polygon) {
      expect(Math.abs(p.latitude - (-15.4167))).toBeLessThan(0.02);
    }
  });
});

// ─── fetchPlaceCoordinates tests ──────────────────────────────────────────────

describe("fetchPlaceCoordinates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: API key exists
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue("FAKE_API_KEY");
  });

  it("returns null for empty place name", async () => {
    expect(await fetchPlaceCoordinates("")).toBeNull();
    expect(await fetchPlaceCoordinates("   ")).toBeNull();
  });

  it("throws when no API key is stored", async () => {
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(fetchPlaceCoordinates("Lusaka")).rejects.toThrow("API key not configured");
  });

  it("throws when API key is empty string", async () => {
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue("   ");
    await expect(fetchPlaceCoordinates("Lusaka")).rejects.toThrow("API key not configured");
  });

  it("returns LatLng on successful geocoding", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [
          { geometry: { location: { lat: -15.4167, lng: 28.2833 } } },
        ],
      }),
    });
    const result = await fetchPlaceCoordinates("Lusaka, Zambia");
    expect(result).toEqual({ latitude: -15.4167, longitude: 28.2833 });
  });

  it("returns null on ZERO_RESULTS", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS", results: [] }),
    });
    const result = await fetchPlaceCoordinates("NonExistentPlace12345");
    expect(result).toBeNull();
  });

  it("throws on non-OK HTTP response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(fetchPlaceCoordinates("Lusaka")).rejects.toThrow("HTTP 500");
  });

  it("throws on API error status with error_message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "REQUEST_DENIED",
        results: [],
        error_message: "The provided API key is invalid.",
      }),
    });
    await expect(fetchPlaceCoordinates("Lusaka")).rejects.toThrow("The provided API key is invalid.");
  });

  it("throws on API error status without error_message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "OVER_QUERY_LIMIT", results: [] }),
    });
    await expect(fetchPlaceCoordinates("Lusaka")).rejects.toThrow("OVER_QUERY_LIMIT");
  });

  it("URL-encodes the place name correctly", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [{ geometry: { location: { lat: -15.4, lng: 28.3 } } }],
      }),
    });
    await fetchPlaceCoordinates("Lusaka Central, Zambia");
    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("Lusaka%20Central%2C%20Zambia");
  });

  it("trims whitespace from place name before encoding", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [{ geometry: { location: { lat: -15.4, lng: 28.3 } } }],
      }),
    });
    await fetchPlaceCoordinates("  Lusaka  ");
    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain("Lusaka");
    expect(calledUrl).not.toContain("%20Lusaka%20"); // leading/trailing spaces stripped
  });
});
