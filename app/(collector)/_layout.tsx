/**
 * Zone Manager Dashboard — Tab Navigation Layout
 *
 * 6 tabs: Dashboard (Overview), Households, Drivers, Pickups, Earnings, Settings
 * Active tint uses LTC green (#1B5E20) to match the Zone Manager brand.
 */
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { StorageEventBus, STORAGE_KEYS } from "@/lib/storage-event-bus";
import { useEffect, useState } from "react";
import { useResponsive } from "@/hooks/use-responsive";

const ZONE_GREEN = "#1B5E20";

export default function CollectorTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const rs = useResponsive();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const bottomPadding = Platform.OS === "web" ? rs.sp(12) : Math.max(insets.bottom, rs.sp(6));
  const tabBarHeight = rs.s(rs.isSmall ? 50 : 58) + bottomPadding;

  // Delay navigation until after the root layout has mounted its Slot
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Auth guard — redirect to welcome if not authenticated or wrong role
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated) {
      router.replace("/(auth)/welcome" as any);
      return;
    }
    if (!user) return;
    if (user.role !== "collector" && user.role !== "zone_manager") {
      router.replace("/(tabs)" as any);
    }
  }, [mounted, isAuthenticated, user?.role]);

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
        tabBarActiveTintColor: ZONE_GREEN,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: rs.fs(rs.isSmall ? 9 : 10),
          fontWeight: "600",
        },
        tabBarStyle: {
          paddingTop: rs.sp(5),
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      {/* Section 1 — Dashboard Overview */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="dashboard" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />

      {/* Section 2 — Household Management */}
      <Tabs.Screen
        name="households"
        options={{
          title: "Households",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="home-work" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />

      {/* Section 3 — Driver Management */}
      <Tabs.Screen
        name="drivers"
        options={{
          title: "Drivers",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="local-shipping" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />

      {/* Section 4 — Zone Pickups */}
      <Tabs.Screen
        name="pickups"
        options={{
          title: "Pickups",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="delete-sweep" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />

      {/* Section 5 — Earnings & Withdrawals */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="account-balance-wallet" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />

      {/* Section 6 — Settings */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="settings" size={rs.iconSize(24)} color={color} />
          ),
        }}
      />

      {/* Hidden legacy screens (still exist, not shown in tab bar) */}
      <Tabs.Screen
        name="tasks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
