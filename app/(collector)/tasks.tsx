import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePickups } from "@/lib/pickups-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function CollectorTasksScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { pickups, refreshPickups } = usePickups();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPickups();
    setRefreshing(false);
  };

  // Calculate task statistics
  const pendingPickups = pickups.filter(
    (p) => (p.status === "pending" || p.status === "assigned") && p.collectorId === user?.id
  ).length;

  const completedToday = pickups.filter((p) => {
    if (!p.completedAt) return false;
    const today = new Date().toDateString();
    const completedDate = new Date(p.completedAt).toDateString();
    return completedDate === today && p.collectorId === user?.id;
  }).length;

  const demandRequests = pickups.filter(
    (p) => p.status === "pending" && !p.collectorId
  ).length;

  const taskCards = [
    {
      id: "pending",
      title: "Pending Pickups",
      value: pendingPickups,
      icon: "list-alt",
      color: "#F59E0B",
      bgColor: "#FEF3C7",
      route: "/collector-pickups",
    },
    {
      id: "completed",
      title: "Completed Today",
      value: completedToday,
      icon: "check-circle",
      color: "#10B981",
      bgColor: "#ECFDF5",
      route: "/collector-completed",
    },
    {
      id: "demand",
      title: "Demand Board",
      value: demandRequests,
      icon: "dashboard",
      color: "#3B82F6",
      bgColor: "#EFF6FF",
      route: "/collector-demand",
    },
    {
      id: "route",
      title: "Route Map",
      value: 0,
      icon: "map",
      color: "#8B5CF6",
      bgColor: "#F3E8FF",
      route: "/collector-map",
    },
  ];

  const quickActions = [
    {
      id: "households",
      title: "Assigned Households",
      description: "View all your assigned households",
      icon: "home-work",
      color: "#3B82F6",
      route: "/collector-households",
    },
    {
      id: "schedule",
      title: "Pickup Schedule",
      description: "View your pickup schedule",
      icon: "event",
      color: "#10B981",
      route: "/collector-schedule",
    },
    {
      id: "history",
      title: "Pickup History",
      description: "View completed pickups",
      icon: "history",
      color: "#8B5CF6",
      route: "/collector-history",
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <Text style={styles.headerTitle}>My Tasks</Text>
          <Text style={styles.headerSubtitle}>Pickups & Demand Board</Text>
        </View>

        {/* Task Summary Cards */}
        <View style={styles.cardsSection}>
          <View style={styles.cardsGrid}>
            {taskCards.map((card) => (
              <TouchableOpacity
                key={card.id}
                onPress={() => router.push(card.route as any)}
                style={[
                  styles.taskCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                activeOpacity={0.7}
              >
                <View style={[styles.taskIcon, { backgroundColor: card.bgColor }]}>
                  <MaterialIcons name={card.icon as any} size={28} color={card.color} />
                </View>
                <Text style={[styles.taskValue, { color: colors.foreground }]}>
                  {card.value}
                </Text>
                <Text style={[styles.taskTitle, { color: colors.muted }]}>
                  {card.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Quick Actions
          </Text>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              onPress={() => router.push(action.route as any)}
              style={[
                styles.actionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}>
                <MaterialIcons name={action.icon as any} size={24} color={action.color} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                  {action.title}
                </Text>
                <Text style={[styles.actionDescription, { color: colors.muted }]}>
                  {action.description}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Today's Schedule Preview */}
        <View style={styles.scheduleSection}>
          <View style={styles.scheduleHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Today's Schedule
            </Text>
            <TouchableOpacity onPress={() => router.push("/collector-schedule" as any)}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
          {pendingPickups === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="check-circle" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No pending pickups for today
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => router.push("/collector-pickups" as any)}
              style={[
                styles.scheduleCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.scheduleInfo}>
                <Text style={[styles.scheduleTitle, { color: colors.foreground }]}>
                  {pendingPickups} Pending Pickup{pendingPickups !== 1 ? "s" : ""}
                </Text>
                <Text style={[styles.scheduleSubtitle, { color: colors.muted }]}>
                  Tap to view details
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
            </TouchableOpacity>
          )}
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
    marginBottom: _rs.sp(4),
  },
  headerSubtitle: {
    fontSize: _rs.fs(14),
    color: "rgba(255,255,255,0.9)",
  },
  cardsSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: _rs.sp(12),
  },
  taskCard: {
    width: "48%",
    padding: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 1,
    alignItems: "center",
  },
  taskIcon: {
    width: _rs.s(56),
    height: _rs.s(56),
    borderRadius: _rs.s(28),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: _rs.sp(12),
  },
  taskValue: {
    fontSize: _rs.fs(28),
    fontWeight: "700",
    marginBottom: _rs.sp(4),
  },
  taskTitle: {
    fontSize: _rs.fs(12),
    textAlign: "center",
  },
  actionsSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
  },
  sectionTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    marginBottom: _rs.sp(16),
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    marginBottom: _rs.sp(12),
  },
  actionIcon: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(24),
    justifyContent: "center",
    alignItems: "center",
    marginRight: _rs.sp(12),
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    marginBottom: _rs.sp(2),
  },
  actionDescription: {
    fontSize: _rs.fs(13),
  },
  scheduleSection: {
    paddingHorizontal: _rs.sp(16),
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: _rs.sp(16),
  },
  viewAllText: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
  },
  emptyCard: {
    padding: _rs.sp(32),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    alignItems: "center",
  },
  emptyText: {
    fontSize: _rs.fs(15),
    marginTop: _rs.sp(12),
  },
  scheduleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    marginBottom: _rs.sp(4),
  },
  scheduleSubtitle: {
    fontSize: _rs.fs(13),
  },
});
