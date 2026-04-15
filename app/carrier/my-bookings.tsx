import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { CustomerBooking, PaymentRecord } from "@/types/booking";
import { useBookingNotifications } from "@/lib/booking-notification-context";
import { EditBookingModal } from "./my-bookings-edit-modal";

type TabType = "pending" | "accepted" | "rejected" | "completed";

const TABS: { key: TabType; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "completed", label: "Completed" },
];

const STATUS_CONFIG: Record<
  string,
  { label: string; bgColor: string; textColor: string; icon: string }
> = {
  pending: {
    label: "Pending",
    bgColor: "#FEF3C7",
    textColor: "#92400E",
    icon: "hourglass-empty",
  },
  accepted: {
    label: "Accepted",
    bgColor: "#DBEAFE",
    textColor: "#1E40AF",
    icon: "check-circle",
  },
  rejected: {
    label: "Rejected",
    bgColor: "#FEE2E2",
    textColor: "#991B1B",
    icon: "cancel",
  },
  completed: {
    label: "Completed",
    bgColor: "#D1FAE5",
    textColor: "#065F46",
    icon: "done-all",
  },
  cancelled: {
    label: "Cancelled",
    bgColor: "#F3F4F6",
    textColor: "#4B5563",
    icon: "block",
  },
};

const PAYMENT_STATUS_CONFIG: Record<
  string,
  { label: string; bgColor: string; textColor: string }
> = {
  paid: { label: "Paid", bgColor: "#D1FAE5", textColor: "#065F46" },
  pending: { label: "Pending", bgColor: "#FEF3C7", textColor: "#92400E" },
  failed: { label: "Failed", bgColor: "#FEE2E2", textColor: "#991B1B" },
};

export default function MyBookingsScreen() {
  const router = useRouter();
  const { notifications, unreadCount, markAllAsRead } = useBookingNotifications();
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [selectedBooking, setSelectedBooking] = useState<CustomerBooking | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editingBooking, setEditingBooking] = useState<CustomerBooking | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    pickupLocation: "",
    dropoffLocation: "",
    cargoType: "",
    cargoWeight: "",
    vehicleRequired: "",
  });

  const loadBookings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("customer_bookings");
      if (stored) {
        const parsed: CustomerBooking[] = JSON.parse(stored);
        parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setBookings(parsed);
      } else {
        // Sample data for demo
        const sampleBookings: CustomerBooking[] = [
          {
            id: "1",
            bookingId: "BK-2026-001",
            customerId: "cust-001",
            customerName: "John Doe",
            customerPhone: "+260971234567",
            pickupLocation: "Cairo Road, Lusaka",
            dropoffLocation: "Makeni Mall, Lusaka",
            distance: "8.5 km",
            cargoType: "Household Items",
            cargoWeight: "200 kg",
            vehicleRequired: "Truck",
            estimatedPrice: 350,
            totalAmount: 350,
            status: "pending",
            paymentStatus: "pending",
            createdAt: new Date().toISOString(),
          },
          {
            id: "2",
            bookingId: "BK-2026-002",
            customerId: "cust-001",
            customerName: "John Doe",
            customerPhone: "+260971234567",
            pickupLocation: "Manda Hill, Lusaka",
            dropoffLocation: "Woodlands, Lusaka",
            distance: "5.2 km",
            cargoType: "Luggage",
            cargoWeight: "50 kg",
            vehicleRequired: "Van",
            estimatedPrice: 180,
            totalAmount: 180,
            status: "accepted",
            paymentStatus: "paid",
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            acceptedAt: new Date(Date.now() - 82800000).toISOString(),
            driverName: "Peter Mwansa",
            driverPhone: "+260977654321",
            vehicleType: "Toyota Hiace Van",
            vehicleColor: "White",
            vehiclePlate: "BAM 1234",
            payments: [
              {
                id: "pay-001",
                amount: 180,
                method: "MTN Mobile Money",
                transactionId: "MTN123456789",
                status: "paid",
                paidAt: new Date(Date.now() - 82800000).toISOString(),
                createdAt: new Date(Date.now() - 86400000).toISOString(),
              },
            ],
          },
          {
            id: "3",
            bookingId: "BK-2026-003",
            customerId: "cust-001",
            customerName: "John Doe",
            customerPhone: "+260971234567",
            pickupLocation: "East Park Mall, Lusaka",
            dropoffLocation: "Kabulonga, Lusaka",
            distance: "3.1 km",
            cargoType: "General Cargo",
            cargoWeight: "30 kg",
            vehicleRequired: "Car",
            estimatedPrice: 120,
            totalAmount: 120,
            status: "completed",
            paymentStatus: "paid",
            createdAt: new Date(Date.now() - 172800000).toISOString(),
            acceptedAt: new Date(Date.now() - 169200000).toISOString(),
            completedAt: new Date(Date.now() - 165600000).toISOString(),
            driverName: "James Banda",
            driverPhone: "+260966123456",
            vehicleType: "Honda Fit",
            vehicleColor: "Blue",
            vehiclePlate: "BAM 5678",
            payments: [
              {
                id: "pay-002",
                amount: 120,
                method: "Airtel Money",
                transactionId: "AIR987654321",
                status: "paid",
                paidAt: new Date(Date.now() - 169200000).toISOString(),
                createdAt: new Date(Date.now() - 172800000).toISOString(),
              },
            ],
          },
        ];
        await AsyncStorage.setItem("customer_bookings", JSON.stringify(sampleBookings));
        setBookings(sampleBookings);
      }
    } catch (error) {
      console.error("Error loading bookings:", error);
    }
  }, []);

  useEffect(() => {
    loadBookings();
    const interval = setInterval(loadBookings, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  const getFilteredBookings = (): CustomerBooking[] => {
    return bookings.filter((b) => b.status === activeTab);
  };

  const handleTabPress = (tab: TabType) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveTab(tab);
  };

  const handleViewDetails = (booking: CustomerBooking) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedBooking(booking);
  };

  const handleNotificationPress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowNotifications(true);
    markAllAsRead();
  };

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<CustomerBooking | null>(null);

  const handleCancelBooking = (booking: CustomerBooking) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setBookingToCancel(booking);
    setShowCancelDialog(true);
  };

  const { addNotification } = useBookingNotifications();

  const confirmCancelBooking = async () => {
    if (!bookingToCancel) return;

    try {
      // Update booking status to cancelled
      const updatedBookings = bookings.map((b) =>
        b.id === bookingToCancel.id ? { ...b, status: "cancelled" as const } : b
      );
      setBookings(updatedBookings);
      await AsyncStorage.setItem("customer_bookings", JSON.stringify(updatedBookings));

      // Send cancellation notification
      addNotification({
        bookingId: bookingToCancel.bookingId,
        type: "cancelled",
        title: "Booking Cancelled",
        message: `Your booking ${bookingToCancel.bookingId} has been cancelled successfully.`,
        read: false,
      });

      setShowCancelDialog(false);
      setBookingToCancel(null);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Failed to cancel booking:", error);
    }
  };

  const handleRebook = (booking: CustomerBooking) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Navigate to Book a Carrier with pre-filled data
    router.push({
      pathname: "/carrier/book",
      params: {
        pickupLocation: booking.pickupLocation,
        dropoffLocation: booking.dropoffLocation,
        cargoType: booking.cargoType,
        cargoWeight: booking.cargoWeight,
        vehicleType: booking.vehicleRequired,
      },
    });
  };

  const handleEditBooking = (booking: CustomerBooking) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditingBooking(booking);
    setShowEditModal(true);
  };

  const handleSaveBooking = async (updatedBooking: CustomerBooking) => {
    try {
      const updatedBookings = bookings.map((b) =>
        b.id === updatedBooking.id ? updatedBooking : b
      );
      setBookings(updatedBookings);
      await AsyncStorage.setItem("customer_bookings", JSON.stringify(updatedBookings));
      setEditingBooking(null);
    } catch (error) {
      console.error("Failed to save booking:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-ZM", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateTime = (dateStr: string) => {
    return `${formatDate(dateStr)} at ${formatTime(dateStr)}`;
  };

  const renderBookingCard = ({ item }: { item: CustomerBooking }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const paymentConfig = PAYMENT_STATUS_CONFIG[item.paymentStatus] || PAYMENT_STATUS_CONFIG.pending;

    return (
      <View
        style={{ marginHorizontal: 16, marginBottom: 12 }}
        className="bg-surface rounded-2xl border border-border overflow-hidden"
      >
        {/* Header with Booking ID and Status */}
        <View className="p-4 pb-3 border-b border-border">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-base font-bold text-foreground">{item.bookingId}</Text>
            <View
              style={{
                backgroundColor: statusConfig.bgColor,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}
              className="flex-row items-center"
            >
              <MaterialIcons name={statusConfig.icon as any} size={14} color={statusConfig.textColor} />
              <Text style={{ color: statusConfig.textColor }} className="text-xs font-semibold ml-1">
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="calendar-today" size={12} color="#9BA1A6" />
            <Text className="text-xs text-muted ml-1">{formatDate(item.createdAt)}</Text>
            <Text className="text-xs text-muted mx-2">·</Text>
            <MaterialIcons name="schedule" size={12} color="#9BA1A6" />
            <Text className="text-xs text-muted ml-1">{formatTime(item.createdAt)}</Text>
          </View>
        </View>

        {/* Locations */}
        <View className="p-4 pb-3">
          <View className="flex-row items-start mb-2">
            <View className="w-5 items-center mt-1">
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: "#22C55E",
                }}
              />
            </View>
            <View className="ml-2 flex-1">
              <Text className="text-xs text-muted">Pickup</Text>
              <Text className="text-sm text-foreground" numberOfLines={1}>
                {item.pickupLocation}
              </Text>
            </View>
          </View>

          {/* Dotted line */}
          <View className="w-5 items-center" style={{ height: 12 }}>
            <View
              style={{
                width: 1,
                height: 12,
                borderStyle: "dashed",
                borderWidth: 1,
                borderColor: "#4B5563",
              }}
            />
          </View>

          <View className="flex-row items-start">
            <View className="w-5 items-center mt-1">
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: "#EF4444",
                }}
              />
            </View>
            <View className="ml-2 flex-1">
              <Text className="text-xs text-muted">Drop-off</Text>
              <Text className="text-sm text-foreground" numberOfLines={1}>
                {item.dropoffLocation}
              </Text>
            </View>
          </View>
        </View>

        {/* Amount and Payment Status */}
        <View className="px-4 pb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-muted mb-1">Total Amount</Text>
            <Text className="text-xl font-bold text-foreground">K{item.totalAmount.toFixed(2)}</Text>
          </View>
          <View
            style={{
              backgroundColor: paymentConfig.bgColor,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: paymentConfig.textColor }} className="text-xs font-semibold">
              {paymentConfig.label}
            </Text>
          </View>
        </View>

        {/* View Details Button */}
        <View className="p-4 pt-0">
          <TouchableOpacity
            onPress={() => handleViewDetails(item)}
            style={{ backgroundColor: "#0a7ea4" }}
            className="py-3 rounded-xl flex-row items-center justify-center"
          >
            <MaterialIcons name="visibility" size={16} color="#fff" />
            <Text className="text-white text-sm font-semibold ml-2">View Details</Text>
          </TouchableOpacity>

          {/* Edit, Cancel & Rebook Buttons (Pending Only) */}
          {item.status === "pending" && (
            <>
              <TouchableOpacity
                onPress={() => handleEditBooking(item)}
                style={{ backgroundColor: "#DBEAFE" }}
                className="py-3 rounded-xl flex-row items-center justify-center mt-2"
              >
                <MaterialIcons name="edit" size={16} color="#1E40AF" />
                <Text style={{ color: "#1E40AF" }} className="text-sm font-semibold ml-2">
                  Edit Booking
                </Text>
              </TouchableOpacity>
              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  onPress={() => handleCancelBooking(item)}
                  style={{ backgroundColor: "#FEE2E2", flex: 1 }}
                  className="py-3 rounded-xl flex-row items-center justify-center"
                >
                  <MaterialIcons name="cancel" size={16} color="#991B1B" />
                  <Text style={{ color: "#991B1B" }} className="text-sm font-semibold ml-2">
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRebook(item)}
                  style={{ backgroundColor: "#DBEAFE", flex: 1 }}
                  className="py-3 rounded-xl flex-row items-center justify-center"
                >
                  <MaterialIcons name="refresh" size={16} color="#1E40AF" />
                  <Text style={{ color: "#1E40AF" }} className="text-sm font-semibold ml-2">
                    Rebook
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center p-8" style={{ minHeight: 300 }}>
      <MaterialIcons name="inbox" size={64} color="#9BA1A6" />
      <Text className="text-lg font-semibold text-foreground mt-4">No Bookings</Text>
      <Text className="text-sm text-muted text-center mt-2">
        You don't have any {activeTab} bookings yet.
      </Text>
    </View>
  );

  const filteredBookings = getFilteredBookings();

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">My Bookings</Text>
          <Text className="text-sm text-muted">View your booking history</Text>
        </View>
        <TouchableOpacity
          onPress={handleNotificationPress}
          className="w-12 h-12 rounded-full bg-surface border border-border items-center justify-center"
        >
          <MaterialIcons name="notifications" size={24} color="#0a7ea4" />
          {unreadCount > 0 && (
            <View
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                backgroundColor: "#EF4444",
                borderRadius: 10,
                minWidth: 18,
                height: 18,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 4,
              }}
            >
              <Text className="text-white text-xs font-bold">{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View className="px-4 py-3 border-b border-border">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = bookings.filter((b) => b.status === tab.key).length;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => handleTabPress(tab.key)}
                  style={{
                    backgroundColor: isActive ? "#0a7ea4" : "transparent",
                    borderWidth: isActive ? 0 : 1,
                    borderColor: "#E5E7EB",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                  }}
                  className="flex-row items-center"
                >
                  <Text
                    style={{ color: isActive ? "#fff" : "#687076" }}
                    className="text-sm font-semibold"
                  >
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View
                      style={{
                        backgroundColor: isActive ? "rgba(255,255,255,0.3)" : "#E5E7EB",
                        marginLeft: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 10,
                        minWidth: 20,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{ color: isActive ? "#fff" : "#687076" }}
                        className="text-xs font-bold"
                      >
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Bookings List */}
      <FlatList
        data={filteredBookings}
        renderItem={renderBookingCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={renderEmptyState}
      />

      {/* Booking Details Modal */}
      {selectedBooking && (
        <Modal
          visible={!!selectedBooking}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedBooking(null)}
        >
          <ScreenContainer className="bg-background">
            {/* Modal Header */}
            <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">Booking Details</Text>
              <TouchableOpacity
                onPress={() => setSelectedBooking(null)}
                className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
              >
                <MaterialIcons name="close" size={20} color="#687076" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4">
              {/* Booking ID & Status */}
              <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                <Text className="text-xs text-muted mb-1">Booking ID</Text>
                <Text className="text-2xl font-bold text-foreground mb-3">
                  {selectedBooking.bookingId}
                </Text>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs text-muted mb-1">Status</Text>
                    <View
                      style={{
                        backgroundColor: STATUS_CONFIG[selectedBooking.status].bgColor,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        alignSelf: "flex-start",
                      }}
                    >
                      <Text
                        style={{ color: STATUS_CONFIG[selectedBooking.status].textColor }}
                        className="text-sm font-semibold"
                      >
                        {STATUS_CONFIG[selectedBooking.status].label}
                      </Text>
                    </View>
                  </View>
                  <View>
                    <Text className="text-xs text-muted mb-1">Payment Status</Text>
                    <View
                      style={{
                        backgroundColor:
                          PAYMENT_STATUS_CONFIG[selectedBooking.paymentStatus].bgColor,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 12,
                        alignSelf: "flex-start",
                      }}
                    >
                      <Text
                        style={{
                          color: PAYMENT_STATUS_CONFIG[selectedBooking.paymentStatus].textColor,
                        }}
                        className="text-sm font-semibold"
                      >
                        {PAYMENT_STATUS_CONFIG[selectedBooking.paymentStatus].label}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Locations */}
              <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                <Text className="text-sm font-bold text-foreground mb-3">Locations</Text>
                <View className="mb-3">
                  <Text className="text-xs text-muted mb-1">Pickup Location</Text>
                  <Text className="text-sm text-foreground">{selectedBooking.pickupLocation}</Text>
                </View>
                <View>
                  <Text className="text-xs text-muted mb-1">Drop-off Location</Text>
                  <Text className="text-sm text-foreground">{selectedBooking.dropoffLocation}</Text>
                </View>
              </View>

              {/* Cargo Details */}
              <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                <Text className="text-sm font-bold text-foreground mb-3">Cargo Details</Text>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs text-muted">Type</Text>
                  <Text className="text-sm text-foreground">{selectedBooking.cargoType}</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs text-muted">Weight</Text>
                  <Text className="text-sm text-foreground">{selectedBooking.cargoWeight}</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs text-muted">Vehicle Required</Text>
                  <Text className="text-sm text-foreground">{selectedBooking.vehicleRequired}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted">Distance</Text>
                  <Text className="text-sm text-foreground">{selectedBooking.distance}</Text>
                </View>
              </View>

              {/* Driver & Vehicle (if accepted/completed) */}
              {(selectedBooking.status === "accepted" || selectedBooking.status === "completed") &&
                selectedBooking.driverName && (
                  <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                    <Text className="text-sm font-bold text-foreground mb-3">
                      Driver & Vehicle
                    </Text>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-xs text-muted">Driver Name</Text>
                      <Text className="text-sm text-foreground">{selectedBooking.driverName}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-xs text-muted">Driver Phone</Text>
                      <Text className="text-sm text-foreground">{selectedBooking.driverPhone}</Text>
                    </View>
                    {selectedBooking.vehicleType && (
                      <>
                        <View className="flex-row justify-between mb-2">
                          <Text className="text-xs text-muted">Vehicle Type</Text>
                          <Text className="text-sm text-foreground">
                            {selectedBooking.vehicleType}
                          </Text>
                        </View>
                        <View className="flex-row justify-between mb-2">
                          <Text className="text-xs text-muted">Vehicle Color</Text>
                          <Text className="text-sm text-foreground">
                            {selectedBooking.vehicleColor}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-xs text-muted">Plate Number</Text>
                          <Text className="text-sm text-foreground">
                            {selectedBooking.vehiclePlate}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                )}

              {/* Timestamps */}
              <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                <Text className="text-sm font-bold text-foreground mb-3">Timeline</Text>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs text-muted">Created</Text>
                  <Text className="text-sm text-foreground">
                    {formatDateTime(selectedBooking.createdAt)}
                  </Text>
                </View>
                {selectedBooking.acceptedAt && (
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-xs text-muted">Accepted</Text>
                    <Text className="text-sm text-foreground">
                      {formatDateTime(selectedBooking.acceptedAt)}
                    </Text>
                  </View>
                )}
                {selectedBooking.completedAt && (
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-xs text-muted">Completed</Text>
                    <Text className="text-sm text-foreground">
                      {formatDateTime(selectedBooking.completedAt)}
                    </Text>
                  </View>
                )}
                {selectedBooking.rejectedAt && (
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-muted">Rejected</Text>
                    <Text className="text-sm text-foreground">
                      {formatDateTime(selectedBooking.rejectedAt)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Payment History */}
              {selectedBooking.payments && selectedBooking.payments.length > 0 && (
                <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
                  <Text className="text-sm font-bold text-foreground mb-3">Payment History</Text>
                  {selectedBooking.payments.map((payment, index) => (
                    <View
                      key={payment.id}
                      className={`pb-3 ${index < selectedBooking.payments!.length - 1 ? "mb-3 border-b border-border" : ""}`}
                    >
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-xs text-muted">Amount</Text>
                        <Text className="text-sm font-bold text-foreground">
                          K{payment.amount.toFixed(2)}
                        </Text>
                      </View>
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-xs text-muted">Method</Text>
                        <Text className="text-sm text-foreground">{payment.method}</Text>
                      </View>
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-xs text-muted">Transaction ID</Text>
                        <Text className="text-sm text-foreground">{payment.transactionId}</Text>
                      </View>
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-xs text-muted">Status</Text>
                        <View
                          style={{
                            backgroundColor: PAYMENT_STATUS_CONFIG[payment.status].bgColor,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                          }}
                        >
                          <Text
                            style={{ color: PAYMENT_STATUS_CONFIG[payment.status].textColor }}
                            className="text-xs font-semibold"
                          >
                            {PAYMENT_STATUS_CONFIG[payment.status].label}
                          </Text>
                        </View>
                      </View>
                      {payment.paidAt && (
                        <View className="flex-row justify-between">
                          <Text className="text-xs text-muted">Paid At</Text>
                          <Text className="text-sm text-foreground">
                            {formatDateTime(payment.paidAt)}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Total Amount */}
              <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-bold text-foreground">Total Amount</Text>
                  <Text className="text-2xl font-bold text-primary">
                    K{selectedBooking.totalAmount.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Action Buttons for accepted bookings */}
              {(selectedBooking.status === "accepted" ||
                selectedBooking.status === "completed") && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 8 }}>
                  {/* Track Driver button */}
                  {selectedBooking.status === "accepted" && (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedBooking(null);
                        router.push("/carrier/track" as any);
                      }}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 14,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: "#0a7ea4",
                        backgroundColor: "transparent",
                        gap: 6,
                      }}
                    >
                      <MaterialIcons name="gps-fixed" size={18} color="#0a7ea4" />
                      <Text style={{ color: "#0a7ea4", fontWeight: "600" }}>Track Driver</Text>
                    </TouchableOpacity>
                  )}

                  {/* Pay Now button for unpaid bookings */}
                  {selectedBooking.paymentStatus !== "paid" && (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedBooking(null);
                        router.push("/carrier/wallet" as any);
                      }}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 14,
                        borderRadius: 12,
                        backgroundColor: "#0a7ea4",
                        gap: 6,
                      }}
                    >
                      <MaterialIcons name="payment" size={18} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "600" }}>Pay Now</Text>
                    </TouchableOpacity>
                  )}

                  {/* Rate Driver button for completed + paid bookings */}
                  {selectedBooking.status === "completed" &&
                    selectedBooking.paymentStatus === "paid" && (
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedBooking(null);
                        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert("Rate Driver", "Rating feature coming soon!");
                      }}
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 14,
                        borderRadius: 12,
                        backgroundColor: "#22C55E",
                        gap: 6,
                      }}
                    >
                      <MaterialIcons name="star" size={18} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "600" }}>Rate Driver</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          </ScreenContainer>
        </Modal>
      )}

      {/* Cancel Confirmation Dialog */}
      <Modal
        visible={showCancelDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCancelDialog(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 20,
              padding: 24,
              width: "100%",
              maxWidth: 400,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 12,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 20 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "#FEE2E2",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <MaterialIcons name="cancel" size={32} color="#991B1B" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#11181C", marginBottom: 8 }}>
                Cancel Booking?
              </Text>
              <Text style={{ fontSize: 14, color: "#687076", textAlign: "center" }}>
                Are you sure you want to cancel this booking?
              </Text>
            </View>

            {bookingToCancel && (
              <View
                style={{
                  backgroundColor: "#F5F5F5",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 20,
                }}
              >
                <Text style={{ fontSize: 12, color: "#687076", marginBottom: 4 }}>Booking ID</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#11181C", marginBottom: 12 }}>
                  {bookingToCancel.bookingId}
                </Text>
                <Text style={{ fontSize: 12, color: "#687076", marginBottom: 4 }}>Route</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>
                  {bookingToCancel.pickupLocation} → {bookingToCancel.dropoffLocation}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowCancelDialog(false)}
                style={{
                  flex: 1,
                  backgroundColor: "#F5F5F5",
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#687076" }}>No, Keep It</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmCancelBooking}
                style={{
                  flex: 1,
                  backgroundColor: "#EF4444",
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Yes, Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotifications(false)}
      >
        <ScreenContainer className="bg-background">
          {/* Modal Header */}
          <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
            <Text className="text-xl font-bold text-foreground">Notifications</Text>
            <TouchableOpacity
              onPress={() => setShowNotifications(false)}
              className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
            >
              <MaterialIcons name="close" size={20} color="#687076" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            {notifications.length === 0 ? (
              <View className="flex-1 items-center justify-center p-8" style={{ minHeight: 300 }}>
                <MaterialIcons name="notifications-none" size={64} color="#9BA1A6" />
                <Text className="text-lg font-semibold text-foreground mt-4">
                  No Notifications
                </Text>
                <Text className="text-sm text-muted text-center mt-2">
                  You'll see booking updates here
                </Text>
              </View>
            ) : (
              notifications.map((notif) => (
                <View
                  key={notif.id}
                  className="bg-surface rounded-2xl p-4 mb-3 border border-border"
                >
                  <View className="flex-row items-start">
                    <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                      <MaterialIcons name="notifications" size={20} color="#0a7ea4" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-foreground mb-1">{notif.title}</Text>
                      <Text className="text-sm text-muted mb-2">{notif.message}</Text>
                      <Text className="text-xs text-muted">{formatDateTime(notif.createdAt)}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </ScreenContainer>
      </Modal>

      {/* Edit Booking Modal */}
      <EditBookingModal
        visible={showEditModal}
        booking={editingBooking}
        onClose={() => {
          setShowEditModal(false);
          setEditingBooking(null);
        }}
        onSave={handleSaveBooking}
      />
    </ScreenContainer>
  );
}
