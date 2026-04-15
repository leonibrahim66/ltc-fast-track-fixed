import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { APP_CONFIG, SUBSCRIPTION_PLANS } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

type IndustrialPlan = "basic" | "premium";

export default function IndustrialSubscriptionScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<IndustrialPlan | null>(null);

  const plans = SUBSCRIPTION_PLANS.industrial;

  const handleSelectPlan = (plan: IndustrialPlan) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedPlan(plan);
  };

  const handleSubscribe = () => {
    if (!selectedPlan) {
      Alert.alert("Select Plan", "Please select a subscription plan to continue.");
      return;
    }

    const plan = plans[selectedPlan];
    
    // Navigate to payment with plan details
    router.push({
      pathname: "/payment",
      params: {
        amount: plan.price.toString(),
        type: "subscription",
        planId: plan.id,
        planName: plan.name,
        description: `Heavy Industrial ${plan.name} Subscription`,
      },
    } as any);
  };

  const handleContactSales = () => {
    Alert.alert(
      "Contact Sales Team",
      "For custom industrial solutions and bulk pricing, please contact our sales team.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          onPress: () => {
            // Would trigger phone call
            Alert.alert("Calling", "Dialing +260960819993...");
          },
        },
        {
          text: "WhatsApp",
          onPress: () => {
            // Would open WhatsApp
            Alert.alert("WhatsApp", "Opening WhatsApp...");
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6 bg-primary">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-2xl font-bold">Heavy Industrial</Text>
              <Text className="text-white/80">Enterprise waste management solutions</Text>
            </View>
          </View>
        </View>

        {/* Industrial Icon Banner */}
        <View className="px-6 -mt-6">
          <View className="bg-surface rounded-2xl p-6 border border-border shadow-sm">
            <View className="flex-row items-center">
              <View className="w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center">
                <Text className="text-4xl">🏭</Text>
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-foreground font-bold text-lg">Industrial Grade Service</Text>
                <Text className="text-muted text-sm">
                  Designed for factories, manufacturing plants, and large-scale operations
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Plans Section */}
        <View className="px-6 mt-6">
          <Text className="text-foreground text-lg font-bold mb-4">Choose Your Plan</Text>

          {/* Basic Plan */}
          <TouchableOpacity
            onPress={() => handleSelectPlan("basic")}
            className={`bg-surface rounded-2xl p-5 mb-4 border-2 ${
              selectedPlan === "basic" ? "border-primary" : "border-border"
            }`}
          >
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-xl bg-blue-500/10 items-center justify-center">
                  <MaterialIcons name="business" size={24} color="#3B82F6" />
                </View>
                <View className="ml-3">
                  <Text className="text-foreground font-bold text-lg">{plans.basic.name}</Text>
                  <Text className="text-muted text-sm">Standard industrial service</Text>
                </View>
              </View>
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  selectedPlan === "basic" ? "bg-primary border-primary" : "border-muted"
                }`}
              >
                {selectedPlan === "basic" && (
                  <MaterialIcons name="check" size={16} color="#fff" />
                )}
              </View>
            </View>

            <View className="flex-row items-baseline mb-4">
              <Text className="text-primary text-3xl font-bold">
                {APP_CONFIG.currencySymbol}{plans.basic.price.toLocaleString()}
              </Text>
              <Text className="text-muted text-sm ml-1">/month</Text>
            </View>

            <View className="bg-background rounded-xl p-4">
              <Text className="text-foreground font-semibold mb-2">Features Included:</Text>
              {plans.basic.features?.map((feature, index) => (
                <View key={index} className="flex-row items-center mb-2">
                  <MaterialIcons name="check-circle" size={18} color="#22C55E" />
                  <Text className="text-muted ml-2 flex-1">{feature}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>

          {/* Premium Plan */}
          <TouchableOpacity
            onPress={() => handleSelectPlan("premium")}
            className={`bg-surface rounded-2xl p-5 mb-4 border-2 ${
              selectedPlan === "premium" ? "border-primary" : "border-border"
            }`}
          >
            {/* Popular Badge */}
            <View className="absolute -top-3 right-4 bg-warning px-3 py-1 rounded-full">
              <Text className="text-white text-xs font-bold">MOST POPULAR</Text>
            </View>

            <View className="flex-row items-start justify-between mb-3 mt-2">
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-xl bg-warning/10 items-center justify-center">
                  <MaterialIcons name="star" size={24} color="#F59E0B" />
                </View>
                <View className="ml-3">
                  <Text className="text-foreground font-bold text-lg">{plans.premium.name}</Text>
                  <Text className="text-muted text-sm">Full industrial coverage</Text>
                </View>
              </View>
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                  selectedPlan === "premium" ? "bg-primary border-primary" : "border-muted"
                }`}
              >
                {selectedPlan === "premium" && (
                  <MaterialIcons name="check" size={16} color="#fff" />
                )}
              </View>
            </View>

            <View className="flex-row items-baseline mb-4">
              <Text className="text-primary text-3xl font-bold">
                {APP_CONFIG.currencySymbol}{plans.premium.price.toLocaleString()}
              </Text>
              <Text className="text-muted text-sm ml-1">/month</Text>
            </View>

            <View className="bg-background rounded-xl p-4">
              <Text className="text-foreground font-semibold mb-2">Premium Features:</Text>
              {plans.premium.features?.map((feature, index) => (
                <View key={index} className="flex-row items-center mb-2">
                  <MaterialIcons name="check-circle" size={18} color="#22C55E" />
                  <Text className="text-muted ml-2 flex-1">{feature}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </View>

        {/* Why Choose Industrial */}
        <View className="px-6 mt-4">
          <Text className="text-foreground text-lg font-bold mb-4">Why Choose Industrial?</Text>
          
          <View className="bg-surface rounded-2xl p-4 border border-border">
            {[
              { icon: "local-shipping", title: "Heavy-Duty Equipment", desc: "Specialized trucks for large-volume waste" },
              { icon: "schedule", title: "Flexible Scheduling", desc: "Pickups scheduled around your operations" },
              { icon: "verified", title: "Compliance Ready", desc: "Full documentation for regulatory requirements" },
              { icon: "support-agent", title: "Dedicated Support", desc: "24/7 priority customer service" },
            ].map((item, index) => (
              <View key={index} className={`flex-row items-center py-3 ${index < 3 ? "border-b border-border" : ""}`}>
                <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                  <MaterialIcons name={item.icon as any} size={20} color="#22C55E" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-foreground font-semibold">{item.title}</Text>
                  <Text className="text-muted text-sm">{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Custom Solutions */}
        <View className="px-6 mt-6">
          <TouchableOpacity
            onPress={handleContactSales}
            className="bg-surface rounded-2xl p-5 border border-border"
          >
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-xl bg-purple-500/10 items-center justify-center">
                <MaterialIcons name="handshake" size={24} color="#8B5CF6" />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-foreground font-bold">Need Custom Solutions?</Text>
                <Text className="text-muted text-sm">
                  Contact our sales team for tailored enterprise packages
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9BA1A6" />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Subscribe Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-4">
        <TouchableOpacity
          onPress={handleSubscribe}
          disabled={!selectedPlan}
          className={`py-4 rounded-xl ${selectedPlan ? "bg-primary" : "bg-muted"}`}
        >
          <Text className="text-white text-center font-bold text-lg">
            {selectedPlan
              ? `Subscribe for ${APP_CONFIG.currencySymbol}${plans[selectedPlan].price.toLocaleString()}/month`
              : "Select a Plan"}
          </Text>
        </TouchableOpacity>
        <Text className="text-muted text-center text-xs mt-2">
          Cancel anytime. No long-term contracts.
        </Text>
      </View>
    </ScreenContainer>
  );
}
