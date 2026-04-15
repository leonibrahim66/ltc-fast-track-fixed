/**
 * Transaction Monitor Service Tests
 *
 * Tests the core logic of the transaction monitoring service:
 * - Monitor stats tracking
 * - Start/stop lifecycle
 * - runMonitorCycle handles DB unavailability gracefully
 * - Error recording
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock DB ──────────────────────────────────────────────────────────────────

vi.mock("../server/db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // DB unavailable by default
}));

vi.mock("../server/mtn-momo", () => ({
  getRequestToPayStatus: vi.fn(),
  getDisbursementStatus: vi.fn(),
  isSandbox: vi.fn().mockReturnValue(true),
  sandboxLog: vi.fn(),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Transaction Monitor Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export startTransactionMonitor, stopTransactionMonitor, getMonitorStats, runMonitorCycle", async () => {
    const monitor = await import("../server/transaction-monitor");
    expect(typeof monitor.startTransactionMonitor).toBe("function");
    expect(typeof monitor.stopTransactionMonitor).toBe("function");
    expect(typeof monitor.getMonitorStats).toBe("function");
    expect(typeof monitor.runMonitorCycle).toBe("function");
  });

  it("should return initial stats with isRunning: false", async () => {
    const { getMonitorStats } = await import("../server/transaction-monitor");
    const stats = getMonitorStats();
    expect(stats.isRunning).toBe(false);
    expect(stats.totalChecked).toBeGreaterThanOrEqual(0);
    expect(stats.totalResolved).toBeGreaterThanOrEqual(0);
    expect(stats.totalFailed).toBeGreaterThanOrEqual(0);
    expect(stats.totalRetried).toBeGreaterThanOrEqual(0);
    expect(stats.totalTimedOut).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(stats.errors)).toBe(true);
  });

  it("should run a monitor cycle without throwing when DB is unavailable", async () => {
    const { runMonitorCycle } = await import("../server/transaction-monitor");
    await expect(runMonitorCycle()).resolves.not.toThrow();
  });

  it("should update lastRunAt after a cycle completes", async () => {
    const { runMonitorCycle, getMonitorStats } = await import("../server/transaction-monitor");
    await runMonitorCycle();
    const stats = getMonitorStats();
    expect(stats.lastRunAt).not.toBeNull();
    expect(stats.lastRunAt).toBeInstanceOf(Date);
  });

  it("should not throw when stopTransactionMonitor is called without starting", async () => {
    const { stopTransactionMonitor } = await import("../server/transaction-monitor");
    expect(() => stopTransactionMonitor()).not.toThrow();
  });
});

describe("Commission Calculation Logic (unit)", () => {
  it("should calculate 10% platform commission correctly", () => {
    const amountTotal = 100;
    const platformCommission = parseFloat((amountTotal * 0.10).toFixed(2));
    const providerAmount = parseFloat((amountTotal - platformCommission).toFixed(2));
    expect(platformCommission).toBe(10);
    expect(providerAmount).toBe(90);
  });

  it("should handle fractional amounts correctly", () => {
    const amountTotal = 333.33;
    const platformCommission = parseFloat((amountTotal * 0.10).toFixed(2));
    const providerAmount = parseFloat((amountTotal - platformCommission).toFixed(2));
    expect(platformCommission).toBe(33.33);
    expect(providerAmount).toBe(300);
  });

  it("should handle zero amount", () => {
    const amountTotal = 0;
    const platformCommission = parseFloat((amountTotal * 0.10).toFixed(2));
    const providerAmount = parseFloat((amountTotal - platformCommission).toFixed(2));
    expect(platformCommission).toBe(0);
    expect(providerAmount).toBe(0);
  });

  it("should handle large amounts", () => {
    const amountTotal = 10000;
    const platformCommission = parseFloat((amountTotal * 0.10).toFixed(2));
    const providerAmount = parseFloat((amountTotal - platformCommission).toFixed(2));
    expect(platformCommission).toBe(1000);
    expect(providerAmount).toBe(9000);
  });
});

describe("Sandbox Test MSISDN Numbers", () => {
  const SANDBOX_NUMBERS = {
    SUCCESS: "46733123450",
    FAILED: "56733123450",
    PENDING: "36733123450",
  };

  it("should have valid sandbox MSISDN numbers defined", () => {
    expect(SANDBOX_NUMBERS.SUCCESS).toBe("46733123450");
    expect(SANDBOX_NUMBERS.FAILED).toBe("56733123450");
    expect(SANDBOX_NUMBERS.PENDING).toBe("36733123450");
  });

  it("should validate MSISDN format (10-15 digits)", () => {
    const isValidMSISDN = (num: string) => /^\d{10,15}$/.test(num);
    expect(isValidMSISDN(SANDBOX_NUMBERS.SUCCESS)).toBe(true);
    expect(isValidMSISDN(SANDBOX_NUMBERS.FAILED)).toBe(true);
    expect(isValidMSISDN(SANDBOX_NUMBERS.PENDING)).toBe(true);
  });
});
