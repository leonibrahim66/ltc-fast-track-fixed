import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface DriverRating {
  id: string;
  bookingId: string;
  driverName: string;
  rating: number;
  review: string;
  createdAt: string;
}

interface RatingStats {
  average: number;
  total: number;
  distribution: number[];
}

export default function DriverReviewsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ driverName?: string }>();
  const [ratings, setRatings] = useState<DriverRating[]>([]);
  const [stats, setStats] = useState<RatingStats>({ average: 0, total: 0, distribution: [0, 0, 0, 0, 0] });
  const [refreshing, setRefreshing] = useState(false);

  const loadRatings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("carrier_driver_ratings");
      const allRatings: DriverRating[] = stored ? JSON.parse(stored) : [];

      // Filter by driver if specified
      const filtered = params.driverName
        ? allRatings.filter((r) => r.driverName === params.driverName)
        : allRatings;

      // Calculate stats
      const total = filtered.length;
      const average = total > 0 ? filtered.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      const distribution = [0, 0, 0, 0, 0];
      filtered.forEach((r) => {
        if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++;
      });

      setRatings(filtered);
      setStats({ average: Math.round(average * 10) / 10, total, distribution });
    } catch (e) {
      console.error("Error loading ratings:", e);
    }
  }, [params.driverName]);

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRatings();
    setRefreshing(false);
  }, [loadRatings]);

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  const renderRating = ({ item }: { item: DriverRating }) => (
    <View style={styles.reviewCard}>
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View style={styles.reviewerAvatar}>
            <MaterialIcons name="person" size={16} color="#22C55E" />
          </View>
          <Text className="text-sm font-semibold text-foreground ml-2">Customer</Text>
        </View>
        <Text className="text-xs text-muted">{getTimeAgo(item.createdAt)}</Text>
      </View>
      <View className="flex-row mb-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <MaterialIcons
            key={star}
            name="star"
            size={16}
            color={star <= item.rating ? "#FBBF24" : "#4B5563"}
          />
        ))}
      </View>
      {item.review ? (
        <Text className="text-sm text-foreground leading-relaxed">{item.review}</Text>
      ) : (
        <Text className="text-xs text-muted italic">No written review</Text>
      )}
      <Text className="text-xs text-muted mt-2">
        Booking #{item.bookingId.slice(-6).toUpperCase()}
      </Text>
    </View>
  );

  return (
    <ScreenContainer>
      <FlatList
        data={ratings}
        keyExtractor={(item) => item.id}
        renderItem={renderRating}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View className="px-6 pt-4 pb-3 flex-row items-center">
              <TouchableOpacity onPress={() => router.back()} className="mr-3">
                <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
              </TouchableOpacity>
              <Text className="text-xl font-bold text-foreground">
                {params.driverName ? `${params.driverName}'s Reviews` : "Driver Reviews"}
              </Text>
            </View>

            {/* Rating Summary */}
            <View className="px-6 mb-4">
              <View style={styles.summaryCard}>
                <View className="flex-row items-center">
                  <View className="items-center mr-6">
                    <Text style={{ color: "#FBBF24", fontSize: 48, fontWeight: "800" }}>
                      {stats.average.toFixed(1)}
                    </Text>
                    <View className="flex-row mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <MaterialIcons
                          key={star}
                          name="star"
                          size={16}
                          color={star <= Math.round(stats.average) ? "#FBBF24" : "#4B5563"}
                        />
                      ))}
                    </View>
                    <Text className="text-muted text-xs mt-1">{stats.total} ratings</Text>
                  </View>

                  {/* Distribution */}
                  <View className="flex-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = stats.distribution[star - 1];
                      const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                      return (
                        <View key={star} className="flex-row items-center mb-1.5">
                          <Text style={{ color: "#9BA1A6", fontSize: 11, width: 12 }}>{star}</Text>
                          <MaterialIcons name="star" size={10} color="#FBBF24" />
                          <View
                            style={{
                              flex: 1,
                              height: 6,
                              backgroundColor: "rgba(255,255,255,0.06)",
                              borderRadius: 3,
                              marginHorizontal: 6,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                backgroundColor: "#FBBF24",
                                borderRadius: 3,
                              }}
                            />
                          </View>
                          <Text style={{ color: "#9BA1A6", fontSize: 10, width: 20 }}>{count}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            <View className="px-6 mb-2">
              <Text className="text-xs text-muted">ALL REVIEWS</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <MaterialIcons name="rate-review" size={48} color="#4B5563" />
            <Text className="text-muted mt-3 text-sm">No reviews yet</Text>
            <Text className="text-muted text-xs mt-1">Ratings will appear after deliveries</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: "rgba(251,191,36,0.08)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
    borderRadius: _rs.s(20),
    padding: _rs.sp(20),
  },
  reviewCard: {
    marginHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(8),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: _rs.s(14),
    padding: _rs.sp(14),
  },
  reviewerAvatar: {
    width: _rs.s(28),
    height: _rs.s(28),
    borderRadius: _rs.s(14),
    backgroundColor: "rgba(34,197,94,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
