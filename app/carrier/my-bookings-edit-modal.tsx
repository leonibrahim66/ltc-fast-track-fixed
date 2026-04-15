import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { CustomerBooking } from "@/types/booking";
import { useBookingNotifications } from "@/lib/booking-notification-context";

interface EditBookingModalProps {
  visible: boolean;
  booking: CustomerBooking | null;
  onClose: () => void;
  onSave: (updatedBooking: CustomerBooking) => void;
}

const CARGO_TYPES = [
  "Household Items",
  "Electronics",
  "Furniture",
  "Documents",
  "Food & Groceries",
  "Clothing",
  "Other",
];

const VEHICLE_TYPES = ["Bike", "Van", "Truck", "Pickup"];

export function EditBookingModal({ visible, booking, onClose, onSave }: EditBookingModalProps) {
  const { addNotification } = useBookingNotifications();
  const [editForm, setEditForm] = useState({
    pickupLocation: booking?.pickupLocation || "",
    dropoffLocation: booking?.dropoffLocation || "",
    cargoType: booking?.cargoType || "",
    cargoWeight: booking?.cargoWeight || "",
    vehicleRequired: booking?.vehicleRequired || "",
  });
  const [showCargoTypePicker, setShowCargoTypePicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form when booking changes
  useState(() => {
    if (booking) {
      setEditForm({
        pickupLocation: booking.pickupLocation,
        dropoffLocation: booking.dropoffLocation,
        cargoType: booking.cargoType,
        cargoWeight: booking.cargoWeight,
        vehicleRequired: booking.vehicleRequired,
      });
    }
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editForm.pickupLocation.trim()) {
      newErrors.pickupLocation = "Pickup location is required";
    }
    if (!editForm.dropoffLocation.trim()) {
      newErrors.dropoffLocation = "Drop-off location is required";
    }
    if (!editForm.cargoType.trim()) {
      newErrors.cargoType = "Cargo type is required";
    }
    if (!editForm.cargoWeight.trim()) {
      newErrors.cargoWeight = "Cargo weight is required";
    }
    if (!editForm.vehicleRequired.trim()) {
      newErrors.vehicleRequired = "Vehicle type is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateDistance = (pickup: string, dropoff: string): number => {
    // Simulated distance calculation (in real app, use Google Maps Distance Matrix API)
    const hash = (pickup + dropoff).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return 5 + (hash % 45); // Returns 5-50 km
  };

  const calculatePrice = (distance: number, vehicleType: string): number => {
    const baseRates: Record<string, number> = {
      Bike: 20,
      Van: 50,
      Truck: 80,
      Pickup: 60,
    };
    const perKmRates: Record<string, number> = {
      Bike: 2,
      Van: 5,
      Truck: 8,
      Pickup: 6,
    };

    const baseRate = baseRates[vehicleType] || 50;
    const perKmRate = perKmRates[vehicleType] || 5;
    return baseRate + perKmRate * distance;
  };

  const handleSave = async () => {
    if (!booking) return;
    if (!validateForm()) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    // Check if locations changed to recalculate distance and price
    const locationsChanged =
      editForm.pickupLocation !== booking.pickupLocation ||
      editForm.dropoffLocation !== booking.dropoffLocation;
    const vehicleChanged = editForm.vehicleRequired !== booking.vehicleRequired;

    let newDistance = booking.distance;
    let newPrice = booking.totalAmount;

    if (locationsChanged) {
      const distanceKm = calculateDistance(editForm.pickupLocation, editForm.dropoffLocation);
      newDistance = `${distanceKm} km`;
      newPrice = calculatePrice(distanceKm, editForm.vehicleRequired);
    } else if (vehicleChanged) {
      const distanceKm = parseFloat(booking.distance.replace(" km", ""));
      newPrice = calculatePrice(distanceKm, editForm.vehicleRequired);
    }

    const updatedBooking: CustomerBooking = {
      ...booking,
      pickupLocation: editForm.pickupLocation,
      dropoffLocation: editForm.dropoffLocation,
      cargoType: editForm.cargoType,
      cargoWeight: editForm.cargoWeight,
      vehicleRequired: editForm.vehicleRequired,
      distance: newDistance,
      totalAmount: newPrice,
    };

    // Send update notification
    addNotification({
      bookingId: booking.bookingId,
      type: "accepted", // Using accepted type for updates
      title: "Booking Updated",
      message: `Your booking ${booking.bookingId} has been updated successfully.${
        locationsChanged || vehicleChanged
          ? ` New total: K${newPrice.toFixed(2)}`
          : ""
      }`,
      read: false,
    });

    onSave(updatedBooking);
    onClose();

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  if (!booking) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ScreenContainer className="bg-background">
        {/* Modal Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <TouchableOpacity onPress={onClose} className="p-2 -ml-2">
            <MaterialIcons name="close" size={24} color="#687076" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-foreground">Edit Booking</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView className="flex-1 p-4">
          {/* Booking ID */}
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs text-muted mb-1">Booking ID</Text>
            <Text className="text-lg font-bold text-foreground">{booking.bookingId}</Text>
          </View>

          {/* Editable Fields */}
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-sm font-bold text-foreground mb-4">Booking Details</Text>

            {/* Pickup Location */}
            <View className="mb-4">
              <Text className="text-xs text-muted mb-2">Pickup Location *</Text>
              <TextInput
                value={editForm.pickupLocation}
                onChangeText={(text) => {
                  setEditForm({ ...editForm, pickupLocation: text });
                  if (errors.pickupLocation) {
                    setErrors({ ...errors, pickupLocation: "" });
                  }
                }}
                placeholder="Enter pickup location"
                placeholderTextColor="#9BA1A6"
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: errors.pickupLocation ? "#EF4444" : "#E5E7EB",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: "#11181C",
                }}
              />
              {errors.pickupLocation && (
                <Text className="text-xs text-error mt-1">{errors.pickupLocation}</Text>
              )}
            </View>

            {/* Dropoff Location */}
            <View className="mb-4">
              <Text className="text-xs text-muted mb-2">Drop-off Location *</Text>
              <TextInput
                value={editForm.dropoffLocation}
                onChangeText={(text) => {
                  setEditForm({ ...editForm, dropoffLocation: text });
                  if (errors.dropoffLocation) {
                    setErrors({ ...errors, dropoffLocation: "" });
                  }
                }}
                placeholder="Enter drop-off location"
                placeholderTextColor="#9BA1A6"
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: errors.dropoffLocation ? "#EF4444" : "#E5E7EB",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: "#11181C",
                }}
              />
              {errors.dropoffLocation && (
                <Text className="text-xs text-error mt-1">{errors.dropoffLocation}</Text>
              )}
            </View>

            {/* Cargo Type */}
            <View className="mb-4">
              <Text className="text-xs text-muted mb-2">Cargo Type *</Text>
              <TouchableOpacity
                onPress={() => setShowCargoTypePicker(true)}
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: errors.cargoType ? "#EF4444" : "#E5E7EB",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 14, color: editForm.cargoType ? "#11181C" : "#9BA1A6" }}>
                  {editForm.cargoType || "Select cargo type"}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#687076" />
              </TouchableOpacity>
              {errors.cargoType && (
                <Text className="text-xs text-error mt-1">{errors.cargoType}</Text>
              )}
            </View>

            {/* Cargo Weight */}
            <View className="mb-4">
              <Text className="text-xs text-muted mb-2">Cargo Weight *</Text>
              <TextInput
                value={editForm.cargoWeight}
                onChangeText={(text) => {
                  setEditForm({ ...editForm, cargoWeight: text });
                  if (errors.cargoWeight) {
                    setErrors({ ...errors, cargoWeight: "" });
                  }
                }}
                placeholder="e.g., 50 kg"
                placeholderTextColor="#9BA1A6"
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: errors.cargoWeight ? "#EF4444" : "#E5E7EB",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: "#11181C",
                }}
              />
              {errors.cargoWeight && (
                <Text className="text-xs text-error mt-1">{errors.cargoWeight}</Text>
              )}
            </View>

            {/* Vehicle Required */}
            <View>
              <Text className="text-xs text-muted mb-2">Vehicle Required *</Text>
              <TouchableOpacity
                onPress={() => setShowVehiclePicker(true)}
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: errors.vehicleRequired ? "#EF4444" : "#E5E7EB",
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{ fontSize: 14, color: editForm.vehicleRequired ? "#11181C" : "#9BA1A6" }}
                >
                  {editForm.vehicleRequired || "Select vehicle type"}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#687076" />
              </TouchableOpacity>
              {errors.vehicleRequired && (
                <Text className="text-xs text-error mt-1">{errors.vehicleRequired}</Text>
              )}
            </View>
          </View>

          {/* Info Note */}
          <View className="bg-primary/10 rounded-2xl p-4 mb-4 border border-primary/20">
            <View className="flex-row items-start">
              <MaterialIcons name="info" size={20} color="#0a7ea4" style={{ marginRight: 8 }} />
              <View className="flex-1">
                <Text className="text-sm text-foreground font-semibold mb-1">
                  Price Recalculation
                </Text>
                <Text className="text-xs text-muted">
                  If you change pickup/drop-off locations or vehicle type, the price will be
                  automatically recalculated.
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity
              onPress={onClose}
              style={{ flex: 1, backgroundColor: "#F5F5F5" }}
              className="py-4 rounded-xl items-center justify-center"
            >
              <Text className="text-sm font-semibold" style={{ color: "#687076" }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={{ flex: 1, backgroundColor: "#0a7ea4" }}
              className="py-4 rounded-xl items-center justify-center"
            >
              <Text className="text-white text-sm font-semibold">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Cargo Type Picker Modal */}
        <Modal
          visible={showCargoTypePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCargoTypePicker(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 20,
                paddingBottom: 40,
              }}
            >
              <View className="px-4 pb-4 border-b border-border">
                <Text className="text-lg font-bold text-foreground">Select Cargo Type</Text>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                {CARGO_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      setEditForm({ ...editForm, cargoType: type });
                      if (errors.cargoType) {
                        setErrors({ ...errors, cargoType: "" });
                      }
                      setShowCargoTypePicker(false);
                    }}
                    className="px-4 py-4 border-b border-border"
                  >
                    <Text
                      className={`text-base ${
                        editForm.cargoType === type ? "font-bold text-primary" : "text-foreground"
                      }`}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Vehicle Type Picker Modal */}
        <Modal
          visible={showVehiclePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowVehiclePicker(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingTop: 20,
                paddingBottom: 40,
              }}
            >
              <View className="px-4 pb-4 border-b border-border">
                <Text className="text-lg font-bold text-foreground">Select Vehicle Type</Text>
              </View>
              <ScrollView style={{ maxHeight: 300 }}>
                {VEHICLE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      setEditForm({ ...editForm, vehicleRequired: type });
                      if (errors.vehicleRequired) {
                        setErrors({ ...errors, vehicleRequired: "" });
                      }
                      setShowVehiclePicker(false);
                    }}
                    className="px-4 py-4 border-b border-border"
                  >
                    <Text
                      className={`text-base ${
                        editForm.vehicleRequired === type
                          ? "font-bold text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScreenContainer>
    </Modal>
  );
}
