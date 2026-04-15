import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useITRealtime, ITRealtimeEvent, ITEventType } from "@/lib/it-realtime-context";
import { useAdmin } from "@/lib/admin-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

type FeedTab = "all" | "registrations" | "subscriptions" | "pickups";

const EVENT_ICONS: Record<ITEventType, string> = {
  new_registration: "person-add",
  subscription_new: "card-membership",
  subscription_renewed: "autorenew",
  subscription_expired: "event-busy",
  subscription_pending: "pending",
  pickup_pinned: "location-on",
  pickup_accepted: "check-circle",
  pickup_completed: "done-all",
  pickup_cancelled: "cancel",
  payment_received: "payments",
  payment_pending: "hourglass-empty",
  dispute_filed: "report-problem",
  collector_online: "wifi",
  collector_offline: "wifi-off",
  driver_approved: "verified-user",
  driver_rejected: "person-off",
};

const EVENT_COLORS: Record<ITEventType, string> = {
  new_registration: "#3B82F6",
  subscription_new: "#22C55E",
  subscription_renewed: "#8B5CF6",
  subscription_expired: "#EF4444",
  subscription_pending: "#F59E0B",
  pickup_pinned: "#0EA5E9",
  pickup_accepted: "#22C55E",
  pickup_completed: "#10B981",
  pickup_cancelled: "#EF4444",
  payment_received: "#22C55E",
  payment_pending: "#F59E0B",
  dispute_filed: "#EF4444",
  collector_online: "#22C55E",
  collector_offline: "#6B7280",
  driver_approved: "#22C55E",
  driver_rejected: "#EF4444",
};

const PRIORITY_COLORS = {
  low: "#6B7280",
  medium: "#3B82F6",
  high: "#F59E0B",
  critical: "#EF4444",
};

export default function AdminLiveFeedScreen() {
  const router = useRouter();
  const { isAdminAuthenticated } = useAdmin();
  const {
    events,
    unreadCount,
    markEventRead,
    markAllRead,
    recentRegistrations,
    pendingSubscriptions,
    livePickups,
    subscriptionEvents,
    stats,
    refreshData,
    isLoading,
  } = useITRealtime();

  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Redirect if not admin
  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login");
    }
  }, [isAdminAuthenticated]);

  // Auto-refresh every 8 seconds for near-real-time updates
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshData();
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshData]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await refreshData();
    setRefreshing(false);
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const handleEventPress = (event: ITRealtimeEvent) => {
    if (!event.read) {
      markEventRead(event.id);
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const renderEventItem = ({ item }: { item: ITRealtimeEvent }) => (
    <TouchableOpacity
      onPress={() => handleEventPress(item)}
      className={`bg-surface rounded-xl p-4 mb-3 border ${
        item.read ? "border-border" : "border-primary"
      }`}
    >
      <View className="flex-row items-start">
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: `${EVENT_COLORS[item.type]}20` }}
        >
          <MaterialIcons
            name={EVENT_ICONS[item.type] as any}
            size={20}
            color={EVENT_COLORS[item.type]}
          />
        </View>
        <View className="flex-1 ml-3">
          <View className="flex-row items-center justify-between">
            <Text className={`font-semibold ${item.read ? "text-muted" : "text-foreground"}`}>
              {item.title}
            </Text>
            <View className="flex-row items-center">
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: PRIORITY_COLORS[item.priority] }}
              />
              <Text className="text-xs text-muted">{formatTimeAgo(item.timestamp)}</Text>
            </View>
          </View>
          <Text className="text-sm text-muted mt-1">{item.description}</Text>
          {item.data.amount && (
            <Text className="text-sm text-primary font-semibold mt-1">
              K{item.data.amount.toLocaleString()}
            </Text>
          )}
        </View>
        {!item.read && (
          <View className="w-2 h-2 rounded-full bg-primary ml-2" />
        )}
      </View>
    </TouchableOpacity>
  );

  const tabs: { id: FeedTab; label: string; count: number }[] = [
    { id: "all", label: "All Events", count: events.length },
    { id: "registrations", label: "Registrations", count: recentRegistrations.length },
    { id: "subscriptions", label: "Subscriptions", count: subscriptionEvents.length },
    { id: "pickups", label: "Live Pickups", count: livePickups.length },
  ];

  const filteredEvents = events.filter((e) => {
    if (activeTab === "all") return true;
    if (activeTab === "registrations") return e.type === "new_registration";
    if (activeTab === "subscriptions") return e.type.includes("subscription");
    if (activeTab === "pickups") return e.type.includes("pickup");
    return true;
  });

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-4 bg-primary">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text className="text-white text-xl font-bold">Live Feed</Text>
              <Text className="text-white/80 text-sm">Real-time notifications</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={markAllRead}
                className="bg-white/20 px-3 py-1 rounded-full mr-2"
              >
                <Text className="text-white text-xs">Mark all read</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setAutoRefresh(!autoRefresh)}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                autoRefresh ? "bg-white/30" : "bg-white/10"
              }`}
            >
              <MaterialIcons
                name={autoRefresh ? "sync" : "sync-disabled"}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        <View className="flex-row justify-between bg-white/10 rounded-xl p-3">
          <View className="items-center flex-1">
            <Text className="text-white text-lg font-bold">{stats.totalRegistrationsToday}</Text>
            <Text className="text-white/70 text-xs">New Users</Text>
          </View>
          <View className="items-center flex-1 border-l border-white/20">
            <Text className="text-white text-lg font-bold">{stats.activePickups}</Text>
            <Text className="text-white/70 text-xs">Active Pickups</Text>
          </View>
          <View className="items-center flex-1 border-l border-white/20">
            <Text className="text-white text-lg font-bold">{stats.pendingPayments}</Text>
            <Text className="text-white/70 text-xs">Pending</Text>
          </View>
          <View className="items-center flex-1 border-l border-white/20">
            <Text className="text-white text-lg font-bold">{stats.onlineCollectors}</Text>
            <Text className="text-white/70 text-xs">Collectors</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-3 border-b border-border"
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
              activeTab === tab.id ? "bg-primary" : "bg-surface border border-border"
            }`}
          >
            <Text
              className={`font-medium ${
                activeTab === tab.id ? "text-white" : "text-foreground"
              }`}
            >
              {tab.label}
            </Text>
            <View
              className={`ml-2 px-2 py-0.5 rounded-full ${
                activeTab === tab.id ? "bg-white/20" : "bg-muted/20"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  activeTab === tab.id ? "text-white" : "text-muted"
                }`}
              >
                {tab.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22C55E" />
          <Text className="text-muted mt-2">Loading live data...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          renderItem={renderEventItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <MaterialIcons name="inbox" size={48} color="#9BA1A6" />
              <Text className="text-muted mt-2">No events to display</Text>
            </View>
          }
          ListHeaderComponent={
            unreadCount > 0 ? (
              <View className="bg-primary/10 rounded-xl p-3 mb-4 flex-row items-center">
                <MaterialIcons name="notifications-active" size={20} color="#22C55E" />
                <Text className="text-primary font-medium ml-2">
                  {unreadCount} new notification{unreadCount > 1 ? "s" : ""}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <View className="absolute bottom-24 left-0 right-0 items-center">
          <View className="bg-surface px-4 py-2 rounded-full border border-border shadow-sm flex-row items-center">
            <MaterialIcons name="sync" size={16} color="#22C55E" />
            <Text className="text-muted text-xs ml-2">Auto-refreshing every 30s</Text>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
