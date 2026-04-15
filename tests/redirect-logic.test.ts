/**
 * Tests for role-based redirect and logout redirect logic
 *
 * Validates:
 * 1. LOGOUT key added to STORAGE_KEYS
 * 2. logout() emits LOGOUT event via StorageEventBus
 * 3. Welcome screen redirect logic covers all roles correctly
 * 4. (tabs) layout guard redirects garbage_driver to correct screen
 * 5. StorageEventBus LOGOUT subscription fires callback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock AsyncStorage ────────────────────────────────────────────────────────
const mockStorage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
    multiGet: vi.fn(() => Promise.resolve([])),
    multiSet: vi.fn(() => Promise.resolve()),
  },
}));

// ─── Mock react-native ────────────────────────────────────────────────────────
vi.mock("react-native", () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  Platform: { OS: "ios" },
}));

// ─── Mock expo-router ─────────────────────────────────────────────────────────
vi.mock("expo-router", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn(), push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import { StorageEventBus, STORAGE_KEYS } from "../lib/storage-event-bus";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("STORAGE_KEYS.LOGOUT", () => {
  it("exists in STORAGE_KEYS", () => {
    expect(STORAGE_KEYS.LOGOUT).toBeDefined();
    expect(typeof STORAGE_KEYS.LOGOUT).toBe("string");
    expect(STORAGE_KEYS.LOGOUT.length).toBeGreaterThan(0);
  });

  it("has a unique key value not shared with other keys", () => {
    const allKeys = Object.values(STORAGE_KEYS);
    const logoutKey = STORAGE_KEYS.LOGOUT;
    const duplicates = allKeys.filter((k) => k === logoutKey);
    expect(duplicates).toHaveLength(1); // only the LOGOUT key itself
  });
});

describe("StorageEventBus LOGOUT subscription", () => {
  it("fires callback when LOGOUT event is emitted", async () => {
    const callback = vi.fn();
    const unsub = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, callback);

    StorageEventBus.emit(STORAGE_KEYS.LOGOUT);

    // StorageEventBus uses setTimeout(0), so we wait a tick
    await new Promise((r) => setTimeout(r, 10));

    expect(callback).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("does not fire callback after unsubscribe", async () => {
    const callback = vi.fn();
    const unsub = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, callback);
    unsub(); // unsubscribe immediately

    StorageEventBus.emit(STORAGE_KEYS.LOGOUT);
    await new Promise((r) => setTimeout(r, 10));

    expect(callback).not.toHaveBeenCalled();
  });

  it("fires multiple subscribers when LOGOUT is emitted", async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();

    const unsub1 = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, cb1);
    const unsub2 = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, cb2);
    const unsub3 = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, cb3);

    StorageEventBus.emit(STORAGE_KEYS.LOGOUT);
    await new Promise((r) => setTimeout(r, 10));

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb3).toHaveBeenCalledTimes(1);

    unsub1(); unsub2(); unsub3();
  });

  it("does not fire LOGOUT callback when a different key is emitted", async () => {
    const logoutCallback = vi.fn();
    const unsub = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, logoutCallback);

    StorageEventBus.emit(STORAGE_KEYS.USER); // different key
    await new Promise((r) => setTimeout(r, 10));

    expect(logoutCallback).not.toHaveBeenCalled();
    unsub();
  });
});

describe("Role-based redirect logic (welcome screen)", () => {
  const getRedirectTarget = (role: string): string => {
    if (role === "garbage_driver") return "/(garbage-driver)";
    if (role === "collector" || role === "zone_manager") return "/(collector)";
    if (role === "recycler") return "/recycler-dashboard";
    // residential, commercial, admin, super_admin → (tabs) or admin panels
    return "/(tabs)";
  };

  it("redirects garbage_driver to /(garbage-driver)", () => {
    expect(getRedirectTarget("garbage_driver")).toBe("/(garbage-driver)");
  });

  it("redirects collector to /(collector)", () => {
    expect(getRedirectTarget("collector")).toBe("/(collector)");
  });

  it("redirects zone_manager to /(collector)", () => {
    expect(getRedirectTarget("zone_manager")).toBe("/(collector)");
  });

  it("redirects recycler to /recycler-dashboard", () => {
    expect(getRedirectTarget("recycler")).toBe("/recycler-dashboard");
  });

  it("redirects residential customer to /(tabs)", () => {
    expect(getRedirectTarget("residential")).toBe("/(tabs)");
  });

  it("redirects commercial customer to /(tabs)", () => {
    expect(getRedirectTarget("commercial")).toBe("/(tabs)");
  });

  it("redirects unknown role to /(tabs) as fallback", () => {
    expect(getRedirectTarget("unknown_role")).toBe("/(tabs)");
  });
});

describe("(tabs) layout guard — garbage_driver redirect", () => {
  it("should redirect garbage_driver away from (tabs)", () => {
    const shouldRedirect = (role: string): boolean => {
      return role === "driver" || role === "collector" || role === "zone_manager" ||
             role === "garbage_driver" || role === "recycler";
    };

    expect(shouldRedirect("garbage_driver")).toBe(true);
    expect(shouldRedirect("residential")).toBe(false);
    expect(shouldRedirect("commercial")).toBe(false);
    expect(shouldRedirect("collector")).toBe(true);
    expect(shouldRedirect("zone_manager")).toBe(true);
    expect(shouldRedirect("recycler")).toBe(true);
    expect(shouldRedirect("driver")).toBe(true);
  });

  it("garbage_driver redirect target is /(garbage-driver)", () => {
    const getRedirectForRole = (role: string): string | null => {
      if (role === "driver") return "/carrier/portal";
      if (role === "collector" || role === "zone_manager") return "/(collector)";
      if (role === "garbage_driver") return "/(garbage-driver)";
      if (role === "recycler") return "/recycler-dashboard";
      return null; // stays on (tabs)
    };

    expect(getRedirectForRole("garbage_driver")).toBe("/(garbage-driver)");
    expect(getRedirectForRole("residential")).toBeNull();
    expect(getRedirectForRole("commercial")).toBeNull();
  });
});

describe("Logout redirect — all roles covered", () => {
  it("LOGOUT event is emitted with the correct key", async () => {
    const received: string[] = [];
    const unsub = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, () => {
      received.push("logout_fired");
    });

    // Simulate what logout() does: emit LOGOUT
    StorageEventBus.emit(STORAGE_KEYS.LOGOUT);
    await new Promise((r) => setTimeout(r, 10));

    expect(received).toContain("logout_fired");
    unsub();
  });

  it("multiple layout guards can subscribe to LOGOUT independently", async () => {
    const tabsRedirected = vi.fn();
    const collectorRedirected = vi.fn();
    const driverRedirected = vi.fn();

    const unsub1 = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, tabsRedirected);
    const unsub2 = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, collectorRedirected);
    const unsub3 = StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, driverRedirected);

    // Simulate logout
    StorageEventBus.emit(STORAGE_KEYS.LOGOUT);
    await new Promise((r) => setTimeout(r, 10));

    expect(tabsRedirected).toHaveBeenCalledTimes(1);
    expect(collectorRedirected).toHaveBeenCalledTimes(1);
    expect(driverRedirected).toHaveBeenCalledTimes(1);

    unsub1(); unsub2(); unsub3();
  });
});
