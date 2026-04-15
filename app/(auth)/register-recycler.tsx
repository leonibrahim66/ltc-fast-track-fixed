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
import { RECYCLING_CATEGORIES } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function RegisterRecyclerScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [address, setAddress] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
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
      Alert.alert("Error", "Failed to get location. Please enter manually.");
    }
  };

  const handleRegister = async () => {
    if (!companyName.trim()) {
      Alert.alert("Error", "Please enter your company name.");
      return;
    }
    if (!contactPerson.trim()) {
      Alert.alert("Error", "Please enter contact person name.");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number.");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Error", "Please enter a password.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }
    if (selectedCategories.length === 0) {
      Alert.alert("Error", "Please select at least one recycling category.");
      return;
    }

    setIsLoading(true);
    try {
      const success = await register({
        fullName: companyName.trim(),
        phone: phone.trim(),
        password: password,
        role: "recycler",
        location: {
          address: address.trim(),
          latitude: 0,
          longitude: 0,
        },
        // Store recycler-specific data
        contactPerson: contactPerson.trim(),
        email: email.trim(),
        registrationNumber: registrationNumber.trim(),
        recyclingCategories: selectedCategories,
      } as any);

      if (success) {
        Alert.alert(
          "Registration Successful",
          "Your recycling company account has been created. You can now place bulk orders.",
          [{ text: "OK", onPress: () => router.replace("/onboarding?role=recycler" as any) }]
        );
      } else {
        Alert.alert("Error", "Phone number already registered. Please login instead.");
      }
    } catch (error) {
      Alert.alert("Error", "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Header */}
          <View className="flex-row items-center px-6 pt-4 pb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <View>
              <Text className="text-2xl font-bold text-foreground">
                Recycler Registration
              </Text>
              <Text className="text-muted text-sm">
                Register your recycling company
              </Text>
            </View>
          </View>

          {/* Info Banner */}
          <View className="mx-6 mb-6 bg-primary/10 rounded-xl p-4 flex-row">
            <MaterialIcons name="recycling" size={24} color="#22C55E" />
            <View className="flex-1 ml-3">
              <Text className="text-foreground font-medium">
                Bulk Recycling Orders
              </Text>
              <Text className="text-muted text-sm mt-1">
                Register to order recyclable materials in bulk quantities (tons/kg) 
                for your recycling operations.
              </Text>
            </View>
          </View>

          {/* Form */}
          <View className="px-6">
            {/* Company Name */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Company Name *
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="business" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Your recycling company name"
                  placeholderTextColor="#9CA3AF"
                  value={companyName}
                  onChangeText={setCompanyName}
                />
              </View>
            </View>

            {/* Contact Person */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Contact Person *
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="person" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Full name of contact person"
                  placeholderTextColor="#9CA3AF"
                  value={contactPerson}
                  onChangeText={setContactPerson}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Phone Number */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Phone Number *
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="phone" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="e.g., 0960819993"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Email Address
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="email" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="company@email.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Registration Number */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Business Registration Number
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="badge" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Company registration number"
                  placeholderTextColor="#9CA3AF"
                  value={registrationNumber}
                  onChangeText={setRegistrationNumber}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Location */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Business Address
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="location-on" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Your business address"
                  placeholderTextColor="#9CA3AF"
                  value={address}
                  onChangeText={setAddress}
                  multiline
                />
              </View>
              <TouchableOpacity
                onPress={getCurrentLocation}
                className="mt-2 flex-row items-center justify-center bg-primary/10 rounded-xl py-3"
              >
                <MaterialIcons name="my-location" size={18} color="#22C55E" />
                <Text className="text-primary font-medium ml-2">
                  Use Current Location
                </Text>
              </TouchableOpacity>
            </View>

            {/* Recycling Categories */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Recycling Categories *
              </Text>
              <Text className="text-xs text-muted mb-3">
                Select the types of materials you recycle
              </Text>
              <View className="flex-row flex-wrap">
                {RECYCLING_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => toggleCategory(category.id)}
                    className={`mr-2 mb-2 px-4 py-2 rounded-full border-2 ${
                      selectedCategories.includes(category.id)
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface"
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        selectedCategories.includes(category.id)
                          ? "text-primary font-medium"
                          : "text-muted"
                      }`}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Password */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Password *
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="lock" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Create a password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialIcons
                    name={showPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">
                Confirm Password *
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="lock" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Confirm your password"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              className="bg-primary rounded-xl py-4 items-center mb-4"
              style={{ opacity: isLoading ? 0.7 : 1 }}
            >
              <Text className="text-white font-semibold text-lg">
                {isLoading ? "Creating Account..." : "Register Company"}
              </Text>
            </TouchableOpacity>

            {/* Login Link */}
            <View className="flex-row justify-center">
              <Text className="text-muted">Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/login" as any)}>
                <Text className="text-primary font-medium">Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
