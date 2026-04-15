/**
 * useResponsive — Global responsive layout utilities for LTC Fast Track
 *
 * Design breakpoints (portrait width):
 *   xs  < 360px   — very small Android phones (e.g. Galaxy A01)
 *   sm  360–413px — standard Android phones (e.g. Pixel 4, Galaxy S21)
 *   md  414–767px — large phones / small tablets (e.g. iPhone Pro Max, Galaxy S22 Ultra)
 *   lg  768px+    — tablets (e.g. Galaxy Tab, iPad)
 *
 * Usage:
 *   const rs = useResponsive();
 *   rs.s(16)        → scaled layout size (width/height/borderRadius)
 *   rs.fs(16)       → scaled font size
 *   rs.sp(16)       → scaled spacing (padding/margin/gap)
 *   rs.iconSize(24) → scaled icon size
 *   rs.isTablet     → true on tablets
 *   rs.isSmall      → true on xs phones
 *   rs.hp(pct)      → percentage of screen height
 *   rs.wp(pct)      → percentage of screen width
 *   rs.pick({xs, sm, md, lg, default}) → pick value by breakpoint
 *
 * getStaticResponsive() — same helpers but using Dimensions.get("window")
 * Safe to call outside React components (e.g. inside StyleSheet.create).
 */

import { useWindowDimensions, PixelRatio, Dimensions } from "react-native";

// ── Breakpoints ──────────────────────────────────────────────────────────────
export const BREAKPOINTS = {
  xs: 360,
  sm: 414,
  md: 768,
} as const;

// Reference width: Pixel 7 / iPhone 14 (390dp)
const BASE_WIDTH = 390;

// ── Core scale functions ─────────────────────────────────────────────────────

/**
 * Scale a layout dimension (width/height/borderRadius).
 * Clamps to 75%–135% of the base value.
 */
export function scaleSize(size: number, screenWidth: number): number {
  const scale = screenWidth / BASE_WIDTH;
  const clamped = Math.min(Math.max(scale, 0.75), 1.35);
  return Math.round(PixelRatio.roundToNearestPixel(size * clamped));
}

/**
 * Scale a font size — slightly less aggressive than layout scaling.
 * Clamps to 82%–125%.
 */
export function scaleFontSize(size: number, screenWidth: number): number {
  const scale = screenWidth / BASE_WIDTH;
  const clamped = Math.min(Math.max(scale, 0.82), 1.25);
  return Math.round(PixelRatio.roundToNearestPixel(size * clamped));
}

/**
 * Scale a spacing value (padding/margin/gap).
 * Clamps to 78%–130%.
 */
export function scaleSpacing(size: number, screenWidth: number): number {
  const scale = screenWidth / BASE_WIDTH;
  const clamped = Math.min(Math.max(scale, 0.78), 1.30);
  return Math.round(PixelRatio.roundToNearestPixel(size * clamped));
}

// ── Shared interface ─────────────────────────────────────────────────────────
export interface ResponsiveUtils {
  /** Screen width in dp */
  width: number;
  /** Screen height in dp */
  height: number;
  /** true on tablets (width >= 768) */
  isTablet: boolean;
  /** true on large phones (width >= 414) */
  isLarge: boolean;
  /** true on small phones (width < 360) */
  isSmall: boolean;
  /** true on very small phones (width < 340) */
  isXSmall: boolean;
  /** Scale a layout size (width/height/borderRadius) */
  s: (size: number) => number;
  /** Scale a font size */
  fs: (size: number) => number;
  /** Scale a spacing value (padding/margin/gap) */
  sp: (size: number) => number;
  /** Scale an icon size */
  iconSize: (size: number) => number;
  /** Percentage of screen height */
  hp: (pct: number) => number;
  /** Percentage of screen width */
  wp: (pct: number) => number;
  /** Responsive value picker: returns different values per breakpoint */
  pick: <T>(values: { xs?: T; sm?: T; md?: T; lg?: T; default: T }) => T;
}

// ── React hook (re-renders on orientation/window change) ─────────────────────
export function useResponsive(): ResponsiveUtils {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= BREAKPOINTS.md;
  const isLarge = width >= BREAKPOINTS.sm;
  const isSmall = width < BREAKPOINTS.xs;
  const isXSmall = width < 340;

  const s = (size: number) => scaleSize(size, width);
  const fs = (size: number) => scaleFontSize(size, width);
  const sp = (size: number) => scaleSpacing(size, width);
  const iconSize = (size: number) => scaleSize(size, width);
  const hp = (pct: number) => Math.round((height * pct) / 100);
  const wp = (pct: number) => Math.round((width * pct) / 100);

  function pick<T>(values: { xs?: T; sm?: T; md?: T; lg?: T; default: T }): T {
    if (isTablet && values.lg !== undefined) return values.lg;
    if (isLarge && values.md !== undefined) return values.md;
    if (!isSmall && values.sm !== undefined) return values.sm;
    if (isSmall && values.xs !== undefined) return values.xs;
    return values.default;
  }

  return { width, height, isTablet, isLarge, isSmall, isXSmall, s, fs, sp, iconSize, hp, wp, pick };
}

// ── Static singleton (for StyleSheet.create outside components) ──────────────
/**
 * Returns responsive helpers based on the current Dimensions snapshot.
 * Use this inside StyleSheet.create() blocks (outside React components).
 * Note: these values are computed once at module load time. For dynamic
 * orientation changes, use the useResponsive() hook instead.
 */
export function getStaticResponsive(): Omit<ResponsiveUtils, "pick"> {
  const { width, height } = Dimensions.get("window");

  const isTablet = width >= BREAKPOINTS.md;
  const isLarge = width >= BREAKPOINTS.sm;
  const isSmall = width < BREAKPOINTS.xs;
  const isXSmall = width < 340;

  const s = (size: number) => scaleSize(size, width);
  const fs = (size: number) => scaleFontSize(size, width);
  const sp = (size: number) => scaleSpacing(size, width);
  const iconSize = (size: number) => scaleSize(size, width);
  const hp = (pct: number) => Math.round((height * pct) / 100);
  const wp = (pct: number) => Math.round((width * pct) / 100);

  return { width, height, isTablet, isLarge, isSmall, isXSmall, s, fs, sp, iconSize, hp, wp };
}
