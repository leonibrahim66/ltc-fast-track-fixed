import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { CONTACTS } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function ReportIssueScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [description, setDescription] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Camera permission is required to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Photo library permission is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Error", "Please describe the issue");
      return;
    }

    setIsSubmitting(true);

    try {
      const existing = await AsyncStorage.getItem("@ltc_issue_reports");
      const reports: object[] = existing ? JSON.parse(existing) : [];
      reports.push({
        id: `report_${Date.now()}`,
        userId: user?.id,
        userName: user?.fullName,
        userPhone: user?.phone,
        description: description.trim(),
        photoUri: photoUri,
        createdAt: new Date().toISOString(),
        status: "pending",
      });
      await AsyncStorage.setItem("@ltc_issue_reports", JSON.stringify(reports));
      setIsSubmitting(false);
      Alert.alert(
        "Report Submitted",
        "Thank you for your report. Our team will review it and take appropriate action.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (_error) {
      setIsSubmitting(false);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    }
  };

  const sendViaWhatsApp = () => {
    const message = `*Garbage Issue Report*\n\nFrom: ${user?.fullName}\nPhone: ${user?.phone}\n\nDescription: ${description}`;
    const url = `https://wa.me/${CONTACTS.supportPhone.replace("+", "")}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 px-6 pt-8">
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-6"
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          {/* Header */}
          <Text className="text-3xl font-bold text-foreground mb-2">
            Report Issue
          </Text>
          <Text className="text-base text-muted mb-6">
            Report garbage problems in your area
          </Text>

          {/* Photo Section */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-foreground mb-2">
              Photo of Issue
            </Text>
            {photoUri ? (
              <View className="relative">
                <Image
                  source={{ uri: photoUri }}
                  className="w-full h-48 rounded-xl"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={() => setPhotoUri(null)}
                  className="absolute top-2 right-2 bg-error p-2 rounded-full"
                >
                  <MaterialIcons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row">
                <TouchableOpacity
                  onPress={takePhoto}
                  className="flex-1 bg-surface border border-border rounded-xl p-6 mr-2 items-center"
                >
                  <MaterialIcons name="camera-alt" size={40} color="#22C55E" />
                  <Text className="text-muted text-sm mt-2">Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={pickImage}
                  className="flex-1 bg-surface border border-border rounded-xl p-6 ml-2 items-center"
                >
                  <MaterialIcons name="photo-library" size={40} color="#22C55E" />
                  <Text className="text-muted text-sm mt-2">Choose Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-foreground mb-2">
              Describe the Issue
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the garbage issue, location, and any other relevant details..."
              multiline
              numberOfLines={5}
              className="bg-surface border border-border rounded-xl p-4 text-foreground min-h-32"
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
            />
          </View>

          {/* Location Info */}
          {user?.location?.address && (
            <View className="bg-surface rounded-xl p-4 mb-6 border border-border flex-row items-center">
              <MaterialIcons name="location-on" size={20} color="#22C55E" />
              <View className="ml-3 flex-1">
                <Text className="text-sm text-muted">Your Location</Text>
                <Text className="text-foreground">{user.location.address}</Text>
              </View>
            </View>
          )}

          <View className="flex-1" />

          {/* Submit Buttons */}
          <View className="mb-6">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              className="bg-primary py-4 rounded-full mb-3"
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center text-lg font-semibold">
                  Submit Report
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={sendViaWhatsApp}
              className="bg-success py-4 rounded-full flex-row items-center justify-center"
              style={styles.button}
            >
              <MaterialIcons name="chat" size={20} color="#fff" />
              <Text className="text-white text-center text-lg font-semibold ml-2">
                Send via WhatsApp
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
