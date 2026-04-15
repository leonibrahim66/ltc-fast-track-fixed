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
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useBiometric, getBiometricLabel } from "@/lib/biometric-context";
import { APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

import { getStaticResponsive } from "@/hooks/use-responsive";
const getRoleDashboard = (userRole: string): string => {
  switch (userRole) {
    case "residential":
    case "commercial":
      return "/(tabs)";
    case "driver":
      return "/carrier/portal";
    case "collector":
    case "zone_manager":
      return "/(collector)";
    case "recycler":
      return "/recycler-dashboard";
    default:
      return "/(tabs)";
  }
};

const REMEMBER_ME_KEY = "@ltc_remember_me";
const SAVED_CREDENTIALS_KEY = "@ltc_saved_credentials";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { isEnabled, isSupported, biometricType, authenticateWithBiometric } = useBiometric();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);

  const biometricLabel = getBiometricLabel(biometricType);
  const biometricIcon = biometricType === "facial" ? "face" : "fingerprint";

  // Load saved credentials on mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  // Auto-prompt biometric on mount if enabled
  useEffect(() => {
    if (isEnabled && isSupported) {
      // Small delay to let the screen render first
      const timer = setTimeout(() => {
        handleBiometricLogin();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isEnabled, isSupported]);

  const loadSavedCredentials = async () => {
    try {
      const savedRememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      if (savedRememberMe === "true") {
        setRememberMe(true);
        const savedCredentials = await AsyncStorage.getItem(SAVED_CREDENTIALS_KEY);
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
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, "true");
        await AsyncStorage.setItem(
          SAVED_CREDENTIALS_KEY,
          JSON.stringify({ phone, password })
        );
      } else {
        await AsyncStorage.removeItem(REMEMBER_ME_KEY);
        await AsyncStorage.removeItem(SAVED_CREDENTIALS_KEY);
      }
    } catch (error) {
      console.error("Error saving credentials:", error);
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
        const storedUser = await AsyncStorage.getItem("@ltc_user");
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          const dashboard = getRoleDashboard(userData.role);
          router.replace(dashboard as any);
        } else {
          router.replace("/(tabs)");
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
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          const storedUser = await AsyncStorage.getItem("@ltc_user");
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            const dashboard = getRoleDashboard(userData.role);
            router.replace(dashboard as any);
          } else {
            router.replace("/(tabs)");
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

  const handleRememberMeToggle = (value: boolean) => {
    setRememberMe(value);
    if (!value) {
      // Clear saved credentials when turning off
      AsyncStorage.removeItem(REMEMBER_ME_KEY);
      AsyncStorage.removeItem(SAVED_CREDENTIALS_KEY);
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
              onPress={() => router.back()}
              className="mb-8"
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>

            {/* Header */}
            <View className="mb-8">
              <Text className="text-3xl font-bold text-foreground mb-2">
                Welcome Back
              </Text>
              <Text className="text-base text-muted">
                Sign in to continue to {APP_CONFIG.name}
              </Text>
            </View>

            {/* Biometric Login Button */}
            {isEnabled && isSupported && (
              <TouchableOpacity
                onPress={handleBiometricLogin}
                disabled={isBiometricLoading}
                className="bg-primary/10 border-2 border-primary rounded-2xl p-4 mb-6 flex-row items-center justify-center"
              >
                {isBiometricLoading ? (
                  <ActivityIndicator color="#22C55E" />
                ) : (
                  <>
                    <MaterialIcons name={biometricIcon as any} size={28} color="#22C55E" />
                    <Text className="text-primary font-semibold text-lg ml-3">
                      Login with {biometricLabel}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Divider */}
            {isEnabled && isSupported && (
              <View className="flex-row items-center mb-6">
                <View className="flex-1 h-px bg-border" />
                <Text className="text-muted mx-4">or use password</Text>
                <View className="flex-1 h-px bg-border" />
              </View>
            )}

            {/* Form */}
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
                  <MaterialIcons name="bookmark" size={20} color="#22C55E" />
                  <View className="ml-3 flex-1">
                    <Text className="text-foreground font-medium">Remember Me</Text>
                    <Text className="text-muted text-xs">Stay signed in on this device</Text>
                  </View>
                </View>
                <Switch
                  value={rememberMe}
                  onValueChange={handleRememberMeToggle}
                  trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
                  thumbColor={rememberMe ? "#22C55E" : "#9CA3AF"}
                />
              </View>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                className="bg-primary py-4 rounded-full"
                style={[styles.button, isLoading && styles.buttonDisabled]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-center text-lg font-semibold">
                    Login
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Register Link */}
            <View className="flex-row justify-center mt-4">
              <Text className="text-muted text-base">
                Don&apos;t have an account?{" "}
              </Text>
              <TouchableOpacity onPress={() => router.push("/role-auth?role=customer" as any)}>
                <Text className="text-primary font-semibold text-base">
                  Register
                </Text>
              </TouchableOpacity>
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
