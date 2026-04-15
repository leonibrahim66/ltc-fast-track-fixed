import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import type { WithdrawalRequest } from "@/types/commission";

import { getStaticResponsive } from "@/hooks/use-responsive";
type PaymentMethod = "mobile_money" | "bank_transfer";

export default function CollectorWithdrawalRequestScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mobile_money");
  const [mobileNumber, setMobileNumber] = useState("");
  const [provider, setProvider] = useState<"MTN" | "Airtel" | "Zamtel">("MTN");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TODO: Replace with real available balance from backend
  const availableBalance = 1850.50;

  const providers: Array<{ key: "MTN" | "Airtel" | "Zamtel"; label: string; color: string }> = [
    { key: "MTN", label: "MTN", color: "#FFCC00" },
    { key: "Airtel", label: "Airtel", color: "#EF4444" },
    { key: "Zamtel", label: "Zamtel", color: "#10B981" },
  ];

  const validateForm = (): boolean => {
    const withdrawalAmount = parseFloat(amount);
    
    if (!amount || isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return false;
    }

    if (withdrawalAmount > availableBalance) {
      Alert.alert("Error", `Insufficient balance. Available: K${availableBalance.toFixed(2)}`);
      return false;
    }

    if (paymentMethod === "mobile_money") {
      if (!mobileNumber.trim()) {
        Alert.alert("Error", "Please enter your mobile number");
        return false;
      }
      if (!/^[0-9]{10}$/.test(mobileNumber.replace(/\s/g, ""))) {
        Alert.alert("Error", "Please enter a valid 10-digit mobile number");
        return false;
      }
    } else {
      if (!accountName.trim()) {
        Alert.alert("Error", "Please enter account holder name");
        return false;
      }
      if (!accountNumber.trim()) {
        Alert.alert("Error", "Please enter account number");
        return false;
      }
      if (!bankName.trim()) {
        Alert.alert("Error", "Please enter bank name");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const withdrawalAmount = parseFloat(amount);

    Alert.alert(
      "Confirm Withdrawal",
      `Request withdrawal of K${withdrawalAmount.toFixed(2)} to ${
        paymentMethod === "mobile_money"
          ? `${provider} ${mobileNumber}`
          : `${bankName} (${accountNumber})`
      }?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setIsSubmitting(true);
            try {
              // Create withdrawal request
              const request: WithdrawalRequest = {
                id: `WD${Date.now()}`,
                collectorId: user?.id || "",
                collectorName: user?.fullName || "Collector",
                amount: withdrawalAmount,
                paymentMethod,
                accountDetails:
                  paymentMethod === "mobile_money"
                    ? {
                        mobileNumber,
                        provider,
                      }
                    : {
                        accountName,
                        accountNumber,
                        bankName,
                      },
                status: "pending",
                requestDate: new Date().toISOString(),
              };

              // Save to AsyncStorage (TODO: Replace with backend API call)
              const stored = await AsyncStorage.getItem("collector_withdrawal_requests");
              const requests: WithdrawalRequest[] = stored ? JSON.parse(stored) : [];
              requests.unshift(request);
              await AsyncStorage.setItem("collector_withdrawal_requests", JSON.stringify(requests));

              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              Alert.alert(
                "Success",
                "Withdrawal request submitted successfully. You will be notified once approved.",
                [
                  {
                    text: "OK",
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (e) {
              console.error("Error submitting withdrawal:", e);
              Alert.alert("Error", "Failed to submit withdrawal request. Please try again.");
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Withdrawal</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Available Balance */}
        <View style={styles.section}>
          <View
            style={[
              styles.balanceCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.balanceLabel, { color: colors.muted }]}>
              Available Balance
            </Text>
            <Text style={[styles.balanceAmount, { color: colors.primary }]}>
              K{availableBalance.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Withdrawal Amount <Text style={{ color: "#EF4444" }}>*</Text>
          </Text>
          <View style={[styles.inputContainer, { borderColor: colors.border }]}>
            <Text style={[styles.currency, { color: colors.muted }]}>K</Text>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.muted}
            />
          </View>
          <TouchableOpacity
            onPress={() => setAmount(availableBalance.toString())}
            style={styles.maxButton}
          >
            <Text style={[styles.maxButtonText, { color: colors.primary }]}>
              Withdraw All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Payment Method <Text style={{ color: "#EF4444" }}>*</Text>
          </Text>
          <View style={styles.methodButtons}>
            <TouchableOpacity
              onPress={() => setPaymentMethod("mobile_money")}
              style={[
                styles.methodButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                paymentMethod === "mobile_money" && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <MaterialIcons
                name="phone-android"
                size={20}
                color={paymentMethod === "mobile_money" ? "#FFFFFF" : colors.muted}
              />
              <Text
                style={[
                  styles.methodButtonText,
                  { color: colors.muted },
                  paymentMethod === "mobile_money" && { color: "#FFFFFF" },
                ]}
              >
                Mobile Money
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPaymentMethod("bank_transfer")}
              style={[
                styles.methodButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                paymentMethod === "bank_transfer" && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <MaterialIcons
                name="account-balance"
                size={20}
                color={paymentMethod === "bank_transfer" ? "#FFFFFF" : colors.muted}
              />
              <Text
                style={[
                  styles.methodButtonText,
                  { color: colors.muted },
                  paymentMethod === "bank_transfer" && { color: "#FFFFFF" },
                ]}
              >
                Bank Transfer
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mobile Money Details */}
        {paymentMethod === "mobile_money" && (
          <>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Mobile Provider <Text style={{ color: "#EF4444" }}>*</Text>
              </Text>
              <View style={styles.providerButtons}>
                {providers.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setProvider(p.key)}
                    style={[
                      styles.providerButton,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      provider === p.key && {
                        backgroundColor: p.color,
                        borderColor: p.color,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.providerButtonText,
                        { color: colors.foreground },
                        provider === p.key && { color: "#FFFFFF" },
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Mobile Number <Text style={{ color: "#EF4444" }}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, { borderColor: colors.border, color: colors.foreground }]}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                keyboardType="phone-pad"
                placeholder="0971234567"
                placeholderTextColor={colors.muted}
              />
            </View>
          </>
        )}

        {/* Bank Transfer Details */}
        {paymentMethod === "bank_transfer" && (
          <>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Account Holder Name <Text style={{ color: "#EF4444" }}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, { borderColor: colors.border, color: colors.foreground }]}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="John Doe"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Account Number <Text style={{ color: "#EF4444" }}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, { borderColor: colors.border, color: colors.foreground }]}
                value={accountNumber}
                onChangeText={setAccountNumber}
                keyboardType="number-pad"
                placeholder="1234567890"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                Bank Name <Text style={{ color: "#EF4444" }}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, { borderColor: colors.border, color: colors.foreground }]}
                value={bankName}
                onChangeText={setBankName}
                placeholder="Zanaco, FNB, etc."
                placeholderTextColor={colors.muted}
              />
            </View>
          </>
        )}

        {/* Submit Button */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary },
              isSubmitting && { opacity: 0.5 },
            ]}
          >
            <MaterialIcons name="send" size={20} color="#FFFFFF" />
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.section}>
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialIcons name="info" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.muted }]}>
              Withdrawal requests are reviewed by admin and typically processed within 1-3 business days.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(20),
    paddingTop: _rs.sp(16),
    borderBottomLeftRadius: _rs.s(24),
    borderBottomRightRadius: _rs.s(24),
    marginBottom: _rs.sp(20),
  },
  backButton: {
    padding: _rs.sp(4),
  },
  headerTitle: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  section: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
  },
  balanceCard: {
    padding: _rs.sp(20),
    borderRadius: _rs.s(16),
    borderWidth: 1,
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: _rs.fs(14),
    marginBottom: _rs.sp(8),
  },
  balanceAmount: {
    fontSize: _rs.fs(32),
    fontWeight: "700",
  },
  label: {
    fontSize: _rs.fs(15),
    fontWeight: "600",
    marginBottom: _rs.sp(12),
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: _rs.s(12),
    paddingHorizontal: _rs.sp(16),
  },
  currency: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    marginRight: _rs.sp(8),
  },
  input: {
    flex: 1,
    fontSize: _rs.fs(20),
    fontWeight: "700",
    paddingVertical: _rs.sp(16),
  },
  maxButton: {
    alignSelf: "flex-end",
    marginTop: _rs.sp(8),
  },
  maxButtonText: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
  },
  methodButtons: {
    flexDirection: "row",
    gap: _rs.sp(12),
  },
  methodButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    gap: _rs.sp(8),
  },
  methodButtonText: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
  },
  providerButtons: {
    flexDirection: "row",
    gap: _rs.sp(12),
  },
  providerButton: {
    flex: 1,
    padding: _rs.sp(14),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    alignItems: "center",
  },
  providerButtonText: {
    fontSize: _rs.fs(14),
    fontWeight: "700",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: _rs.s(12),
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(14),
    fontSize: _rs.fs(15),
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    gap: _rs.sp(8),
  },
  submitButtonText: {
    fontSize: _rs.fs(16),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    gap: _rs.sp(12),
  },
  infoText: {
    flex: 1,
    fontSize: _rs.fs(13),
    lineHeight: _rs.fs(18),
  },
});
