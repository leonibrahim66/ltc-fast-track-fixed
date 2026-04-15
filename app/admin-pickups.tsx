import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { usePickups, Pickup } from "@/lib/pickups-context";
import { PICKUP_STATUS } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type StatusFilter = "all" | "pending" | "assigned" | "in_progress" | "completed" | "cancelled";

export default function AdminPickupsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, stats, refreshStats } = useAdmin();
  const { pickups, refreshPickups } = usePickups();
  const [filteredPickups, setFilteredPickups] = useState<Pickup[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    filterPickups();
  }, [pickups, searchQuery, statusFilter]);

  const filterPickups = () => {
    let filtered = [...pickups];

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.id.toLowerCase().includes(query) ||
          p.location?.address?.toLowerCase().includes(query) ||
          p.binType?.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredPickups(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPickups();
    await refreshStats();
    setRefreshing(false);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case PICKUP_STATUS.COMPLETED:
        return { bg: "bg-success/10", text: "text-success", color: "#22C55E", icon: "check-circle" };
      case PICKUP_STATUS.PENDING:
        return { bg: "bg-warning/10", text: "text-warning", color: "#F59E0B", icon: "schedule" };
      case PICKUP_STATUS.ASSIGNED:
        return { bg: "bg-blue-500/10", text: "text-blue-500", color: "#3B82F6", icon: "person-pin" };
      case PICKUP_STATUS.IN_PROGRESS:
        return { bg: "bg-purple-500/10", text: "text-purple-500", color: "#8B5CF6", icon: "local-shipping" };
      case PICKUP_STATUS.CANCELLED:
        return { bg: "bg-error/10", text: "text-error", color: "#EF4444", icon: "cancel" };
      default:
        return { bg: "bg-muted/10", text: "text-muted", color: "#9BA1A6", icon: "help" };
    }
  };

  // Calculate stats
  const pendingCount = pickups.filter((p) => p.status === PICKUP_STATUS.PENDING).length;
  const assignedCount = pickups.filter((p) => p.status === PICKUP_STATUS.ASSIGNED).length;
  const inProgressCount = pickups.filter((p) => p.status === PICKUP_STATUS.IN_PROGRESS).length;
  const completedCount = pickups.filter((p) => p.status === PICKUP_STATUS.COMPLETED).length;

  const statusFilters: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: pickups.length },
    { id: "pending", label: "Pending", count: pendingCount },
    { id: "assigned", label: "Assigned", count: assignedCount },
    { id: "in_progress", label: "In Progress", count: inProgressCount },
    { id: "completed", label: "Completed", count: completedCount },
  ];

  const renderPickupItem = ({ item }: { item: Pickup }) => {
    const statusStyle = getStatusStyle(item.status);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/pickup-detail?id=${item.id}` as any)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
      >
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: `${statusStyle.color}20` }}
            >
              <MaterialIcons name={statusStyle.icon as any} size={20} color={statusStyle.color} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-semibold capitalize">
                {item.binType} Pickup
              </Text>
              <Text className="text-muted text-xs" numberOfLines={1}>
                {item.location?.address || "Location pinned"}
              </Text>
            </View>
          </View>
          <View className={`px-3 py-1 rounded-full ${statusStyle.bg}`}>
            <Text className={`text-xs font-medium capitalize ${statusStyle.text}`}>
              {item.status.replace("_", " ")}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between pt-2 border-t border-border">
          <View className="flex-row items-center">
            <MaterialIcons name="receipt" size={14} color="#9BA1A6" />
            <Text className="text-muted text-xs ml-1">ID: {item.id.slice(0, 12)}...</Text>
          </View>
          <Text className="text-muted text-xs">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Additional Info */}
        <View className="flex-row mt-2 pt-2 border-t border-border">
          {item.scheduledDate && (
            <View className="flex-1">
              <Text className="text-xs text-muted">Scheduled</Text>
              <Text className="text-sm text-foreground">
                {new Date(item.scheduledDate).toLocaleDateString()}
              </Text>
            </View>
          )}
          {item.collectorId && (
            <View className="flex-1">
              <Text className="text-xs text-muted">Collector</Text>
              <Text className="text-sm text-foreground">
                {item.collectorName || "Assigned"}
              </Text>
            </View>
          )}
          {item.binType && (
            <View className="flex-1">
              <Text className="text-xs text-muted">Bin Type</Text>
              <Text className="text-sm text-foreground capitalize">{item.binType}</Text>
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
      <View className="px-6 pt-4 pb-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
          >
            <MaterialIcons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Garbage Tracking</Text>
            <Text className="text-muted">{filteredPickups.length} pickups</Text>
          </View>
        </View>

        {/* Stats Summary */}
        <View className="flex-row mb-4">
          <View className="flex-1 bg-warning/10 rounded-xl p-3 mr-1 items-center">
            <Text className="text-2xl font-bold text-warning">{pendingCount}</Text>
            <Text className="text-xs text-muted">Pending</Text>
          </View>
          <View className="flex-1 bg-blue-500/10 rounded-xl p-3 mx-1 items-center">
            <Text className="text-2xl font-bold text-blue-500">{assignedCount}</Text>
            <Text className="text-xs text-muted">Assigned</Text>
          </View>
          <View className="flex-1 bg-purple-500/10 rounded-xl p-3 mx-1 items-center">
            <Text className="text-2xl font-bold text-purple-500">{inProgressCount}</Text>
            <Text className="text-xs text-muted">In Progress</Text>
          </View>
          <View className="flex-1 bg-success/10 rounded-xl p-3 ml-1 items-center">
            <Text className="text-2xl font-bold text-success">{completedCount}</Text>
            <Text className="text-xs text-muted">Done</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface rounded-xl border border-border px-4 mb-4">
          <MaterialIcons name="search" size={20} color="#9BA1A6" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by ID, address, or type..."
            placeholderTextColor="#9BA1A6"
            className="flex-1 py-3 px-3 text-foreground"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={20} color="#9BA1A6" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {statusFilters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setStatusFilter(filter.id)}
                className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
                  statusFilter === filter.id ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`font-medium ${
                    statusFilter === filter.id ? "text-white" : "text-muted"
                  }`}
                >
                  {filter.label}
                </Text>
                <View
                  className={`ml-2 px-2 py-0.5 rounded-full ${
                    statusFilter === filter.id ? "bg-white/20" : "bg-muted/20"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      statusFilter === filter.id ? "text-white" : "text-muted"
                    }`}
                  >
                    {filter.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Pickups List */}
      <FlatList
        data={filteredPickups}
        renderItem={renderPickupItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <MaterialIcons name="local-shipping" size={48} color="#9BA1A6" />
            <Text className="text-muted text-center mt-4">No pickups found</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
