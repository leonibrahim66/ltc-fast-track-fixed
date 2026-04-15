/**
 * CommissionService unit tests
 * Tests commission calculation logic, rate application, and platform config.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB dependency ───────────────────────────────────────────────────

vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // DB unavailable → fallback to default rate
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import {
  calculateCommission,
  PLATFORM_CONFIG,
  type CommissionServiceType,
} from "../server/commission-service";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CommissionService", () => {
  describe("PLATFORM_CONFIG", () => {
    it("should have the correct platform MSISDN", () => {
      expect(PLATFORM_CONFIG.msisdn).toBe("0960819993");
    });

    it("should have ZMW as currency", () => {
      expect(PLATFORM_CONFIG.currency).toBe("ZMW");
    });

    it("should have a default commission rate of 10%", () => {
      expect(PLATFORM_CONFIG.defaultCommissionRate).toBe(0.10);
    });
  });

  describe("calculateCommission", () => {
    it("should calculate 10% commission on garbage service (default rate)", async () => {
      const result = await calculateCommission(100, "garbage");
      expect(result.platformCommission).toBeCloseTo(10, 2);
      expect(result.providerAmount).toBeCloseTo(90, 2);
      expect(result.appliedRate).toBeCloseTo(0.10, 4);
      expect(result.transactionSource).toBe("garbage");
    });

    it("should calculate 10% commission on carrier service (default rate)", async () => {
      const result = await calculateCommission(200, "carrier");
      expect(result.platformCommission).toBeCloseTo(20, 2);
      expect(result.providerAmount).toBeCloseTo(180, 2);
      expect(result.appliedRate).toBeCloseTo(0.10, 4);
      expect(result.transactionSource).toBe("carrier");
    });

    it("should calculate 10% commission on subscription service (default rate)", async () => {
      const result = await calculateCommission(50, "subscription");
      expect(result.platformCommission).toBeCloseTo(5, 2);
      expect(result.providerAmount).toBeCloseTo(45, 2);
      expect(result.appliedRate).toBeCloseTo(0.10, 4);
      expect(result.transactionSource).toBe("subscription");
    });

    it("should ensure platformCommission + providerAmount = amountTotal", async () => {
      const amounts = [100, 250.50, 1000, 33.33, 999.99];
      for (const amount of amounts) {
        const result = await calculateCommission(amount, "garbage");
        const sum = parseFloat((result.platformCommission + result.providerAmount).toFixed(2));
        expect(sum).toBeCloseTo(amount, 1);
      }
    });

    it("should handle zero amount gracefully", async () => {
      const result = await calculateCommission(0, "garbage");
      expect(result.platformCommission).toBe(0);
      expect(result.providerAmount).toBe(0);
    });

    it("should handle large amounts correctly", async () => {
      const result = await calculateCommission(100000, "carrier");
      expect(result.platformCommission).toBeCloseTo(10000, 2);
      expect(result.providerAmount).toBeCloseTo(90000, 2);
    });

    it("should return the correct transactionSource for each service type", async () => {
      const services: CommissionServiceType[] = ["garbage", "carrier", "subscription"];
      for (const service of services) {
        const result = await calculateCommission(100, service);
        expect(result.transactionSource).toBe(service);
      }
    });

    it("should never allow provider to receive more than 100% of amount", async () => {
      const result = await calculateCommission(100, "garbage");
      expect(result.providerAmount).toBeLessThanOrEqual(100);
    });

    it("should never allow platform commission to exceed the total amount", async () => {
      const result = await calculateCommission(100, "garbage");
      expect(result.platformCommission).toBeLessThanOrEqual(100);
    });

    it("should return numeric values (not strings)", async () => {
      const result = await calculateCommission(100, "garbage");
      expect(typeof result.platformCommission).toBe("number");
      expect(typeof result.providerAmount).toBe("number");
      expect(typeof result.appliedRate).toBe("number");
    });
  });
});
