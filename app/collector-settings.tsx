import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function CollectorSettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, updateUser } = useAuth();

  // Notification Settings
  const [pushNotifications, setPushNotifications] = useState(true);
  const [pickupAlerts, setPickupAlerts] = useState(true);
  const [earningsUpdates, setEarningsUpdates] = useState(true);
  const [systemAnnouncements, setSystemAnnouncements] = useState(true);

  // App Preferences
  const [autoAcceptPickups, setAutoAcceptPickups] = useState(false);
  const [showEarningsOnHome, setShowEarningsOnHome] = useState(true);
  const [vibrationFeedback, setVibrationFeedback] = useState(true);

  const handleSaveSettings = async () => {
    try {
      await updateUser({
        settings: {
          notifications: {
            push: pushNotifications,
            pickupAlerts,
            earningsUpdates,
            systemAnnouncements,
          },
          preferences: {
            autoAcceptPickups,
            showEarningsOnHome,
            vibrationFeedback,
          },
        },
      } as any);
      Alert.alert("Success", "Settings saved successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to save settings. Please try again.");
    }
  };

  const settingsSections = [
    {
      title: "Notifications",
      items: [
        {
          id: "push",
          label: "Push Notifications",
          description: "Receive push notifications",
          value: pushNotifications,
          onValueChange: setPushNotifications,
        },
        {
          id: "pickups",
          label: "Pickup Alerts",
          description: "Get notified about new pickup requests",
          value: pickupAlerts,
          onValueChange: setPickupAlerts,
        },
        {
          id: "earnings",
          label: "Earnings Updates",
          description: "Notifications about earnings and payments",
          value: earningsUpdates,
          onValueChange: setEarningsUpdates,
        },
        {
          id: "announcements",
          label: "System Announcements",
          description: "Important updates and news",
          value: systemAnnouncements,
          onValueChange: setSystemAnnouncements,
        },
      ],
    },
    {
      title: "App Preferences",
      items: [
        {
          id: "auto-accept",
          label: "Auto-Accept Pickups",
          description: "Automatically accept pickup requests in your zone",
          value: autoAcceptPickups,
          onValueChange: setAutoAcceptPickups,
        },
        {
          id: "show-earnings",
          label: "Show Earnings on Home",
          description: "Display earnings summary on home screen",
          value: showEarningsOnHome,
          onValueChange: setShowEarningsOnHome,
        },
        {
          id: "vibration",
          label: "Vibration Feedback",
          description: "Haptic feedback for actions",
          value: vibrationFeedback,
          onValueChange: setVibrationFeedback,
        },
      ],
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.content}>
          {/* Settings Sections */}
          {settingsSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {section.title}
              </Text>
              {section.items.map((item, itemIndex) => (
                <View
                  key={item.id}
                  style={[
                    styles.settingRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      {item.label}
                    </Text>
                    <Text style={[styles.settingDescription, { color: colors.muted }]}>
                      {item.description}
                    </Text>
                  </View>
                  <Switch
                    value={item.value}
                    onValueChange={item.onValueChange}
                    trackColor={{ false: "#D1D5DB", true: colors.primary + "80" }}
                    thumbColor={item.value ? colors.primary : "#F3F4F6"}
                  />
                </View>
              ))}
            </View>
          ))}

          {/* Account Actions */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
            
            <TouchableOpacity
              onPress={() => router.push("/collector-profile-edit" as any)}
              style={[
                styles.actionButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: "#3B82F6" + "20" }]}>
                <MaterialIcons name="edit" size={20} color="#3B82F6" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Edit Profile</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert("Change Password", "Password change feature coming soon!")}
              style={[
                styles.actionButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: "#10B981" + "20" }]}>
                <MaterialIcons name="lock" size={20} color="#10B981" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Change Password</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => Alert.alert("Help & Support", "Support feature coming soon!")}
              style={[
                styles.actionButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.actionIconContainer, { backgroundColor: "#F59E0B" + "20" }]}>
                <MaterialIcons name="help" size={20} color="#F59E0B" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>Help & Support</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSaveSettings}
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="check" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Settings</Text>
          </TouchableOpacity>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={[styles.appInfoText, { color: colors.muted }]}>
              LTC FAST TRACK Collector v1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(16),
  },
  backButton: {
    padding: _rs.sp(4),
  },
  headerTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "600",
    color: "#fff",
  },
  content: {
    padding: _rs.sp(16),
  },
  section: {
    marginBottom: _rs.sp(24),
  },
  sectionTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    marginBottom: _rs.sp(12),
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    marginBottom: _rs.sp(8),
    borderWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: _rs.sp(12),
  },
  settingLabel: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    marginBottom: _rs.sp(4),
  },
  settingDescription: {
    fontSize: _rs.fs(12),
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    marginBottom: _rs.sp(8),
    borderWidth: 1,
  },
  actionIconContainer: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    alignItems: "center",
    justifyContent: "center",
    marginRight: _rs.sp(12),
  },
  actionLabel: {
    flex: 1,
    fontSize: _rs.fs(16),
    fontWeight: "600",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    marginTop: _rs.sp(8),
  },
  saveButtonText: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    color: "#fff",
    marginLeft: _rs.sp(8),
  },
  appInfo: {
    alignItems: "center",
    marginTop: _rs.sp(24),
  },
  appInfoText: {
    fontSize: _rs.fs(12),
  },
});
