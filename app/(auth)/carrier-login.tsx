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
const REMEMBER_ME_KEY = "@ltc_carrier_remember_me";
const SAVED_CREDENTIALS_KEY = "@ltc_carrier_saved_credentials";

export default function CarrierLoginScreen() {
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
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/carrier/portal" as any);
      } else {
        Alert.alert("Login Failed", "Invalid phone number or password");
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred during login");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!isEnabled || !isSupported) return;

    setIsBiometricLoading(true);
    try {
      const authenticated = await authenticateWithBiometric();
      if (authenticated) {
        const savedCredentials = await AsyncStorage.getItem(SAVED_CREDENTIALS_KEY);
        if (savedCredentials) {
          const { phone: savedPhone, password: savedPassword } = JSON.parse(savedCredentials);
          const success = await login(savedPhone, savedPassword);
          if (success) {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace("/carrier/portal" as any);
          }
        }
      }
    } catch (error) {
      console.error("Biometric login error:", error);
    } finally {
      setIsBiometricLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-6 pt-8 pb-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center flex-1">
                <View className="w-12 h-12 rounded-full bg-primary items-center justify-center">
                  <MaterialIcons name="local-shipping" size={24} color="#fff" />
                </View>
                <Text className="text-2xl font-bold text-foreground ml-3">Carrier Portal</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/carrier/driver-faq" as any)}
                className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
              >
                <MaterialIcons name="help-outline" size={24} color="#0a7ea4" />
              </TouchableOpacity>
            </View>
            <Text className="text-base text-muted">
              Sign in to manage your carrier bookings and track shipments
            </Text>
          </View>

          {/* Login Card */}
          <View className="px-6 flex-1 justify-center">
            <View className="bg-surface rounded-2xl p-6 border border-border shadow-sm">
              {/* Phone Input */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-foreground mb-2">Phone Number</Text>
                <View className="flex-row items-center bg-background border border-border rounded-xl px-4 py-3">
                  <MaterialIcons name="phone" size={20} color="#9BA1A6" />
                  <TextInput
                    placeholder="Enter your phone number"
                    placeholderTextColor="#9BA1A6"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    editable={!isLoading}
                    className="flex-1 ml-3 text-foreground"
                    style={{ fontSize: 16 }}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-foreground mb-2">Password</Text>
                <View className="flex-row items-center bg-background border border-border rounded-xl px-4 py-3">
                  <MaterialIcons name="lock" size={20} color="#9BA1A6" />
                  <TextInput
                    placeholder="Enter your password"
                    placeholderTextColor="#9BA1A6"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    className="flex-1 ml-3 text-foreground"
                    style={{ fontSize: 16 }}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <MaterialIcons
                      name={showPassword ? "visibility" : "visibility-off"}
                      size={20}
                      color="#9BA1A6"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember Me */}
              <View className="flex-row items-center justify-between mb-6">
                <View className="flex-row items-center">
                  <Switch
                    value={rememberMe}
                    onValueChange={setRememberMe}
                    disabled={isLoading}
                  />
                  <Text className="text-sm text-muted ml-2">Remember me</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as any)}>
                  <Text className="text-sm text-primary font-semibold">Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                style={{
                  opacity: isLoading ? 0.6 : 1,
                  transform: [{ scale: isLoading ? 0.98 : 1 }],
                }}
                className="bg-primary rounded-xl py-3 items-center mb-3"
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-base">Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Biometric Login */}
              {isSupported && isEnabled && (
                <TouchableOpacity
                  onPress={handleBiometricLogin}
                  disabled={isBiometricLoading}
                  className="bg-surface border border-primary rounded-xl py-3 items-center flex-row justify-center"
                >
                  {isBiometricLoading ? (
                    <ActivityIndicator color="#0a7ea4" />
                  ) : (
                    <>
                      <MaterialIcons name={biometricIcon} size={20} color="#0a7ea4" />
                      <Text className="text-primary font-semibold text-base ml-2">
                        Use {biometricLabel}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Register Button */}
            <View className="mt-4">
              <TouchableOpacity
                onPress={() => router.push("/carrier/create-account" as any)}
                className="bg-green-600 rounded-xl py-3 items-center"
              >
                <Text className="text-white font-semibold text-base">Register</Text>
              </TouchableOpacity>
            </View>

            {/* Back to Main Login */}
            <View className="mt-4 items-center">
              <TouchableOpacity onPress={() => router.back()}>
                <View className="flex-row items-center">
                  <MaterialIcons name="arrow-back" size={18} color="#0a7ea4" />
                  <Text className="text-primary font-medium text-sm ml-1">Back to Main Login</Text>
                </View>
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
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: _rs.sp(24),
    paddingTop: _rs.sp(32),
    paddingBottom: _rs.sp(24),
  },
  headerTitle: {
    fontSize: _rs.fs(24),
    fontWeight: "bold",
    marginBottom: _rs.sp(8),
  },
  headerSubtitle: {
    fontSize: _rs.fs(14),
    color: "#9BA1A6",
  },
  content: {
    paddingHorizontal: _rs.sp(24),
    flex: 1,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#f5f5f5",
    borderRadius: _rs.s(16),
    padding: _rs.sp(24),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputGroup: {
    marginBottom: _rs.sp(16),
  },
  label: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
    marginBottom: _rs.sp(8),
    color: "#11181C",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: _rs.s(12),
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(12),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  input: {
    flex: 1,
    marginLeft: _rs.sp(12),
    fontSize: _rs.fs(16),
    color: "#11181C",
  },
  rememberContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: _rs.sp(24),
  },
  rememberText: {
    fontSize: _rs.fs(14),
    color: "#9BA1A6",
    marginLeft: _rs.sp(8),
  },
  forgotText: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
    color: "#0a7ea4",
  },
  loginButton: {
    backgroundColor: "#0a7ea4",
    borderRadius: _rs.s(12),
    paddingVertical: _rs.sp(12),
    alignItems: "center",
    marginBottom: _rs.sp(12),
  },
  loginButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: _rs.fs(16),
  },
  biometricButton: {
    backgroundColor: "#f5f5f5",
    borderRadius: _rs.s(12),
    paddingVertical: _rs.sp(12),
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0a7ea4",
  },
  biometricButtonText: {
    color: "#0a7ea4",
    fontWeight: "600",
    fontSize: _rs.fs(16),
    marginLeft: _rs.sp(8),
  },
  footer: {
    marginTop: _rs.sp(24),
    alignItems: "center",
  },
  footerText: {
    fontSize: _rs.fs(14),
    color: "#9BA1A6",
  },
  footerLink: {
    color: "#0a7ea4",
    fontWeight: "600",
  },
});
