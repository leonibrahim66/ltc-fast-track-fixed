import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  Alert,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePickups } from "@/lib/pickups-context";
import { useDisputes, DISPUTE_TYPES, DisputeType } from "@/lib/disputes-context";
import { useNotifications } from "@/lib/notifications-context";
import { useITRealtime } from "@/lib/it-realtime-context";
import { useAdmin } from "@/lib/admin-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function ReportDisputeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pickupId: string }>();
  const { user } = useAuth();
  const { getPickupById } = usePickups();
  const { createDispute } = useDisputes();
  const { addNotification } = useNotifications();
  const { addEvent } = useITRealtime();
  const { addNotification: addAdminNotification } = useAdmin();

  const pickup = params.pickupId ? getPickupById(params.pickupId) : undefined;

  const [selectedType, setSelectedType] = useState<DisputeType | null>(null);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickImage = async () => {
    if (photos.length >= 4) {
      Alert.alert("Limit Reached", "You can only add up to 4 photos as evidence.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library to upload evidence.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const handleTakePhoto = async () => {
    if (photos.length >= 4) {
      Alert.alert("Limit Reached", "You can only add up to 4 photos as evidence.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera access is needed to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert("Select Issue Type", "Please select the type of issue you experienced.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Description Required", "Please describe the issue in detail.");
      return;
    }

    if (description.trim().length < 20) {
      Alert.alert("More Details Needed", "Please provide at least 20 characters describing the issue.");
      return;
    }

    if (!user || !pickup) {
      Alert.alert("Error", "Unable to submit dispute. Please try again.");
      return;
    }

    setIsSubmitting(true);

    try {
      await createDispute({
        pickupId: pickup.id,
        userId: user.id,
        userName: user.fullName,
        userPhone: user.phone,
        collectorId: pickup.collectorId,
        collectorName: pickup.collectorName,
        type: selectedType,
        description: description.trim(),
        photoEvidence: photos.length > 0 ? photos : undefined,
      });

      // Fix 5: Emit dispute event to admin live screens
      addEvent({
        type: "dispute_filed",
        title: "New Dispute Filed",
        description: `${user.fullName || user.phone} filed a ${selectedType?.replace(/_/g, " ")} dispute`,
        data: { userName: user.fullName || user.phone, pickupId: pickup.id },
        priority: "critical",
      });
      addAdminNotification({
        type: "dispute",
        title: "New Dispute Filed",
        message: `${user.fullName || user.phone} filed a ${selectedType?.replace(/_/g, " ")} dispute for pickup #${pickup.id.slice(-6)}`,
      });

      // Add notification
      addNotification({
        type: "system",
        title: "Dispute Submitted",
        message: `Your dispute for pickup #${pickup.id.slice(-6)} has been submitted and is being reviewed.`,
      });

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        "Dispute Submitted",
        "Your dispute has been submitted successfully. We will review it and get back to you within 24-48 hours.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error("Failed to submit dispute:", error);
      Alert.alert("Error", "Failed to submit dispute. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pickup) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center p-6">
          <MaterialIcons name="error-outline" size={64} color="#EF4444" />
          <Text className="text-lg font-semibold text-foreground mt-4">Pickup Not Found</Text>
          <Text className="text-muted text-center mt-2">
            The pickup you are trying to report could not be found.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-primary px-6 py-3 rounded-xl mt-6"
          >
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center px-6 pt-4 pb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4"
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#11181C" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Report Issue</Text>
            <Text className="text-muted">Pickup #{pickup.id.slice(-6)}</Text>
          </View>
        </View>

        {/* Pickup Info Card */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="local-shipping" size={20} color="#22C55E" />
              <Text className="font-medium text-foreground ml-2">Pickup Details</Text>
            </View>
            <View className="flex-row justify-between mt-2">
              <Text className="text-muted text-sm">Date:</Text>
              <Text className="text-foreground text-sm">
                {new Date(pickup.completedAt || pickup.createdAt).toLocaleDateString()}
              </Text>
            </View>
            {pickup.collectorName && (
              <View className="flex-row justify-between mt-1">
                <Text className="text-muted text-sm">Collector:</Text>
                <Text className="text-foreground text-sm">{pickup.collectorName}</Text>
              </View>
            )}
            <View className="flex-row justify-between mt-1">
              <Text className="text-muted text-sm">Type:</Text>
              <Text className="text-foreground text-sm capitalize">{pickup.binType}</Text>
            </View>
          </View>
        </View>

        {/* Issue Type Selection */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">
            What went wrong?
          </Text>
          <View className="gap-3">
            {(Object.entries(DISPUTE_TYPES) as [DisputeType, typeof DISPUTE_TYPES[DisputeType]][]).map(
              ([type, info]) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setSelectedType(type);
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  className={`flex-row items-center p-4 rounded-xl border ${
                    selectedType === type
                      ? "bg-red-50 border-red-300"
                      : "bg-surface border-border"
                  }`}
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                      selectedType === type ? "bg-red-100" : "bg-gray-100"
                    }`}
                  >
                    <MaterialIcons
                      name={info.icon as any}
                      size={20}
                      color={selectedType === type ? "#EF4444" : "#6B7280"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-medium ${
                        selectedType === type ? "text-red-700" : "text-foreground"
                      }`}
                    >
                      {info.label}
                    </Text>
                    <Text
                      className={`text-xs mt-0.5 ${
                        selectedType === type ? "text-red-600" : "text-muted"
                      }`}
                    >
                      {info.description}
                    </Text>
                  </View>
                  {selectedType === type && (
                    <MaterialIcons name="check-circle" size={24} color="#EF4444" />
                  )}
                </TouchableOpacity>
              )
            )}
          </View>
        </View>

        {/* Description */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">
            Describe the issue
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Please provide details about what happened..."
            placeholderTextColor="#9BA1A6"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            className="bg-surface border border-border rounded-xl p-4 text-foreground"
            style={styles.textArea}
          />
          <Text className="text-xs text-muted mt-2">
            Minimum 20 characters ({description.length}/20)
          </Text>
        </View>

        {/* Photo Evidence */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-2">
            Photo Evidence (Optional)
          </Text>
          <Text className="text-muted text-sm mb-4">
            Add photos to support your claim (up to 4 photos)
          </Text>

          <View className="flex-row flex-wrap gap-3">
            {photos.map((photo, index) => (
              <View key={index} className="relative">
                <Image
                  source={{ uri: photo }}
                  className="w-20 h-20 rounded-xl"
                />
                <TouchableOpacity
                  onPress={() => handleRemovePhoto(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 items-center justify-center"
                >
                  <MaterialIcons name="close" size={16} color="white" />
                </TouchableOpacity>
              </View>
            ))}

            {photos.length < 4 && (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handlePickImage}
                  className="w-20 h-20 rounded-xl bg-surface border-2 border-dashed border-border items-center justify-center"
                >
                  <MaterialIcons name="photo-library" size={24} color="#6B7280" />
                  <Text className="text-xs text-muted mt-1">Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleTakePhoto}
                  className="w-20 h-20 rounded-xl bg-surface border-2 border-dashed border-border items-center justify-center"
                >
                  <MaterialIcons name="camera-alt" size={24} color="#6B7280" />
                  <Text className="text-xs text-muted mt-1">Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* What Happens Next */}
        <View className="px-6 mb-6">
          <View className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="info" size={20} color="#3B82F6" />
              <Text className="font-medium text-blue-800 ml-2">What happens next?</Text>
            </View>
            <View className="gap-2">
              <View className="flex-row items-start">
                <Text className="text-blue-600 mr-2">1.</Text>
                <Text className="text-blue-700 text-sm flex-1">
                  Our team will review your dispute within 24-48 hours
                </Text>
              </View>
              <View className="flex-row items-start">
                <Text className="text-blue-600 mr-2">2.</Text>
                <Text className="text-blue-700 text-sm flex-1">
                  We may contact you or the collector for more information
                </Text>
              </View>
              <View className="flex-row items-start">
                <Text className="text-blue-600 mr-2">3.</Text>
                <Text className="text-blue-700 text-sm flex-1">
                  You will be notified of the resolution via the app
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <View className="px-6">
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || !selectedType || !description.trim()}
            className={`py-4 rounded-xl items-center ${
              isSubmitting || !selectedType || !description.trim()
                ? "bg-gray-300"
                : "bg-red-500"
            }`}
          >
            {isSubmitting ? (
              <Text className="text-white font-semibold">Submitting...</Text>
            ) : (
              <View className="flex-row items-center">
                <MaterialIcons name="report-problem" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Submit Dispute</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backButton: {
    padding: _rs.sp(8),
  },
  textArea: {
    minHeight: 120,
    fontSize: _rs.fs(16),
  },
});
