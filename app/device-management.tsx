import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useDeviceSessions, DeviceSession } from "@/lib/device-sessions-context";
import { useAuth } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export default function DeviceManagementScreen() {
  const router = useRouter();
  const { sessions, currentDeviceId, logoutDevice, logoutAllDevices, logoutOtherDevices, refreshSessions } = useDeviceSessions();
  const { logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshSessions();
    setRefreshing(false);
  };

  const getDeviceIcon = (deviceType: DeviceSession["deviceType"]) => {
    switch (deviceType) {
      case "phone":
        return "smartphone";
      case "tablet":
        return "tablet";
      case "desktop":
        return "computer";
      default:
        return "devices";
    }
  };

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const handleLogoutDevice = (device: DeviceSession) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (device.isCurrentDevice) {
      Alert.alert(
        "Logout This Device",
        "You will be signed out of this device. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Logout",
            style: "destructive",
            onPress: async () => {
              await logoutDevice(device.id);
              await logout();
              router.replace("/(auth)/welcome" as any);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        "Remove Device",
        `Remove "${device.deviceName}" from your account? This device will need to login again.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              await logoutDevice(device.id);
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            },
          },
        ]
      );
    }
  };

  const handleLogoutAllDevices = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    Alert.alert(
      "Logout All Devices",
      "You will be signed out from ALL devices including this one. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout All",
          style: "destructive",
          onPress: async () => {
            await logoutAllDevices();
            await logout();
            router.replace("/(auth)/welcome" as any);
          },
        },
      ]
    );
  };

  const handleLogoutOtherDevices = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const otherDevicesCount = sessions.filter(s => !s.isCurrentDevice).length;
    
    if (otherDevicesCount === 0) {
      Alert.alert("No Other Devices", "You are only logged in on this device.");
      return;
    }

    Alert.alert(
      "Logout Other Devices",
      `Sign out from ${otherDevicesCount} other device${otherDevicesCount > 1 ? "s" : ""}? You will remain logged in on this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout Others",
          style: "destructive",
          onPress: async () => {
            await logoutOtherDevices();
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Success", "All other devices have been logged out.");
          },
        },
      ]
    );
  };

  // Sort sessions: current device first, then by last active
  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.isCurrentDevice) return -1;
    if (b.isCurrentDevice) return 1;
    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
  });

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6 bg-primary">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-2xl font-bold">Device Management</Text>
              <Text className="text-white/80">Manage your logged-in devices</Text>
            </View>
          </View>
        </View>

        {/* Security Info */}
        <View className="px-6 -mt-4">
          <View className="bg-surface rounded-2xl p-4 border border-border shadow-sm">
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center">
                <MaterialIcons name="security" size={24} color="#22C55E" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-foreground font-bold">Account Security</Text>
                <Text className="text-muted text-sm">
                  {sessions.length} device{sessions.length !== 1 ? "s" : ""} logged in
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 mt-6">
          <Text className="text-foreground font-bold text-lg mb-3">Quick Actions</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleLogoutOtherDevices}
              className="flex-1 bg-warning/10 rounded-xl p-4 border border-warning/20"
            >
              <MaterialIcons name="devices-other" size={24} color="#F59E0B" />
              <Text className="text-foreground font-semibold mt-2">Logout Others</Text>
              <Text className="text-muted text-xs">Keep only this device</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogoutAllDevices}
              className="flex-1 bg-error/10 rounded-xl p-4 border border-error/20"
            >
              <MaterialIcons name="logout" size={24} color="#EF4444" />
              <Text className="text-foreground font-semibold mt-2">Logout All</Text>
              <Text className="text-muted text-xs">Sign out everywhere</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Device List */}
        <View className="px-6 mt-6">
          <Text className="text-foreground font-bold text-lg mb-3">Active Sessions</Text>
          
          {sortedSessions.length === 0 ? (
            <View className="bg-surface rounded-2xl p-6 border border-border items-center">
              <MaterialIcons name="devices" size={48} color="#9BA1A6" />
              <Text className="text-muted mt-3 text-center">No active sessions found</Text>
            </View>
          ) : (
            sortedSessions.map((device) => (
              <View
                key={device.id}
                className={`bg-surface rounded-2xl p-4 mb-3 border ${
                  device.isCurrentDevice ? "border-primary" : "border-border"
                }`}
              >
                <View className="flex-row items-start">
                  <View
                    className={`w-12 h-12 rounded-xl items-center justify-center ${
                      device.isCurrentDevice ? "bg-primary/10" : "bg-muted/10"
                    }`}
                  >
                    <MaterialIcons
                      name={getDeviceIcon(device.deviceType) as any}
                      size={24}
                      color={device.isCurrentDevice ? "#22C55E" : "#9BA1A6"}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text className="text-foreground font-bold flex-1">
                        {device.deviceName}
                      </Text>
                      {device.isCurrentDevice && (
                        <View className="bg-primary/20 px-2 py-1 rounded-full">
                          <Text className="text-primary text-xs font-semibold">This Device</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-muted text-sm mt-1">{device.platform}</Text>
                    <View className="flex-row items-center mt-2">
                      <MaterialIcons name="access-time" size={14} color="#9BA1A6" />
                      <Text className="text-muted text-xs ml-1">
                        Last active: {formatLastActive(device.lastActive)}
                      </Text>
                    </View>
                    {device.location && (
                      <View className="flex-row items-center mt-1">
                        <MaterialIcons name="location-on" size={14} color="#9BA1A6" />
                        <Text className="text-muted text-xs ml-1">{device.location}</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <TouchableOpacity
                  onPress={() => handleLogoutDevice(device)}
                  className={`mt-3 py-2 rounded-xl border ${
                    device.isCurrentDevice
                      ? "border-error bg-error/10"
                      : "border-muted/30 bg-muted/10"
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${
                      device.isCurrentDevice ? "text-error" : "text-muted"
                    }`}
                  >
                    {device.isCurrentDevice ? "Logout" : "Remove Device"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Security Tips */}
        <View className="px-6 mt-6">
          <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
            <View className="flex-row items-start">
              <MaterialIcons name="info" size={20} color="#22C55E" />
              <View className="ml-3 flex-1">
                <Text className="text-foreground font-semibold mb-1">Security Tip</Text>
                <Text className="text-muted text-sm">
                  If you notice any unfamiliar devices, remove them immediately and consider changing your password.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
