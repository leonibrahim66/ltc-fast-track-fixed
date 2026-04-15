import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Switch,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth, User } from "@/lib/auth-context";
import { usePickups } from "@/lib/pickups-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function CollectorDashboardNewScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, updateUser } = useAuth();
  const { pickups, refreshPickups } = usePickups();
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(user?.availabilityStatus === "online");

  // Role guard
  useEffect(() => {
    if (user && user.role !== "collector" && user.role !== "zone_manager") {
      router.replace("/(auth)/welcome" as any);
    }
    if (!user) {
      router.replace("/(auth)/welcome" as any);
    }
  }, [user]);

  const handleToggleOnline = async (value: boolean) => {
    setIsOnline(value);
    await updateUser({
      availabilityStatus: value ? "online" : "offline",
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPickups();
    setRefreshing(false);
  };

  // Calculate statistics
  const assignedHouseholds = pickups.filter(
    (p) => p.collectorId === user?.id && p.status !== "completed" && p.status !== "cancelled"
  ).length;

  const pickupsToday = pickups.filter((p) => {
    if (!p.scheduledDate) return false;
    const today = new Date().toDateString();
    const pickupDate = new Date(p.scheduledDate).toDateString();
    return pickupDate === today && p.collectorId === user?.id;
  }).length;

  // TODO: Replace with real earnings calculation
  const monthlyGrossEarnings = 2450.0;
  const commissionDeducted = 245.0;

  const summaryCards = [
    {
      id: "households",
      title: "Active Households",
      value: assignedHouseholds.toString(),
      icon: "home",
      color: "#3B82F6",
      bgColor: "#EFF6FF",
    },
    {
      id: "pickups",
      title: "Pickups Today",
      value: pickupsToday.toString(),
      icon: "local-shipping",
      color: "#10B981",
      bgColor: "#ECFDF5",
    },
    {
      id: "earnings",
      title: "Monthly Gross",
      value: `K${monthlyGrossEarnings.toFixed(2)}`,
      icon: "account-balance-wallet",
      color: "#F59E0B",
      bgColor: "#FEF3C7",
    },
    {
      id: "commission",
      title: "Commission",
      value: `K${commissionDeducted.toFixed(2)}`,
      icon: "trending-down",
      color: "#EF4444",
      bgColor: "#FEE2E2",
    },
  ];

  const quickActions = [
    {
      id: "households",
      title: "Assigned Households",
      icon: "home-work",
      color: "#3B82F6",
      route: "/collector-households",
    },
    {
      id: "pickups",
      title: "Pending Pickups",
      icon: "list-alt",
      color: "#10B981",
      route: "/collector-pickups",
    },
    {
      id: "map",
      title: "Route Map",
      icon: "map",
      color: "#8B5CF6",
      route: "/collector-map",
    },
    {
      id: "demand",
      title: "Demand Board",
      icon: "dashboard",
      color: "#F59E0B",
      route: "/collector-demand",
    },
    {
      id: "wallet",
      title: "Earnings & Wallet",
      icon: "account-balance",
      color: "#EC4899",
      route: "/collector-earnings",
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header Section */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.push("/collector-profile-edit" as any)}
              style={styles.profileSection}
            >
              {user?.profilePicture ? (
                <Image source={{ uri: user.profilePicture }} style={styles.profileImage} />
              ) : (
                <View style={[styles.profilePlaceholder, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <MaterialIcons name="person" size={32} color="#FFFFFF" />
                </View>
              )}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user?.fullName || "Collector"}</Text>
                <Text style={styles.profileZone}>
                  {user?.transportCategory || "No category assigned"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/collector-settings" as any)}
              style={styles.settingsButton}
            >
              <MaterialIcons name="settings" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Online/Offline Toggle */}
          <View style={styles.statusRow}>
            <View style={styles.statusLabel}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isOnline ? "#10B981" : "#EF4444" },
                ]}
              />
              <Text style={styles.statusText}>
                {isOnline ? "Online" : "Offline"}
              </Text>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: "#CBD5E1", true: "#10B981" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Dashboard Overview Section */}
        <View style={styles.overviewSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Dashboard Overview
          </Text>
          <View style={styles.cardsGrid}>
            {summaryCards.map((card) => (
              <View
                key={card.id}
                style={[
                  styles.summaryCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.cardIcon, { backgroundColor: card.bgColor }]}>
                  <MaterialIcons name={card.icon as any} size={24} color={card.color} />
                </View>
                <Text style={[styles.cardValue, { color: colors.foreground }]}>
                  {card.value}
                </Text>
                <Text style={[styles.cardTitle, { color: colors.muted }]}>
                  {card.title}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Action Section */}
        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Quick Actions
          </Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                onPress={() => router.push(action.route as any)}
                style={[
                  styles.actionButton,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}>
                  <MaterialIcons name={action.icon as any} size={28} color={action.color} />
                </View>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                  {action.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: _rs.sp(16),
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profileImage: {
    width: _rs.s(56),
    height: _rs.s(56),
    borderRadius: _rs.s(28),
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profilePlaceholder: {
    width: _rs.s(56),
    height: _rs.s(56),
    borderRadius: _rs.s(28),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileInfo: {
    marginLeft: _rs.sp(12),
    flex: 1,
  },
  profileName: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: _rs.sp(2),
  },
  profileZone: {
    fontSize: _rs.fs(13),
    color: "rgba(255,255,255,0.9)",
  },
  settingsButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(12),
    borderRadius: _rs.s(12),
  },
  statusLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: _rs.s(10),
    height: _rs.s(10),
    borderRadius: _rs.s(5),
    marginRight: _rs.sp(8),
  },
  statusText: {
    fontSize: _rs.fs(15),
    fontWeight: "600",
    color: "#FFFFFF",
  },
  overviewSection: {
    padding: _rs.sp(16),
  },
  sectionTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    marginBottom: _rs.sp(16),
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: _rs.sp(12),
  },
  summaryCard: {
    width: "48%",
    padding: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 1,
    alignItems: "center",
  },
  cardIcon: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(24),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: _rs.sp(12),
  },
  cardValue: {
    fontSize: _rs.fs(24),
    fontWeight: "700",
    marginBottom: _rs.sp(4),
  },
  cardTitle: {
    fontSize: _rs.fs(12),
    textAlign: "center",
  },
  actionsSection: {
    padding: _rs.sp(16),
    paddingTop: 0,
  },
  actionsGrid: {
    gap: _rs.sp(12),
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
  },
  actionIcon: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(24),
    justifyContent: "center",
    alignItems: "center",
    marginRight: _rs.sp(16),
  },
  actionTitle: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    flex: 1,
  },
});
