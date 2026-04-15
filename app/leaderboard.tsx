import { useState, useMemo, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { usePickups } from "@/lib/pickups-context";
import { APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
type TimePeriod = "weekly" | "monthly" | "all";

interface CollectorStats {
  id: string;
  name: string;
  profilePicture?: string;
  completedPickups: number;
  averageRating: number;
  totalRatings: number;
  collectorType?: string;
  transportCategory?: string;
}

interface UserData {
  id: string;
  fullName: string;
  profilePicture?: string;
  collectorType?: string;
  transportCategory?: string;
  role: string;
}

const BADGE_COLORS = {
  1: { bg: "#FFD700", text: "#7C5800" }, // Gold
  2: { bg: "#C0C0C0", text: "#4A4A4A" }, // Silver
  3: { bg: "#CD7F32", text: "#5C3A1D" }, // Bronze
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const { pickups } = usePickups();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("weekly");
  const [usersData, setUsersData] = useState<Record<string, UserData>>({});

  // Load users data to get names and profile pictures
  useEffect(() => {
    loadUsersData();
  }, []);

  const loadUsersData = async () => {
    try {
      const usersDb = await AsyncStorage.getItem("@ltc_users_db");
      if (usersDb) {
        const users = JSON.parse(usersDb);
        setUsersData(users);
      }
    } catch (error) {
      console.error("Failed to load users data:", error);
    }
  };

  // Filter pickups by time period
  const filteredPickups = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completedPickups = pickups.filter((p) => p.status === "completed");

    return completedPickups.filter((pickup) => {
      const completedDate = new Date(pickup.completedAt || pickup.createdAt);
      switch (selectedPeriod) {
        case "weekly":
          return completedDate >= startOfWeek;
        case "monthly":
          return completedDate >= startOfMonth;
        case "all":
        default:
          return true;
      }
    });
  }, [pickups, selectedPeriod]);

  // Calculate collector statistics and rankings
  const leaderboard = useMemo(() => {
    const collectorMap = new Map<string, CollectorStats>();

    filteredPickups.forEach((pickup) => {
      if (!pickup.collectorId) return;

      const existing = collectorMap.get(pickup.collectorId);
      const userData = usersData[pickup.collectorId];

      if (existing) {
        existing.completedPickups += 1;
        if (pickup.rating) {
          existing.averageRating =
            (existing.averageRating * existing.totalRatings + pickup.rating) /
            (existing.totalRatings + 1);
          existing.totalRatings += 1;
        }
      } else {
        collectorMap.set(pickup.collectorId, {
          id: pickup.collectorId,
          name: userData?.fullName || pickup.collectorName || "Unknown Collector",
          profilePicture: userData?.profilePicture,
          completedPickups: 1,
          averageRating: pickup.rating || 0,
          totalRatings: pickup.rating ? 1 : 0,
          collectorType: userData?.collectorType,
          transportCategory: userData?.transportCategory,
        });
      }
    });

    // Sort by completed pickups (primary) and rating (secondary)
    return Array.from(collectorMap.values()).sort((a, b) => {
      if (b.completedPickups !== a.completedPickups) {
        return b.completedPickups - a.completedPickups;
      }
      return b.averageRating - a.averageRating;
    });
  }, [filteredPickups, usersData]);

  const periodLabels: Record<TimePeriod, string> = {
    weekly: "This Week",
    monthly: "This Month",
    all: "All Time",
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getCollectorTypeIcon = (type?: string) => {
    switch (type) {
      case "foot":
        return "directions-walk";
      case "vehicle":
        return "local-shipping";
      default:
        return "person";
    }
  };

  const totalPickups = filteredPickups.length;
  const totalCollectors = leaderboard.length;

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
            <Text className="text-2xl font-bold text-foreground">Leaderboard</Text>
            <Text className="text-muted">Top performing collectors</Text>
          </View>
          <View className="w-12 h-12 rounded-full bg-yellow-100 items-center justify-center">
            <MaterialIcons name="emoji-events" size={28} color="#F59E0B" />
          </View>
        </View>

        {/* Period Selector */}
        <View className="px-6 mb-6">
          <View className="flex-row gap-2">
            {(["weekly", "monthly", "all"] as TimePeriod[]).map((period) => (
              <TouchableOpacity
                key={period}
                onPress={() => setSelectedPeriod(period)}
                className={`flex-1 py-3 rounded-xl items-center ${
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
        </View>

        {/* Stats Summary */}
        <View className="px-6 mb-6">
          <View className="flex-row gap-4">
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="local-shipping" size={20} color="#22C55E" />
                <Text className="text-muted ml-2 text-sm">Total Pickups</Text>
              </View>
              <Text className="text-2xl font-bold text-foreground">{totalPickups}</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="people" size={20} color="#3B82F6" />
                <Text className="text-muted ml-2 text-sm">Collectors</Text>
              </View>
              <Text className="text-2xl font-bold text-foreground">{totalCollectors}</Text>
            </View>
          </View>
        </View>

        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <View className="px-6 mb-6">
            <View className="bg-gradient-to-b from-yellow-50 to-yellow-100 rounded-2xl p-6 border border-yellow-200">
              <Text className="text-lg font-semibold text-yellow-800 text-center mb-4">
                🏆 Top Performers
              </Text>
              <View className="flex-row justify-center items-end">
                {/* Second Place */}
                <View className="items-center mx-2">
                  <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center mb-2 border-2 border-gray-300">
                    {leaderboard[1]?.profilePicture ? (
                      <Image
                        source={{ uri: leaderboard[1].profilePicture }}
                        className="w-16 h-16 rounded-full"
                      />
                    ) : (
                      <MaterialIcons name="person" size={32} color="#6B7280" />
                    )}
                  </View>
                  <Text className="text-2xl">🥈</Text>
                  <Text className="text-sm font-medium text-foreground text-center" numberOfLines={1}>
                    {leaderboard[1]?.name.split(" ")[0]}
                  </Text>
                  <Text className="text-xs text-muted">{leaderboard[1]?.completedPickups} pickups</Text>
                </View>

                {/* First Place */}
                <View className="items-center mx-2 -mt-4">
                  <View className="w-20 h-20 rounded-full bg-yellow-200 items-center justify-center mb-2 border-4 border-yellow-400">
                    {leaderboard[0]?.profilePicture ? (
                      <Image
                        source={{ uri: leaderboard[0].profilePicture }}
                        className="w-20 h-20 rounded-full"
                      />
                    ) : (
                      <MaterialIcons name="person" size={40} color="#F59E0B" />
                    )}
                  </View>
                  <Text className="text-3xl">🥇</Text>
                  <Text className="text-base font-bold text-foreground text-center" numberOfLines={1}>
                    {leaderboard[0]?.name.split(" ")[0]}
                  </Text>
                  <Text className="text-sm text-primary font-medium">
                    {leaderboard[0]?.completedPickups} pickups
                  </Text>
                </View>

                {/* Third Place */}
                <View className="items-center mx-2">
                  <View className="w-16 h-16 rounded-full bg-orange-100 items-center justify-center mb-2 border-2 border-orange-300">
                    {leaderboard[2]?.profilePicture ? (
                      <Image
                        source={{ uri: leaderboard[2].profilePicture }}
                        className="w-16 h-16 rounded-full"
                      />
                    ) : (
                      <MaterialIcons name="person" size={32} color="#CD7F32" />
                    )}
                  </View>
                  <Text className="text-2xl">🥉</Text>
                  <Text className="text-sm font-medium text-foreground text-center" numberOfLines={1}>
                    {leaderboard[2]?.name.split(" ")[0]}
                  </Text>
                  <Text className="text-xs text-muted">{leaderboard[2]?.completedPickups} pickups</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Full Rankings */}
        <View className="px-6">
          <Text className="text-lg font-semibold text-foreground mb-4">
            Full Rankings
          </Text>
          {leaderboard.length === 0 ? (
            <View className="bg-surface rounded-xl p-8 border border-border items-center">
              <MaterialIcons name="emoji-events" size={48} color="#9BA1A6" />
              <Text className="text-muted mt-4 text-center">
                No completed pickups in this period yet.
              </Text>
              <Text className="text-muted text-sm text-center mt-1">
                Collectors will appear here once they complete pickups.
              </Text>
            </View>
          ) : (
            leaderboard.map((collector, index) => {
              const rank = index + 1;
              const isTopThree = rank <= 3;
              const badgeColor = BADGE_COLORS[rank as keyof typeof BADGE_COLORS];

              return (
                <View
                  key={collector.id}
                  className={`bg-surface rounded-xl p-4 border mb-3 ${
                    isTopThree ? "border-yellow-300" : "border-border"
                  }`}
                >
                  <View className="flex-row items-center">
                    {/* Rank */}
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center mr-3"
                      style={{
                        backgroundColor: badgeColor?.bg || "#F3F4F6",
                      }}
                    >
                      {isTopThree ? (
                        <Text className="text-xl">{getRankBadge(rank)}</Text>
                      ) : (
                        <Text className="font-bold text-muted">{rank}</Text>
                      )}
                    </View>

                    {/* Profile Picture */}
                    <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mr-3 border border-border">
                      {collector.profilePicture ? (
                        <Image
                          source={{ uri: collector.profilePicture }}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <MaterialIcons
                          name={getCollectorTypeIcon(collector.collectorType)}
                          size={24}
                          color="#6B7280"
                        />
                      )}
                    </View>

                    {/* Info */}
                    <View className="flex-1">
                      <Text className="font-semibold text-foreground" numberOfLines={1}>
                        {collector.name}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        {collector.totalRatings > 0 && (
                          <View className="flex-row items-center mr-3">
                            <MaterialIcons name="star" size={14} color="#F59E0B" />
                            <Text className="text-xs text-muted ml-1">
                              {collector.averageRating.toFixed(1)} ({collector.totalRatings})
                            </Text>
                          </View>
                        )}
                        {collector.collectorType && (
                          <View className="flex-row items-center">
                            <MaterialIcons
                              name={getCollectorTypeIcon(collector.collectorType)}
                              size={12}
                              color="#6B7280"
                            />
                            <Text className="text-xs text-muted ml-1 capitalize">
                              {collector.collectorType}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Stats */}
                    <View className="items-end">
                      <Text className="text-lg font-bold text-primary">
                        {collector.completedPickups}
                      </Text>
                      <Text className="text-xs text-muted">pickups</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Legend */}
        <View className="px-6 mt-6">
          <View className="bg-surface rounded-xl p-4 border border-border">
            <Text className="text-sm font-medium text-foreground mb-3">
              How Rankings Work
            </Text>
            <View className="flex-row items-start mb-2">
              <MaterialIcons name="check-circle" size={16} color="#22C55E" />
              <Text className="text-xs text-muted ml-2 flex-1">
                Collectors are ranked by total completed pickups
              </Text>
            </View>
            <View className="flex-row items-start mb-2">
              <MaterialIcons name="star" size={16} color="#F59E0B" />
              <Text className="text-xs text-muted ml-2 flex-1">
                Customer ratings are used as a tiebreaker
              </Text>
            </View>
            <View className="flex-row items-start">
              <MaterialIcons name="emoji-events" size={16} color="#8B5CF6" />
              <Text className="text-xs text-muted ml-2 flex-1">
                Top performers earn recognition badges
              </Text>
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
    padding: _rs.sp(8),
  },
});
