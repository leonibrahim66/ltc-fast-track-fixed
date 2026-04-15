import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { HapticTab } from "@/components/haptic-tab";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { APP_CONFIG } from "@/constants/app";
import { useResponsive } from "@/hooks/use-responsive";
import { StorageEventBus, STORAGE_KEYS } from "@/lib/storage-event-bus";

const DRIVER_ORANGE = "#EA580C";

export default function GarbageDriverLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const rs = useResponsive();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const bottomPadding = Platform.OS === "web" ? rs.sp(12) : Math.max(insets.bottom, rs.sp(6));
  const tabBarHeight = rs.s(rs.isSmall ? 48 : 56) + bottomPadding;

  // Delay navigation until after the root layout has mounted its Slot
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Auth guard — redirect unauthenticated users to welcome screen
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.replace("/(auth)/welcome" as any);
      return;
    }
    if (!user) return;
    if (user.role !== "garbage_driver") {
      router.replace("/(tabs)" as any);
      return;
    }
    // Allow pending and active drivers to stay — pending drivers see a waiting screen
    // Only redirect if status is rejected or suspended
    if (!APP_CONFIG.devMode && (user.driverStatus === "rejected" || user.driverStatus === "suspended")) {
      router.replace("/(auth)/welcome" as any);
    }
  }, [mounted, isAuthenticated, user?.role, user?.driverStatus]);

  // Immediate logout redirect: fires as soon as logout() emits the LOGOUT event
  useEffect(() => {
    if (!mounted) return;
    return StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, () => {
      router.replace("/(auth)/welcome" as any);
    });
  }, [mounted]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: DRIVER_ORANGE,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: rs.sp(6),
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "My Pickups",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="delete" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Live Map",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="map" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="chat" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="person" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
