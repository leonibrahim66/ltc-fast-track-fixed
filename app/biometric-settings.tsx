import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useBiometric, getBiometricLabel } from "@/lib/biometric-context";
import { useAuth } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

export default function BiometricSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    isSupported,
    isEnabled,
    biometricType,
    isEnrolled,
    enableBiometric,
    disableBiometric,
  } = useBiometric();

  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState("");

  const biometricLabel = getBiometricLabel(biometricType);
  const biometricIcon = biometricType === "facial" ? "face" : "fingerprint";

  const handleToggleBiometric = async (value: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (value) {
      // Enable biometric - need password confirmation
      setShowPasswordModal(true);
    } else {
      // Disable biometric
      Alert.alert(
        `Disable ${biometricLabel}`,
        `Are you sure you want to disable ${biometricLabel} login?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              setIsLoading(true);
              await disableBiometric();
              setIsLoading(false);
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            },
          },
        ]
      );
    }
  };

  const handleEnableBiometric = async () => {
    if (!password.trim()) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    // Verify password matches user's password
    if (user?.password !== password) {
      Alert.alert("Error", "Incorrect password. Please try again.");
      return;
    }

    setIsLoading(true);
    setShowPasswordModal(false);

    const success = await enableBiometric(user?.phone || "", password);
    
    setIsLoading(false);
    setPassword("");

    if (success) {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Success",
        `${biometricLabel} login has been enabled. You can now use ${biometricLabel} to sign in.`
      );
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 bg-primary">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-2xl font-bold">Biometric Login</Text>
              <Text className="text-white/80">Secure authentication settings</Text>
            </View>
          </View>
        </View>

        {/* Status Card */}
        <View className="px-6 -mt-4">
          <View className="bg-surface rounded-2xl p-4 border border-border shadow-sm">
            <View className="flex-row items-center">
              <View className={`w-14 h-14 rounded-2xl items-center justify-center ${
                isSupported && isEnrolled ? "bg-primary/10" : "bg-muted/10"
              }`}>
                <MaterialIcons
                  name={biometricIcon as any}
                  size={32}
                  color={isSupported && isEnrolled ? "#22C55E" : "#9BA1A6"}
                />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-foreground font-bold text-lg">{biometricLabel}</Text>
                <Text className="text-muted text-sm">
                  {!isSupported
                    ? "Not supported on this device"
                    : !isEnrolled
                    ? "No biometrics enrolled"
                    : isEnabled
                    ? "Enabled"
                    : "Disabled"}
                </Text>
              </View>
              {isSupported && isEnrolled && (
                <View className={`px-3 py-1 rounded-full ${isEnabled ? "bg-primary/20" : "bg-muted/20"}`}>
                  <Text className={`text-xs font-semibold ${isEnabled ? "text-primary" : "text-muted"}`}>
                    {isEnabled ? "ON" : "OFF"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Enable/Disable Toggle */}
        {isSupported && isEnrolled && (
          <View className="px-6 mt-6">
            <View className="bg-surface rounded-2xl border border-border">
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center flex-1">
                  <MaterialIcons name={biometricIcon as any} size={24} color="#22C55E" />
                  <View className="ml-3 flex-1">
                    <Text className="text-foreground font-semibold">
                      Use {biometricLabel} to Login
                    </Text>
                    <Text className="text-muted text-sm">
                      Quick and secure sign-in
                    </Text>
                  </View>
                </View>
                {isLoading ? (
                  <ActivityIndicator color="#22C55E" />
                ) : (
                  <Switch
                    value={isEnabled}
                    onValueChange={handleToggleBiometric}
                    trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
                    thumbColor={isEnabled ? "#22C55E" : "#9CA3AF"}
                  />
                )}
              </View>
            </View>
          </View>
        )}

        {/* Info Section */}
        <View className="px-6 mt-6">
          <Text className="text-foreground font-bold text-lg mb-3">How It Works</Text>
          
          <View className="bg-surface rounded-2xl border border-border p-4">
            <View className="flex-row items-start mb-4">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                <Text className="text-primary font-bold">1</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-foreground font-semibold">Enable {biometricLabel}</Text>
                <Text className="text-muted text-sm">
                  Turn on the toggle above and verify your password
                </Text>
              </View>
            </View>

            <View className="flex-row items-start mb-4">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                <Text className="text-primary font-bold">2</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-foreground font-semibold">Login with {biometricLabel}</Text>
                <Text className="text-muted text-sm">
                  On the login screen, tap the {biometricLabel} button
                </Text>
              </View>
            </View>

            <View className="flex-row items-start">
              <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
                <Text className="text-primary font-bold">3</Text>
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-foreground font-semibold">Instant Access</Text>
                <Text className="text-muted text-sm">
                  Authenticate with your {biometricType === "facial" ? "face" : "fingerprint"} and you're in!
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Security Note */}
        <View className="px-6 mt-6">
          <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
            <View className="flex-row items-start">
              <MaterialIcons name="security" size={20} color="#22C55E" />
              <View className="ml-3 flex-1">
                <Text className="text-foreground font-semibold mb-1">Secure & Private</Text>
                <Text className="text-muted text-sm">
                  Your biometric data never leaves your device. We only store an encrypted reference to verify your identity.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Not Supported Message */}
        {!isSupported && (
          <View className="px-6 mt-6">
            <View className="bg-warning/10 rounded-2xl p-4 border border-warning/20">
              <View className="flex-row items-start">
                <MaterialIcons name="warning" size={20} color="#F59E0B" />
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-semibold mb-1">Not Available</Text>
                  <Text className="text-muted text-sm">
                    Biometric authentication is not supported on this device. Please use your password to login.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Not Enrolled Message */}
        {isSupported && !isEnrolled && (
          <View className="px-6 mt-6">
            <View className="bg-warning/10 rounded-2xl p-4 border border-warning/20">
              <View className="flex-row items-start">
                <MaterialIcons name="info" size={20} color="#F59E0B" />
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-semibold mb-1">Setup Required</Text>
                  <Text className="text-muted text-sm">
                    Please set up {biometricLabel} in your device settings first, then return here to enable biometric login.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Password Confirmation Modal */}
      {showPasswordModal && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center px-6">
          <View className="bg-surface rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-foreground text-xl font-bold mb-2">
              Confirm Password
            </Text>
            <Text className="text-muted mb-4">
              Enter your password to enable {biometricLabel} login
            </Text>

            <View className="flex-row items-center bg-background border border-border rounded-xl px-4 mb-4">
              <MaterialIcons name="lock" size={20} color="#6B7280" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secureTextEntry
                className="flex-1 py-4 px-3 text-foreground text-base"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword("");
                }}
                className="flex-1 py-3 rounded-xl border border-border"
              >
                <Text className="text-muted text-center font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEnableBiometric}
                className="flex-1 py-3 rounded-xl bg-primary"
              >
                <Text className="text-white text-center font-semibold">Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
