/**
 * app/(tabs)/carrier-live-map.tsx
 *
 * Live map view for carrier drivers showing real active jobs from AsyncStorage.
 * Loads from carrier_active_jobs (written by job-feed accept flow).
 */

import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet, Linking, Platform, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { CarrierBottomNav } from "@/components/carrier-bottom-nav";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";
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
  estimatedPrice: number;
  status: string;
  acceptedAt: string;
  arrivedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleType?: string;
  vehiclePlate?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  accepted: { label: "Accepted", color: "#3B82F6", icon: "check-circle" },
  arrived: { label: "Arrived", color: "#8B5CF6", icon: "location-on" },
  picked_up: { label: "Picked Up", color: "#F59E0B", icon: "inventory-2" },
  delivered: { label: "Delivered", color: "#22C55E", icon: "done-all" },
};

export default function CarrierLiveMapScreen() {
  const router = useRouter();
  const colors = useColors();
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ActiveJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActiveJobs = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("carrier_active_jobs");
      const jobs: ActiveJob[] = stored ? JSON.parse(stored) : [];
      // Show non-delivered jobs first
      const sorted = [...jobs].sort((a, b) => {
        if (a.status === "delivered" && b.status !== "delivered") return 1;
        if (a.status !== "delivered" && b.status === "delivered") return -1;
        return new Date(b.acceptedAt).getTime() - new Date(a.acceptedAt).getTime();
      });
      setActiveJobs(sorted);
      // Auto-select first non-delivered job
      const firstActive = sorted.find((j) => j.status !== "delivered");
      if (firstActive && (!selectedJob || selectedJob.id === firstActive.id)) {
        setSelectedJob(firstActive);
      }
    } catch (error) {
      console.error("Error loading active jobs:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedJob]);

  useEffect(() => {
    loadActiveJobs();
    const interval = setInterval(loadActiveJobs, 8000);
    return () => clearInterval(interval);
  }, [loadActiveJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadActiveJobs();
    setRefreshing(false);
  }, [loadActiveJobs]);

  const handleCallCustomer = (phone: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert("No Phone", "Customer phone number is not available.");
    }
  };

  const handleNavigate = (location: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const query = encodeURIComponent(location);
    const url = Platform.OS === "ios"
      ? `maps:?q=${query}`
      : `geo:0,0?q=${query}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${query}`);
    });
  };

  const handleUpdateStatus = async (job: ActiveJob, newStatus: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const labels: Record<string, string> = {
      arrived: "Mark as Arrived at pickup?",
      picked_up: "Confirm cargo picked up?",
      delivered: "Confirm cargo delivered?",
    };

    Alert.alert("Update Status", labels[newStatus] || `Update to ${newStatus}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const stored = await AsyncStorage.getItem("carrier_active_jobs");
            const jobs: ActiveJob[] = stored ? JSON.parse(stored) : [];
            const now = new Date().toISOString();
            const updated = jobs.map((j) => {
              if (j.id !== job.id) return j;
              return {
                ...j,
                status: newStatus,
                ...(newStatus === "arrived" ? { arrivedAt: now } : {}),
                ...(newStatus === "picked_up" ? { pickedUpAt: now } : {}),
                ...(newStatus === "delivered" ? { deliveredAt: now } : {}),
              };
            });
            await AsyncStorage.setItem("carrier_active_jobs", JSON.stringify(updated));

            // Sync customer_bookings
            const custStr = await AsyncStorage.getItem("customer_bookings");
            const custList = custStr ? JSON.parse(custStr) : [];
            const updatedCust = custList.map((b: any) =>
              b.id === job.id
                ? {
                    ...b,
                    status: newStatus,
                    ...(newStatus === "arrived" ? { arrivedAt: now } : {}),
                    ...(newStatus === "picked_up" ? { pickedUpAt: now } : {}),
                    ...(newStatus === "delivered" ? { completedAt: now } : {}),
                  }
                : b
            );
            await AsyncStorage.setItem("customer_bookings", JSON.stringify(updatedCust));

            // Sync carrier_bookings
            const bkStr = await AsyncStorage.getItem("carrier_bookings");
            const bkList = bkStr ? JSON.parse(bkStr) : [];
            const updatedBk = bkList.map((b: any) =>
              b.id === job.id ? { ...b, status: newStatus } : b
            );
            await AsyncStorage.setItem("carrier_bookings", JSON.stringify(updatedBk));

            // Add customer notification
            const notifStr = await AsyncStorage.getItem("carrier_notifications");
            const notifs = notifStr ? JSON.parse(notifStr) : [];
            const msgs: Record<string, string> = {
              arrived: "Your driver has arrived at the pickup location.",
              picked_up: "Your cargo has been picked up and is on the way.",
              delivered: "Your cargo has been delivered successfully!",
            };
            notifs.unshift({
              id: `notif_${Date.now()}`,
              type: "status_update",
              title: newStatus === "delivered" ? "Delivery Complete" : "Status Update",
              message: msgs[newStatus] || `Status updated to ${newStatus}`,
              bookingId: job.id,
              recipientType: "customer",
              recipientId: job.customerName,
              read: false,
              createdAt: now,
            });
            await AsyncStorage.setItem("carrier_notifications", JSON.stringify(notifs));

            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await loadActiveJobs();

            if (newStatus === "delivered") {
              Alert.alert("Delivery Complete!", "Great work! The customer has been notified.", [
                { text: "View Active Jobs", onPress: () => router.push("/carrier/active-job" as any) },
                { text: "Stay Here" },
              ]);
            }
          } catch {
            Alert.alert("Error", "Failed to update status.");
          }
        },
      },
    ]);
  };

  const getNextStatus = (current: string) => {
    const flow = ["accepted", "arrived", "picked_up", "delivered"];
    const idx = flow.indexOf(current);
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  };

  const renderJobCard = ({ item }: { item: ActiveJob }) => {
    const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.accepted;
    const nextStatus = getNextStatus(item.status);
    const isSelected = selectedJob?.id === item.id;

    return (
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedJob(item);
        }}
        style={[
          styles.jobCard,
          {
            backgroundColor: colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 0.5,
          },
        ]}
        activeOpacity={0.8}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
            {item.customerName}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
            <Text style={{ color: statusInfo.color, fontSize: 11, fontWeight: "600" }}>
              {statusInfo.label}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-muted" numberOfLines={1}>
          {item.pickupLocation} → {item.dropoffLocation}
        </Text>
        {nextStatus && (
          <TouchableOpacity
            onPress={() => handleUpdateStatus(item, nextStatus)}
            style={[styles.nextStatusBtn, { backgroundColor: statusInfo.color }]}
          >
            <Text className="text-white text-xs font-semibold">
              Mark as {STATUS_LABELS[nextStatus]?.label}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text className="text-xl font-bold text-foreground">Live Map</Text>
        <Text className="text-sm text-muted">{activeJobs.filter(j => j.status !== "delivered").length} active job(s)</Text>
      </View>

      {/* Map Placeholder */}
      <View style={[styles.mapArea, { backgroundColor: colors.surface }]}>
        <MaterialIcons name="map" size={60} color={colors.muted} />
        {selectedJob ? (
          <View className="items-center mt-3">
            <Text className="text-foreground font-semibold text-base">{selectedJob.customerName}</Text>
            <Text className="text-muted text-sm mt-1">{selectedJob.pickupLocation}</Text>
            <Text className="text-muted text-xs mt-1">→ {selectedJob.dropoffLocation}</Text>
          </View>
        ) : (
          <Text className="text-muted text-center mt-3">Select a job below to see route</Text>
        )}
        {/* Quick action buttons when job selected */}
        {selectedJob && (
          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              onPress={() => handleCallCustomer(selectedJob.customerPhone)}
              style={[styles.mapActionBtn, { backgroundColor: `${colors.primary}15` }]}
            >
              <MaterialIcons name="call" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary }} className="text-xs font-semibold ml-1">Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleNavigate(selectedJob.pickupLocation)}
              style={[styles.mapActionBtn, { backgroundColor: `${colors.primary}15` }]}
            >
              <MaterialIcons name="navigation" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary }} className="text-xs font-semibold ml-1">Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/carrier/active-job" as any)}
              style={[styles.mapActionBtn, { backgroundColor: colors.primary }]}
            >
              <MaterialIcons name="list" size={18} color="#fff" />
              <Text className="text-white text-xs font-semibold ml-1">All Jobs</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Active Jobs List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted">Loading active jobs...</Text>
        </View>
      ) : activeJobs.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <MaterialIcons name="local-shipping" size={56} color={colors.muted} />
          <Text className="text-foreground font-semibold text-lg mt-4">No Active Jobs</Text>
          <Text className="text-muted text-center mt-2 text-sm">
            Accept a job from the Job Feed to see it here.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/carrier/job-feed" as any)}
            style={[styles.feedBtn, { backgroundColor: colors.primary }]}
          >
            <Text className="text-white font-semibold">Browse Job Feed</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={activeJobs}
          keyExtractor={(item) => item.id}
          renderItem={renderJobCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <CarrierBottomNav currentTab="map" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  mapArea: {
    height: 220,
    margin: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  mapActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  jobCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  nextStatusBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  feedBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
});
