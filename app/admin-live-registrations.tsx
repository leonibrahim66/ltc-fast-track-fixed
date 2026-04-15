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
import { useITRealtime, RecentRegistration, PendingSubscription, SubscriptionEvent } from "@/lib/it-realtime-context";
import { useAdmin } from "@/lib/admin-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

type ViewTab = "registrations" | "pending_subs" | "sub_events";

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  residential: { label: "Residential", color: "#3B82F6", icon: "home" },
  commercial: { label: "Commercial", color: "#8B5CF6", icon: "business" },
  collector: { label: "Collector", color: "#22C55E", icon: "local-shipping" },
  recycler: { label: "Recycler", color: "#F59E0B", icon: "recycling" },
};

const SUB_EVENT_CONFIG = {
  new: { label: "New", color: "#22C55E", icon: "add-circle" },
  renewed: { label: "Renewed", color: "#3B82F6", icon: "autorenew" },
  expired: { label: "Expired", color: "#EF4444", icon: "event-busy" },
  cancelled: { label: "Cancelled", color: "#6B7280", icon: "cancel" },
};

export default function AdminLiveRegistrationsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated } = useAdmin();
  const {
    recentRegistrations,
    pendingSubscriptions,
    subscriptionEvents,
    removePendingSubscription,
    refreshData,
    isLoading,
  } = useITRealtime();

  const [activeTab, setActiveTab] = useState<ViewTab>("registrations");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login");
    }
  }, [isAdminAuthenticated]);

  // Auto-refresh every 8 seconds for near-real-time registration updates
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 8000);
    return () => clearInterval(interval);
  }, [refreshData]);

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

  const handleApproveSub = (subId: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    removePendingSubscription(subId);
  };

  const renderRegistrationItem = ({ item }: { item: RecentRegistration }) => {
    const config = ROLE_CONFIG[item.role] || ROLE_CONFIG.residential;
    
    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row items-start">
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <MaterialIcons name={config.icon as any} size={24} color={config.color} />
          </View>
          <View className="flex-1 ml-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground font-semibold text-lg">{item.fullName}</Text>
              {item.verified ? (
                <View className="flex-row items-center bg-green-500/20 px-2 py-1 rounded-full">
                  <MaterialIcons name="verified" size={12} color="#22C55E" />
                  <Text className="text-green-500 text-xs ml-1">Verified</Text>
                </View>
              ) : (
                <View className="flex-row items-center bg-yellow-500/20 px-2 py-1 rounded-full">
                  <MaterialIcons name="pending" size={12} color="#F59E0B" />
                  <Text className="text-yellow-500 text-xs ml-1">Pending</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center mt-1">
              <MaterialIcons name="phone" size={14} color="#6B7280" />
              <Text className="text-muted text-sm ml-1">{item.phone}</Text>
            </View>
            {item.location && (
              <View className="flex-row items-center mt-1">
                <MaterialIcons name="location-on" size={14} color="#6B7280" />
                <Text className="text-muted text-sm ml-1">{item.location}</Text>
              </View>
            )}
            <View className="flex-row items-center justify-between mt-2">
              <View
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: `${config.color}20` }}
              >
                <Text className="text-xs font-medium" style={{ color: config.color }}>
                  {config.label}
                </Text>
              </View>
              <Text className="text-muted text-xs">{formatTimeAgo(item.registeredAt)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderPendingSubItem = ({ item }: { item: PendingSubscription }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-foreground font-semibold text-lg">{item.userName}</Text>
          <Text className="text-muted text-sm">{item.phone}</Text>
        </View>
        <View
          className={`px-3 py-1 rounded-full ${
            item.paymentStatus === "pending" ? "bg-yellow-500/20" : "bg-blue-500/20"
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              item.paymentStatus === "pending" ? "text-yellow-500" : "text-blue-500"
            }`}
          >
            {item.paymentStatus === "pending" ? "Payment Pending" : "Awaiting Verification"}
          </Text>
        </View>
      </View>

      <View className="bg-background rounded-lg p-3 mb-3">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-muted text-xs">Plan</Text>
            <Text className="text-foreground font-semibold">{item.planName}</Text>
          </View>
          <View className="items-end">
            <Text className="text-muted text-xs">Amount</Text>
            <Text className="text-primary font-bold text-lg">K{item.planPrice}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-muted text-xs">Requested {formatTimeAgo(item.requestedAt)}</Text>
        <View className="flex-row">
          <TouchableOpacity
            onPress={() => handleApproveSub(item.id)}
            className="bg-primary px-4 py-2 rounded-lg mr-2"
          >
            <Text className="text-white font-semibold text-sm">Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => removePendingSubscription(item.id)}
            className="bg-error/20 px-4 py-2 rounded-lg"
          >
            <Text className="text-error font-semibold text-sm">Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderSubEventItem = ({ item }: { item: SubscriptionEvent }) => {
    const config = SUB_EVENT_CONFIG[item.eventType];
    
    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row items-center">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <MaterialIcons name={config.icon as any} size={20} color={config.color} />
          </View>
          <View className="flex-1 ml-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground font-semibold">{item.userName}</Text>
              <View
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: `${config.color}20` }}
              >
                <Text className="text-xs font-semibold" style={{ color: config.color }}>
                  {config.label}
                </Text>
              </View>
            </View>
            <Text className="text-muted text-sm">{item.planName}</Text>
            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-primary font-semibold">K{item.planPrice}</Text>
              <Text className="text-muted text-xs">{formatTimeAgo(item.timestamp)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const tabs: { id: ViewTab; label: string; count: number }[] = [
    { id: "registrations", label: "New Users", count: recentRegistrations.length },
    { id: "pending_subs", label: "Pending Subs", count: pendingSubscriptions.length },
    { id: "sub_events", label: "Sub Events", count: subscriptionEvents.length },
  ];

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-4 bg-primary">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3"
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text className="text-white text-xl font-bold">Users & Subscriptions</Text>
            <Text className="text-white/80 text-sm">Registrations & subscription activity</Text>
          </View>
        </View>

        {/* Summary Stats */}
        <View className="flex-row justify-between bg-white/10 rounded-xl p-3">
          <View className="items-center flex-1">
            <Text className="text-white text-2xl font-bold">{recentRegistrations.length}</Text>
            <Text className="text-white/70 text-xs">New Users</Text>
          </View>
          <View className="items-center flex-1 border-l border-white/20">
            <Text className="text-white text-2xl font-bold">{pendingSubscriptions.length}</Text>
            <Text className="text-white/70 text-xs">Pending</Text>
          </View>
          <View className="items-center flex-1 border-l border-white/20">
            <Text className="text-white text-2xl font-bold">
              {subscriptionEvents.filter((e) => e.eventType === "new").length}
            </Text>
            <Text className="text-white/70 text-xs">New Subs</Text>
          </View>
          <View className="items-center flex-1 border-l border-white/20">
            <Text className="text-white text-2xl font-bold">
              {subscriptionEvents.filter((e) => e.eventType === "expired").length}
            </Text>
            <Text className="text-white/70 text-xs">Expired</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 py-3 border-b border-border">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg mx-1 flex-row items-center justify-center ${
              activeTab === tab.id ? "bg-primary" : "bg-surface border border-border"
            }`}
          >
            <Text
              className={`font-medium text-sm ${
                activeTab === tab.id ? "text-white" : "text-foreground"
              }`}
            >
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View
                className={`ml-1 px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? "bg-white/20" : "bg-primary/20"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    activeTab === tab.id ? "text-white" : "text-primary"
                  }`}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22C55E" />
          <Text className="text-muted mt-2">Loading data...</Text>
        </View>
      ) : (
        <FlatList
          data={
            activeTab === "registrations"
              ? recentRegistrations
              : activeTab === "pending_subs"
              ? pendingSubscriptions
              : subscriptionEvents
          }
          renderItem={
            activeTab === "registrations"
              ? renderRegistrationItem as any
              : activeTab === "pending_subs"
              ? renderPendingSubItem as any
              : renderSubEventItem as any
          }
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <MaterialIcons name="inbox" size={48} color="#9BA1A6" />
              <Text className="text-muted mt-2">No data to display</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
