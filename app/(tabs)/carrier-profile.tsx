/**
 * carrier-profile tab route
 * Redirects to the full carrier driver profile screen at /carrier/driver-profile
 * This file exists so the bottom nav link /(tabs)/carrier-profile resolves correctly.
 */
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";

export default function CarrierProfileTab() {
  const router = useRouter();
  const colors = useColors();

  useEffect(() => {
    // Redirect immediately to the full driver profile screen
    router.replace("/carrier/driver-profile" as any);
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
