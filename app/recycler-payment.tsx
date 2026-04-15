import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useRecycler, RecyclerOrder } from "@/lib/recycler-context";
import { PAYMENT, APP_CONFIG, CONTACTS } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type PaymentMethod = "mobile_money" | "bank";

export default function RecyclerPaymentScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { user } = useAuth();
  const { orders, getOrdersByRecycler, updatePaymentStatus } = useRecycler();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RecyclerOrder | null>(null);

  // Get pending orders for this recycler
  const myOrders = user ? getOrdersByRecycler(user.id) : [];
  const pendingPaymentOrders = myOrders.filter(
    (o) => o.paymentStatus === "pending"
  );

  useEffect(() => {
    if (orderId) {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
      }
    }
  }, [orderId, orders]);

  const handlePayment = async () => {
    if (!selectedOrder) {
      Alert.alert("Error", "Please select an order to pay for.");
      return;
    }

    if (!selectedMethod || !selectedProvider) {
      Alert.alert("Error", "Please select a payment method.");
      return;
    }

    setIsProcessing(true);

    try {
        if (selectedMethod === "mobile_money") {
          // Open USSD or show payment instructions
          const provider = PAYMENT.mobileMoneyProviders.find(
            (p) => p.id === selectedProvider
          );
          Alert.alert(
            "Mobile Money Payment",
            `To complete your payment of ${APP_CONFIG.currencySymbol}${selectedOrder.totalPrice.toLocaleString()}:\n\n1. Dial ${PAYMENT.ussdCode}\n2. Select "Pay Bill"\n3. Enter Merchant Code: ${PAYMENT.merchantCode}\n4. Enter Amount: ${selectedOrder.totalPrice}\n5. Enter Reference: ${selectedOrder.id}\n6. Confirm payment\n\nOr send to: ${CONTACTS.paymentPhone}`,
            [
              {
                text: "Dial USSD",
                onPress: () => Linking.openURL(`tel:${PAYMENT.ussdCode}`),
              },
              {
                text: "Mark as Paid",
                onPress: async () => {
                  await updatePaymentStatus(
                    selectedOrder.id,
                    "paid",
                    provider?.name
                  );
                  Alert.alert(
                    "Payment Recorded",
                    "Your payment has been recorded. We will verify and process your order shortly.",
                    [
                      {
                        text: "OK",
                        onPress: () => router.replace("/recycler-dashboard" as any),
                      },
                    ]
                  );
                },
              },
              { text: "Cancel", style: "cancel" },
            ]
          );
        } else {
          // Bank transfer instructions
          const bank = PAYMENT.banks.find((b) => b.id === selectedProvider);
          Alert.alert(
            "Bank Transfer",
            `To complete your payment of ${APP_CONFIG.currencySymbol}${selectedOrder.totalPrice.toLocaleString()}:\n\nBank: ${bank?.name}\nAccount Name: LTC Fast Track\nReference: ${selectedOrder.id}\n\nPlease transfer the exact amount and use the order ID as reference.`,
            [
              {
                text: "Mark as Paid",
                onPress: async () => {
                  await updatePaymentStatus(
                    selectedOrder.id,
                    "paid",
                    bank?.name
                  );
                  Alert.alert(
                    "Payment Recorded",
                    "Your payment has been recorded. We will verify and process your order shortly.",
                    [
                      {
                        text: "OK",
                        onPress: () => router.replace("/recycler-dashboard" as any),
                      },
                    ]
                  );
                },
              },
              { text: "Cancel", style: "cancel" },
            ]
          );
        }
    } catch (_error) {
      Alert.alert("Error", "Payment processing failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center px-6 pt-4 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
          >
            <MaterialIcons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Payment</Text>
            <Text className="text-muted text-sm">Pay for your bulk order</Text>
          </View>
        </View>

        {/* Order Selection */}
        {!orderId && pendingPaymentOrders.length > 0 && (
          <View className="px-6 mb-6">
            <Text className="text-sm font-medium text-foreground mb-3">
              Select Order to Pay
            </Text>
            {pendingPaymentOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                onPress={() => setSelectedOrder(order)}
                className={`p-4 rounded-xl mb-2 border-2 ${
                  selectedOrder?.id === order.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface"
                }`}
              >
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-foreground font-medium">
                      {order.categoryName}
                    </Text>
                    <Text className="text-muted text-sm">
                      {order.quantity} {order.unit} | Order #{order.id}
                    </Text>
                  </View>
                  <Text className="text-primary font-bold">
                    {APP_CONFIG.currencySymbol}
                    {order.totalPrice.toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Selected Order Summary */}
        {selectedOrder && (
          <View className="mx-6 mb-6 bg-primary/10 rounded-xl p-4">
            <Text className="text-foreground font-semibold mb-2">
              Order Summary
            </Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-muted">Order ID:</Text>
              <Text className="text-foreground">{selectedOrder.id}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-muted">Material:</Text>
              <Text className="text-foreground">{selectedOrder.categoryName}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-muted">Quantity:</Text>
              <Text className="text-foreground">
                {selectedOrder.quantity} {selectedOrder.unit}
              </Text>
            </View>
            <View className="border-t border-border mt-2 pt-2 flex-row justify-between">
              <Text className="text-foreground font-semibold">Total:</Text>
              <Text className="text-primary font-bold text-lg">
                {APP_CONFIG.currencySymbol}
                {selectedOrder.totalPrice.toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* Payment Method Selection */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-foreground mb-3">
            Select Payment Method
          </Text>

          {/* Mobile Money */}
          <TouchableOpacity
            onPress={() => {
              setSelectedMethod("mobile_money");
              setSelectedProvider(null);
            }}
            className={`p-4 rounded-xl mb-3 border-2 ${
              selectedMethod === "mobile_money"
                ? "border-primary bg-primary/5"
                : "border-border bg-surface"
            }`}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="phone-android" size={24} color="#22C55E" />
              <Text className="text-foreground font-medium ml-3">
                Mobile Money
              </Text>
            </View>
          </TouchableOpacity>

          {selectedMethod === "mobile_money" && (
            <View className="mb-4 pl-4">
              {PAYMENT.mobileMoneyProviders.map((provider) => (
                <TouchableOpacity
                  key={provider.id}
                  onPress={() => setSelectedProvider(provider.id)}
                  className={`p-3 rounded-lg mb-2 ${
                    selectedProvider === provider.id
                      ? "bg-primary/10"
                      : "bg-surface"
                  }`}
                >
                  <View className="flex-row items-center">
                    <View
                      className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                        selectedProvider === provider.id
                          ? "border-primary bg-primary"
                          : "border-border"
                      }`}
                    >
                      {selectedProvider === provider.id && (
                        <MaterialIcons name="check" size={12} color="#fff" />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text
                        className={
                          selectedProvider === provider.id
                            ? "text-primary font-medium"
                            : "text-foreground"
                        }
                      >
                        {provider.name}
                      </Text>
                      {provider.receiverNumber && (
                        <Text className="text-primary text-xs mt-0.5">
                          Send to: {provider.receiverNumber}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Bank Transfer */}
          <TouchableOpacity
            onPress={() => {
              setSelectedMethod("bank");
              setSelectedProvider(null);
            }}
            className={`p-4 rounded-xl mb-3 border-2 ${
              selectedMethod === "bank"
                ? "border-primary bg-primary/5"
                : "border-border bg-surface"
            }`}
          >
            <View className="flex-row items-center">
              <MaterialIcons name="account-balance" size={24} color="#22C55E" />
              <Text className="text-foreground font-medium ml-3">
                Bank Transfer
              </Text>
            </View>
          </TouchableOpacity>

          {selectedMethod === "bank" && (
            <View className="mb-4 pl-4">
              {PAYMENT.banks.map((bank) => (
                <TouchableOpacity
                  key={bank.id}
                  onPress={() => setSelectedProvider(bank.id)}
                  className={`flex-row items-center p-3 rounded-lg mb-2 ${
                    selectedProvider === bank.id ? "bg-primary/10" : "bg-surface"
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                      selectedProvider === bank.id
                        ? "border-primary bg-primary"
                        : "border-border"
                    }`}
                  >
                    {selectedProvider === bank.id && (
                      <MaterialIcons name="check" size={12} color="#fff" />
                    )}
                  </View>
                  <Text
                    className={
                      selectedProvider === bank.id
                        ? "text-primary font-medium"
                        : "text-foreground"
                    }
                  >
                    {bank.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Payment Info */}
        <View className="mx-6 mb-6 bg-surface rounded-xl p-4 border border-border">
          <View className="flex-row items-center mb-2">
            <MaterialIcons name="info" size={20} color="#6B7280" />
            <Text className="text-foreground font-medium ml-2">
              Payment Information
            </Text>
          </View>
          <Text className="text-muted text-sm">
            Merchant Code: {PAYMENT.merchantCode}
          </Text>
          <Text className="text-muted text-sm">
            USSD Code: {PAYMENT.ussdCode}
          </Text>
          <Text className="text-muted text-sm">
            Payment Phone: {CONTACTS.paymentPhone}
          </Text>
        </View>

        {/* Pay Button */}
        <View className="px-6">
          <TouchableOpacity
            onPress={handlePayment}
            disabled={isProcessing || !selectedOrder || !selectedProvider}
            className="bg-primary rounded-xl py-4 items-center mb-4"
            style={{
              opacity:
                isProcessing || !selectedOrder || !selectedProvider ? 0.7 : 1,
            }}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-lg">
                Proceed to Pay{" "}
                {selectedOrder
                  ? `${APP_CONFIG.currencySymbol}${selectedOrder.totalPrice.toLocaleString()}`
                  : ""}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            className="bg-surface border border-border rounded-xl py-4 items-center"
          >
            <Text className="text-foreground font-medium">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
