import { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

interface EarningRecord {
  id: string;
  bookingId: string;
  customerName: string;
  amount: number;
  date: string;
  status: "completed" | "pending" | "failed";
  paymentMethod: string;
  distance: number;
  duration: string;
}

interface EarningsStats {
  totalEarnings: number;
  thisMonth: number;
  thisWeek: number;
  pending: number;
  completedTrips: number;
  averagePerTrip: number;
}

export default function EarningsScreen() {
  const router = useRouter();
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    totalEarnings: 0,
    thisMonth: 0,
    thisWeek: 0,
    pending: 0,
    completedTrips: 0,
    averagePerTrip: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "all">("month");

  useEffect(() => {
    loadEarningsData();
  }, []);

  const loadEarningsData = async () => {
    try {
      // Mock data - replace with actual API call
      const mockEarnings: EarningRecord[] = [
        {
          id: "1",
          bookingId: "BK-001",
          customerName: "John Doe",
          amount: 450,
          date: "2026-01-22",
          status: "completed",
          paymentMethod: "Mobile Money",
          distance: 85,
          duration: "3h 30m",
        },
        {
          id: "2",
          bookingId: "BK-002",
          customerName: "Jane Smith",
          amount: 150,
          date: "2026-01-22",
          status: "completed",
          paymentMethod: "Bank Transfer",
          distance: 45,
          duration: "1h 30m",
        },
        {
          id: "3",
          bookingId: "BK-003",
          customerName: "ABC Company",
          amount: 1200,
          date: "2026-01-21",
          status: "completed",
          paymentMethod: "Bank Transfer",
          distance: 120,
          duration: "4h 15m",
        },
        {
          id: "4",
          bookingId: "BK-004",
          customerName: "Tech Solutions",
          amount: 600,
          date: "2026-01-21",
          status: "pending",
          paymentMethod: "Mobile Money",
          distance: 110,
          duration: "3h 45m",
        },
        {
          id: "5",
          bookingId: "BK-005",
          customerName: "Local Store",
          amount: 200,
          date: "2026-01-20",
          status: "completed",
          paymentMethod: "Mobile Money",
          distance: 30,
          duration: "1h 00m",
        },
      ];

      setEarnings(mockEarnings);

      // Calculate stats
      const completed = mockEarnings.filter((e) => e.status === "completed");
      const pending = mockEarnings.filter((e) => e.status === "pending");
      const totalEarnings = completed.reduce((sum, e) => sum + e.amount, 0);
      const thisMonth = completed.reduce((sum, e) => sum + e.amount, 0);
      const thisWeek = completed.reduce((sum, e) => sum + e.amount, 0);

      setStats({
        totalEarnings,
        thisMonth,
        thisWeek,
        pending: pending.reduce((sum, e) => sum + e.amount, 0),
        completedTrips: completed.length,
        averagePerTrip: completed.length > 0 ? Math.round(totalEarnings / completed.length) : 0,
      });
    } catch (error) {
      console.error("Error loading earnings data:", error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEarningsData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#22C55E";
      case "pending":
        return "#F59E0B";
      case "failed":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return "check-circle";
      case "pending":
        return "schedule";
      case "failed":
        return "cancel";
      default:
        return "help";
    }
  };

  const renderEarningCard = ({ item }: { item: EarningRecord }) => (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-muted mb-1">{item.bookingId}</Text>
          <Text className="text-base font-bold text-foreground">{item.customerName}</Text>
        </View>
        <View
          className="rounded-full px-3 py-1 flex-row items-center"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <MaterialIcons
            name={getStatusIcon(item.status) as any}
            size={14}
            color={getStatusColor(item.status)}
          />
          <Text
            className="text-xs font-semibold ml-1 capitalize"
            style={{ color: getStatusColor(item.status) }}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mb-3 pt-3 border-t border-border">
        <View>
          <Text className="text-xs text-muted mb-1">Amount</Text>
          <Text className="text-lg font-bold text-primary">K{item.amount}</Text>
        </View>
        <View>
          <Text className="text-xs text-muted mb-1">Distance</Text>
          <Text className="text-sm font-semibold text-foreground">{item.distance} km</Text>
        </View>
        <View>
          <Text className="text-xs text-muted mb-1">Duration</Text>
          <Text className="text-sm font-semibold text-foreground">{item.duration}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <MaterialIcons name="payment" size={14} color="#9BA1A6" />
          <Text className="text-xs text-muted ml-2">{item.paymentMethod}</Text>
        </View>
        <Text className="text-xs text-muted">{item.date}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Earnings</Text>
            <Text className="text-sm text-muted mt-1">Track your income</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
          >
            <MaterialIcons name="close" size={20} color="#11181C" />
          </TouchableOpacity>
        </View>

        {/* Total Earnings Card */}
        <View className="px-6 mb-6">
          <View className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-white/80 text-sm mb-1">Total Earnings</Text>
                <Text className="text-4xl font-bold text-white">K{stats.totalEarnings}</Text>
              </View>
              <MaterialIcons name="trending-up" size={40} color="#fff" />
            </View>
            <View className="flex-row justify-between pt-4 border-t border-white/20">
              <View>
                <Text className="text-white/80 text-xs">This Month</Text>
                <Text className="text-white font-semibold">K{stats.thisMonth}</Text>
              </View>
              <View>
                <Text className="text-white/80 text-xs">Pending</Text>
                <Text className="text-white font-semibold">K{stats.pending}</Text>
              </View>
              <View>
                <Text className="text-white/80 text-xs">Avg/Trip</Text>
                <Text className="text-white font-semibold">K{stats.averagePerTrip}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View className="px-6 mb-6 flex-row gap-3">
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-xs text-muted mb-2">This Week</Text>
            <Text className="text-2xl font-bold text-foreground">K{stats.thisWeek}</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
            <Text className="text-xs text-muted mb-2">Completed Trips</Text>
            <Text className="text-2xl font-bold text-success">{stats.completedTrips}</Text>
          </View>
        </View>

        {/* Period Filter */}
        <View className="px-6 mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
            {(["week", "month", "all"] as const).map((period) => (
              <TouchableOpacity
                key={period}
                onPress={() => {
                  setSelectedPeriod(period);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`px-4 py-2 rounded-full ${
                  selectedPeriod === period
                    ? "bg-primary"
                    : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`font-semibold text-sm capitalize ${
                    selectedPeriod === period ? "text-white" : "text-foreground"
                  }`}
                >
                  {period === "week" ? "This Week" : period === "month" ? "This Month" : "All Time"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Earnings History */}
        <View className="px-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Recent Earnings ({earnings.length})
          </Text>
          {earnings.length > 0 ? (
            <FlatList
              data={earnings}
              renderItem={renderEarningCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          ) : (
            <View className="items-center justify-center py-12">
              <MaterialIcons name="inbox" size={48} color="#9BA1A6" />
              <Text className="text-muted text-base mt-4">No earnings yet</Text>
            </View>
          )}
        </View>

        {/* Withdrawal Section */}
        <View className="px-6 mt-6">
          <TouchableOpacity className="bg-primary rounded-xl py-3 items-center flex-row justify-center">
            <MaterialIcons name="account-balance-wallet" size={20} color="#fff" />
            <Text className="text-white font-semibold text-base ml-2">Withdraw Earnings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
