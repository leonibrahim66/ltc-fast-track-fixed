/**
 * Garbage Driver Profile Screen
 * Shows driver status, vehicle info, zone assignment, and sign out.
 */
import { View, Text, TouchableOpacity, ScrollView, Alert, Switch, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

const DRIVER_ORANGE = "#EA580C";

export default function GarbageDriverProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(user?.isOnline ?? false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Redirect to waiting screen if pending approval
  useEffect(() => {
    if (user?.driverStatus === "pending_manager_approval") {
      router.replace("/(garbage-driver)/waiting-approval");
    }
  }, [user?.driverStatus, router]);

  const handleToggleOnline = async (value: boolean) => {
    setIsOnline(value);
    setIsUpdating(true);
    try {
      await updateUser({ isOnline: value });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (_e) {
      setIsOnline(!value); // revert
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/welcome" as any);
          },
        },
      ]
    );
  };

  const statusColor =
    user?.driverStatus === "active"
      ? "#16A34A"
      : user?.driverStatus === "suspended"
      ? "#EF4444"
      : "#D97706";

  const statusLabel =
    user?.driverStatus === "active"
      ? "Active"
      : user?.driverStatus === "suspended"
      ? "Suspended"
      : "Pending Approval";

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View style={{ backgroundColor: DRIVER_ORANGE }} className="px-6 pt-6 pb-8">
        <View className="items-center">
          <View className="w-20 h-20 bg-white rounded-full items-center justify-center mb-3">
            <MaterialIcons name="person" size={44} color={DRIVER_ORANGE} />
          </View>
          <Text className="text-white text-xl font-bold">{user?.fullName ?? "Driver"}</Text>
          <Text className="text-white/80 text-sm mt-1">{user?.phone}</Text>
          <View
            className="mt-2 px-4 py-1 rounded-full"
            style={{ backgroundColor: statusColor + "33" }}
          >
            <Text style={{ color: statusColor === "#16A34A" ? "white" : statusColor }} className="text-sm font-semibold">
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Online Toggle */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-3">
                <MaterialIcons name="wifi" size={20} color="#16A34A" />
              </View>
              <View>
                <Text className="text-foreground font-semibold">Online Status</Text>
                <Text className="text-muted text-sm">
                  {isOnline ? "You are visible for pickup assignments" : "You are offline"}
                </Text>
              </View>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              disabled={isUpdating || user?.driverStatus !== "active"}
              trackColor={{ false: "#D1D5DB", true: "#BBF7D0" }}
              thumbColor={isOnline ? "#16A34A" : "#9CA3AF"}
            />
          </View>
          {user?.driverStatus !== "active" && (
            <Text className="text-muted text-xs mt-2">
              Online status is only available once your account is approved by your Zone Manager.
            </Text>
          )}
        </View>

        {/* Stats */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <Text className="text-foreground font-semibold text-base mb-4">Performance</Text>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-orange-50 rounded-xl p-4 items-center">
              <MaterialIcons name="delete" size={24} color={DRIVER_ORANGE} />
              <Text className="text-orange-900 text-2xl font-bold mt-2">{user?.pickupsToday ?? 0}</Text>
              <Text className="text-orange-700 text-sm">Pickups Today</Text>
            </View>
            <View className="flex-1 bg-yellow-50 rounded-xl p-4 items-center">
              <MaterialIcons name="star" size={24} color="#F59E0B" />
              <Text className="text-yellow-900 text-2xl font-bold mt-2">
                {(user?.driverRating ?? 0).toFixed(1)}
              </Text>
              <Text className="text-yellow-700 text-sm">Rating</Text>
            </View>
          </View>
        </View>

        {/* Vehicle & Documents */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <Text className="text-foreground font-semibold text-base mb-4">Vehicle & Documents</Text>
          <View className="gap-3">
            <View className="flex-row items-center">
              <MaterialIcons name="credit-card" size={18} color="#9BA1A6" />
              <View className="ml-3">
                <Text className="text-muted text-xs">NRC Number</Text>
                <Text className="text-foreground font-medium text-sm">{user?.nrcNumber ?? "—"}</Text>
              </View>
            </View>
            <View className="border-t border-border pt-3 flex-row items-center">
              <MaterialIcons name="badge" size={18} color="#9BA1A6" />
              <View className="ml-3">
                <Text className="text-muted text-xs">Driver License Number</Text>
                <Text className="text-foreground font-medium text-sm">{user?.driverLicenseNumber ?? "—"}</Text>
              </View>
            </View>
            <View className="border-t border-border pt-3 flex-row items-center">
              <MaterialIcons name="directions-car" size={18} color="#9BA1A6" />
              <View className="ml-3">
                <Text className="text-muted text-xs">Vehicle Plate Number</Text>
                <Text className="text-foreground font-medium text-sm">{user?.vehiclePlateNumber ?? "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Zone Assignment */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <Text className="text-foreground font-semibold text-base mb-4">Zone Assignment</Text>
          {user?.zoneId ? (
            <View className="bg-green-50 border border-green-200 rounded-xl p-4">
              <View className="flex-row items-center">
                <MaterialIcons name="place" size={20} color="#16A34A" />
                <View className="ml-3">
                  <Text className="text-green-900 font-semibold text-sm">Zone Assigned</Text>
                  <Text className="text-green-700 text-sm">Zone ID: {user.zoneId}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <View className="flex-row items-center">
                <MaterialIcons name="pending" size={20} color="#D97706" />
                <View className="ml-3">
                  <Text className="text-yellow-900 font-semibold text-sm">Awaiting Zone Assignment</Text>
                  <Text className="text-yellow-700 text-sm">
                    Your Zone Manager will assign your zone upon approval.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* KYC Status */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <Text className="text-foreground font-semibold text-base mb-3">KYC Status</Text>
          <View className="flex-row items-center">
            <MaterialIcons
              name={user?.kycStatus === "verified" ? "verified-user" : "pending"}
              size={22}
              color={user?.kycStatus === "verified" ? "#16A34A" : "#D97706"}
            />
            <Text
              className="ml-2 font-medium"
              style={{ color: user?.kycStatus === "verified" ? "#16A34A" : "#D97706" }}
            >
              {user?.kycStatus === "verified" ? "Verified" : "Pending Verification"}
            </Text>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6 flex-row items-center justify-center"
        >
          <MaterialIcons name="logout" size={20} color="#EF4444" />
          <Text className="text-red-600 font-semibold text-base ml-2">Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
