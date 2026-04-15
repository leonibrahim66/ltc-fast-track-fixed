/**
 * components/carrier-bottom-nav.tsx
 *
 * Bottom navigation bar for carrier drivers with 3 tabs:
 * - Home (carrier dashboard)
 * - Live Map (active jobs map view)
 * - Profile (driver profile)
 */

import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface CarrierBottomNavProps {
  currentTab?: "home" | "map" | "profile";
}

export function CarrierBottomNav({ currentTab = "home" }: CarrierBottomNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useColors();

  // Determine current tab from pathname if not provided
  const activeTab = currentTab || (
    pathname?.includes("live-map") ? "map" :
    pathname?.includes("driver-profile") ? "profile" :
    "home"
  );

  const handleNavigation = (tab: "home" | "map" | "profile") => {
    if (tab === activeTab) return; // Already on this tab

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    switch (tab) {
      case "home":
        router.replace("/carrier/portal" as any);
        break;
      case "map":
        router.push("/carrier/live-map" as any);
        break;
      case "profile":
        router.push("/carrier/driver-profile" as any);
        break;
    }
  };

  const navItems = [
    {
      id: "home",
      label: "Home",
      icon: "home",
      onPress: () => handleNavigation("home"),
    },
    {
      id: "map",
      label: "Live Map",
      icon: "map",
      onPress: () => handleNavigation("map"),
    },
    {
      id: "profile",
      label: "Profile",
      icon: "person",
      onPress: () => handleNavigation("profile"),
    },
  ];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, borderTopColor: colors.border },
      ]}
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={item.onPress}
            style={styles.navItem}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                isActive && {
                  backgroundColor: `${colors.primary}15`,
                },
              ]}
            >
              <MaterialIcons
                name={item.icon as any}
                size={24}
                color={isActive ? colors.primary : colors.muted}
              />
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? colors.primary : colors.muted,
                  fontWeight: isActive ? "600" : "400",
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
    height: 70,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  iconContainer: {
    padding: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
  },
});
