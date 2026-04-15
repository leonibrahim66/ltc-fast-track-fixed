import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

export default function AdminLoginScreen() {
  const router = useRouter();
  const { loginAdmin, loginWithPin } = useAdmin();
  const [loginMode, setLoginMode] = useState<"credentials" | "pin">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const routeAfterLogin = (role: string) => {
    if (role === "council_admin") {
      router.replace("/council-admin-dashboard" as any);
    } else {
      router.replace("/admin-panel" as any);
    }
  };

  const handleCredentialsLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both username and password");
      return;
    }

    setIsLoading(true);
    try {
      const success = await loginAdmin(username.trim(), password);
      if (success) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Determine role from username prefix
        const isCouncil = username.trim().startsWith("council_");
        routeAfterLogin(isCouncil ? "council_admin" : "other");
      } else {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert("Login Failed", "Invalid username or password");
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinLogin = async () => {
    if (pin.length !== 4) {
      Alert.alert("Error", "Please enter a 4-digit PIN");
      return;
    }

    setIsLoading(true);
    try {
      const success = await loginWithPin(pin);
      if (success) {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // PIN 6789 and 7890 are council admin PINs
        const isCouncil = pin === "6789" || pin === "7890";
        routeAfterLogin(isCouncil ? "council_admin" : "other");
      } else {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert("Login Failed", "Invalid PIN");
        setPin("");
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (newPin.length === 4) {
        // Auto-submit when 4 digits entered
        setTimeout(() => {
          loginWithPin(newPin).then((success) => {
            if (success) {
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              const isCouncil = newPin === "6789" || newPin === "7890";
              routeAfterLogin(isCouncil ? "council_admin" : "other");
            } else {
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              Alert.alert("Login Failed", "Invalid PIN");
              setPin("");
            }
          });
        }, 100);
      }
    }
  };

  const handlePinDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
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
          {/* Header */}
          <View className="px-6 pt-4 pb-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mb-6"
            >
              <MaterialIcons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>

            <View className="items-center mb-8">
              <View className="w-20 h-20 rounded-2xl bg-primary/10 items-center justify-center mb-4">
                <MaterialIcons name="admin-panel-settings" size={40} color="#22C55E" />
              </View>
              <Text className="text-2xl font-bold text-foreground">
                Admin Access
              </Text>
              <Text className="text-muted text-center mt-2">
                IT Management Portal
              </Text>
            </View>
          </View>

          {/* Council Admin Quick Access */}
          <View className="px-6 mb-4">
            <TouchableOpacity
              onPress={() => router.push("/council-admin-login" as any)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: "#EFF6FF",
                borderWidth: 1,
                borderColor: "#BFDBFE",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 16,
              }}
            >
              <MaterialIcons name="account-balance" size={20} color="#1D4ED8" />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1D4ED8" }}>
                Council Admin Portal
              </Text>
              <MaterialIcons name="chevron-right" size={18} color="#1D4ED8" />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View className="px-6 mb-4 flex-row items-center gap-3">
            <View className="flex-1 h-px bg-border" />
            <Text className="text-muted text-sm">or sign in as IT Admin</Text>
            <View className="flex-1 h-px bg-border" />
          </View>

          {/* Login Mode Tabs */}
          <View className="px-6 mb-6">
            <View className="flex-row bg-surface rounded-xl p-1">
              <TouchableOpacity
                onPress={() => setLoginMode("credentials")}
                className={`flex-1 py-3 rounded-lg ${
                  loginMode === "credentials" ? "bg-primary" : ""
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    loginMode === "credentials" ? "text-white" : "text-muted"
                  }`}
                >
                  Username & Password
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLoginMode("pin")}
                className={`flex-1 py-3 rounded-lg ${
                  loginMode === "pin" ? "bg-primary" : ""
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    loginMode === "pin" ? "text-white" : "text-muted"
                  }`}
                >
                  Quick PIN
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {loginMode === "credentials" ? (
            /* Credentials Login Form */
            <View className="px-6">
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Username</Text>
                <View className="flex-row items-center bg-surface rounded-xl border border-border px-4">
                  <MaterialIcons name="person" size={20} color="#9BA1A6" />
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter admin username"
                    placeholderTextColor="#9BA1A6"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 py-4 px-3 text-foreground"
                  />
                </View>
              </View>

              <View className="mb-6">
                <Text className="text-foreground font-medium mb-2">Password</Text>
                <View className="flex-row items-center bg-surface rounded-xl border border-border px-4">
                  <MaterialIcons name="lock" size={20} color="#9BA1A6" />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    placeholderTextColor="#9BA1A6"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="flex-1 py-4 px-3 text-foreground"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <MaterialIcons
                      name={showPassword ? "visibility-off" : "visibility"}
                      size={20}
                      color="#9BA1A6"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleCredentialsLogin}
                disabled={isLoading}
                className={`bg-primary py-4 rounded-xl flex-row items-center justify-center ${
                  isLoading ? "opacity-70" : ""
                }`}
              >
                <MaterialIcons name="login" size={20} color="#fff" />
                <Text className="text-white font-semibold ml-2">
                  {isLoading ? "Signing In..." : "Sign In"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* PIN Login */
            <View className="px-6">
              {/* PIN Display */}
              <View className="flex-row justify-center mb-8">
                {[0, 1, 2, 3].map((index) => (
                  <View
                    key={index}
                    className={`w-14 h-14 mx-2 rounded-full items-center justify-center border-2 ${
                      pin.length > index
                        ? "bg-primary border-primary"
                        : "bg-surface border-border"
                    }`}
                  >
                    {pin.length > index && (
                      <View className="w-4 h-4 rounded-full bg-white" />
                    )}
                  </View>
                ))}
              </View>

              {/* PIN Keypad */}
              <View className="items-center">
                {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ["", 0, "del"]].map((row, rowIndex) => (
                  <View key={rowIndex} className="flex-row mb-3">
                    {row.map((digit, colIndex) => (
                      <TouchableOpacity
                        key={`${rowIndex}-${colIndex}`}
                        onPress={() => {
                          if (digit === "del") {
                            handlePinDelete();
                          } else if (digit !== "") {
                            handlePinInput(digit.toString());
                          }
                        }}
                        disabled={digit === ""}
                        className={`w-20 h-20 mx-2 rounded-full items-center justify-center ${
                          digit === "" ? "" : "bg-surface"
                        }`}
                      >
                        {digit === "del" ? (
                          <MaterialIcons name="backspace" size={24} color="#374151" />
                        ) : digit !== "" ? (
                          <Text className="text-2xl font-semibold text-foreground">
                            {digit}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Security Notice */}
          <View className="px-6 mt-8">
            <View className="bg-warning/10 rounded-xl p-4 flex-row">
              <MaterialIcons name="security" size={24} color="#F59E0B" />
              <View className="flex-1 ml-3">
                <Text className="text-foreground font-medium">Secure Access</Text>
                <Text className="text-muted text-sm mt-1">
                  This portal is for authorized IT personnel only. All access is logged and monitored.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
