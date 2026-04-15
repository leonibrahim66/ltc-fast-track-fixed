import { describe, it, expect } from "vitest";

describe("Google Maps Configuration", () => {
  it("should have EXPO_PUBLIC_GOOGLE_MAPS_API_KEY set", () => {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    expect(key).toBeDefined();
    expect(key!.length).toBeGreaterThan(0);
  });

  it("should have a valid Google Maps API key format (starts with AIza)", () => {
    const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    // Google Maps API keys start with "AIza"
    expect(key).toMatch(/^AIza/);
  });
});
