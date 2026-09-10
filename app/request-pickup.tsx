import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  ScrollView,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePickups } from "@/lib/pickups-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useITRealtime } from "@/lib/it-realtime-context";
import { useAdmin } from "@/lib/admin-context";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

import { getStaticResponsive } from "@/hooks/use-responsive";
import { sendNotification } from "@/lib/send-notification";
import { useJobNotifications } from "@/hooks/use-job-notifications";
type BinType = "residential" | "commercial" | "industrial";
type PickupType = "immediate" | "scheduled";

// Time slots for scheduling
const TIME_SLOTS = [
  { id: "morning", label: "Morning", time: "8:00 AM - 12:00 PM" },
  { id: "afternoon", label: "Afternoon", time: "12:00 PM - 4:00 PM" },
  { id: "evening", label: "Evening", time: "4:00 PM - 7:00 PM" },
];

export default function RequestPickupScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { createPickup } = usePickups();
  const { addLivePickup, addEvent } = useITRealtime();
  const { addNotification } = useAdmin();
  const { notifyNewPickupRequest } = useJobNotifications();

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [address, setAddress] = useState("");
  const [binType, setBinType] = useState<BinType>(
    user?.role === "commercial" ? "commercial" : "residential"
  );
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [isRefreshingUser, setIsRefreshingUser] = useState(true);
  const isSubmitDisabled = isLoading || isLoadingLocation;

  // Scheduling states
  const [pickupType, setPickupType] = useState<PickupType>("immediate");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);

  // Default to Lusaka, Zambia
  const defaultRegion = {
    latitude: -15.4167,
    longitude: 28.2833,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // Generate next 7 days for date selection
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    return date;
  });

  useEffect(() => {
    getCurrentLocation();
  }, []);

useFocusEffect(
  useCallback(() => {
    let isActive = true;

    const loadLatestUser = async () => {
      setIsRefreshingUser(true);

      try {
        await refreshUser();
      } finally {
        if (isActive) {
          setIsRefreshingUser(false);
        }
      }
    };

    loadLatestUser();

    return () => {
      isActive = false;
    };
  }, [refreshUser])
);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to pin your bin location. You can still enter your address manually."
        );
        setIsLoadingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(coords);

      // Get address from coordinates
      const [addressResult] = await Location.reverseGeocodeAsync(coords);
      if (addressResult) {
        const addr = [
          addressResult.street,
          addressResult.district,
          addressResult.city,
          addressResult.country,
        ]
          .filter(Boolean)
          .join(", ");
        setAddress(addr);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      // Set default location on error
      setLocation(defaultRegion);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Camera permission is required to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Photo library permission is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  };

  const formatDate = (date: Date) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const handleSubmit = async () => {
  setIsLoading(true);

  try {
    // Load the latest customer record before creating the pickup request.
const latestUser = await refreshUser();

    if (!latestUser) {
      Alert.alert("Error", "Please login to request a pickup");
      return;
    }

    if (!location) {
      Alert.alert(
        "Error",
        "Please wait for location to be detected or enter manually"
      );
      return;
    }

    if (pickupType === "scheduled") {
      if (!selectedDate) {
        Alert.alert("Error", "Please select a date for your scheduled pickup");
        return;
      }

      if (!selectedTimeSlot) {
        Alert.alert(
          "Error",
          "Please select a time slot for your scheduled pickup"
        );
        return;
      }
    }

    const customerZoneId =
      latestUser.assignedZoneId || latestUser.zoneId || undefined;

    const pickupData: any = {
      userId: latestUser.id,
      userPhone: latestUser.phone,
      userName: latestUser.fullName,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        address: address || undefined,
      },
      binType,
      photoUri: photoUri || undefined,
      notes: notes || undefined,
      zoneId: customerZoneId,
    };

    if (pickupType === "scheduled" && selectedDate && selectedTimeSlot) {
      pickupData.scheduledDate = selectedDate.toISOString();
      pickupData.scheduledTime = selectedTimeSlot;
    }

    const createdPickup = await createPickup(pickupData);

    addLivePickup({
      customerId: latestUser.id,
      customerName: latestUser.fullName || latestUser.phone,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        address: address || "Location pinned",
      },
      binType,
      status: "pending",
    });

    addEvent({
      type: "pickup_pinned",
      title: "New Pickup Request",
      description: `${latestUser.fullName || latestUser.phone} requested ${binType} pickup`,
      data: {
        userName: latestUser.fullName || latestUser.phone,
        location: address || "Location pinned",
      },
      priority: "high",
    });

    addNotification({
      type: "system",
      title: "New Pickup Request",
      message: `${latestUser.fullName || latestUser.phone} requested a ${binType} pickup`,
    });

    sendNotification({
      userId: latestUser.id,
      type: "pickup_update",
      title: "Pickup Request Submitted",
      body:
        pickupType === "scheduled"
          ? "Your scheduled pickup has been submitted. A collector will be assigned soon."
          : "Your garbage pickup request has been submitted. A collector will be assigned soon.",
    }).catch(() => {});

    const customerZoneId2 =
      latestUser.assignedZoneId || latestUser.zoneId;

    if (customerZoneId2) {
      import("@react-native-async-storage/async-storage")
        .then(({ default: AS }) => {
          AS.getItem("@ltc_zone_managers")
            .then((raw) => {
              if (!raw) return;

              const managers: any[] = JSON.parse(raw);

              const manager = managers.find(
                (m: any) =>
                  m.zoneId === customerZoneId2 ||
                  m.assignedZoneId === customerZoneId2
              );

              if (manager?.id) {
                sendNotification({
                  userId: manager.id,
                  type: "pickup_update",
                  title: "New Pickup Request",
                  body: `${latestUser.fullName || latestUser.phone} submitted a ${binType} pickup request in your zone.`,
                }).catch(() => {});
              }
            })
            .catch(() => {});
        })
        .catch(() => {});

      notifyNewPickupRequest({
        pickupId: createdPickup.id,
        customerName:
          latestUser.fullName || latestUser.phone || "Customer",
        address: address || "Location pinned",
        zoneName: String(customerZoneId2),
      }).catch(() => {});
    }

    const message =
      pickupType === "scheduled"
        ? `Your garbage pickup has been scheduled for ${formatDate(
            selectedDate!
          )} (${
            TIME_SLOTS.find((t) => t.id === selectedTimeSlot)?.time
          }). We'll remind you before the pickup.`
        : "Your garbage pickup request has been submitted. A collector will be assigned soon.";

    Alert.alert(
      pickupType === "scheduled" ? "Pickup Scheduled" : "Pickup Requested",
      message,
      [{ text: "OK", onPress: () => router.back() }]
    );
  } catch (error) {
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to submit pickup request.";

    Alert.alert("Error", `${msg} Please try again.`);
  } finally {
    setIsLoading(false);
  }
};

if (isRefreshingUser) {
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#22C55E" />
        <Text className="text-muted mt-3">
           Loading your account...
        </Text>
      </View>
    </ScreenContainer>
  );
}

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1">
        {/* Header */}
        <View className="px-6 pt-4 pb-4 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground ml-4">
            Request Pickup
          </Text>
        </View>

        <ScrollView
  className="flex-1"
  contentContainerStyle={{ paddingBottom: 100 }}
>
  {/* Manual Payment Verification Notice */}
  <View
    className="mx-6 mb-4 rounded-xl p-4 flex-row items-start"
    style={{ backgroundColor: "#EFF6FF" }}
  >
    <MaterialIcons
      name="info-outline"
      size={22}
      color="#2563EB"
    />

    <Text
      className="text-sm ml-3 flex-1"
      style={{ color: "#1E40AF" }}
    >
      You can submit a pickup request without a subscription. Payment details,
      where applicable, will be manually verified by our administrators.
    </Text>
  </View>

  {/* Pickup Type Selection */}
  <View className="px-6 mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">
              Pickup Type
            </Text>
            <View className="flex-row">
              <TouchableOpacity
                onPress={() => setPickupType("immediate")}
                className={`flex-1 py-4 rounded-xl mr-2 border-2 ${
                  pickupType === "immediate"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface"
                }`}
              >
                <View className="items-center">
                  <MaterialIcons 
                    name="flash-on" 
                    size={24} 
                    color={pickupType === "immediate" ? "#22C55E" : "#9CA3AF"} 
                  />
                  <Text
                    className={`text-center text-sm font-medium mt-1 ${
                      pickupType === "immediate" ? "text-primary" : "text-muted"
                    }`}
                  >
                    Immediate
                  </Text>
                  <Text className="text-xs text-muted mt-1">ASAP pickup</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPickupType("scheduled")}
                className={`flex-1 py-4 rounded-xl ml-2 border-2 ${
                  pickupType === "scheduled"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface"
                }`}
              >
                <View className="items-center">
                  <MaterialIcons 
                    name="schedule" 
                    size={24} 
                    color={pickupType === "scheduled" ? "#22C55E" : "#9CA3AF"} 
                  />
                  <Text
                    className={`text-center text-sm font-medium mt-1 ${
                      pickupType === "scheduled" ? "text-primary" : "text-muted"
                    }`}
                  >
                    Scheduled
                  </Text>
                  <Text className="text-xs text-muted mt-1">Pick a date</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scheduling Section */}
          {pickupType === "scheduled" && (
            <View className="px-6 mb-4">
              {/* Date Selection */}
              <Text className="text-sm font-medium text-foreground mb-2">
                Select Date
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                className="mb-4"
              >
                {availableDates.map((date, index) => {
                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
                  const dayNum = date.getDate();
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setSelectedDate(date)}
                      className={`w-16 py-3 rounded-xl mr-2 items-center border-2 ${
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-border bg-surface"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          isSelected ? "text-white" : "text-muted"
                        }`}
                      >
                        {dayName}
                      </Text>
                      <Text
                        className={`text-xl font-bold mt-1 ${
                          isSelected ? "text-white" : "text-foreground"
                        }`}
                      >
                        {dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time Slot Selection */}
              <Text className="text-sm font-medium text-foreground mb-2">
                Select Time Slot
              </Text>
              <View>
                {TIME_SLOTS.map((slot) => {
                  const isSelected = selectedTimeSlot === slot.id;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      onPress={() => setSelectedTimeSlot(slot.id)}
                      className={`py-4 px-4 rounded-xl mb-2 border-2 flex-row items-center justify-between ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-surface"
                      }`}
                    >
                      <View className="flex-row items-center">
                        <MaterialIcons 
                          name={
                            slot.id === "morning" ? "wb-sunny" : 
                            slot.id === "afternoon" ? "wb-cloudy" : "nights-stay"
                          } 
                          size={24} 
                          color={isSelected ? "#22C55E" : "#9CA3AF"} 
                        />
                        <View className="ml-3">
                          <Text
                            className={`font-medium ${
                              isSelected ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {slot.label}
                          </Text>
                          <Text className="text-xs text-muted">{slot.time}</Text>
                        </View>
                      </View>
                      {isSelected && (
                        <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Selected Schedule Summary */}
              {selectedDate && selectedTimeSlot && (
                <View className="bg-primary/10 rounded-xl p-4 mt-2 flex-row items-center">
                  <MaterialIcons name="event" size={24} color="#22C55E" />
                  <View className="ml-3">
                    <Text className="text-primary font-semibold">
                      Scheduled for {formatDate(selectedDate)}
                    </Text>
                    <Text className="text-primary/80 text-sm">
                      {TIME_SLOTS.find(t => t.id === selectedTimeSlot)?.time}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Location Section */}
          <View className="px-6 mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">
              Your Location
            </Text>
            <View className="h-48 rounded-xl overflow-hidden border border-border bg-surface">
              {isLoadingLocation ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color="#22C55E" />
                  <Text className="text-muted mt-2">Getting your location...</Text>
                </View>
              ) : (
                <View className="flex-1 items-center justify-center p-4">
                  <View className="bg-primary/20 w-16 h-16 rounded-full items-center justify-center mb-3">
                    <MaterialIcons name="location-on" size={32} color="#22C55E" />
                  </View>
                  {location ? (
                    <>
                      <Text className="text-foreground font-medium text-center mb-1">
                        Location Detected
                      </Text>
                      <Text className="text-muted text-sm text-center">
                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-muted text-center">
                      Unable to get location. Please enter address manually.
                    </Text>
                  )}
                </View>
              )}
            </View>
            <Text className="text-xs text-muted mt-2">
              Your current location will be used for the pickup
            </Text>
          </View>

          {/* Address Input */}
          <View className="px-6 mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">
              Address / Landmark
            </Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your address or nearby landmark..."
              className="bg-surface border border-border rounded-xl p-4 text-foreground"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Bin Type Selection */}
          <View className="px-6 mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">
              Bin Type
            </Text>
            <View className="flex-row">
              {(["residential", "commercial", "industrial"] as BinType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setBinType(type)}
                  className={`flex-1 py-3 rounded-xl mr-2 border-2 ${
                    binType === type
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text
                    className={`text-center text-sm font-medium capitalize ${
                      binType === type ? "text-primary" : "text-muted"
                    }`}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Photo Section */}
          <View className="px-6 mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">
              Photo of Garbage (Optional)
            </Text>
            {photoUri ? (
              <View className="relative">
                <Image
                  source={{ uri: photoUri }}
                  className="w-full h-48 rounded-xl"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => setPhotoUri(null)}
                  className="absolute top-2 right-2 bg-error p-2 rounded-full"
                >
                  <MaterialIcons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row">
                <TouchableOpacity
                  onPress={takePhoto}
                  className="flex-1 bg-surface border border-border rounded-xl p-4 mr-2 items-center"
                >
                  <MaterialIcons name="camera-alt" size={32} color="#22C55E" />
                  <Text className="text-muted text-sm mt-2">Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickImage}
                  className="flex-1 bg-surface border border-border rounded-xl p-4 ml-2 items-center"
                >
                  <MaterialIcons name="photo-library" size={32} color="#22C55E" />
                  <Text className="text-muted text-sm mt-2">Choose Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Notes */}
          <View className="px-6 mb-6">
            <Text className="text-sm font-medium text-foreground mb-2">
              Additional Notes (Optional)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special instructions for the collector..."
              multiline
              numberOfLines={3}
              className="bg-surface border border-border rounded-xl p-4 text-foreground"
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <View className="px-6">
            <TouchableOpacity
  onPress={handleSubmit}
  disabled={isSubmitDisabled}
  className={`py-4 rounded-full ${
    isSubmitDisabled ? "bg-muted" : "bg-primary"
  }`}
  style={[styles.button, isSubmitDisabled && styles.buttonDisabled]}
>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center justify-center">
                  <MaterialIcons 
                    name={pickupType === "scheduled" ? "event-available" : "send"} 
                    size={20} 
                    color="#fff" 
                  />
                  <Text className="text-white text-center text-lg font-semibold ml-2">
                    {pickupType === "scheduled" ? "Schedule Pickup" : "Request Pickup"}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
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
  button: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
