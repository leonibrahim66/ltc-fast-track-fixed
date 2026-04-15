/**
 * Council Admin Login Screen
 * Accessed via IT Management Portal → Council Admin Portal button
 * Province/city-scoped access — no cross-province visibility
 */
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
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function CouncilAdminLoginScreen() {
  const router = useRouter();
  const { loginAdmin } = useAdmin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
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
        // Route to council admin dashboard
        router.replace("/council-admin-dashboard" as any);
      } else {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert("Login Failed", "Invalid council admin credentials.\n\nNote: Only council_admin accounts can access this portal.");
      }
    } catch {
      Alert.alert("Error", "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <MaterialIcons name="arrow-back" size={24} color="#6B7280" />
            </TouchableOpacity>
            <View style={styles.iconWrap}>
              <MaterialIcons name="account-balance" size={40} color="#1D4ED8" />
            </View>
            <Text style={styles.title}>Council Admin Portal</Text>
            <Text style={styles.subtitle}>
              Province & City-Scoped Administration
            </Text>
            <View style={styles.infoBadge}>
              <MaterialIcons name="security" size={14} color="#1D4ED8" />
              <Text style={styles.infoText}>Restricted access — Council accounts only</Text>
            </View>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Sign In</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="person" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. council_lusaka"
                  placeholderTextColor="#9CA3AF"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <MaterialIcons name="lock" size={20} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="Enter password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <MaterialIcons name={showPassword ? "visibility-off" : "visibility"} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <MaterialIcons name="login" size={20} color="#fff" />
              <Text style={styles.loginBtnText}>
                {isLoading ? "Signing in..." : "Sign In to Council Portal"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sample credentials hint */}
          <View style={styles.hint}>
            <MaterialIcons name="info-outline" size={14} color="#6B7280" />
            <Text style={styles.hintText}>
              Sample: council_lusaka / council@lusaka2026
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: _rs.sp(24), justifyContent: "center" },
  header: { alignItems: "center", marginBottom: _rs.sp(32) },
  backBtn: { position: "absolute", left: 0, top: 0, padding: _rs.sp(4) },
  iconWrap: {
    width: _rs.s(80),
    height: _rs.s(80),
    borderRadius: _rs.s(20),
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: _rs.sp(16),
    marginTop: _rs.sp(8),
  },
  title: { fontSize: _rs.fs(24), fontWeight: "700", color: "#111827", marginBottom: _rs.sp(6) },
  subtitle: { fontSize: _rs.fs(14), color: "#6B7280", textAlign: "center", marginBottom: _rs.sp(12) },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(6),
    backgroundColor: "#EFF6FF",
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
    borderRadius: _rs.s(20),
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoText: { fontSize: _rs.fs(12), color: "#1D4ED8" },
  form: {
    backgroundColor: "#fff",
    borderRadius: _rs.s(16),
    padding: _rs.sp(24),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: _rs.sp(16),
  },
  formTitle: { fontSize: _rs.fs(18), fontWeight: "600", color: "#111827", marginBottom: _rs.sp(20) },
  inputGroup: { marginBottom: _rs.sp(16) },
  label: { fontSize: _rs.fs(13), fontWeight: "500", color: "#374151", marginBottom: _rs.sp(6) },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: _rs.s(10),
    backgroundColor: "#F9FAFB",
    paddingHorizontal: _rs.sp(12),
  },
  inputIcon: { marginRight: _rs.sp(8) },
  input: { flex: 1, height: _rs.s(48), fontSize: _rs.fs(15), color: "#111827" },
  inputFlex: { flex: 1 },
  eyeBtn: { padding: _rs.sp(4) },
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: _rs.sp(8),
    backgroundColor: "#1D4ED8",
    paddingVertical: _rs.sp(14),
    borderRadius: _rs.s(12),
    marginTop: _rs.sp(8),
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: "#fff", fontSize: _rs.fs(16), fontWeight: "600" },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(6),
    justifyContent: "center",
    opacity: 0.6,
  },
  hintText: { fontSize: _rs.fs(12), color: "#6B7280" },
});
