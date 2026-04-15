import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface AccountFormData {
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  role: string;
  rememberMe: boolean;
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

export default function CreateAccountScreen() {
  const router = useRouter();
  const [formData, setFormData] = useState<AccountFormData>({
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    role: "Carrier Driver",
    rememberMe: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: keyof AccountFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculatePasswordStrength = (password: string): PasswordStrength => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { score, label: "Weak", color: "#EF4444" };
    if (score <= 4) return { score, label: "Medium", color: "#F59E0B" };
    return { score, label: "Strong", color: "#22C55E" };
  };

  const validateForm = (): boolean => {
    if (!formData.phoneNumber.trim()) {
      Alert.alert("Validation Error", "Phone Number is required");
      return false;
    }
    if (formData.phoneNumber.length < 10) {
      Alert.alert("Validation Error", "Please enter a valid phone number");
      return false;
    }
    if (!formData.password) {
      Alert.alert("Validation Error", "Password is required");
      return false;
    }
    if (formData.password.length < 8) {
      Alert.alert("Validation Error", "Password must be at least 8 characters long");
      return false;
    }
    if (!/[a-z]/.test(formData.password)) {
      Alert.alert("Validation Error", "Password must contain at least one lowercase letter");
      return false;
    }
    if (!/[A-Z]/.test(formData.password)) {
      Alert.alert("Validation Error", "Password must contain at least one uppercase letter");
      return false;
    }
    if (!/[0-9]/.test(formData.password)) {
      Alert.alert("Validation Error", "Password must contain at least one number");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      Alert.alert("Validation Error", "Passwords do not match");
      return false;
    }
    return true;
  };

  const isFormValid = (): boolean => {
    return (
      formData.phoneNumber.trim().length >= 10 &&
      formData.password.length >= 8 &&
      formData.password === formData.confirmPassword &&
      /[a-z]/.test(formData.password) &&
      /[A-Z]/.test(formData.password) &&
      /[0-9]/.test(formData.password)
    );
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Check if phone number already exists
      const existingAccountsStr = await AsyncStorage.getItem("carrier_driver_accounts");
      const existingAccounts = existingAccountsStr ? JSON.parse(existingAccountsStr) : [];
      
      const phoneExists = existingAccounts.some(
        (acc: any) => acc.phoneNumber === formData.phoneNumber.trim()
      );

      if (phoneExists) {
        Alert.alert(
          "Account Exists",
          "An account with this phone number already exists. Please log in instead.",
          [{ text: "OK" }]
        );
        setLoading(false);
        return;
      }

      // Save account data temporarily for next step
      await AsyncStorage.setItem("temp_driver_account", JSON.stringify({
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password,
        role: formData.role,
        rememberMe: formData.rememberMe,
        createdAt: new Date().toISOString(),
      }));

      // Navigate to personal details screen
      router.push("/carrier/register-driver" as any);
    } catch (error) {
      Alert.alert("Error", "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = calculatePasswordStrength(formData.password);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">Create Account</Text>
        </View>

        {/* Info Card */}
        <View className="px-6 mb-6">
          <View className="bg-blue-600 rounded-2xl p-4">
            <Text className="text-white text-sm leading-5">
              Create your carrier driver account to start accepting jobs and earning money. Complete all steps to submit your application.
            </Text>
          </View>
        </View>

        {/* Account Details Section */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">Account Details</Text>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Phone Number *</Text>
            <TextInput
              placeholder="Enter your phone number"
              placeholderTextColor="#9BA1A6"
              value={formData.phoneNumber}
              onChangeText={(text) => handleInputChange("phoneNumber", text)}
              keyboardType="phone-pad"
              returnKeyType="next"
              className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
              style={styles.input}
            />
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Create Password *</Text>
            <View className="relative">
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor="#9BA1A6"
                value={formData.password}
                onChangeText={(text) => handleInputChange("password", text)}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                className="bg-surface border border-border rounded-lg px-4 py-3 pr-12 text-foreground"
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3"
              >
                <MaterialIcons
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={24}
                  color="#9BA1A6"
                />
              </TouchableOpacity>
            </View>
            {formData.password.length > 0 && (
              <View className="mt-2">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-muted">Password Strength:</Text>
                  <Text className="text-xs font-semibold" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </Text>
                </View>
                <View className="h-2 bg-surface rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${(passwordStrength.score / 6) * 100}%`,
                      backgroundColor: passwordStrength.color,
                    }}
                  />
                </View>
              </View>
            )}
            <Text className="text-xs text-muted mt-2">
              Must be at least 8 characters with uppercase, lowercase, and number
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Confirm Password *</Text>
            <View className="relative">
              <TextInput
                placeholder="Re-enter your password"
                placeholderTextColor="#9BA1A6"
                value={formData.confirmPassword}
                onChangeText={(text) => handleInputChange("confirmPassword", text)}
                secureTextEntry={!showConfirmPassword}
                returnKeyType="done"
                className="bg-surface border border-border rounded-lg px-4 py-3 pr-12 text-foreground"
                style={styles.input}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-3"
              >
                <MaterialIcons
                  name={showConfirmPassword ? "visibility" : "visibility-off"}
                  size={24}
                  color="#9BA1A6"
                />
              </TouchableOpacity>
            </View>
            {formData.confirmPassword.length > 0 && (
              <View className="flex-row items-center mt-2">
                {formData.password === formData.confirmPassword ? (
                  <>
                    <MaterialIcons name="check-circle" size={16} color="#22C55E" />
                    <Text className="text-xs text-green-400 ml-1">Passwords match</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="error" size={16} color="#EF4444" />
                    <Text className="text-xs text-red-400 ml-1">Passwords do not match</Text>
                  </>
                )}
              </View>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-sm font-medium text-foreground mb-2">Role</Text>
            <View className="bg-surface border border-border rounded-lg px-4 py-3 flex-row items-center justify-between">
              <Text className="text-foreground">Carrier Driver</Text>
              <MaterialIcons name="lock" size={20} color="#9BA1A6" />
            </View>
            <Text className="text-xs text-muted mt-1">Role is locked and cannot be changed</Text>
          </View>

          {/* Remember Me Toggle */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-sm text-foreground">Remember Me</Text>
            <TouchableOpacity
              onPress={() => handleInputChange("rememberMe", !formData.rememberMe)}
              className={`w-12 h-7 rounded-full flex-row items-center px-1 ${
                formData.rememberMe ? "bg-green-600" : "bg-gray-400"
              }`}
            >
              <View
                className={`w-5 h-5 rounded-full bg-white ${formData.rememberMe ? "ml-auto" : ""}`}
              />
            </TouchableOpacity>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!isFormValid() || loading}
            className={`rounded-lg py-4 items-center ${
              isFormValid() && !loading ? "bg-blue-600" : "bg-gray-600"
            }`}
            style={!isFormValid() || loading ? { opacity: 0.6 } : undefined}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? "Creating Account..." : "Continue to Personal Details"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  input: {
    color: "#ECEDEE",
  },
});
