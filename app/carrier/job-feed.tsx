import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

interface JobRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  pickupLocation: string;
  dropoffLocation: string;
  distance: string;
  cargoType: string;
  cargoDescription: string;
  cargoWeight: string;
  vehicleRequired: string;
  estimatedPrice: number;
  scheduledTime: string;
  notes: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
}

const VEHICLE_ICONS: Record<string, string> = {
  motorbike: "two-wheeler",
  van: "airport-shuttle",
  pickup: "local-shipping",
  truck: "local-shipping",
  trailer: "local-shipping",
};

const CARGO_COLORS: Record<string, string> = {
  Household: "#8B5CF6",
  Goods: "#3B82F6",
  Bulk: "#F59E0B",
  Fragile: "#EF4444",
  Documents: "#22C55E",
  default: "#6B7280",
};

export default function DriverJobFeedScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobRequest | null>(null);
  const [driverVehicle, setDriverVehicle] = useState<string>("");
  const [filterVehicle, setFilterVehicle] = useState(false);

  const loadJobs = useCallback(async () => {
    try {
      // Load from AsyncStorage (local bookings created by customers)
      const stored = await AsyncStorage.getItem("carrier_bookings");
      const allBookings: JobRequest[] = stored ? JSON.parse(stored) : [];
      // Show only pending jobs
      const pendingJobs = allBookings.filter((j) => j.status === "pending");

      // If filter by vehicle, only show matching jobs
      if (filterVehicle && driverVehicle) {
        setJobs(
          pendingJobs.filter(
            (j) =>
              j.vehicleRequired.toLowerCase() === driverVehicle.toLowerCase()
          )
        );
      } else {
        setJobs(pendingJobs);
      }
    } catch (e) {
      console.error("Error loading jobs:", e);
    }
  }, [filterVehicle, driverVehicle]);

  const loadDriverProfile = useCallback(async () => {
    try {
      const profile = await AsyncStorage.getItem("carrier_driver_profile");
      if (profile) {
        const parsed = JSON.parse(profile);
        setDriverVehicle(parsed.vehicleType || "");
      }
    } catch (e) {
      console.error("Error loading driver profile:", e);
    }
  }, []);

  useEffect(() => {
    loadDriverProfile();
  }, [loadDriverProfile]);

  useEffect(() => {
    loadJobs();
    // Poll for new jobs every 10 seconds
    const interval = setInterval(loadJobs, 10000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  }, [loadJobs]);

  const handleAcceptJob = async (job: JobRequest) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      "Accept Job",
      `Accept transport job from ${job.customerName}?\n\nPickup: ${job.pickupLocation}\nDrop-off: ${job.dropoffLocation}\nPrice: K${job.estimatedPrice.toFixed(2)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              const stored = await AsyncStorage.getItem("carrier_bookings");
              const allBookings: JobRequest[] = stored
                ? JSON.parse(stored)
                : [];
              const updated = allBookings.map((b) =>
                b.id === job.id ? { ...b, status: "accepted" as const } : b
              );
              await AsyncStorage.setItem(
                "carrier_bookings",
                JSON.stringify(updated)
              );

              // Load driver profile to attach driver info
              const driverProfileStr = await AsyncStorage.getItem("carrier_driver_profile");
              const driverProfile = driverProfileStr ? JSON.parse(driverProfileStr) : {};
              const acceptedAt = new Date().toISOString();

              // Save to active jobs with driver info
              const activeStored = await AsyncStorage.getItem("carrier_active_jobs");
              const activeJobs = activeStored ? JSON.parse(activeStored) : [];
              activeJobs.push({
                ...job,
                status: "accepted",
                acceptedAt,
                driverName: driverProfile.fullName || "Driver",
                driverPhone: driverProfile.phoneNumber || "",
                vehicleType: driverProfile.vehicleType || job.vehicleRequired,
                vehicleColor: driverProfile.vehicleColor || "",
                vehiclePlate: driverProfile.vehicleNumberPlate || "",
              });
              await AsyncStorage.setItem("carrier_active_jobs", JSON.stringify(activeJobs));

              // Update customer_bookings with accepted status + driver info so track.tsx shows driver
              const custStr = await AsyncStorage.getItem("customer_bookings");
              const custBookings = custStr ? JSON.parse(custStr) : [];
              const updatedCust = custBookings.map((b: any) =>
                b.id === job.id
                  ? {
                      ...b,
                      status: "accepted",
                      acceptedAt,
                      driverName: driverProfile.fullName || "Driver",
                      driverPhone: driverProfile.phoneNumber || "",
                      vehicleType: driverProfile.vehicleType || job.vehicleRequired,
                      vehicleColor: driverProfile.vehicleColor || "",
                      vehiclePlate: driverProfile.vehicleNumberPlate || "",
                    }
                  : b
              );
              await AsyncStorage.setItem("customer_bookings", JSON.stringify(updatedCust));

              // Add notification for customer
              const notifStored = await AsyncStorage.getItem(
                "carrier_notifications"
              );
              const notifications = notifStored ? JSON.parse(notifStored) : [];
              notifications.unshift({
                id: `notif_${Date.now()}`,
                type: "booking_accepted",
                title: "Booking Accepted",
                message: `Your carrier booking has been accepted! A driver is on the way to pick up your cargo.`,
                bookingId: job.id,
                recipientType: "customer",
                recipientId: job.customerName,
                read: false,
                createdAt: new Date().toISOString(),
              });
              await AsyncStorage.setItem(
                "carrier_notifications",
                JSON.stringify(notifications)
              );

              setSelectedJob(null);
              await loadJobs();

              if (Platform.OS !== "web") {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
              }
              Alert.alert(
                "Job Accepted!",
                "You have accepted this transport job. Navigate to Active Jobs to manage it.",
                [
                  {
                    text: "View Active Jobs",
                    onPress: () => router.push("/carrier/active-job" as any),
                  },
                  { text: "Stay Here" },
                ]
              );
            } catch (e) {
              Alert.alert("Error", "Failed to accept job. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleRejectJob = async (job: JobRequest) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Alert.alert("Reject Job", "Are you sure you want to reject this job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            const stored = await AsyncStorage.getItem("carrier_bookings");
            const allBookings: JobRequest[] = stored
              ? JSON.parse(stored)
              : [];
            const updated = allBookings.map((b) =>
              b.id === job.id ? { ...b, status: "rejected" as const } : b
            );
            await AsyncStorage.setItem(
              "carrier_bookings",
              JSON.stringify(updated)
            );

            // Update customer_bookings status to rejected so customer sees update
            const custStr2 = await AsyncStorage.getItem("customer_bookings");
            const custBookings2 = custStr2 ? JSON.parse(custStr2) : [];
            const updatedCust2 = custBookings2.map((b: any) =>
              b.id === job.id ? { ...b, status: "rejected" } : b
            );
            await AsyncStorage.setItem("customer_bookings", JSON.stringify(updatedCust2));

            // Add notification for customer
            const notifStored = await AsyncStorage.getItem(
              "carrier_notifications"
            );
            const notifications = notifStored ? JSON.parse(notifStored) : [];
            notifications.unshift({
              id: `notif_${Date.now()}`,
              type: "booking_rejected",
              title: "Booking Update",
              message: `Your carrier booking was not accepted. We are finding another driver for you.`,
              bookingId: job.id,
              recipientType: "customer",
              recipientId: job.customerName,
              read: false,
              createdAt: new Date().toISOString(),
            });
            await AsyncStorage.setItem(
              "carrier_notifications",
              JSON.stringify(notifications)
            );

            setSelectedJob(null);
            await loadJobs();
          } catch (e) {
            Alert.alert("Error", "Failed to reject job. Please try again.");
          }
        },
      },
    ]);
  };

  const getCargoColor = (cargoType: string) => {
    return CARGO_COLORS[cargoType] || CARGO_COLORS.default;
  };

  const renderJobCard = ({ item }: { item: JobRequest }) => (
    <TouchableOpacity
      onPress={() => setSelectedJob(item)}
      activeOpacity={0.7}
      style={{ marginHorizontal: 16, marginBottom: 12 }}
    >
      <View className="bg-surface rounded-2xl border border-border overflow-hidden">
        {/* Top bar with cargo type */}
        <View
          style={{ backgroundColor: getCargoColor(item.cargoType) }}
          className="px-4 py-2 flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <MaterialIcons name="inventory-2" size={16} color="#fff" />
            <Text className="text-white text-xs font-semibold ml-1">
              {item.cargoType || "General"}
            </Text>
          </View>
          <Text className="text-white text-xs">
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        <View className="p-4">
          {/* Locations */}
          <View className="mb-3">
            <View className="flex-row items-start mb-2">
              <View className="w-6 items-center mt-1">
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: "#22C55E",
                  }}
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs text-muted">PICKUP</Text>
                <Text
                  className="text-sm text-foreground font-medium"
                  numberOfLines={1}
                >
                  {item.pickupLocation}
                </Text>
              </View>
            </View>
            <View className="flex-row items-start">
              <View className="w-6 items-center mt-1">
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: "#EF4444",
                  }}
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs text-muted">DROP-OFF</Text>
                <Text
                  className="text-sm text-foreground font-medium"
                  numberOfLines={1}
                >
                  {item.dropoffLocation}
                </Text>
              </View>
            </View>
          </View>

          {/* Info row */}
          <View className="flex-row items-center justify-between mb-3 bg-background rounded-lg p-2">
            <View className="flex-row items-center">
              <MaterialIcons name="straighten" size={14} color="#9BA1A6" />
              <Text className="text-xs text-muted ml-1">
                {item.distance || "N/A"}
              </Text>
            </View>
            <View className="flex-row items-center">
              <MaterialIcons
                name={
                  (VEHICLE_ICONS[item.vehicleRequired?.toLowerCase()] ||
                    "local-shipping") as any
                }
                size={14}
                color="#9BA1A6"
              />
              <Text className="text-xs text-muted ml-1">
                {item.vehicleRequired || "Any"}
              </Text>
            </View>
            <View className="flex-row items-center">
              <MaterialIcons name="scale" size={14} color="#9BA1A6" />
              <Text className="text-xs text-muted ml-1">
                {item.cargoWeight || "N/A"}
              </Text>
            </View>
          </View>

          {/* Price and actions */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-muted">Estimated Price</Text>
              <Text className="text-xl font-bold text-foreground">
                K{item.estimatedPrice?.toFixed(2) || "0.00"}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => handleRejectJob(item)}
                style={{
                  backgroundColor: "rgba(239,68,68,0.15)",
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 13 }}>
                  Reject
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleAcceptJob(item)}
                style={{
                  backgroundColor: "#22C55E",
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                  Accept
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-8 pt-20">
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: "rgba(34,197,94,0.15)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <MaterialIcons name="local-shipping" size={40} color="#22C55E" />
      </View>
      <Text className="text-lg font-semibold text-foreground text-center mb-2">
        No Jobs Available
      </Text>
      <Text className="text-sm text-muted text-center leading-5">
        New transport requests will appear here. Pull down to refresh or wait
        for new bookings.
      </Text>
    </View>
  );

  // Job detail modal
  const renderJobDetailModal = () => (
    <Modal
      visible={!!selectedJob}
      transparent
      animationType="slide"
      onRequestClose={() => setSelectedJob(null)}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
      >
        <View className="bg-surface rounded-t-3xl" style={{ maxHeight: "85%" }}>
          {/* Handle */}
          <View className="items-center pt-3 pb-2">
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#666",
              }}
            />
          </View>

          {selectedJob && (
            <View className="px-6 pb-8">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-foreground">
                  Job Details
                </Text>
                <TouchableOpacity onPress={() => setSelectedJob(null)}>
                  <MaterialIcons name="close" size={24} color="#9BA1A6" />
                </TouchableOpacity>
              </View>

              {/* Customer info */}
              <View className="bg-background rounded-xl p-4 mb-3">
                <Text className="text-xs text-muted mb-1">CUSTOMER</Text>
                <Text className="text-base font-semibold text-foreground">
                  {selectedJob.customerName}
                </Text>
                <Text className="text-sm text-muted">
                  {selectedJob.customerPhone}
                </Text>
              </View>

              {/* Locations */}
              <View className="bg-background rounded-xl p-4 mb-3">
                <View className="mb-3">
                  <Text className="text-xs text-muted mb-1">
                    PICKUP LOCATION
                  </Text>
                  <Text className="text-sm text-foreground">
                    {selectedJob.pickupLocation}
                  </Text>
                </View>
                <View
                  style={{
                    height: 1,
                    backgroundColor: "#334155",
                    marginBottom: 12,
                  }}
                />
                <View>
                  <Text className="text-xs text-muted mb-1">
                    DROP-OFF LOCATION
                  </Text>
                  <Text className="text-sm text-foreground">
                    {selectedJob.dropoffLocation}
                  </Text>
                </View>
              </View>

              {/* Cargo details */}
              <View className="bg-background rounded-xl p-4 mb-3">
                <Text className="text-xs text-muted mb-2">CARGO DETAILS</Text>
                <View className="flex-row flex-wrap gap-3">
                  <View>
                    <Text className="text-xs text-muted">Type</Text>
                    <Text className="text-sm font-medium text-foreground">
                      {selectedJob.cargoType || "General"}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-muted">Weight</Text>
                    <Text className="text-sm font-medium text-foreground">
                      {selectedJob.cargoWeight || "N/A"}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-muted">Vehicle</Text>
                    <Text className="text-sm font-medium text-foreground">
                      {selectedJob.vehicleRequired || "Any"}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-muted">Distance</Text>
                    <Text className="text-sm font-medium text-foreground">
                      {selectedJob.distance || "N/A"}
                    </Text>
                  </View>
                </View>
                {selectedJob.cargoDescription ? (
                  <View className="mt-2">
                    <Text className="text-xs text-muted">Description</Text>
                    <Text className="text-sm text-foreground">
                      {selectedJob.cargoDescription}
                    </Text>
                  </View>
                ) : null}
                {selectedJob.notes ? (
                  <View className="mt-2">
                    <Text className="text-xs text-muted">
                      Special Instructions
                    </Text>
                    <Text className="text-sm text-foreground">
                      {selectedJob.notes}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Price */}
              <View className="bg-background rounded-xl p-4 mb-4">
                <Text className="text-xs text-muted mb-1">ESTIMATED PRICE</Text>
                <Text className="text-2xl font-bold text-foreground">
                  K{selectedJob.estimatedPrice?.toFixed(2) || "0.00"}
                </Text>
              </View>

              {/* Action buttons */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => handleRejectJob(selectedJob)}
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(239,68,68,0.15)",
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#EF4444",
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    Reject
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleAcceptJob(selectedJob)}
                  style={{
                    flex: 2,
                    backgroundColor: "#22C55E",
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}
                  >
                    Accept Job
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-foreground">Job Feed</Text>
            <Text className="text-xs text-muted">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""} available
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setFilterVehicle(!filterVehicle)}
          style={{
            backgroundColor: filterVehicle
              ? "rgba(34,197,94,0.2)"
              : "rgba(255,255,255,0.1)",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <MaterialIcons
            name="filter-list"
            size={16}
            color={filterVehicle ? "#22C55E" : "#9BA1A6"}
          />
          <Text
            style={{
              color: filterVehicle ? "#22C55E" : "#9BA1A6",
              fontSize: 12,
              marginLeft: 4,
            }}
          >
            {filterVehicle ? "Filtered" : "Filter"}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJobCard}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#22C55E"
          />
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
      />

      {renderJobDetailModal()}
    </ScreenContainer>
  );
}
