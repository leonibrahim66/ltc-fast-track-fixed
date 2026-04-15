/**
 * hooks/use-fonts.ts
 *
 * Resilient font loading hook that:
 * 1. Races font loading against a 5-second timeout (shorter than fontfaceobserver's 6s limit)
 * 2. Catches any font load error (network failure, timeout, fontfaceobserver rejection)
 * 3. Falls back to the platform system font automatically
 * 4. Always calls SplashScreen.hideAsync() so the app never blocks on font loading
 * 5. Accepts an optional `externalReady` gate — when provided, the splash screen is only
 *    hidden once BOTH fonts are resolved AND externalReady is true. Use this to wait for
 *    the auth session to load before revealing the app, eliminating the welcome screen flash.
 *
 * Usage (basic):
 *   const { fontsLoaded, fontError } = useFonts();
 *
 * Usage (with auth gate):
 *   const { isLoading } = useAuth();
 *   const { fontsLoaded } = useFonts(!isLoading);
 */

import { useEffect, useState } from "react";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Platform } from "react-native";

/** Maximum ms to wait for a font before falling back to system font */
const FONT_LOAD_TIMEOUT_MS = 5000;

/**
 * Maximum ms to wait for the external gate (e.g. auth) before hiding the splash
 * screen anyway. This prevents the app from being stuck on the splash screen
 * when auth/AsyncStorage is slow or fails on a fresh APK install.
 */
const EXTERNAL_GATE_TIMEOUT_MS = 3000;

/**
 * Custom fonts to load.
 * Add entries here if you add font files to assets/fonts/.
 * Leave empty to use system fonts only (current default).
 */
const CUSTOM_FONTS: Record<string, Font.FontSource> = {
  // Example:
  // "SpaceMono-Regular": require("../assets/fonts/SpaceMono-Regular.ttf"),
};

/**
 * System font stack used as fallback when custom fonts fail or are not defined.
 * These are always available — no loading required.
 */
export const SYSTEM_FONT = Platform.select({
  ios: undefined,       // iOS uses San Francisco by default (undefined = system default)
  android: undefined,   // Android uses Roboto by default
  web: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  default: undefined,
});

export interface UseFontsResult {
  /** True once fonts are ready (loaded or timed out with fallback) */
  fontsLoaded: boolean;
  /** Non-null if fonts failed to load; app uses system font fallback in this case */
  fontError: Error | null;
}

/**
 * Races font loading against a timeout. If fonts do not load within
 * FONT_LOAD_TIMEOUT_MS, resolves with a timeout error so the app
 * continues rendering with system fonts.
 */
async function loadFontsWithTimeout(): Promise<void> {
  if (Object.keys(CUSTOM_FONTS).length === 0) {
    // No custom fonts defined — resolve immediately
    return Promise.resolve();
  }

  const fontLoad = Font.loadAsync(CUSTOM_FONTS);

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Font load timed out after ${FONT_LOAD_TIMEOUT_MS}ms — using system font fallback`)),
      FONT_LOAD_TIMEOUT_MS
    )
  );

  return Promise.race([fontLoad, timeout]);
}

/**
 * @param externalReady - Optional gate. When provided (boolean), the splash screen
 * is only hidden once BOTH fonts have resolved AND externalReady is true.
 * When omitted (undefined), original behaviour: hide splash as soon as fonts resolve.
 */
export function useFonts(externalReady?: boolean): UseFontsResult {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [fontError, setFontError] = useState<Error | null>(null);
  // Internal flag: fonts have finished loading (success or fallback)
  const [fontsResolved, setFontsResolved] = useState(false);

  // Phase 1: load fonts
  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      try {
        await loadFontsWithTimeout();
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error(String(err));
          console.warn("[useFonts] Font loading failed, falling back to system font:", error.message);
          setFontError(error);
        }
      } finally {
        if (!cancelled) {
          setFontsResolved(true);
          // If no external gate is used, hide splash immediately (original behaviour)
          if (externalReady === undefined) {
            setFontsLoaded(true);
            try {
              await SplashScreen.hideAsync();
            } catch {
              // Already hidden — safe to ignore
            }
          }
        }
      }
    }

    prepare();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 2 (only when gate is used): hide splash once BOTH fonts AND external are ready.
  // A hard timeout ensures the splash ALWAYS hides within EXTERNAL_GATE_TIMEOUT_MS even if
  // the external gate (auth/AsyncStorage) never resolves — prevents APK install freeze.
  useEffect(() => {
    if (externalReady === undefined) return; // gate not in use — handled in Phase 1

    // Hard fallback: hide splash after timeout regardless of gate state
    const fallbackTimer = setTimeout(() => {
      if (__DEV__) {
        console.warn(
          `[useFonts] External gate timed out after ${EXTERNAL_GATE_TIMEOUT_MS}ms — forcing splash hide`
        );
      }
      setFontsLoaded(true);
      SplashScreen.hideAsync().catch(() => {});
    }, EXTERNAL_GATE_TIMEOUT_MS);

    // Normal path: both fonts and gate ready
    if (fontsResolved && externalReady) {
      clearTimeout(fallbackTimer);
      setFontsLoaded(true);
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(fallbackTimer);
  }, [fontsResolved, externalReady]);

  return { fontsLoaded, fontError };
}
