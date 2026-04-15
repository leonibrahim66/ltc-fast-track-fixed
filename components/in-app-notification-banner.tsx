/**
 * components/in-app-notification-banner.tsx
 *
 * Floating in-app notification banner that slides down from the top of the
 * screen when a new notification arrives. Rendered inside the root layout so
 * it appears on ALL screens regardless of the current route.
 *
 * - Auto-dismisses after 4 seconds
 * - Tapping dismisses immediately
 * - Shows one banner at a time; queued banners appear sequentially
 * - Uses react-native-reanimated for smooth slide-in/out animation
 * - Safe-area aware (respects status bar / notch)
 */

import React, { useCallback, useEffect, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGlobalNotifications, GlobalNotifType } from "@/lib/global-notification-context";
import { useColors } from "@/hooks/use-colors";

// ─── Icon mapping per notification type ──────────────────────────────────────

function getIcon(type: GlobalNotifType): string {
  switch (type) {
    case "pickup_update":   return "🗑️";
    case "driver_accepted": return "🚛";
    case "driver_arriving": return "📍";
    case "pickup_completed":return "✅";
    case "payment":         return "💳";
    case "subscription":    return "⭐";
    case "support":         return "💬";
    case "system":
    default:                return "🔔";
  }
}

function getAccentColor(type: GlobalNotifType): string {
  switch (type) {
    case "pickup_update":   return "#0a7ea4";
    case "driver_accepted": return "#22C55E";
    case "driver_arriving": return "#F59E0B";
    case "pickup_completed":return "#22C55E";
    case "payment":         return "#8B5CF6";
    case "subscription":    return "#F59E0B";
    case "support":         return "#0a7ea4";
    case "system":
    default:                return "#6B7280";
  }
}

// ─── Auto-dismiss duration ────────────────────────────────────────────────────

const SHOW_DURATION_MS = 4000;
const ANIM_DURATION_MS = 300;

// ─── Component ────────────────────────────────────────────────────────────────

export function InAppNotificationBanner() {
  const { bannerQueue, dismissBanner } = useGlobalNotifications();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const current = bannerQueue[0];

  // Animated translateY: starts above screen (-100), slides to 0
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slideOut = useCallback(() => {
    "worklet";
    translateY.value = withTiming(-120, { duration: ANIM_DURATION_MS });
    opacity.value = withTiming(0, { duration: ANIM_DURATION_MS }, () => {
      runOnJS(dismissBanner)();
    });
  }, [translateY, opacity, dismissBanner]);

  const slideIn = useCallback(() => {
    "worklet";
    translateY.value = withTiming(0, { duration: ANIM_DURATION_MS });
    opacity.value = withTiming(1, { duration: ANIM_DURATION_MS });
  }, [translateY, opacity]);

  useEffect(() => {
    if (!current) {
      // No banner — reset position silently
      translateY.value = -120;
      opacity.value = 0;
      return;
    }

    // Slide in
    slideIn();

    // Auto-dismiss after SHOW_DURATION_MS
    autoDismissTimer.current = setTimeout(() => {
      slideOut();
    }, SHOW_DURATION_MS);

    return () => {
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!current) return null;

  const accentColor = getAccentColor(current.type);
  const icon = getIcon(current.type);
  const topOffset = insets.top + (Platform.OS === "android" ? 8 : 4);

  return (
    <Animated.View
      style={[
        styles.container,
        animatedStyle,
        {
          top: topOffset,
          backgroundColor: colors.surface,
          borderColor: accentColor,
          shadowColor: accentColor,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={styles.inner}
        onPress={() => {
          if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current);
          slideOut();
        }}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        {/* Icon */}
        <Text style={styles.icon}>{icon}</Text>

        {/* Text content */}
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {current.title}
          </Text>
          <Text
            style={[styles.body, { color: colors.muted }]}
            numberOfLines={2}
          >
            {current.body}
          </Text>
        </View>

        {/* Dismiss X */}
        <Text style={[styles.dismiss, { color: colors.muted }]}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 9999,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
    overflow: "hidden",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  accentBar: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 2,
    marginRight: 2,
  },
  icon: {
    fontSize: 22,
    lineHeight: 28,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  body: {
    fontSize: 12,
    lineHeight: 16,
  },
  dismiss: {
    fontSize: 14,
    fontWeight: "600",
    paddingLeft: 4,
  },
});
