import { useState, useRef } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { captureRef } from "react-native-view-shot";
import { ScreenContainer } from "@/components/screen-container";
import { usePayments } from "@/lib/payments-context";
import { APP_CONFIG, CONTACTS } from "@/constants/app";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function PaymentReceiptScreen() {
  const router = useRouter();
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const { getPaymentById } = usePayments();
  const receiptRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const payment = getPaymentById(paymentId || "");

  if (!payment) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <MaterialIcons name="receipt" size={64} color="#9CA3AF" />
        <Text className="text-xl font-semibold text-foreground mt-4 mb-2">
          Receipt Not Found
        </Text>
        <Text className="text-muted text-center mb-6">
          The payment receipt you&apos;re looking for doesn&apos;t exist.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-full"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = () => {
    switch (payment.status) {
      case "confirmed": return "#22C55E";
      case "pending": return "#F59E0B";
      case "failed": return "#EF4444";
      default: return "#6B7280";
    }
  };

  const handleShare = async () => {
    if (!receiptRef.current) return;

    setIsSharing(true);
    try {
      // Capture the receipt as an image
      const uri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device.");
        return;
      }

      // Share the image
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: `LTC Payment Receipt - ${payment.reference}`,
      });
    } catch (error) {
      console.error("Error sharing receipt:", error);
      Alert.alert("Error", "Failed to share receipt. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async () => {
    if (!receiptRef.current) return;

    setIsSharing(true);
    try {
      // Capture the receipt as an image
      const uri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
      });

      if (Platform.OS === "web") {
        // For web, trigger download
        const link = document.createElement("a");
        link.href = uri;
        link.download = `LTC-Receipt-${payment.reference}.png`;
        link.click();
        Alert.alert("Success", "Receipt downloaded successfully.");
      } else {
        // For mobile, save to downloads
        const fileName = `LTC-Receipt-${payment.reference}.png`;
        const downloadPath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: downloadPath });
        Alert.alert("Success", `Receipt saved to ${fileName}`);
      }
    } catch (error) {
      console.error("Error downloading receipt:", error);
      Alert.alert("Error", "Failed to download receipt. Please try again.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-foreground">
              Payment Receipt
            </Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        {/* Receipt Card */}
        <View className="px-6">
          <View
            ref={receiptRef}
            collapsable={false}
            className="bg-white rounded-2xl overflow-hidden"
            style={styles.receiptCard}
          >
            {/* Header */}
            <View className="bg-primary p-6 items-center">
              <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center mb-3">
                <MaterialIcons 
                  name={payment.status === "confirmed" ? "check-circle" : "schedule"} 
                  size={36} 
                  color="#fff" 
                />
              </View>
              <Text className="text-white text-2xl font-bold mb-1">
                {APP_CONFIG.currencySymbol}{payment.amount.toLocaleString()}
              </Text>
              <Text className="text-white/80">
                {payment.status === "confirmed" ? "Payment Confirmed" : "Payment Pending"}
              </Text>
            </View>

            {/* Details */}
            <View className="p-6">
              {/* Reference */}
              <View className="mb-4 pb-4 border-b border-gray-100">
                <Text className="text-gray-500 text-sm mb-1">Reference Number</Text>
                <Text className="text-gray-900 font-mono text-lg font-semibold">
                  {payment.reference}
                </Text>
              </View>

              {/* Transaction ID */}
              {payment.transactionId && (
                <View className="mb-4 pb-4 border-b border-gray-100">
                  <Text className="text-gray-500 text-sm mb-1">Transaction ID</Text>
                  <Text className="text-gray-900 font-mono">
                    {payment.transactionId}
                  </Text>
                </View>
              )}

              {/* Payment Method */}
              <View className="mb-4 pb-4 border-b border-gray-100">
                <Text className="text-gray-500 text-sm mb-1">Payment Method</Text>
                <Text className="text-gray-900">{payment.methodName}</Text>
              </View>

              {/* Description */}
              <View className="mb-4 pb-4 border-b border-gray-100">
                <Text className="text-gray-500 text-sm mb-1">Description</Text>
                <Text className="text-gray-900">{payment.description}</Text>
              </View>

              {/* Date */}
              <View className="mb-4 pb-4 border-b border-gray-100">
                <Text className="text-gray-500 text-sm mb-1">Date & Time</Text>
                <Text className="text-gray-900">{formatDate(payment.createdAt)}</Text>
              </View>

              {/* Status */}
              <View className="mb-4">
                <Text className="text-gray-500 text-sm mb-1">Status</Text>
                <View className="flex-row items-center">
                  <View
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: getStatusColor() }}
                  />
                  <Text 
                    className="font-semibold capitalize"
                    style={{ color: getStatusColor() }}
                  >
                    {payment.status}
                  </Text>
                </View>
              </View>

              {/* Confirmed Date */}
              {payment.confirmedAt && (
                <View className="mb-4">
                  <Text className="text-gray-500 text-sm mb-1">Confirmed On</Text>
                  <Text className="text-gray-900">{formatDate(payment.confirmedAt)}</Text>
                </View>
              )}

              {/* Footer */}
              <View className="mt-4 pt-4 border-t border-gray-100 items-center">
                <Text className="text-gray-900 font-bold text-lg mb-1">
                  {APP_CONFIG.name}
                </Text>
                <Text className="text-gray-500 text-sm">{APP_CONFIG.tagline}</Text>
                <Text className="text-gray-400 text-xs mt-2">
                  {CONTACTS.supportPhone} | {CONTACTS.emails[0]}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="px-6 mt-6 mb-6">
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleDownload}
              disabled={isSharing}
              className="flex-1 bg-surface border border-border py-4 rounded-xl flex-row items-center justify-center"
            >
              {isSharing ? (
                <ActivityIndicator color="#22C55E" />
              ) : (
                <>
                  <MaterialIcons name="download" size={20} color="#22C55E" />
                  <Text className="text-primary font-semibold ml-2">Download</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShare}
              disabled={isSharing}
              className="flex-1 bg-primary py-4 rounded-xl flex-row items-center justify-center"
            >
              {isSharing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="share" size={20} color="#fff" />
                  <Text className="text-white font-semibold ml-2">Share</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Help Text */}
          <Text className="text-muted text-center text-sm mt-4">
            Save or share this receipt for your records
          </Text>
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
  receiptCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: _rs.s(4) },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
});
