import {useEffect, useState, useCallback} from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
} from "react-native";
import {useRouter, useFocusEffect} from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { User } from "@/lib/auth-context";
import { APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

type StatusFilter = "all" | "active" | "expiring" | "expired";

interface SubscriptionUser extends User {
  daysRemaining?: number;
}

export default function AdminSubscriptionsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, stats, refreshStats } = useAdmin();
  const [users, setUsers] = useState<SubscriptionUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<SubscriptionUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    loadSubscriptions();
  }, [isAdminAuthenticated]);

  useEffect(() => {
    filterUsers();
  }, [users, searchQuery, statusFilter]);

  const loadSubscriptions = async () => {
    try {
      const usersDb = await AsyncStorage.getItem("@ltc_users_db");
      if (usersDb) {
        const parsed = JSON.parse(usersDb);
        const usersList = Object.values(parsed) as User[];
        
        // Filter users with subscriptions and calculate days remaining
        const subscribedUsers: SubscriptionUser[] = usersList
          .filter((u) => u.subscription)
          .map((u) => {
            const endDate = u.subscription?.expiresAt ? new Date(u.subscription.expiresAt) : null;
            const now = new Date();
            const daysRemaining = endDate
              ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null;
            return {
              ...u,
              daysRemaining: daysRemaining ?? undefined,
            };
          });
        
        setUsers(subscribedUsers);
      }
    } catch (error) {
      console.error("Failed to load subscriptions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((u) => (u.daysRemaining ?? 0) > 7);
    } else if (statusFilter === "expiring") {
      filtered = filtered.filter(
        (u) => (u.daysRemaining ?? 0) > 0 && (u.daysRemaining ?? 0) <= 7
      );
    } else if (statusFilter === "expired") {
      filtered = filtered.filter((u) => (u.daysRemaining ?? 0) <= 0);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.fullName?.toLowerCase().includes(query) ||
          u.phone?.toLowerCase().includes(query)
      );
    }

    // Sort by days remaining (expiring soon first)
    filtered.sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));

    setFilteredUsers(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSubscriptions();
    await refreshStats();
    setRefreshing(false);
  };

  const getStatusStyle = (daysRemaining?: number) => {
    if (daysRemaining === undefined || daysRemaining <= 0) {
      return { bg: "bg-error/10", text: "text-error", color: "#EF4444", label: "Expired" };
    } else if (daysRemaining <= 7) {
      return { bg: "bg-warning/10", text: "text-warning", color: "#F59E0B", label: "Expiring Soon" };
    } else {
      return { bg: "bg-success/10", text: "text-success", color: "#22C55E", label: "Active" };
    }
  };

  // Calculate stats
  const activeCount = users.filter((u) => (u.daysRemaining ?? 0) > 7).length;
  const expiringCount = users.filter(
    (u) => (u.daysRemaining ?? 0) > 0 && (u.daysRemaining ?? 0) <= 7
  ).length;
  const expiredCount = users.filter((u) => (u.daysRemaining ?? 0) <= 0).length;

  const statusFilters: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: users.length },
    { id: "active", label: "Active", count: activeCount },
    { id: "expiring", label: "Expiring", count: expiringCount },
    { id: "expired", label: "Expired", count: expiredCount },
  ];

  const renderUserItem = ({ item }: { item: SubscriptionUser }) => {
    const statusStyle = getStatusStyle(item.daysRemaining);
  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
    }, [loadSubscriptions])
  );


    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: `${statusStyle.color}20` }}
            >
              <MaterialIcons name="card-membership" size={20} color={statusStyle.color} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-semibold">{item.fullName}</Text>
              <Text className="text-muted text-xs">{item.phone}</Text>
            </View>
          </View>
          <View className={`px-3 py-1 rounded-full ${statusStyle.bg}`}>
            <Text className={`text-xs font-medium ${statusStyle.text}`}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        {item.subscription && (
          <View className="flex-row items-center justify-between pt-2 border-t border-border">
            <View>
              <Text className="text-muted text-xs">Plan</Text>
              <Text className="text-foreground font-medium capitalize">
                {item.subscription.planName}
              </Text>
            </View>
            <View>
              <Text className="text-muted text-xs">Remaining</Text>
              <Text className="text-foreground font-medium">
                {item.subscription.pickupsRemaining} pickups
              </Text>
            </View>
            <View>
              <Text className="text-muted text-xs">Days Left</Text>
              <Text
                className={`font-bold ${
                  (item.daysRemaining ?? 0) <= 0
                    ? "text-error"
                    : (item.daysRemaining ?? 0) <= 7
                    ? "text-warning"
                    : "text-success"
                }`}
              >
                {(item.daysRemaining ?? 0) <= 0 ? "Expired" : `${item.daysRemaining} days`}
              </Text>
            </View>
          </View>
        )}

        {item.subscription?.expiresAt && (
          <View className="mt-2">
            <Text className="text-muted text-xs">
              Expires: {new Date(item.subscription.expiresAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>
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
            <Text className="text-2xl font-bold text-foreground">Subscriptions</Text>
            <Text className="text-muted">{users.length} subscribed users</Text>
          </View>
        </View>

        {/* Stats Summary */}
        <View className="flex-row mb-4">
          <View className="flex-1 bg-success/10 rounded-xl p-3 mr-1 items-center">
            <Text className="text-2xl font-bold text-success">{activeCount}</Text>
            <Text className="text-xs text-muted">Active</Text>
          </View>
          <View className="flex-1 bg-warning/10 rounded-xl p-3 mx-1 items-center">
            <Text className="text-2xl font-bold text-warning">{expiringCount}</Text>
            <Text className="text-xs text-muted">Expiring</Text>
          </View>
          <View className="flex-1 bg-error/10 rounded-xl p-3 ml-1 items-center">
            <Text className="text-2xl font-bold text-error">{expiredCount}</Text>
            <Text className="text-xs text-muted">Expired</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface rounded-xl border border-border px-4 mb-4">
          <MaterialIcons name="search" size={20} color="#9BA1A6" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or phone..."
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

      {/* Subscriptions List */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <MaterialIcons name="card-membership" size={48} color="#9BA1A6" />
            <Text className="text-muted text-center mt-4">
              {isLoading ? "Loading subscriptions..." : "No subscriptions found"}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
