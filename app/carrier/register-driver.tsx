import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, StyleSheet, Platform } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { ProfilePreviewModal } from "@/components/carrier/profile-preview-modal";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface DriverFormData {
  fullName: string;
  homeLocation: string;
  nrcNumber: string;
  vehicleType: string;
  customVehicleType: string;
  numberPlate: string;
  vehicleColor: string;
  vehicleModel: string;
  registrationValid: boolean;
}

interface PhotoData {
  driversLicense: string | null;
  nrcFrontImage: string | null;
  nrcBackImage: string | null;
  vehiclePhoto: string | null;
}

const VEHICLE_TYPES = ["Truck", "Van", "Pickup", "Motorbike", "Other – Enter Manually"];

export default function RegisterDriverScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<DriverFormData>({
    fullName: "",
    homeLocation: "",
    nrcNumber: "",
    vehicleType: "Truck",
    customVehicleType: "",
    numberPlate: "",
    vehicleColor: "",
    vehicleModel: "",
    registrationValid: true,
  });
  const [photos, setPhotos] = useState<PhotoData>({
    driversLicense: null,
    nrcFrontImage: null,
    nrcBackImage: null,
    vehiclePhoto: null,
  });
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginNrc, setLoginNrc] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [autoLoginChecking, setAutoLoginChecking] = useState(true);
  const [forgotMode, setForgotMode] = useState(false);
  const [recoveryName, setRecoveryName] = useState("");
  const [recoveryPlate, setRecoveryPlate] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Auto-login check on mount
  useEffect(() => {
    checkAutoLogin();
  }, []);

  const checkAutoLogin = async () => {
    try {
      const rememberFlag = await AsyncStorage.getItem("driver_remember_me");
      if (rememberFlag !== "true") {
        setAutoLoginChecking(false);
        return;
      }
      const activeDriver = await AsyncStorage.getItem("active_carrier_driver");
      if (activeDriver) {
        const driver = JSON.parse(activeDriver);
        // Status-driven navigation
        if (driver.status === "approved") {
          // Check if onboarding completed
          const onboardingDone = await AsyncStorage.getItem("driver_onboarding_completed");
          if (onboardingDone === "true") {
            router.replace("/carrier/portal" as any);
          } else {
            router.replace("/carrier/onboarding" as any);
          }
          return;
        } else if (driver.status === "pending_approval") {
          // DEV MODE: Skip approval waiting, go to portal
          // For production, uncomment: router.replace("/carrier/application-status" as any); return;
          router.replace("/carrier/portal" as any);
          return;
        } else if (driver.status === "rejected" || driver.status === "suspended") {
          router.replace("/carrier/application-status" as any);
          return;
        }
      }
    } catch (e) {
      // Ignore errors, proceed to registration screen
    }
    setAutoLoginChecking(false);
  };

  const handleForgotCredentials = async () => {
    if (!recoveryName.trim() || !recoveryPlate.trim()) {
      Alert.alert("Validation Error", "Please enter both your full name and vehicle plate number.");
      return;
    }
    setRecoveryLoading(true);
    try {
      const regStr = await AsyncStorage.getItem("driver_registration");
      const reg = regStr ? JSON.parse(regStr) : null;
      const listStr = await AsyncStorage.getItem("pending_driver_registrations");
      const list = listStr ? JSON.parse(listStr) : [];

      let matchedDriver = null;
      const nameNorm = recoveryName.trim().toLowerCase();
      const plateNorm = recoveryPlate.trim().toLowerCase();

      if (reg && reg.fullName?.toLowerCase() === nameNorm && reg.numberPlate?.toLowerCase() === plateNorm) {
        matchedDriver = reg;
      }
      if (!matchedDriver) {
        matchedDriver = list.find((d: any) =>
          d.fullName?.toLowerCase() === nameNorm && d.numberPlate?.toLowerCase() === plateNorm
        );
      }

      if (matchedDriver) {
        const maskedPhone = matchedDriver.phoneNumber
          ? matchedDriver.phoneNumber.slice(0, 4) + "****" + matchedDriver.phoneNumber.slice(-2)
          : "N/A";
        const maskedNrc = matchedDriver.nrcNumber
          ? matchedDriver.nrcNumber.slice(0, 3) + "****" + matchedDriver.nrcNumber.slice(-2)
          : "N/A";

        Alert.alert(
          "Account Found!",
          `We found your account:\n\nPhone: ${maskedPhone}\nNRC: ${maskedNrc}\nStatus: ${matchedDriver.status === "approved" ? "Active" : matchedDriver.status === "pending_approval" ? "Pending Review" : matchedDriver.status}\n\nWould you like to proceed?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: matchedDriver.status === "approved" ? "Go to Dashboard" : "OK",
              onPress: async () => {
                if (matchedDriver.status === "approved") {
                  await AsyncStorage.setItem("active_carrier_driver", JSON.stringify(matchedDriver));
                  await AsyncStorage.setItem("driver_remember_me", "true");
                  router.push("/carrier/portal" as any);
                }
                setForgotMode(false);
                setRecoveryName("");
                setRecoveryPlate("");
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Account Not Found",
          "No driver account matches that name and plate number combination. Please double-check your details or register a new account.",
          [{ text: "Register", onPress: () => { setForgotMode(false); setLoginMode(false); } }]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to search for your account. Please try again.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleDriverLogin = async () => {
    if (!loginPhone.trim()) {
      Alert.alert("Validation Error", "Please enter your phone number to log in.");
      return;
    }
    setLoginLoading(true);
    try {
      // Check carrier driver accounts
      const accountsStr = await AsyncStorage.getItem("carrier_driver_accounts");
      const accounts = accountsStr ? JSON.parse(accountsStr) : [];

      // Find matching driver by phone
      const matchedDriver = accounts.find((d: any) => d.phoneNumber === loginPhone.trim());

      if (matchedDriver) {
        // Save as active driver
        await AsyncStorage.setItem("active_carrier_driver", JSON.stringify(matchedDriver));
        if (rememberMe) {
          await AsyncStorage.setItem("driver_remember_me", "true");
        } else {
          await AsyncStorage.removeItem("driver_remember_me");
        }

        // Status-driven navigation
        if (matchedDriver.status === "approved") {
          // Check if onboarding completed
          const onboardingDone = await AsyncStorage.getItem("driver_onboarding_completed");
          const destination = onboardingDone === "true" ? "/carrier/portal" : "/carrier/onboarding";
          Alert.alert("Welcome Back!", `Hello ${matchedDriver.fullName}! Redirecting to your dashboard.`, [
            { text: "OK", onPress: () => router.push(destination as any) },
          ]);
        } else if (matchedDriver.status === "pending_approval") {
          // DEV MODE: Skip approval waiting, go to portal
          // For production, use: Alert.alert("Account Pending", "Your driver registration is still under review. Redirecting to application status.", [{ text: "OK", onPress: () => router.push("/carrier/application-status" as any) }]);
          Alert.alert("Welcome!", `Hello ${matchedDriver.fullName}! Redirecting to your dashboard.`, [
            { text: "OK", onPress: () => router.push("/carrier/portal" as any) },
          ]);
        } else if (matchedDriver.status === "rejected") {
          Alert.alert(
            "Account Rejected",
            "Your application was rejected. Redirecting to application status.",
            [{ text: "OK", onPress: () => router.push("/carrier/application-status" as any) }]
          );
        } else if (matchedDriver.status === "suspended") {
          Alert.alert(
            "Account Suspended",
            "Your account has been suspended. Redirecting to application status.",
            [{ text: "OK", onPress: () => router.push("/carrier/application-status" as any) }]
          );
        }
      } else {
        Alert.alert(
          "Account Not Found",
          "No carrier driver account found with this phone number. Please register first.",
          [{ text: "Register", onPress: () => router.push("/carrier/create-account" as any) }]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to verify account. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleInputChange = (field: keyof DriverFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async (field: keyof PhotoData) => {
    try {
      if (Platform.OS !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Camera roll access is needed to upload photos.");
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos((prev) => ({ ...prev, [field]: result.assets[0].uri }));
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const takePhoto = async (field: keyof PhotoData) => {
    try {
      if (Platform.OS === "web") {
        pickImage(field);
        return;
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera access is needed to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotos((prev) => ({ ...prev, [field]: result.assets[0].uri }));
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const removePhoto = (field: keyof PhotoData) => {
    setPhotos((prev) => ({ ...prev, [field]: null }));
  };

  const showPhotoOptions = (field: keyof PhotoData, label: string) => {
    if (Platform.OS === "web") {
      pickImage(field);
      return;
    }
    Alert.alert(`Upload ${label}`, "Choose an option", [
      { text: "Take Photo", onPress: () => takePhoto(field) },
      { text: "Choose from Gallery", onPress: () => pickImage(field) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const validateForm = (): boolean => {
    if (!formData.fullName.trim()) {
      Alert.alert("Validation Error", "Full Name is required");
      return false;
    }
    if (!formData.homeLocation.trim()) {
      Alert.alert("Validation Error", "Home Location is required");
      return false;
    }
    if (!formData.nrcNumber.trim()) {
      Alert.alert("Validation Error", "NRC Number is required");
      return false;
    }
    if (!formData.numberPlate.trim()) {
      Alert.alert("Validation Error", "Number Plate is required");
      return false;
    }
    if (!formData.vehicleColor.trim()) {
      Alert.alert("Validation Error", "Vehicle Color is required");
      return false;
    }
    if (!formData.vehicleModel.trim()) {
      Alert.alert("Validation Error", "Vehicle Model is required");
      return false;
    }
    if (!photos.driversLicense) {
      Alert.alert("Validation Error", "Driver's License photo is required");
      return false;
    }
    if (!photos.nrcFrontImage) {
      Alert.alert("Validation Error", "NRC FRONT photo is required");
      return false;
    }
    if (!photos.nrcBackImage) {
      Alert.alert("Validation Error", "NRC BACK photo is required");
      return false;
    }
    if (formData.vehicleType === "Other – Enter Manually" && !formData.customVehicleType.trim()) {
      Alert.alert("Validation Error", "Please enter your custom vehicle type");
      return false;
    }
    if (!photos.vehiclePhoto) {
      Alert.alert("Validation Error", "Vehicle photo is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Get account data from previous step
      const tempAccountStr = await AsyncStorage.getItem("temp_driver_account");
      if (!tempAccountStr) {
        Alert.alert("Error", "Account data not found. Please start from account creation.");
        router.push("/carrier/create-account" as any);
        return;
      }

      const accountData = JSON.parse(tempAccountStr);
      const id = `driver_${Date.now()}`;
      
      const completeDriverData = {
        id,
        // Account data
        phoneNumber: accountData.phoneNumber,
        password: accountData.password,
        role: accountData.role,
        // Personal + Vehicle data
        ...formData,
        photos: {
          driversLicense: photos.driversLicense,
          nrcFrontImage: photos.nrcFrontImage,
          nrcBackImage: photos.nrcBackImage,
          vehiclePhoto: photos.vehiclePhoto,
        },
        registeredAt: new Date().toISOString(),
        status: "approved", // DEV MODE: Auto-approve for development. Change to "pending_approval" for production.
      };

      // Save to carrier driver accounts list
      const accountsStr = await AsyncStorage.getItem("carrier_driver_accounts");
      const accounts = accountsStr ? JSON.parse(accountsStr) : [];
      accounts.push(completeDriverData);
      await AsyncStorage.setItem("carrier_driver_accounts", JSON.stringify(accounts));

      // Save individual registration
      await AsyncStorage.setItem("driver_registration", JSON.stringify(completeDriverData));

      // Also add to pending registrations list for admin
      const existingList = await AsyncStorage.getItem("pending_driver_registrations");
      const list = existingList ? JSON.parse(existingList) : [];
      list.push(completeDriverData);
      await AsyncStorage.setItem("pending_driver_registrations", JSON.stringify(list));

      // Set as active driver (pending status)
      await AsyncStorage.setItem("active_carrier_driver", JSON.stringify(completeDriverData));
      
      // Save remember me preference
      if (accountData.rememberMe) {
        await AsyncStorage.setItem("driver_remember_me", "true");
      }

      // Clear temp account data
      await AsyncStorage.removeItem("temp_driver_account");

      // DEV MODE: Auto-redirect to portal (skip approval waiting)
      // For production, change to: router.replace("/carrier/application-status" as any);
      router.replace("/carrier/portal" as any);
    } catch (error) {
      Alert.alert("Error", "Failed to save registration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderPhotoUpload = (field: keyof PhotoData, label: string, icon: string) => {
    const photoUri = photos[field];
    return (
      <View className="mb-4">
        <Text className="text-sm font-medium text-foreground mb-2">{label} *</Text>
        {photoUri ? (
          <View className="bg-surface border border-border rounded-lg overflow-hidden">
            <Image
              source={{ uri: photoUri }}
              style={styles.previewImage}
              contentFit="cover"
            />
            <View className="flex-row p-2 gap-2">
              <TouchableOpacity
                onPress={() => showPhotoOptions(field, label)}
                className="flex-1 bg-blue-600 rounded-lg py-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="refresh" size={16} color="#fff" />
                <Text className="text-white text-xs font-medium ml-1">Replace</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removePhoto(field)}
                className="flex-1 bg-red-600 rounded-lg py-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="delete" size={16} color="#fff" />
                <Text className="text-white text-xs font-medium ml-1">Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => showPhotoOptions(field, label)}
            className="bg-surface border-2 border-dashed border-border rounded-lg py-8 items-center justify-center"
          >
            <MaterialIcons name={icon as any} size={36} color="#9BA1A6" />
            <Text className="text-muted text-sm mt-2">Tap to upload {label.toLowerCase()}</Text>
            <Text className="text-muted/60 text-xs mt-1">JPG, PNG (max 5MB)</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">Personal Details</Text>
          </View>

        </View>

        {/* Info Card */}
        <View className="px-6 mb-6">
          <View className="bg-blue-600 rounded-2xl p-4">
            <Text className="text-white text-sm leading-5">
              Complete your driver profile to start accepting carrier jobs and earn money transporting goods. All documents will be verified by our admin team.
            </Text>
          </View>
        </View>

        {/* Personal Details Section */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Personal Details</Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Full Name *</Text>
            <TextInput
              placeholder="Enter your full name"
              placeholderTextColor="#9BA1A6"
              value={formData.fullName}
              onChangeText={(text) => handleInputChange("fullName", text)}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              style={styles.input}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Home Location *</Text>
            <View className="flex-row gap-2">
              <TextInput
                placeholder="Enter your home address"
                placeholderTextColor="#9BA1A6"
                value={formData.homeLocation}
                onChangeText={(text) => handleInputChange("homeLocation", text)}
                className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => Alert.alert("GPS Location", "GPS location picker will be integrated with Google Maps API")}
                className="bg-primary rounded-lg px-4 py-3 items-center justify-center"
              >
                <MaterialIcons name="my-location" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-muted mt-1">
              Use GPS or search address manually (Google Maps API ready)
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">NRC Number *</Text>
            <TextInput
              placeholder="Enter your NRC/ID number"
              placeholderTextColor="#9BA1A6"
              value={formData.nrcNumber}
              onChangeText={(text) => handleInputChange("nrcNumber", text)}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              style={styles.input}
            />
          </View>
        </View>

        {/* Document Uploads Section */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Document Uploads</Text>
          {renderPhotoUpload("driversLicense", "Driver's License", "badge")}
          {renderPhotoUpload("nrcFrontImage", "NRC FRONT (Required)", "credit-card")}
          {renderPhotoUpload("nrcBackImage", "NRC BACK (Required)", "credit-card")}
        </View>

        {/* Vehicle Details Section */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Vehicle Details</Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Vehicle Type *</Text>
            <TouchableOpacity
              onPress={() => setShowVehicleDropdown(!showVehicleDropdown)}
              className="bg-surface border border-border rounded-lg px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-foreground">{formData.vehicleType}</Text>
              <MaterialIcons
                name={showVehicleDropdown ? "expand-less" : "expand-more"}
                size={24}
                color="#ECEDEE"
              />
            </TouchableOpacity>
            {showVehicleDropdown && (
              <View className="bg-surface border border-border border-t-0 rounded-b-lg">
                {VEHICLE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      handleInputChange("vehicleType", type);
                      setShowVehicleDropdown(false);
                    }}
                    className="px-4 py-3 border-b border-border"
                  >
                    <Text className="text-foreground">{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {formData.vehicleType === "Other – Enter Manually" && (
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Vehicle Type Name *</Text>
              <TextInput
                placeholder="Enter your vehicle type"
                placeholderTextColor="#9BA1A6"
                value={formData.customVehicleType}
                onChangeText={(text) => handleInputChange("customVehicleType", text)}
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                style={styles.input}
              />
            </View>
          )}

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Number Plate *</Text>
            <TextInput
              placeholder="e.g., ZMB 1234"
              placeholderTextColor="#9BA1A6"
              value={formData.numberPlate}
              onChangeText={(text) => handleInputChange("numberPlate", text.toUpperCase())}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              style={styles.input}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Vehicle Color *</Text>
            <TextInput
              placeholder="e.g., White, Black, Red"
              placeholderTextColor="#9BA1A6"
              value={formData.vehicleColor}
              onChangeText={(text) => handleInputChange("vehicleColor", text)}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              style={styles.input}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Vehicle Model *</Text>
            <TextInput
              placeholder="e.g., Toyota Hilux, Isuzu NPR"
              placeholderTextColor="#9BA1A6"
              value={formData.vehicleModel}
              onChangeText={(text) => handleInputChange("vehicleModel", text)}
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              style={styles.input}
            />
          </View>

          <View className="mb-4 flex-row items-center justify-between bg-surface border border-border rounded-lg px-4 py-3">
            <Text className="text-sm font-medium text-foreground">Vehicle Registration Valid</Text>
            <TouchableOpacity
              onPress={() => setFormData((prev) => ({ ...prev, registrationValid: !prev.registrationValid }))}
              className={`w-12 h-7 rounded-full flex-row items-center px-1 ${
                formData.registrationValid ? "bg-green-600" : "bg-gray-400"
              }`}
            >
              <View
                className={`w-5 h-5 rounded-full bg-white ${
                  formData.registrationValid ? "ml-auto" : ""
                }`}
              />
            </TouchableOpacity>
          </View>

          {/* Vehicle Photo Upload */}
          {renderPhotoUpload("vehiclePhoto", "Vehicle Photo", "directions-car")}
        </View>

        {/* Preview Profile Button */}
        <View className="px-6 mb-4">
          <TouchableOpacity
            onPress={() => setShowPreviewModal(true)}
            className="bg-green-600 rounded-lg py-4 items-center"
          >
            <Text className="text-white font-semibold text-base">Preview Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="bg-blue-600 rounded-lg py-4 items-center"
            style={loading ? { opacity: 0.6 } : undefined}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? "Submitting Application..." : "Submit Application"}
            </Text>
          </TouchableOpacity>

          <Text className="text-xs text-muted text-center mt-4">
            Your registration and documents will be reviewed by our admin team. You will receive a notification once approved.
          </Text>
        </View>

        {/* Login Section */}
        <View className="px-6 mb-8">
          {loginMode && (
            <View className="bg-surface border border-border rounded-2xl p-5">
              <View className="flex-row items-center mb-4">
                <MaterialIcons name="verified-user" size={24} color="#22C55E" />
                <Text className="text-lg font-semibold text-foreground ml-2">Driver Login</Text>
              </View>
              <Text className="text-muted text-sm mb-4">
                Enter your phone number to access your driver dashboard.
              </Text>

              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Phone Number *</Text>
                <TextInput
                  placeholder="Enter registered phone number"
                  placeholderTextColor="#9BA1A6"
                  value={loginPhone}
                  onChangeText={setLoginPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  className="bg-background border border-border rounded-lg px-4 py-3 text-foreground"
                  style={styles.input}
                />
              </View>

              {/* Remember Me Toggle */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-sm text-foreground">Remember Me</Text>
                <TouchableOpacity
                  onPress={() => setRememberMe(!rememberMe)}
                  className={`w-12 h-7 rounded-full flex-row items-center px-1 ${rememberMe ? "bg-green-600" : "bg-gray-400"}`}
                >
                  <View className={`w-5 h-5 rounded-full bg-white ${rememberMe ? "ml-auto" : ""}`} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleDriverLogin}
                disabled={loginLoading}
                className="bg-green-600 rounded-lg py-4 items-center flex-row justify-center mb-3"
                style={loginLoading ? { opacity: 0.6 } : undefined}
              >
                <MaterialIcons name="login" size={20} color="#fff" />
                <Text className="text-white font-semibold text-base ml-2">
                  {loginLoading ? "Verifying..." : "Log In to Dashboard"}
                </Text>
              </TouchableOpacity>

              {/* Forgot Credentials */}
              {!forgotMode ? (
                <TouchableOpacity
                  onPress={() => setForgotMode(true)}
                  className="py-2 items-center mb-2"
                >
                  <Text className="text-blue-400 text-sm">Forgot your details?</Text>
                </TouchableOpacity>
              ) : (
                <View className="bg-background border border-border rounded-xl p-4 mb-3">
                  <View className="flex-row items-center mb-3">
                    <MaterialIcons name="help-outline" size={20} color="#60A5FA" />
                    <Text className="text-sm font-semibold text-foreground ml-2">Recover Account</Text>
                  </View>
                  <Text className="text-muted text-xs mb-3">
                    Enter your full name and vehicle plate number to find your account.
                  </Text>
                  <View className="mb-3">
                    <TextInput
                      placeholder="Full Name (as registered)"
                      placeholderTextColor="#9BA1A6"
                      value={recoveryName}
                      onChangeText={setRecoveryName}
                      returnKeyType="next"
                      className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                      style={styles.input}
                    />
                  </View>
                  <View className="mb-3">
                    <TextInput
                      placeholder="Vehicle Plate Number"
                      placeholderTextColor="#9BA1A6"
                      value={recoveryPlate}
                      onChangeText={setRecoveryPlate}
                      autoCapitalize="characters"
                      returnKeyType="done"
                      className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                      style={styles.input}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleForgotCredentials}
                    disabled={recoveryLoading}
                    className="bg-blue-600 rounded-lg py-3 items-center mb-2"
                    style={recoveryLoading ? { opacity: 0.6 } : undefined}
                  >
                    <Text className="text-white font-semibold text-sm">
                      {recoveryLoading ? "Searching..." : "Find My Account"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setForgotMode(false); setRecoveryName(""); setRecoveryPlate(""); }}
                    className="py-1 items-center"
                  >
                    <Text className="text-muted text-xs">Back to Login</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  setLoginMode(false);
                  setLoginPhone("");
                  setLoginNrc("");
                  setForgotMode(false);
                }}
                className="py-2 items-center"
              >
                <Text className="text-muted text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Profile Preview Modal */}
      <ProfilePreviewModal
        visible={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        formData={formData}
        photos={photos}
        onEdit={() => setShowPreviewModal(false)}
      />
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  input: {
    color: "#ECEDEE",
  },
  previewImage: {
    width: "100%",
    height: _rs.s(180),
  },
});
