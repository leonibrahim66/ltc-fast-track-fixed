import React, { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Linking,
  Platform,
  Dimensions,
  Animated,
  ScrollView,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { CustomerBooking } from "@/types/booking";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Default Lusaka coordinates
const DEFAULT_CENTER = { lat: -15.4167, lng: 28.2833 };

// Vehicle pricing (same as Book a Carrier)
const VEHICLE_TYPES = [
  { key: "motorbike", label: "Motorbike", baseRate: 25, perKmRate: 2 },
  { key: "van", label: "Van", baseRate: 75, perKmRate: 5 },
  { key: "pickup", label: "Pickup", baseRate: 100, perKmRate: 7 },
  { key: "truck", label: "Truck", baseRate: 200, perKmRate: 12 },
  { key: "trailer", label: "Trailer", baseRate: 350, perKmRate: 20 },
];

// Simulate driver movement along a path
function simulateDriverPosition(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  progress: number
): { lat: number; lng: number } {
  // progress goes from 0 (at pickup) to 1 (at dropoff)
  return {
    lat: pickup.lat + (dropoff.lat - pickup.lat) * progress,
    lng: pickup.lng + (dropoff.lng - pickup.lng) * progress,
  };
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate price based on distance and vehicle type
function calculatePrice(distanceKm: number, vehicleType: string): number {
  const vehicle = VEHICLE_TYPES.find((v) => v.key === vehicleType.toLowerCase()) || VEHICLE_TYPES[1]; // Default to Van
  return vehicle.baseRate + vehicle.perKmRate * distanceKm;
}

// Calculate estimated delivery time based on distance and vehicle type
function calculateDeliveryTime(distanceKm: number, vehicleType: string): { min: number; max: number } {
  // Average speeds in km/h for different vehicle types
  const speeds: Record<string, number> = {
    motorbike: 45,
    van: 40,
    pickup: 35,
    truck: 30,
    trailer: 25,
  };
  
  const avgSpeed = speeds[vehicleType.toLowerCase()] || 40; // Default to van speed
  const baseTimeHours = distanceKm / avgSpeed;
  const baseTimeMinutes = baseTimeHours * 60;
  
  // Add buffer for stops, traffic, etc. (±20%)
  const minTime = Math.round(baseTimeMinutes * 0.8);
  const maxTime = Math.round(baseTimeMinutes * 1.2);
  
  return { min: minTime, max: maxTime };
}

// Format delivery time for display
function formatDeliveryTime(min: number, max: number): string {
  if (min < 60 && max < 60) {
    return `${min}-${max} min`;
  } else if (min >= 60 && max < 120) {
    const minHours = Math.floor(min / 60);
    const maxMinutes = max % 60;
    return `${minHours} hr ${maxMinutes > 0 ? `${maxMinutes} min` : ""} - ${Math.ceil(max / 60)} hr`;
  } else {
    const minHours = Math.floor(min / 60);
    const maxHours = Math.ceil(max / 60);
    return `${minHours}-${maxHours} hrs`;
  }
}

// Estimate distance based on route complexity (deterministic approximation)
function simulateDistanceCalculation(
  pickup: string,
  dropoff: string,
  stops: string[]
): Promise<number> {
  return new Promise((resolve) => {
    // Deterministic estimate based on address string lengths as a proxy for route complexity
    const baseDistance = 25 + (pickup.length + dropoff.length) % 30;
    const stopDistance = stops.length * 7;
    const totalDistance = baseDistance + stopDistance;
    resolve(Math.round(totalDistance * 10) / 10);
  });
}

export default function TrackShipmentScreen() {
  const router = useRouter();
  const [activeBooking, setActiveBooking] = useState<CustomerBooking | null>(null);
  const [driverProgress, setDriverProgress] = useState(0.3); // 0 to 1
  const [bottomSheetHeight] = useState(new Animated.Value(180));
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);

  // Route modification state
  const [isModifying, setIsModifying] = useState(false);
  const [newDestination, setNewDestination] = useState("");
  const [additionalStops, setAdditionalStops] = useState<string[]>([]);
  const [newStopInput, setNewStopInput] = useState("");
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [newDistance, setNewDistance] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const loadActiveBooking = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("customer_bookings");
      if (stored) {
        const bookings: CustomerBooking[] = JSON.parse(stored);
        // Find the first accepted or active booking
        const active = bookings.find((b) => b.status === "accepted" || b.status === "pending");
        setActiveBooking(active || null);
      }
    } catch (error) {
      console.error("Error loading active booking:", error);
    }
  }, []);

  useEffect(() => {
    loadActiveBooking();
    // Refresh every 5 seconds
    const interval = setInterval(loadActiveBooking, 5000);
    return () => clearInterval(interval);
  }, [loadActiveBooking]);

  // Animate driver movement
  useEffect(() => {
    if (!activeBooking || activeBooking.status !== "accepted") return;

    const interval = setInterval(() => {
      setDriverProgress((prev) => {
        const next = prev + 0.01;
        return next >= 1 ? 0.3 : next; // Loop back to 30% when reaching destination
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBooking]);

  // Calculate distance and price when route changes
  useEffect(() => {
    if (!isModifying || !activeBooking) return;

    const destination = newDestination || activeBooking.dropoffLocation;
    const pickup = activeBooking.pickupLocation;

    if (destination.length > 3 && pickup.length > 3) {
      setCalculatingDistance(true);
      simulateDistanceCalculation(pickup, destination, additionalStops).then((distance) => {
        setNewDistance(distance);
        const price = calculatePrice(distance, activeBooking.vehicleType || "Van");
        setNewPrice(Math.round(price * 100) / 100);
        setCalculatingDistance(false);
      });
    }
  }, [newDestination, additionalStops, isModifying, activeBooking]);

  const toggleBottomSheet = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const toValue = isBottomSheetExpanded ? 180 : 320;
    Animated.spring(bottomSheetHeight, {
      toValue,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
    setIsBottomSheetExpanded(!isBottomSheetExpanded);
  };

  const handleChat = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Navigate to chat screen with driver
    // TODO: Implement chat screen navigation when chat route is available
    console.log("Chat with driver:", activeBooking?.driverName);
  };

  const handleCall = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    if (activeBooking?.driverPhone) {
      const url = `tel:${activeBooking.driverPhone}`;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    }
  };

  const handleStartModifying = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsModifying(true);
    setNewDestination("");
    setAdditionalStops([]);
    setNewStopInput("");
    setNewDistance(null);
    setNewPrice(null);
  };

  const handleCancelModifying = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsModifying(false);
    setNewDestination("");
    setAdditionalStops([]);
    setNewStopInput("");
    setNewDistance(null);
    setNewPrice(null);
  };

  const handleAddStop = () => {
    if (newStopInput.trim().length > 3) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setAdditionalStops([...additionalStops, newStopInput.trim()]);
      setNewStopInput("");
    }
  };

  const handleRemoveStop = (index: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setAdditionalStops(additionalStops.filter((_, i) => i !== index));
  };

  const handlePreviewChanges = () => {
    if (!newDistance || !newPrice || calculatingDistance) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmChanges = async () => {
    if (!activeBooking || !newDistance || !newPrice) return;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    try {
      // Update booking with new route
      const stored = await AsyncStorage.getItem("customer_bookings");
      if (stored) {
        const bookings: CustomerBooking[] = JSON.parse(stored);
        const updatedBookings = bookings.map((b) => {
          if (b.bookingId === activeBooking.bookingId) {
            return {
              ...b,
              dropoffLocation: newDestination || b.dropoffLocation,
              additionalStops: additionalStops.length > 0 ? additionalStops : undefined,
              distance: `${newDistance} km`,
              totalAmount: newPrice,
            };
          }
          return b;
        });
        await AsyncStorage.setItem("customer_bookings", JSON.stringify(updatedBookings));

        // Send notification to driver
        const notificationMessage = `Route updated by customer!\n\nBooking ID: ${activeBooking.bookingId}\nNew Destination: ${newDestination || activeBooking.dropoffLocation}${additionalStops.length > 0 ? `\nStops: ${additionalStops.join(", ")}` : ""}\nNew Distance: ${newDistance} km\nUpdated Price: K${newPrice.toFixed(2)}`;

        console.log("Driver notification:", notificationMessage);

        // Show success alert
        Alert.alert(
          "Route Updated",
          `Your route has been updated successfully.\n\nNew Distance: ${newDistance} km\nUpdated Price: K${newPrice.toFixed(2)}\n\nThe driver has been notified.`,
          [{ text: "OK" }]
        );

        // Reset modification state
        setIsModifying(false);
        setShowConfirmDialog(false);
        setNewDestination("");
        setAdditionalStops([]);
        setNewDistance(null);
        setNewPrice(null);

        // Reload booking
        await loadActiveBooking();
      }
    } catch (error) {
      console.error("Error updating route:", error);
      Alert.alert("Error", "Failed to update route. Please try again.");
    }
  };

  // No active booking state
  if (!activeBooking) {
    return (
      <ScreenContainer className="bg-background">
        <View className="px-4 py-3 border-b border-border">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
          >
            <MaterialIcons name="arrow-back" size={20} color="#687076" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center p-8">
          <MaterialIcons name="location-off" size={80} color="#9BA1A6" />
          <Text className="text-2xl font-bold text-foreground mt-6">No Active Delivery</Text>
          <Text className="text-base text-muted text-center mt-3">
            No active delivery to track at the moment.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/carrier/my-bookings")}
            style={{ backgroundColor: "#0a7ea4", marginTop: 24 }}
            className="px-6 py-3 rounded-xl"
          >
            <Text className="text-white text-sm font-semibold">View My Bookings</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // Calculate coordinates
  const pickup = {
    lat: DEFAULT_CENTER.lat + 0.012,
    lng: DEFAULT_CENTER.lng + 0.008,
  };
  const dropoff = {
    lat: DEFAULT_CENTER.lat - 0.018,
    lng: DEFAULT_CENTER.lng + 0.032,
  };
  const driver = simulateDriverPosition(pickup, dropoff, driverProgress);

  // Calculate relative positions for markers on the map view
  const allLats = [pickup.lat, dropoff.lat, driver.lat];
  const allLngs = [pickup.lng, dropoff.lng, driver.lng];
  const minLat = Math.min(...allLats) - 0.005;
  const maxLat = Math.max(...allLats) + 0.005;
  const minLng = Math.min(...allLngs) - 0.008;
  const maxLng = Math.max(...allLngs) + 0.008;

  const latRange = maxLat - minLat || 0.02;
  const lngRange = maxLng - minLng || 0.02;

  const toX = (lng: number) => ((lng - minLng) / lngRange) * 100;
  const toY = (lat: number) => ((maxLat - lat) / latRange) * 100;

  const pickupX = toX(pickup.lng);
  const pickupY = toY(pickup.lat);
  const dropoffX = toX(dropoff.lng);
  const dropoffY = toY(dropoff.lat);
  const driverX = toX(driver.lng);
  const driverY = toY(driver.lat);

  // Extract original price from booking
  const originalPrice = activeBooking.totalAmount || 0;
  const originalDistance = parseFloat(activeBooking.distance?.replace(" km", "") || "0");

  return (
    <ScreenContainer edges={["top"]} className="bg-background">
      {/* Full-Screen Map */}
      <View style={{ flex: 1, position: "relative" }}>
        {/* Map Background */}
        <View
          style={{
            flex: 1,
            backgroundColor: "#1a2332",
            position: "relative",
          }}
        >
          {/* Grid lines for map feel */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <View
              key={`h${i}`}
              style={{
                position: "absolute",
                top: `${i * 12.5}%`,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: "rgba(255,255,255,0.03)",
              }}
            />
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <View
              key={`v${i}`}
              style={{
                position: "absolute",
                left: `${i * 12.5}%`,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: "rgba(255,255,255,0.03)",
              }}
            />
          ))}

          {/* Route Path */}
          <View
            style={{
              position: "absolute",
              left: `${pickupX}%`,
              top: `${pickupY}%`,
              width: `${Math.abs(dropoffX - pickupX)}%`,
              height: `${Math.abs(dropoffY - pickupY)}%`,
              borderWidth: 2,
              borderColor: "#3B82F6",
              borderStyle: "dashed",
              borderRadius: 8,
              opacity: 0.6,
            }}
          />

          {/* Pickup Marker (Green) */}
          <View
            style={{
              position: "absolute",
              left: `${pickupX}%`,
              top: `${pickupY}%`,
              transform: [{ translateX: -20 }, { translateY: -40 }],
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#22C55E",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 3,
                borderColor: "#fff",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <MaterialIcons name="location-on" size={24} color="#fff" />
            </View>
            <View
              style={{
                marginTop: 4,
                backgroundColor: "#22C55E",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#fff",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>Pickup</Text>
            </View>
          </View>

          {/* Dropoff Marker (Red) */}
          <View
            style={{
              position: "absolute",
              left: `${dropoffX}%`,
              top: `${dropoffY}%`,
              transform: [{ translateX: -20 }, { translateY: -40 }],
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#EF4444",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 3,
                borderColor: "#fff",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}
            >
              <MaterialIcons name="flag" size={24} color="#fff" />
            </View>
            <View
              style={{
                marginTop: 4,
                backgroundColor: "#EF4444",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: "#fff",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>Destination</Text>
            </View>
          </View>

          {/* Driver Marker (Blue, animated) */}
          {activeBooking.status === "accepted" && (
            <View
              style={{
                position: "absolute",
                left: `${driverX}%`,
                top: `${driverY}%`,
                transform: [{ translateX: -24 }, { translateY: -24 }],
                alignItems: "center",
              }}
            >
              {/* Pulsing ring */}
              <View
                style={{
                  position: "absolute",
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: "rgba(59, 130, 246, 0.2)",
                  top: -6,
                  left: -6,
                }}
              />
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "#3B82F6",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 4,
                  borderColor: "#fff",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.4,
                  shadowRadius: 6,
                  elevation: 8,
                }}
              >
                <MaterialIcons name="local-shipping" size={28} color="#fff" />
              </View>
            </View>
          )}
        </View>

        {/* Back Button Overlay */}
        <View
          style={{
            position: "absolute",
            top: 16,
            left: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#11181C" />
          </TouchableOpacity>
        </View>

        {/* Live Indicator */}
        {activeBooking.status === "accepted" && (
          <View
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              backgroundColor: "#22C55E",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              flexDirection: "row",
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#fff",
                marginRight: 6,
              }}
            />
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>LIVE</Text>
          </View>
        )}

        {/* Change Destination / Add Stop Button (only for accepted bookings) */}
        {activeBooking.status === "accepted" && !isModifying && (
          <View
            style={{
              position: "absolute",
              top: 76,
              left: 16,
              right: 16,
            }}
          >
            <TouchableOpacity
              onPress={handleStartModifying}
              style={{
                backgroundColor: "#fff",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <MaterialIcons name="edit-location" size={20} color="#0a7ea4" />
              <Text style={{ color: "#0a7ea4", fontSize: 14, fontWeight: "600", marginLeft: 8, flex: 1 }}>
                Change Destination / Add Stop
              </Text>
              <MaterialIcons name="chevron-right" size={20} color="#0a7ea4" />
            </TouchableOpacity>
          </View>
        )}

        {/* Route Modification Panel (when modifying) */}
        {isModifying && (
          <View
            style={{
              position: "absolute",
              top: 76,
              left: 16,
              right: 16,
              backgroundColor: "#fff",
              borderRadius: 16,
              padding: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 8,
              maxHeight: SCREEN_HEIGHT * 0.5,
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                <MaterialIcons name="edit-location" size={24} color="#0a7ea4" />
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#11181C", marginLeft: 8, flex: 1 }}>
                  Modify Route
                </Text>
                <TouchableOpacity onPress={handleCancelModifying}>
                  <MaterialIcons name="close" size={24} color="#687076" />
                </TouchableOpacity>
              </View>

              {/* New Destination Input */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>
                  New Destination (optional)
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#F5F5F5",
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: newDestination ? "#0a7ea4" : "#E5E7EB",
                  }}
                >
                  <MaterialIcons name="place" size={20} color="#687076" />
                  <TextInput
                    value={newDestination}
                    onChangeText={setNewDestination}
                    placeholder={activeBooking.dropoffLocation}
                    placeholderTextColor="#9BA1A6"
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      fontSize: 14,
                      color: "#11181C",
                    }}
                  />
                </View>
              </View>

              {/* Additional Stops */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>
                  Additional Stops
                </Text>
                {additionalStops.map((stop, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#F0F9FF",
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: "#0a7ea4",
                    }}
                  >
                    <MaterialIcons name="add-location" size={18} color="#0a7ea4" />
                    <Text style={{ flex: 1, marginLeft: 8, fontSize: 14, color: "#11181C" }}>
                      {stop}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveStop(index)}>
                      <MaterialIcons name="close" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add Stop Input */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#F5F5F5",
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                  }}
                >
                  <MaterialIcons name="add-location" size={20} color="#687076" />
                  <TextInput
                    value={newStopInput}
                    onChangeText={setNewStopInput}
                    placeholder="Add a stop"
                    placeholderTextColor="#9BA1A6"
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 8,
                      fontSize: 14,
                      color: "#11181C",
                    }}
                    onSubmitEditing={handleAddStop}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={handleAddStop}
                    disabled={newStopInput.trim().length <= 3}
                    style={{
                      opacity: newStopInput.trim().length > 3 ? 1 : 0.4,
                    }}
                  >
                    <MaterialIcons name="add-circle" size={24} color="#0a7ea4" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Route Preview Map */}
              {(newDestination || additionalStops.length > 0) && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: "#687076", marginBottom: 6 }}>
                    Route Preview
                  </Text>
                  <View
                    style={{
                      height: 180,
                      backgroundColor: "#1a2332",
                      borderRadius: 12,
                      overflow: "hidden",
                      position: "relative",
                      borderWidth: 1,
                      borderColor: "#0a7ea4",
                    }}
                  >
                    {/* Grid lines for map feel */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <View
                        key={`h${i}`}
                        style={{
                          position: "absolute",
                          top: `${i * 25}%`,
                          left: 0,
                          right: 0,
                          height: 1,
                          backgroundColor: "rgba(255,255,255,0.03)",
                        }}
                      />
                    ))}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <View
                        key={`v${i}`}
                        style={{
                          position: "absolute",
                          left: `${i * 25}%`,
                          top: 0,
                          bottom: 0,
                          width: 1,
                          backgroundColor: "rgba(255,255,255,0.03)",
                        }}
                      />
                    ))}

                    {/* Pickup Marker */}
                    <View
                      style={{
                        position: "absolute",
                        left: "20%",
                        top: "70%",
                        transform: [{ translateX: -12 }, { translateY: -24 }],
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: "#22C55E",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 2,
                          borderColor: "#fff",
                        }}
                      >
                        <MaterialIcons name="location-on" size={16} color="#fff" />
                      </View>
                      <View
                        style={{
                          marginTop: 2,
                          backgroundColor: "#22C55E",
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 8, fontWeight: "600" }}>Pickup</Text>
                      </View>
                    </View>

                    {/* Stop Markers */}
                    {additionalStops.map((stop, index) => {
                      const leftPercent = 30 + index * 15;
                      const topPercent = 50 - index * 10;
                      return (
                        <View
                          key={index}
                          style={{
                            position: "absolute",
                            left: `${leftPercent}%`,
                            top: `${topPercent}%`,
                            transform: [{ translateX: -10 }, { translateY: -20 }],
                            alignItems: "center",
                          }}
                        >
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              backgroundColor: "#0a7ea4",
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 2,
                              borderColor: "#fff",
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                              {index + 1}
                            </Text>
                          </View>
                          <View
                            style={{
                              marginTop: 2,
                              backgroundColor: "#0a7ea4",
                              paddingHorizontal: 4,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ color: "#fff", fontSize: 7, fontWeight: "600" }}>Stop {index + 1}</Text>
                          </View>
                        </View>
                      );
                    })}

                    {/* Destination Marker */}
                    <View
                      style={{
                        position: "absolute",
                        left: "75%",
                        top: "25%",
                        transform: [{ translateX: -12 }, { translateY: -24 }],
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: "#EF4444",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 2,
                          borderColor: "#fff",
                        }}
                      >
                        <MaterialIcons name="flag" size={16} color="#fff" />
                      </View>
                      <View
                        style={{
                          marginTop: 2,
                          backgroundColor: "#EF4444",
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 8, fontWeight: "600" }}>Destination</Text>
                      </View>
                    </View>

                    {/* Route Path */}
                    <View
                      style={{
                        position: "absolute",
                        left: "20%",
                        top: "70%",
                        width: "55%",
                        height: "45%",
                        borderWidth: 2,
                        borderColor: "#3B82F6",
                        borderStyle: "dashed",
                        borderRadius: 8,
                        opacity: 0.6,
                      }}
                    />
                  </View>
                </View>
              )}

              {/* Distance & Price Preview */}
              {calculatingDistance && (
                <View
                  style={{
                    backgroundColor: "#FEF3C7",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 16,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <MaterialIcons name="hourglass-empty" size={20} color="#92400E" />
                  <Text style={{ color: "#92400E", fontSize: 12, marginLeft: 8 }}>
                    Calculating distance and price...
                  </Text>
                </View>
              )}

              {!calculatingDistance && newDistance && newPrice && (
                <View
                  style={{
                    backgroundColor: "#F0F9FF",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "#0a7ea4",
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: "#687076" }}>New Distance</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#0a7ea4" }}>
                      {newDistance} km
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: "#687076" }}>Original Price</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#687076" }}>
                      K{originalPrice.toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12, color: "#687076" }}>New Price</Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: newPrice > originalPrice ? "#EF4444" : "#22C55E",
                      }}
                    >
                      K{newPrice.toFixed(2)}
                    </Text>
                  </View>
                  {newPrice !== originalPrice && (
                    <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: newPrice > originalPrice ? "#EF4444" : "#22C55E",
                        }}
                      >
                        {newPrice > originalPrice ? "+" : ""}K
                        {(newPrice - originalPrice).toFixed(2)} price change
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Preview Button */}
              <TouchableOpacity
                onPress={handlePreviewChanges}
                disabled={!newDistance || !newPrice || calculatingDistance}
                style={{
                  backgroundColor: !newDistance || !newPrice || calculatingDistance ? "#E5E7EB" : "#0a7ea4",
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: !newDistance || !newPrice || calculatingDistance ? "#9BA1A6" : "#fff",
                    fontSize: 14,
                    fontWeight: "700",
                  }}
                >
                  {calculatingDistance ? "Calculating..." : "Preview Changes"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Bottom Sheet */}
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: bottomSheetHeight,
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 12,
          }}
        >
          {/* Drag Handle */}
          <TouchableOpacity
            onPress={toggleBottomSheet}
            style={{
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#D1D5DB",
              }}
            />
          </TouchableOpacity>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {/* Booking ID */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: "#687076", marginBottom: 4 }}>Booking ID</Text>
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#11181C" }}>
                {activeBooking.bookingId}
              </Text>
            </View>

            {/* Delivery Time Estimate */}
            {activeBooking.distance && activeBooking.vehicleType && (
              <View
                style={{
                  backgroundColor: "#F0F9FF",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: "#0a7ea4",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                  <MaterialIcons name="schedule" size={20} color="#0a7ea4" />
                  <Text style={{ fontSize: 12, color: "#687076", marginLeft: 6 }}>Estimated Delivery Time</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#0a7ea4" }}>
                  {(() => {
                    const distanceKm = parseFloat(activeBooking.distance);
                    const time = calculateDeliveryTime(distanceKm, activeBooking.vehicleType);
                    return formatDeliveryTime(time.min, time.max);
                  })()}
                </Text>
                <Text style={{ fontSize: 11, color: "#687076", marginTop: 4 }}>
                  Based on {activeBooking.distance} km distance
                </Text>
              </View>
            )}

            {/* Driver Info (only if accepted) */}
            {activeBooking.status === "accepted" && activeBooking.driverName && (
              <>
                <View
                  style={{
                    backgroundColor: "#F5F5F5",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: "#0a7ea4",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <MaterialIcons name="person" size={28} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: "#11181C" }}>
                        {activeBooking.driverName}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#687076", marginTop: 2 }}>
                        Your Driver
                      </Text>
                    </View>
                  </View>

                  {/* Vehicle Details */}
                  {activeBooking.vehicleType && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, color: "#687076" }}>Vehicle Type</Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>
                          {activeBooking.vehicleType}
                        </Text>
                      </View>
                      {activeBooking.vehicleColor && (
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                          <Text style={{ fontSize: 12, color: "#687076" }}>Color</Text>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>
                            {activeBooking.vehicleColor}
                          </Text>
                        </View>
                      )}
                      {activeBooking.vehiclePlate && (
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ fontSize: 12, color: "#687076" }}>Plate Number</Text>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color: "#11181C",
                              fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                            }}
                          >
                            {activeBooking.vehiclePlate}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Chat & Call Actions */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity
                    onPress={handleChat}
                    style={{
                      flex: 1,
                      backgroundColor: "#0a7ea4",
                      paddingVertical: 14,
                      borderRadius: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialIcons name="chat" size={20} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600", marginLeft: 8 }}>
                      Chat
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleCall}
                    style={{
                      flex: 1,
                      backgroundColor: "#22C55E",
                      paddingVertical: 14,
                      borderRadius: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialIcons name="phone" size={20} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600", marginLeft: 8 }}>
                      Call
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Pending state (no driver assigned yet) */}
            {activeBooking.status === "pending" && (
              <View
                style={{
                  backgroundColor: "#FEF3C7",
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <MaterialIcons name="hourglass-empty" size={32} color="#92400E" />
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#92400E", marginTop: 8 }}>
                  Waiting for Driver
                </Text>
                <Text style={{ fontSize: 12, color: "#92400E", marginTop: 4, textAlign: "center" }}>
                  Your booking is pending. A driver will be assigned soon.
                </Text>
              </View>
            )}

            {/* Locations */}
            <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
              <View style={{ flexDirection: "row", marginBottom: 12 }}>
                <View style={{ width: 32, alignItems: "center", paddingTop: 2 }}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: "#22C55E",
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: "#687076", marginBottom: 2 }}>Pickup</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>
                    {activeBooking.pickupLocation}
                  </Text>
                </View>
              </View>

              {/* Additional Stops */}
              {activeBooking.additionalStops && activeBooking.additionalStops.length > 0 && (
                <>
                  {activeBooking.additionalStops.map((stop, index) => (
                    <React.Fragment key={index}>
                      <View style={{ width: 32, alignItems: "center", height: 16 }}>
                        <View
                          style={{
                            width: 2,
                            height: 16,
                            backgroundColor: "#D1D5DB",
                          }}
                        />
                      </View>
                      <View style={{ flexDirection: "row", marginBottom: 12 }}>
                        <View style={{ width: 32, alignItems: "center", paddingTop: 2 }}>
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: "#0a7ea4",
                            }}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: "#687076", marginBottom: 2 }}>
                            Stop {index + 1}
                          </Text>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>
                            {stop}
                          </Text>
                        </View>
                      </View>
                    </React.Fragment>
                  ))}
                </>
              )}

              <View style={{ width: 32, alignItems: "center", height: 16 }}>
                <View
                  style={{
                    width: 2,
                    height: 16,
                    backgroundColor: "#D1D5DB",
                  }}
                />
              </View>

              <View style={{ flexDirection: "row" }}>
                <View style={{ width: 32, alignItems: "center", paddingTop: 2 }}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: "#EF4444",
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: "#687076", marginBottom: 2 }}>Drop-off</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>
                    {activeBooking.dropoffLocation}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>

      {/* Confirmation Dialog */}
      <Modal
        visible={showConfirmDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmDialog(false)}
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
                  backgroundColor: "#F0F9FF",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <MaterialIcons name="info" size={32} color="#0a7ea4" />
              </View>
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#11181C", marginBottom: 8 }}>
                Confirm Route Change
              </Text>
              <Text style={{ fontSize: 14, color: "#687076", textAlign: "center" }}>
                Please review the changes before confirming
              </Text>
            </View>

            {/* Changes Summary */}
            <View
              style={{
                backgroundColor: "#F5F5F5",
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}
            >
              {newDestination && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: "#687076", marginBottom: 4 }}>New Destination</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>
                    {newDestination}
                  </Text>
                </View>
              )}

              {additionalStops.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: "#687076", marginBottom: 4 }}>Additional Stops</Text>
                  {additionalStops.map((stop, index) => (
                    <Text key={index} style={{ fontSize: 14, fontWeight: "600", color: "#11181C", marginBottom: 4 }}>
                      • {stop}
                    </Text>
                  ))}
                </View>
              )}

              <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: "#687076" }}>Original Distance</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#687076" }}>
                    {originalDistance} km
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, color: "#687076" }}>New Distance</Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#0a7ea4" }}>
                    {newDistance} km
                  </Text>
                </View>
                <View style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ fontSize: 12, color: "#687076" }}>Original Price</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#687076" }}>
                      K{originalPrice.toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#11181C" }}>New Price</Text>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "700",
                        color: newPrice && newPrice > originalPrice ? "#EF4444" : "#22C55E",
                      }}
                    >
                      K{newPrice?.toFixed(2)}
                    </Text>
                  </View>
                  {newPrice && newPrice !== originalPrice && (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: newPrice > originalPrice ? "#EF4444" : "#22C55E",
                        marginTop: 4,
                        textAlign: "right",
                      }}
                    >
                      {newPrice > originalPrice ? "+" : ""}K
                      {(newPrice - originalPrice).toFixed(2)}
                    </Text>
                  )}
                </View>

                {/* Delivery Time Estimate */}
                {newDistance && activeBooking?.vehicleType && (
                  <View style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <MaterialIcons name="schedule" size={16} color="#0a7ea4" />
                      <Text style={{ fontSize: 12, color: "#687076", marginLeft: 4 }}>Estimated Delivery Time</Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#0a7ea4" }}>
                      {(() => {
                        const time = calculateDeliveryTime(newDistance, activeBooking.vehicleType);
                        return formatDeliveryTime(time.min, time.max);
                      })()}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Disclaimer */}
            <View
              style={{
                backgroundColor: "#FEF3C7",
                borderRadius: 12,
                padding: 12,
                marginBottom: 20,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <MaterialIcons name="info" size={16} color="#92400E" style={{ marginTop: 2, marginRight: 8 }} />
              <Text style={{ fontSize: 12, color: "#92400E", flex: 1 }}>
                The driver will be notified of this change. Final price may change if destination or stops are modified again.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setShowConfirmDialog(false)}
                style={{
                  flex: 1,
                  backgroundColor: "#E5E7EB",
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#687076", fontSize: 14, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmChanges}
                style={{
                  flex: 1,
                  backgroundColor: "#0a7ea4",
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
