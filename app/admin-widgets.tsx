import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { usePickups } from "@/lib/pickups-context";
import { usePayments } from "@/lib/payments-context";
import { getAllDriverStatuses } from "@/lib/driver-tracking-service";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");
const WIDGET_WIDTH = (width - 48) / 2;

interface Widget {
  id: string;
  title: string;
  type: "stat" | "chart" | "list" | "progress";
  size: "small" | "medium" | "large";
  enabled: boolean;
}

const DEFAULT_WIDGETS: Widget[] = [
  { id: "daily_revenue", title: "Daily Revenue", type: "stat", size: "small", enabled: true },
  { id: "weekly_revenue", title: "Weekly Revenue", type: "stat", size: "small", enabled: true },
  { id: "completion_rate", title: "Completion Rate", type: "progress", size: "medium", enabled: true },
  { id: "collector_availability", title: "Collector Status", type: "chart", size: "medium", enabled: true },
  { id: "pending_pickups", title: "Pending Pickups", type: "stat", size: "small", enabled: true },
  { id: "active_collectors", title: "Active Collectors", type: "stat", size: "small", enabled: true },
  { id: "new_users_today", title: "New Users Today", type: "stat", size: "small", enabled: true },
  { id: "disputes_open", title: "Open Disputes", type: "stat", size: "small", enabled: true },
  { id: "top_collectors", title: "Top Collectors", type: "list", size: "large", enabled: true },
  { id: "recent_activity", title: "Recent Activity", type: "list", size: "large", enabled: true },
];

export default function AdminWidgetsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, stats } = useAdmin();
  const { pickups } = usePickups();
  const { payments } = usePayments();

  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login");
    }
  }, [isAdminAuthenticated]);

  const [activeCollectors, setActiveCollectors] = useState(0);
  const [busyCollectors, setBusyCollectors] = useState(0);
  const [offlineCollectors, setOfflineCollectors] = useState(0);

  const loadDriverStats = async () => {
    try {
      const statuses = await getAllDriverStatuses();
      setActiveCollectors(statuses.filter((s) => s.isOnline).length);
      setBusyCollectors(statuses.filter((s) => s.isOnline && s.activePickupId).length);
      setOfflineCollectors(statuses.filter((s) => !s.isOnline).length);
    } catch {
      // leave at 0 if unavailable
    }
  };

  useEffect(() => { loadDriverStats(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await loadDriverStats();
    setRefreshing(false);
  };

  const toggleWidget = (id: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  // Calculate metrics
  const today = new Date().toISOString().split("T")[0];
  const todayPayments = payments.filter(
    (p) => p.createdAt.startsWith(today) && p.status === "confirmed"
  );
  const dailyRevenue = todayPayments.reduce((sum, p) => sum + p.amount, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyPayments = payments.filter(
    (p) => new Date(p.createdAt) >= weekAgo && p.status === "confirmed"
  );
  const weeklyRevenue = weeklyPayments.reduce((sum, p) => sum + p.amount, 0);

  const completedPickups = pickups.filter((p) => p.status === "completed").length;
  const totalPickups = pickups.length;
  const completionRate = totalPickups > 0 ? Math.round((completedPickups / totalPickups) * 100) : 0;

  const pendingPickups = pickups.filter((p) => p.status === "pending").length;
  const inProgressPickups = pickups.filter((p) => p.status === "in_progress" || p.status === "assigned").length;

  // Derive top collectors from real pickup data
  const newUsersToday = 0; // requires user registry — show 0 until backend is wired

  const collectorPickupCounts: Record<string, { name: string; count: number }> = {};
  pickups.forEach((p) => {
    if (p.assignedDriverId) {
      if (!collectorPickupCounts[p.assignedDriverId]) {
        collectorPickupCounts[p.assignedDriverId] = { name: p.assignedDriverName || p.assignedDriverId, count: 0 };
      }
      collectorPickupCounts[p.assignedDriverId].count++;
    }
  });
  const topCollectors = Object.values(collectorPickupCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((c) => ({ name: c.name, pickups: c.count, rating: 0 }));

  // Recent activity derived from real pickups and payments
  const recentActivity = [
    ...pickups
      .filter((p) => p.status === "completed")
      .slice(-2)
      .map((p) => ({ type: "pickup", text: `Pickup completed — ${p.location?.address || "unknown location"}`, time: p.createdAt })),
    ...payments
      .slice(-2)
      .map((p) => ({ type: "payment", text: `Payment received K${p.amount}`, time: p.createdAt })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 4);

  const renderWidget = (widget: Widget) => {
    if (!widget.enabled && !editMode) return null;

    const opacity = widget.enabled ? 1 : 0.5;

    switch (widget.id) {
      case "daily_revenue":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: WIDGET_WIDTH, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="today" size={20} color="#22C55E" />
              <Text className="text-muted text-xs ml-2">Daily Revenue</Text>
            </View>
            <Text className="text-foreground text-2xl font-bold">K{dailyRevenue.toLocaleString()}</Text>
            <Text className="text-green-500 text-xs mt-1">+12% from yesterday</Text>
          </View>
        );

      case "weekly_revenue":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: WIDGET_WIDTH, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="date-range" size={20} color="#3B82F6" />
              <Text className="text-muted text-xs ml-2">Weekly Revenue</Text>
            </View>
            <Text className="text-foreground text-2xl font-bold">K{weeklyRevenue.toLocaleString()}</Text>
            <Text className="text-blue-500 text-xs mt-1">+8% from last week</Text>
          </View>
        );

      case "completion_rate":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: width - 32, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <MaterialIcons name="pie-chart" size={20} color="#8B5CF6" />
                <Text className="text-foreground font-semibold ml-2">Pickup Completion Rate</Text>
              </View>
              <Text className="text-2xl font-bold text-primary">{completionRate}%</Text>
            </View>
            <View className="h-3 bg-border rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${completionRate}%` }}
              />
            </View>
            <View className="flex-row justify-between mt-2">
              <Text className="text-muted text-xs">{completedPickups} completed</Text>
              <Text className="text-muted text-xs">{totalPickups} total</Text>
            </View>
          </View>
        );

      case "collector_availability":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: width - 32, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center mb-4">
              <MaterialIcons name="people" size={20} color="#F59E0B" />
              <Text className="text-foreground font-semibold ml-2">Collector Availability</Text>
            </View>
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-green-500/20 items-center justify-center mb-2">
                  <Text className="text-green-500 text-xl font-bold">{activeCollectors}</Text>
                </View>
                <Text className="text-muted text-xs">Active</Text>
              </View>
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-yellow-500/20 items-center justify-center mb-2">
                  <Text className="text-yellow-500 text-xl font-bold">{busyCollectors}</Text>
                </View>
                <Text className="text-muted text-xs">Busy</Text>
              </View>
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-gray-500/20 items-center justify-center mb-2">
                  <Text className="text-gray-500 text-xl font-bold">{offlineCollectors}</Text>
                </View>
                <Text className="text-muted text-xs">Offline</Text>
              </View>
              <View className="items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
                  <Text className="text-primary text-xl font-bold">
                    {activeCollectors + busyCollectors + offlineCollectors}
                  </Text>
                </View>
                <Text className="text-muted text-xs">Total</Text>
              </View>
            </View>
          </View>
        );

      case "pending_pickups":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: WIDGET_WIDTH, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="pending-actions" size={20} color="#F59E0B" />
              <Text className="text-muted text-xs ml-2">Pending</Text>
            </View>
            <Text className="text-foreground text-2xl font-bold">{pendingPickups}</Text>
            <Text className="text-yellow-500 text-xs mt-1">{inProgressPickups} in progress</Text>
          </View>
        );

      case "active_collectors":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: WIDGET_WIDTH, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="local-shipping" size={20} color="#22C55E" />
              <Text className="text-muted text-xs ml-2">Active Collectors</Text>
            </View>
            <Text className="text-foreground text-2xl font-bold">{activeCollectors}</Text>
            <Text className="text-green-500 text-xs mt-1">Online now</Text>
          </View>
        );

      case "new_users_today":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: WIDGET_WIDTH, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="person-add" size={20} color="#3B82F6" />
              <Text className="text-muted text-xs ml-2">New Users</Text>
            </View>
            <Text className="text-foreground text-2xl font-bold">{newUsersToday}</Text>
            <Text className="text-blue-500 text-xs mt-1">Today</Text>
          </View>
        );

      case "disputes_open":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: WIDGET_WIDTH, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="gavel" size={20} color="#EF4444" />
              <Text className="text-muted text-xs ml-2">Open Disputes</Text>
            </View>
            <Text className="text-foreground text-2xl font-bold">{stats.pendingDisputes}</Text>
            <Text className="text-red-500 text-xs mt-1">Needs attention</Text>
          </View>
        );

      case "top_collectors":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: width - 32, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center mb-4">
              <MaterialIcons name="emoji-events" size={20} color="#F59E0B" />
              <Text className="text-foreground font-semibold ml-2">Top Collectors</Text>
            </View>
            {topCollectors.map((collector, index) => (
              <View
                key={collector.name}
                className="flex-row items-center justify-between py-2 border-b border-border last:border-b-0"
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      index === 0
                        ? "bg-yellow-500"
                        : index === 1
                        ? "bg-gray-400"
                        : index === 2
                        ? "bg-amber-600"
                        : "bg-surface border border-border"
                    }`}
                  >
                    <Text className={index < 3 ? "text-white font-bold" : "text-foreground font-bold"}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text className="text-foreground font-medium ml-3">{collector.name}</Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-muted text-sm mr-3">{collector.pickups} pickups</Text>
                  <View className="flex-row items-center">
                    <MaterialIcons name="star" size={14} color="#F59E0B" />
                    <Text className="text-foreground text-sm ml-1">{collector.rating}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        );

      case "recent_activity":
        return (
          <View
            key={widget.id}
            className="bg-surface rounded-xl p-4 border border-border"
            style={{ width: width - 32, opacity }}
          >
            {editMode && (
              <TouchableOpacity
                onPress={() => toggleWidget(widget.id)}
                className="absolute top-2 right-2 z-10"
              >
                <MaterialIcons
                  name={widget.enabled ? "visibility" : "visibility-off"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            )}
            <View className="flex-row items-center mb-4">
              <MaterialIcons name="history" size={20} color="#8B5CF6" />
              <Text className="text-foreground font-semibold ml-2">Recent Activity</Text>
            </View>
            {recentActivity.map((activity, index) => {
              const iconMap: Record<string, { icon: string; color: string }> = {
                pickup: { icon: "local-shipping", color: "#22C55E" },
                payment: { icon: "payment", color: "#3B82F6" },
                user: { icon: "person-add", color: "#8B5CF6" },
                dispute: { icon: "gavel", color: "#EF4444" },
              };
              const { icon, color } = iconMap[activity.type];
              return (
                <View
                  key={index}
                  className="flex-row items-center py-2 border-b border-border last:border-b-0"
                >
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <MaterialIcons name={icon as any} size={16} color={color} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground text-sm">{activity.text}</Text>
                    <Text className="text-muted text-xs">{activity.time}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );

      default:
        return null;
    }
  };

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-4 bg-primary">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text className="text-white text-xl font-bold">Dashboard Widgets</Text>
              <Text className="text-white/80 text-sm">Customize your dashboard view</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-full ${editMode ? "bg-white" : "bg-white/20"}`}
          >
            <Text className={editMode ? "text-primary font-semibold" : "text-white font-semibold"}>
              {editMode ? "Done" : "Edit"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {editMode && (
        <View className="px-4 py-3 bg-yellow-500/10 border-b border-yellow-500/20">
          <View className="flex-row items-center">
            <MaterialIcons name="info" size={20} color="#F59E0B" />
            <Text className="text-yellow-600 text-sm ml-2">
              Tap the eye icon on any widget to show/hide it
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Small Widgets Row */}
        <View className="flex-row flex-wrap justify-between mb-4">
          {widgets
            .filter((w) => w.size === "small")
            .map((widget) => (
              <View key={widget.id} className="mb-4">
                {renderWidget(widget)}
              </View>
            ))}
        </View>

        {/* Medium and Large Widgets */}
        {widgets
          .filter((w) => w.size === "medium" || w.size === "large")
          .map((widget) => (
            <View key={widget.id} className="mb-4">
              {renderWidget(widget)}
            </View>
          ))}
      </ScrollView>
    </ScreenContainer>
  );
}
