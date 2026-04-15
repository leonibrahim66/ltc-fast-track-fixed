/**
 * zone-create.tsx — Auto Detect Zone Feature Tests
 *
 * Tests the handleAutoDetect logic by exercising the underlying utilities
 * (fetchPlaceCoordinates + generateZonePolygon) in the same way zone-create does.
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
import { fetchPlaceCoordinates, generateZonePolygon } from "../lib/zone-google-maps";

// ─── Simulate handleAutoDetect logic ─────────────────────────────────────────

async function simulateAutoDetect(
  searchText: string,
  apiKeyStored: string | null = "FAKE_KEY",
  geocodeResponse?: object
): Promise<{ points: any[] | null; error: string | null }> {
  (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue(apiKeyStored);

  if (geocodeResponse) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => geocodeResponse,
    });
  }

  if (!searchText.trim()) {
    return { points: null, error: "Search required" };
  }

  try {
    const coords = await fetchPlaceCoordinates(searchText.trim());
    if (!coords) {
      return { points: null, error: `Could not find "${searchText}"` };
    }
    const polygon = generateZonePolygon(coords);
    return { points: polygon, error: null };
  } catch (err: any) {
    return { points: null, error: err?.message ?? "Unknown error" };
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("zone-create auto detect feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when searchText is empty", async () => {
    const result = await simulateAutoDetect("");
    expect(result.points).toBeNull();
    expect(result.error).toMatch(/search required/i);
  });

  it("returns error when searchText is only whitespace", async () => {
    const result = await simulateAutoDetect("   ");
    expect(result.points).toBeNull();
    expect(result.error).toMatch(/search required/i);
  });

  it("returns null points when geocode returns ZERO_RESULTS", async () => {
    const result = await simulateAutoDetect("NonExistentPlace99999", "FAKE_KEY", {
      status: "ZERO_RESULTS",
      results: [],
    });
    expect(result.points).toBeNull();
    expect(result.error).toContain("NonExistentPlace99999");
  });

  it("returns 6 polygon points on successful geocode", async () => {
    const result = await simulateAutoDetect("Kabulonga, Lusaka", "FAKE_KEY", {
      status: "OK",
      results: [{ geometry: { location: { lat: -15.39, lng: 28.31 } } }],
    });
    expect(result.error).toBeNull();
    expect(result.points).toHaveLength(6);
  });

  it("returned polygon points are near the geocoded center", async () => {
    const center = { lat: -15.39, lng: 28.31 };
    const result = await simulateAutoDetect("Kabulonga", "FAKE_KEY", {
      status: "OK",
      results: [{ geometry: { location: center } }],
    });
    expect(result.points).not.toBeNull();
    for (const p of result.points!) {
      expect(Math.abs(p.latitude - center.lat)).toBeLessThan(0.02);
      expect(Math.abs(p.longitude - center.lng)).toBeLessThan(0.02);
    }
  });

  it("returns error when API key is missing", async () => {
    const result = await simulateAutoDetect("Lusaka", null);
    expect(result.points).toBeNull();
    expect(result.error).toMatch(/api key/i);
  });

  it("returns error when fetch fails with non-OK HTTP status", async () => {
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue("FAKE_KEY");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    const result = await simulateAutoDetect("Lusaka");
    expect(result.points).toBeNull();
    expect(result.error).toMatch(/503/);
  });

  it("returns error when API returns REQUEST_DENIED", async () => {
    const result = await simulateAutoDetect("Lusaka", "FAKE_KEY", {
      status: "REQUEST_DENIED",
      results: [],
      error_message: "API key invalid.",
    });
    expect(result.points).toBeNull();
    expect(result.error).toMatch(/API key invalid/);
  });

  it("trims leading/trailing whitespace from searchText before geocoding", async () => {
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue("FAKE_KEY");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "OK",
        results: [{ geometry: { location: { lat: -15.4, lng: 28.3 } } }],
      }),
    });
    await simulateAutoDetect("  Lusaka  ");
    const calledUrl: string = mockFetch.mock.calls[0][0];
    // Should not have leading/trailing %20 around Lusaka
    expect(calledUrl).toContain("Lusaka");
    expect(calledUrl).not.toMatch(/%20Lusaka%20/);
  });

  it("polygon points all have latitude and longitude", async () => {
    const result = await simulateAutoDetect("Lusaka", "FAKE_KEY", {
      status: "OK",
      results: [{ geometry: { location: { lat: -15.4167, lng: 28.2833 } } }],
    });
    for (const p of result.points!) {
      expect(typeof p.latitude).toBe("number");
      expect(typeof p.longitude).toBe("number");
    }
  });
});
