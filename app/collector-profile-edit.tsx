import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function CollectorProfileEditScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, updateUser } = useAuth();

  const [profileImage, setProfileImage] = useState(user?.profilePicture || "");
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleImagePick = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please allow access to your photo library to update your profile picture.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName || !phone) {
      Alert.alert("Error", "Full name and phone are required");
      return;
    }

    try {
      await updateUser({
        profilePicture: profileImage,
        fullName,
        phone,
      });
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update profile");
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    // TODO: Implement password change logic
    Alert.alert("Success", "Password changed successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Edit Profile
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Image Section */}
        <View style={styles.imageSection}>
          <TouchableOpacity onPress={handleImagePick} style={styles.imageContainer}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImage} />
            ) : (
              <View
                style={[styles.imagePlaceholder, { backgroundColor: colors.surface }]}
              >
                <MaterialIcons name="person" size={64} color={colors.muted} />
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="camera-alt" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.imageHint, { color: colors.muted }]}>
            Tap to change profile photo
          </Text>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Basic Information
          </Text>

          <Text style={[styles.label, { color: colors.foreground }]}>Full Name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
            ]}
          />

          <Text style={[styles.label, { color: colors.foreground }]}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter your phone number"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={[
              styles.input,
              { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
            ]}
          />

          <TouchableOpacity
            onPress={handleSaveProfile}
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>

        {/* Read-Only Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Account Information
          </Text>

          <Text style={[styles.label, { color: colors.foreground }]}>Collector Type</Text>
          <View
            style={[
              styles.readOnlyField,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialIcons name="local-shipping" size={20} color={colors.muted} />
            <Text style={[styles.readOnlyText, { color: colors.muted }]}>
              {user?.collectorType === "vehicle" ? "Vehicle Collector" : "Foot Collector"}
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.foreground }]}>Transport Category</Text>
          <View
            style={[
              styles.readOnlyField,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialIcons name="category" size={20} color={colors.muted} />
            <Text style={[styles.readOnlyText, { color: colors.muted }]}>
              {user?.transportCategory || "Not assigned"}
            </Text>
          </View>
        </View>

        {/* Change Password */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Change Password
          </Text>

          <Text style={[styles.label, { color: colors.foreground }]}>Current Password</Text>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={[
              styles.input,
              { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
            ]}
          />

          <Text style={[styles.label, { color: colors.foreground }]}>New Password</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={[
              styles.input,
              { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
            ]}
          />

          <Text style={[styles.label, { color: colors.foreground }]}>Confirm New Password</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={[
              styles.input,
              { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
            ]}
          />

          <TouchableOpacity
            onPress={handleChangePassword}
            style={[styles.saveButton, { backgroundColor: "#EF4444" }]}
          >
            <Text style={styles.saveButtonText}>Change Password</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(16),
    borderBottomWidth: 1,
  },
  backButton: {
    padding: _rs.sp(8),
  },
  headerTitle: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  imageSection: {
    alignItems: "center",
    paddingVertical: _rs.sp(32),
  },
  imageContainer: {
    position: "relative",
  },
  profileImage: {
    width: _rs.s(120),
    height: _rs.s(120),
    borderRadius: 60,
  },
  imagePlaceholder: {
    width: _rs.s(120),
    height: _rs.s(120),
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: _rs.s(36),
    height: _rs.s(36),
    borderRadius: _rs.s(18),
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  imageHint: {
    marginTop: _rs.sp(12),
    fontSize: _rs.fs(14),
  },
  section: {
    padding: _rs.sp(16),
    marginBottom: _rs.sp(8),
  },
  sectionTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    marginBottom: _rs.sp(16),
  },
  label: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
    marginBottom: _rs.sp(8),
    marginTop: _rs.sp(12),
  },
  input: {
    borderWidth: 1,
    borderRadius: _rs.s(8),
    padding: _rs.sp(12),
    fontSize: _rs.fs(15),
  },
  readOnlyField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: _rs.s(8),
    padding: _rs.sp(12),
    gap: _rs.sp(8),
  },
  readOnlyText: {
    fontSize: _rs.fs(15),
  },
  saveButton: {
    marginTop: _rs.sp(20),
    paddingVertical: _rs.sp(14),
    borderRadius: _rs.s(8),
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: _rs.fs(16),
    fontWeight: "600",
  },
});
