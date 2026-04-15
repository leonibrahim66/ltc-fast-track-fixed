import { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { getStaticResponsive } from "@/hooks/use-responsive";
const VEHICLE_TYPES = [
  { key: "motorbike", label: "Motorbike", icon: "two-wheeler", baseRate: 25, perKmRate: 2 },
  { key: "van", label: "Van", icon: "airport-shuttle", baseRate: 75, perKmRate: 5 },
  { key: "pickup", label: "Pickup", icon: "local-shipping", baseRate: 100, perKmRate: 7 },
  { key: "truck", label: "Truck", icon: "local-shipping", baseRate: 200, perKmRate: 12 },
  { key: "trailer", label: "Trailer", icon: "local-shipping", baseRate: 350, perKmRate: 20 },
];

const CARGO_TYPES = [
  "Household",
  "Goods",
  "Bulk",
  "Fragile",
  "Documents",
  "Electronics",
  "Furniture",
  "Other",
];

const WEIGHT_OPTIONS = [
  "Under 10 kg",
  "10 - 50 kg",
  "50 - 200 kg",
  "200 - 500 kg",
  "500 kg - 1 ton",
  "1 - 5 tons",
  "5+ tons",
];

// Simulated Google Maps Distance Matrix calculation
// In production, replace with actual Google Maps Distance Matrix API call
// Distance estimation: returns null so the UI shows "Enter distance manually"
// In production, integrate the Google Distance Matrix API with EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
const calculateDistanceKm = async (_origin: string, _destination: string): Promise<number | null> => {
  // No mock data — distance must be entered manually by the customer
  return null;
};

export default function BookCarrierScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [cargoType, setCargoType] = useState("");
  const [cargoDescription, setCargoDescription] = useState("");
  const [cargoWeight, setCargoWeight] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-calculate distance when both locations are set
  useEffect(() => {
    const calculateDistance = async () => {
      if (pickupLocation.trim().length > 3 && dropoffLocation.trim().length > 3) {
        setCalculatingDistance(true);
        const distance = await calculateDistanceKm(pickupLocation.trim(), dropoffLocation.trim());
        setCalculatedDistance(distance);
        setCalculatingDistance(false);
      } else {
        setCalculatedDistance(null);
      }
    };

    // Debounce distance calculation
    const timer = setTimeout(calculateDistance, 500);
    return () => clearTimeout(timer);
  }, [pickupLocation, dropoffLocation]);

  const calculatePrice = useCallback(() => {
    const vehicle = VEHICLE_TYPES.find((v) => v.key === vehicleType);
    if (!vehicle || !calculatedDistance) return 0;
    
    // Base rate + per km rate * distance
    let price = vehicle.baseRate + vehicle.perKmRate * calculatedDistance;
    
    // Weight multiplier
    const weightIdx = WEIGHT_OPTIONS.indexOf(cargoWeight);
    if (weightIdx > 2) price *= 1 + (weightIdx - 2) * 0.15;
    
    // Cargo type multiplier
    if (cargoType === "Fragile") price *= 1.2;
    if (cargoType === "Electronics") price *= 1.15;
    
    return Math.round(price * 100) / 100;
  }, [vehicleType, calculatedDistance, cargoWeight, cargoType]);

  const estimatedPrice = calculatePrice();

  // Calculate live price preview for Step 2 (using vehicle from Step 3 if available)
  const calculateLivePricePreview = useCallback(() => {
    if (!calculatedDistance) return 0;
    
    // Use selected vehicle or default to van for preview
    const vehicle = vehicleType 
      ? VEHICLE_TYPES.find((v) => v.key === vehicleType)
      : VEHICLE_TYPES[1]; // Default to van
    
    if (!vehicle) return 0;
    
    const price = vehicle.baseRate + vehicle.perKmRate * calculatedDistance;
    return Math.round(price * 100) / 100;
  }, [calculatedDistance, vehicleType]);

  const livePricePreview = calculateLivePricePreview();

  const validateStep1 = () => {
    if (!customerName.trim()) { Alert.alert("Required", "Please enter your full name."); return false; }
    if (!customerPhone.trim() || customerPhone.length < 10) { Alert.alert("Required", "Please enter a valid phone number."); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!pickupLocation.trim()) { Alert.alert("Required", "Please enter pickup location."); return false; }
    if (!dropoffLocation.trim()) { Alert.alert("Required", "Please enter drop-off location."); return false; }
    if (!calculatedDistance || calculatedDistance <= 0) { Alert.alert("Required", "Please enter the estimated distance in kilometres."); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!cargoType) { Alert.alert("Required", "Please select cargo type."); return false; }
    if (!cargoWeight) { Alert.alert("Required", "Please select cargo weight."); return false; }
    if (!vehicleType) { Alert.alert("Required", "Please select vehicle type."); return false; }
    return true;
  };

  const goNext = () => {
    if (step === 1 && validateStep1()) { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(2); }
    else if (step === 2 && validateStep2()) { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(3); }
    else if (step === 3 && validateStep3()) { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(4); }
  };

  const goBack = () => { if (step > 1) setStep(step - 1); else router.back(); };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const booking = {
        id: `booking_${Date.now()}_${Date.now().toString(36).slice(-6)}`,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        pickupLocation: pickupLocation.trim(),
        dropoffLocation: dropoffLocation.trim(),
        distance: `${calculatedDistance} km`,
        cargoType, cargoDescription: cargoDescription.trim(), cargoWeight,
        vehicleRequired: vehicleType, estimatedPrice, notes: notes.trim(),
        status: "pending", createdAt: new Date().toISOString(),
      };
      // Save to carrier_bookings (driver job feed reads this)
      const stored = await AsyncStorage.getItem("carrier_bookings");
      const bookings = stored ? JSON.parse(stored) : [];
      bookings.push(booking);
      await AsyncStorage.setItem("carrier_bookings", JSON.stringify(bookings));

      // Also save to customer_bookings (my-bookings and track screens read this)
      const custStored = await AsyncStorage.getItem("customer_bookings");
      const custBookings = custStored ? JSON.parse(custStored) : [];
      custBookings.unshift(booking);
      await AsyncStorage.setItem("customer_bookings", JSON.stringify(custBookings));

      const notifStored = await AsyncStorage.getItem("carrier_notifications");
      const notifications = notifStored ? JSON.parse(notifStored) : [];
      notifications.unshift({
        id: `notif_${Date.now()}`, type: "new_booking", title: "New Booking Request",
        message: `New ${cargoType} transport from ${pickupLocation} to ${dropoffLocation}. Distance: ${calculatedDistance} km. Price: K${estimatedPrice.toFixed(2)}`,
        bookingId: booking.id, recipientType: "driver", recipientId: "all",
        read: false, createdAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem("carrier_notifications", JSON.stringify(notifications));

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Booking Submitted!", `Your carrier booking has been submitted.\n\nBooking ID: ${booking.id.slice(-8).toUpperCase()}\nDistance: ${calculatedDistance} km\nEstimated Price: K${estimatedPrice.toFixed(2)}\n\nA driver will accept your request shortly.`,
        [{ text: "Track Booking", onPress: () => router.push("/carrier/track" as any) }, { text: "Done", onPress: () => router.back() }]);
    } catch (e) { Alert.alert("Error", "Failed to submit booking. Please try again."); }
    finally { setSubmitting(false); }
  };

  const renderStepIndicator = () => (
    <View className="flex-row items-center justify-center px-6 py-3">
      {[1, 2, 3, 4].map((s) => (
        <View key={s} className="flex-row items-center">
          <View style={[styles.stepDot, { backgroundColor: s <= step ? "#22C55E" : "rgba(255,255,255,0.15)", width: s === step ? 28 : 8, borderRadius: s === step ? 14 : 4 }]} />
          {s < 4 && <View style={{ width: 24, height: 2, backgroundColor: s < step ? "#22C55E" : "rgba(255,255,255,0.1)" }} />}
        </View>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View className="px-6 gap-5">
      <View>
        <Text className="text-lg font-bold text-foreground mb-1">Your Details</Text>
        <Text className="text-sm text-muted">Tell us who you are</Text>
      </View>
      <View>
        <Text className="text-xs text-muted mb-2">FULL NAME *</Text>
        <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Enter your full name" placeholderTextColor="#666" className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground" returnKeyType="next" />
      </View>
      <View>
        <Text className="text-xs text-muted mb-2">PHONE NUMBER *</Text>
        <TextInput value={customerPhone} onChangeText={setCustomerPhone} placeholder="e.g. 0960123456" placeholderTextColor="#666" keyboardType="phone-pad" className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground" returnKeyType="done" />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View className="px-6 gap-5">
      <View>
        <Text className="text-lg font-bold text-foreground mb-1">Locations</Text>
        <Text className="text-sm text-muted">Where should we pick up and deliver?</Text>
      </View>
      <View>
        <Text className="text-xs text-muted mb-2">PICKUP LOCATION *</Text>
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
          <MaterialIcons name="my-location" size={18} color="#22C55E" />
          <TextInput value={pickupLocation} onChangeText={setPickupLocation} placeholder="Enter pickup address" placeholderTextColor="#666" className="flex-1 py-3 ml-3 text-foreground" returnKeyType="next" />
        </View>
      </View>
      <View>
        <Text className="text-xs text-muted mb-2">DROP-OFF LOCATION *</Text>
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
          <MaterialIcons name="location-on" size={18} color="#EF4444" />
          <TextInput value={dropoffLocation} onChangeText={setDropoffLocation} placeholder="Enter drop-off address" placeholderTextColor="#666" className="flex-1 py-3 ml-3 text-foreground" returnKeyType="done" />
        </View>
      </View>

      {/* Manual Distance Entry */}
      <View className="bg-surface rounded-xl border border-border p-4">
        <Text className="text-xs text-muted mb-2">ESTIMATED DISTANCE (km) *</Text>
        <View className="flex-row items-center">
          <MaterialIcons name="straighten" size={20} color="#22C55E" />
          <TextInput
            value={calculatedDistance !== null ? String(calculatedDistance) : ""}
            onChangeText={(v) => {
              const n = parseFloat(v);
              setCalculatedDistance(isNaN(n) ? null : n);
            }}
            placeholder="e.g. 25"
            placeholderTextColor="#666"
            keyboardType="decimal-pad"
            className="flex-1 ml-3 text-foreground text-lg font-bold"
            returnKeyType="done"
          />
          <Text className="text-muted">km</Text>
        </View>
        <Text className="text-xs text-muted mt-2">
          Enter the approximate road distance between pickup and drop-off.
        </Text>
      </View>

      {/* Live Price Preview */}
      {calculatedDistance && livePricePreview > 0 && (
        <View style={{ backgroundColor: "rgba(34,197,94,0.1)", borderWidth: 1, borderColor: "#22C55E", borderRadius: 16, padding: 16 }}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-xs text-muted">ESTIMATED COST</Text>
            <MaterialIcons name="info-outline" size={16} color="#9BA1A6" />
          </View>
          <Text style={{ fontSize: 32, fontWeight: "800", color: "#22C55E", marginBottom: 4 }}>
            K{livePricePreview.toFixed(2)}
          </Text>
          <Text className="text-xs text-muted">
            Final price may change if destination or stops are modified.
          </Text>
          {!vehicleType && (
            <Text className="text-xs text-warning mt-2">
              * Based on Van. Price will update after vehicle selection.
            </Text>
          )}
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View className="px-6 gap-5">
      <View>
        <Text className="text-lg font-bold text-foreground mb-1">Cargo & Vehicle</Text>
        <Text className="text-sm text-muted">What are you transporting?</Text>
      </View>
      <View>
        <Text className="text-xs text-muted mb-2">CARGO TYPE *</Text>
        <View className="flex-row flex-wrap gap-2">
          {CARGO_TYPES.map((type) => (
            <TouchableOpacity key={type} onPress={() => setCargoType(type)} style={[styles.chipButton, cargoType === type && styles.chipButtonActive]}>
              <Text style={[styles.chipText, cargoType === type && styles.chipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View>
        <Text className="text-xs text-muted mb-2">CARGO DESCRIPTION (Optional)</Text>
        <TextInput value={cargoDescription} onChangeText={setCargoDescription} placeholder="Describe your cargo..." placeholderTextColor="#666" multiline numberOfLines={3} className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground" style={{ textAlignVertical: "top", minHeight: 80 }} />
      </View>
      <View>
        <Text className="text-xs text-muted mb-2">ESTIMATED WEIGHT *</Text>
        <View className="gap-2">
          {WEIGHT_OPTIONS.map((w) => (
            <TouchableOpacity key={w} onPress={() => setCargoWeight(w)} style={[styles.optionButton, cargoWeight === w && styles.optionButtonActive]}>
              <MaterialIcons name="fitness-center" size={16} color={cargoWeight === w ? "#22C55E" : "#9BA1A6"} />
              <Text style={[styles.optionText, cargoWeight === w && styles.optionTextActive]}>{w}</Text>
              {cargoWeight === w && <MaterialIcons name="check-circle" size={18} color="#22C55E" />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View>
        <Text className="text-xs text-muted mb-2">VEHICLE TYPE *</Text>
        <View className="gap-2">
          {VEHICLE_TYPES.map((v) => (
            <TouchableOpacity key={v.key} onPress={() => setVehicleType(v.key)} style={[styles.optionButton, vehicleType === v.key && styles.optionButtonActive]}>
              <MaterialIcons name={v.icon as any} size={20} color={vehicleType === v.key ? "#22C55E" : "#9BA1A6"} />
              <View className="flex-1 ml-2">
                <Text style={[styles.optionText, vehicleType === v.key && styles.optionTextActive]}>{v.label}</Text>
                <Text style={{ fontSize: 10, color: "#9BA1A6" }}>Base: K{v.baseRate} + K{v.perKmRate}/km</Text>
              </View>
              {vehicleType === v.key && <MaterialIcons name="check-circle" size={18} color="#22C55E" />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View className="px-6 gap-5">
      <View>
        <Text className="text-lg font-bold text-foreground mb-1">Review & Submit</Text>
        <Text className="text-sm text-muted">Confirm your booking details</Text>
      </View>
      <View style={{ backgroundColor: "rgba(34,197,94,0.1)", borderWidth: 1, borderColor: "#22C55E", borderRadius: 16, padding: 20, alignItems: "center" }}>
        <Text className="text-xs text-muted mb-1">ESTIMATED PRICE</Text>
        <Text style={{ fontSize: 36, fontWeight: "800", color: "#22C55E" }}>K{estimatedPrice.toFixed(2)}</Text>
        <Text className="text-xs text-muted mt-1">Final price may change if destination or stops are modified.</Text>
      </View>
      <View className="bg-surface rounded-xl border border-border p-4">
        <Text className="text-xs text-muted mb-2">CUSTOMER</Text>
        <Text className="text-sm font-semibold text-foreground">{customerName}</Text>
        <Text className="text-xs text-muted">{customerPhone}</Text>
      </View>
      <View className="bg-surface rounded-xl border border-border p-4">
        <Text className="text-xs text-muted mb-2">ROUTE</Text>
        <View className="flex-row items-start mb-2">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E", marginTop: 4, marginRight: 8 }} />
          <Text className="text-sm text-foreground flex-1">{pickupLocation}</Text>
        </View>
        <View className="flex-row items-start">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", marginTop: 4, marginRight: 8 }} />
          <Text className="text-sm text-foreground flex-1">{dropoffLocation}</Text>
        </View>
        <Text className="text-xs text-muted mt-2">Distance: {calculatedDistance} km</Text>
      </View>
      <View className="bg-surface rounded-xl border border-border p-4">
        <Text className="text-xs text-muted mb-2">CARGO</Text>
        <View className="flex-row flex-wrap gap-x-6 gap-y-2">
          <View><Text className="text-xs text-muted">Type</Text><Text className="text-sm font-medium text-foreground">{cargoType}</Text></View>
          <View><Text className="text-xs text-muted">Weight</Text><Text className="text-sm font-medium text-foreground">{cargoWeight}</Text></View>
          <View><Text className="text-xs text-muted">Vehicle</Text><Text className="text-sm font-medium text-foreground">{VEHICLE_TYPES.find((v) => v.key === vehicleType)?.label}</Text></View>
        </View>
        {cargoDescription ? <View className="mt-2"><Text className="text-xs text-muted">Description</Text><Text className="text-sm text-foreground">{cargoDescription}</Text></View> : null}
      </View>
      <View>
        <Text className="text-xs text-muted mb-2">SPECIAL INSTRUCTIONS (Optional)</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Any special instructions for the driver..." placeholderTextColor="#666" multiline numberOfLines={3} className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground" style={{ textAlignVertical: "top", minHeight: 80 }} />
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      <View className="px-6 pt-4 pb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={goBack} className="mr-3">
            <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground">Book a Carrier</Text>
        </View>
        <Text className="text-sm text-muted">Step {step}/4</Text>
      </View>
      {renderStepIndicator()}
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: Platform.OS === "web" ? 16 : 34, paddingTop: 12, backgroundColor: "rgba(22,101,52,0.95)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
        {step < 4 ? (
          <TouchableOpacity 
            onPress={goNext} 
            disabled={step === 2 && (calculatingDistance || !calculatedDistance)}
            style={{ 
              backgroundColor: (step === 2 && (calculatingDistance || !calculatedDistance)) ? "#666" : "#22C55E", 
              paddingVertical: 14, 
              borderRadius: 14, 
              alignItems: "center" 
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {step === 2 && calculatingDistance ? "Calculating..." : "Continue"}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={{ backgroundColor: submitting ? "#666" : "#22C55E", paddingVertical: 14, borderRadius: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" }}>
            <MaterialIcons name="check-circle" size={20} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginLeft: 8 }}>{submitting ? "Submitting..." : `Submit Booking — K${estimatedPrice.toFixed(2)}`}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  stepDot: { height: _rs.s(8) },
  optionButton: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: _rs.s(12), paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(12) },
  optionButtonActive: { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "#22C55E" },
  optionText: { flex: 1, marginLeft: _rs.sp(10), fontSize: _rs.fs(13), color: "#9BA1A6" },
  optionTextActive: { color: "#ECEDEE", fontWeight: "600" },
  chipButton: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(8), borderRadius: _rs.s(20), backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  chipButtonActive: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "#22C55E" },
  chipText: { fontSize: _rs.fs(13), color: "#9BA1A6" },
  chipTextActive: { color: "#22C55E", fontWeight: "600" },
});
