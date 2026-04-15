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
import { useITRealtime, LivePickup } from "@/lib/it-realtime-context";
import { useAdmin } from "@/lib/admin-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

type StatusFilter = "all" | "pending" | "accepted" | "in_progress" | "completed";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "#F59E0B", icon: "hourglass-empty" },
  accepted: { label: "Accepted", color: "#3B82F6", icon: "check-circle" },
  in_progress: { label: "In Progress", color: "#8B5CF6", icon: "local-shipping" },
  completed: { label: "Completed", color: "#22C55E", icon: "done-all" },
};

export default function AdminLivePickupsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated } = useAdmin();
  const { livePickups, updateLivePickup, refreshData, isLoading } = useITRealtime();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPickup, setSelectedPickup] = useState<LivePickup | null>(null);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login");
    }
  }, [isAdminAuthenticated]);

  // Auto-refresh every 8 seconds for near-real-time tracking
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
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m ago`;
  };

  const filteredPickups = livePickups.filter((p) => {
    if (statusFilter === "all") return true;
    return p.status === statusFilter;
  });

  const statusCounts = {
    all: livePickups.length,
    pending: livePickups.filter((p) => p.status === "pending").length,
    accepted: livePickups.filter((p) => p.status === "accepted").length,
    in_progress: livePickups.filter((p) => p.status === "in_progress").length,
    completed: livePickups.filter((p) => p.status === "completed").length,
  };

  const renderPickupCard = ({ item }: { item: LivePickup }) => {
    const config = STATUS_CONFIG[item.status];
    
    return (
      <TouchableOpacity
        onPress={() => setSelectedPickup(item)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
      >
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <MaterialIcons name={config.icon as any} size={20} color={config.color} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-semibold">{item.customerName}</Text>
              <Text className="text-muted text-sm">{item.binType}</Text>
            </View>
          </View>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: `${config.color}20` }}
          >
            <Text className="text-xs font-semibold" style={{ color: config.color }}>
              {config.label}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mb-2">
          <MaterialIcons name="location-on" size={16} color="#6B7280" />
          <Text className="text-muted text-sm ml-1 flex-1" numberOfLines={1}>
            {item.location.address}
          </Text>
        </View>

        {item.collectorName && (
          <View className="flex-row items-center mb-2">
            <MaterialIcons name="person" size={16} color="#22C55E" />
            <Text className="text-primary text-sm ml-1">{item.collectorName}</Text>
          </View>
        )}

        <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
          <View className="flex-row items-center">
            <MaterialIcons name="access-time" size={14} color="#6B7280" />
            <Text className="text-muted text-xs ml-1">
              Pinned {formatTimeAgo(item.pinnedAt)}
            </Text>
          </View>
          {item.scheduledFor && (
            <View className="flex-row items-center">
              <MaterialIcons name="schedule" size={14} color="#3B82F6" />
              <Text className="text-blue-500 text-xs ml-1">
                Scheduled: {new Date(item.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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
              <Text className="text-white text-xl font-bold">Live Pickups</Text>
              <Text className="text-white/80 text-sm">Real-time tracking</Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <View className="bg-white/20 px-3 py-1 rounded-full flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-green-400 mr-2" />
              <Text className="text-white text-sm">Live</Text>
            </View>
          </View>
        </View>

        {/* Summary Stats */}
        <View className="flex-row justify-between bg-white/10 rounded-xl p-3">
          <View className="items-center flex-1">
            <Text className="text-white text-2xl font-bold">{statusCounts.pending}</Text>
            <Text className="text-white/70 text-xs">Pending</Text>
          </View>
          <View className="items-center flex-1 border-l border-white/20">
            <Text className="text-white text-2xl font-bold">{statusCounts.accepted}</Text>
            <Text className="text-white/70 text-xs">Accepted</Text>
          </View>
          <View className="items-center flex-1 border-l border-white/20">
            <Text className="text-white text-2xl font-bold">{statusCounts.in_progress}</Text>
            <Text className="text-white/70 text-xs">In Progress</Text>
          </View>
          <View className="items-center flex-1 border-l border-white/20">
            <Text className="text-white text-2xl font-bold">{statusCounts.completed}</Text>
            <Text className="text-white/70 text-xs">Completed</Text>
          </View>
        </View>
      </View>

      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 py-3 border-b border-border"
      >
        {(["all", "pending", "accepted", "in_progress", "completed"] as StatusFilter[]).map((status) => (
          <TouchableOpacity
            key={status}
            onPress={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
              statusFilter === status ? "bg-primary" : "bg-surface border border-border"
            }`}
          >
            <Text
              className={`font-medium capitalize ${
                statusFilter === status ? "text-white" : "text-foreground"
              }`}
            >
              {status === "all" ? "All" : status.replace("_", " ")}
            </Text>
            <View
              className={`ml-2 px-2 py-0.5 rounded-full ${
                statusFilter === status ? "bg-white/20" : "bg-muted/20"
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  statusFilter === status ? "text-white" : "text-muted"
                }`}
              >
                {statusCounts[status]}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pickup List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#22C55E" />
          <Text className="text-muted mt-2">Loading pickups...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPickups}
          renderItem={renderPickupCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <MaterialIcons name="local-shipping" size={48} color="#9BA1A6" />
              <Text className="text-muted mt-2">No pickups to display</Text>
            </View>
          }
        />
      )}

      {/* Pickup Detail Modal */}
      {selectedPickup && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center px-6">
          <View className="bg-surface rounded-2xl p-6 w-full max-w-md">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground text-xl font-bold">Pickup Details</Text>
              <TouchableOpacity onPress={() => setSelectedPickup(null)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-1">Customer</Text>
              <Text className="text-foreground font-semibold text-lg">
                {selectedPickup.customerName}
              </Text>
            </View>

            <View className="mb-4">
              <Text className="text-muted text-sm mb-1">Location</Text>
              <Text className="text-foreground">{selectedPickup.location.address}</Text>
              <Text className="text-muted text-xs mt-1">
                {selectedPickup.location.latitude.toFixed(4)}, {selectedPickup.location.longitude.toFixed(4)}
              </Text>
            </View>

            <View className="flex-row mb-4">
              <View className="flex-1">
                <Text className="text-muted text-sm mb-1">Bin Type</Text>
                <Text className="text-foreground">{selectedPickup.binType}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-muted text-sm mb-1">Status</Text>
                <View
                  className="px-3 py-1 rounded-full self-start"
                  style={{ backgroundColor: `${STATUS_CONFIG[selectedPickup.status].color}20` }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: STATUS_CONFIG[selectedPickup.status].color }}
                  >
                    {STATUS_CONFIG[selectedPickup.status].label}
                  </Text>
                </View>
              </View>
            </View>

            {selectedPickup.collectorName && (
              <View className="mb-4">
                <Text className="text-muted text-sm mb-1">Assigned Driver</Text>
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center">
                    <MaterialIcons name="person" size={16} color="#22C55E" />
                  </View>
                  <Text className="text-foreground ml-2">{selectedPickup.collectorName}</Text>
                </View>
              </View>
            )}

            <View className="mb-4">
              <Text className="text-muted text-sm mb-1">Pinned At</Text>
              <Text className="text-foreground">
                {new Date(selectedPickup.pinnedAt).toLocaleString()}
              </Text>
            </View>

            {selectedPickup.scheduledFor && (
              <View className="mb-4">
                <Text className="text-muted text-sm mb-1">Scheduled For</Text>
                <Text className="text-blue-500 font-semibold">
                  {new Date(selectedPickup.scheduledFor).toLocaleString()}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => setSelectedPickup(null)}
              className="bg-primary py-3 rounded-xl mt-2"
            >
              <Text className="text-white text-center font-semibold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Live indicator */}
      <View className="absolute bottom-24 left-0 right-0 items-center">
        <View className="bg-surface px-4 py-2 rounded-full border border-border shadow-sm flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
          <Text className="text-muted text-xs">Refreshing every 15s</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
