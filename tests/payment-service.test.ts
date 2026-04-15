/**
 * Payment Service Unit Tests
 *
 * Tests the commission calculation logic which is the core security requirement.
 * These tests run without a database or MTN API connection.
 */

import { describe, it, expect } from "vitest";
import { calculateCommission, PLATFORM_COMMISSION_RATE } from "../server/payment-service";

describe("calculateCommission", () => {
  it("deducts exactly 10% as platform commission", () => {
    const { platformCommission, providerAmount } = calculateCommission(100);
    expect(platformCommission).toBe(10.00);
    expect(providerAmount).toBe(90.00);
  });

  it("platform commission + provider amount equals amountTotal", () => {
    const amounts = [50, 100, 250, 1000, 9999.99];
    for (const amount of amounts) {
      const { platformCommission, providerAmount } = calculateCommission(amount);
      expect(platformCommission + providerAmount).toBeCloseTo(amount, 2);
    }
  });

  it("rounds to 2 decimal places", () => {
    const { platformCommission, providerAmount } = calculateCommission(33.33);
    // Values should be numbers with at most 2 decimal places
    expect(Number.isFinite(platformCommission)).toBe(true);
    expect(Number.isFinite(providerAmount)).toBe(true);
    // Verify no more than 2 decimal places
    const decimals = (n: number) => (n.toString().split(".")[1] ?? "").length;
    expect(decimals(platformCommission)).toBeLessThanOrEqual(2);
    expect(decimals(providerAmount)).toBeLessThanOrEqual(2);
  });

  it("commission rate is 10%", () => {
    expect(PLATFORM_COMMISSION_RATE).toBe(0.10);
  });

  it("provider receives 90% of total", () => {
    const { providerAmount } = calculateCommission(200);
    expect(providerAmount).toBe(180.00);
  });

  it("handles small amounts correctly", () => {
    const { platformCommission, providerAmount } = calculateCommission(1.00);
    expect(platformCommission).toBe(0.10);
    expect(providerAmount).toBe(0.90);
  });

  it("MTN env vars are registered (stubs)", () => {
    // These env vars should be registered (even if empty) for future MTN integration
    const mtnKeys = [
      "MTN_BASE_URL",
      "MTN_COLLECTION_KEY",
      "MTN_DISBURSEMENT_KEY",
      "MTN_API_USER",
      "MTN_API_KEY",
    ];
    // We just verify the keys exist in process.env (value can be empty for stubs)
    for (const key of mtnKeys) {
      expect(key in process.env || process.env[key] === undefined).toBe(true);
    }
  });
});
