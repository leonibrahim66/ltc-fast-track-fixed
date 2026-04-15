import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAlertSounds, AlertType } from "@/lib/alert-sounds-context";
import { useAdmin } from "@/lib/admin-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";


const ALERT_ICONS: Record<AlertType, string> = {
  new_dispute: "gavel",
  payment_failure: "credit-card-off",
  new_registration: "person-add",
  new_subscription: "card-membership",
  pickup_completed: "check-circle",
  critical_alert: "warning",
};

const PRIORITY_COLORS = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#22C55E",
};

export default function AdminAlertSettingsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated } = useAdmin();
  const {
    settings,
    updateSettings,
    toggleAlertType,
    testAlert,
    getAlertConfig,
    alertTypes,
  } = useAlertSounds();

  const [testingAlert, setTestingAlert] = useState<AlertType | null>(null);

  if (!isAdminAuthenticated) {
    router.replace("/admin-login");
    return null;
  }

  const handleToggleMain = async (value: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSettings({ enabled: value });
  };

  const handleToggleSound = async (value: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSettings({ soundEnabled: value });
  };

  const handleToggleVibration = async (value: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await updateSettings({ vibrationEnabled: value });
  };

  const handleVolumeChange = async (value: number) => {
    await updateSettings({ volume: Math.round(value) });
  };

  const handleToggleAlertType = async (type: AlertType) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await toggleAlertType(type);
  };

  const handleTestAlert = (type: AlertType) => {
    setTestingAlert(type);
    testAlert(type);
    setTimeout(() => setTestingAlert(null), 1000);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-4 bg-primary">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3"
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text className="text-white text-xl font-bold">Alert Settings</Text>
            <Text className="text-white/80 text-sm">Configure sound and vibration alerts</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-4">
        {/* Master Toggle */}
        <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mr-3">
                <MaterialIcons name="notifications-active" size={24} color="#22C55E" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-lg">Alert Notifications</Text>
                <Text className="text-muted text-sm">Enable sound and vibration alerts</Text>
              </View>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggleMain}
              trackColor={{ false: "#374151", true: "#22C55E" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Sound & Vibration Settings */}
        <View className={`bg-surface rounded-xl p-4 mb-4 border border-border ${!settings.enabled ? "opacity-50" : ""}`}>
          <Text className="text-foreground font-semibold text-lg mb-4">Alert Options</Text>

          {/* Sound Toggle */}
          <View className="flex-row items-center justify-between py-3 border-b border-border">
            <View className="flex-row items-center">
              <MaterialIcons name="volume-up" size={24} color="#3B82F6" />
              <View className="ml-3">
                <Text className="text-foreground font-medium">Sound</Text>
                <Text className="text-muted text-sm">Play audio for alerts</Text>
              </View>
            </View>
            <Switch
              value={settings.soundEnabled}
              onValueChange={handleToggleSound}
              disabled={!settings.enabled}
              trackColor={{ false: "#374151", true: "#3B82F6" }}
              thumbColor="#fff"
            />
          </View>

          {/* Vibration Toggle */}
          <View className="flex-row items-center justify-between py-3 border-b border-border">
            <View className="flex-row items-center">
              <MaterialIcons name="vibration" size={24} color="#8B5CF6" />
              <View className="ml-3">
                <Text className="text-foreground font-medium">Vibration</Text>
                <Text className="text-muted text-sm">Vibrate device for alerts</Text>
              </View>
            </View>
            <Switch
              value={settings.vibrationEnabled}
              onValueChange={handleToggleVibration}
              disabled={!settings.enabled}
              trackColor={{ false: "#374151", true: "#8B5CF6" }}
              thumbColor="#fff"
            />
          </View>

          {/* Volume Slider */}
          <View className="py-3">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center">
                <MaterialIcons name="volume-down" size={24} color="#6B7280" />
                <Text className="text-foreground font-medium ml-3">Volume</Text>
              </View>
              <Text className="text-primary font-semibold">{settings.volume}%</Text>
            </View>
            <View className="flex-row items-center mt-2">
              {[20, 40, 60, 80, 100].map((vol) => (
                <TouchableOpacity
                  key={vol}
                  onPress={() => handleVolumeChange(vol)}
                  disabled={!settings.enabled || !settings.soundEnabled}
                  className={`flex-1 py-2 mx-1 rounded-lg items-center ${
                    settings.volume >= vol ? "bg-primary" : "bg-border"
                  }`}
                >
                  <Text className={settings.volume >= vol ? "text-white text-xs font-semibold" : "text-muted text-xs"}>
                    {vol}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Alert Types */}
        <View className={`bg-surface rounded-xl p-4 mb-6 border border-border ${!settings.enabled ? "opacity-50" : ""}`}>
          <Text className="text-foreground font-semibold text-lg mb-4">Alert Types</Text>
          <Text className="text-muted text-sm mb-4">
            Choose which events trigger alerts. Tap the test button to preview.
          </Text>

          {alertTypes.map((type) => {
            const config = getAlertConfig(type);
            const icon = ALERT_ICONS[type];
            const priorityColor = PRIORITY_COLORS[config.priority];
            const isEnabled = settings.alertTypes[type];
            const isTesting = testingAlert === type;

            return (
              <View
                key={type}
                className="flex-row items-center justify-between py-3 border-b border-border last:border-b-0"
              >
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${priorityColor}20` }}
                  >
                    <MaterialIcons name={icon as any} size={20} color={priorityColor} />
                  </View>
                  <View className="ml-3 flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-foreground font-medium">{config.label}</Text>
                      <View
                        className="ml-2 px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${priorityColor}20` }}
                      >
                        <Text className="text-xs font-semibold" style={{ color: priorityColor }}>
                          {config.priority.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-muted text-xs mt-0.5">{config.description}</Text>
                  </View>
                </View>

                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => handleTestAlert(type)}
                    disabled={!settings.enabled}
                    className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${
                      isTesting ? "bg-primary" : "bg-surface border border-border"
                    }`}
                  >
                    <MaterialIcons
                      name={isTesting ? "volume-up" : "play-arrow"}
                      size={16}
                      color={isTesting ? "#fff" : "#6B7280"}
                    />
                  </TouchableOpacity>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => handleToggleAlertType(type)}
                    disabled={!settings.enabled}
                    trackColor={{ false: "#374151", true: priorityColor }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Info Card */}
        <View className="bg-blue-500/10 rounded-xl p-4 mb-6 border border-blue-500/20">
          <View className="flex-row items-start">
            <MaterialIcons name="info" size={24} color="#3B82F6" />
            <View className="ml-3 flex-1">
              <Text className="text-blue-500 font-semibold mb-1">About Alerts</Text>
              <Text className="text-muted text-sm">
                Alerts help you stay informed about critical events in real-time. 
                High priority alerts are recommended to always be enabled for 
                immediate attention to disputes and payment issues.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
