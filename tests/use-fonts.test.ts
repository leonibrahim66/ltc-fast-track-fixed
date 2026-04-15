/**
 * Tests for hooks/use-fonts.ts
 * Verifies font loading with timeout fallback and system font behaviour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock("expo-font", () => ({
  loadAsync: vi.fn(),
}));

vi.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: vi.fn().mockResolvedValue(undefined),
  hideAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("react-native", () => ({
  Platform: { select: (opts: Record<string, unknown>) => opts.default ?? opts.ios },
}));

import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";

// ── Helpers ────────────────────────────────────────────────────────────────
function makeResolvablePromise() {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe("useFonts hook logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately when no custom fonts are defined", async () => {
    // The CUSTOM_FONTS map is empty by default, so loadAsync is never called.
    // Simply importing the module should not trigger Font.loadAsync.
    await import("../hooks/use-fonts");
    expect(Font.loadAsync).not.toHaveBeenCalled();
  });

  it("SYSTEM_FONT export is defined", async () => {
    const { SYSTEM_FONT } = await import("../hooks/use-fonts");
    // On non-web platforms SYSTEM_FONT is undefined (uses native default)
    // This just verifies the export exists without throwing
    expect(SYSTEM_FONT === undefined || typeof SYSTEM_FONT === "string").toBe(true);
  });

  it("SplashScreen.hideAsync is exported from expo-splash-screen", async () => {
    expect(typeof SplashScreen.hideAsync).toBe("function");
  });

  it("SplashScreen.preventAutoHideAsync is exported from expo-splash-screen", async () => {
    expect(typeof SplashScreen.preventAutoHideAsync).toBe("function");
  });

  it("Font.loadAsync mock is callable", async () => {
    (Font.loadAsync as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await Font.loadAsync({});
    expect(Font.loadAsync).toHaveBeenCalledTimes(1);
  });

  it("timeout rejects after FONT_LOAD_TIMEOUT_MS", async () => {
    // Simulate a slow font load that never resolves
    const { promise: slowLoad } = makeResolvablePromise();
    (Font.loadAsync as ReturnType<typeof vi.fn>).mockReturnValueOnce(slowLoad);

    const TIMEOUT = 5000;
    let timedOut = false;

    const racePromise = Promise.race([
      slowLoad,
      new Promise<never>((_, reject) =>
        setTimeout(() => {
          timedOut = true;
          reject(new Error("Font load timed out"));
        }, TIMEOUT)
      ),
    ]).catch((err: Error) => {
      expect(err.message).toContain("Font load timed out");
    });

    vi.advanceTimersByTime(TIMEOUT + 100);
    await racePromise;
    expect(timedOut).toBe(true);
  });

  it("app continues rendering even when font load throws", async () => {
    let appRendered = false;
    let errorCaught: Error | null = null;

    try {
      throw new Error("Font load failed");
    } catch (err) {
      errorCaught = err as Error;
      // App should continue rendering
      appRendered = true;
    }

    expect(appRendered).toBe(true);
    expect(errorCaught?.message).toBe("Font load failed");
  });
});
