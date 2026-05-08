import { useState, useEffect } from "react";
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

export default function EditBookingModal({
  visible,
  booking,
  onClose,
  onSave,
}: EditBookingModalProps) {
  const { addNotification } = useBookingNotifications();

  const [editForm, setEditForm] = useState({
    pickupLocation: "",
    dropoffLocation: "",
    cargoType: "",
    cargoWeight: "",
    vehicleRequired: "",
  });

  const [showCargoTypePicker, setShowCargoTypePicker] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (booking) {
      setEditForm({
        pickupLocation: booking.pickupLocation || "",
        dropoffLocation: booking.dropoffLocation || "",
        cargoType: booking.cargoType || "",
        cargoWeight: booking.cargoWeight || "",
        vehicleRequired: booking.vehicleRequired || "",
      });
      setErrors({});
    }
  }, [booking]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!editForm.pickupLocation.trim()) newErrors.pickupLocation = "Pickup location is required";
    if (!editForm.dropoffLocation.trim()) newErrors.dropoffLocation = "Drop-off location is required";
    if (!editForm.cargoType.trim()) newErrors.cargoType = "Cargo type is required";
    if (!editForm.cargoWeight.trim()) newErrors.cargoWeight = "Cargo weight is required";
    if (!editForm.vehicleRequired.trim()) newErrors.vehicleRequired = "Vehicle type is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateDistance = (pickup: string, dropoff: string): number => {
    const hash = (pickup + dropoff).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return 5 + (hash % 45);
  };

  const calculatePrice = (distance: number, vehicleType: string): number => {
    const baseRates: Record<string, number> = { Bike: 20, Van: 50, Truck: 80, Pickup: 60 };
    const perKmRates: Record<string, number> = { Bike: 2, Van: 5, Truck: 8, Pickup: 6 };

    return (baseRates[vehicleType] || 50) + (perKmRates[vehicleType] || 5) * distance;
  };

  const handleSave = async () => {
    if (!booking) return;

    if (!validateForm()) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

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

    addNotification({
      bookingId: booking.bookingId,
      type: "accepted",
      title: "Booking Updated",
      message: `Your booking ${booking.bookingId} has been updated successfully${
        locationsChanged || vehicleChanged ? `. New total: K${newPrice.toFixed(2)}` : ""
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScreenContainer className="bg-background">
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <TouchableOpacity onPress={onClose} className="p-2 -ml-2">
            <MaterialIcons name="close" size={24} color="#687076" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-foreground">Edit Booking</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView className="flex-1 p-4">
          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-xs text-muted mb-1">Booking ID</Text>
            <Text className="text-lg font-bold text-foreground">{booking.bookingId}</Text>
          </View>

          <View className="bg-surface rounded-2xl p-4 mb-4 border border-border">
            <Text className="text-sm font-bold text-foreground mb-4">Booking Details</Text>
          </View>

          <View className="flex-row gap-3 mb-4">
            <TouchableOpacity onPress={onClose} style={{ flex: 1, backgroundColor: "#F5F5F5" }} className="py-4 rounded-xl items-center justify-center">
              <Text style={{ color: "#687076" }} className="text-sm font-semibold">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSave} style={{ flex: 1, backgroundColor: "#0a7ea4" }} className="py-4 rounded-xl items-center justify-center">
              <Text className="text-white text-sm font-semibold">Save Changes</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ScreenContainer>
    </Modal>
  );
}