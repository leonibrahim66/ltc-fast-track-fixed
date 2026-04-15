import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Share,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { captureRef } from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { COLLECTOR_AFFILIATION_FEES } from "@/constants/app";

export default function CollectorBadgeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const badgeRef = useRef<View>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Check if collector has paid affiliation fee
  const hasPaidFee = user?.affiliationFeePaid;
  const collectorType = user?.collectorType || "foot";
  const vehicleType = user?.vehicleType;

  // Generate badge ID
  const badgeId = user?.id 
    ? `LTC-${user.id.slice(-6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`
    : "LTC-000000";

  // Get fee info
  const feeInfo = collectorType === "foot" 
    ? COLLECTOR_AFFILIATION_FEES.foot_collector
    : COLLECTOR_AFFILIATION_FEES[vehicleType as keyof typeof COLLECTOR_AFFILIATION_FEES] || COLLECTOR_AFFILIATION_FEES.foot_collector;

  const getCollectorTypeLabel = () => {
    if (collectorType === "foot") return "Foot Collector";
    switch (vehicleType) {
      case "heavy_truck": return "Heavy Truck Operator";
      case "light_truck": return "Light Truck Operator";
      case "small_carrier": return "Small Carrier Operator";
      default: return "Collector";
    }
  };

  // Generate QR code data (simplified representation)
  const qrData = JSON.stringify({
        id: badgeId,
        name: user?.fullName,
    type: collectorType,
    verified: hasPaidFee,
    issued: new Date().toISOString().split("T")[0],
  });

  const handleSaveBadge = async () => {
    if (!badgeRef.current) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setIsSaving(true);

    try {
      // Request permissions
      if (Platform.OS !== "web") {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Please allow access to save the badge.");
          setIsSaving(false);
          return;
        }
      }

      // Capture the badge as image
      const uri = await captureRef(badgeRef, {
        format: "png",
        quality: 1,
      });

      if (Platform.OS !== "web") {
        // Save to gallery
        await MediaLibrary.saveToLibraryAsync(uri);
        Alert.alert("Success", "Badge saved to your gallery!");
      } else {
        // Web: trigger download
        const link = document.createElement("a");
        link.href = uri;
        link.download = `LTC-Badge-${badgeId}.png`;
        link.click();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save badge. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareBadge = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      await Share.share({
        message: `I am a verified LTC FAST TRACK collector!\n\nBadge ID: ${badgeId}\nName: ${user?.fullName}\nType: ${getCollectorTypeLabel()}\n\nVerify at: ltcfasttrack.com/verify/${badgeId}`,
        title: "My LTC Collector Badge",
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  if (!hasPaidFee) {
    return (
      <ScreenContainer className="px-4">
        {/* Header */}
        <View className="flex-row items-center mb-6 mt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 -ml-2"
          >
            <Text className="text-2xl">←</Text>
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Collector Badge</Text>
            <Text className="text-muted">Your digital ID card</Text>
          </View>
        </View>

        {/* Not Verified Message */}
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-6xl mb-4">🔒</Text>
          <Text className="text-xl font-bold text-foreground mb-2 text-center">
            Badge Not Available
          </Text>
          <Text className="text-muted text-center mb-6">
            You need to pay your affiliation fee to receive your official collector badge.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/affiliation-fee" as any)}
            className="bg-primary px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">Pay Affiliation Fee</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="flex-row items-center mb-6 mt-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-4 p-2 -ml-2"
        >
          <Text className="text-2xl">←</Text>
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-bold text-foreground">Collector Badge</Text>
          <Text className="text-muted">Your official ID card</Text>
        </View>
      </View>

      {/* Badge Card */}
      <View className="items-center mb-6">
        <View
          ref={badgeRef}
          collapsable={false}
          className="bg-white rounded-2xl overflow-hidden shadow-lg"
          style={{ width: 320, padding: 0 }}
        >
          {/* Badge Header */}
          <View className="bg-primary px-4 py-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-white text-lg font-bold">LTC FAST TRACK</Text>
                <Text className="text-white/80 text-xs">Official Collector ID</Text>
              </View>
              <View className="bg-white/20 px-2 py-1 rounded">
                <Text className="text-white text-xs font-bold">✓ VERIFIED</Text>
              </View>
            </View>
          </View>

          {/* Badge Body */}
          <View className="p-4">
            {/* Photo and Info Row */}
            <View className="flex-row mb-4">
              {/* Photo */}
              <View className="w-24 h-24 rounded-lg bg-gray-200 overflow-hidden mr-4">
                {user?.profilePicture ? (
                  <Image
                    source={{ uri: user.profilePicture }}
                    style={{ width: 96, height: 96 }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="w-full h-full items-center justify-center bg-gray-300">
                    <Text className="text-4xl">👤</Text>
                  </View>
                )}
              </View>

              {/* Info */}
              <View className="flex-1 justify-center">
                <Text className="text-gray-900 font-bold text-lg" numberOfLines={1}>
                  {user?.fullName || "Collector Name"}
                </Text>
                <Text className="text-gray-600 text-sm mb-1">
                  {getCollectorTypeLabel()}
                </Text>
                <View className="bg-green-100 px-2 py-1 rounded self-start">
                  <Text className="text-green-700 text-xs font-medium">
                    Active Collector
                  </Text>
                </View>
              </View>
            </View>

            {/* Details Grid */}
            <View className="bg-gray-50 rounded-lg p-3 mb-4">
              <View className="flex-row mb-2">
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Badge ID</Text>
                  <Text className="text-gray-900 font-mono font-bold">{badgeId}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Phone</Text>
                  <Text className="text-gray-900 font-medium">{user?.phone || "N/A"}</Text>
                </View>
              </View>
              <View className="flex-row">
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">NRC/ID</Text>
                  <Text className="text-gray-900 font-medium">{user?.idNumber || "N/A"}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Issued</Text>
                  <Text className="text-gray-900 font-medium">
                    {new Date().toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              </View>
            </View>

            {/* QR Code Placeholder */}
            <View className="items-center">
              <View className="bg-gray-100 p-3 rounded-lg">
                <View className="w-20 h-20 bg-white items-center justify-center rounded">
                  {/* Simple QR representation */}
                  <View className="flex-row flex-wrap" style={{ width: 64, height: 64 }}>
                    {Array.from({ length: 64 }).map((_, i) => (
                      <View
                        key={i}
                        style={{
                          width: 8,
                          height: 8,
                          // Deterministic QR-like pattern based on position
                          backgroundColor: ((i % 7) + Math.floor(i / 7)) % 2 === 0 ? "#000" : "#fff",
                        }}
                      />
                    ))}
                  </View>
                </View>
              </View>
              <Text className="text-gray-500 text-xs mt-2">Scan to verify</Text>
            </View>
          </View>

          {/* Badge Footer */}
          <View className="bg-gray-100 px-4 py-2">
            <Text className="text-gray-500 text-xs text-center">
              This badge certifies the holder as an authorized LTC FAST TRACK collector
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-3 mb-6">
        <TouchableOpacity
          onPress={handleSaveBadge}
          disabled={isSaving}
          className={`flex-1 py-4 rounded-xl flex-row items-center justify-center ${
            isSaving ? "bg-primary/50" : "bg-primary"
          }`}
        >
          <Text className="text-2xl mr-2">💾</Text>
          <Text className="text-white font-semibold">
            {isSaving ? "Saving..." : "Save to Gallery"}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleShareBadge}
        className="bg-surface border border-border py-4 rounded-xl flex-row items-center justify-center mb-6"
      >
        <Text className="text-2xl mr-2">📤</Text>
        <Text className="text-foreground font-semibold">Share Badge</Text>
      </TouchableOpacity>

      {/* Info */}
      <View className="bg-primary/10 rounded-xl p-4">
        <Text className="text-primary font-semibold mb-2">About Your Badge</Text>
        <Text className="text-muted text-sm leading-5">
          This digital ID badge verifies you as an official LTC FAST TRACK collector. 
          Show this badge to customers when making pickups. The QR code can be scanned 
          to verify your status in real-time.
        </Text>
      </View>
    </ScreenContainer>
  );
}
