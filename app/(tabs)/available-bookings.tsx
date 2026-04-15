import { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

interface AvailableBooking {
  id: string;
  bookingId: string;
  customerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  vehicleRequired: string;
  cargoType: string;
  cargoWeight: string;
  estimatedPrice: number;
  distance: number;
  scheduledTime: string;
  urgency: "low" | "medium" | "high";
  postedTime: string;
  acceptances: number;
}

export default function AvailableBookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<AvailableBooking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<AvailableBooking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "low" | "medium" | "high">("all");

  useEffect(() => {
    loadAvailableBookings();
  }, []);

  useEffect(() => {
    filterBookings();
  }, [selectedFilter, bookings]);

  const loadAvailableBookings = async () => {
    try {
      // Mock data - replace with actual API call
      const mockBookings: AvailableBooking[] = [
        {
          id: "1",
          bookingId: "BK-AVL-001",
          customerName: "John Doe",
          pickupLocation: "Lusaka City Center",
          dropoffLocation: "Ndola, Copperbelt",
          vehicleRequired: "Pickup Truck",
          cargoType: "General Cargo",
          cargoWeight: "500kg",
          estimatedPrice: 450,
          distance: 85,
          scheduledTime: "2026-01-23 14:00",
          urgency: "high",
          postedTime: "5 minutes ago",
          acceptances: 2,
        },
        {
          id: "2",
          bookingId: "BK-AVL-002",
          customerName: "ABC Manufacturing",
          pickupLocation: "Lusaka Industrial Area",
          dropoffLocation: "Copperbelt",
          vehicleRequired: "Heavy Truck",
          cargoType: "Industrial Equipment",
          cargoWeight: "5000kg",
          estimatedPrice: 1200,
          distance: 120,
          scheduledTime: "2026-01-24 08:00",
          urgency: "medium",
          postedTime: "15 minutes ago",
          acceptances: 1,
        },
        {
          id: "3",
          bookingId: "BK-AVL-003",
          customerName: "Jane Smith",
          pickupLocation: "Kitwe",
          dropoffLocation: "Livingstone",
          vehicleRequired: "Motorbike",
          cargoType: "Documents",
          cargoWeight: "5kg",
          estimatedPrice: 150,
          distance: 45,
          scheduledTime: "2026-01-23 10:00",
          urgency: "low",
          postedTime: "30 minutes ago",
          acceptances: 5,
        },
        {
          id: "4",
          bookingId: "BK-AVL-004",
          customerName: "Tech Solutions Ltd",
          pickupLocation: "Lusaka",
          dropoffLocation: "Livingstone",
          vehicleRequired: "Van",
          cargoType: "Electronics",
          cargoWeight: "200kg",
          estimatedPrice: 600,
          distance: 110,
          scheduledTime: "2026-01-23 16:00",
          urgency: "high",
          postedTime: "10 minutes ago",
          acceptances: 0,
        },
      ];

      setBookings(mockBookings);
    } catch (error) {
      console.error("Error loading available bookings:", error);
      Alert.alert("Error", "Failed to load available bookings");
    }
  };

  const filterBookings = () => {
    if (selectedFilter === "all") {
      setFilteredBookings(bookings);
    } else {
      setFilteredBookings(bookings.filter((b) => b.urgency === selectedFilter));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAvailableBookings();
    setRefreshing(false);
  };

  const handleAcceptBooking = (booking: AvailableBooking) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Accept Booking",
      `Accept booking ${booking.bookingId} for K${booking.estimatedPrice}?`,
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Accept",
          onPress: () => {
            Alert.alert("Success", "Booking accepted! You can now start the pickup.");
            onRefresh();
          },
        },
      ]
    );
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      case "low":
        return "#22C55E";
      default:
        return "#6B7280";
    }
  };

  const getUrgencyIcon = (urgency: string) => {
    switch (urgency) {
      case "high":
        return "priority-high";
      case "medium":
        return "schedule";
      case "low":
        return "check-circle";
      default:
        return "help";
    }
  };

  const renderBookingCard = ({ item }: { item: AvailableBooking }) => (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/(tabs)/booking-detail",
          params: { bookingId: item.id, isAvailable: true },
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
          style={{ backgroundColor: `${getUrgencyColor(item.urgency)}20` }}
        >
          <MaterialIcons
            name={getUrgencyIcon(item.urgency) as any}
            size={14}
            color={getUrgencyColor(item.urgency)}
          />
          <Text
            className="text-xs font-semibold ml-1 capitalize"
            style={{ color: getUrgencyColor(item.urgency) }}
          >
            {item.urgency}
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
          <Text className="text-sm font-semibold text-foreground">{item.vehicleRequired}</Text>
        </View>
        <View>
          <Text className="text-xs text-muted mb-1">Distance</Text>
          <Text className="text-sm font-semibold text-foreground">{item.distance} km</Text>
        </View>
        <View>
          <Text className="text-xs text-muted mb-1">Price</Text>
          <Text className="text-sm font-bold text-primary">K{item.estimatedPrice}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mb-3 pb-3 border-b border-border">
        <View className="flex-row items-center">
          <MaterialIcons name="access-time" size={14} color="#9BA1A6" />
          <Text className="text-xs text-muted ml-1">{item.postedTime}</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons name="person" size={14} color="#9BA1A6" />
          <Text className="text-xs text-muted ml-1">{item.acceptances} accepted</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={() => handleAcceptBooking(item)}
        className="bg-primary rounded-lg py-2 items-center"
      >
        <Text className="text-white font-semibold text-sm">Accept Booking</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Available Bookings</Text>
            <Text className="text-sm text-muted mt-1">{filteredBookings.length} bookings</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
          >
            <MaterialIcons name="close" size={20} color="#11181C" />
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View className="px-6 mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {(["all", "high", "medium", "low"] as const).map((filter) => (
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
              <Text className="text-muted text-base mt-4">No {selectedFilter} urgency bookings</Text>
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
    </ScreenContainer>
  );
}
