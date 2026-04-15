import { useState, useMemo } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePickups } from "@/lib/pickups-context";
import { APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
type TimePeriod = "daily" | "weekly" | "monthly" | "all";

// Earnings per pickup (in ZMW)
const EARNINGS_PER_PICKUP = {
  residential: 25,
  commercial: 50,
  industrial: 75,
};

export default function CollectorEarningsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { pickups } = usePickups();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("weekly");

  // Get completed pickups by this collector
  const completedPickups = useMemo(() => {
    return pickups.filter(
      (p) => p.status === "completed" && p.collectorId === user?.id
    );
  }, [pickups, user?.id]);

  // Filter pickups by time period
  const filteredPickups = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return completedPickups.filter((pickup) => {
      const completedDate = new Date(pickup.completedAt || pickup.createdAt);
      switch (selectedPeriod) {
        case "daily":
          return completedDate >= startOfDay;
        case "weekly":
          return completedDate >= startOfWeek;
        case "monthly":
          return completedDate >= startOfMonth;
        case "all":
        default:
          return true;
      }
    });
  }, [completedPickups, selectedPeriod]);

  // Calculate earnings
  const earnings = useMemo(() => {
    return filteredPickups.reduce((total, pickup) => {
      const rate = EARNINGS_PER_PICKUP[pickup.binType as keyof typeof EARNINGS_PER_PICKUP] || 25;
      return total + rate;
    }, 0);
  }, [filteredPickups]);

  // Calculate statistics
  const stats = useMemo(() => {
    const residential = filteredPickups.filter((p) => p.binType === "residential").length;
    const commercial = filteredPickups.filter((p) => p.binType === "commercial").length;
    const industrial = filteredPickups.filter((p) => p.binType === "industrial").length;

    // Calculate average rating
    const ratedPickups = filteredPickups.filter((p) => p.rating);
    const totalRating = ratedPickups.reduce((sum, p) => sum + (p.rating || 0), 0);
    const averageRating = ratedPickups.length > 0 
      ? Math.round((totalRating / ratedPickups.length) * 10) / 10 
      : 0;

    return {
      total: filteredPickups.length,
      residential,
      commercial,
      industrial,
      averagePerDay: selectedPeriod === "daily" 
        ? filteredPickups.length 
        : selectedPeriod === "weekly"
        ? Math.round(filteredPickups.length / 7 * 10) / 10
        : selectedPeriod === "monthly"
        ? Math.round(filteredPickups.length / 30 * 10) / 10
        : Math.round(filteredPickups.length / Math.max(1, completedPickups.length) * 10) / 10,
      averageRating,
      totalRatings: ratedPickups.length,
    };
  }, [filteredPickups, selectedPeriod, completedPickups.length]);

  const periodLabels: Record<TimePeriod, string> = {
    daily: "Today",
    weekly: "This Week",
    monthly: "This Month",
    all: "All Time",
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center px-6 pt-4 pb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4"
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#11181C" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Earnings</Text>
            <Text className="text-muted">Track your income</Text>
          </View>
        </View>

        {/* Period Selector */}
        <View className="px-6 mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {(["daily", "weekly", "monthly", "all"] as TimePeriod[]).map((period) => (
                <TouchableOpacity
                  key={period}
                  onPress={() => setSelectedPeriod(period)}
                  className={`px-4 py-2 rounded-full ${
                    selectedPeriod === period ? "bg-primary" : "bg-surface border border-border"
                  }`}
                >
                  <Text
                    className={`font-medium ${
                      selectedPeriod === period ? "text-white" : "text-foreground"
                    }`}
                  >
                    {periodLabels[period]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Earnings Card */}
        <View className="px-6 mb-4">
          <View className="bg-primary rounded-2xl p-6">
            <Text className="text-white/80 text-base mb-1">
              {periodLabels[selectedPeriod]} Earnings
            </Text>
            <Text className="text-white text-4xl font-bold">
              {APP_CONFIG.currencySymbol}{earnings.toLocaleString()}
            </Text>
            <View className="flex-row items-center mt-3">
              <MaterialIcons name="local-shipping" size={18} color="rgba(255,255,255,0.8)" />
              <Text className="text-white/80 ml-2">
                {stats.total} pickups completed
              </Text>
            </View>
          </View>
        </View>

        {/* Rating Card */}
        <View className="px-6 mb-6">
          <View className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-yellow-800 text-base mb-1">
                  Customer Rating
                </Text>
                <View className="flex-row items-center">
                  <Text className="text-yellow-700 text-3xl font-bold">
                    {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "--"}
                  </Text>
                  <Text className="text-yellow-600 text-xl ml-1">/5</Text>
                </View>
              </View>
              <View className="items-end">
                <View className="flex-row mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <MaterialIcons
                      key={star}
                      name={star <= Math.round(stats.averageRating) ? "star" : "star-border"}
                      size={20}
                      color={star <= Math.round(stats.averageRating) ? "#F59E0B" : "#D1D5DB"}
                    />
                  ))}
                </View>
                <Text className="text-yellow-600 text-sm">
                  {stats.totalRatings} {stats.totalRatings === 1 ? "review" : "reviews"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Statistics Grid */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">
            Pickup Breakdown
          </Text>
          <View className="flex-row flex-wrap">
            <View className="w-1/2 pr-2 mb-4">
              <View className="bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center mb-2">
                  <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
                    <MaterialIcons name="home" size={18} color="#22C55E" />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-foreground">{stats.residential}</Text>
                <Text className="text-muted text-sm">Residential</Text>
                <Text className="text-primary text-xs mt-1">
                  {APP_CONFIG.currencySymbol}{stats.residential * EARNINGS_PER_PICKUP.residential}
                </Text>
              </View>
            </View>
            <View className="w-1/2 pl-2 mb-4">
              <View className="bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center mb-2">
                  <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                    <MaterialIcons name="business" size={18} color="#3B82F6" />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-foreground">{stats.commercial}</Text>
                <Text className="text-muted text-sm">Commercial</Text>
                <Text className="text-primary text-xs mt-1">
                  {APP_CONFIG.currencySymbol}{stats.commercial * EARNINGS_PER_PICKUP.commercial}
                </Text>
              </View>
            </View>
            <View className="w-1/2 pr-2">
              <View className="bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center mb-2">
                  <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center">
                    <MaterialIcons name="factory" size={18} color="#F59E0B" />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-foreground">{stats.industrial}</Text>
                <Text className="text-muted text-sm">Industrial</Text>
                <Text className="text-primary text-xs mt-1">
                  {APP_CONFIG.currencySymbol}{stats.industrial * EARNINGS_PER_PICKUP.industrial}
                </Text>
              </View>
            </View>
            <View className="w-1/2 pl-2">
              <View className="bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center mb-2">
                  <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center">
                    <MaterialIcons name="trending-up" size={18} color="#8B5CF6" />
                  </View>
                </View>
                <Text className="text-2xl font-bold text-foreground">{stats.averagePerDay}</Text>
                <Text className="text-muted text-sm">Avg/Day</Text>
                <Text className="text-primary text-xs mt-1">pickups</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Earnings */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-4">
            Recent Completed Pickups
          </Text>
          {filteredPickups.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 border border-border items-center">
              <MaterialIcons name="inbox" size={48} color="#9BA1A6" />
              <Text className="text-muted mt-2">No completed pickups in this period</Text>
            </View>
          ) : (
            filteredPickups.slice(0, 10).map((pickup, index) => (
              <View
                key={pickup.id}
                className="bg-surface rounded-xl p-4 border border-border mb-3"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-green-100 items-center justify-center">
                      <MaterialIcons name="check-circle" size={24} color="#22C55E" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-foreground font-medium" numberOfLines={1}>
                        {pickup.location.address || "Pickup Location"}
                      </Text>
                      <Text className="text-muted text-sm">
                        {pickup.binType} • {new Date(pickup.completedAt || pickup.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-primary font-bold">
                    +{APP_CONFIG.currencySymbol}
                    {EARNINGS_PER_PICKUP[pickup.binType as keyof typeof EARNINGS_PER_PICKUP] || 25}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Earnings Info */}
        <View className="px-6 mb-6">
          <View className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <View className="flex-row items-start">
              <MaterialIcons name="info" size={20} color="#3B82F6" />
              <View className="ml-3 flex-1">
                <Text className="text-blue-800 font-medium mb-1">Earnings Rates</Text>
                <Text className="text-blue-700 text-sm">
                  Residential: K25/pickup{"\n"}
                  Commercial: K50/pickup{"\n"}
                  Industrial: K75/pickup
                </Text>
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
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
});
