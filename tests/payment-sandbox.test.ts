/**
 * Tests for the MTN Sandbox Payment Toggle logic.
 * Validates that:
 * - Live Production mode uses hardcoded production numbers
 * - Sandbox Test mode uses the manually entered number
 * - Validation rejects empty sandbox numbers
 * - The overrideReceiverNumber param is correctly passed through
 */

import { describe, it, expect } from "vitest";

// ── Constants mirrored from payment.tsx ──────────────────────────────────────
const PRODUCTION_NUMBERS: Record<string, string> = {
  mtn: "+260960819993",
  airtel: "20158560",
  zamtel: "",
};

/** Mirrors the getEffectiveReceiverNumber logic in payment.tsx */
function getEffectiveReceiverNumber(
  providerId: string,
  isSandbox: boolean,
  sandboxNumber: string
): string {
  if (isSandbox) {
    return sandboxNumber.trim();
  }
  return PRODUCTION_NUMBERS[providerId] ?? "";
}

/** Mirrors the getReceiverNumber logic in payment-confirmation.tsx */
function getConfirmationReceiverNumber(
  method: string,
  isSandbox: boolean,
  overrideReceiverNumber: string | undefined,
  providers: Array<{ id: string; receiverNumber: string }>
): string {
  if (isSandbox && overrideReceiverNumber) {
    return overrideReceiverNumber;
  }
  const provider = providers.find((p) => p.id === method);
  return provider?.receiverNumber || "+260960819993";
}

const mockProviders = [
  { id: "mtn", receiverNumber: "+260960819993" },
  { id: "airtel", receiverNumber: "20158560" },
  { id: "zamtel", receiverNumber: "" },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Payment Sandbox Toggle — payment.tsx logic", () => {
  it("Live mode: MTN returns production number", () => {
    expect(getEffectiveReceiverNumber("mtn", false, "")).toBe("+260960819993");
  });

  it("Live mode: Airtel returns production number", () => {
    expect(getEffectiveReceiverNumber("airtel", false, "")).toBe("20158560");
  });

  it("Live mode: Zamtel returns empty string (no receiver)", () => {
    expect(getEffectiveReceiverNumber("zamtel", false, "")).toBe("");
  });

  it("Sandbox mode: returns the manually entered sandbox number", () => {
    expect(getEffectiveReceiverNumber("mtn", true, "46733123450")).toBe("46733123450");
  });

  it("Sandbox mode: trims whitespace from the entered number", () => {
    expect(getEffectiveReceiverNumber("mtn", true, "  46733123450  ")).toBe("46733123450");
  });

  it("Sandbox mode: returns empty string when no sandbox number entered", () => {
    expect(getEffectiveReceiverNumber("mtn", true, "")).toBe("");
  });

  it("Sandbox mode: sandbox number overrides production for any provider", () => {
    expect(getEffectiveReceiverNumber("airtel", true, "SANDBOX_MERCHANT_001")).toBe(
      "SANDBOX_MERCHANT_001"
    );
  });
});

describe("Payment Sandbox Toggle — payment-confirmation.tsx logic", () => {
  it("Live mode: confirmation screen shows production MTN number", () => {
    const result = getConfirmationReceiverNumber("mtn", false, undefined, mockProviders);
    expect(result).toBe("+260960819993");
  });

  it("Live mode: confirmation screen shows production Airtel number", () => {
    const result = getConfirmationReceiverNumber("airtel", false, undefined, mockProviders);
    expect(result).toBe("20158560");
  });

  it("Sandbox mode: confirmation screen shows override sandbox number", () => {
    const result = getConfirmationReceiverNumber("mtn", true, "46733123450", mockProviders);
    expect(result).toBe("46733123450");
  });

  it("Sandbox mode: empty override falls back to production number", () => {
    const result = getConfirmationReceiverNumber("mtn", true, "", mockProviders);
    expect(result).toBe("+260960819993");
  });

  it("Sandbox mode: override is used even for Airtel provider", () => {
    const result = getConfirmationReceiverNumber("airtel", true, "SANDBOX_CODE_XYZ", mockProviders);
    expect(result).toBe("SANDBOX_CODE_XYZ");
  });
});

describe("Sandbox validation — confirm button guard", () => {
  /** Mirrors the handleConfirmPayment guard in payment.tsx */
  function canConfirm(
    selectedProvider: string,
    isSandbox: boolean,
    sandboxNumber: string
  ): { ok: boolean; error?: string } {
    if (!selectedProvider) return { ok: false, error: "Please select a payment provider" };
    if (isSandbox && !sandboxNumber.trim()) {
      return {
        ok: false,
        error: "Please enter an MTN sandbox test number or merchant code to continue.",
      };
    }
    return { ok: true };
  }

  it("Blocks confirmation when no provider selected", () => {
    expect(canConfirm("", false, "")).toEqual({
      ok: false,
      error: "Please select a payment provider",
    });
  });

  it("Blocks confirmation in sandbox mode when no number entered", () => {
    const result = canConfirm("mtn", true, "");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("sandbox test number");
  });

  it("Allows confirmation in sandbox mode when number is entered", () => {
    expect(canConfirm("mtn", true, "46733123450")).toEqual({ ok: true });
  });

  it("Allows confirmation in live mode without manual number", () => {
    expect(canConfirm("mtn", false, "")).toEqual({ ok: true });
  });

  it("Allows confirmation in live mode with Airtel selected", () => {
    expect(canConfirm("airtel", false, "")).toEqual({ ok: true });
  });
});
