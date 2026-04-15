import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function CollectorProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, logout } = useAuth();

  const profileOptions = [
    {
      id: "edit",
      title: "Edit Profile",
      description: "Update your profile information",
      icon: "edit",
      color: "#3B82F6",
      route: "/collector-profile-edit",
    },
    {
      id: "vehicle",
      title: "Vehicle Details",
      description: "Manage your vehicle information",
      icon: "local-shipping",
      color: "#10B981",
      route: "/collector-vehicle",
    },
    {
      id: "documents",
      title: "Documents",
      description: "View and upload documents",
      icon: "description",
      color: "#F59E0B",
      route: "/collector-documents",
    },
    {
      id: "settings",
      title: "Settings",
      description: "App preferences and notifications",
      icon: "settings",
      color: "#8B5CF6",
      route: "/collector-settings",
    },
  ];

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/welcome" as any);
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileSection}>
          <View
            style={[
              styles.profileCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => router.push("/collector-profile-edit" as any)}
              style={styles.profileContent}
            >
              {user?.profilePicture ? (
                <Image source={{ uri: user.profilePicture }} style={styles.profileImage} />
              ) : (
                <View
                  style={[styles.profilePlaceholder, { backgroundColor: colors.primary }]}
                >
                  <MaterialIcons name="person" size={40} color="#FFFFFF" />
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: colors.foreground }]}>
                  {user?.fullName || "Collector"}
                </Text>
                <Text style={[styles.profilePhone, { color: colors.muted }]}>
                  {user?.phone || "No phone"}
                </Text>
                <View style={styles.profileBadge}>
                  <MaterialIcons name="verified" size={16} color="#10B981" />
                  <Text style={styles.profileBadgeText}>
                    {user?.collectorType === "vehicle" ? "Vehicle Collector" : "Foot Collector"}
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="star" size={24} color="#F59E0B" />
              <Text style={[styles.statValue, { color: colors.foreground }]}>4.8</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Rating</Text>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="check-circle" size={24} color="#10B981" />
              <Text style={[styles.statValue, { color: colors.foreground }]}>247</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Completed</Text>
            </View>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="schedule" size={24} color="#3B82F6" />
              <Text style={[styles.statValue, { color: colors.foreground }]}>98%</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>On-Time</Text>
            </View>
          </View>
        </View>

        {/* Profile Options */}
        <View style={styles.optionsSection}>
          {profileOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              onPress={() => router.push(option.route as any)}
              style={[
                styles.optionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIcon, { backgroundColor: `${option.color}15` }]}>
                <MaterialIcons name={option.icon as any} size={24} color={option.color} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                  {option.title}
                </Text>
                <Text style={[styles.optionDescription, { color: colors.muted }]}>
                  {option.description}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            onPress={handleLogout}
            style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: "#EF4444" }]}
          >
            <MaterialIcons name="logout" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionSection}>
          <Text style={[styles.versionText, { color: colors.muted }]}>
            LTC Fast Track v1.0.0
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    padding: _rs.sp(20),
    paddingTop: _rs.sp(16),
    borderBottomLeftRadius: _rs.s(24),
    borderBottomRightRadius: _rs.s(24),
    marginBottom: _rs.sp(20),
  },
  headerTitle: {
    fontSize: _rs.fs(24),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profileSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
  },
  profileCard: {
    borderRadius: _rs.s(16),
    borderWidth: 1,
    overflow: "hidden",
  },
  profileContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
  },
  profileImage: {
    width: _rs.s(72),
    height: _rs.s(72),
    borderRadius: _rs.s(36),
  },
  profilePlaceholder: {
    width: _rs.s(72),
    height: _rs.s(72),
    borderRadius: _rs.s(36),
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: _rs.sp(16),
  },
  profileName: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    marginBottom: _rs.sp(4),
  },
  profilePhone: {
    fontSize: _rs.fs(14),
    marginBottom: _rs.sp(8),
  },
  profileBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(4),
  },
  profileBadgeText: {
    fontSize: _rs.fs(13),
    color: "#10B981",
    fontWeight: "600",
  },
  statsSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
  },
  statsRow: {
    flexDirection: "row",
    gap: _rs.sp(12),
  },
  statCard: {
    flex: 1,
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    marginTop: _rs.sp(8),
    marginBottom: _rs.sp(4),
  },
  statLabel: {
    fontSize: _rs.fs(12),
  },
  optionsSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    marginBottom: _rs.sp(12),
  },
  optionIcon: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(24),
    justifyContent: "center",
    alignItems: "center",
    marginRight: _rs.sp(12),
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    marginBottom: _rs.sp(2),
  },
  optionDescription: {
    fontSize: _rs.fs(13),
  },
  logoutSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    gap: _rs.sp(8),
  },
  logoutText: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    color: "#EF4444",
  },
  versionSection: {
    alignItems: "center",
    paddingVertical: _rs.sp(16),
  },
  versionText: {
    fontSize: _rs.fs(13),
  },
});
