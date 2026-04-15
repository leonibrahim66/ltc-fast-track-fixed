import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const getPasswordStrength = (password: string): { level: number; label: string; color: string } => {
    if (!password) return { level: 0, label: "", color: "#E5E7EB" };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    if (score <= 1) return { level: 1, label: "Weak", color: "#EF4444" };
    if (score <= 2) return { level: 2, label: "Fair", color: "#F59E0B" };
    if (score <= 3) return { level: 3, label: "Good", color: "#22C55E" };
    return { level: 4, label: "Strong", color: "#10B981" };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const validatePassword = (): boolean => {
    if (!currentPassword.trim()) {
      Alert.alert("Error", "Please enter your current password");
      return false;
    }
    if (!newPassword.trim()) {
      Alert.alert("Error", "Please enter a new password");
      return false;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters");
      return false;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return false;
    }
    if (newPassword === currentPassword) {
      Alert.alert("Error", "New password must be different from current password");
      return false;
    }
    return true;
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsLoading(true);
    try {
      // Simulate password verification (in real app, verify with backend)
      // For demo, we check against stored password
      if (user?.password !== currentPassword) {
        Alert.alert("Error", "Current password is incorrect");
        setIsLoading(false);
        return;
      }

      // Update password
      await updateUser({ password: newPassword });

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        "Success",
        "Your password has been changed successfully. Please use your new password next time you log in.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to change password. Please try again.");
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
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
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
                <Text className="text-white text-2xl font-bold">Change Password</Text>
                <Text className="text-white/80">Update your account password</Text>
              </View>
            </View>
          </View>

          {/* Security Notice */}
          <View className="px-6 -mt-4">
            <View className="bg-surface rounded-2xl p-4 border border-border shadow-sm">
              <View className="flex-row items-start">
                <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                  <MaterialIcons name="security" size={20} color="#22C55E" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-foreground font-bold">Security Notice</Text>
                  <Text className="text-muted text-sm mt-1">
                    Choose a strong password that you don't use elsewhere. We recommend using a mix of letters, numbers, and symbols.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Form */}
          <View className="px-6 mt-6">
            {/* Current Password */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Current Password
              </Text>
              <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                <MaterialIcons name="lock-outline" size={20} color="#6B7280" />
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  secureTextEntry={!showCurrentPassword}
                  className="flex-1 py-4 px-3 text-foreground text-base"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                  <MaterialIcons
                    name={showCurrentPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                New Password
              </Text>
              <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                <MaterialIcons name="lock" size={20} color="#6B7280" />
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry={!showNewPassword}
                  className="flex-1 py-4 px-3 text-foreground text-base"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                  <MaterialIcons
                    name={showNewPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
              
              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <View className="mt-2">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-xs text-muted">Password Strength</Text>
                    <Text className="text-xs font-semibold" style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </Text>
                  </View>
                  <View className="flex-row gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <View
                        key={level}
                        className="flex-1 h-1 rounded-full"
                        style={{
                          backgroundColor: level <= passwordStrength.level ? passwordStrength.color : "#E5E7EB",
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Confirm New Password */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">
                Confirm New Password
              </Text>
              <View className="flex-row items-center bg-surface border border-border rounded-xl px-4">
                <MaterialIcons name="lock-outline" size={20} color="#6B7280" />
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry={!showConfirmPassword}
                  className="flex-1 py-4 px-3 text-foreground text-base"
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <MaterialIcons
                    name={showConfirmPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
              
              {/* Password Match Indicator */}
              {confirmPassword.length > 0 && (
                <View className="flex-row items-center mt-2">
                  <MaterialIcons
                    name={newPassword === confirmPassword ? "check-circle" : "cancel"}
                    size={16}
                    color={newPassword === confirmPassword ? "#22C55E" : "#EF4444"}
                  />
                  <Text
                    className="text-xs ml-1"
                    style={{ color: newPassword === confirmPassword ? "#22C55E" : "#EF4444" }}
                  >
                    {newPassword === confirmPassword ? "Passwords match" : "Passwords do not match"}
                  </Text>
                </View>
              )}
            </View>

            {/* Password Requirements */}
            <View className="bg-muted/10 rounded-xl p-4 mb-6">
              <Text className="text-foreground font-semibold mb-2">Password Requirements</Text>
              <View className="gap-2">
                <PasswordRequirement
                  met={newPassword.length >= 6}
                  text="At least 6 characters"
                />
                <PasswordRequirement
                  met={/[A-Z]/.test(newPassword)}
                  text="One uppercase letter"
                />
                <PasswordRequirement
                  met={/[a-z]/.test(newPassword)}
                  text="One lowercase letter"
                />
                <PasswordRequirement
                  met={/\d/.test(newPassword)}
                  text="One number"
                />
                <PasswordRequirement
                  met={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)}
                  text="One special character (optional)"
                />
              </View>
            </View>

            {/* Change Password Button */}
            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={isLoading}
              className={`py-4 rounded-xl ${isLoading ? "bg-primary/50" : "bg-primary"}`}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center text-lg font-semibold">
                  Change Password
                </Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              className="py-4 mt-3"
            >
              <Text className="text-muted text-center text-base">Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <View className="flex-row items-center">
      <MaterialIcons
        name={met ? "check-circle" : "radio-button-unchecked"}
        size={16}
        color={met ? "#22C55E" : "#9CA3AF"}
      />
      <Text className={`text-sm ml-2 ${met ? "text-foreground" : "text-muted"}`}>
        {text}
      </Text>
    </View>
  );
}
