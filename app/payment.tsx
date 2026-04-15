import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  ActivityIndicator,
  Switch,
  TextInput,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { APP_CONFIG, PAYMENT, CONTACTS } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
type PaymentMethod = "mobile_money" | "bank";

/** Production receiver numbers — never modified */
const PRODUCTION_NUMBERS: Record<string, string> = {
  mtn: "+260960819993",
  airtel: "20158560",
  zamtel: "",
};

export default function PaymentScreen() {
  const router = useRouter();
  const { planId, planName, price } = useLocalSearchParams<{
    planId: string;
    planName: string;
    price: string;
  }>();
  const { user: _user } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);



  // Price parsing available if needed
  const _priceNum = parseInt(price || "0", 10);

  /**
   * Returns the production receiver number for the selected provider.
   * Always uses live production mode.
   */
  const getEffectiveReceiverNumber = (providerId: string): string => {
    return PRODUCTION_NUMBERS[providerId] ?? "";
  };

  const getSelectedProviderName = () => {
    if (paymentMethod === "mobile_money") {
      const provider = PAYMENT.mobileMoneyProviders.find(p => p.id === selectedProvider);
      return provider?.name || "Mobile Money";
    }
    const bank = PAYMENT.banks.find(b => b.id === selectedProvider);
    return bank?.name || "Bank Transfer";
  };

  const handleConfirmPayment = async () => {
    if (!selectedProvider) {
      Alert.alert("Error", "Please select a payment provider");
      return;
    }



    setIsProcessing(true);
    // Navigate to confirmation screen
    router.push({
      pathname: "/payment-confirmation" as any,
      params: {
        amount: price,
        method: selectedProvider,
        methodName: getSelectedProviderName(),
        description: `${planName} Plan Subscription`,
        planId: planId,
        planName: planName,
        // Always use live production mode
        sandboxMode: "0",
      },
    });
    setIsProcessing(false);
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
            Payment
          </Text>
          <Text className="text-base text-muted mb-6">
            Complete your subscription payment
          </Text>



          {/* Order Summary */}
          <View className="bg-surface rounded-xl p-5 mb-6 border border-border">
            <Text className="text-sm font-medium text-muted mb-3">
              ORDER SUMMARY
            </Text>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground text-base">
                {planName} Plan (Monthly)
              </Text>
              <Text className="text-foreground font-semibold text-base">
                {APP_CONFIG.currencySymbol}{price}
              </Text>
            </View>
            <View className="border-t border-border mt-3 pt-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground font-semibold text-lg">
                  Total
                </Text>
                <Text className="text-primary font-bold text-xl">
                  {APP_CONFIG.currencySymbol}{price} {APP_CONFIG.currency}
                </Text>
              </View>
            </View>
          </View>

          {/* Payment Method Selection */}
          <Text className="text-sm font-medium text-muted mb-3">
            SELECT PAYMENT METHOD
          </Text>
          <View className="flex-row mb-6">
            <TouchableOpacity
              onPress={() => {
                setPaymentMethod("mobile_money");
                setSelectedProvider("");
              }}
              className={`flex-1 p-4 rounded-xl mr-2 border-2 ${
                paymentMethod === "mobile_money"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface"
              }`}
            >
              <MaterialIcons
                name="phone-android"
                size={24}
                color={paymentMethod === "mobile_money" ? "#22C55E" : "#6B7280"}
              />
              <Text
                className={`mt-2 font-medium ${
                  paymentMethod === "mobile_money" ? "text-primary" : "text-muted"
                }`}
              >
                Mobile Money
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setPaymentMethod("bank");
                setSelectedProvider("");
              }}
              className={`flex-1 p-4 rounded-xl ml-2 border-2 ${
                paymentMethod === "bank"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-surface"
              }`}
            >
              <MaterialIcons
                name="account-balance"
                size={24}
                color={paymentMethod === "bank" ? "#22C55E" : "#6B7280"}
              />
              <Text
                className={`mt-2 font-medium ${
                  paymentMethod === "bank" ? "text-primary" : "text-muted"
                }`}
              >
                Bank Transfer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Provider Selection */}
          <Text className="text-sm font-medium text-muted mb-3">
            {paymentMethod === "mobile_money"
              ? "SELECT MOBILE MONEY PROVIDER"
              : "SELECT BANK"}
          </Text>

          {paymentMethod === "mobile_money" ? (
            <View className="mb-6">
              {PAYMENT.mobileMoneyProviders.map((provider) => {
                const effectiveNumber = getEffectiveReceiverNumber(provider.id);
                return (
                  <TouchableOpacity
                    key={provider.id}
                    onPress={() => setSelectedProvider(provider.id)}
                    className={`p-4 rounded-xl mb-2 border-2 ${
                      selectedProvider === provider.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-surface"
                    }`}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: provider.color + "20" }}
                      >
                        <MaterialIcons
                          name="phone-android"
                          size={20}
                          color={provider.color}
                        />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-foreground font-medium">
                          {provider.name}
                        </Text>

                        {effectiveNumber ? (
                          <Text
                            className="text-sm mt-1"
                            style={{ color: "#22C55E" }}
                          >
                            Send to: {effectiveNumber}
                          </Text>
                        ) : null}
                      </View>
                      {selectedProvider === provider.id && (
                        <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="mb-6">
              {PAYMENT.banks.map((bank) => (
                <TouchableOpacity
                  key={bank.id}
                  onPress={() => setSelectedProvider(bank.id)}
                  className={`flex-row items-center p-4 rounded-xl mb-2 border-2 ${
                    selectedProvider === bank.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                    <MaterialIcons name="account-balance" size={20} color="#22C55E" />
                  </View>
                  <Text className="ml-3 text-foreground font-medium flex-1">
                    {bank.name}
                  </Text>
                  {selectedProvider === bank.id && (
                    <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Payment Instructions */}
          <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="info" size={18} color="#0a7ea4" />
              <Text className="text-primary font-semibold ml-2">
                Next Steps
              </Text>
            </View>
            <Text className="text-foreground text-sm leading-5">
              After tapping confirm, check your phone and enter your PIN to complete the payment.
            </Text>
          </View>

          {/* Contact for Help */}
          <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
            <Text className="text-sm text-muted mb-2">
              Need help with payment?
            </Text>
            <Text className="text-foreground font-medium">
              Call: {CONTACTS.paymentPhone}
            </Text>
          </View>

          <View className="flex-1" />

          {/* Confirm Button */}
          <TouchableOpacity
            onPress={handleConfirmPayment}
            disabled={isProcessing || !selectedProvider}
            className={`py-4 rounded-full mb-6 ${
              selectedProvider ? "bg-primary" : "bg-muted"
            }`}
            style={[styles.button, isProcessing && styles.buttonDisabled]}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center text-lg font-semibold">
                Confirm Payment - {APP_CONFIG.currencySymbol}{price}
              </Text>
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
  // ── Payment Mode Toggle ────────────────────────────────────────────────────
  modeCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: _rs.s(14),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: _rs.sp(14),
    marginBottom: _rs.sp(20),
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: _rs.sp(6),
  },
  modeLabel: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
    color: "#374151",
    marginLeft: _rs.sp(6),
    flex: 1,
  },
  modePills: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(4),
  },
  modePill: {
    fontSize: _rs.fs(11),
    fontWeight: "500",
    color: "#9CA3AF",
  },
  modePillActive: {
    color: "#22C55E",
    fontWeight: "700",
  },
  modePillSandboxActive: {
    color: "#F59E0B",
    fontWeight: "700",
  },
  modeSwitch: {
    marginHorizontal: _rs.sp(4),
  },
  sandboxNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    borderRadius: _rs.s(8),
    padding: _rs.sp(10),
    marginTop: _rs.sp(10),
    gap: _rs.sp(6),
  },
  sandboxNoticeText: {
    fontSize: _rs.fs(12),
    color: "#92400E",
    flex: 1,
    lineHeight: _rs.fs(17),
  },
  sandboxInputWrap: {
    marginTop: _rs.sp(12),
  },
  sandboxInputLabel: {
    fontSize: _rs.fs(12),
    fontWeight: "600",
    color: "#374151",
    marginBottom: _rs.sp(6),
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sandboxInput: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    borderRadius: _rs.s(10),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(12),
    fontSize: _rs.fs(15),
    color: "#111827",
  },
  sandboxInputHint: {
    fontSize: _rs.fs(11),
    color: "#6B7280",
    marginTop: _rs.sp(5),
    lineHeight: _rs.fs(15),
  },
});
