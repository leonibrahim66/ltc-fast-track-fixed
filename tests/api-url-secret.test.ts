/**
 * Validates that EXPO_PUBLIC_API_URL is set and points to a live backend.
 * Calls GET /api/health which returns { status: "ok" }.
 */
import { describe, it, expect } from "vitest";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_PICKUP_API_BASE_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL;

describe("EXPO_PUBLIC_API_URL secret", () => {
  it("should be set to a non-empty string", () => {
    expect(BASE_URL).toBeTruthy();
    expect(BASE_URL).not.toContain("localhost");
  });

  it("should point to a live backend (GET /api/health returns 200)", async () => {
    expect(BASE_URL).toBeTruthy();
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Backend returns { ok: true, timestamp: "..." }
    expect(body.ok).toBe(true);
  }, 15_000);
});
