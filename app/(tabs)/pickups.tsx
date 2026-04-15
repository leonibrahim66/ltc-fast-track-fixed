import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  FlatList,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { RatingModal } from "@/components/rating-modal";
import { useAuth } from "@/lib/auth-context";
import { usePickups, PickupRequest } from "@/lib/pickups-context";
import { useITRealtime } from "@/lib/it-realtime-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
type FilterType = "all" | "pending" | "completed" | "scheduled";

export default function PickupsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { pickups, refreshPickups, updatePickup, isLoading, error } = usePickups();
  const { updateLivePickup, addEvent } = useITRealtime();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [pickupToRate, setPickupToRate] = useState<PickupRequest | null>(null);

  const isCollector = user?.role === "collector" || user?.role === "zone_manager";

  // Filter pickups based on user role
  const relevantPickups = isCollector
    ? pickups // Collectors see all pickups
    : pickups.filter((p) => p.userId === user?.id); // Customers see only their pickups

  // Apply filter
  const filteredPickups = relevantPickups.filter((p) => {
    if (filter === "all") return true;
    if (filter === "pending") return p.status === "pending" || p.status === "assigned";
    if (filter === "completed") return p.status === "completed";
    if (filter === "scheduled") return p.scheduledDate && p.status !== "completed";
    return true;
  });

  // Sort pickups - scheduled ones first, then by date
  const sortedPickups = [...filteredPickups].sort((a, b) => {
    // Scheduled pickups first
    if (a.scheduledDate && !b.scheduledDate) return -1;
    if (!a.scheduledDate && b.scheduledDate) return 1;
    // Then by creation date (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Real-time: reload pickups every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshPickups();
    }, [refreshPickups])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPickups();
    setRefreshing(false);
  };

  const handleCompletePickup = async (pickupId: string) => {
    const pickup = pickups.find((p) => p.id === pickupId);
    await updatePickup(pickupId, {
      status: "completed",
      completedAt: new Date().toISOString(),
    });
    // Fix 3: Emit live pickup status update to admin screens
    updateLivePickup(pickupId, { status: "completed" });
    addEvent({
      type: "pickup_completed",
      title: "Pickup Completed",
      description: `${pickup?.userName || "Customer"} pickup completed at ${pickup?.location?.address || "location"}`,
      data: {
        pickupId,
        userName: pickup?.userName,
        location: pickup?.location?.address,
      },
      priority: "medium",
    });
  };

  const handleRatePickup = (pickup: PickupRequest) => {
    setPickupToRate(pickup);
    setRatingModalVisible(true);
  };

  const handleSubmitRating = async (rating: number, comment: string) => {
    if (pickupToRate) {
      await updatePickup(pickupToRate.id, {
        rating,
        ratingComment: comment || undefined,
      });
      setRatingModalVisible(false);
      setPickupToRate(null);
      Alert.alert(
        "Thank You!",
        "Your rating has been submitted. We appreciate your feedback!"
      );
    }
  };

  const formatScheduledTime = (timeSlot: string) => {
    switch (timeSlot) {
      case "morning":
        return "8:00 AM - 12:00 PM";
      case "afternoon":
        return "12:00 PM - 4:00 PM";
      case "evening":
        return "4:00 PM - 7:00 PM";
      default:
        return timeSlot;
    }
  };

  const renderStars = (rating: number) => {
    return (
      <View className="flex-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialIcons
            key={star}
            name={star <= rating ? "star" : "star-border"}
            size={16}
            color={star <= rating ? "#F59E0B" : "#D1D5DB"}
          />
        ))}
      </View>
    );
  };

  const renderPickupItem = ({ item }: { item: PickupRequest }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border mx-6">
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-row items-center flex-1">
          <View
            className={`w-12 h-12 rounded-full items-center justify-center ${
              item.status === "completed"
                ? "bg-success/20"
                : item.status === "pending"
                ? "bg-warning/20"
                : "bg-primary/20"
            }`}
          >
            <MaterialIcons
              name={
                item.status === "completed"
                  ? "check-circle"
                  : item.scheduledDate
                  ? "event"
                  : item.status === "pending"
                  ? "schedule"
                  : "local-shipping"
              }
              size={24}
              color={
                item.status === "completed"
                  ? "#22C55E"
                  : item.scheduledDate
                  ? "#3B82F6"
                  : item.status === "pending"
                  ? "#F59E0B"
                  : "#22C55E"
              }
            />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-foreground font-semibold text-base">
              {item.binType.charAt(0).toUpperCase() + item.binType.slice(1)} Pickup
            </Text>
            <Text className="text-sm text-muted" numberOfLines={2}>
              {item.location.address || "Location pinned on map"}
            </Text>
          </View>
        </View>
        <View
          className={`px-3 py-1 rounded-full ${
            item.status === "completed"
              ? "bg-success/20"
              : item.scheduledDate
              ? "bg-blue-100"
              : item.status === "pending"
              ? "bg-warning/20"
              : "bg-primary/20"
          }`}
        >
          <Text
            className={`text-xs font-medium capitalize ${
              item.status === "completed"
                ? "text-success"
                : item.scheduledDate
                ? "text-blue-600"
                : item.status === "pending"
                ? "text-warning"
                : "text-primary"
            }`}
          >
            {item.scheduledDate && item.status !== "completed" ? "scheduled" : item.status}
          </Text>
        </View>
      </View>

      {/* Scheduled Date/Time Info */}
      {item.scheduledDate && (
        <View className="bg-blue-50 rounded-lg p-3 mb-3 flex-row items-center">
          <MaterialIcons name="event" size={18} color="#3B82F6" />
          <View className="ml-2">
            <Text className="text-blue-700 font-medium">
              {new Date(item.scheduledDate).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </Text>
            {item.scheduledTime && (
              <Text className="text-blue-600 text-sm">
                {formatScheduledTime(item.scheduledTime)}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Additional Info */}
      <View className="flex-row items-center mb-2">
        <MaterialIcons name="access-time" size={14} color="#6B7280" />
        <Text className="text-xs text-muted ml-1">
          Requested: {new Date(item.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {isCollector && item.status !== "completed" && (
        <View className="flex-row items-center">
          <Text className="text-sm text-muted mr-2">
            Customer: {item.userName}
          </Text>
          <Text className="text-sm text-muted">
            ({item.userPhone})
          </Text>
        </View>
      )}

      {item.notes && (
        <View className="bg-background rounded-lg p-3 mt-2">
          <Text className="text-sm text-muted">{item.notes}</Text>
        </View>
      )}

      {/* Rating Display (for completed pickups) */}
      {item.status === "completed" && item.rating && (
        <View className="bg-yellow-50 rounded-lg p-3 mt-2 flex-row items-center">
          <MaterialIcons name="star" size={18} color="#F59E0B" />
          <View className="ml-2 flex-1">
            <View className="flex-row items-center">
              {renderStars(item.rating)}
              <Text className="text-yellow-700 ml-2 font-medium">
                {item.rating}/5
              </Text>
            </View>
            {item.ratingComment && (
              <Text className="text-yellow-600 text-sm mt-1">
                &ldquo;{item.ratingComment}&rdquo;
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Driver Communication Panel — shown when a driver has accepted/started the pickup */}
      {!isCollector && (item.status === "accepted" || item.status === "in_progress") &&
        (item.collectorName || item.assignedDriverName || item.driverPhone) && (
          <View style={styles.driverPanel}>
            <View style={styles.driverPanelHeader}>
              <View style={styles.driverAvatar}>
                <MaterialIcons name="local-shipping" size={18} color="#1B4332" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>
                  {item.assignedDriverName || item.collectorName || "Your Driver"}
                </Text>
                {item.driverPhone ? (
                  <Text style={styles.driverPhone}>{item.driverPhone}</Text>
                ) : null}
                <Text style={styles.driverVehicle}>
                  {item.driverVehicleType || "Garbage Truck"}
                </Text>
              </View>
              <View style={styles.driverOnlineDot} />
            </View>
            <View style={styles.driverCommBtns}>
              <TouchableOpacity
                style={[styles.driverCommBtn, { backgroundColor: "#1B4332" }]}
                onPress={() => {
                  if (item.driverPhone) Linking.openURL(`tel:${item.driverPhone}`);
                }}
                disabled={!item.driverPhone}
              >
                <MaterialIcons name="call" size={15} color="#fff" />
                <Text style={styles.driverCommBtnText}>Call Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.driverCommBtn, { backgroundColor: "#0F766E" }]}
                onPress={() => {
                  if (item.driverPhone) Linking.openURL(`sms:${item.driverPhone}`);
                }}
                disabled={!item.driverPhone}
              >
                <MaterialIcons name="sms" size={15} color="#fff" />
                <Text style={styles.driverCommBtnText}>SMS Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.driverCommBtn, { backgroundColor: "#2563EB" }]}
                onPress={() =>
                  router.push({
                    pathname: "/pickup-chat" as any,
                    params: {
                      pickupId: item.id,
                      otherName: item.assignedDriverName || item.collectorName || "Driver",
                      otherPhone: item.driverPhone || "",
                    },
                  })
                }
              >
                <MaterialIcons name="chat" size={15} color="#fff" />
                <Text style={styles.driverCommBtnText}>Chat Driver</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      {/* Track Pickup Button (for customers with assigned/in_progress pickups) */}
      {!isCollector && (item.status === "assigned" || item.status === "in_progress") && (
        <View className="flex-row mt-3 pt-3 border-t border-border">
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/pickup-tracking", params: { pickupId: item.id } } as any)}
            className="flex-1 bg-blue-500 py-3 rounded-xl flex-row items-center justify-center"
          >
            <MaterialIcons name="location-searching" size={18} color="#fff" />
            <Text className="text-white font-semibold ml-2">Track Collector</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Collector Actions */}
      {isCollector && item.status !== "completed" && (
        <View className="flex-row mt-3 pt-3 border-t border-border">
          <TouchableOpacity
            onPress={() => handleCompletePickup(item.id)}
            className="flex-1 bg-success py-3 rounded-xl flex-row items-center justify-center"
          >
            <MaterialIcons name="check" size={18} color="#fff" />
            <Text className="text-white font-semibold ml-2">Mark Complete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Customer Rate Button (for completed pickups without rating) */}
      {!isCollector && item.status === "completed" && !item.rating && (
        <View className="flex-row mt-3 pt-3 border-t border-border">
          <TouchableOpacity
            onPress={() => handleRatePickup(item)}
            className="flex-1 bg-warning py-3 rounded-xl flex-row items-center justify-center"
          >
            <MaterialIcons name="star" size={18} color="#fff" />
            <Text className="text-white font-semibold ml-2">Rate This Pickup</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* View Photos Button (for completed pickups with photos) */}
      {item.status === "completed" && item.completionPhotos && item.completionPhotos.length > 0 && (
        <View className="flex-row mt-3 pt-3 border-t border-border">
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/pickup-photos", params: { pickupId: item.id } } as any)}
            className="flex-1 bg-primary/10 py-3 rounded-xl flex-row items-center justify-center"
          >
            <MaterialIcons name="photo-library" size={18} color="#22C55E" />
            <Text className="text-primary font-semibold ml-2">
              View Photos ({item.completionPhotos.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Report Issue Button (for customers with completed pickups) */}
      {!isCollector && item.status === "completed" && (
        <View className="flex-row mt-3 pt-3 border-t border-border">
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/report-dispute", params: { pickupId: item.id } } as any)}
            className="flex-1 bg-red-50 py-3 rounded-xl flex-row items-center justify-center border border-red-200"
          >
            <MaterialIcons name="report-problem" size={18} color="#EF4444" />
            <Text className="text-red-600 font-semibold ml-2">Report Issue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Count scheduled pickups
  const scheduledCount = relevantPickups.filter(
    (p) => p.scheduledDate && p.status !== "completed"
  ).length;

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        <Text className="text-2xl font-bold text-foreground">
          {isCollector ? "Pickup Routes" : "My Pickups"}
        </Text>
        <Text className="text-base text-muted mt-1">
          {isCollector
            ? "View and manage assigned pickups"
            : "Track your garbage pickup requests"}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View className="px-6 mb-4">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {(["all", "pending", "scheduled", "completed"] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
                  filter === f ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`text-sm font-medium capitalize ${
                    filter === f ? "text-white" : "text-muted"
                  }`}
                >
                  {f}
                </Text>
                {f === "scheduled" && scheduledCount > 0 && (
                  <View
                    className={`ml-2 w-5 h-5 rounded-full items-center justify-center ${
                      filter === f ? "bg-white/20" : "bg-blue-100"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        filter === f ? "text-white" : "text-blue-600"
                      }`}
                    >
                      {scheduledCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Loading state */}
      {isLoading && pickups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <MaterialIcons name="sync" size={40} color="#9CA3AF" />
          <Text className="text-muted mt-4 text-base">Loading pickups…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-red-50 items-center justify-center mb-4">
            <MaterialIcons name="cloud-off" size={40} color="#EF4444" />
          </View>
          <Text className="text-lg font-semibold text-foreground mb-2">Connection Error</Text>
          <Text className="text-muted text-center mb-6">{error}</Text>
          <TouchableOpacity
            onPress={refreshPickups}
            className="bg-primary px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sortedPickups.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
            <MaterialIcons 
              name={filter === "scheduled" ? "event-busy" : "delete-outline"} 
              size={40} 
              color="#9CA3AF" 
            />
          </View>
          <Text className="text-lg font-semibold text-foreground mb-2">
            {filter === "scheduled" ? "No Scheduled Pickups" : "No Pickups Found"}
          </Text>
          <Text className="text-muted text-center mb-6">
            {isCollector
              ? "No pickup requests available at the moment"
              : filter === "scheduled"
              ? "You don't have any scheduled pickups"
              : "You haven't requested any pickups yet"}
          </Text>
          {!isCollector && (
            <TouchableOpacity
              onPress={() => router.push("/request-pickup" as any)}
              className="bg-primary px-6 py-3 rounded-full"
            >
              <Text className="text-white font-semibold">Request Pickup</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={sortedPickups}
          renderItem={renderPickupItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB for requesting pickup (customers only) */}
      {!isCollector && sortedPickups.length > 0 && (
        <TouchableOpacity
          onPress={() => router.push("/request-pickup" as any)}
          className="absolute bottom-24 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg"
          style={styles.fab}
        >
          <MaterialIcons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Rating Modal */}
      <RatingModal
        visible={ratingModalVisible}
        onClose={() => {
          setRatingModalVisible(false);
          setPickupToRate(null);
        }}
        onSubmit={handleSubmitRating}
        collectorName={pickupToRate?.collectorName}
        pickupAddress={pickupToRate?.location.address}
      />
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: _rs.s(4) },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  // Driver communication panel
  driverPanel: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 12,
    gap: 10,
  },
  driverPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B4332',
  },
  driverPhone: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '500',
    marginTop: 1,
  },
  driverVehicle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  driverOnlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  driverCommBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  driverCommBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
  driverCommBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
