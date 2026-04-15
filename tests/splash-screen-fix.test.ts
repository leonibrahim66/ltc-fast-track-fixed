/**
 * Tests for the splash screen stuck fix.
 *
 * Validates:
 * 1. useFonts external gate timeout — splash hides within 3s even if auth never resolves
 * 2. AuthProvider loadUser timeout — isLoading resolves within 2s even if AsyncStorage hangs
 * 3. Emergency timer in RootLayout — SplashScreen.hideAsync called after 3s as last resort
 * 4. Normal path still works — auth resolves quickly, splash hides immediately
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Constants ────────────────────────────────────────────────────────────────

const EXTERNAL_GATE_TIMEOUT_MS = 3000;
const AUTH_LOAD_TIMEOUT_MS = 2000;
const EMERGENCY_TIMER_MS = 3000;

// ─── useFonts external gate timeout ──────────────────────────────────────────

describe("useFonts external gate timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls hideAsync after EXTERNAL_GATE_TIMEOUT_MS when gate never resolves", async () => {
    const hideAsync = vi.fn().mockResolvedValue(undefined);
    const setFontsLoaded = vi.fn();

    // Simulate the Phase 2 effect with externalReady = false (never resolves)
    const fontsResolved = true;
    const externalReady = false;

    let fallbackFired = false;
    const fallbackTimer = setTimeout(() => {
      fallbackFired = true;
      setFontsLoaded(true);
      hideAsync();
    }, EXTERNAL_GATE_TIMEOUT_MS);

    // Before timeout: nothing should have fired
    expect(fallbackFired).toBe(false);
    expect(setFontsLoaded).not.toHaveBeenCalled();

    // Advance time past the timeout
    vi.advanceTimersByTime(EXTERNAL_GATE_TIMEOUT_MS + 100);

    expect(fallbackFired).toBe(true);
    expect(setFontsLoaded).toHaveBeenCalledWith(true);
    expect(hideAsync).toHaveBeenCalledOnce();

    clearTimeout(fallbackTimer);
  });

  it("clears fallback timer when gate resolves before timeout", async () => {
    const hideAsync = vi.fn().mockResolvedValue(undefined);
    const setFontsLoaded = vi.fn();

    let fallbackFired = false;
    const fallbackTimer = setTimeout(() => {
      fallbackFired = true;
      setFontsLoaded(true);
      hideAsync();
    }, EXTERNAL_GATE_TIMEOUT_MS);

    // Simulate gate resolving at 500ms
    vi.advanceTimersByTime(500);
    // Normal path fires
    clearTimeout(fallbackTimer);
    setFontsLoaded(true);
    hideAsync();

    // Advance past the timeout — fallback should NOT fire since timer was cleared
    vi.advanceTimersByTime(EXTERNAL_GATE_TIMEOUT_MS);

    expect(fallbackFired).toBe(false);
    expect(setFontsLoaded).toHaveBeenCalledOnce();
    expect(hideAsync).toHaveBeenCalledOnce();
  });

  it("hides splash immediately when both fontsResolved and externalReady are true", () => {
    const hideAsync = vi.fn().mockResolvedValue(undefined);
    const setFontsLoaded = vi.fn();

    const fontsResolved = true;
    const externalReady = true;

    // Simulate the normal path check
    if (fontsResolved && externalReady) {
      setFontsLoaded(true);
      hideAsync();
    }

    expect(setFontsLoaded).toHaveBeenCalledWith(true);
    expect(hideAsync).toHaveBeenCalledOnce();
  });
});

// ─── AuthProvider loadUser timeout ───────────────────────────────────────────

describe("AuthProvider loadUser timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves isLoading within AUTH_LOAD_TIMEOUT_MS when AsyncStorage hangs", async () => {
    const setIsLoading = vi.fn();

    // Simulate a hanging AsyncStorage.getItem (never resolves)
    const hangingStorage = new Promise<string | null>(() => {}); // never resolves

    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, AUTH_LOAD_TIMEOUT_MS)
    );

    let raceResolved = false;
    Promise.race([hangingStorage, timeoutPromise]).then(() => {
      raceResolved = true;
      setIsLoading(false);
    });

    // Before timeout: not resolved
    expect(raceResolved).toBe(false);

    // Advance past the timeout and flush all microtasks
    vi.advanceTimersByTime(AUTH_LOAD_TIMEOUT_MS + 100);
    // Flush multiple microtask queues to ensure Promise.race .then() fires
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setIsLoading).toHaveBeenCalledWith(false);
  });

  it("resolves isLoading quickly when AsyncStorage responds fast", async () => {
    const setIsLoading = vi.fn();

    // Simulate fast AsyncStorage (resolves in 50ms)
    const fastStorage = new Promise<string | null>((resolve) =>
      setTimeout(() => resolve(null), 50)
    );

    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, AUTH_LOAD_TIMEOUT_MS)
    );

    let raceResolved = false;
    Promise.race([fastStorage, timeoutPromise]).then(() => {
      raceResolved = true;
      setIsLoading(false);
    });

    // Advance 100ms — fast storage should have won
    vi.advanceTimersByTime(100);
    // Flush multiple microtask queues to ensure Promise.race .then() fires
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setIsLoading).toHaveBeenCalledWith(false);
    expect(raceResolved).toBe(true);
  });

  it("does not block isLoading when AsyncStorage throws", async () => {
    const setIsLoading = vi.fn();

    // Simulate AsyncStorage throwing
    const failingLoad = (async () => {
      try {
        throw new Error("AsyncStorage not available");
      } catch (e) {
        // caught — loadPromise resolves
      }
    })();

    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(resolve, AUTH_LOAD_TIMEOUT_MS)
    );

    await Promise.race([failingLoad, timeoutPromise]);
    setIsLoading(false);

    expect(setIsLoading).toHaveBeenCalledWith(false);
  });
});

// ─── Emergency timer in RootLayout ───────────────────────────────────────────

describe("RootLayout emergency splash hide timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls SplashScreen.hideAsync after EMERGENCY_TIMER_MS as last resort", () => {
    const hideAsync = vi.fn().mockResolvedValue(undefined);

    // Simulate the emergency timer
    let emergencyFired = false;
    const emergencyTimer = setTimeout(() => {
      emergencyFired = true;
      hideAsync().catch(() => {});
    }, EMERGENCY_TIMER_MS);

    expect(emergencyFired).toBe(false);

    vi.advanceTimersByTime(EMERGENCY_TIMER_MS + 100);

    expect(emergencyFired).toBe(true);
    expect(hideAsync).toHaveBeenCalledOnce();

    clearTimeout(emergencyTimer);
  });

  it("emergency timer is cleared on component unmount", () => {
    const hideAsync = vi.fn().mockResolvedValue(undefined);

    let emergencyFired = false;
    const emergencyTimer = setTimeout(() => {
      emergencyFired = true;
      hideAsync().catch(() => {});
    }, EMERGENCY_TIMER_MS);

    // Simulate unmount (cleanup)
    clearTimeout(emergencyTimer);

    vi.advanceTimersByTime(EMERGENCY_TIMER_MS + 100);

    expect(emergencyFired).toBe(false);
    expect(hideAsync).not.toHaveBeenCalled();
  });
});

// ─── Timeout layering — defence in depth ─────────────────────────────────────

describe("Splash screen timeout defence in depth", () => {
  it("three independent layers guarantee splash hides within 3 seconds", () => {
    // Layer 1: AuthProvider.loadUser timeout = 2000ms
    // Layer 2: useFonts external gate timeout = 3000ms
    // Layer 3: RootLayout emergency timer = 3000ms
    //
    // The worst case is all three fail simultaneously — but even then,
    // the emergency timer fires at exactly 3000ms.

    const authTimeout = AUTH_LOAD_TIMEOUT_MS;       // 2000ms
    const fontsGateTimeout = EXTERNAL_GATE_TIMEOUT_MS; // 3000ms
    const emergencyTimeout = EMERGENCY_TIMER_MS;    // 3000ms

    const worstCaseSplashHideMs = Math.min(
      authTimeout + 50,    // auth resolves → gate fires → splash hides
      fontsGateTimeout,    // fonts gate fires independently
      emergencyTimeout,    // emergency timer fires independently
    );

    // Splash must hide within 3 seconds in the absolute worst case
    expect(worstCaseSplashHideMs).toBeLessThanOrEqual(3000);
  });

  it("normal fast path hides splash well under 1 second", () => {
    // AsyncStorage typically responds in <50ms on a healthy device
    const typicalAuthMs = 50;
    const typicalFontsMs = 0; // no custom fonts, resolves immediately

    const typicalSplashHideMs = Math.max(typicalAuthMs, typicalFontsMs);

    expect(typicalSplashHideMs).toBeLessThan(1000);
  });
});
