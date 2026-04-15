import { useState } from "react";
import { Text, View, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStaticResponsive } from "@/hooks/use-responsive";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface OnboardingStep {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  tips: string[];
  color: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: "local-shipping",
    title: "Welcome, Driver!",
    subtitle: "Your journey starts here",
    description:
      "You've been approved as a carrier driver on LTC Fast Track. This quick walkthrough will show you how to use the app to find jobs, deliver cargo, and earn money.",
    tips: [
      "Your driver profile is now active",
      "You can accept transport jobs for luggage, goods, and cargo",
      "Earn money for every completed delivery",
      "Build your reputation through customer ratings",
    ],
    color: "#22C55E",
  },
  {
    icon: "work",
    title: "Find & Accept Jobs",
    subtitle: "Your Job Feed",
    description:
      "The Job Feed shows available booking requests from customers near you. Each job card displays pickup/drop-off locations, cargo type, distance, and estimated price.",
    tips: [
      "Tap 'Accept' to lock a job to your account",
      "Tap 'Reject' to skip jobs you can't take",
      "Jobs are matched to your vehicle type",
      "Pull down to refresh and see new requests",
    ],
    color: "#3B82F6",
  },
  {
    icon: "navigation",
    title: "Manage Active Jobs",
    subtitle: "Delivery Status Updates",
    description:
      "Once you accept a job, the Active Job screen shows customer details, cargo info, and navigation to the pickup location. Update your status as you progress through the delivery.",
    tips: [
      "Tap 'Arrived' when you reach the pickup point",
      "Tap 'Picked Up' after loading the cargo",
      "Tap 'Delivered' when the job is complete",
      "Customer is notified at each status change",
    ],
    color: "#8B5CF6",
  },
  {
    icon: "account-balance-wallet",
    title: "Earnings & Wallet",
    subtitle: "Get Paid for Your Work",
    description:
      "Every completed delivery earns you money. Your wallet tracks all earnings with a transparent 10% platform commission. You can withdraw your balance anytime via Mobile Money or bank transfer.",
    tips: [
      "90% of each job payment goes to you",
      "10% platform commission is auto-deducted",
      "Withdraw via MTN, Airtel, Zamtel, or bank",
      "View detailed transaction history anytime",
    ],
    color: "#FBBF24",
  },
];

export default function DriverOnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem("driver_onboarding_completed", "true");
      await AsyncStorage.setItem("@ltc_onboarding_seen_carrier_driver", "true");
    } catch (e) {
      // Continue even if save fails
    }
    router.replace("/carrier/portal" as any);
  };

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 px-6 pt-4">
        {/* Skip Button */}
        <View className="flex-row justify-end mb-4">
          {!isLastStep && (
            <TouchableOpacity onPress={handleSkip} className="py-2 px-3">
              <Text className="text-muted text-sm">Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Step Content */}
        <View className="flex-1 justify-center items-center">
          {/* Icon Circle */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: `${step.color}15`, borderColor: `${step.color}30` },
            ]}
          >
            <MaterialIcons name={step.icon as any} size={56} color={step.color} />
          </View>

          {/* Title */}
          <Text
            className="text-2xl font-bold text-foreground text-center mt-6"
            style={{ color: step.color }}
          >
            {step.title}
          </Text>
          <Text className="text-sm text-muted text-center mt-1">{step.subtitle}</Text>

          {/* Description */}
          <Text className="text-sm text-foreground text-center mt-5 leading-relaxed px-2">
            {step.description}
          </Text>

          {/* Tips */}
          <View className="mt-6 w-full" style={styles.tipsContainer}>
            {step.tips.map((tip, idx) => (
              <View key={idx} className="flex-row items-start mb-3">
                <View
                  style={[styles.tipDot, { backgroundColor: step.color }]}
                />
                <Text className="text-sm text-foreground flex-1 ml-3">{tip}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Section */}
        <View className="pb-6">
          {/* Progress Dots */}
          <View className="flex-row justify-center mb-6">
            {STEPS.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === currentStep
                    ? { backgroundColor: step.color, width: 24 }
                    : { backgroundColor: "rgba(255,255,255,0.2)", width: 8 },
                ]}
              />
            ))}
          </View>

          {/* Navigation Buttons */}
          <View className="flex-row gap-3">
            {currentStep > 0 && (
              <TouchableOpacity
                onPress={() => setCurrentStep(currentStep - 1)}
                className="flex-1 border border-border rounded-xl py-4 items-center"
              >
                <Text className="text-foreground font-semibold">Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleNext}
              className="flex-1 rounded-xl py-4 items-center flex-row justify-center"
              style={{ backgroundColor: step.color }}
            >
              <Text className="text-white font-semibold text-base">
                {isLastStep ? "Get Started" : "Next"}
              </Text>
              <MaterialIcons
                name={isLastStep ? "check" : "arrow-forward"}
                size={20}
                color="#fff"
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  iconCircle: {
    width: _rs.s(120),
    height: _rs.s(120),
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  tipsContainer: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: _rs.s(16),
    padding: _rs.sp(16),
  },
  tipDot: {
    width: _rs.s(8),
    height: _rs.s(8),
    borderRadius: _rs.s(4),
    marginTop: _rs.sp(5),
  },
  dot: {
    height: _rs.s(8),
    borderRadius: _rs.s(4),
    marginHorizontal: _rs.sp(3),
  },
});
