import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useRecycler } from "@/lib/recycler-context";
import {
  RECYCLING_CATEGORIES,
  RECYCLING_PRICING,
  APP_CONFIG,
} from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function RecyclerOrderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { createOrder } = useRecycler();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(
    user?.location?.address || ""
  );
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedCategoryData = RECYCLING_CATEGORIES.find(
    (c) => c.id === selectedCategory
  );
  const pricePerUnit = selectedCategory
    ? RECYCLING_PRICING[selectedCategory as keyof typeof RECYCLING_PRICING]
    : 0;
  const totalPrice = selectedCategoryData
    ? parseFloat(quantity || "0") * pricePerUnit
    : 0;

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert("Error", "Please select a recycling category.");
      return;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert("Error", "Please enter a valid quantity.");
      return;
    }

    if (
      selectedCategoryData &&
      parseFloat(quantity) < selectedCategoryData.minOrder
    ) {
      Alert.alert(
        "Minimum Order",
        `Minimum order for ${selectedCategoryData.name} is ${selectedCategoryData.minOrder} ${selectedCategoryData.unit}.`
      );
      return;
    }

    if (!deliveryAddress.trim()) {
      Alert.alert("Error", "Please enter a delivery address.");
      return;
    }

    if (!user) {
      Alert.alert("Error", "Please login to place an order.");
      return;
    }

    setIsLoading(true);
    try {
      const order = await createOrder({
        recyclerId: user.id,
        recyclerName: user.fullName,
        recyclerPhone: user.phone,
        category: selectedCategory,
        categoryName: selectedCategoryData?.name || "",
        quantity: parseFloat(quantity),
        unit: selectedCategoryData?.unit || "tons",
        totalPrice,
        deliveryAddress: deliveryAddress.trim(),
        notes: notes.trim() || undefined,
      });

      Alert.alert(
        "Order Placed",
        `Your order for ${quantity} ${selectedCategoryData?.unit} of ${selectedCategoryData?.name} has been placed.\n\nOrder ID: ${order.id}\nTotal: ${APP_CONFIG.currencySymbol}${totalPrice.toLocaleString()}\n\nProceed to payment to confirm your order.`,
        [
          {
            text: "Pay Now",
            onPress: () =>
              router.replace(`/recycler-payment?orderId=${order.id}` as any),
          },
          {
            text: "Pay Later",
            onPress: () => router.replace("/recycler-dashboard" as any),
          },
        ]
      );
    } catch (_error) {
      Alert.alert("Error", "Failed to place order. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
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
              <Text className="text-2xl font-bold text-foreground">
                Place Bulk Order
              </Text>
              <Text className="text-muted text-sm">
                Order recyclable materials
              </Text>
            </View>
          </View>

          {/* Form */}
          <View className="px-6">
            {/* Category Selection */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-3">
                Select Material Category *
              </Text>
              {RECYCLING_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => setSelectedCategory(category.id)}
                  className={`flex-row items-center p-4 rounded-xl mb-2 border-2 ${
                    selectedCategory === category.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <View
                    className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
                      selectedCategory === category.id
                        ? "border-primary bg-primary"
                        : "border-border"
                    }`}
                  >
                    {selectedCategory === category.id && (
                      <MaterialIcons name="check" size={16} color="#fff" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-medium ${
                        selectedCategory === category.id
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {category.name}
                    </Text>
                    <Text className="text-muted text-xs">
                      Min: {category.minOrder} {category.unit} | {APP_CONFIG.currencySymbol}
                      {RECYCLING_PRICING[
                        category.id as keyof typeof RECYCLING_PRICING
                      ].toLocaleString()}
                      /{category.unit === "kg" ? "kg" : "ton"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Quantity */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Quantity ({selectedCategoryData?.unit || "tons"}) *
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
                <MaterialIcons name="scale" size={20} color="#6B7280" />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder={`Enter quantity in ${
                    selectedCategoryData?.unit || "tons"
                  }`}
                  placeholderTextColor="#9CA3AF"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                />
              </View>
              {selectedCategoryData && (
                <Text className="text-xs text-muted mt-1">
                  Minimum order: {selectedCategoryData.minOrder}{" "}
                  {selectedCategoryData.unit}
                </Text>
              )}
            </View>

            {/* Delivery Address */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">
                Delivery Address *
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-start px-4">
                <MaterialIcons
                  name="location-on"
                  size={20}
                  color="#6B7280"
                  style={{ marginTop: 16 }}
                />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Where should we deliver?"
                  placeholderTextColor="#9CA3AF"
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>

            {/* Notes */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">
                Additional Notes (Optional)
              </Text>
              <View className="bg-surface border border-border rounded-xl flex-row items-start px-4">
                <MaterialIcons
                  name="note"
                  size={20}
                  color="#6B7280"
                  style={{ marginTop: 16 }}
                />
                <TextInput
                  className="flex-1 py-4 px-3 text-foreground"
                  placeholder="Any special requirements..."
                  placeholderTextColor="#9CA3AF"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Price Summary */}
            {selectedCategory && quantity && parseFloat(quantity) > 0 && (
              <View className="bg-primary/10 rounded-xl p-4 mb-6">
                <Text className="text-foreground font-semibold mb-2">
                  Order Summary
                </Text>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-muted">Material:</Text>
                  <Text className="text-foreground">
                    {selectedCategoryData?.name}
                  </Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-muted">Quantity:</Text>
                  <Text className="text-foreground">
                    {quantity} {selectedCategoryData?.unit}
                  </Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-muted">Price per unit:</Text>
                  <Text className="text-foreground">
                    {APP_CONFIG.currencySymbol}
                    {pricePerUnit.toLocaleString()}
                  </Text>
                </View>
                <View className="border-t border-border mt-2 pt-2 flex-row justify-between">
                  <Text className="text-foreground font-semibold">Total:</Text>
                  <Text className="text-primary font-bold text-lg">
                    {APP_CONFIG.currencySymbol}
                    {totalPrice.toLocaleString()}
                  </Text>
                </View>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading || !selectedCategory || !quantity}
              className="bg-primary rounded-xl py-4 items-center mb-4"
              style={{
                opacity: isLoading || !selectedCategory || !quantity ? 0.7 : 1,
              }}
            >
              <Text className="text-white font-semibold text-lg">
                {isLoading ? "Placing Order..." : "Place Order"}
              </Text>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-surface border border-border rounded-xl py-4 items-center"
            >
              <Text className="text-foreground font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
