import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useReminders } from "@/lib/reminders-context";

import { getStaticResponsive } from "@/hooks/use-responsive";
const REMINDER_OPTIONS = [
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 180, label: "3 hours before" },
  { value: 1440, label: "1 day before" },
];

export default function ReminderSettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings, cancelAllReminders } = useReminders();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggleReminders = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      await updateSettings({ enabled });
      if (!enabled) {
        await cancelAllReminders();
      }
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update reminder settings.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSelectTime = async (minutes: number) => {
    setIsUpdating(true);
    try {
      await updateSettings({ minutesBefore: minutes });
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update reminder time.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearAllReminders = () => {
    Alert.alert(
      "Clear All Reminders",
      "Are you sure you want to cancel all scheduled pickup reminders?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            await cancelAllReminders();
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Success", "All scheduled reminders have been cleared.");
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground ml-4">
              Pickup Reminders
            </Text>
          </View>
          <Text className="text-muted">
            Get notified before your scheduled pickups so you never miss one.
          </Text>
        </View>

        {/* Enable Reminders Toggle */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                  <MaterialIcons name="notifications-active" size={22} color="#22C55E" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">
                    Enable Reminders
                  </Text>
                  <Text className="text-muted text-sm">
                    Receive push notifications for pickups
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={handleToggleReminders}
                disabled={isUpdating}
                trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
                thumbColor={settings.enabled ? "#22C55E" : "#9CA3AF"}
              />
            </View>
          </View>
        </View>

        {/* Reminder Time Selection */}
        {settings.enabled && (
          <View className="px-6 mb-6">
            <Text className="text-sm font-medium text-muted mb-3 uppercase">
              Reminder Time
            </Text>
            <View className="bg-surface rounded-2xl border border-border overflow-hidden">
              {REMINDER_OPTIONS.map((option, index) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleSelectTime(option.value)}
                  disabled={isUpdating}
                  className={`flex-row items-center justify-between p-4 ${
                    index < REMINDER_OPTIONS.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name="schedule"
                      size={20}
                      color={settings.minutesBefore === option.value ? "#22C55E" : "#9CA3AF"}
                    />
                    <Text
                      className={`ml-3 ${
                        settings.minutesBefore === option.value
                          ? "text-primary font-semibold"
                          : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {settings.minutesBefore === option.value && (
                    <MaterialIcons name="check" size={22} color="#22C55E" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Info Card */}
        <View className="px-6 mb-6">
          <View className="bg-primary/5 rounded-2xl p-4 border border-primary/20">
            <View className="flex-row items-start">
              <MaterialIcons name="info" size={20} color="#22C55E" />
              <View className="ml-3 flex-1">
                <Text className="text-foreground font-medium mb-1">
                  How it works
                </Text>
                <Text className="text-muted text-sm leading-5">
                  When you schedule a pickup, we&apos;ll automatically set a reminder 
                  based on your preference. You&apos;ll receive a push notification 
                  before your pickup time slot begins.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Clear All Reminders */}
        {settings.enabled && (
          <View className="px-6">
            <TouchableOpacity
              onPress={handleClearAllReminders}
              className="bg-error/10 rounded-xl p-4 flex-row items-center justify-center"
            >
              <MaterialIcons name="notifications-off" size={20} color="#EF4444" />
              <Text className="text-error font-medium ml-2">
                Clear All Scheduled Reminders
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Platform Note */}
        {Platform.OS === "web" && (
          <View className="px-6 mt-6">
            <View className="bg-warning/10 rounded-xl p-4 border border-warning/20">
              <View className="flex-row items-start">
                <MaterialIcons name="warning" size={20} color="#F59E0B" />
                <Text className="text-muted text-sm ml-3 flex-1">
                  Push notifications are only available on mobile devices. 
                  Please use the iOS or Android app for reminder notifications.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
});
