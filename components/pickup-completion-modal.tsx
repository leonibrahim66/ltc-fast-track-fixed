import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

interface PickupCompletionModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (notes: string, photos: string[]) => Promise<void>;
  pickupAddress?: string;
}

export function PickupCompletionModal({
  visible,
  onClose,
  onComplete,
  pickupAddress,
}: PickupCompletionModalProps) {
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    if (photos.length >= 4) {
      Alert.alert("Limit Reached", "You can add up to 4 photos.");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to add pickup photos."
      );
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
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const takePhoto = async () => {
    if (photos.length >= 4) {
      Alert.alert("Limit Reached", "You can add up to 4 photos.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow camera access to take pickup photos."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(notes, photos);
      // Reset state
      setNotes("");
      setPhotos([]);
      onClose();
    } catch (_error) {
      Alert.alert("Error", "Failed to complete pickup. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNotes("");
    setPhotos([]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-background rounded-t-3xl max-h-[90%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
            <Text className="text-lg font-bold text-foreground">
              Complete Pickup
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <MaterialIcons name="close" size={24} color="#687076" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-6 py-4">
            {/* Location Info */}
            {pickupAddress && (
              <View className="bg-primary/10 rounded-xl p-4 mb-4">
                <View className="flex-row items-center">
                  <MaterialIcons name="location-on" size={20} color="#22C55E" />
                  <Text className="text-foreground ml-2 flex-1" numberOfLines={2}>
                    {pickupAddress}
                  </Text>
                </View>
              </View>
            )}

            {/* Photo Section */}
            <View className="mb-4">
              <Text className="text-foreground font-semibold mb-2">
                Pickup Photos (Optional)
              </Text>
              <Text className="text-muted text-sm mb-3">
                Add photos as proof of completed pickup
              </Text>

              {/* Photo Grid */}
              <View className="flex-row flex-wrap">
                {photos.map((uri, index) => (
                  <View key={index} className="w-1/2 p-1">
                    <View className="relative">
                      <Image
                        source={{ uri }}
                        className="w-full h-24 rounded-xl"
                        contentFit="cover"
                      />
                      <TouchableOpacity
                        onPress={() => removePhoto(index)}
                        className="absolute -top-2 -right-2 bg-error rounded-full w-6 h-6 items-center justify-center"
                      >
                        <MaterialIcons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {photos.length < 4 && (
                  <View className="w-1/2 p-1">
                    <View className="flex-row">
                      <TouchableOpacity
                        onPress={takePhoto}
                        className="flex-1 h-24 bg-surface rounded-xl border border-dashed border-border items-center justify-center mr-1"
                      >
                        <MaterialIcons name="camera-alt" size={24} color="#687076" />
                        <Text className="text-muted text-xs mt-1">Camera</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={pickImage}
                        className="flex-1 h-24 bg-surface rounded-xl border border-dashed border-border items-center justify-center ml-1"
                      >
                        <MaterialIcons name="photo-library" size={24} color="#687076" />
                        <Text className="text-muted text-xs mt-1">Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Notes Section */}
            <View className="mb-6">
              <Text className="text-foreground font-semibold mb-2">
                Completion Notes (Optional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Add any notes about this pickup..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
                style={{ textAlignVertical: "top", minHeight: 80 }}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              className={`py-4 rounded-xl items-center mb-6 ${
                isSubmitting ? "bg-primary/50" : "bg-primary"
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View className="flex-row items-center">
                  <MaterialIcons name="check-circle" size={20} color="#fff" />
                  <Text className="text-white font-semibold ml-2">
                    Mark as Completed
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
