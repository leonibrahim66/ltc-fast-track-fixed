import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import { StorageEventBus, STORAGE_KEYS } from "@/lib/storage-event-bus";
import { useResponsive } from "@/hooks/use-responsive";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const rs = useResponsive();
  const tabBarBase = rs.s(rs.isSmall ? 48 : 56);
  const bottomPadding = Platform.OS === "web" ? rs.sp(12) : Math.max(insets.bottom, rs.sp(6));
  const tabBarHeight = tabBarBase + bottomPadding;
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Delay navigation until after the root layout has mounted its Slot
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Redirect to welcome if not authenticated
  // Redirect non-customer roles to their specific dashboards
  useEffect(() => {
    if (!mounted || isLoading) return;

    if (!isAuthenticated) {
      router.replace("/(auth)/welcome" as any);
      return;
    }

    // If user is logged in but not a customer, redirect to their role dashboard
    if (user) {
      const role = user.role;
      if (role === "driver") {
        router.replace("/carrier/portal" as any);
      } else if (role === "collector" || role === "zone_manager") {
        router.replace("/(collector)" as any);
      } else if (role === "garbage_driver") {
        router.replace("/(garbage-driver)" as any);
      } else if (role === "recycler") {
        router.replace("/recycler-dashboard" as any);
      }
      // "residential" and "commercial" stay on (tabs) - customer home
    }
  }, [mounted, isLoading, isAuthenticated, user?.role]);

  // Immediate logout redirect: fires as soon as logout() emits the LOGOUT event
  useEffect(() => {
    if (!mounted) return;
    return StorageEventBus.subscribe(STORAGE_KEYS.LOGOUT, () => {
      router.replace("/(auth)/welcome" as any);
    });
  }, [mounted]);

  // Show different tabs based on user role
  const isCollector = user?.role === "collector" || user?.role === "zone_manager";
  const isAdmin = user?.role === "admin";
  const isDriver = user?.role === "driver";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
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
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={rs.iconSize(26)} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="pickups"
        options={{
          title: isCollector ? "Routes" : "Pickups",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={rs.iconSize(26)} name={isCollector ? "map.fill" : "trash.fill"} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: "News",
          tabBarIcon: ({ color }) => <IconSymbol size={rs.iconSize(26)} name="newspaper.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color }) => <IconSymbol size={rs.iconSize(26)} name="wallet.fill" color={color} />,
          href: (user?.role === "residential" || user?.role === "commercial") ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="subscribe"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <IconSymbol size={rs.iconSize(26)} name="person.fill" color={color} />,
        }}
      />

      {/* Hidden tabs - removed from bottom navigation bar */}
      <Tabs.Screen
        name="earnings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="track-shipment"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="driver-dashboard"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="carrier-dashboard"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="available-bookings"
        options={{
          href: null,
        }}
      />
      {/* Carrier screens - hidden from customer nav, accessible from carrier portal */}
      <Tabs.Screen
        name="carrier-profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="carrier-live-map"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
