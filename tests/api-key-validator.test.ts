/**
 * tests/api-key-validator.test.ts
 *
 * Unit tests for the API key validator and related service initialization fixes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateAllApiKeys, logApiKeyReport } from "@/lib/api-key-validator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ENV_KEYS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY",
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
  "MTN_BASE_URL",
  "MTN_COLLECTION_KEY",
  "MTN_DISBURSEMENT_KEY",
  "MTN_API_USER",
  "MTN_API_KEY",
  "EXPO_PUBLIC_API_BASE_URL",
];

function setEnv(overrides: Record<string, string>) {
  for (const key of ENV_KEYS) {
    process.env[key] = overrides[key] ?? "";
  }
}

function clearEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("validateAllApiKeys", () => {
  afterEach(() => {
    clearEnv();
  });

  it("returns 5 service entries", () => {
    clearEnv();
    const results = validateAllApiKeys();
    expect(results).toHaveLength(5);
    const names = results.map((r) => r.name);
    expect(names).toContain("Supabase");
    expect(names).toContain("Firebase");
    expect(names).toContain("Google Maps");
    expect(names).toContain("MTN Mobile Money");
    expect(names).toContain("Backend API");
  });

  it("marks Supabase as not configured when env vars are missing", () => {
    clearEnv();
    const results = validateAllApiKeys();
    const supabase = results.find((r) => r.name === "Supabase")!;
    expect(supabase.configured).toBe(false);
    expect(supabase.missingKeys).toContain("EXPO_PUBLIC_SUPABASE_URL");
    expect(supabase.missingKeys).toContain("EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY");
  });

  it("marks Supabase as configured when both env vars are present", () => {
    setEnv({
      EXPO_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY: "test-anon-key",
    });
    const results = validateAllApiKeys();
    const supabase = results.find((r) => r.name === "Supabase")!;
    expect(supabase.configured).toBe(true);
    expect(supabase.missingKeys).toHaveLength(0);
    expect(supabase.presentKeys).toContain("EXPO_PUBLIC_SUPABASE_URL");
    expect(supabase.presentKeys).toContain("EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY");
  });

  it("marks Firebase as not configured when all keys are missing", () => {
    clearEnv();
    const results = validateAllApiKeys();
    const firebase = results.find((r) => r.name === "Firebase")!;
    expect(firebase.configured).toBe(false);
    expect(firebase.missingKeys.length).toBeGreaterThanOrEqual(3);
  });

  it("marks Firebase as configured when all 6 keys are present", () => {
    setEnv({
      EXPO_PUBLIC_FIREBASE_API_KEY: "AIzaTest",
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "test.appspot.com",
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      EXPO_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
    });
    const results = validateAllApiKeys();
    const firebase = results.find((r) => r.name === "Firebase")!;
    expect(firebase.configured).toBe(true);
    expect(firebase.missingKeys).toHaveLength(0);
  });

  it("marks Google Maps as not configured when key is missing", () => {
    clearEnv();
    const results = validateAllApiKeys();
    const maps = results.find((r) => r.name === "Google Maps")!;
    expect(maps.configured).toBe(false);
    expect(maps.missingKeys).toContain("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");
  });

  it("marks Google Maps as configured when key is present", () => {
    setEnv({ EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: "AIzaTestMapsKey" });
    const results = validateAllApiKeys();
    const maps = results.find((r) => r.name === "Google Maps")!;
    expect(maps.configured).toBe(true);
    expect(maps.presentKeys).toContain("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");
  });

  it("marks MTN as not configured when all keys are missing", () => {
    clearEnv();
    const results = validateAllApiKeys();
    const mtn = results.find((r) => r.name === "MTN Mobile Money")!;
    expect(mtn.configured).toBe(false);
    expect(mtn.missingKeys.length).toBeGreaterThan(0);
  });

  it("marks MTN as configured when server-side key names are used", () => {
    setEnv({
      MTN_BASE_URL: "https://sandbox.momodeveloper.mtn.com",
      MTN_COLLECTION_KEY: "test-collection-key",
      MTN_DISBURSEMENT_KEY: "test-disbursement-key",
      MTN_API_USER: "test-user-id",
      MTN_API_KEY: "test-api-key",
    });
    const results = validateAllApiKeys();
    const mtn = results.find((r) => r.name === "MTN Mobile Money")!;
    expect(mtn.configured).toBe(true);
    expect(mtn.missingKeys).toHaveLength(0);
  });

  it("marks MTN as configured when frontend-side key names are used (aliases)", () => {
    // Set env vars directly (not via setEnv helper which only covers server-side names)
    process.env.MTN_BASE_URL = "https://sandbox.momodeveloper.mtn.com";
    process.env.MTN_MOMO_SUBSCRIPTION_KEY = "test-collection-key";  // frontend alias
    process.env.MTN_DISBURSEMENT_KEY = "test-disbursement-key";
    process.env.MTN_MOMO_USER_ID = "test-user-id";                  // frontend alias
    process.env.MTN_MOMO_API_KEY = "test-api-key";                  // frontend alias
    // Clear server-side names so only aliases are active
    delete process.env.MTN_COLLECTION_KEY;
    delete process.env.MTN_COLLECTION_SUBSCRIPTION_KEY;
    delete process.env.MTN_API_USER;
    delete process.env.MTN_API_KEY;
    const results = validateAllApiKeys();
    const mtn = results.find((r) => r.name === "MTN Mobile Money")!;
    expect(mtn.configured).toBe(true);
    // Cleanup
    delete process.env.MTN_BASE_URL;
    delete process.env.MTN_MOMO_SUBSCRIPTION_KEY;
    delete process.env.MTN_DISBURSEMENT_KEY;
    delete process.env.MTN_MOMO_USER_ID;
    delete process.env.MTN_MOMO_API_KEY;
  });

  it("marks Backend API as always configured (auto-derives URL)", () => {
    clearEnv();
    const results = validateAllApiKeys();
    const backend = results.find((r) => r.name === "Backend API")!;
    expect(backend.configured).toBe(true);
  });

  it("Backend API shows EXPO_PUBLIC_API_BASE_URL in presentKeys when set", () => {
    setEnv({ EXPO_PUBLIC_API_BASE_URL: "https://api.example.com" });
    const results = validateAllApiKeys();
    const backend = results.find((r) => r.name === "Backend API")!;
    expect(backend.presentKeys).toContain("EXPO_PUBLIC_API_BASE_URL");
  });
});

describe("logApiKeyReport", () => {
  afterEach(() => {
    clearEnv();
    vi.restoreAllMocks();
  });

  it("calls console.warn when services are missing keys", () => {
    clearEnv();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logApiKeyReport();
    expect(warnSpy).toHaveBeenCalled();
    const output = warnSpy.mock.calls[0][0] as string;
    expect(output).toContain("LTC Fast Track");
    expect(output).toContain("❌");
  });

  it("calls console.log (not warn) when all services are configured", () => {
    setEnv({
      EXPO_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY: "test-anon-key",
      EXPO_PUBLIC_FIREBASE_API_KEY: "AIzaTest",
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "test.appspot.com",
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      EXPO_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: "AIzaTestMapsKey",
      MTN_BASE_URL: "https://sandbox.momodeveloper.mtn.com",
      MTN_COLLECTION_KEY: "test-collection-key",
      MTN_DISBURSEMENT_KEY: "test-disbursement-key",
      MTN_API_USER: "test-user-id",
      MTN_API_KEY: "test-api-key",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logApiKeyReport();
    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain("✅");
    expect(output).toContain("All services configured");
  });

  it("report includes all 5 service names", () => {
    clearEnv();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logApiKeyReport();
    const output = warnSpy.mock.calls[0][0] as string;
    expect(output).toContain("Supabase");
    expect(output).toContain("Firebase");
    expect(output).toContain("Google Maps");
    expect(output).toContain("MTN Mobile Money");
    expect(output).toContain("Backend API");
  });
});

describe("Supabase initialization", () => {
  it("isSupabaseConfigured returns false when env vars are empty", async () => {
    const original = {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      key: process.env.EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY,
    };
    process.env.EXPO_PUBLIC_SUPABASE_URL = "";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY = "";
    const { isSupabaseConfigured } = await import("@/lib/supabase");
    expect(isSupabaseConfigured()).toBe(false);
    process.env.EXPO_PUBLIC_SUPABASE_URL = original.url ?? "";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_PUBLIC_KEY = original.key ?? "";
  });

  it("supabase client is always exported (non-null)", async () => {
    const { supabase } = await import("@/lib/supabase");
    expect(supabase).not.toBeNull();
    expect(typeof supabase.from).toBe("function");
  });
});

describe("map-display-screen hardcoded key removal", () => {
  it("map-display-screen.tsx no longer contains a hardcoded AIzaSy key", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "components/map-display-screen.tsx"),
      "utf-8"
    );
    expect(content).not.toMatch(/AIzaSy[A-Za-z0-9_-]{33}/);
    expect(content).toContain("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");
  });
});

describe("MTN config alias support", () => {
  it("getMtnMomoConfig uses MTN_COLLECTION_KEY alias when MTN_MOMO_SUBSCRIPTION_KEY is absent", async () => {
    process.env.MTN_MOMO_SUBSCRIPTION_KEY = "";
    process.env.MTN_COLLECTION_SUBSCRIPTION_KEY = "";
    process.env.MTN_COLLECTION_KEY = "alias-collection-key";
    process.env.MTN_API_USER = "alias-user";
    process.env.MTN_MOMO_USER_ID = "";
    process.env.MTN_API_KEY = "alias-api-key";
    process.env.MTN_MOMO_API_KEY = "";
    process.env.MTN_BASE_URL = "https://sandbox.momodeveloper.mtn.com";

    // Dynamically import to pick up env changes
    const mod = await import("@/lib/payment-services/config");
    const config = mod.getMtnMomoConfig();
    expect(config.subscriptionKey).toBe("alias-collection-key");
    expect(config.userId).toBe("alias-user");
    expect(config.userApiKey).toBe("alias-api-key");

    // Cleanup
    delete process.env.MTN_COLLECTION_KEY;
    delete process.env.MTN_API_USER;
    delete process.env.MTN_API_KEY;
    delete process.env.MTN_BASE_URL;
  });
});
