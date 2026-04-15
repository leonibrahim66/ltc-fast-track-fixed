import { useState, useEffect } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useBiometric, getBiometricLabel } from "@/lib/biometric-context";
import { APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

import { getStaticResponsive } from "@/hooks/use-responsive";
type AuthRole = "customer" | "carrier_driver" | "collector" | "zone_manager" | "recycler" | "garbage_driver";
type AuthMode = "login" | "select-property" | "register" | "register-location";
type PropertyType = "residential" | "commercial" | "industrial";

// Zambia provinces and towns data for customer registration
const ZAMBIA_PROVINCES_DATA = [
  { id: "central", name: "Central" },
  { id: "copperbelt", name: "Copperbelt" },
  { id: "eastern", name: "Eastern" },
  { id: "luapula", name: "Luapula" },
  { id: "lusaka", name: "Lusaka" },
  { id: "muchinga", name: "Muchinga" },
  { id: "northern", name: "Northern" },
  { id: "north_western", name: "North-Western" },
  { id: "southern", name: "Southern" },
  { id: "western", name: "Western" },
];

const TOWNS_BY_PROVINCE_DATA: Record<string, { id: string; name: string }[]> = {
  central: [{ id: "kabwe", name: "Kabwe" }, { id: "kapiri_mposhi", name: "Kapiri Mposhi" }, { id: "mkushi", name: "Mkushi" }, { id: "serenje", name: "Serenje" }, { id: "mumbwa", name: "Mumbwa" }],
  copperbelt: [{ id: "kitwe", name: "Kitwe" }, { id: "ndola", name: "Ndola" }, { id: "chingola", name: "Chingola" }, { id: "mufulira", name: "Mufulira" }, { id: "luanshya", name: "Luanshya" }, { id: "kalulushi", name: "Kalulushi" }, { id: "chililabombwe", name: "Chililabombwe" }],
  eastern: [{ id: "chipata", name: "Chipata" }, { id: "petauke", name: "Petauke" }, { id: "lundazi", name: "Lundazi" }, { id: "katete", name: "Katete" }],
  luapula: [{ id: "mansa", name: "Mansa" }, { id: "nchelenge", name: "Nchelenge" }, { id: "kawambwa", name: "Kawambwa" }, { id: "samfya", name: "Samfya" }],
  lusaka: [{ id: "lusaka_cbd", name: "Lusaka CBD" }, { id: "chilanga", name: "Chilanga" }, { id: "kafue", name: "Kafue" }, { id: "chongwe", name: "Chongwe" }, { id: "luangwa", name: "Luangwa" }],
  muchinga: [{ id: "chinsali", name: "Chinsali" }, { id: "mpika", name: "Mpika" }, { id: "nakonde", name: "Nakonde" }],
  northern: [{ id: "kasama", name: "Kasama" }, { id: "mbala", name: "Mbala" }, { id: "mpulungu", name: "Mpulungu" }, { id: "mungwi", name: "Mungwi" }],
  north_western: [{ id: "solwezi", name: "Solwezi" }, { id: "kasempa", name: "Kasempa" }, { id: "mwinilunga", name: "Mwinilunga" }, { id: "zambezi", name: "Zambezi" }],
  southern: [{ id: "livingstone", name: "Livingstone" }, { id: "choma", name: "Choma" }, { id: "mazabuka", name: "Mazabuka" }, { id: "monze", name: "Monze" }, { id: "siavonga", name: "Siavonga" }],
  western: [{ id: "mongu", name: "Mongu" }, { id: "kaoma", name: "Kaoma" }, { id: "senanga", name: "Senanga" }, { id: "sesheke", name: "Sesheke" }],
};

// Zone matching: search AsyncStorage zones by province/city/area
const matchZoneForCustomer = async (
  provinceId: string,
  cityId: string,
  areaName: string
): Promise<{ zoneId: string | null; status: "matched" | "unassigned" }> => {
  try {
    const zonesRaw = await AsyncStorage.getItem("@ltc_zones");
    if (!zonesRaw) return { zoneId: null, status: "unassigned" };
    const zones: Array<{ id: string; province?: string; town?: string; name?: string }> = JSON.parse(zonesRaw);
    const match = zones.find(
      (z) =>
        z.province?.toLowerCase() === provinceId.toLowerCase() &&
        (z.town?.toLowerCase() === cityId.toLowerCase() || z.town?.toLowerCase().includes(areaName.toLowerCase()) || areaName.toLowerCase().includes((z.name || "").toLowerCase()))
    );
    if (match) return { zoneId: match.id, status: "matched" };
    return { zoneId: null, status: "unassigned" };
  } catch {
    return { zoneId: null, status: "unassigned" };
  }
};

const ROLE_CONFIG: Record<AuthRole, {
  title: string;
  icon: string;
  color: string;
  registerRoute: string | null;
  dashboardRoute: string;
  dbRole: string;
  description: string;
}> = {
  customer: {
    title: "Customer",
    icon: "person",
    color: "#22C55E",
    registerRoute: null, // inline register
    dashboardRoute: "/(tabs)",
    dbRole: "residential",
    description: "Request garbage pickups and carrier services",
  },
  carrier_driver: {
    title: "Carrier Driver",
    icon: "local-shipping",
    color: "#3B82F6",
    registerRoute: "/carrier/create-account",
    dashboardRoute: "/carrier/portal",
    dbRole: "driver",
    description: "Accept transport jobs for goods and cargo",
  },
  collector: {
    title: "Zone Manager",
    icon: "manage-accounts",
    color: "#1B5E20",
    registerRoute: "/(auth)/register-collector",
    dashboardRoute: "/(collector)",
    dbRole: "zone_manager",
    description: "Manage zones, drivers, and household subscriptions",
  },
  zone_manager: {
    title: "Zone Manager",
    icon: "manage-accounts",
    color: "#1B5E20",
    registerRoute: "/(auth)/register-collector",
    dashboardRoute: "/(collector)",
    dbRole: "zone_manager",
    description: "Manage zones, drivers, and household subscriptions",
  },
  recycler: {
    title: "Recycling Company",
    icon: "recycling",
    color: "#8B5CF6",
    registerRoute: "/(auth)/register-recycler",
    dashboardRoute: "/recycler-dashboard",
    dbRole: "recycler",
    description: "Manage recycling orders and materials",
  },
  garbage_driver: {
    title: "Garbage Collection Driver",
    icon: "delete",
    color: "#EA580C",
    registerRoute: "/(auth)/register-garbage-driver",
    dashboardRoute: "/(garbage-driver)",
    dbRole: "garbage_driver",
    description: "Collect garbage from households in your assigned zone",
  },
};

const REMEMBER_ME_KEY = "@ltc_remember_me";
const SAVED_CREDENTIALS_KEY = "@ltc_saved_credentials";
const LAST_ROLE_KEY = "@ltc_last_role";

export default function RoleAuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role: string }>();
  const role = (params.role || "customer") as AuthRole;
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.customer;

  const { login, register, user } = useAuth();
  const { isEnabled, isSupported, biometricType, authenticateWithBiometric } = useBiometric();

  const [mode, setMode] = useState<AuthMode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [selectedPropertyType, setSelectedPropertyType] = useState<PropertyType | null>(null);
  // Customer location Step 2 state
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedProvinceName, setSelectedProvinceName] = useState("");
  const [selectedCityId, setSelectedCityId] = useState("");
  const [selectedCityName, setSelectedCityName] = useState("");
  const [areaName, setAreaName] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const biometricLabel = getBiometricLabel(biometricType);
  const biometricIcon = biometricType === "facial" ? "face" : "fingerprint";

  // Load saved credentials on mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  // Auto-prompt biometric on mount if enabled (login mode only)
  useEffect(() => {
    if (isEnabled && isSupported && mode === "login") {
      const timer = setTimeout(() => {
        handleBiometricLogin();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isEnabled, isSupported]);

  const loadSavedCredentials = async () => {
    try {
      const savedRole = await AsyncStorage.getItem(LAST_ROLE_KEY);
      const savedRememberMe = await AsyncStorage.getItem(`${REMEMBER_ME_KEY}_${role}`);
      if (savedRememberMe === "true") {
        setRememberMe(true);
        const savedCredentials = await AsyncStorage.getItem(`${SAVED_CREDENTIALS_KEY}_${role}`);
        if (savedCredentials) {
          const { phone: savedPhone, password: savedPassword } = JSON.parse(savedCredentials);
          setPhone(savedPhone || "");
          setPassword(savedPassword || "");
        }
      }
    } catch (error) {
      console.error("Error loading saved credentials:", error);
    }
  };

  const saveCredentials = async () => {
    try {
      await AsyncStorage.setItem(LAST_ROLE_KEY, role);
      if (rememberMe) {
        await AsyncStorage.setItem(`${REMEMBER_ME_KEY}_${role}`, "true");
        await AsyncStorage.setItem(
          `${SAVED_CREDENTIALS_KEY}_${role}`,
          JSON.stringify({ phone, password })
        );
      } else {
        await AsyncStorage.removeItem(`${REMEMBER_ME_KEY}_${role}`);
        await AsyncStorage.removeItem(`${SAVED_CREDENTIALS_KEY}_${role}`);
      }
    } catch (error) {
      console.error("Error saving credentials:", error);
    }
  };

  const getRoleDashboard = (userRole: string): string => {
    // Map user role to correct dashboard
    switch (userRole) {
      case "residential":
      case "commercial":
      case "industrial":
        return "/(tabs)";
      case "driver":
        return "/carrier/portal";
      case "collector":
      case "zone_manager":
        return "/(collector)";
      case "garbage_driver":
        return "/(garbage-driver)";
      case "recycler":
        return "/recycler-dashboard";
      default:
        return "/(tabs)";
    }
  };

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both phone number and password");
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(phone.trim(), password);
      if (success) {
        await saveCredentials();
        // Get the logged-in user to check role
        const storedUser = await AsyncStorage.getItem("@ltc_user");
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          const userRole = userData.role;
          
          // Verify user role matches selected portal
          const expectedRoles = getExpectedRoles(role);
          if (!expectedRoles.includes(userRole)) {
            Alert.alert(
              "Wrong Portal",
              `This account is registered as a ${getRoleLabel(userRole)}. Please use the correct login portal.`,
              [{ text: "OK" }]
            );
            // Logout since wrong portal
            await AsyncStorage.removeItem("@ltc_user");
            setIsLoading(false);
            return;
          }

          // Check if user has seen onboarding for this role
          const onboardingSeen = await AsyncStorage.getItem(`@ltc_onboarding_seen_${role}`);
          if (!onboardingSeen) {
            router.replace(`/onboarding?role=${role}` as any);
          } else {
            const dashboard = getRoleDashboard(userRole);
            router.replace(dashboard as any);
          }
        }
      } else {
        Alert.alert("Login Failed", "Invalid phone number or password. Please try again.");
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!isEnabled || !isSupported) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setIsBiometricLoading(true);
    try {
      const result = await authenticateWithBiometric();
      
      if (result.success && result.phone && result.password) {
        const success = await login(result.phone, result.password);
        if (success) {
          const storedUser = await AsyncStorage.getItem("@ltc_user");
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            const expectedRoles = getExpectedRoles(role);
            if (!expectedRoles.includes(userData.role)) {
              Alert.alert(
                "Wrong Portal",
                `This account is registered as a ${getRoleLabel(userData.role)}. Please use the correct login portal.`
              );
              await AsyncStorage.removeItem("@ltc_user");
              setIsBiometricLoading(false);
              return;
            }
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            // Check if user has seen onboarding for this role
            const onboardingSeen = await AsyncStorage.getItem(`@ltc_onboarding_seen_${role}`);
            if (!onboardingSeen) {
              router.replace(`/onboarding?role=${role}` as any);
            } else {
              const dashboard = getRoleDashboard(userData.role);
              router.replace(dashboard as any);
            }
          }
        } else {
          Alert.alert(
            "Login Failed",
            "Your saved credentials may have changed. Please login with your password."
          );
        }
      }
    } catch (error) {
      console.error("Biometric login error:", error);
    } finally {
      setIsBiometricLoading(false);
    }
  };

  // Step 1 → Step 2: validate account info then proceed to location
  const handleCustomerStep1 = () => {
    if (!customerFirstName.trim()) {
      Alert.alert("Error", "Please enter your first name");
      return;
    }
    if (!customerLastName.trim()) {
      Alert.alert("Error", "Please enter your surname");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }
    if (!password.trim() || password.length < 4) {
      Alert.alert("Error", "Password must be at least 4 characters");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMode("register-location");
  };

  // Step 2: submit with location + auto zone matching
  const handleCustomerRegister = async () => {
    if (!selectedProvinceId) {
      Alert.alert("Error", "Please select your province");
      return;
    }
    if (!selectedCityId) {
      Alert.alert("Error", "Please select your city/town");
      return;
    }
    if (!selectedPropertyType) {
      Alert.alert("Error", "Please select your area type");
      return;
    }
    if (!areaName.trim()) {
      Alert.alert("Error", "Please enter your area name");
      return;
    }
    if (!fullAddress.trim()) {
      Alert.alert("Error", "Please enter your full address");
      return;
    }

    setIsLoading(true);
    try {
      // Auto zone matching
      const { zoneId: matchedZoneId, status: zoneMatchStatus } = await matchZoneForCustomer(
        selectedProvinceId,
        selectedCityId,
        areaName.trim()
      );

      const success = await register({
        fullName: `${customerFirstName.trim()} ${customerLastName.trim()}`,
        firstName: customerFirstName.trim(),
        lastName: customerLastName.trim(),
        phone: phone.trim(),
        password: password,
        role: selectedPropertyType || "residential",
        province: selectedProvinceName,
        provinceId: selectedProvinceId,
        city: selectedCityName,
        cityId: selectedCityId,
        areaType: selectedPropertyType || "residential",
        areaName: areaName.trim(),
        fullAddress: fullAddress.trim(),
        assignedZoneId: matchedZoneId || undefined,
        zoneMatchStatus,
        location: {
          latitude: -15.4167,
          longitude: 28.2833,
          address: `${areaName.trim()}, ${selectedCityName}, ${selectedProvinceName}`,
        },
      });

      if (success) {
        await saveCredentials();
        const matchMsg = matchedZoneId
          ? "Your zone has been automatically assigned."
          : "No zone matched yet — an admin will assign your zone shortly.";
        Alert.alert(
          "Registration Successful",
          `Welcome to LTC FAST TRACK! ${matchMsg}`,
          [{ text: "Continue", onPress: () => router.replace("/onboarding?role=customer" as any) }]
        );
      } else {
        Alert.alert("Registration Failed", "Phone number already registered. Please login instead.");
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterRedirect = () => {
    if (role === "customer") {
      setSelectedPropertyType(null);
      setMode("select-property");
    } else if (config.registerRoute) {
      router.push(config.registerRoute as any);
    }
  };

  const handleRememberMeToggle = (value: boolean) => {
    setRememberMe(value);
    if (!value) {
      AsyncStorage.removeItem(`${REMEMBER_ME_KEY}_${role}`);
      AsyncStorage.removeItem(`${SAVED_CREDENTIALS_KEY}_${role}`);
    }
  };

  const getExpectedRoles = (authRole: AuthRole): string[] => {
    switch (authRole) {
      case "customer":
        return ["residential", "commercial", "industrial"];
      case "carrier_driver":
        return ["driver"];
      case "collector":
        return ["collector", "zone_manager"];
      case "zone_manager":
        return ["zone_manager", "collector"];
      case "recycler":
        return ["recycler"];
      case "garbage_driver":
        return ["garbage_driver"];
      default:
        return [];
    }
  };

  const getRoleLabel = (userRole: string): string => {
    switch (userRole) {
      case "residential":
      case "commercial":
      case "industrial":
        return "Customer";
      case "driver":
        return "Carrier Driver";
      case "collector":
      case "zone_manager":
        return "Zone Manager";
      case "garbage_driver":
        return "Garbage Collection Driver";
      case "recycler":
        return "Recycling Company";
      default:
        return userRole;
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6 pt-8">
            {/* Back Button */}
            <TouchableOpacity
              onPress={() => {
                if (mode === "select-property" && role === "customer") {
                  setMode("login");
                } else if (mode === "register" && role === "customer") {
                  setMode("select-property");
                } else {
                  router.back();
                }
              }}
              className="mb-8"
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
            </TouchableOpacity>

            {/* Role Badge */}
            <View className="flex-row items-center mb-4">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: config.color + "20" }}
              >
                <MaterialIcons name={config.icon as any} size={22} color={config.color} />
              </View>
              <View>
                <Text className="text-sm text-muted font-medium uppercase tracking-wider">
                  {config.title} Portal
                </Text>
              </View>
            </View>

            {/* Header */}
            <View className="mb-6">
              <Text className="text-3xl font-bold text-foreground mb-2">
                {mode === "login" ? "Welcome Back" : "Create Account"}
              </Text>
              <Text className="text-base text-muted">
                {mode === "login"
                  ? `Sign in to your ${config.title} account`
                  : `Register as a new ${config.title}`}
              </Text>
            </View>

            {/* Biometric Login Button (login mode only) */}
            {mode === "login" && isEnabled && isSupported && (
              <TouchableOpacity
                onPress={handleBiometricLogin}
                disabled={isBiometricLoading}
                className="border-2 rounded-2xl p-4 mb-6 flex-row items-center justify-center"
                style={{ borderColor: config.color, backgroundColor: config.color + "10" }}
              >
                {isBiometricLoading ? (
                  <ActivityIndicator color={config.color} />
                ) : (
                  <>
                    <MaterialIcons name={biometricIcon as any} size={28} color={config.color} />
                    <Text className="font-semibold text-lg ml-3" style={{ color: config.color }}>
                      Login with {biometricLabel}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Divider */}
            {mode === "login" && isEnabled && isSupported && (
              <View className="flex-row items-center mb-6">
                <View className="flex-1 h-px bg-border" />
                <Text className="text-muted mx-4">or use password</Text>
                <View className="flex-1 h-px bg-border" />
              </View>
            )}

            {/* LOGIN FORM */}
            {mode === "login" && (
              <View className="mb-6">
                {/* Phone Input */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">
                    Phone Number
                  </Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="phone" size={20} color="#6B7280" />
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="e.g., 0960819993"
                      keyboardType="phone-pad"
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">
                    Password
                  </Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="lock" size={20} color="#6B7280" />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter your password"
                      secureTextEntry={!showPassword}
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
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

                {/* Remember Me Toggle */}
                <View className="flex-row items-center justify-between mb-6 bg-surface rounded-xl px-4 py-3 border border-border">
                  <View className="flex-row items-center flex-1">
                    <MaterialIcons name="bookmark" size={20} color={config.color} />
                    <View className="ml-3 flex-1">
                      <Text className="text-foreground font-medium">Remember Me</Text>
                      <Text className="text-muted text-xs">Stay signed in on this device</Text>
                    </View>
                  </View>
                  <Switch
                    value={rememberMe}
                    onValueChange={handleRememberMeToggle}
                    trackColor={{ false: "#334155", true: config.color + "60" }}
                    thumbColor={rememberMe ? config.color : "#9CA3AF"}
                  />
                </View>

                {/* Login Button */}
                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={isLoading}
                  className="py-4 rounded-full"
                  style={[styles.button, { backgroundColor: config.color }, isLoading && styles.buttonDisabled]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-center text-lg font-semibold">
                      Login as {config.title}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 1: ACCOUNT INFO (Customer only) */}
            {mode === "select-property" && role === "customer" && (
              <View className="mb-6">
                <View className="flex-row items-center mb-6">
                  <View style={{ backgroundColor: config.color, borderRadius: 20, width: 32, height: 32, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>1</Text>
                  </View>
                  <View>
                    <Text className="text-xl font-bold text-foreground">Account Info</Text>
                    <Text className="text-xs text-muted">Step 1 of 2</Text>
                  </View>
                </View>

                {/* Name + Surname side-by-side */}
                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground mb-2">Name</Text>
                    <View className="flex-row items-center bg-surface border border-border rounded-xl px-3">
                      <MaterialIcons name="person" size={18} color="#6B7280" />
                      <TextInput
                        value={customerFirstName}
                        onChangeText={setCustomerFirstName}
                        placeholder="First name"
                        autoCapitalize="words"
                        className="flex-1 py-4 px-2 text-foreground text-base"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground mb-2">Surname</Text>
                    <View className="flex-row items-center bg-surface border border-border rounded-xl px-3">
                      <MaterialIcons name="person-outline" size={18} color="#6B7280" />
                      <TextInput
                        value={customerLastName}
                        onChangeText={setCustomerLastName}
                        placeholder="Last name"
                        autoCapitalize="words"
                        className="flex-1 py-4 px-2 text-foreground text-base"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                </View>

                {/* Phone */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Phone Number</Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="phone" size={20} color="#6B7280" />
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="e.g., 0960819993"
                      keyboardType="phone-pad"
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                {/* Password */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Password</Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="lock" size={20} color="#6B7280" />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Create a password (min 4 characters)"
                      secureTextEntry={!showPassword}
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={20} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View className="mb-6">
                  <Text className="text-sm font-medium text-foreground mb-2">Confirm Password</Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="lock-outline" size={20} color="#6B7280" />
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm your password"
                      secureTextEntry
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleCustomerStep1}
                  className="py-4 rounded-full"
                  style={[styles.button, { backgroundColor: config.color }]}
                >
                  <Text className="text-white text-center text-lg font-semibold">Continue to Location Details</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2: LOCATION & ZONE MATCHING (Customer only) */}
            {mode === "register-location" && role === "customer" && (
              <View className="mb-6">
                <View className="flex-row items-center mb-6">
                  <View style={{ backgroundColor: config.color, borderRadius: 20, width: 32, height: 32, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>2</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-foreground">Location Details</Text>
                    <Text className="text-xs text-muted">Step 2 of 2 — Used for zone assignment</Text>
                  </View>
                  <TouchableOpacity onPress={() => setMode("select-property")}>
                    <Text style={{ color: config.color, fontSize: 13, fontWeight: "600" }}>Back</Text>
                  </TouchableOpacity>
                </View>

                {/* Province Dropdown */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Province</Text>
                  <TouchableOpacity
                    onPress={() => { setShowProvinceDropdown(!showProvinceDropdown); setShowCityDropdown(false); }}
                    style={{ backgroundColor: "#1e2022", borderRadius: 12, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                  >
                    <Text style={{ color: selectedProvinceName ? "#ECEDEE" : "#9CA3AF", fontSize: 15 }}>
                      {selectedProvinceName || "Select Province"}
                    </Text>
                    <MaterialIcons name={showProvinceDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color="#6B7280" />
                  </TouchableOpacity>
                  {showProvinceDropdown && (
                    <View style={{ backgroundColor: "#1e2022", borderRadius: 12, borderWidth: 1, borderColor: "#334155", marginTop: 4, maxHeight: 200, overflow: "hidden" }}>
                      <ScrollView nestedScrollEnabled>
                        {ZAMBIA_PROVINCES_DATA.map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            onPress={() => {
                              setSelectedProvinceId(p.id);
                              setSelectedProvinceName(p.name);
                              setSelectedCityId("");
                              setSelectedCityName("");
                              setShowProvinceDropdown(false);
                              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#334155", backgroundColor: selectedProvinceId === p.id ? config.color + "20" : "transparent" }}
                          >
                            <Text style={{ color: selectedProvinceId === p.id ? config.color : "#ECEDEE", fontSize: 15, fontWeight: selectedProvinceId === p.id ? "600" : "400" }}>{p.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* City/Town Dropdown */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">City / Town</Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (!selectedProvinceId) { Alert.alert("Select Province", "Please select a province first."); return; }
                      setShowCityDropdown(!showCityDropdown);
                      setShowProvinceDropdown(false);
                    }}
                    style={{ backgroundColor: "#1e2022", borderRadius: 12, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", opacity: selectedProvinceId ? 1 : 0.5 }}
                  >
                    <Text style={{ color: selectedCityName ? "#ECEDEE" : "#9CA3AF", fontSize: 15 }}>
                      {selectedCityName || (selectedProvinceId ? "Select City/Town" : "Select Province first")}
                    </Text>
                    <MaterialIcons name={showCityDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color="#6B7280" />
                  </TouchableOpacity>
                  {showCityDropdown && selectedProvinceId && (
                    <View style={{ backgroundColor: "#1e2022", borderRadius: 12, borderWidth: 1, borderColor: "#334155", marginTop: 4, maxHeight: 200, overflow: "hidden" }}>
                      <ScrollView nestedScrollEnabled>
                        {(TOWNS_BY_PROVINCE_DATA[selectedProvinceId] || []).map((t) => (
                          <TouchableOpacity
                            key={t.id}
                            onPress={() => {
                              setSelectedCityId(t.id);
                              setSelectedCityName(t.name);
                              setShowCityDropdown(false);
                              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#334155", backgroundColor: selectedCityId === t.id ? config.color + "20" : "transparent" }}
                          >
                            <Text style={{ color: selectedCityId === t.id ? config.color : "#ECEDEE", fontSize: 15, fontWeight: selectedCityId === t.id ? "600" : "400" }}>{t.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Area Type */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Area Type</Text>
                  <View className="flex-row gap-2">
                    {(["residential", "commercial", "industrial"] as PropertyType[]).map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => { setSelectedPropertyType(t); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: selectedPropertyType === t ? config.color : "#334155", backgroundColor: selectedPropertyType === t ? config.color + "20" : "#1e2022", alignItems: "center" }}
                      >
                        <Text style={{ color: selectedPropertyType === t ? config.color : "#9BA1A6", fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Area Name */}
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Area Name</Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="place" size={20} color="#6B7280" />
                    <TextInput
                      value={areaName}
                      onChangeText={setAreaName}
                      placeholder="e.g., Kabulonga, Woodlands"
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>

                {/* Full Address */}
                <View className="mb-6">
                  <Text className="text-sm font-medium text-foreground mb-2">Full Address</Text>
                  <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                    <MaterialIcons name="home" size={20} color="#6B7280" />
                    <TextInput
                      value={fullAddress}
                      onChangeText={setFullAddress}
                      placeholder="e.g., Plot 123, Kabulonga Road"
                      className="flex-1 py-4 px-3 text-foreground text-base"
                      placeholderTextColor="#9CA3AF"
                      multiline
                    />
                  </View>
                </View>

                {/* Zone matching info */}
                <View className="flex-row items-start bg-surface border border-border rounded-xl px-4 py-3 mb-5">
                  <MaterialIcons name="info-outline" size={18} color={config.color} style={{ marginTop: 1 }} />
                  <Text className="text-muted text-xs ml-2 flex-1 leading-5">
                    Your zone will be automatically matched based on your province, city, and area name. If no match is found, an admin will assign your zone manually.
                  </Text>
                </View>

                {/* Register Button */}
                <TouchableOpacity
                  onPress={handleCustomerRegister}
                  disabled={isLoading}
                  className="py-4 rounded-full"
                  style={[styles.button, { backgroundColor: config.color }, isLoading && styles.buttonDisabled]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-center text-lg font-semibold">Create Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Toggle Login / Register */}
            <View className="flex-row justify-center mt-4 mb-8">
              {mode === "login" ? (
                <>
                  <Text className="text-muted text-base">
                    Don&apos;t have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={handleRegisterRedirect}>
                    <Text className="font-semibold text-base" style={{ color: config.color }}>
                      Register
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text className="text-muted text-base">
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={() => setMode("login")}>
                    <Text className="font-semibold text-base" style={{ color: config.color }}>
                      Login
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#1e2022",
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
  propertyCard: {
    backgroundColor: "#1e2022",
    borderRadius: _rs.s(16),
    borderWidth: 1.5,
    borderColor: "#334155",
    marginBottom: _rs.sp(12),
    overflow: "hidden",
  },
  propertyCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
  },
  propertyEmoji: {
    fontSize: _rs.fs(32),
    marginRight: _rs.sp(14),
  },
  propertyTextContainer: {
    flex: 1,
  },
  propertyLabel: {
    fontSize: _rs.fs(17),
    fontWeight: "700",
    color: "#ECEDEE",
    marginBottom: _rs.sp(3),
  },
  propertyDesc: {
    fontSize: _rs.fs(13),
    color: "#9BA1A6",
    lineHeight: _rs.fs(18),
  },
});
