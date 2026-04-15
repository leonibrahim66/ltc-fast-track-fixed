import { useState, useRef, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Platform,
  ViewToken,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ONBOARDING_SEEN_PREFIX = "@ltc_onboarding_seen_";

interface OnboardingPage {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  features: { icon: string; text: string }[];
}

type RoleKey = "customer" | "carrier_driver" | "collector" | "zone_manager" | "recycler";

const ROLE_PAGES: Record<RoleKey, OnboardingPage[]> = {
  customer: [
    {
      id: "c1",
      icon: "waving-hand",
      iconColor: "#22C55E",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Welcome to LTC FAST TRACK",
      subtitle: "Fast and efficient garbage collection at your fingertips",
      features: [
        { icon: "check-circle", text: "Residential & commercial pickup services" },
        { icon: "check-circle", text: "Real-time tracking of your pickups" },
        { icon: "check-circle", text: "Easy mobile money & bank payments" },
      ],
    },
    {
      id: "c2",
      icon: "location-on",
      iconColor: "#EF4444",
      iconBg: "rgba(239,68,68,0.15)",
      title: "Pin Your Bin Location",
      subtitle: "Drop a pin on the map to show exactly where your bin is",
      features: [
        { icon: "my-location", text: "Auto-detect your current location" },
        { icon: "touch-app", text: "Tap the map to pin your bin" },
        { icon: "camera-alt", text: "Take a photo of your garbage for faster response" },
      ],
    },
    {
      id: "c3",
      icon: "local-shipping",
      iconColor: "#3B82F6",
      iconBg: "rgba(59,130,246,0.15)",
      title: "Request & Track Pickups",
      subtitle: "Schedule pickups and track them in real-time",
      features: [
        { icon: "schedule", text: "Schedule pickups for morning, afternoon, or evening" },
        { icon: "map", text: "Track your collector on the map in real-time" },
        { icon: "notifications", text: "Get notified when your pickup is on the way" },
      ],
    },
    {
      id: "c4",
      icon: "credit-card",
      iconColor: "#8B5CF6",
      iconBg: "rgba(139,92,246,0.15)",
      title: "Payments & Subscriptions",
      subtitle: "Choose a plan and pay with mobile money or bank transfer",
      features: [
        { icon: "phone-android", text: "Pay via MTN, Airtel, or Zamtel mobile money" },
        { icon: "account-balance", text: "Bank transfer options available" },
        { icon: "star", text: "Subscribe for Basic, Premium, or VIP plans" },
      ],
    },
  ],
  carrier_driver: [
    {
      id: "d1",
      icon: "local-shipping",
      iconColor: "#3B82F6",
      iconBg: "rgba(59,130,246,0.15)",
      title: "Welcome, Driver!",
      subtitle: "Your carrier portal for managing transport jobs",
      features: [
        { icon: "check-circle", text: "Browse and accept available transport jobs" },
        { icon: "check-circle", text: "Track all your active deliveries" },
        { icon: "check-circle", text: "Manage your earnings and payouts" },
      ],
    },
    {
      id: "d2",
      icon: "work",
      iconColor: "#F59E0B",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Job Feed",
      subtitle: "Find and accept transport jobs that match your vehicle",
      features: [
        { icon: "list-alt", text: "View all available booking requests" },
        { icon: "touch-app", text: "Tap to accept jobs instantly" },
        { icon: "filter-list", text: "Filter by distance, weight, and category" },
      ],
    },
    {
      id: "d3",
      icon: "map",
      iconColor: "#22C55E",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Track Shipments",
      subtitle: "Monitor all your active and past deliveries",
      features: [
        { icon: "navigation", text: "Get turn-by-turn directions to pickup & delivery" },
        { icon: "update", text: "Update delivery status in real-time" },
        { icon: "history", text: "View your complete delivery history" },
      ],
    },
    {
      id: "d4",
      icon: "account-balance-wallet",
      iconColor: "#8B5CF6",
      iconBg: "rgba(139,92,246,0.15)",
      title: "Earnings & Notifications",
      subtitle: "Track your income and stay updated on new jobs",
      features: [
        { icon: "payments", text: "View daily, weekly, and monthly earnings" },
        { icon: "notifications-active", text: "Instant alerts for new job requests" },
        { icon: "trending-up", text: "Performance stats and ratings" },
      ],
    },
  ],
  zone_manager: [
    {
      id: "zm1",
      icon: "manage-accounts",
      iconColor: "#1B5E20",
      iconBg: "rgba(27,94,32,0.15)",
      title: "Welcome, Zone Manager!",
      subtitle: "Your dashboard for managing zones, drivers, and households",
      features: [
        { icon: "check-circle", text: "Oversee household subscriptions in your zone" },
        { icon: "check-circle", text: "Manage and approve driver applications" },
        { icon: "check-circle", text: "Track earnings with auto commission split" },
      ],
    },
  ],
  collector: [
    {
      id: "g1",
      icon: "delete",
      iconColor: "#F59E0B",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Welcome, Zone Manager!",
      subtitle: "Your dashboard for managing zones and pickups",
      features: [
        { icon: "check-circle", text: "View and accept pending pickup requests" },
        { icon: "check-circle", text: "Navigate routes to bin locations" },
        { icon: "check-circle", text: "Track your earnings and performance" },
      ],
    },
    {
      id: "g2",
      icon: "assignment",
      iconColor: "#EF4444",
      iconBg: "rgba(239,68,68,0.15)",
      title: "Pending Pickups",
      subtitle: "Accept and manage incoming pickup requests",
      features: [
        { icon: "notification-important", text: "Real-time notifications for new pickups" },
        { icon: "touch-app", text: "Tap to accept or decline requests" },
        { icon: "info", text: "View pickup details, photos, and bin type" },
      ],
    },
    {
      id: "g3",
      icon: "map",
      iconColor: "#3B82F6",
      iconBg: "rgba(59,130,246,0.15)",
      title: "Routes & Navigation",
      subtitle: "Navigate to bin locations and complete pickups",
      features: [
        { icon: "navigation", text: "Get directions to each pickup location" },
        { icon: "camera-alt", text: "Take completion photos as proof of service" },
        { icon: "check", text: "Mark pickups as completed from the map" },
      ],
    },
    {
      id: "g4",
      icon: "account-balance-wallet",
      iconColor: "#22C55E",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Earnings & Availability",
      subtitle: "Track your income and set your availability status",
      features: [
        { icon: "payments", text: "View daily, weekly, and monthly earnings" },
        { icon: "toggle-on", text: "Set yourself as online, offline, or busy" },
        { icon: "star", text: "See your customer ratings and feedback" },
      ],
    },
  ],
  recycler: [
    {
      id: "r1",
      icon: "recycling",
      iconColor: "#8B5CF6",
      iconBg: "rgba(139,92,246,0.15)",
      title: "Welcome, Recycler!",
      subtitle: "Your dashboard for managing bulk recycling orders",
      features: [
        { icon: "check-circle", text: "Place bulk orders for recyclable materials" },
        { icon: "check-circle", text: "Track order status and deliveries" },
        { icon: "check-circle", text: "Manage payments and company profile" },
      ],
    },
    {
      id: "r2",
      icon: "inventory",
      iconColor: "#22C55E",
      iconBg: "rgba(34,197,94,0.15)",
      title: "Place Bulk Orders",
      subtitle: "Order recyclable materials by category and quantity",
      features: [
        { icon: "category", text: "Choose from plastics, metals, paper, glass, and more" },
        { icon: "scale", text: "Specify quantity in tons" },
        { icon: "local-shipping", text: "Schedule delivery to your facility" },
      ],
    },
    {
      id: "r3",
      icon: "track-changes",
      iconColor: "#3B82F6",
      iconBg: "rgba(59,130,246,0.15)",
      title: "Track Orders",
      subtitle: "Monitor your orders from placement to delivery",
      features: [
        { icon: "pending", text: "View pending and confirmed orders" },
        { icon: "local-shipping", text: "Track delivery progress" },
        { icon: "history", text: "Access your complete order history" },
      ],
    },
    {
      id: "r4",
      icon: "payments",
      iconColor: "#F59E0B",
      iconBg: "rgba(245,158,11,0.15)",
      title: "Payments & Profile",
      subtitle: "Manage payments and your company information",
      features: [
        { icon: "credit-card", text: "Pay via mobile money or bank transfer" },
        { icon: "receipt", text: "Download payment receipts" },
        { icon: "business", text: "Update your company profile and details" },
      ],
    },
  ],
};

const ROLE_DASHBOARD: Record<RoleKey, string> = {
  customer: "/(tabs)",
  carrier_driver: "/carrier/portal",
  collector: "/(collector)",
  zone_manager: "/(collector)",
  recycler: "/recycler-dashboard",
};

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role: string }>();
  const role = (params.role || "customer") as RoleKey;
  const pages = ROLE_PAGES[role] || ROLE_PAGES.customer;
  const dashboard = ROLE_DASHBOARD[role] || ROLE_DASHBOARD.customer;

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);

  const isLastPage = currentIndex === pages.length - 1;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const markOnboardingSeen = async () => {
    try {
      await AsyncStorage.setItem(`${ONBOARDING_SEEN_PREFIX}${role}`, "true");
    } catch (e) {
      console.error("Error saving onboarding state:", e);
    }
  };

  const handleSkip = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await markOnboardingSeen();
    router.replace(dashboard as any);
  };

  const handleNext = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isLastPage) {
      handleGetStarted();
    } else {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const handleGetStarted = async () => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await markOnboardingSeen();
    router.replace(dashboard as any);
  };

  const renderPage = ({ item, index }: { item: OnboardingPage; index: number }) => {
    return (
      <View style={{ width: SCREEN_WIDTH, paddingHorizontal: 24 }}>
        <View className="flex-1 justify-center items-center">
          {/* Icon */}
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: item.iconBg,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 32,
            }}
          >
            <MaterialIcons
              name={item.icon as any}
              size={48}
              color={item.iconColor}
            />
          </View>

          {/* Title */}
          <Text
            className="text-foreground text-center font-bold"
            style={{ fontSize: 26, lineHeight: 34, marginBottom: 12 }}
          >
            {item.title}
          </Text>

          {/* Subtitle */}
          <Text
            className="text-muted text-center"
            style={{ fontSize: 16, lineHeight: 24, marginBottom: 36, paddingHorizontal: 16 }}
          >
            {item.subtitle}
          </Text>

          {/* Feature List */}
          <View className="w-full" style={{ maxWidth: 340 }}>
            {item.features.map((feature, fIndex) => (
              <View
                key={fIndex}
                className="flex-row items-center"
                style={{ marginBottom: 16 }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: item.iconBg,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 14,
                  }}
                >
                  <MaterialIcons
                    name={feature.icon as any}
                    size={18}
                    color={item.iconColor}
                  />
                </View>
                <Text
                  className="text-foreground flex-1"
                  style={{ fontSize: 15, lineHeight: 22 }}
                >
                  {feature.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1">
        {/* Skip Button */}
        <View className="flex-row justify-end px-6 pt-2">
          {!isLastPage && (
            <TouchableOpacity
              onPress={handleSkip}
              style={{ paddingVertical: 8, paddingHorizontal: 12 }}
            >
              <Text className="text-muted font-medium" style={{ fontSize: 16 }}>
                Skip
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pages */}
        <FlatList
          ref={flatListRef}
          data={pages}
          renderItem={renderPage}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScroll={(e) => {
            scrollX.value = e.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        {/* Bottom Section */}
        <View className="px-6 pb-6">
          {/* Dot Indicators */}
          <View className="flex-row justify-center items-center" style={{ marginBottom: 24 }}>
            {pages.map((_, index) => {
              const isActive = index === currentIndex;
              return (
                <View
                  key={index}
                  style={{
                    width: isActive ? 24 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: isActive ? pages[0].iconColor : "rgba(255,255,255,0.3)",
                    marginHorizontal: 4,
                  }}
                />
              );
            })}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleNext}
            style={{
              backgroundColor: pages[0].iconColor,
              paddingVertical: 16,
              borderRadius: 14,
              alignItems: "center",
            }}
            activeOpacity={0.8}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 17,
                fontWeight: "700",
              }}
            >
              {isLastPage ? "Get Started" : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
