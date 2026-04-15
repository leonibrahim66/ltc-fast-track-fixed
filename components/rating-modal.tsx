import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Pressable,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
  collectorName?: string;
  pickupAddress?: string;
}

export function RatingModal({
  visible,
  onClose,
  onSubmit,
  collectorName,
  pickupAddress,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleSubmit = () => {
    if (rating === 0) {
      return;
    }
    onSubmit(rating, comment);
    setRating(0);
    setComment("");
  };

  const handleClose = () => {
    setRating(0);
    setComment("");
    onClose();
  };

  const getRatingLabel = (r: number) => {
    switch (r) {
      case 1:
        return "Poor";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Very Good";
      case 5:
        return "Excellent";
      default:
        return "Tap to rate";
    }
  };

  const displayRating = hoveredRating || rating;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={handleClose}
      >
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <View className="bg-background rounded-3xl p-6 w-full max-w-sm">
            {/* Header */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mb-4">
                <MaterialIcons name="star" size={32} color="#22C55E" />
              </View>
              <Text className="text-xl font-bold text-foreground text-center">
                Rate Your Pickup
              </Text>
              <Text className="text-muted text-center mt-1">
                How was your experience?
              </Text>
            </View>

            {/* Pickup Info */}
            {(collectorName || pickupAddress) && (
              <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
                {collectorName && (
                  <View className="flex-row items-center mb-2">
                    <MaterialIcons name="person" size={18} color="#6B7280" />
                    <Text className="text-foreground ml-2">
                      Collector: {collectorName}
                    </Text>
                  </View>
                )}
                {pickupAddress && (
                  <View className="flex-row items-center">
                    <MaterialIcons name="location-on" size={18} color="#6B7280" />
                    <Text className="text-muted text-sm ml-2" numberOfLines={1}>
                      {pickupAddress}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Star Rating */}
            <View className="items-center mb-4">
              <View className="flex-row mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    onPressIn={() => setHoveredRating(star)}
                    onPressOut={() => setHoveredRating(0)}
                    className="px-2"
                  >
                    <MaterialIcons
                      name={star <= displayRating ? "star" : "star-border"}
                      size={40}
                      color={star <= displayRating ? "#F59E0B" : "#D1D5DB"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text
                className={`text-base font-medium ${
                  displayRating > 0 ? "text-foreground" : "text-muted"
                }`}
              >
                {getRatingLabel(displayRating)}
              </Text>
            </View>

            {/* Comment Input */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">
                Additional Comments (Optional)
              </Text>
              <TextInput
                value={comment}
                onChangeText={setComment}
                placeholder="Tell us about your experience..."
                multiline
                numberOfLines={3}
                className="bg-surface border border-border rounded-xl p-4 text-foreground"
                placeholderTextColor="#9CA3AF"
                textAlignVertical="top"
              />
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={handleClose}
                className="flex-1 py-4 rounded-xl border border-border bg-surface"
              >
                <Text className="text-foreground text-center font-semibold">
                  Skip
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={rating === 0}
                className={`flex-1 py-4 rounded-xl ${
                  rating > 0 ? "bg-primary" : "bg-muted"
                }`}
              >
                <Text className="text-white text-center font-semibold">
                  Submit Rating
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: _rs.sp(24),
  },
  modalContainer: {
    width: "100%",
    maxWidth: 400,
  },
});
