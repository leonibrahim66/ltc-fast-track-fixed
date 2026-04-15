import { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { APP_CONFIG, USER_ROLES } from "@/constants/app";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: PlanFeature[];
  popular?: boolean;
  color: string;
}

const RESIDENTIAL_PLANS: Plan[] = [
  {
    id: "res_basic",
    name: "Basic",
    price: 100,
    period: "month",
    description: "Perfect for small households",
    color: "#6B7280",
    features: [
      { text: "4 pickups per month", included: true },
      { text: "Standard pickup times", included: true },
      { text: "SMS notifications", included: true },
      { text: "Basic support", included: true },
      { text: "Priority scheduling", included: false },
      { text: "Dedicated collector", included: false },
    ],
  },
  {
    id: "res_premium",
    name: "Premium",
    price: 180,
    period: "month",
    description: "Best value for families",
    color: "#22C55E",
    popular: true,
    features: [
      { text: "Unlimited pickups", included: true },
      { text: "Flexible pickup times", included: true },
      { text: "SMS & Push notifications", included: true },
      { text: "Priority support", included: true },
      { text: "Priority scheduling", included: true },
      { text: "Dedicated collector", included: false },
    ],
  },
  {
    id: "res_vip",
    name: "VIP",
    price: 300,
    period: "month",
    description: "Premium experience",
    color: "#F59E0B",
    features: [
      { text: "Unlimited pickups", included: true },
      { text: "Any time pickup", included: true },
      { text: "All notifications", included: true },
      { text: "24/7 VIP support", included: true },
      { text: "Priority scheduling", included: true },
      { text: "Dedicated collector", included: true },
    ],
  },
];

const COMMERCIAL_PLANS: Plan[] = [
  {
    id: "com_basic",
    name: "Starter",
    price: 350,
    period: "month",
    description: "For small businesses",
    color: "#6B7280",
    features: [
      { text: "4 pickups per month", included: true },
      { text: "Business hours pickup", included: true },
      { text: "Email reports", included: true },
      { text: "Standard support", included: true },
      { text: "Multiple locations", included: false },
      { text: "Custom schedule", included: false },
    ],
  },
  {
    id: "com_premium",
    name: "Business",
    price: 500,
    period: "month",
    description: "Growing businesses",
    color: "#22C55E",
    popular: true,
    features: [
      { text: "Unlimited pickups", included: true },
      { text: "Extended hours pickup", included: true },
      { text: "Weekly reports", included: true },
      { text: "Priority support", included: true },
      { text: "Up to 3 locations", included: true },
      { text: "Custom schedule", included: false },
    ],
  },
  {
    id: "com_enterprise",
    name: "Enterprise",
    price: 1000,
    period: "month",
    description: "Large organizations",
    color: "#F59E0B",
    features: [
      { text: "Unlimited pickups", included: true },
      { text: "24/7 pickup available", included: true },
      { text: "Custom reports", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "Unlimited locations", included: true },
      { text: "Custom schedule", included: true },
    ],
  },
];

export default function SubscriptionPlansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<"residential" | "commercial">(
    user?.role === USER_ROLES.COMMERCIAL ? "commercial" : "residential"
  );

  const plans = selectedType === "residential" ? RESIDENTIAL_PLANS : COMMERCIAL_PLANS;

  const handleSelectPlan = (plan: Plan) => {
    router.push({
      pathname: "/payment",
      params: {
        planId: plan.id,
        planName: plan.name,
        price: plan.price.toString(),
      },
    } as any);
  };

  const renderPlanCard = (plan: Plan, index: number) => (
    <View
      key={plan.id}
      className={`bg-surface rounded-2xl p-5 mb-4 border-2 ${
        plan.popular ? "border-primary" : "border-border"
      }`}
      style={plan.popular ? styles.popularShadow : undefined}
    >
      {/* Popular Badge */}
      {plan.popular && (
        <View className="absolute -top-3 left-1/2 -ml-12 bg-primary px-4 py-1 rounded-full">
          <Text className="text-white text-xs font-bold">MOST POPULAR</Text>
        </View>
      )}

      {/* Plan Header */}
      <View className="items-center mb-4 pt-2">
        <View
          className="w-12 h-12 rounded-full items-center justify-center mb-2"
          style={{ backgroundColor: `${plan.color}20` }}
        >
          <MaterialIcons
            name={index === 0 ? "star-outline" : index === 1 ? "star-half" : "star"}
            size={24}
            color={plan.color}
          />
        </View>
        <Text className="text-xl font-bold text-foreground">{plan.name}</Text>
        <Text className="text-muted text-sm">{plan.description}</Text>
      </View>

      {/* Price */}
      <View className="items-center mb-4">
        <View className="flex-row items-baseline">
          <Text className="text-muted text-lg">{APP_CONFIG.currencySymbol}</Text>
          <Text className="text-4xl font-bold text-foreground">{plan.price}</Text>
          <Text className="text-muted text-base">/{plan.period}</Text>
        </View>
      </View>

      {/* Features */}
      <View className="mb-4">
        {plan.features.map((feature, idx) => (
          <View key={idx} className="flex-row items-center py-2">
            <MaterialIcons
              name={feature.included ? "check-circle" : "cancel"}
              size={20}
              color={feature.included ? "#22C55E" : "#9CA3AF"}
            />
            <Text
              className={`ml-3 flex-1 ${
                feature.included ? "text-foreground" : "text-muted line-through"
              }`}
            >
              {feature.text}
            </Text>
          </View>
        ))}
      </View>

      {/* Subscribe Button */}
      <TouchableOpacity
        onPress={() => handleSelectPlan(plan)}
        className={`py-4 rounded-xl items-center ${
          plan.popular ? "bg-primary" : "bg-surface border border-primary"
        }`}
        activeOpacity={0.8}
      >
        <Text
          className={`font-semibold text-base ${
            plan.popular ? "text-white" : "text-primary"
          }`}
        >
          {user?.subscription?.planId === plan.id ? "Current Plan" : "Subscribe Now"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-2">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center mb-4"
          >
            <MaterialIcons name="arrow-back" size={24} color="#687076" />
            <Text className="text-muted ml-2">Back</Text>
          </TouchableOpacity>

          <Text className="text-2xl font-bold text-foreground mb-2">
            Subscription Plans
          </Text>
          <Text className="text-muted">
            Choose the plan that best fits your needs
          </Text>
        </View>

        {/* Type Toggle */}
        <View className="px-6 py-4">
          <View className="flex-row bg-surface rounded-xl p-1 border border-border">
            <TouchableOpacity
              onPress={() => setSelectedType("residential")}
              className={`flex-1 py-3 rounded-lg items-center ${
                selectedType === "residential" ? "bg-primary" : ""
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedType === "residential" ? "text-white" : "text-muted"
                }`}
              >
                Residential
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedType("commercial")}
              className={`flex-1 py-3 rounded-lg items-center ${
                selectedType === "commercial" ? "bg-primary" : ""
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedType === "commercial" ? "text-white" : "text-muted"
                }`}
              >
                Commercial
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Heavy Industrial Banner */}
        <View className="px-6 pb-4">
          <TouchableOpacity
            onPress={() => router.push("/industrial-subscription" as any)}
            className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 border border-warning/30"
            style={{ backgroundColor: "#F59E0B" }}
          >
            <View className="flex-row items-center">
              <View className="w-14 h-14 rounded-xl bg-white/20 items-center justify-center">
                <Text className="text-3xl">🏭</Text>
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-white font-bold text-lg">Heavy Industrial</Text>
                <Text className="text-white/80 text-sm">
                  From K2,000/month • Enterprise solutions
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={28} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Plans */}
        <View className="px-6">
          {plans.map((plan, index) => renderPlanCard(plan, index))}
        </View>

        {/* Footer Note */}
        <View className="px-6 py-4">
          <View className="bg-primary/10 rounded-xl p-4">
            <View className="flex-row items-start">
              <MaterialIcons name="info" size={20} color="#22C55E" />
              <View className="ml-3 flex-1">
                <Text className="text-foreground font-medium mb-1">
                  Need a custom plan?
                </Text>
                <Text className="text-muted text-sm">
                  Contact us for enterprise solutions tailored to your specific requirements.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/contact-support" as any)}
                  className="mt-2"
                >
                  <Text className="text-primary font-semibold">Contact Sales →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  popularShadow: {
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: _rs.s(4) },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
});
