import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notifications-context";
import { APP_CONFIG, CONTACTS, TRANSPORT_CATEGORIES } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser } = useAuth();
  const { unreadCount } = useNotifications();
  const [isUploading, setIsUploading] = useState(false);

  const isCollector = user?.role === "collector" || user?.role === "zone_manager";
  const transportCategory = TRANSPORT_CATEGORIES.find(
    (t) => t.id === user?.transportCategory
  );

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/(auth)/welcome" as any);
          },
        },
      ]
    );
  };

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your photo library to set a profile picture."
        );
        return;
      }

      // Show options
      Alert.alert(
        "Profile Picture",
        "Choose how you want to add your profile picture",
        [
          {
            text: "Take Photo",
            onPress: async () => {
              const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
              if (cameraStatus.status !== "granted") {
                Alert.alert("Permission Required", "Please allow camera access.");
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
              });
              if (!result.canceled && result.assets[0]) {
                await saveProfilePicture(result.assets[0].uri);
              }
            },
          },
          {
            text: "Choose from Library",
            onPress: async () => {
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
              });
              if (!result.canceled && result.assets[0]) {
                await saveProfilePicture(result.assets[0].uri);
              }
            },
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const saveProfilePicture = async (uri: string) => {
    setIsUploading(true);
    try {
      await updateUser({ profilePicture: uri });
      Alert.alert("Success", "Profile picture updated successfully!");
    } catch (error) {
      console.error("Error saving profile picture:", error);
      Alert.alert("Error", "Failed to save profile picture. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeProfilePicture = () => {
    Alert.alert(
      "Remove Picture",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await updateUser({ profilePicture: undefined });
          },
        },
      ]
    );
  };

  const openWhatsApp = () => {
    Linking.openURL(CONTACTS.whatsappSupport);
  };

  const openWhatsAppGroup = () => {
    Linking.openURL(CONTACTS.whatsappGroup);
  };

  const openWhatsAppChannel = () => {
    Linking.openURL(CONTACTS.whatsappChannel);
  };

  const makeCall = () => {
    Linking.openURL(`tel:${CONTACTS.mainPhone}`);
  };

  const sendEmail = () => {
    Linking.openURL(`mailto:${CONTACTS.emails[0]}`);
  };

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">Profile</Text>
          <View className="flex-row items-center">
            {/* Notification Bell */}
            <TouchableOpacity
              onPress={() => router.push("/notifications" as any)}
              className="relative mr-3"
            >
              <MaterialIcons name="notifications" size={24} color="#6B7280" />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-error w-5 h-5 rounded-full items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/edit-profile" as any)}
              className="bg-primary/10 px-4 py-2 rounded-full flex-row items-center"
            >
              <MaterialIcons name="edit" size={16} color="#22C55E" />
              <Text className="text-primary font-medium ml-1">Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* User Info Card */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <View className="flex-row items-center mb-4">
              {/* Profile Picture */}
              <TouchableOpacity
                onPress={pickImage}
                onLongPress={user.profilePicture ? removeProfilePicture : undefined}
                disabled={isUploading}
                className="relative"
              >
                {user.profilePicture ? (
                  <Image
                    source={{ uri: user.profilePicture }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View className="w-20 h-20 rounded-full bg-primary items-center justify-center">
                    <Text className="text-white text-3xl font-bold">
                      {user.fullName?.charAt(0).toUpperCase() || "U"}
                    </Text>
                  </View>
                )}
                {/* Camera Icon Overlay */}
                <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary items-center justify-center border-2 border-white">
                  <MaterialIcons name="camera-alt" size={14} color="#fff" />
                </View>
                {isUploading && (
                  <View className="absolute inset-0 rounded-full bg-black/50 items-center justify-center">
                    <Text className="text-white text-xs">Saving...</Text>
                  </View>
                )}
              </TouchableOpacity>

              <View className="ml-4 flex-1">
                <Text className="text-xl font-bold text-foreground">
                  {user.fullName}
                </Text>
                <Text className="text-muted">{user.phone}</Text>
                <View className="flex-row items-center mt-1">
                  <View className="bg-primary/10 px-2 py-1 rounded-full">
                    <Text className="text-primary text-xs font-medium capitalize">
                      {user.role}
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-muted mt-2">
                  Tap photo to change • Hold to remove
                </Text>
              </View>
            </View>

            {/* Location */}
            {user.location?.address && (
              <View className="flex-row items-center pt-4 border-t border-border">
                <MaterialIcons name="location-on" size={18} color="#6B7280" />
                <Text className="text-muted ml-2 flex-1" numberOfLines={2}>
                  {user.location.address}
                </Text>
              </View>
            )}

            {/* Collector Info */}
            {isCollector && (
              <View className="pt-4 border-t border-border mt-4">
                {user.idNumber && (
                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="badge" size={18} color="#6B7280" />
                    <Text className="text-muted ml-2">ID: {user.idNumber}</Text>
                  </View>
                )}
                {transportCategory && (
                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="local-shipping" size={18} color="#6B7280" />
                    <Text className="text-muted ml-2">{transportCategory.name}</Text>
                  </View>
                )}
                {user.vehicleRegistration && (
                  <View className="flex-row items-center">
                    <MaterialIcons name="directions-car" size={18} color="#6B7280" />
                    <Text className="text-muted ml-2">{user.vehicleRegistration}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Subscription Info (for customers) */}
            {!isCollector && user.subscription && (
              <View className="pt-4 border-t border-border mt-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-foreground font-medium">Subscription</Text>
                  <View className="bg-success/10 px-3 py-1 rounded-full">
                    <Text className="text-success text-sm font-medium">Active</Text>
                  </View>
                </View>
                <Text className="text-muted mt-1">
                  {user.subscription.planName} Plan
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu Items */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-muted mb-3 uppercase">
            Support
          </Text>

          <MenuItem
            icon="chat"
            label="WhatsApp Support"
            subtitle="Chat with us directly"
            onPress={openWhatsApp}
          />
          <MenuItem
            icon="group"
            label="Join WhatsApp Group"
            subtitle="Connect with the community"
            onPress={openWhatsAppGroup}
          />
          <MenuItem
            icon="campaign"
            label="Follow WhatsApp Channel"
            subtitle="Liquid Trash Cash updates"
            onPress={openWhatsAppChannel}
          />
          <MenuItem
            icon="phone"
            label="Call Support"
            subtitle={CONTACTS.mainPhone}
            onPress={makeCall}
          />
          <MenuItem
            icon="email"
            label="Email Us"
            subtitle={CONTACTS.emails[0]}
            onPress={sendEmail}
          />
          <MenuItem
            icon="contacts"
            label="All Contact Info"
            subtitle="Phone, WhatsApp, Social Media"
            onPress={() => router.push("/contact-us" as any)}
          />
          {!isCollector && (
            <MenuItem
              icon="gavel"
              label="My Disputes"
              subtitle="View reported pickup issues"
              onPress={() => router.push("/dispute-history" as any)}
            />
          )}
        </View>





        {/* Community */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-muted mb-3 uppercase">
            Community
          </Text>

          <MenuItem
            icon="emoji-events"
            label="Collector Leaderboard"
            subtitle="Top performing collectors"
            onPress={() => router.push("/leaderboard" as any)}
          />
        </View>

        {/* Settings */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-muted mb-3 uppercase">
            Settings
          </Text>

          <MenuItem
            icon="lock"
            label="Change Password"
            subtitle="Update your account password"
            onPress={() => router.push("/change-password" as any)}
          />
          <MenuItem
            icon="fingerprint"
            label="Biometric Login"
            subtitle="Face ID / Fingerprint authentication"
            onPress={() => router.push("/biometric-settings" as any)}
          />
          <MenuItem
            icon="devices"
            label="Device Management"
            subtitle="Manage logged-in devices"
            onPress={() => router.push("/device-management" as any)}
          />
          <MenuItem
            icon="notifications-active"
            label="Pickup Reminders"
            subtitle="Manage reminder notifications"
            onPress={() => router.push("/reminder-settings" as any)}
          />
          <MenuItem
            icon="map"
            label="Service Areas"
            subtitle="View coverage zones and pricing"
            onPress={() => router.push("/service-zones" as any)}
          />
          <MenuItem
            icon="translate"
            label="Language"
            subtitle="English, Bemba, Nyanja, Tonga"
            onPress={() => router.push("/language-settings" as any)}
          />
        </View>

        {/* About & Legal */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-muted mb-3 uppercase">
            About
          </Text>

          <MenuItem
            icon="info"
            label="About LTC FAST TRACK"
            subtitle="Learn more about us"
            onPress={() => router.push("/about" as any)}
          />
        </View>

        {/* Logout */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-error/10 rounded-xl p-4 flex-row items-center justify-center"
          >
            <MaterialIcons name="logout" size={20} color="#EF4444" />
            <Text className="text-error font-semibold ml-2">Logout</Text>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View className="items-center pb-6">
          <Text className="text-muted text-sm">
            {APP_CONFIG.name} v1.0.0
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-surface rounded-xl p-4 mb-2 flex-row items-center border border-border"
    >
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
        <MaterialIcons name={icon as any} size={20} color="#22C55E" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-foreground font-medium">{label}</Text>
        {subtitle && <Text className="text-sm text-muted">{subtitle}</Text>}
      </View>
      <MaterialIcons name="chevron-right" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  profileImage: {
    width: _rs.s(80),
    height: _rs.s(80),
    borderRadius: _rs.s(40),
    backgroundColor: "#E5E7EB",
  },
});
