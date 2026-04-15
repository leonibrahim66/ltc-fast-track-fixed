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
import { formatPhoneNumber, isValidAmount, isValidPIN } from "@/lib/validation";
import { apiPost } from "@/lib/api-client";
import { getOrCreateBackendUserId } from "@/lib/user-session";

const MIN_WITHDRAWAL = 50;
const MAX_WITHDRAWAL = 10000;

export default function WithdrawScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { wallet, refreshWallet } = useWallet();

  const [amount, setAmount] = useState("");
  const [withdrawalPin, setWithdrawalPin] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const availableBalance = wallet?.totalBalance || 0;
  const linkedPhone = wallet?.linkedAccount?.phoneNumber || "";
  const hasLinkedAccount = !!wallet?.linkedAccount;

  const handleWithdraw = async () => {
    // Validation
    if (!hasLinkedAccount) {
      Alert.alert(
        "Link Account Required",
        "Please link your mobile money account first to withdraw funds.",
        [
          {
            text: "Link Account",
            onPress: () => router.push("/link-account" as any),
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    if (!isValidAmount(amount)) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount < MIN_WITHDRAWAL) {
      Alert.alert("Error", `Minimum withdrawal is K${MIN_WITHDRAWAL}`);
      return;
    }

    if (withdrawAmount > MAX_WITHDRAWAL) {
      Alert.alert("Error", `Maximum withdrawal is K${MAX_WITHDRAWAL}`);
      return;
    }

    if (withdrawAmount > availableBalance) {
      Alert.alert("Insufficient Balance", "You don't have enough balance to withdraw");
      return;
    }

    if (!isValidPIN(withdrawalPin)) {
      Alert.alert("Invalid PIN", "Please enter your 4-digit withdrawal PIN");
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

      const result = await apiPost<{ data: { payoutId: string } }>(
        "/api/withdrawals",
        {
          userId: backendUserId,
          amount: withdrawAmount,
          phoneNumber: linkedPhone,
          provider: wallet?.linkedAccount?.provider,
          country: (user as any).country ?? "ZMB",
          withdrawalPin,
        }
      );

      // Show success message
      Alert.alert(
        "Withdrawal Successful",
        `K${withdrawAmount.toFixed(2)} has been sent to ${linkedPhone}. It will arrive within 24-48 hours.`,
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
      Alert.alert("Withdrawal Failed", error.message || "Failed to process withdrawal");
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
            <Text className="text-2xl font-bold text-foreground">Withdraw Funds</Text>
            <Text className="text-muted text-sm mt-1">
              Transfer funds to your linked mobile money account
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Available Balance */}
        <View className="px-6 mb-6">
          <View className="bg-primary rounded-2xl p-6">
            <Text className="text-white text-sm opacity-80">Available Balance</Text>
            <Text className="text-white text-4xl font-bold mt-2">
              K{availableBalance.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Linked Account Info */}
        {hasLinkedAccount ? (
          <View className="px-6 mb-6">
            <View className="bg-success/10 border border-success rounded-xl p-4 flex-row items-center">
              <MaterialIcons name="check-circle" size={24} color="#22C55E" />
              <View className="ml-3 flex-1">
                <Text className="text-foreground font-semibold">Account Linked</Text>
                <Text className="text-muted text-sm mt-1">{linkedPhone}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="px-6 mb-6">
            <View className="bg-warning/10 border border-warning rounded-xl p-4 flex-row items-center">
              <MaterialIcons name="warning" size={24} color="#F59E0B" />
              <View className="ml-3 flex-1">
                <Text className="text-foreground font-semibold">No Linked Account</Text>
                <Text className="text-muted text-sm mt-1">Link your phone number first</Text>
              </View>
            </View>
          </View>
        )}

        {/* Withdrawal Form */}
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
              Min: K{MIN_WITHDRAWAL} • Max: K{MAX_WITHDRAWAL}
            </Text>
          </View>

          {/* Withdrawal PIN */}
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-2">Withdrawal PIN</Text>
            <TextInput
              value={withdrawalPin}
              onChangeText={setWithdrawalPin}
              placeholder="Enter 4-digit PIN"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
              editable={!isProcessing}
            />
            <Text className="text-muted text-xs mt-2">
              Required to authorize withdrawals
            </Text>
          </View>

          {/* Security Notice */}
          <View className="bg-warning/10 border border-warning rounded-xl p-4 mb-6">
            <View className="flex-row items-start">
              <MaterialIcons name="info" size={20} color="#F59E0B" />
              <View className="flex-1 ml-3">
                <Text className="text-foreground font-semibold mb-1">Security Notice</Text>
                <Text className="text-muted text-xs leading-5">
                  • Funds will be sent to your linked phone number{"\n"}
                  • Processing time: 24-48 hours{"\n"}
                  • You cannot cancel once submitted
                </Text>
              </View>
            </View>
          </View>

          {/* Withdraw Button */}
          <TouchableOpacity
            onPress={handleWithdraw}
            disabled={isProcessing || !hasLinkedAccount}
            className={`rounded-xl py-4 items-center ${
              isProcessing || !hasLinkedAccount ? "bg-primary/50" : "bg-primary"
            }`}
          >
            <Text className="text-white font-bold text-base">
              {isProcessing ? "Processing..." : "Withdraw Now"}
            </Text>
          </TouchableOpacity>

          {/* Link Account Button */}
          {!hasLinkedAccount && (
            <TouchableOpacity
              onPress={() => router.push("/link-account" as any)}
              className="mt-4 rounded-xl py-4 items-center border border-primary"
            >
              <Text className="text-primary font-bold text-base">Link Account First</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
