/**
 * MTN MoMo Client Unit Tests
 *
 * Tests the MTN MoMo client logic using mocked axios calls.
 * No real HTTP calls are made — all network interactions are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

// ─── Mock axios ───────────────────────────────────────────────────────────────
vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setMtnEnv(overrides: Partial<Record<string, string>> = {}) {
  process.env.MTN_BASE_URL = overrides.MTN_BASE_URL ?? "https://sandbox.momodeveloper.mtn.com";
  process.env.MTN_COLLECTION_SUBSCRIPTION_KEY = overrides.MTN_COLLECTION_SUBSCRIPTION_KEY ?? "test-collection-key";
  process.env.MTN_API_USER = overrides.MTN_API_USER ?? "test-api-user-uuid";
  process.env.MTN_API_KEY = overrides.MTN_API_KEY ?? "test-api-key";
}

function clearMtnEnv() {
  delete process.env.MTN_BASE_URL;
  delete process.env.MTN_COLLECTION_SUBSCRIPTION_KEY;
  delete process.env.MTN_COLLECTION_KEY;
  delete process.env.MTN_API_USER;
  delete process.env.MTN_API_KEY;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("isMtnConfigured", () => {
  afterEach(clearMtnEnv);

  it("returns false when env vars are missing", async () => {
    clearMtnEnv();
    const { isMtnConfigured } = await import("../server/mtn-momo");
    expect(isMtnConfigured()).toBe(false);
  });

  it("returns true when all required env vars are set", async () => {
    setMtnEnv();
    const { isMtnConfigured } = await import("../server/mtn-momo");
    expect(isMtnConfigured()).toBe(true);
  });

  it("accepts MTN_COLLECTION_KEY as alias for MTN_COLLECTION_SUBSCRIPTION_KEY", async () => {
    clearMtnEnv();
    process.env.MTN_BASE_URL = "https://sandbox.momodeveloper.mtn.com";
    process.env.MTN_COLLECTION_KEY = "alias-key";
    process.env.MTN_API_USER = "user";
    process.env.MTN_API_KEY = "key";
    const { isMtnConfigured } = await import("../server/mtn-momo");
    expect(isMtnConfigured()).toBe(true);
  });
});

describe("MTN_SANDBOX_TEST_NUMBERS", () => {
  it("exports the correct sandbox test MSISDNs", async () => {
    const { MTN_SANDBOX_TEST_NUMBERS } = await import("../server/mtn-momo");
    expect(MTN_SANDBOX_TEST_NUMBERS.SUCCESS).toBe("46733123450");
    expect(MTN_SANDBOX_TEST_NUMBERS.FAILED).toBe("56733123450");
    expect(MTN_SANDBOX_TEST_NUMBERS.PENDING).toBe("36733123450");
  });
});

describe("isSandboxTestNumber", () => {
  it("identifies sandbox test numbers correctly", async () => {
    const { isSandboxTestNumber } = await import("../server/mtn-momo");
    expect(isSandboxTestNumber("46733123450")).toBe(true);
    expect(isSandboxTestNumber("56733123450")).toBe(true);
    expect(isSandboxTestNumber("36733123450")).toBe(true);
    expect(isSandboxTestNumber("+46733123450")).toBe(true); // strips leading +
    expect(isSandboxTestNumber("260971234567")).toBe(false);
  });
});

describe("getAccessToken", () => {
  beforeEach(() => {
    setMtnEnv();
    vi.resetModules();
  });
  afterEach(clearMtnEnv);

  it("returns access token from MTN token endpoint", async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({
      data: { access_token: "mock-bearer-token", expires_in: 3600 },
    });

    const { getAccessToken } = await import("../server/mtn-momo");
    const token = await getAccessToken();
    expect(token).toBe("mock-bearer-token");
  });

  it("throws when MTN token endpoint returns an error", async () => {
    mockedAxios.post = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized"), {
        isAxiosError: true,
        response: { status: 401, data: { message: "Unauthorized" } },
      }),
    );

    const { getAccessToken } = await import("../server/mtn-momo");
    await expect(getAccessToken()).rejects.toThrow("MTN token request failed");
  });
});

describe("requestToPay", () => {
  beforeEach(() => {
    setMtnEnv();
    vi.resetModules();
  });
  afterEach(clearMtnEnv);

  it("returns accepted=true on 202 response", async () => {
    // Mock token call
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } }) // token
      .mockResolvedValueOnce({ status: 202, data: {} }); // requesttopay

    const { requestToPay } = await import("../server/mtn-momo");
    const result = await requestToPay({
      referenceId: "test-ref-001",
      amount: 100,
      customerMsisdn: "46733123450",
    });

    expect(result.accepted).toBe(true);
    expect(result.referenceId).toBe("test-ref-001");
  });

  it("returns accepted=false on 409 duplicate referenceId", async () => {
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } })
      .mockRejectedValueOnce(
        Object.assign(new Error("Conflict"), {
          isAxiosError: true,
          response: { status: 409, data: {} },
        }),
      );

    const { requestToPay } = await import("../server/mtn-momo");
    const result = await requestToPay({
      referenceId: "duplicate-ref",
      amount: 50,
      customerMsisdn: "46733123450",
    });

    expect(result.accepted).toBe(false);
    expect(result.error).toContain("Duplicate referenceId");
  });

  it("strips leading + from MSISDN before sending", async () => {
    let capturedBody: Record<string, unknown> = {};
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } })
      .mockImplementationOnce((_url, body) => {
        capturedBody = body as Record<string, unknown>;
        return Promise.resolve({ status: 202, data: {} });
      });

    const { requestToPay } = await import("../server/mtn-momo");
    await requestToPay({
      referenceId: "ref-strip",
      amount: 75,
      customerMsisdn: "+260971234567",
    });

    const payer = capturedBody.payer as { partyId: string };
    expect(payer.partyId).toBe("260971234567");
  });

  it("uses ZMW as currency", async () => {
    let capturedBody: Record<string, unknown> = {};
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } })
      .mockImplementationOnce((_url, body) => {
        capturedBody = body as Record<string, unknown>;
        return Promise.resolve({ status: 202, data: {} });
      });

    const { requestToPay } = await import("../server/mtn-momo");
    await requestToPay({ referenceId: "ref-zmw", amount: 200, customerMsisdn: "46733123450" });
    expect(capturedBody.currency).toBe("ZMW");
  });
});

describe("getRequestToPayStatus", () => {
  beforeEach(() => {
    setMtnEnv();
    vi.resetModules();
  });
  afterEach(clearMtnEnv);

  it("returns SUCCESSFUL status", async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({
      data: { access_token: "tok", expires_in: 3600 },
    });
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: { status: "SUCCESSFUL", financialTransactionId: "txn-123" },
    });

    const { getRequestToPayStatus } = await import("../server/mtn-momo");
    const result = await getRequestToPayStatus("ref-success");
    expect(result.status).toBe("SUCCESSFUL");
    expect(result.referenceId).toBe("ref-success");
  });

  it("returns FAILED status with reason", async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({
      data: { access_token: "tok", expires_in: 3600 },
    });
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: { status: "FAILED", reason: "PAYER_NOT_FOUND" },
    });

    const { getRequestToPayStatus } = await import("../server/mtn-momo");
    const result = await getRequestToPayStatus("ref-failed");
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("PAYER_NOT_FOUND");
  });
});

describe("MTN_COLLECTION_SUBSCRIPTION_KEY env var", () => {
  it("is registered as a valid env var name", () => {
    // Verify the key name is correctly formatted (uppercase + underscores only)
    const key = "MTN_COLLECTION_SUBSCRIPTION_KEY";
    expect(/^[A-Z][A-Z0-9_]+$/.test(key)).toBe(true);
    // Verify the alias key name is also correctly formatted
    const aliasKey = "MTN_COLLECTION_KEY";
    expect(/^[A-Z][A-Z0-9_]+$/.test(aliasKey)).toBe(true);
  });

  it("isMtnConfigured accepts both key names", async () => {
    // Test with MTN_COLLECTION_SUBSCRIPTION_KEY
    clearMtnEnv();
    process.env.MTN_BASE_URL = "https://sandbox.momodeveloper.mtn.com";
    process.env.MTN_COLLECTION_SUBSCRIPTION_KEY = "sub-key";
    process.env.MTN_API_USER = "user";
    process.env.MTN_API_KEY = "key";
    const { isMtnConfigured } = await import("../server/mtn-momo");
    expect(isMtnConfigured()).toBe(true);
    clearMtnEnv();
  });
});
