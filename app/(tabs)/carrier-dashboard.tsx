import { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  FlatList,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { CarrierBottomNav } from "@/components/carrier-bottom-nav";
import { useAuth } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

interface CarrierBooking {
  id: string;
  bookingId: string;
  customerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  vehicleType: string;
  status: "pending" | "accepted" | "in-progress" | "completed" | "cancelled";
  bookingDate: string;
  scheduledTime: string;
  estimatedPrice: number;
  actualPrice?: number;
  cargoType: string;
  cargoWeight: string;
  rating?: number;
  distance?: number;
  duration?: string;
}

interface CarrierStats {
  totalBookings: number;
  completedBookings: number;
  pendingBookings: number;
  totalEarnings: number;
  averageRating: number;
  acceptanceRate: number;
}

export default function CarrierDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<CarrierBooking[]>([]);
  const [stats, setStats] = useState<CarrierStats>({
    totalBookings: 0,
    completedBookings: 0,
    pendingBookings: 0,
    totalEarnings: 0,
    averageRating: 0,
    acceptanceRate: 0,
  });
  const [selectedFilter, setSelectedFilter] = useState<"all" | "pending" | "accepted" | "completed">("all");

  useEffect(() => {
    loadCarrierData();
  }, []);

  const loadCarrierData = async () => {
    try {
      // Mock data - replace with actual API call
      const mockBookings: CarrierBooking[] = [
        {
          id: "1",
          bookingId: "BK-001",
          customerName: "John Doe",
          pickupLocation: "Lusaka, Zambia",
          dropoffLocation: "Ndola, Zambia",
          vehicleType: "Pickup Truck",
          status: "pending",
          bookingDate: "2026-01-22",
          scheduledTime: "14:00",
          estimatedPrice: 450,
          cargoType: "General Cargo",
          cargoWeight: "500kg",
        },
        {
          id: "2",
          bookingId: "BK-002",
          customerName: "Jane Smith",
          pickupLocation: "Kitwe, Zambia",
          dropoffLocation: "Livingstone, Zambia",
          vehicleType: "Motorbike",
          status: "in-progress",
          bookingDate: "2026-01-22",
          scheduledTime: "10:00",
          estimatedPrice: 150,
          cargoType: "Documents",
          cargoWeight: "5kg",
          distance: 45,
          duration: "1h 30m",
        },
        {
          id: "3",
          bookingId: "BK-003",
          customerName: "ABC Company",
          pickupLocation: "Lusaka Industrial",
          dropoffLocation: "Copperbelt",
          vehicleType: "Heavy Truck",
          status: "completed",
          bookingDate: "2026-01-21",
          scheduledTime: "08:00",
          estimatedPrice: 1200,
          actualPrice: 1250,
          cargoType: "Industrial Equipment",
          cargoWeight: "5000kg",
          rating: 5,
          distance: 120,
          duration: "4h 15m",
        },
      ];

      setBookings(mockBookings);

      // Calculate stats
      const completed = mockBookings.filter((b) => b.status === "completed").length;
      const pending = mockBookings.filter((b) => b.status === "pending").length;
      const totalEarnings = mockBookings
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + (b.actualPrice || b.estimatedPrice), 0);

      setStats({
        totalBookings: mockBookings.length,
        completedBookings: completed,
        pendingBookings: pending,
        totalEarnings,
        averageRating: 4.8,
        acceptanceRate: 95,
      });
    } catch (error) {
      console.error("Error loading carrier data:", error);
      Alert.alert("Error", "Failed to load carrier data");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCarrierData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "accepted":
        return "#3B82F6";
      case "in-progress":
        return "#8B5CF6";
      case "completed":
        return "#22C55E";
      case "cancelled":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "schedule";
      case "accepted":
        return "check-circle";
      case "in-progress":
        return "directions";
      case "completed":
        return "done-all";
      case "cancelled":
        return "cancel";
      default:
        return "help";
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    if (selectedFilter === "all") return true;
    return booking.status === selectedFilter;
  });

  const renderBookingCard = ({ item }: { item: CarrierBooking }) => (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/(tabs)/booking-detail",
          params: { bookingId: item.id },
        } as any);
      }}
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-muted mb-1">{item.bookingId}</Text>
          <Text className="text-base font-bold text-foreground">{item.customerName}</Text>
        </View>
        <View
          className="rounded-full px-3 py-1 flex-row items-center"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <MaterialIcons name={getStatusIcon(item.status) as any} size={14} color={getStatusColor(item.status)} />
          <Text
            className="text-xs font-semibold ml-1 capitalize"
            style={{ color: getStatusColor(item.status) }}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <View className="mb-3 gap-2">
        <View className="flex-row items-center">
          <MaterialIcons name="location-on" size={16} color="#9BA1A6" />
          <Text className="text-sm text-muted ml-2 flex-1">{item.pickupLocation}</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons name="location-on" size={16} color="#9BA1A6" />
          <Text className="text-sm text-muted ml-2 flex-1">{item.dropoffLocation}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mb-3 pt-3 border-t border-border">
        <View>
          <Text className="text-xs text-muted mb-1">Vehicle</Text>
          <Text className="text-sm font-semibold text-foreground">{item.vehicleType}</Text>
        </View>
        <View>
          <Text className="text-xs text-muted mb-1">Cargo</Text>
          <Text className="text-sm font-semibold text-foreground">{item.cargoWeight}</Text>
        </View>
        <View>
          <Text className="text-xs text-muted mb-1">Price</Text>
          <Text className="text-sm font-bold text-primary">K{item.estimatedPrice}</Text>
        </View>
      </View>

      {item.status === "in-progress" && (
        <TouchableOpacity className="bg-primary rounded-lg py-2 items-center">
          <Text className="text-white font-semibold text-sm">Track Delivery</Text>
        </TouchableOpacity>
      )}

      {item.status === "completed" && item.rating && (
        <View className="flex-row items-center pt-3 border-t border-border">
          <View className="flex-row">
            {[...Array(5)].map((_, i) => (
              <MaterialIcons
                key={i}
                name={i < item.rating! ? "star" : "star-outline"}
                size={14}
                color="#F59E0B"
              />
            ))}
          </View>
          <Text className="text-xs text-muted ml-2">Customer Rating</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-base text-muted">Welcome back</Text>
            <Text className="text-2xl font-bold text-foreground">
              {user.fullName?.split(" ")[0] || "Carrier"}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/carrier-profile" as any)}
              className="w-12 h-12 rounded-full bg-primary items-center justify-center"
            >
              <MaterialIcons name="person" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Logout", "Are you sure you want to logout?", [
                  { text: "Cancel", onPress: () => {}, style: "cancel" },
                  {
                    text: "Logout",
                    onPress: async () => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      await logout();
                      router.push("/(auth)/login" as any);
                    },
                    style: "destructive",
                  },
                ]);
              }}
              className="w-12 h-12 rounded-full bg-error/20 items-center justify-center"
            >
              <MaterialIcons name="logout" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Overview */}
        <View className="px-6 mb-6">
          <View className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-6 mb-4">
            <View className="flex-row justify-between mb-4">
              <View>
                <Text className="text-white/80 text-sm mb-1">Total Earnings</Text>
                <Text className="text-3xl font-bold text-white">K{stats.totalEarnings}</Text>
              </View>
              <MaterialIcons name="trending-up" size={32} color="#fff" />
            </View>
            <View className="flex-row justify-between">
              <View>
                <Text className="text-white/80 text-xs">Completed</Text>
                <Text className="text-white font-semibold">{stats.completedBookings}</Text>
              </View>
              <View>
                <Text className="text-white/80 text-xs">Rating</Text>
                <View className="flex-row items-center">
                  <MaterialIcons name="star" size={14} color="#FCD34D" />
                  <Text className="text-white font-semibold ml-1">{stats.averageRating}</Text>
                </View>
              </View>
              <View>
                <Text className="text-white/80 text-xs">Acceptance</Text>
                <Text className="text-white font-semibold">{stats.acceptanceRate}%</Text>
              </View>
            </View>
          </View>

          {/* Quick Stats */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-xs text-muted mb-2">Total Bookings</Text>
              <Text className="text-2xl font-bold text-foreground">{stats.totalBookings}</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-xs text-muted mb-2">Pending</Text>
              <Text className="text-2xl font-bold text-warning">{stats.pendingBookings}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="px-6 mb-6 flex-row gap-3">
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/(tabs)/available-bookings" as any);
            }}
            className="flex-1 bg-primary rounded-xl py-3 items-center flex-row justify-center"
          >
            <MaterialIcons name="add-circle" size={20} color="#fff" />
            <Text className="text-white font-semibold ml-2">Available Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/(tabs)/earnings" as any);
            }}
            className="flex-1 bg-surface border border-border rounded-xl py-3 items-center flex-row justify-center"
          >
            <MaterialIcons name="attach-money" size={20} color="#0a7ea4" />
            <Text className="text-primary font-semibold ml-2">Earnings</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View className="px-6 mb-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Your Bookings</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {(["all", "pending", "accepted", "completed"] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                onPress={() => {
                  setSelectedFilter(filter);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`px-4 py-2 rounded-full ${
                  selectedFilter === filter
                    ? "bg-primary"
                    : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`font-semibold text-sm capitalize ${
                    selectedFilter === filter ? "text-white" : "text-foreground"
                  }`}
                >
                  {filter === "all" ? "All" : filter}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Bookings List */}
        <View className="px-6">
          {filteredBookings.length > 0 ? (
            <FlatList
              data={filteredBookings}
              renderItem={renderBookingCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View className="items-center justify-center py-12">
              <MaterialIcons name="inbox" size={48} color="#9BA1A6" />
              <Text className="text-muted text-base mt-4">No {selectedFilter} bookings</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelectedFilter("all");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className="mt-4"
              >
                <Text className="text-primary font-semibold">View all bookings</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <CarrierBottomNav currentTab="home" />
    </ScreenContainer>
  );
}
