import {
  Image, Text, View, TouchableOpacity, StyleSheet,
  ScrollView, useWindowDimensions,
} from "react-native";
import { useResponsive, getStaticResponsive } from "@/hooks/use-responsive";
import { useRouter } from "expo-router";
import { useRef, useState, useCallback, useEffect } from "react";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  withSequence, Easing, runOnJS,
} from "react-native-reanimated";
import { ScreenContainer } from "@/components/screen-container";
import { APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useAuth } from "@/lib/auth-context";

const SWIPE_UP_THRESHOLD = -60; // negative = upward
const REQUIRED_SWIPES = 4;
const AUTO_HIDE_DELAY = 10000; // 10 seconds

// Landscape / tablet: width >= 600 or width > height
function useIsWide() {
  const { width, height } = useWindowDimensions();
  return width >= 600 || width > height;
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { width, height } = useWindowDimensions();
  const isWide = useIsWide();
  const rs = useResponsive();

  // Delay navigation until after the root layout has mounted its Slot
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // If user is already authenticated, redirect to their role dashboard
  useEffect(() => {
    if (!mounted || isLoading || !isAuthenticated || !user) return;
    const role = user.role;
    if (role === "garbage_driver") {
      router.replace("/(garbage-driver)" as any);
    } else if (role === "collector" || role === "zone_manager") {
      router.replace("/(collector)" as any);
    } else if (role === "recycler") {
      router.replace("/recycler-dashboard" as any);
    } else {
      router.replace("/(tabs)" as any);
    }
  }, [mounted, isLoading, isAuthenticated, user?.role]);

  const [swipeCount, setSwipeCount] = useState(0);
  const [adminVisible, setAdminVisible] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // ── Scroll hint arrow animation ──────────────────────────────────────────
  const arrowOpacity = useSharedValue(1);
  const arrowTranslateY = useSharedValue(0);

  useEffect(() => {
    arrowTranslateY.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    const t = setTimeout(() => {
      arrowOpacity.value = withTiming(0, { duration: 500 });
      setTimeout(() => setShowScrollHint(false), 500);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  const hideScrollHint = useCallback(() => {
    if (!showScrollHint) return;
    arrowOpacity.value = withTiming(0, { duration: 300 });
    setTimeout(() => setShowScrollHint(false), 300);
  }, [showScrollHint]);

  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
    transform: [{ translateY: arrowTranslateY.value }],
  }));

  // ── Admin swipe logic (4 upward swipes on welcome screen only) ────────────
  const scheduleAutoHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setAdminVisible(false);
      setSwipeCount(0);
    }, AUTO_HIDE_DELAY);
  }, []);

  const handleSwipeUp = useCallback(() => {
    setSwipeCount((prev) => {
      const next = prev + 1;
      if (next >= REQUIRED_SWIPES) {
        setAdminVisible(true);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        scheduleAutoHide();
        return 0;
      }
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return next;
    });
  }, [scheduleAutoHide]);

  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      if (event.translationY < SWIPE_UP_THRESHOLD && Math.abs(event.translationX) < 60) {
        runOnJS(handleSwipeUp)();
      }
    });

  // ── Sticky header (tablet / landscape only) ───────────────────────────────
  const StickyHeader = isWide ? (
    <View style={styles.stickyHeader}>
      <View style={styles.stickyLogoWrap}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.stickyLogo}
          resizeMode="cover"
        />
      </View>
      <View style={styles.stickyTextWrap}>
        <Text style={styles.stickyAppName}>{APP_CONFIG.name}</Text>
        <Text style={styles.stickyTagline}>{APP_CONFIG.tagline}</Text>
      </View>
    </View>
  ) : null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        {/* Sticky header rendered outside ScrollView for tablets/landscape */}
        {StickyHeader}

        <GestureDetector gesture={panGesture}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={hideScrollHint}
            onScroll={hideScrollHint}
            scrollEventThrottle={16}
            bounces={true}
            alwaysBounceVertical={true}
          >
            <View style={{ minHeight: height }} className="bg-background">
              {/* ── Hero — hidden on wide/landscape ────────────────────────── */}
              {!isWide && (
                <View className="items-center justify-center px-6" style={{ paddingTop: rs.sp(rs.isSmall ? 24 : 36) }}>
                  {/* Logo */}
                  <View
                    style={{
                      width: rs.s(rs.isSmall ? 100 : 128),
                      height: rs.s(rs.isSmall ? 100 : 128),
                      borderRadius: rs.s(28),
                      overflow: "hidden",
                      marginBottom: rs.sp(rs.isSmall ? 14 : 22),
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.12,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <Image
                      source={require("@/assets/images/icon.png")}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  </View>

                  {/* App Name */}
                  <Text
                    className="font-bold text-foreground"
                    style={{ fontSize: rs.fs(rs.isSmall ? 30 : 38), marginBottom: rs.sp(6), letterSpacing: 0.5 }}
                  >
                    {APP_CONFIG.name}
                  </Text>

                  {/* Welcome message */}
                  <Text
                    className="text-muted text-center"
                    style={{
                      fontSize: rs.fs(rs.isSmall ? 14 : 16),
                      lineHeight: rs.fs(rs.isSmall ? 14 : 16) * 1.55,
                      marginBottom: rs.sp(rs.isSmall ? 10 : 16),
                      maxWidth: 320,
                    }}
                  >
                    Fast and efficient garbage collection services for residential and commercial properties across Zambia.
                  </Text>
                </View>
              )}

              {/* ── Features list ──────────────────────────────────────────── */}
              <View
                className="px-6"
                style={{
                  paddingTop: rs.sp(rs.isSmall ? 8 : 12),
                  paddingBottom: rs.sp(rs.isSmall ? 4 : 8),
                }}
              >
                <View
                  className="bg-surface rounded-2xl w-full"
                  style={{
                    padding: rs.sp(rs.isSmall ? 16 : 22),
                    marginBottom: rs.sp(rs.isSmall ? 16 : 24),
                    maxWidth: 480,
                    alignSelf: "center",
                  }}
                >
                  <FeatureItem icon="📍" text="Pin your bin location for quick pickup" rs={rs} />
                  <FeatureItem icon="📸" text="Send photos of garbage for faster response" rs={rs} />
                  <FeatureItem icon="🚛" text="Track your pickup in real-time" rs={rs} />
                  <FeatureItem icon="💳" text="Easy mobile money & bank payments" rs={rs} last />
                </View>
              </View>

              {/* ── Action area ────────────────────────────────────────────── */}
              <View
                className="px-6"
                style={{
                  paddingBottom: rs.sp(rs.isSmall ? 24 : 36),
                  alignItems: "center",
                }}
              >
                {/* Single Get Started button */}
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/role-select" as any)}
                  className="bg-primary rounded-full w-full"
                  style={[
                    styles.button,
                    {
                      paddingVertical: rs.sp(rs.isSmall ? 14 : 18),
                      maxWidth: 480,
                    },
                  ]}
                  activeOpacity={0.85}
                >
                  <View className="flex-row items-center justify-center">
                    <MaterialIcons name="arrow-forward" size={rs.iconSize(22)} color="#fff" />
                    <Text
                      className="text-white font-bold ml-2"
                      style={{ fontSize: rs.fs(rs.isSmall ? 16 : 18) }}
                    >
                      Get Started
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Hidden IT Management Portal — revealed by 4 upward swipes */}
                {adminVisible && (
                  <TouchableOpacity
                    onPress={() => {
                      setAdminVisible(false);
                      setSwipeCount(0);
                      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
                      router.push("/admin-login" as any);
                    }}
                    className="mt-4 py-3 bg-surface border border-border rounded-xl w-full"
                    style={[styles.adminButton, { maxWidth: 480 }]}
                    activeOpacity={0.8}
                  >
                    <View className="flex-row items-center justify-center">
                      <MaterialIcons name="admin-panel-settings" size={rs.iconSize(18)} color="#6B7280" />
                      <Text className="text-muted text-center font-medium ml-2" style={{ fontSize: rs.fs(14) }}>
                        IT Management Portal
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </GestureDetector>

        {/* Scroll hint arrow */}
        {showScrollHint && (
          <Animated.View style={[styles.scrollHint, arrowStyle]} pointerEvents="none">
            <View style={styles.scrollHintPill}>
              <MaterialIcons name="keyboard-arrow-down" size={22} color="#fff" />
              <Text style={styles.scrollHintText}>Scroll for more</Text>
            </View>
          </Animated.View>
        )}
      </ScreenContainer>
    </GestureHandlerRootView>
  );
}

function FeatureItem({
  icon,
  text,
  rs,
  last = false,
}: {
  icon: string;
  text: string;
  rs: ReturnType<typeof import("@/hooks/use-responsive").useResponsive>;
  last?: boolean;
}) {
  return (
    <View
      className="flex-row items-center"
      style={{ marginBottom: last ? 0 : rs.sp(rs.isSmall ? 12 : 16) }}
    >
      <Text style={{ fontSize: rs.fs(rs.isSmall ? 20 : 24), marginRight: rs.sp(12) }}>{icon}</Text>
      <Text className="text-foreground flex-1" style={{ fontSize: rs.fs(rs.isSmall ? 13 : 15), lineHeight: rs.fs(rs.isSmall ? 13 : 15) * 1.5 }}>
        {text}
      </Text>
    </View>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  button: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  adminButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // ── Scroll hint ──────────────────────────────────────────────────────────
  scrollHint: {
    position: "absolute",
    bottom: _rs.sp(20),
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  scrollHintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(7),
    borderRadius: 50,
  },
  scrollHintText: {
    color: "#fff",
    fontSize: _rs.fs(13),
    fontWeight: "500",
  },

  // ── Sticky header (tablet / landscape) ───────────────────────────────────
  stickyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(12),
    paddingHorizontal: _rs.sp(20),
    paddingVertical: _rs.sp(12),
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  stickyLogoWrap: {
    width: _rs.s(44),
    height: _rs.s(44),
    borderRadius: _rs.s(12),
    overflow: "hidden",
  },
  stickyLogo: {
    width: "100%",
    height: "100%",
  },
  stickyTextWrap: {
    flex: 1,
  },
  stickyAppName: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    color: "#11181C",
  },
  stickyTagline: {
    fontSize: _rs.fs(13),
    color: "#687076",
    marginTop: 1,
  },
});
