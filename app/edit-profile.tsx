import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.location?.address || "");
  const [latitude, setLatitude] = useState(user?.location?.latitude || 0);
  const [longitude, setLongitude] = useState(user?.location?.longitude || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Collector specific fields
  const [idNumber, setIdNumber] = useState(user?.idNumber || "");
  const [vehicleRegistration, setVehicleRegistration] = useState(
    user?.vehicleRegistration || ""
  );

  const isCollector = user?.role === "collector" || user?.role === "zone_manager";

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please enable location permissions to update your location."
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

      // Get address from coordinates
      const [addressResult] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (addressResult) {
        const addressParts = [
          addressResult.street,
          addressResult.district,
          addressResult.city,
          addressResult.region,
        ].filter(Boolean);
        setAddress(addressParts.join(", "));
      }
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Failed to get current location. Please try again.");
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert("Error", "Please enter your full name.");
      return;
    }

    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number.");
      return;
    }

    setIsLoading(true);
    try {
      const updates: any = {
        fullName: fullName.trim(),
        phone: phone.trim(),
      };

      if (address || latitude || longitude) {
        updates.location = {
          address: address.trim(),
          latitude,
          longitude,
        };
      }

      if (isCollector) {
        updates.idNumber = idNumber.trim();
        updates.vehicleRegistration = vehicleRegistration.trim();
      }

      await updateUser(updates);
      Alert.alert("Success", "Profile updated successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Header */}
          <View className="flex-row items-center px-6 pt-4 pb-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">
              Edit Profile
            </Text>
          </View>

          {/* Form */}
          <View className="px-6">
            {/* Full Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Full Name
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="person" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Phone Number */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Phone Number
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="phone" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Enter your phone number"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Location */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Location
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="location-on" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Your address"
                  placeholderTextColor="#9CA3AF"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
              </View>
              <TouchableOpacity
                onPress={getCurrentLocation}
                disabled={isGettingLocation}
                className="mt-2 flex-row items-center justify-center bg-primary/10 rounded-xl py-3"
              >
                <MaterialIcons
                  name="my-location"
                  size={18}
                  color="#22C55E"
                />
                <Text className="text-primary font-medium ml-2">
                  {isGettingLocation ? "Getting Location..." : "Use Current Location"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Collector Specific Fields */}
            {isCollector && (
              <>
                {/* ID Number */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">
                    ID Number
                  </Text>
                  <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                    <MaterialIcons name="badge" size={20} color="#6B7280" />
                    <TextInput
                      className="flex-1 py-4 px-3 text-foreground"
                      placeholder="Enter your ID number"
                      placeholderTextColor="#9CA3AF"
                      value={idNumber}
                      onChangeText={setIdNumber}
                    />
                  </View>
                </View>

                {/* Vehicle Registration */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">
                    Vehicle Registration
                  </Text>
                  <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                    <MaterialIcons name="directions-car" size={20} color="#6B7280" />
                    <TextInput
                      className="flex-1 py-4 px-3 text-foreground"
                      placeholder="Enter vehicle registration"
                      placeholderTextColor="#9CA3AF"
                      value={vehicleRegistration}
                      onChangeText={setVehicleRegistration}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              </>
            )}

            {/* User Role Info */}
            <View className="mb-6 bg-surface border border-border rounded-xl p-4">
              <View className="flex-row items-center">
                <MaterialIcons name="info" size={20} color="#6B7280" />
                <Text className="text-muted ml-2">
                  Account Type:{" "}
                  <Text className="font-medium text-foreground capitalize">
                    {user.role}
                  </Text>
                </Text>
              </View>
              <Text className="text-xs text-muted mt-2">
                Contact support to change your account type.
              </Text>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={isLoading}
              className="bg-primary rounded-xl py-4 items-center mb-4"
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              <Text className="text-white font-semibold text-lg">
                {isLoading ? "Saving..." : "Save Changes"}
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-surface border border-border rounded-xl py-4 items-center"
            >
              <Text className="text-foreground font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
