import {useEffect, useState, useCallback} from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import {useRouter, useFocusEffect} from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { User } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface CollectorPerformance extends User {
  completedPickups: number;
  averageRating: number;
  totalEarnings: number;
  lastActive: string;
  performanceStatus: "excellent" | "good" | "warning" | "poor";
}

type FilterType = "all" | "excellent" | "good" | "warning" | "poor";

export default function AdminPerformanceScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, addNotification } = useAdmin();
  const [collectors, setCollectors] = useState<CollectorPerformance[]>([]);
  const [filteredCollectors, setFilteredCollectors] = useState<CollectorPerformance[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    loadCollectorPerformance();
  }, [isAdminAuthenticated]);

  useEffect(() => {
    filterCollectors();
  }, [collectors, searchQuery, filter]);

  const loadCollectorPerformance = async () => {
    try {
      // Load users
      const usersDb = await AsyncStorage.getItem("@ltc_users_db");
      const pickupsData = await AsyncStorage.getItem("ltc_pickups");

      if (usersDb) {
        const parsed = JSON.parse(usersDb);
        const usersList = Object.values(parsed) as User[];
        const collectorUsers = usersList.filter((u) => u.role === "collector" || u.role === "zone_manager");

        // Parse pickups for performance calculation
        const pickups = pickupsData ? JSON.parse(pickupsData) : [];

        // Calculate performance for each collector
        const performanceData: CollectorPerformance[] = collectorUsers.map((collector) => {
          const collectorPickups = pickups.filter(
            (p: any) => p.collectorId === collector.id && p.status === "completed"
          );
          const completedPickups = collectorPickups.length;

          // Calculate average rating from pickups with ratings
          const ratedPickups = collectorPickups.filter((p: any) => p.rating);
          const averageRating =
            ratedPickups.length > 0
              ? ratedPickups.reduce((sum: number, p: any) => sum + p.rating, 0) / ratedPickups.length
              : 0;

          // Calculate total earnings
          const totalEarnings = collectorPickups.reduce(
            (sum: number, p: any) => sum + (p.collectorEarnings || 0),
            0
          );

          // Determine performance status
          let performanceStatus: "excellent" | "good" | "warning" | "poor" = "good";
          if (averageRating >= 4.5 && completedPickups >= 50) {
            performanceStatus = "excellent";
          } else if (averageRating >= 4.0 || completedPickups >= 30) {
            performanceStatus = "good";
          } else if (averageRating >= 3.0 || completedPickups >= 10) {
            performanceStatus = "warning";
          } else if (averageRating > 0 && averageRating < 3.0) {
            performanceStatus = "poor";
          }

          return {
            ...collector,
            completedPickups,
            averageRating,
            totalEarnings,
            lastActive: new Date().toISOString(),
            performanceStatus,
          };
        });

        // Sort by completed pickups (highest first)
        performanceData.sort((a, b) => b.completedPickups - a.completedPickups);

        setCollectors(performanceData);
      }
    } catch (error) {
      console.error("Failed to load collector performance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterCollectors = () => {
    let filtered = [...collectors];

    if (filter !== "all") {
      filtered = filtered.filter((c) => c.performanceStatus === filter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.fullName?.toLowerCase().includes(query) ||
          c.phone?.toLowerCase().includes(query)
      );
    }

    setFilteredCollectors(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCollectorPerformance();
    setRefreshing(false);
  };

  const sendPerformanceAlert = async (collector: CollectorPerformance) => {
    Alert.alert(
      "Send Performance Alert",
      `Send a performance notification to ${collector.fullName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Warning",
          style: "destructive",
          onPress: async () => {
            await addNotification({
              type: "system",
              title: "Performance Alert Sent",
              message: `Performance warning sent to ${collector.fullName}`,
              data: { collectorId: collector.id },
            });
            Alert.alert("Success", "Performance alert has been sent");
          },
        },
        {
          text: "Send Encouragement",
          onPress: async () => {
            await addNotification({
              type: "system",
              title: "Encouragement Sent",
              message: `Encouragement message sent to ${collector.fullName}`,
              data: { collectorId: collector.id },
            });
            Alert.alert("Success", "Encouragement message has been sent");
          },
        },
      ]
    );
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "excellent":
        return { bg: "bg-success/10", text: "text-success", color: "#22C55E", icon: "emoji-events" };
      case "good":
        return { bg: "bg-blue-500/10", text: "text-blue-500", color: "#3B82F6", icon: "thumb-up" };
      case "warning":
        return { bg: "bg-warning/10", text: "text-warning", color: "#F59E0B", icon: "warning" };
      case "poor":
        return { bg: "bg-error/10", text: "text-error", color: "#EF4444", icon: "thumb-down" };
      default:
        return { bg: "bg-muted/10", text: "text-muted", color: "#9BA1A6", icon: "help" };
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <MaterialIcons
          key={i}
          name={i <= rating ? "star" : i - 0.5 <= rating ? "star-half" : "star-outline"}
          size={14}
          color="#F59E0B"
        />
      );
    }
  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadCollectorPerformance();
    }, [loadCollectorPerformance])
  );

    return <View className="flex-row">{stars}</View>;
  };

  // Calculate stats
  const excellentCount = collectors.filter((c) => c.performanceStatus === "excellent").length;
  const goodCount = collectors.filter((c) => c.performanceStatus === "good").length;
  const warningCount = collectors.filter((c) => c.performanceStatus === "warning").length;
  const poorCount = collectors.filter((c) => c.performanceStatus === "poor").length;

  const filters: { id: FilterType; label: string; count: number }[] = [
    { id: "all", label: "All", count: collectors.length },
    { id: "excellent", label: "Excellent", count: excellentCount },
    { id: "good", label: "Good", count: goodCount },
    { id: "warning", label: "Warning", count: warningCount },
    { id: "poor", label: "Poor", count: poorCount },
  ];

  const renderCollectorItem = ({ item, index }: { item: CollectorPerformance; index: number }) => {
    const statusStyle = getStatusStyle(item.performanceStatus);

    return (
      <TouchableOpacity
        onPress={() => sendPerformanceAlert(item)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
      >
        <View className="flex-row items-start">
          <View className="items-center mr-3">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: `${statusStyle.color}20` }}
            >
              <Text className="text-lg font-bold" style={{ color: statusStyle.color }}>
                #{index + 1}
              </Text>
            </View>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground font-semibold">{item.fullName}</Text>
              <View className={`px-2 py-1 rounded-full ${statusStyle.bg}`}>
                <Text className={`text-xs font-medium capitalize ${statusStyle.text}`}>
                  {item.performanceStatus}
                </Text>
              </View>
            </View>
            <Text className="text-muted text-xs">{item.phone}</Text>

            {/* Stats Row */}
            <View className="flex-row mt-3 pt-3 border-t border-border">
              <View className="flex-1">
                <Text className="text-xs text-muted">Pickups</Text>
                <Text className="text-foreground font-semibold">{item.completedPickups}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted">Rating</Text>
                <View className="flex-row items-center">
                  {item.averageRating > 0 ? (
                    <>
                      {renderStars(item.averageRating)}
                      <Text className="text-foreground font-semibold ml-1">
                        {item.averageRating.toFixed(1)}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-muted text-sm">No ratings</Text>
                  )}
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-muted">Earnings</Text>
                <Text className="text-success font-semibold">
                  K{item.totalEarnings.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Status indicator */}
            <View className="flex-row items-center mt-2">
              <View
                className={`w-2 h-2 rounded-full mr-2 ${
                  item.availabilityStatus === "online"
                    ? "bg-success"
                    : item.availabilityStatus === "busy"
                    ? "bg-warning"
                    : "bg-muted"
                }`}
              />
              <Text className="text-muted text-xs capitalize">
                {item.availabilityStatus || "offline"}
              </Text>
              <Text className="text-muted text-xs ml-2">
                • Last active: {new Date(item.lastActive).toLocaleDateString()}
              </Text>
            </View>
          </View>
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
            <Text className="text-2xl font-bold text-foreground">Collector Performance</Text>
            <Text className="text-muted">{collectors.length} collectors</Text>
          </View>
        </View>

        {/* Stats Summary */}
        <View className="flex-row mb-4">
          <View className="flex-1 bg-success/10 rounded-xl p-3 mr-1 items-center">
            <MaterialIcons name="emoji-events" size={20} color="#22C55E" />
            <Text className="text-lg font-bold text-success">{excellentCount}</Text>
            <Text className="text-xs text-muted">Excellent</Text>
          </View>
          <View className="flex-1 bg-blue-500/10 rounded-xl p-3 mx-1 items-center">
            <MaterialIcons name="thumb-up" size={20} color="#3B82F6" />
            <Text className="text-lg font-bold text-blue-500">{goodCount}</Text>
            <Text className="text-xs text-muted">Good</Text>
          </View>
          <View className="flex-1 bg-warning/10 rounded-xl p-3 mx-1 items-center">
            <MaterialIcons name="warning" size={20} color="#F59E0B" />
            <Text className="text-lg font-bold text-warning">{warningCount}</Text>
            <Text className="text-xs text-muted">Warning</Text>
          </View>
          <View className="flex-1 bg-error/10 rounded-xl p-3 ml-1 items-center">
            <MaterialIcons name="thumb-down" size={20} color="#EF4444" />
            <Text className="text-lg font-bold text-error">{poorCount}</Text>
            <Text className="text-xs text-muted">Poor</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface rounded-xl border border-border px-4 mb-4">
          <MaterialIcons name="search" size={20} color="#9BA1A6" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search collectors..."
            placeholderTextColor="#9BA1A6"
            className="flex-1 py-3 px-3 text-foreground"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={20} color="#9BA1A6" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {filters.map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
                  filter === f.id ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`font-medium ${filter === f.id ? "text-white" : "text-muted"}`}
                >
                  {f.label}
                </Text>
                <View
                  className={`ml-2 px-2 py-0.5 rounded-full ${
                    filter === f.id ? "bg-white/20" : "bg-muted/20"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      filter === f.id ? "text-white" : "text-muted"
                    }`}
                  >
                    {f.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Collectors List */}
      <FlatList
        data={filteredCollectors}
        renderItem={renderCollectorItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <MaterialIcons name="trending-up" size={48} color="#9BA1A6" />
            <Text className="text-muted text-center mt-4">
              {isLoading ? "Loading performance data..." : "No collectors found"}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
