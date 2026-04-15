import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePayments, PaymentMethod } from "@/lib/payments-context";
import { useSubscriptionApproval } from "@/lib/subscription-approval-context";
import { APP_CONFIG, PAYMENT, CONTACTS } from "@/constants/app";
import { useITRealtime } from "@/lib/it-realtime-context";
import { useAdmin } from "@/lib/admin-context";

import { getStaticResponsive } from "@/hooks/use-responsive";
import { sendNotification } from "@/lib/send-notification";
export default function PaymentConfirmationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { createPayment } = usePayments();
  const { addSubscriptionRequest } = useSubscriptionApproval();
  const { addEvent } = useITRealtime();
  const { addNotification } = useAdmin();

  const {
    amount,
    method,
    methodName,
    description,
    planId,
    planName,
    sandboxMode,
    overrideReceiverNumber,
  } = useLocalSearchParams<{
    amount: string;
    method: string;
    methodName: string;
    description: string;
    planId?: string;
    planName?: string;
    sandboxMode?: string;
    overrideReceiverNumber?: string;
  }>();

  const isSandbox = sandboxMode === "1";

  const [transactionId, setTransactionId] = useState("");
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [_paymentId, setPaymentId] = useState<string | null>(null);

  // Determine whether this is a subscription payment (has a planId / planName)
  const isSubscriptionPayment = Boolean(planId || planName);

  // Get receiver number for the selected method.
  // In sandbox mode, use the override number passed from the payment screen.
  const getReceiverNumber = () => {
    if (isSandbox && overrideReceiverNumber) {
      return overrideReceiverNumber;
    }
    const provider = PAYMENT.mobileMoneyProviders.find(p => p.id === method);
    return provider?.receiverNumber || CONTACTS.paymentPhone;
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to upload payment screenshots."
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
      setScreenshotUri(result.assets[0].uri);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take payment screenshots."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setScreenshotUri(result.assets[0].uri);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  /**
   * Derive the user's role for the subscription approval request.
   * Maps internal UserRole values to the SubscriptionRequest userRole union.
   */
  const getApprovalUserRole = (): 'residential' | 'commercial' | 'industrial' | 'collector' | 'recycler' => {
    const role = user?.role ?? "";
    if (role === "commercial") return "commercial";
    if (role === "industrial") return "industrial";
    if (role === "collector" || role === "zone_manager") return "collector";
    if (role === "recycler") return "recycler";
    return "residential";
  };

  const handleSubmit = async () => {
    if (!transactionId.trim() && !screenshotUri) {
      Alert.alert(
        "Confirmation Required",
        "Please enter a transaction ID or upload a payment screenshot to confirm your payment."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // ── Step 1: Create the payment transaction record ──────────────────────
      const payment = await createPayment({
        userId: user?.id || "guest",
        amount: parseFloat(amount || "0"),
        currency: APP_CONFIG.currency,
        method: method as PaymentMethod,
        methodName: methodName || "Mobile Money",
        status: "pending",
        transactionId: transactionId.trim() || undefined,
        screenshotUri: screenshotUri || undefined,
        reference: "",
        description: description || `${planName || "Subscription"} Payment`,
      });

      setPaymentId(payment.id);

      // ── Step 2: Auto-create subscription approval request ─────────────────
      // Only create an approval request when this is a subscription payment.
      let approvalRequestId: string | null = null;
      if (isSubscriptionPayment) {
        approvalRequestId = await addSubscriptionRequest({
          userId: user?.id || "guest",
          userName: user?.fullName || user?.firstName
            ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
            : "Unknown User",
          userPhone: user?.phone || "",
          userRole: getApprovalUserRole(),
          subscriptionPlan: planName || "Subscription",
          planId: planId || undefined,
          planPrice: parseFloat(amount || "0"),
          paymentMethod: methodName || "Mobile Money",
          paymentReference: payment.reference,
          paymentId: payment.id,
          transactionId: transactionId.trim() || undefined,
          amountPaid: parseFloat(amount || "0"),
        });
      }

      // Fix 4: Emit payment event to admin live screens
      addEvent({
        type: isSubscriptionPayment ? "subscription_pending" : "payment_received",
        title: isSubscriptionPayment ? "New Subscription Payment" : "Payment Received",
        description: `${user?.fullName || user?.phone || "Customer"} paid ${APP_CONFIG.currencySymbol}${amount} via ${methodName}`,
        data: {
          userName: user?.fullName || user?.phone || "Customer",
          amount: parseFloat(amount || "0"),
          planName: planName || undefined,
        },
        priority: isSubscriptionPayment ? "high" : "medium",
      });
      addNotification({
        type: "payment",
        title: isSubscriptionPayment ? "Subscription Payment Submitted" : "Payment Received",
        message: `${user?.fullName || user?.phone || "Customer"} submitted ${APP_CONFIG.currencySymbol}${amount} — awaiting verification`,
      });

      // Notify the customer that their payment was received
      if (user?.id) {
        sendNotification({
          userId: user.id,
          type: 'payment',
          title: 'Payment Submitted',
          body: `Your payment of ${APP_CONFIG.currencySymbol}${amount} via ${methodName} has been submitted. We will verify within 24 hours.`,
        }).catch(() => {});
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const approvalNote = isSubscriptionPayment && approvalRequestId
        ? "\n\nYour subscription request has been sent to the admin for approval."
        : "";

      Alert.alert(
        "Payment Submitted",
        `Your payment confirmation has been submitted.\n\nReference: ${payment.reference}${approvalNote}\n\nWe will verify your payment and update your account within 24 hours.`,
        [
          {
            text: "View Payment History",
            onPress: () => router.push("/payment-history" as any),
          },
          {
            text: "Done",
            onPress: () => router.replace("/(tabs)"),
          },
        ]
      );
    } catch (_error) {
      Alert.alert("Error", "Failed to submit payment confirmation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
            Confirm Payment
          </Text>
          <Text className="text-base text-muted mb-6">
            Upload proof of payment to complete your transaction
          </Text>

          {/* Subscription notice */}
          {isSubscriptionPayment && (
            <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30 flex-row items-start gap-3">
              <MaterialIcons name="subscriptions" size={20} color="#22C55E" />
              <View className="flex-1">
                <Text className="text-foreground font-semibold text-sm">
                  Subscription Payment
                </Text>
                <Text className="text-muted text-xs mt-1">
                  After submitting, an approval request will be automatically created for the admin to review.
                </Text>
              </View>
            </View>
          )}

          {/* Payment Summary */}
          <View className="bg-surface rounded-xl p-5 mb-6 border border-border">
            <Text className="text-sm font-medium text-muted mb-3">
              PAYMENT DETAILS
            </Text>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground">Amount</Text>
              <Text className="text-primary font-bold text-xl">
                {APP_CONFIG.currencySymbol}{amount} {APP_CONFIG.currency}
              </Text>
            </View>
            {planName && (
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-foreground">Plan</Text>
                <Text className="text-foreground font-medium">{planName}</Text>
              </View>
            )}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground">Method</Text>
              <Text className="text-foreground font-medium">{methodName}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground">
                {isSandbox ? "Sandbox Number" : "Send To"}
              </Text>
              <Text
                style={{ fontWeight: "600", color: isSandbox ? "#F59E0B" : "#22C55E" }}
              >
                {getReceiverNumber()}
              </Text>
            </View>
          </View>

          {/* Transaction ID Input */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-muted mb-2">
              TRANSACTION ID / REFERENCE NUMBER
            </Text>
            <TextInput
              value={transactionId}
              onChangeText={setTransactionId}
              placeholder="Enter transaction ID from your payment"
              placeholderTextColor="#9CA3AF"
              className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground"
              autoCapitalize="characters"
              returnKeyType="done"
            />
            <Text className="text-xs text-muted mt-2">
              You can find this in your mobile money confirmation SMS
            </Text>
          </View>

          {/* Screenshot Upload */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-muted mb-2">
              PAYMENT SCREENSHOT (OPTIONAL)
            </Text>

            {screenshotUri ? (
              <View className="relative">
                <Image
                  source={{ uri: screenshotUri }}
                  style={styles.screenshot}
                  contentFit="cover"
                />
                <TouchableOpacity
                  onPress={() => setScreenshotUri(null)}
                  className="absolute top-2 right-2 bg-error rounded-full p-2"
                >
                  <MaterialIcons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={pickImage}
                  className="flex-1 bg-surface border-2 border-dashed border-border rounded-xl p-6 items-center"
                >
                  <MaterialIcons name="photo-library" size={32} color="#6B7280" />
                  <Text className="text-muted mt-2 text-center">
                    Choose from Gallery
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={takePhoto}
                  className="flex-1 bg-surface border-2 border-dashed border-border rounded-xl p-6 items-center"
                >
                  <MaterialIcons name="camera-alt" size={32} color="#6B7280" />
                  <Text className="text-muted mt-2 text-center">
                    Take Photo
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Instructions */}
          <View className="bg-primary/10 rounded-xl p-4 mb-6 border border-primary/30">
            <View className="flex-row items-center mb-2">
              <MaterialIcons name="info" size={18} color="#22C55E" />
              <Text className="text-primary font-semibold ml-2">
                How to Confirm Payment
              </Text>
            </View>
            <Text className="text-foreground text-sm leading-5 mb-2">
              1. Complete your payment to {getReceiverNumber()}
            </Text>
            <Text className="text-foreground text-sm leading-5 mb-2">
              2. Enter the transaction ID from your confirmation SMS
            </Text>
            <Text className="text-foreground text-sm leading-5">
              3. Optionally upload a screenshot of your payment
            </Text>
          </View>

          {/* Contact Support */}
          <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
            <Text className="text-sm text-muted mb-2">
              Having issues with payment?
            </Text>
            <Text className="text-foreground font-medium">
              Call: {CONTACTS.supportPhone}
            </Text>
          </View>

          <View className="flex-1" />

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || (!transactionId.trim() && !screenshotUri)}
            className={`py-4 rounded-full mb-6 ${
              transactionId.trim() || screenshotUri ? "bg-primary" : "bg-muted"
            }`}
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center text-lg font-semibold">
                Submit Confirmation
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
  screenshot: {
    width: "100%",
    height: _rs.s(200),
    borderRadius: _rs.s(12),
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
});
