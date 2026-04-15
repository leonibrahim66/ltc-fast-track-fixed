import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { COLLECTOR_AFFILIATION_FEES, PAYMENT } from "@/constants/app";

type CollectorTypeKey = keyof typeof COLLECTOR_AFFILIATION_FEES;
type PaymentMethod = "mtn" | "airtel" | "bank";

export default function AffiliationFeeScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  
  const [selectedType, setSelectedType] = useState<CollectorTypeKey | null>(
    user?.collectorType === "foot" ? "foot_collector" : 
    user?.vehicleType === "heavy_truck" ? "heavy_truck" :
    user?.vehicleType === "light_truck" ? "light_truck" :
    user?.vehicleType === "small_carrier" ? "small_carrier" : null
  );
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const collectorTypes = Object.values(COLLECTOR_AFFILIATION_FEES);

  const handleSelectType = (typeId: CollectorTypeKey) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedType(typeId);
  };

  const handleSelectPayment = (method: PaymentMethod) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedPayment(method);
  };

  const handlePayFee = () => {
    if (!selectedType) {
      Alert.alert("Error", "Please select your collector type.");
      return;
    }

    if (!selectedPayment) {
      Alert.alert("Error", "Please select a payment method.");
      return;
    }

    const feeInfo = COLLECTOR_AFFILIATION_FEES[selectedType];
    const paymentInfo = PAYMENT.mobileMoneyProviders.find(p => p.id === selectedPayment);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (selectedPayment === "bank") {
      Alert.alert(
        "Bank Transfer Details",
        `Please transfer K${feeInfo.fee} to:\n\nBank: Indo Zambian Bank\nAccount: ${PAYMENT.merchantCode}\nReference: AFF-${user?.id?.slice(0, 8) || "NEW"}\n\nOnce payment is confirmed, your account will be activated within 24 hours.`,
        [
          { text: "OK", onPress: () => router.push("/payment-confirmation" as any) },
        ]
      );
    } else {
      Alert.alert(
        "Mobile Money Payment",
        `Please send K${feeInfo.fee} to:\n\n${paymentInfo?.name}: ${paymentInfo?.receiverNumber}\nReference: AFF-${user?.id?.slice(0, 8) || "NEW"}\n\nAfter sending, tap "I've Paid" to submit your payment for verification.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "I've Paid",
            onPress: () => handleConfirmPayment(feeInfo.fee),
          },
        ]
      );
    }
  };

  const handleConfirmPayment = async (amount: number) => {
    setIsProcessing(true);

    try {
      await updateUser({
        affiliationFeePaid: true,
        affiliationFeeType: selectedType || undefined,
        affiliationFeePaidAt: new Date().toISOString(),
      });

      setIsProcessing(false);

      Alert.alert(
        "Payment Submitted",
        "Your affiliation fee payment has been submitted for verification. You will be notified once approved.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (_error) {
      setIsProcessing(false);
      Alert.alert("Error", "Failed to record payment. Please try again.");
    }
  };

  // If already paid, show confirmation
  if (user?.affiliationFeePaid) {
    const paidType = user.affiliationFeeType as CollectorTypeKey;
    const feeInfo = paidType ? COLLECTOR_AFFILIATION_FEES[paidType] : null;

    return (
      <ScreenContainer className="px-4">
        <View className="flex-row items-center mb-6 mt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 -ml-2"
          >
            <Text className="text-2xl">←</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">Affiliation Status</Text>
        </View>

        <View className="bg-success/10 rounded-2xl p-6 items-center">
          <Text className="text-5xl mb-4">✅</Text>
          <Text className="text-xl font-bold text-success mb-2">Fee Paid</Text>
          <Text className="text-muted text-center mb-4">
            Your affiliation fee has been paid and verified.
          </Text>
          {feeInfo && (
            <View className="bg-surface rounded-xl p-4 w-full">
              <View className="flex-row justify-between mb-2">
                <Text className="text-muted">Collector Type</Text>
                <Text className="text-foreground font-medium">
                  {feeInfo.icon} {feeInfo.name}
                </Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-muted">Amount Paid</Text>
                <Text className="text-foreground font-medium">K{feeInfo.fee}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-muted">Paid On</Text>
                <Text className="text-foreground font-medium">
                  {user.affiliationFeePaidAt
                    ? new Date(user.affiliationFeePaidAt).toLocaleDateString()
                    : "N/A"}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center mb-6 mt-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 p-2 -ml-2"
          >
            <Text className="text-2xl">←</Text>
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Affiliation Fee</Text>
            <Text className="text-muted">One-time registration fee</Text>
          </View>
        </View>

        {/* Info Banner */}
        <View className="bg-primary/10 rounded-xl p-4 mb-6">
          <Text className="text-primary font-semibold mb-2">ℹ️ Why Affiliation Fee?</Text>
          <Text className="text-muted text-sm leading-5">
            The one-time affiliation fee covers your registration, ID badge, training materials, 
            and access to the LTC FAST TRACK collector network. This is a one-time payment 
            that activates your collector account permanently.
          </Text>
        </View>

        {/* Collector Type Selection */}
        <Text className="text-lg font-semibold text-foreground mb-3">
          Select Your Collector Type
        </Text>
        
        {collectorTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            onPress={() => handleSelectType(type.id as CollectorTypeKey)}
            className={`flex-row items-center p-4 rounded-xl mb-3 border ${
              selectedType === type.id
                ? "bg-primary/10 border-primary"
                : "bg-surface border-border"
            }`}
          >
            <Text className="text-3xl mr-4">{type.icon}</Text>
            <View className="flex-1">
              <Text className="text-foreground font-semibold">{type.name}</Text>
              <Text className="text-muted text-sm">{type.description}</Text>
            </View>
            <View className="items-end">
              <Text className="text-primary font-bold text-lg">K{type.fee}</Text>
              <Text className="text-muted text-xs">one-time</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Payment Method Selection */}
        {selectedType && (
          <View className="mt-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Select Payment Method
            </Text>

            <TouchableOpacity
              onPress={() => handleSelectPayment("mtn")}
              className={`flex-row items-center p-4 rounded-xl mb-3 border ${
                selectedPayment === "mtn"
                  ? "bg-yellow-50 border-yellow-400"
                  : "bg-surface border-border"
              }`}
            >
              <Text className="text-2xl mr-3">📱</Text>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">MTN Mobile Money</Text>
                <Text className="text-muted text-sm">
                  Send to: {PAYMENT.mobileMoneyProviders[0].receiverNumber}
                </Text>
              </View>
              {selectedPayment === "mtn" && (
                <Text className="text-yellow-600 font-bold">✓</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSelectPayment("airtel")}
              className={`flex-row items-center p-4 rounded-xl mb-3 border ${
                selectedPayment === "airtel"
                  ? "bg-red-50 border-red-400"
                  : "bg-surface border-border"
              }`}
            >
              <Text className="text-2xl mr-3">📲</Text>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">Airtel Money</Text>
                <Text className="text-muted text-sm">
                  Send to: {PAYMENT.mobileMoneyProviders[1].receiverNumber}
                </Text>
              </View>
              {selectedPayment === "airtel" && (
                <Text className="text-red-600 font-bold">✓</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSelectPayment("bank")}
              className={`flex-row items-center p-4 rounded-xl mb-3 border ${
                selectedPayment === "bank"
                  ? "bg-blue-50 border-blue-400"
                  : "bg-surface border-border"
              }`}
            >
              <Text className="text-2xl mr-3">🏦</Text>
              <View className="flex-1">
                <Text className="text-foreground font-semibold">Bank Transfer</Text>
                <Text className="text-muted text-sm">Indo Zambian Bank</Text>
              </View>
              {selectedPayment === "bank" && (
                <Text className="text-blue-600 font-bold">✓</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Summary and Pay Button */}
        {selectedType && selectedPayment && (
          <View className="mt-6 mb-8">
            <View className="bg-surface rounded-xl p-4 mb-4">
              <Text className="text-muted mb-2">Payment Summary</Text>
              <View className="flex-row justify-between items-center">
                <Text className="text-foreground">
                  {COLLECTOR_AFFILIATION_FEES[selectedType].name} Affiliation
                </Text>
                <Text className="text-foreground font-bold text-xl">
                  K{COLLECTOR_AFFILIATION_FEES[selectedType].fee}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handlePayFee}
              disabled={isProcessing}
              className={`py-4 rounded-xl ${
                isProcessing ? "bg-muted" : "bg-primary"
              }`}
            >
              <Text className="text-white text-center font-semibold text-lg">
                {isProcessing ? "Processing..." : `Pay K${COLLECTOR_AFFILIATION_FEES[selectedType].fee}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Benefits Section */}
        <View className="bg-surface rounded-xl p-4 mb-8">
          <Text className="text-foreground font-semibold mb-3">✨ What You Get</Text>
          <View className="gap-2">
            <Text className="text-muted">• Official LTC FAST TRACK collector ID badge</Text>
            <Text className="text-muted">• Access to pickup notifications in your area</Text>
            <Text className="text-muted">• Training materials and guidelines</Text>
            <Text className="text-muted">• Earnings tracking and withdrawal access</Text>
            <Text className="text-muted">• Customer support priority</Text>
            <Text className="text-muted">• Lifetime membership (no renewal fees)</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
