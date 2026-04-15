/**
 * Validates that EXPO_PUBLIC_PICKUP_API_BASE_URL is set and the backend is reachable.
 */
import { describe, it, expect } from "vitest";

const BASE_URL = process.env.EXPO_PUBLIC_PICKUP_API_BASE_URL;

describe("Pickup API secret validation", () => {
  it("EXPO_PUBLIC_PICKUP_API_BASE_URL should be set", () => {
    expect(BASE_URL).toBeTruthy();
    expect(BASE_URL).toContain("railway.app");
  });

  it("GET /api/pickups should return 200 with an array", async () => {
    const res = await fetch(`${BASE_URL}/api/pickups`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
