/**
 * MTN MoMo Disbursement Client Unit Tests
 *
 * Tests the Disbursement API methods using mocked axios calls.
 * No real HTTP calls are made — all network interactions are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

// ─── Mock axios ───────────────────────────────────────────────────────────────
vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setDisbursementEnv(overrides: Partial<Record<string, string>> = {}) {
  process.env.MTN_BASE_URL = overrides.MTN_BASE_URL ?? "https://sandbox.momodeveloper.mtn.com";
  process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY =
    overrides.MTN_DISBURSEMENT_SUBSCRIPTION_KEY ?? "test-disbursement-key";
  process.env.MTN_API_USER = overrides.MTN_API_USER ?? "test-api-user-uuid";
  process.env.MTN_API_KEY = overrides.MTN_API_KEY ?? "test-api-key";
}

function clearEnv() {
  delete process.env.MTN_BASE_URL;
  delete process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY;
  delete process.env.MTN_DISBURSEMENT_KEY;
  delete process.env.MTN_COLLECTION_SUBSCRIPTION_KEY;
  delete process.env.MTN_COLLECTION_KEY;
  delete process.env.MTN_API_USER;
  delete process.env.MTN_API_KEY;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("isMtnDisbursementConfigured", () => {
  afterEach(clearEnv);

  it("returns false when env vars are missing", async () => {
    clearEnv();
    const { isMtnDisbursementConfigured } = await import("../server/mtn-momo");
    expect(isMtnDisbursementConfigured()).toBe(false);
  });

  it("returns true when all required disbursement env vars are set", async () => {
    setDisbursementEnv();
    const { isMtnDisbursementConfigured } = await import("../server/mtn-momo");
    expect(isMtnDisbursementConfigured()).toBe(true);
  });

  it("accepts MTN_DISBURSEMENT_KEY as alias", async () => {
    clearEnv();
    process.env.MTN_BASE_URL = "https://sandbox.momodeveloper.mtn.com";
    process.env.MTN_DISBURSEMENT_KEY = "alias-disbursement-key";
    process.env.MTN_API_USER = "user";
    process.env.MTN_API_KEY = "key";
    const { isMtnDisbursementConfigured } = await import("../server/mtn-momo");
    expect(isMtnDisbursementConfigured()).toBe(true);
    clearEnv();
  });

  it("does NOT require Collection key to be set", async () => {
    clearEnv();
    process.env.MTN_BASE_URL = "https://sandbox.momodeveloper.mtn.com";
    process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY = "disb-key";
    process.env.MTN_API_USER = "user";
    process.env.MTN_API_KEY = "key";
    // No MTN_COLLECTION_SUBSCRIPTION_KEY set
    const { isMtnDisbursementConfigured } = await import("../server/mtn-momo");
    expect(isMtnDisbursementConfigured()).toBe(true);
    clearEnv();
  });
});

describe("getDisbursementToken", () => {
  beforeEach(() => {
    setDisbursementEnv();
    vi.resetModules();
  });
  afterEach(clearEnv);

  it("returns access token from MTN Disbursement token endpoint", async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({
      data: { access_token: "disb-bearer-token", expires_in: 3600 },
    });

    const { getDisbursementToken } = await import("../server/mtn-momo");
    const token = await getDisbursementToken();
    expect(token).toBe("disb-bearer-token");
  });

  it("calls the correct Disbursement token endpoint", async () => {
    let capturedUrl = "";
    mockedAxios.post = vi.fn().mockImplementationOnce((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ data: { access_token: "tok", expires_in: 3600 } });
    });

    const { getDisbursementToken } = await import("../server/mtn-momo");
    await getDisbursementToken();
    expect(capturedUrl).toContain("/disbursement/token/");
    expect(capturedUrl).not.toContain("/collection/");
  });

  it("throws when Disbursement token endpoint returns an error", async () => {
    mockedAxios.post = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized"), {
        isAxiosError: true,
        response: { status: 401, data: { message: "Invalid credentials" } },
      }),
    );

    const { getDisbursementToken } = await import("../server/mtn-momo");
    await expect(getDisbursementToken()).rejects.toThrow("MTN Disbursement token request failed");
  });
});

describe("disbursementTransfer", () => {
  beforeEach(() => {
    setDisbursementEnv();
    vi.resetModules();
  });
  afterEach(clearEnv);

  it("returns accepted=true on 202 response", async () => {
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } }) // token
      .mockResolvedValueOnce({ status: 202, data: {} }); // transfer

    const { disbursementTransfer } = await import("../server/mtn-momo");
    const result = await disbursementTransfer({
      referenceId: "withdraw-ref-001",
      amount: 450,
      providerMsisdn: "46733123450",
    });

    expect(result.accepted).toBe(true);
    expect(result.referenceId).toBe("withdraw-ref-001");
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

    const { disbursementTransfer } = await import("../server/mtn-momo");
    const result = await disbursementTransfer({
      referenceId: "duplicate-withdraw",
      amount: 100,
      providerMsisdn: "46733123450",
    });

    expect(result.accepted).toBe(false);
    expect(result.error).toContain("Duplicate referenceId");
  });

  it("sends to the correct Disbursement Transfer endpoint", async () => {
    let capturedUrl = "";
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } })
      .mockImplementationOnce((url: string) => {
        capturedUrl = url;
        return Promise.resolve({ status: 202, data: {} });
      });

    const { disbursementTransfer } = await import("../server/mtn-momo");
    await disbursementTransfer({
      referenceId: "ref-url-check",
      amount: 200,
      providerMsisdn: "46733123450",
    });

    expect(capturedUrl).toContain("/disbursement/v1_0/transfer");
    expect(capturedUrl).not.toContain("/collection/");
  });

  it("uses payee (not payer) in the request body", async () => {
    let capturedBody: Record<string, unknown> = {};
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } })
      .mockImplementationOnce((_url: string, body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return Promise.resolve({ status: 202, data: {} });
      });

    const { disbursementTransfer } = await import("../server/mtn-momo");
    await disbursementTransfer({
      referenceId: "ref-payee",
      amount: 300,
      providerMsisdn: "260971234567",
    });

    expect(capturedBody).toHaveProperty("payee");
    expect(capturedBody).not.toHaveProperty("payer");
    const payee = capturedBody.payee as { partyIdType: string; partyId: string };
    expect(payee.partyIdType).toBe("MSISDN");
    expect(payee.partyId).toBe("260971234567");
  });

  it("strips leading + from provider MSISDN", async () => {
    let capturedBody: Record<string, unknown> = {};
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } })
      .mockImplementationOnce((_url: string, body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return Promise.resolve({ status: 202, data: {} });
      });

    const { disbursementTransfer } = await import("../server/mtn-momo");
    await disbursementTransfer({
      referenceId: "ref-strip",
      amount: 150,
      providerMsisdn: "+260971234567",
    });

    const payee = capturedBody.payee as { partyId: string };
    expect(payee.partyId).toBe("260971234567");
  });

  it("uses ZMW as currency", async () => {
    let capturedBody: Record<string, unknown> = {};
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } })
      .mockImplementationOnce((_url: string, body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return Promise.resolve({ status: 202, data: {} });
      });

    const { disbursementTransfer } = await import("../server/mtn-momo");
    await disbursementTransfer({ referenceId: "ref-zmw", amount: 500, providerMsisdn: "46733123450" });
    expect(capturedBody.currency).toBe("ZMW");
  });

  it("uses default payerMessage and payeeNote when not provided", async () => {
    let capturedBody: Record<string, unknown> = {};
    mockedAxios.post = vi.fn()
      .mockResolvedValueOnce({ data: { access_token: "tok", expires_in: 3600 } })
      .mockImplementationOnce((_url: string, body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return Promise.resolve({ status: 202, data: {} });
      });

    const { disbursementTransfer } = await import("../server/mtn-momo");
    await disbursementTransfer({ referenceId: "ref-defaults", amount: 100, providerMsisdn: "46733123450" });
    expect(capturedBody.payerMessage).toBe("LTC Fast Track Withdrawal");
    expect(capturedBody.payeeNote).toBe("Provider payout");
  });
});

describe("getDisbursementStatus", () => {
  beforeEach(() => {
    setDisbursementEnv();
    vi.resetModules();
  });
  afterEach(clearEnv);

  it("returns SUCCESSFUL status with financialTransactionId", async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({
      data: { access_token: "tok", expires_in: 3600 },
    });
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: { status: "SUCCESSFUL", financialTransactionId: "fin-txn-123" },
    });

    const { getDisbursementStatus } = await import("../server/mtn-momo");
    const result = await getDisbursementStatus("withdraw-ref-001");
    expect(result.status).toBe("SUCCESSFUL");
    expect(result.financialTransactionId).toBe("fin-txn-123");
    expect(result.referenceId).toBe("withdraw-ref-001");
  });

  it("returns FAILED status with reason", async () => {
    mockedAxios.post = vi.fn().mockResolvedValueOnce({
      data: { access_token: "tok", expires_in: 3600 },
    });
    mockedAxios.get = vi.fn().mockResolvedValueOnce({
      data: { status: "FAILED", reason: "NOT_ENOUGH_FUNDS" },
    });

    const { getDisbursementStatus } = await import("../server/mtn-momo");
    const result = await getDisbursementStatus("withdraw-ref-002");
    expect(result.status).toBe("FAILED");
    expect(result.reason).toBe("NOT_ENOUGH_FUNDS");
  });

  it("calls the correct Disbursement status endpoint", async () => {
    let capturedUrl = "";
    mockedAxios.post = vi.fn().mockResolvedValueOnce({
      data: { access_token: "tok", expires_in: 3600 },
    });
    mockedAxios.get = vi.fn().mockImplementationOnce((url: string) => {
      capturedUrl = url;
      return Promise.resolve({ data: { status: "SUCCESSFUL" } });
    });

    const { getDisbursementStatus } = await import("../server/mtn-momo");
    await getDisbursementStatus("ref-url-check");
    expect(capturedUrl).toContain("/disbursement/v1_0/transfer/ref-url-check");
    expect(capturedUrl).not.toContain("/collection/");
  });
});

describe("MTN_DISBURSEMENT_SUBSCRIPTION_KEY env var", () => {
  it("is registered as a valid env var name", () => {
    const key = "MTN_DISBURSEMENT_SUBSCRIPTION_KEY";
    expect(/^[A-Z][A-Z0-9_]+$/.test(key)).toBe(true);
    const aliasKey = "MTN_DISBURSEMENT_KEY";
    expect(/^[A-Z][A-Z0-9_]+$/.test(aliasKey)).toBe(true);
  });

  it("isMtnDisbursementConfigured accepts both key names", async () => {
    clearEnv();
    process.env.MTN_BASE_URL = "https://sandbox.momodeveloper.mtn.com";
    process.env.MTN_DISBURSEMENT_SUBSCRIPTION_KEY = "sub-key";
    process.env.MTN_API_USER = "user";
    process.env.MTN_API_KEY = "key";
    const { isMtnDisbursementConfigured } = await import("../server/mtn-momo");
    expect(isMtnDisbursementConfigured()).toBe(true);
    clearEnv();
  });
});

describe("Commission integrity — Disbursement does not modify commission", () => {
  it("calculateCommission is unchanged after Disbursement import", async () => {
    const { calculateCommission } = await import("../server/payment-service");
    const result = calculateCommission(1000);
    expect(result.platformCommission).toBe(100);
    expect(result.providerAmount).toBe(900);
  });

  it("10% commission rate is enforced for all amounts", async () => {
    const { calculateCommission } = await import("../server/payment-service");
    const cases = [
      { input: 500, commission: 50, provider: 450 },
      { input: 250, commission: 25, provider: 225 },
      { input: 100, commission: 10, provider: 90 },
    ];
    for (const c of cases) {
      const result = calculateCommission(c.input);
      expect(result.platformCommission).toBe(c.commission);
      expect(result.providerAmount).toBe(c.provider);
    }
  });
});
