import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import { formatPhoneNumber, isValidAmount } from "@/lib/validation";
import { apiPost } from "@/lib/api-client";
import { getOrCreateBackendUserId } from "@/lib/user-session";

const MIN_DEPOSIT = 10;
const MAX_DEPOSIT = 50000;

export default function DepositScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { refreshWallet } = useWallet();

  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || "");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDeposit = async () => {
    // Validation
    if (!isValidAmount(amount)) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    const depositAmount = parseFloat(amount);
    if (depositAmount < MIN_DEPOSIT) {
      Alert.alert("Error", `Minimum deposit is K${MIN_DEPOSIT}`);
      return;
    }

    if (depositAmount > MAX_DEPOSIT) {
      Alert.alert("Error", `Maximum deposit is K${MAX_DEPOSIT}`);
      return;
    }

    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      Alert.alert("Invalid Phone Number", "Please enter a valid Zambian phone number");
      return;
    }

    if (!user?.id) {
      Alert.alert("Error", "User not found. Please log in again.");
      return;
    }

    setIsProcessing(true);

    try {
      // Ensure we have a stable backend userId (persisted in AsyncStorage)
      const backendUserId = await getOrCreateBackendUserId(user.phone, {
        country: (user as any).country,
        province: user.province,
        city: user.city,
      });

      const result = await apiPost<{ data: { depositId: string } }>(
        "/api/payments/pawapay",
        {
          amount: depositAmount,
          phoneNumber: formattedPhone,
          userId: backendUserId,
          country: (user as any).country ?? "ZMB",
        }
      );

      // Show success message with deposit ID (apiPost throws on non-2xx)
      Alert.alert(
        "Deposit Request Submitted",
        `Deposit ID: ${result.data.depositId}\n\nYou will receive a prompt on your phone to complete the payment. Please check your phone for the payment request.`,
        [
          {
            text: "OK",
            onPress: async () => {
              // Refresh wallet using the stable backend userId
              await refreshWallet(backendUserId);
              router.push("/(tabs)/wallet" as any);
            },
          },
        ]
      );

      // Haptic feedback
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: any) {
      Alert.alert("Deposit Failed", error.message || "Failed to process deposit");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsProcessing(false);
    }
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
          <View>
            <Text className="text-2xl font-bold text-foreground">Add Funds</Text>
            <Text className="text-muted text-sm mt-1">
              Deposit money to your wallet
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View className="px-6 mb-6">
          <View className="bg-primary/10 border border-primary rounded-xl p-4 flex-row items-start">
            <MaterialIcons name="info" size={20} color="#0a7ea4" />
            <View className="flex-1 ml-3">
              <Text className="text-foreground font-semibold mb-1">How It Works</Text>
              <Text className="text-muted text-xs leading-5">
                Enter the amount you want to deposit. You'll receive a payment prompt on your phone to complete the transaction.
              </Text>
            </View>
          </View>
        </View>

        {/* Deposit Form */}
        <View className="px-6">
          {/* Amount Input */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-2">Amount (K)</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
              <Text className="text-muted mr-2">K</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
                className="flex-1 text-foreground text-base"
                editable={!isProcessing}
              />
            </View>
            <Text className="text-muted text-xs mt-2">
              Min: K{MIN_DEPOSIT} • Max: K{MAX_DEPOSIT}
            </Text>
          </View>

          {/* Phone Number Input */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-2">Phone Number</Text>
            <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
              <Text className="text-muted mr-2">+260</Text>
              <TextInput
                value={phoneNumber.replace(/^260/, "")}
                onChangeText={(val) => setPhoneNumber(val)}
                placeholder="971234567"
                keyboardType="phone-pad"
                maxLength={9}
                className="flex-1 text-foreground text-base"
                editable={!isProcessing}
              />
            </View>
            <Text className="text-muted text-xs mt-2">
              Payment will be sent to this number
            </Text>
          </View>

          {/* Security Notice */}
          <View className="bg-warning/10 border border-warning rounded-xl p-4 mb-6">
            <View className="flex-row items-start">
              <MaterialIcons name="shield" size={20} color="#F59E0B" />
              <View className="flex-1 ml-3">
                <Text className="text-foreground font-semibold mb-1">Secure Payment</Text>
                <Text className="text-muted text-xs leading-5">
                  Your payment is processed securely through PawaPay. You will receive a confirmation on your phone.
                </Text>
              </View>
            </View>
          </View>

          {/* Deposit Button */}
          <TouchableOpacity
            onPress={handleDeposit}
            disabled={isProcessing}
            className={`rounded-xl py-4 items-center ${
              isProcessing ? "bg-primary/50" : "bg-primary"
            }`}
          >
            <Text className="text-white font-bold text-base">
              {isProcessing ? "Processing..." : "Continue to Payment"}
            </Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            disabled={isProcessing}
            className="mt-4 rounded-xl py-4 items-center border border-primary"
          >
            <Text className="text-primary font-bold text-base">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
