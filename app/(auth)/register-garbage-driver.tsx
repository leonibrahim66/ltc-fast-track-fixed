/**
 * Garbage Collection Driver Registration
 *
 * Step 1: Account Info — First Name, Last Name, Phone, Password, Confirm Password,
 *         NRC Number, NRC Document Upload, Driver License Number, Vehicle Plate Number
 * Step 2: Invite Code — Enter code provided by Zone Manager
 *         Links driver to zone_manager_id automatically
 *         Sets status = "pending_manager_approval"
 */
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useInviteCodes } from "@/lib/invite-codes-context";
import * as Haptics from "expo-haptics";

const DRIVER_ORANGE = "#EA580C";

export default function RegisterGarbageDriverScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { validateCode, consumeCode } = useInviteCodes();

  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1 fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [nrcNumber, setNrcNumber] = useState("");
  const [nrcDocumentUri, setNrcDocumentUri] = useState<string | null>(null);
  const [driverLicenseNumber, setDriverLicenseNumber] = useState("");
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState("");

  // Step 2 fields
  const [inviteCode, setInviteCode] = useState("");
  const [resolvedManagerId, setResolvedManagerId] = useState<string | null>(null);
  const [resolvedZoneManagerName, setResolvedZoneManagerName] = useState<string | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);

  const pickNrcDocument = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your photo library to upload your NRC.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setNrcDocumentUri(result.assets[0].uri);
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (_e) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const validateStep1 = (): boolean => {
    if (!firstName.trim()) { Alert.alert("Required", "Please enter your first name."); return false; }
    if (!lastName.trim()) { Alert.alert("Required", "Please enter your last name."); return false; }
    if (!phone.trim() || phone.trim().length < 9) { Alert.alert("Required", "Please enter a valid phone number."); return false; }
    if (!password || password.length < 6) { Alert.alert("Required", "Password must be at least 6 characters."); return false; }
    if (password !== confirmPassword) { Alert.alert("Error", "Passwords do not match."); return false; }
    if (!nrcNumber.trim()) { Alert.alert("Required", "Please enter your NRC number."); return false; }
    if (!driverLicenseNumber.trim()) { Alert.alert("Required", "Please enter your driver license number."); return false; }
    if (!vehiclePlateNumber.trim()) { Alert.alert("Required", "Please enter your vehicle plate number."); return false; }
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep1()) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(2);
  };

  const validateInviteCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert("Required", "Please enter the invite code provided by your Zone Manager.");
      return;
    }
    setIsValidatingCode(true);
    try {
      const codeUpper = inviteCode.trim().toUpperCase();

      // Primary: validate via InviteCodesContext (driver_invite_codes model)
      const result = await validateCode(codeUpper);
      if (result.valid && result.inviteCode) {
        setResolvedManagerId(result.inviteCode.zoneManagerId);
        setResolvedZoneManagerName(result.inviteCode.zoneManagerName);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // Fallback: check legacy @ltc_invite_codes store
      const inviteCodesRaw = await AsyncStorage.getItem("@ltc_invite_codes");
      const inviteCodes: Record<string, { managerId: string; managerName: string; zoneId?: string }> =
        inviteCodesRaw ? JSON.parse(inviteCodesRaw) : {};
      if (inviteCodes[codeUpper]) {
        const { managerId, managerName } = inviteCodes[codeUpper];
        setResolvedManagerId(managerId);
        setResolvedZoneManagerName(managerName);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // Fallback: check zone_manager profile generatedInviteCode
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const users: Record<string, unknown>[] = usersRaw ? JSON.parse(usersRaw) : [];
      const manager = users.find(
        (u) =>
          (u.role === "zone_manager" || u.role === "collector") &&
          (u.generatedInviteCode as string)?.toUpperCase() === codeUpper
      );
      if (manager) {
        setResolvedManagerId(manager.id as string);
        setResolvedZoneManagerName((manager.fullName as string) || "Zone Manager");
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      // All checks failed
      setResolvedManagerId(null);
      setResolvedZoneManagerName(null);
      const errMsg = result.error ?? "This invite code is not valid, has expired, or has reached its usage limit.";
      Alert.alert("Invalid Code", errMsg);
      // Note: consumeCode is called after successful registration to increment usedCount
    } catch (_e) {
      Alert.alert("Error", "Failed to validate invite code. Please try again.");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleSubmit = async () => {
    if (!resolvedManagerId) {
      Alert.alert("Required", "Please validate your invite code before registering.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await register({
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        password,
        role: "garbage_driver",
        status: "pending_review",
        driverStatus: "pending_manager_approval",
        kycStatus: "pending",
        nrcNumber: nrcNumber.trim(),
        nrcDocumentUri: nrcDocumentUri ?? undefined,
        driverLicenseNumber: driverLicenseNumber.trim(),
        vehiclePlateNumber: vehiclePlateNumber.trim(),
        zoneManagerId: resolvedManagerId,
        inviteCode: inviteCode.trim().toUpperCase(),
        isOnline: false,
        pickupsToday: 0,
        driverRating: 0,
      });

      if (success) {
        // Increment invite code usedCount
        await consumeCode(inviteCode.trim().toUpperCase());

        // Log activity
        await logActivity({
          type: "driver_registered",
          driverName: `${firstName.trim()} ${lastName.trim()}`,
          driverPhone: phone.trim(),
          managerId: resolvedManagerId,
          managerName: resolvedZoneManagerName ?? "Zone Manager",
          timestamp: new Date().toISOString(),
        });

        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Registration Submitted",
          `Your application has been sent to ${resolvedZoneManagerName ?? "your Zone Manager"} for approval.\n\nYou will be notified once approved.`,
          [{ text: "OK", onPress: () => router.replace("/(garbage-driver)/waiting-approval" as any) }]
        );
      } else {
        Alert.alert("Registration Failed", "This phone number is already registered. Please use a different number or login.");
      }
    } catch (_e) {
      Alert.alert("Error", "Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View style={{ backgroundColor: DRIVER_ORANGE }} className="px-6 pt-4 pb-5">
          <View className="flex-row items-center mb-3">
            <TouchableOpacity
              onPress={() => (step === 2 ? setStep(1) : router.back())}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
            >
              <MaterialIcons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">Garbage Collection Driver</Text>
              <Text className="text-white/80 text-sm">Registration</Text>
            </View>
          </View>

          {/* Step indicator */}
          <View className="flex-row items-center gap-2">
            {[1, 2].map((s) => (
              <View key={s} className="flex-row items-center">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    step >= s ? "bg-white" : "bg-white/30"
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      step >= s ? "text-orange-600" : "text-white"
                    }`}
                  >
                    {s}
                  </Text>
                </View>
                {s < 2 && (
                  <View className={`h-0.5 w-12 mx-1 ${step > s ? "bg-white" : "bg-white/30"}`} />
                )}
              </View>
            ))}
            <Text className="text-white/80 text-sm ml-2">
              {step === 1 ? "Account & Documents" : "Invite Code"}
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <View className="gap-4">
              <Text className="text-foreground font-bold text-lg mb-1">Personal Information</Text>

              {/* First Name & Last Name */}
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-medium mb-1">First Name *</Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First name"
                    placeholderTextColor="#9BA1A6"
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    autoCapitalize="words"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-medium mb-1">Last Name *</Text>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last name"
                    placeholderTextColor="#9BA1A6"
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Phone */}
              <View>
                <Text className="text-foreground text-sm font-medium mb-1">Phone Number *</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+260 97X XXX XXX"
                  placeholderTextColor="#9BA1A6"
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  keyboardType="phone-pad"
                />
              </View>

              {/* Password */}
              <View>
                <Text className="text-foreground text-sm font-medium mb-1">Password *</Text>
                <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor="#9BA1A6"
                    className="flex-1 py-3 text-foreground"
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={20} color="#9BA1A6" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View>
                <Text className="text-foreground text-sm font-medium mb-1">Confirm Password *</Text>
                <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Re-enter password"
                    placeholderTextColor="#9BA1A6"
                    className="flex-1 py-3 text-foreground"
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <MaterialIcons name={showConfirmPassword ? "visibility-off" : "visibility"} size={20} color="#9BA1A6" />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="border-t border-border pt-4">
                <Text className="text-foreground font-bold text-lg mb-3">Documents & Vehicle</Text>
              </View>

              {/* NRC Number */}
              <View>
                <Text className="text-foreground text-sm font-medium mb-1">NRC Number *</Text>
                <TextInput
                  value={nrcNumber}
                  onChangeText={setNrcNumber}
                  placeholder="e.g. 123456/78/9"
                  placeholderTextColor="#9BA1A6"
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  autoCapitalize="characters"
                />
              </View>

              {/* NRC Document Upload */}
              <View>
                <Text className="text-foreground text-sm font-medium mb-1">NRC Document Upload</Text>
                <TouchableOpacity
                  onPress={pickNrcDocument}
                  className="bg-surface border border-dashed border-orange-400 rounded-xl p-4 items-center"
                >
                  {nrcDocumentUri ? (
                    <View className="items-center">
                      <Image
                        source={{ uri: nrcDocumentUri }}
                        style={{ width: 120, height: 80, borderRadius: 8 }}
                        resizeMode="cover"
                      />
                      <Text className="text-orange-600 text-sm font-medium mt-2">NRC uploaded ✓</Text>
                      <Text className="text-muted text-xs">Tap to change</Text>
                    </View>
                  ) : (
                    <View className="items-center">
                      <MaterialIcons name="upload-file" size={32} color="#EA580C" />
                      <Text className="text-foreground font-medium text-sm mt-2">Upload NRC Photo</Text>
                      <Text className="text-muted text-xs mt-1">Tap to select from gallery</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Driver License Number */}
              <View>
                <Text className="text-foreground text-sm font-medium mb-1">Driver License Number *</Text>
                <TextInput
                  value={driverLicenseNumber}
                  onChangeText={setDriverLicenseNumber}
                  placeholder="e.g. DL-123456"
                  placeholderTextColor="#9BA1A6"
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  autoCapitalize="characters"
                />
              </View>

              {/* Vehicle Plate Number */}
              <View>
                <Text className="text-foreground text-sm font-medium mb-1">Vehicle Plate Number *</Text>
                <TextInput
                  value={vehiclePlateNumber}
                  onChangeText={setVehiclePlateNumber}
                  placeholder="e.g. ALB 1234"
                  placeholderTextColor="#9BA1A6"
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  autoCapitalize="characters"
                />
              </View>

              <TouchableOpacity
                onPress={handleNextStep}
                style={{ backgroundColor: DRIVER_ORANGE }}
                className="rounded-xl py-4 items-center mt-2 mb-6"
              >
                <Text className="text-white font-bold text-base">Continue to Step 2</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="gap-4">
              {/* Summary card */}
              <View className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-2">
                <View className="flex-row items-center mb-2">
                  <MaterialIcons name="check-circle" size={20} color="#EA580C" />
                  <Text className="text-orange-900 font-semibold ml-2">Account Details Saved</Text>
                </View>
                <Text className="text-orange-700 text-sm">
                  {firstName} {lastName} · {phone}
                </Text>
                <Text className="text-orange-700 text-sm">
                  NRC: {nrcNumber} · License: {driverLicenseNumber} · Plate: {vehiclePlateNumber}
                </Text>
              </View>

              <Text className="text-foreground font-bold text-lg">Enter Invite Code</Text>
              <Text className="text-muted text-sm">
                Ask your Zone Manager for an invite code. This links your account to their zone automatically.
              </Text>

              {/* Invite Code Input */}
              <View>
                <Text className="text-foreground text-sm font-medium mb-1">Invite Code *</Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={inviteCode}
                    onChangeText={(v) => {
                      setInviteCode(v.toUpperCase());
                      setResolvedManagerId(null);
                      setResolvedZoneManagerName(null);
                    }}
                    placeholder="e.g. ZM-ABC123"
                    placeholderTextColor="#9BA1A6"
                    className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-foreground font-mono"
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={validateInviteCode}
                  />
                  <TouchableOpacity
                    onPress={validateInviteCode}
                    disabled={isValidatingCode}
                    style={{ backgroundColor: DRIVER_ORANGE }}
                    className="rounded-xl px-4 py-3 items-center justify-center"
                  >
                    {isValidatingCode ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-white font-bold">Verify</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Resolved Manager */}
              {resolvedManagerId && resolvedZoneManagerName && (
                <View className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <View className="flex-row items-center">
                    <MaterialIcons name="verified" size={22} color="#16A34A" />
                    <View className="ml-3">
                      <Text className="text-green-900 font-semibold text-sm">Code Verified!</Text>
                      <Text className="text-green-700 text-sm">
                        Zone Manager: {resolvedZoneManagerName}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Info box */}
              <View className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <View className="flex-row items-start">
                  <MaterialIcons name="info" size={18} color="#3B82F6" />
                  <Text className="text-blue-800 text-sm ml-2 flex-1">
                    After registration, your Zone Manager will review and approve your application. You will be able to start accepting pickups once approved.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting || !resolvedManagerId}
                style={{ backgroundColor: resolvedManagerId ? DRIVER_ORANGE : "#D1D5DB" }}
                className="rounded-xl py-4 items-center mt-2 mb-6"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">Submit Registration</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// Activity logging helper
async function logActivity(entry: {
  type: string;
  driverName: string;
  driverPhone: string;
  managerId: string;
  managerName: string;
  timestamp: string;
}) {
  try {
    const logsRaw = await AsyncStorage.getItem("@ltc_activity_logs");
    const logs: any[] = logsRaw ? JSON.parse(logsRaw) : [];
    logs.unshift({ id: `log_${Date.now()}`, ...entry });
    // Keep last 500 entries
    if (logs.length > 500) logs.splice(500);
    await AsyncStorage.setItem("@ltc_activity_logs", JSON.stringify(logs));
  } catch (_e) {
    // Non-critical
  }
}
