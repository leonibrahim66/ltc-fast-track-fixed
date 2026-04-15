/**
 * Validates that PAWAPAY_API_KEY is set and accepted by PawaPay.
 * Uses the lightweight GET /active-configuration endpoint.
 */
import { describe, it, expect } from "vitest";
import axios from "axios";

describe("PawaPay API Key", () => {
  it("PAWAPAY_API_KEY env var is set", () => {
    const key = process.env.PAWAPAY_API_KEY;
    expect(key, "PAWAPAY_API_KEY must be set").toBeTruthy();
    expect(key!.length, "PAWAPAY_API_KEY must be at least 10 chars").toBeGreaterThan(10);
  });

  it("PawaPay API key is accepted by the deposits endpoint", async () => {
    const key = process.env.PAWAPAY_API_KEY;
    if (!key) {
      console.warn("Skipping live check — PAWAPAY_API_KEY not set");
      return;
    }

    // Use GET /v2/deposits with a fake depositId — returns 200 with empty array if auth is valid
    // Note: active-configuration returns 500 intermittently on sandbox (PawaPay known issue)
    const url =
      "https://api.sandbox.pawapay.io/v2/deposits?depositId=f4401bd2-1568-4140-bf2d-eb77d2b2b639";

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${key}` },
      timeout: 15_000,
      validateStatus: () => true,
    });

    // 200 = valid key, 401/403 = invalid key
    expect(
      response.status,
      `PawaPay returned ${response.status} — check PAWAPAY_API_KEY`
    ).not.toBe(401);
    expect(response.status).not.toBe(403);
    expect(response.status, `Unexpected status ${response.status}`).toBe(200);
  }, 20_000);
});
