import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function RateDriverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string; driverName?: string }>();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleStarPress = (star: number) => {
    setRating(star);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert("Rating Required", "Please select a star rating before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      // Load existing ratings
      const ratingsStr = await AsyncStorage.getItem("carrier_driver_ratings");
      const ratings = ratingsStr ? JSON.parse(ratingsStr) : [];

      // Check for duplicate rating
      const existing = ratings.find((r: any) => r.bookingId === params.bookingId);
      if (existing) {
        Alert.alert("Already Rated", "You have already rated this delivery.");
        setSubmitting(false);
        return;
      }

      // Save rating
      const newRating = {
        id: `rating_${Date.now()}`,
        bookingId: params.bookingId || `booking_${Date.now()}`,
        driverName: params.driverName || "Driver",
        rating,
        review: review.trim(),
        createdAt: new Date().toISOString(),
      };

      ratings.unshift(newRating);
      await AsyncStorage.setItem("carrier_driver_ratings", JSON.stringify(ratings));

      // Add notification for driver
      const notifsStr = await AsyncStorage.getItem("carrier_notifications");
      const notifs = notifsStr ? JSON.parse(notifsStr) : [];
      notifs.unshift({
        id: `notif_${Date.now()}`,
        type: "rating_received",
        title: "New Rating Received",
        message: `You received a ${rating}-star rating${review.trim() ? `: "${review.trim()}"` : ""}`,
        bookingId: params.bookingId || "",
        recipientType: "driver",
        recipientId: params.driverName || "driver",
        read: false,
        createdAt: new Date().toISOString(),
      });
      await AsyncStorage.setItem("carrier_notifications", JSON.stringify(notifs));

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setSubmitted(true);
    } catch (e) {
      Alert.alert("Error", "Failed to submit rating.");
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingLabel = (r: number) => {
    switch (r) {
      case 1: return "Poor";
      case 2: return "Fair";
      case 3: return "Good";
      case 4: return "Very Good";
      case 5: return "Excellent";
      default: return "Tap a star to rate";
    }
  };

  if (submitted) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-6">
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={64} color="#22C55E" />
          </View>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800", marginTop: 16 }}>
            Thank You!
          </Text>
          <Text className="text-muted text-center mt-2 text-sm">
            Your {rating}-star rating has been submitted.{"\n"}
            This helps improve our service quality.
          </Text>
          <View className="flex-row mt-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <MaterialIcons
                key={star}
                name="star"
                size={28}
                color={star <= rating ? "#FBBF24" : "#4B5563"}
              />
            ))}
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={styles.doneBtn}
          >
            <Text style={{ color: "#166534", fontWeight: "700", fontSize: 15 }}>Done</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 pt-4 pb-3 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground">Rate Your Driver</Text>
        </View>

        {/* Driver Info */}
        <View className="px-6 mb-6">
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <MaterialIcons name="person" size={32} color="#22C55E" />
            </View>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 12 }}>
              {params.driverName || "Your Driver"}
            </Text>
            {params.bookingId && (
              <Text className="text-muted text-xs mt-1">
                Booking #{params.bookingId.slice(-6).toUpperCase()}
              </Text>
            )}
          </View>
        </View>

        {/* Star Rating */}
        <View className="px-6 mb-6 items-center">
          <Text style={{ color: "#D1FAE5", fontSize: 14, fontWeight: "600", marginBottom: 12 }}>
            How was your delivery experience?
          </Text>
          <View className="flex-row gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={star <= rating ? "star" : "star-border"}
                  size={48}
                  color={star <= rating ? "#FBBF24" : "#4B5563"}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text
            style={{
              color: rating > 0 ? "#FBBF24" : "#9BA1A6",
              fontSize: 14,
              fontWeight: "600",
              marginTop: 8,
            }}
          >
            {getRatingLabel(rating)}
          </Text>
        </View>

        {/* Review Input */}
        <View className="px-6 mb-6">
          <Text style={{ color: "#D1FAE5", fontSize: 12, fontWeight: "600", marginBottom: 6 }}>
            Write a Review (Optional)
          </Text>
          <TextInput
            style={styles.reviewInput}
            value={review}
            onChangeText={setReview}
            placeholder="Share your experience with this driver..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text className="text-muted text-xs text-right mt-1">{review.length}/500</Text>
        </View>

        {/* Quick Tags */}
        <View className="px-6 mb-6">
          <Text style={{ color: "#D1FAE5", fontSize: 12, fontWeight: "600", marginBottom: 8 }}>
            Quick Feedback
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {[
              "On time",
              "Professional",
              "Careful handling",
              "Friendly",
              "Good communication",
              "Fast delivery",
              "Clean vehicle",
              "Safe driving",
            ].map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => {
                  const newReview = review ? `${review}, ${tag}` : tag;
                  setReview(newReview);
                }}
                style={styles.tagBtn}
              >
                <Text style={{ color: "#D1FAE5", fontSize: 11, fontWeight: "500" }}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Submit */}
        <View className="px-6">
          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={submitting}
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          >
            <MaterialIcons name="send" size={18} color="#166534" />
            <Text style={{ color: "#166534", fontWeight: "700", fontSize: 15, marginLeft: 6 }}>
              {submitting ? "Submitting..." : "Submit Rating"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  driverCard: {
    alignItems: "center",
    backgroundColor: "rgba(34,197,94,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
    borderRadius: _rs.s(20),
    padding: _rs.sp(24),
  },
  driverAvatar: {
    width: _rs.s(64),
    height: _rs.s(64),
    borderRadius: _rs.s(32),
    backgroundColor: "rgba(34,197,94,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: _rs.s(14),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(12),
    color: "#fff",
    fontSize: _rs.fs(14),
    minHeight: 100,
  },
  tagBtn: {
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
    borderRadius: _rs.s(16),
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
    borderRadius: _rs.s(14),
    paddingVertical: _rs.sp(16),
  },
  doneBtn: {
    backgroundColor: "#22C55E",
    borderRadius: _rs.s(14),
    paddingVertical: _rs.sp(14),
    paddingHorizontal: _rs.sp(48),
  },
  successIcon: {
    width: _rs.s(96),
    height: _rs.s(96),
    borderRadius: _rs.s(48),
    backgroundColor: "rgba(34,197,94,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
});
