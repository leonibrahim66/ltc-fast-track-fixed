import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

interface ActiveJob {
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
  notes: string;
  status: string;
  acceptedAt: string;
  arrivedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
}

const STATUS_FLOW = [
  { key: "accepted", label: "Accepted", icon: "check-circle", color: "#3B82F6" },
  { key: "arrived", label: "Arrived", icon: "location-on", color: "#8B5CF6" },
  { key: "picked_up", label: "Picked Up", icon: "inventory-2", color: "#F59E0B" },
  { key: "delivered", label: "Delivered", icon: "done-all", color: "#22C55E" },
];

export default function ActiveJobScreen() {
  const router = useRouter();
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveJobs = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("carrier_active_jobs");
      const jobs: ActiveJob[] = stored ? JSON.parse(stored) : [];
      // Show non-delivered jobs first, then delivered
      const sorted = jobs.sort((a, b) => {
        if (a.status === "delivered" && b.status !== "delivered") return 1;
        if (a.status !== "delivered" && b.status === "delivered") return -1;
        return new Date(b.acceptedAt).getTime() - new Date(a.acceptedAt).getTime();
      });
      setActiveJobs(sorted);
    } catch (e) {
      console.error("Error loading active jobs:", e);
    }
  }, []);

  useEffect(() => {
    loadActiveJobs();
    const interval = setInterval(loadActiveJobs, 5000);
    return () => clearInterval(interval);
  }, [loadActiveJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActiveJobs();
    setRefreshing(false);
  }, [loadActiveJobs]);

  const getNextStatus = (currentStatus: string): string | null => {
    const idx = STATUS_FLOW.findIndex((s) => s.key === currentStatus);
    if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[idx + 1].key;
    }
    return null;
  };

  const getNextStatusLabel = (currentStatus: string): string => {
    const next = getNextStatus(currentStatus);
    if (!next) return "";
    const step = STATUS_FLOW.find((s) => s.key === next);
    return step ? step.label : "";
  };

  const updateJobStatus = async (job: ActiveJob, newStatus: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const statusLabels: Record<string, string> = {
      arrived: "Mark as Arrived at pickup location?",
      picked_up: "Confirm cargo has been picked up?",
      delivered: "Confirm cargo has been delivered?",
    };

    Alert.alert("Update Status", statusLabels[newStatus] || `Update to ${newStatus}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const stored = await AsyncStorage.getItem("carrier_active_jobs");
            const jobs: ActiveJob[] = stored ? JSON.parse(stored) : [];
            const updated = jobs.map((j) => {
              if (j.id === job.id) {
                const update: any = { ...j, status: newStatus };
                if (newStatus === "arrived") update.arrivedAt = new Date().toISOString();
                if (newStatus === "picked_up") update.pickedUpAt = new Date().toISOString();
                if (newStatus === "delivered") update.deliveredAt = new Date().toISOString();
                return update;
              }
              return j;
            });
            await AsyncStorage.setItem("carrier_active_jobs", JSON.stringify(updated));

            // Also update in carrier_bookings
            const bookingsStored = await AsyncStorage.getItem("carrier_bookings");
            const allBookings = bookingsStored ? JSON.parse(bookingsStored) : [];
            const updatedBookings = allBookings.map((b: any) =>
              b.id === job.id ? { ...b, status: newStatus } : b
            );
            await AsyncStorage.setItem("carrier_bookings", JSON.stringify(updatedBookings));

            // Sync to customer_bookings so customer track screen shows real-time status
            const custBkStr = await AsyncStorage.getItem("customer_bookings");
            const custBkList = custBkStr ? JSON.parse(custBkStr) : [];
            const updatedCustBk = custBkList.map((b: any) =>
              b.id === job.id
                ? {
                    ...b,
                    status: newStatus,
                    ...(newStatus === "arrived" ? { arrivedAt: new Date().toISOString() } : {}),
                    ...(newStatus === "picked_up" ? { pickedUpAt: new Date().toISOString() } : {}),
                    ...(newStatus === "delivered" ? { completedAt: new Date().toISOString() } : {}),
                  }
                : b
            );
            await AsyncStorage.setItem("customer_bookings", JSON.stringify(updatedCustBk));

            // Add notification for customer
            const notifStored = await AsyncStorage.getItem("carrier_notifications");
            const notifications = notifStored ? JSON.parse(notifStored) : [];
            const notifMessages: Record<string, string> = {
              arrived: "Your driver has arrived at the pickup location.",
              picked_up: "Your cargo has been picked up and is on the way.",
              delivered: "Your cargo has been delivered successfully!",
            };
            notifications.unshift({
              id: `notif_${Date.now()}`,
              type: "status_update",
              title: newStatus === "delivered" ? "Delivery Complete" : "Status Update",
              message: notifMessages[newStatus] || `Job status updated to ${newStatus}`,
              bookingId: job.id,
              recipientType: "customer",
              recipientId: job.customerName,
              read: false,
              createdAt: new Date().toISOString(),
            });
            await AsyncStorage.setItem("carrier_notifications", JSON.stringify(notifications));

            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            await loadActiveJobs();

            if (newStatus === "delivered") {
              Alert.alert(
                "Delivery Complete!",
                "Great job! Would you like to rate the driver?",
                [
                  { text: "Later", style: "cancel" },
                  {
                    text: "Rate Driver",
                    onPress: () => {
                      router.push({
                        pathname: "/carrier/rate-driver" as any,
                        params: { bookingId: job.id, driverName: "Driver" },
                      });
                    },
                  },
                ]
              );
            }
          } catch (e) {
            Alert.alert("Error", "Failed to update status.");
          }
        },
      },
    ]);
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const getCurrentStatusIndex = (status: string) => {
    return STATUS_FLOW.findIndex((s) => s.key === status);
  };

  const renderJobCard = ({ item }: { item: ActiveJob }) => {
    const currentIdx = getCurrentStatusIndex(item.status);
    const nextStatus = getNextStatus(item.status);
    const isDelivered = item.status === "delivered";

    return (
      <View
        style={{ marginHorizontal: 16, marginBottom: 16 }}
        className="bg-surface rounded-2xl border border-border overflow-hidden"
      >
        {/* Status header */}
        <View
          style={{
            backgroundColor: isDelivered ? "#22C55E" : "#3B82F6",
            paddingHorizontal: 16,
            paddingVertical: 10,
          }}
          className="flex-row items-center justify-between"
        >
          <View className="flex-row items-center">
            <MaterialIcons
              name={isDelivered ? "done-all" : "local-shipping"}
              size={18}
              color="#fff"
            />
            <Text className="text-white font-semibold ml-2">
              {isDelivered ? "Delivered" : "Active Job"}
            </Text>
          </View>
          <Text className="text-white/80 text-xs">
            #{item.id.slice(-6).toUpperCase()}
          </Text>
        </View>

        <View className="p-4">
          {/* Customer info */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center flex-1">
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "rgba(59,130,246,0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="person" size={20} color="#3B82F6" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-foreground">
                  {item.customerName}
                </Text>
                <Text className="text-xs text-muted">{item.customerPhone}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => callCustomer(item.customerPhone)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(34,197,94,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="phone" size={18} color="#22C55E" />
            </TouchableOpacity>
          </View>

          {/* Locations */}
          <View className="bg-background rounded-xl p-3 mb-3">
            <View className="flex-row items-start mb-2">
              <View className="w-5 items-center mt-1">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#22C55E",
                  }}
                />
              </View>
              <Text className="text-xs text-foreground ml-2 flex-1" numberOfLines={1}>
                {item.pickupLocation}
              </Text>
            </View>
            <View className="flex-row items-start">
              <View className="w-5 items-center mt-1">
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#EF4444",
                  }}
                />
              </View>
              <Text className="text-xs text-foreground ml-2 flex-1" numberOfLines={1}>
                {item.dropoffLocation}
              </Text>
            </View>
          </View>

          {/* Cargo & Price */}
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-3">
              <View className="flex-row items-center">
                <MaterialIcons name="inventory-2" size={14} color="#9BA1A6" />
                <Text className="text-xs text-muted ml-1">
                  {item.cargoType || "General"}
                </Text>
              </View>
              <View className="flex-row items-center">
                <MaterialIcons name="scale" size={14} color="#9BA1A6" />
                <Text className="text-xs text-muted ml-1">
                  {item.cargoWeight || "N/A"}
                </Text>
              </View>
            </View>
            <Text className="text-base font-bold text-foreground">
              K{item.estimatedPrice?.toFixed(2) || "0.00"}
            </Text>
          </View>

          {/* Status progress */}
          <View className="flex-row items-center justify-between mb-3">
            {STATUS_FLOW.map((step, idx) => {
              const isCompleted = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              return (
                <View key={step.key} className="items-center flex-1">
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isCompleted
                        ? step.color
                        : "rgba(255,255,255,0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: isCurrent ? 2 : 0,
                      borderColor: isCurrent ? "#fff" : "transparent",
                    }}
                  >
                    <MaterialIcons
                      name={step.icon as any}
                      size={14}
                      color={isCompleted ? "#fff" : "#666"}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 9,
                      color: isCompleted ? "#ECEDEE" : "#666",
                      marginTop: 4,
                      fontWeight: isCurrent ? "700" : "400",
                    }}
                  >
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Next action button */}
          {nextStatus && (
            <TouchableOpacity
              onPress={() => updateJobStatus(item, nextStatus)}
              style={{
                backgroundColor:
                  STATUS_FLOW.find((s) => s.key === nextStatus)?.color ||
                  "#3B82F6",
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                Mark as {getNextStatusLabel(item.status)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-8 pt-20">
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: "rgba(59,130,246,0.15)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <MaterialIcons name="work-outline" size={40} color="#3B82F6" />
      </View>
      <Text className="text-lg font-semibold text-foreground text-center mb-2">
        No Active Jobs
      </Text>
      <Text className="text-sm text-muted text-center leading-5">
        Accept jobs from the Job Feed to start delivering.
      </Text>
      <TouchableOpacity
        onPress={() => router.push("/carrier/job-feed" as any)}
        style={{
          backgroundColor: "#22C55E",
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 12,
          marginTop: 16,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Go to Job Feed</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-3 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-bold text-foreground">Active Jobs</Text>
          <Text className="text-xs text-muted">
            {activeJobs.filter((j) => j.status !== "delivered").length} in
            progress
          </Text>
        </View>
      </View>

      <FlatList
        data={activeJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJobCard}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
      />
    </ScreenContainer>
  );
}
