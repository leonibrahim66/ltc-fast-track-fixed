import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

interface BookingRequest {
  id: number;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  dropoffLocation: string;
  cargoType?: string;
  cargoWeight?: string;
  estimatedPrice?: number;
  vehicleRequired?: string;
  status: "pending" | "accepted" | "in-progress" | "completed" | "rejected" | "cancelled";
  scheduledTime?: string;
  notes?: string;
}

export default function DriverDashboardScreen() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [acceptedBookings, setAcceptedBookings] = useState<BookingRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"available" | "active">("available");
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);

  // tRPC queries
  const availableBookingsQuery = trpc.bookings.getAvailable.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const driverBookingsQuery = trpc.bookings.getByDriver.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // tRPC mutations
  const acceptMutation = trpc.bookings.accept.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Booking accepted! You can now start the pickup.");
      onRefresh();
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to accept booking");
    },
  });

  const rejectMutation = trpc.bookings.reject.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Booking rejected");
      onRefresh();
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to reject booking");
    },
  });

  const updateStatusMutation = trpc.bookings.updateStatus.useMutation({
    onSuccess: (data: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", data.message);
      onRefresh();
      setSelectedBooking(null);
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", error.message || "Failed to update booking status");
    },
  });

  useEffect(() => {
    if (availableBookingsQuery.data) {
      setBookings(availableBookingsQuery.data as any);
    }
  }, [availableBookingsQuery.data]);

  useEffect(() => {
    if (driverBookingsQuery.data) {
      setAcceptedBookings(driverBookingsQuery.data as any);
    }
  }, [driverBookingsQuery.data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        availableBookingsQuery.refetch(),
        driverBookingsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [availableBookingsQuery, driverBookingsQuery]);

  const handleAcceptBooking = (booking: BookingRequest) => {
    Alert.alert(
      "Accept Booking",
      `Accept booking from ${booking.customerName}?\n\nPickup: ${booking.pickupLocation}\nDropoff: ${booking.dropoffLocation}`,
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Accept",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            acceptMutation.mutate({ bookingId: booking.id });
          },
        },
      ]
    );
  };

  const handleRejectBooking = (booking: BookingRequest) => {
    Alert.alert(
      "Reject Booking",
      `Are you sure you want to reject this booking?`,
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Reject",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            rejectMutation.mutate({ bookingId: booking.id });
          },
          style: "destructive",
        },
      ]
    );
  };

  const handleUpdateStatus = (booking: BookingRequest, newStatus: "in-progress" | "completed") => {
    const statusText = newStatus === "in-progress" ? "In Progress" : "Completed";
    Alert.alert(
      "Update Status",
      `Mark booking as ${statusText}?`,
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Confirm",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            updateStatusMutation.mutate({
              bookingId: booking.id,
              status: newStatus,
            });
          },
        },
      ]
    );
  };

  // Check if user is authenticated
  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <MaterialIcons name="lock" size={48} color="#9BA1A6" />
        <Text className="text-foreground text-lg font-semibold mt-4">
          Please log in to access Driver Dashboard
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/login")}
          className="bg-primary rounded-lg px-6 py-3 mt-6"
        >
          <Text className="text-white font-semibold">Go to Login</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // Check if user has driver role
  const userRole = (user as any)?.role as string;
  if (userRole !== "driver" && userRole !== "admin") {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <MaterialIcons name="block" size={48} color="#EF4444" />
        <Text className="text-foreground text-lg font-semibold mt-4">
          Access Denied
        </Text>
        <Text className="text-muted text-center mt-2">
          Only drivers can access this dashboard
        </Text>
      </ScreenContainer>
    );
  }

  const currentBookings = selectedTab === "available" ? bookings : acceptedBookings;
  const isLoading =
    selectedTab === "available"
      ? availableBookingsQuery.isLoading
      : driverBookingsQuery.isLoading;

  const renderBookingCard = ({ item }: { item: BookingRequest }) => (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedBooking(item);
      }}
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-muted mb-1">
            Booking #{item.id}
          </Text>
          <Text className="text-base font-bold text-foreground">{item.customerName}</Text>
        </View>
        <View
          className="rounded-full px-3 py-1"
          style={{
            backgroundColor:
              item.status === "pending"
                ? "#F59E0B20"
                : item.status === "accepted"
                  ? "#3B82F620"
                  : item.status === "in-progress"
                    ? "#8B5CF620"
                    : item.status === "completed"
                      ? "#22C55E20"
                      : "#EF444420",
          }}
        >
          <Text
            className="text-xs font-semibold capitalize"
            style={{
              color:
                item.status === "pending"
                  ? "#F59E0B"
                  : item.status === "accepted"
                    ? "#3B82F6"
                    : item.status === "in-progress"
                      ? "#8B5CF6"
                      : item.status === "completed"
                        ? "#22C55E"
                        : "#EF4444",
            }}
          >
            {item.status.replace("-", " ")}
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

      <View className="flex-row items-center justify-between pt-3 border-t border-border">
        <View>
          <Text className="text-xs text-muted mb-1">Phone</Text>
          <Text className="text-sm font-semibold text-foreground">{item.customerPhone}</Text>
        </View>
        {item.estimatedPrice && (
          <View>
            <Text className="text-xs text-muted mb-1">Price</Text>
            <Text className="text-sm font-bold text-primary">K{item.estimatedPrice}</Text>
          </View>
        )}
        {item.vehicleRequired && (
          <View>
            <Text className="text-xs text-muted mb-1">Vehicle</Text>
            <Text className="text-sm font-semibold text-foreground">{item.vehicleRequired}</Text>
          </View>
        )}
      </View>

      {selectedTab === "available" && item.status === "pending" && (
        <View className="flex-row gap-2 mt-3">
          <TouchableOpacity
            onPress={() => handleAcceptBooking(item)}
            className="flex-1 bg-primary rounded-lg py-2 items-center"
          >
            <Text className="text-white font-semibold text-sm">Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleRejectBooking(item)}
            className="flex-1 bg-surface border border-error rounded-lg py-2 items-center"
          >
            <Text className="text-error font-semibold text-sm">Reject</Text>
          </TouchableOpacity>
        </View>
      )}
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
        <View className="px-6 pt-4 pb-6">
          <Text className="text-2xl font-bold text-foreground">Driver Dashboard</Text>
          <Text className="text-sm text-muted mt-1">Manage your bookings</Text>
        </View>

        {/* Tab Selector */}
        <View className="px-6 mb-6 flex-row gap-3">
          <TouchableOpacity
            onPress={() => {
              setSelectedTab("available");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-1 py-3 rounded-lg items-center border ${
              selectedTab === "available"
                ? "bg-primary border-primary"
                : "bg-surface border-border"
            }`}
          >
            <Text
              className={`font-semibold ${
                selectedTab === "available" ? "text-white" : "text-foreground"
              }`}
            >
              Available ({bookings.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSelectedTab("active");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className={`flex-1 py-3 rounded-lg items-center border ${
              selectedTab === "active"
                ? "bg-primary border-primary"
                : "bg-surface border-border"
            }`}
          >
            <Text
              className={`font-semibold ${
                selectedTab === "active" ? "text-white" : "text-foreground"
              }`}
            >
              Active ({acceptedBookings.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bookings List */}
        <View className="px-6">
          {isLoading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#0a7ea4" />
            </View>
          ) : currentBookings.length > 0 ? (
            <FlatList
              data={currentBookings}
              renderItem={renderBookingCard}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
            />
          ) : (
            <View className="items-center justify-center py-12">
              <MaterialIcons name="inbox" size={48} color="#9BA1A6" />
              <Text className="text-muted text-base mt-4">
                {selectedTab === "available"
                  ? "No available bookings"
                  : "No active bookings"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <View className="absolute inset-0 bg-black/50 items-end">
          <TouchableOpacity
            className="absolute inset-0"
            onPress={() => setSelectedBooking(null)}
          />
          <View className="bg-background w-full rounded-t-3xl p-6 max-h-4/5">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-foreground">
                Booking #{selectedBooking.id}
              </Text>
              <TouchableOpacity onPress={() => setSelectedBooking(null)}>
                <MaterialIcons name="close" size={24} color="#11181C" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Customer Details */}
              <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                <Text className="text-sm font-semibold text-foreground mb-3">
                  Customer Details
                </Text>
                <View className="gap-3">
                  <View>
                    <Text className="text-xs text-muted mb-1">Name</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {selectedBooking.customerName}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-muted mb-1">Phone</Text>
                    <TouchableOpacity>
                      <Text className="text-sm font-semibold text-primary">
                        {selectedBooking.customerPhone}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Locations */}
              <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                <Text className="text-sm font-semibold text-foreground mb-3">Locations</Text>
                <View className="gap-3">
                  <View>
                    <Text className="text-xs text-muted mb-1">Pickup Location</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {selectedBooking.pickupLocation}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-muted mb-1">Dropoff Location</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {selectedBooking.dropoffLocation}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Cargo Details */}
              {(selectedBooking.cargoType || selectedBooking.cargoWeight) && (
                <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                  <Text className="text-sm font-semibold text-foreground mb-3">Cargo</Text>
                  <View className="gap-3">
                    {selectedBooking.cargoType && (
                      <View>
                        <Text className="text-xs text-muted mb-1">Type</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {selectedBooking.cargoType}
                        </Text>
                      </View>
                    )}
                    {selectedBooking.cargoWeight && (
                      <View>
                        <Text className="text-xs text-muted mb-1">Weight</Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {selectedBooking.cargoWeight}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Booking Info */}
              <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                <Text className="text-sm font-semibold text-foreground mb-3">Booking Info</Text>
                <View className="gap-3">
                  {selectedBooking.estimatedPrice && (
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted">Estimated Price</Text>
                      <Text className="text-sm font-bold text-primary">
                        K{selectedBooking.estimatedPrice}
                      </Text>
                    </View>
                  )}
                  {selectedBooking.vehicleRequired && (
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-muted">Vehicle Required</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {selectedBooking.vehicleRequired}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted">Status</Text>
                    <Text className="text-sm font-semibold text-foreground capitalize">
                      {selectedBooking.status.replace("-", " ")}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              {selectedBooking.status === "pending" && (
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      handleAcceptBooking(selectedBooking);
                      setSelectedBooking(null);
                    }}
                    className="flex-1 bg-primary rounded-xl py-3 items-center"
                  >
                    <Text className="text-white font-semibold">Accept Booking</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      handleRejectBooking(selectedBooking);
                      setSelectedBooking(null);
                    }}
                    className="flex-1 bg-surface border border-error rounded-xl py-3 items-center"
                  >
                    <Text className="text-error font-semibold">Reject</Text>
                  </TouchableOpacity>
                </View>
              )}

              {selectedBooking.status === "accepted" && (
                <TouchableOpacity
                  onPress={() => {
                    handleUpdateStatus(selectedBooking, "in-progress");
                    setSelectedBooking(null);
                  }}
                  className="bg-primary rounded-xl py-3 items-center mb-2"
                >
                  <Text className="text-white font-semibold">Start Pickup</Text>
                </TouchableOpacity>
              )}

              {selectedBooking.status === "in-progress" && (
                <TouchableOpacity
                  onPress={() => {
                    handleUpdateStatus(selectedBooking, "completed");
                    setSelectedBooking(null);
                  }}
                  className="bg-success rounded-xl py-3 items-center mb-2"
                >
                  <Text className="text-white font-semibold">Mark as Completed</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => setSelectedBooking(null)}
                className="bg-surface border border-border rounded-xl py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
