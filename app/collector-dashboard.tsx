import { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Linking,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth, User } from "@/lib/auth-context";
import * as Haptics from "expo-haptics";
import { usePickups, Pickup } from "@/lib/pickups-context";
import { PickupCompletionModal } from "@/components/pickup-completion-modal";
import { TRANSPORT_CATEGORIES, PICKUP_STATUS } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { getStaticResponsive } from "@/hooks/use-responsive";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  withSequence,
} from "react-native-reanimated";

// Screen dimensions available if needed
const _screenWidth = Dimensions.get("window").width;

export default function CollectorDashboardScreen() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();
  const { pickups, updatePickupStatus, updatePickup } = usePickups();
  const [activeTab, setActiveTab] = useState<"pending" | "map" | "completed">("pending");
  const [availabilityStatus, setAvailabilityStatus] = useState<User["availabilityStatus"]>(user?.availabilityStatus || "offline");
  const [selectedPickup, setSelectedPickup] = useState<Pickup | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  
  // Role guard - redirect non-collectors
  useEffect(() => {
    if (user && user.role !== "collector" && user.role !== "zone_manager") {
      router.replace("/(auth)/welcome" as any);
    }
    if (!user) {
      router.replace("/(auth)/welcome" as any);
    }
  }, [user]);

  // Animation for notification pulse
  const pulseAnim = useSharedValue(1);
  
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      false
    );
  }, [pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  // Filter pickups for this collector
  const pendingPickups = pickups.filter(
    (p) => p.status === PICKUP_STATUS.PENDING || p.status === PICKUP_STATUS.ASSIGNED
  );
  const completedPickups = pickups.filter(
    (p) => p.status === PICKUP_STATUS.COMPLETED
  );

  const transportCategory = TRANSPORT_CATEGORIES.find(
    (t) => t.id === user?.transportCategory
  );

  const handleAcceptPickup = (pickup: Pickup) => {
    Alert.alert(
      "Accept Pickup",
      `Accept pickup request from ${pickup.location.address || 'Unknown location'}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: () => {
            updatePickupStatus(pickup.id, PICKUP_STATUS.ASSIGNED);
            Alert.alert("Success", "Pickup assigned to you!");
          },
        },
      ]
    );
  };

  const handleCompletePickup = (pickup: Pickup) => {
    setSelectedPickup(pickup);
    setShowCompletionModal(true);
  };

  const handleCompletionSubmit = async (notes: string, photos: string[]) => {
    if (!selectedPickup) return;
    
    await updatePickup(selectedPickup.id, {
      status: PICKUP_STATUS.COMPLETED,
      completedAt: new Date().toISOString(),
      collectorId: user?.id,
      collectorName: user?.fullName,
      completionNotes: notes || undefined,
      completionPhotos: photos.length > 0 ? photos : undefined,
    });
    
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    Alert.alert("Success", "Pickup marked as completed!");
    setSelectedPickup(null);
  };

  const openMapsNavigation = (pickup: Pickup) => {
    const { latitude, longitude } = pickup.location;
    const label = encodeURIComponent(pickup.location.address || 'Pickup Location');
    
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    });

    if (url) {
      Linking.openURL(url).catch(() => {
        // Fallback to Google Maps web
        Linking.openURL(
          `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
        );
      });
    }
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const renderPickupItem = ({ item }: { item: Pickup }) => (
    <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
      {/* Status Badge */}
      <View className="flex-row items-center justify-between mb-3">
        <View
          className={`px-3 py-1 rounded-full ${
            item.status === PICKUP_STATUS.PENDING
              ? "bg-warning/20"
              : item.status === PICKUP_STATUS.ASSIGNED
              ? "bg-primary/20"
              : "bg-success/20"
          }`}
        >
          <Text
            className={`text-xs font-semibold ${
              item.status === PICKUP_STATUS.PENDING
                ? "text-warning"
                : item.status === PICKUP_STATUS.ASSIGNED
                ? "text-primary"
                : "text-success"
            }`}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
        <Text className="text-xs text-muted">
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Location Info */}
      <View className="flex-row items-start mb-3">
        <MaterialIcons name="location-on" size={20} color="#22C55E" />
        <View className="ml-2 flex-1">
          <Text className="text-foreground font-semibold">{item.location.address || 'Unknown location'}</Text>
          <Text className="text-muted text-sm">
            {item.binType} • {item.userName}
          </Text>
        </View>
      </View>

      {/* Distance Estimate - only show for non-completed */}
      {item.status !== PICKUP_STATUS.COMPLETED && (
        <View className="flex-row items-center mb-3 bg-background rounded-lg p-2">
          <MaterialIcons name="directions" size={18} color="#6B7280" />
          <Text className="text-muted text-sm ml-2">
            Tap Navigate to get directions
          </Text>
        </View>
      )}

      {/* Rating Display for completed pickups */}
      {item.status === PICKUP_STATUS.COMPLETED && item.rating && (
        <View className="flex-row items-center mb-3 bg-yellow-50 rounded-lg p-3">
          <MaterialIcons name="star" size={18} color="#F59E0B" />
          <View className="ml-2 flex-1">
            <View className="flex-row items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <MaterialIcons
                  key={star}
                  name={star <= (item.rating || 0) ? "star" : "star-border"}
                  size={16}
                  color={star <= (item.rating || 0) ? "#F59E0B" : "#D1D5DB"}
                />
              ))}
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

      {/* Awaiting Rating for completed pickups without rating */}
      {item.status === PICKUP_STATUS.COMPLETED && !item.rating && (
        <View className="flex-row items-center mb-3 bg-gray-50 rounded-lg p-3">
          <MaterialIcons name="star-border" size={18} color="#9CA3AF" />
          <Text className="text-muted text-sm ml-2">
            Awaiting customer rating
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        {item.status === PICKUP_STATUS.PENDING && (
          <TouchableOpacity
            onPress={() => handleAcceptPickup(item)}
            className="flex-1 bg-primary py-3 rounded-xl flex-row items-center justify-center"
          >
            <MaterialIcons name="check" size={18} color="#fff" />
            <Text className="text-white font-semibold ml-2">Accept</Text>
          </TouchableOpacity>
        )}

        {item.status === PICKUP_STATUS.ASSIGNED && (
          <>
            <TouchableOpacity
              onPress={() => openMapsNavigation(item)}
              className="flex-1 bg-primary py-3 rounded-xl flex-row items-center justify-center"
            >
              <MaterialIcons name="navigation" size={18} color="#fff" />
              <Text className="text-white font-semibold ml-2">Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCompletePickup(item)}
              className="flex-1 bg-success py-3 rounded-xl flex-row items-center justify-center"
            >
              <MaterialIcons name="done-all" size={18} color="#fff" />
              <Text className="text-white font-semibold ml-2">Complete</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          onPress={() => callCustomer(item.userPhone || "0960819993")}
          className="bg-surface border border-border py-3 px-4 rounded-xl"
        >
          <MaterialIcons name="phone" size={18} color="#22C55E" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMapView = () => (
    <View className="flex-1">
      {/* Map Placeholder */}
      <View className="flex-1 bg-surface rounded-2xl overflow-hidden border border-border">
        <View className="flex-1 bg-primary/5 items-center justify-center p-4">
          <MaterialIcons name="map" size={64} color="#22C55E" />
          <Text className="text-foreground font-semibold text-lg mt-4 text-center">
            Live Map View
          </Text>
          <Text className="text-muted text-center mt-2">
            {pendingPickups.length} pickup locations pinned
          </Text>

          {/* Pickup Location Cards */}
          <View className="w-full mt-6">
            {pendingPickups.slice(0, 3).map((pickup, index) => (
              <TouchableOpacity
                key={pickup.id}
                onPress={() => openMapsNavigation(pickup)}
                className="bg-background rounded-xl p-3 mb-2 flex-row items-center"
              >
                <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                  <Text className="text-white font-bold">{index + 1}</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-medium" numberOfLines={1}>
                    {pickup.location.address || 'Unknown location'}
                  </Text>
                  <Text className="text-muted text-xs">{pickup.binType}</Text>
                </View>
                <MaterialIcons name="navigation" size={20} color="#22C55E" />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => {
              if (pendingPickups.length > 0) {
                openMapsNavigation(pendingPickups[0]);
              }
            }}
            className="bg-primary px-6 py-3 rounded-full mt-4 flex-row items-center"
          >
            <MaterialIcons name="directions" size={20} color="#fff" />
            <Text className="text-white font-semibold ml-2">
              Open in Google Maps
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="px-4 pt-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-foreground">Collector Dashboard</Text>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.push("/collector-earnings" as any)}
            style={styles.earningsButton}
          >
            <MaterialIcons name="account-balance-wallet" size={24} color="#22C55E" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Logout",
                "Are you sure you want to logout?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                      await logout();
                      router.replace("/(auth)/welcome" as any);
                    },
                  },
                ]
              );
            }}
            style={[styles.backButton, { marginLeft: 8, backgroundColor: "#FEE2E2" }]}
          >
            <MaterialIcons name="logout" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collector Info Card */}
      <View className="bg-primary rounded-2xl p-4 mb-4">
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-white/20 items-center justify-center">
            <MaterialIcons 
              name={transportCategory?.requiresVehicle ? "local-shipping" : "directions-walk"} 
              size={28} 
              color="#fff" 
            />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-white font-bold text-lg">{user?.fullName}</Text>
            <Text className="text-white/80 text-sm">
              {transportCategory?.name || "Collector"}
            </Text>
            {user?.vehicleRegistration && (
              <Text className="text-white/70 text-xs mt-1">
                Vehicle: {user.vehicleRegistration}
              </Text>
            )}
          </View>
          {/* Notification Badge */}
          {pendingPickups.length > 0 && (
            <Animated.View style={pulseStyle}>
              <View className="bg-error rounded-full w-10 h-10 items-center justify-center">
                <Text className="text-white font-bold">{pendingPickups.length}</Text>
              </View>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Availability Status Toggle */}
      <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View 
              className={`w-3 h-3 rounded-full mr-2 ${
                availabilityStatus === "online" ? "bg-success" :
                availabilityStatus === "busy" ? "bg-warning" : "bg-muted"
              }`}
            />
            <Text className="text-foreground font-medium">Availability Status</Text>
          </View>
          <View className="flex-row bg-background rounded-xl p-1">
            {(["offline", "online", "busy"] as const).map((status) => (
              <TouchableOpacity
                key={status}
                onPress={async () => {
                  setAvailabilityStatus(status);
                  await updateUser({ availabilityStatus: status });
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                className={`px-3 py-2 rounded-lg ${
                  availabilityStatus === status 
                    ? status === "online" ? "bg-success" 
                    : status === "busy" ? "bg-warning" 
                    : "bg-muted"
                    : ""
                }`}
              >
                <Text 
                  className={`text-xs font-semibold capitalize ${
                    availabilityStatus === status ? "text-white" : "text-muted"
                  }`}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <Text className="text-muted text-xs mt-2">
          {availabilityStatus === "online" 
            ? "You are visible to customers and can receive pickup requests"
            : availabilityStatus === "busy"
            ? "You are marked as busy - customers will see longer wait times"
            : "You are offline - customers cannot see you for pickups"
          }
        </Text>
      </View>

      {/* Stats Row */}
      <View className="flex-row mb-4">
        <View className="flex-1 bg-surface rounded-xl p-3 mr-2 border border-border">
          <View className="flex-row items-center">
            <MaterialIcons name="pending-actions" size={24} color="#F59E0B" />
            <View className="ml-2">
              <Text className="text-2xl font-bold text-foreground">{pendingPickups.length}</Text>
              <Text className="text-xs text-muted">Pending</Text>
            </View>
          </View>
        </View>
        <View className="flex-1 bg-surface rounded-xl p-3 ml-2 border border-border">
          <View className="flex-row items-center">
            <MaterialIcons name="check-circle" size={24} color="#22C55E" />
            <View className="ml-2">
              <Text className="text-2xl font-bold text-foreground">{completedPickups.length}</Text>
              <Text className="text-xs text-muted">Completed</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tab Switcher */}
      <View className="flex-row bg-surface rounded-xl p-1 mb-4 border border-border">
        {[
          { id: "pending", label: "Pickups", icon: "list" },
          { id: "map", label: "Map", icon: "map" },
          { id: "completed", label: "History", icon: "history" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 rounded-lg flex-row items-center justify-center ${
              activeTab === tab.id ? "bg-primary" : ""
            }`}
          >
            <MaterialIcons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.id ? "#fff" : "#6B7280"}
            />
            <Text
              className={`ml-2 font-medium ${
                activeTab === tab.id ? "text-white" : "text-muted"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === "pending" && (
        <FlatList
          data={pendingPickups}
          renderItem={renderPickupItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center py-12">
              <MaterialIcons name="inbox" size={48} color="#9CA3AF" />
              <Text className="text-muted text-center mt-4">
                No pending pickups at the moment
              </Text>
              <Text className="text-muted text-center text-sm mt-1">
                New pickup requests will appear here
              </Text>
            </View>
          }
        />
      )}

      {activeTab === "map" && renderMapView()}

      {activeTab === "completed" && (
        <FlatList
          data={completedPickups}
          renderItem={renderPickupItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center py-12">
              <MaterialIcons name="history" size={48} color="#9CA3AF" />
              <Text className="text-muted text-center mt-4">
                No completed pickups yet
              </Text>
            </View>
          }
        />
      )}

      {/* Pickup Completion Modal */}
      <PickupCompletionModal
        visible={showCompletionModal}
        onClose={() => {
          setShowCompletionModal(false);
          setSelectedPickup(null);
        }}
        onComplete={handleCompletionSubmit}
        pickupAddress={selectedPickup?.location.address}
      />
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  earningsButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
});
