import { useState, useMemo } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePayments } from "@/lib/payments-context";
import { usePickups } from "@/lib/pickups-context";
import { APP_CONFIG } from "@/constants/app";

import { getStaticResponsive } from "@/hooks/use-responsive";
// Chart dimensions
const _SCREEN_WIDTH = Dimensions.get("window").width;

type TimeRange = "week" | "month" | "year";

interface ChartData {
  label: string;
  value: number;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user: _user } = useAuth();
  const { payments } = usePayments();
  const { pickups } = usePickups();
  const [timeRange, setTimeRange] = useState<TimeRange>("month");

  // Filter payments by time range
  const filteredPayments = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    return payments.filter((p) => new Date(p.createdAt) >= startDate);
  }, [payments, timeRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    const confirmedPayments = filteredPayments.filter((p) => p.status === "confirmed");
    const totalAmount = confirmedPayments.reduce((sum, p) => sum + p.amount, 0);
    const averageAmount = confirmedPayments.length > 0 
      ? totalAmount / confirmedPayments.length 
      : 0;
    const pendingCount = filteredPayments.filter((p) => p.status === "pending").length;
    const failedCount = filteredPayments.filter((p) => p.status === "failed").length;

    return {
      totalAmount,
      averageAmount,
      confirmedCount: confirmedPayments.length,
      pendingCount,
      failedCount,
      totalCount: filteredPayments.length,
    };
  }, [filteredPayments]);

  // Payment method breakdown
  const methodBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; amount: number }> = {};
    
    filteredPayments
      .filter((p) => p.status === "confirmed")
      .forEach((p) => {
        const method = p.methodName || "Unknown";
        if (!breakdown[method]) {
          breakdown[method] = { count: 0, amount: 0 };
        }
        breakdown[method].count++;
        breakdown[method].amount += p.amount;
      });

    return Object.entries(breakdown)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredPayments]);

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const months: ChartData[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      
      const monthPayments = payments.filter((p) => {
        const date = new Date(p.createdAt);
        return date >= monthDate && date <= monthEnd && p.status === "confirmed";
      });

      const total = monthPayments.reduce((sum, p) => sum + p.amount, 0);
      
      months.push({
        label: monthDate.toLocaleDateString("en-US", { month: "short" }),
        value: total,
      });
    }

    return months;
  }, [payments]);

  // Pickup statistics
  const pickupStats = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const filtered = pickups.filter((p) => new Date(p.createdAt) >= startDate);
    const completed = filtered.filter((p) => p.status === "completed");
    const avgRating = completed.filter((p) => p.rating).reduce((sum, p, _, arr) => 
      sum + (p.rating || 0) / arr.length, 0
    );

    return {
      total: filtered.length,
      completed: completed.length,
      pending: filtered.filter((p) => p.status === "pending").length,
      avgRating: avgRating || 0,
    };
  }, [pickups, timeRange]);

  const maxTrendValue = Math.max(...monthlyTrend.map((d) => d.value), 1);

  const renderBarChart = () => {
    return (
      <View className="mt-4">
        <View className="flex-row justify-between items-end" style={{ height: 150 }}>
          {monthlyTrend.map((item, index) => {
            const barHeight = (item.value / maxTrendValue) * 130 || 4;
            return (
              <View key={index} className="items-center flex-1 mx-1">
                <Text className="text-xs text-muted mb-1">
                  {item.value > 0 ? `${(item.value / 1000).toFixed(0)}K` : "0"}
                </Text>
                <View
                  className="bg-primary rounded-t-md w-full"
                  style={{ height: barHeight, minHeight: 4 }}
                />
                <Text className="text-xs text-muted mt-2">{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-4">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground ml-4">
              Analytics
            </Text>
          </View>

          {/* Time Range Selector */}
          <View className="flex-row bg-surface rounded-xl p-1">
            {(["week", "month", "year"] as TimeRange[]).map((range) => (
              <TouchableOpacity
                key={range}
                onPress={() => setTimeRange(range)}
                className={`flex-1 py-2 rounded-lg ${
                  timeRange === range ? "bg-primary" : ""
                }`}
              >
                <Text
                  className={`text-center font-medium capitalize ${
                    timeRange === range ? "text-white" : "text-muted"
                  }`}
                >
                  {range === "week" ? "This Week" : range === "month" ? "This Month" : "This Year"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Revenue Stats */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-muted mb-3 uppercase">
            Revenue Overview
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-primary/10 rounded-2xl p-4 border border-primary/20">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="account-balance-wallet" size={20} color="#22C55E" />
                <Text className="text-muted text-sm ml-2">Total Revenue</Text>
              </View>
              <Text className="text-2xl font-bold text-foreground">
                {APP_CONFIG.currencySymbol}{stats.totalAmount.toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 bg-surface rounded-2xl p-4 border border-border">
              <View className="flex-row items-center mb-2">
                <MaterialIcons name="trending-up" size={20} color="#3B82F6" />
                <Text className="text-muted text-sm ml-2">Avg. Payment</Text>
              </View>
              <Text className="text-2xl font-bold text-foreground">
                {APP_CONFIG.currencySymbol}{Math.round(stats.averageAmount).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Status Cards */}
        <View className="px-6 mb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-success/10 rounded-xl p-3 border border-success/20">
              <Text className="text-success text-2xl font-bold">{stats.confirmedCount}</Text>
              <Text className="text-muted text-sm">Confirmed</Text>
            </View>
            <View className="flex-1 bg-warning/10 rounded-xl p-3 border border-warning/20">
              <Text className="text-warning text-2xl font-bold">{stats.pendingCount}</Text>
              <Text className="text-muted text-sm">Pending</Text>
            </View>
            <View className="flex-1 bg-error/10 rounded-xl p-3 border border-error/20">
              <Text className="text-error text-2xl font-bold">{stats.failedCount}</Text>
              <Text className="text-muted text-sm">Failed</Text>
            </View>
          </View>
        </View>

        {/* Monthly Trend Chart */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-muted mb-3 uppercase">
            6-Month Trend
          </Text>
          <View className="bg-surface rounded-2xl p-4 border border-border">
            {renderBarChart()}
          </View>
        </View>

        {/* Payment Method Breakdown */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-muted mb-3 uppercase">
            Payment Methods
          </Text>
          <View className="bg-surface rounded-2xl border border-border overflow-hidden">
            {methodBreakdown.length > 0 ? (
              methodBreakdown.map((method, index) => (
                <View
                  key={method.name}
                  className={`flex-row items-center justify-between p-4 ${
                    index < methodBreakdown.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                      <MaterialIcons name="phone-android" size={20} color="#22C55E" />
                    </View>
                    <View>
                      <Text className="text-foreground font-medium">{method.name}</Text>
                      <Text className="text-muted text-sm">{method.count} payments</Text>
                    </View>
                  </View>
                  <Text className="text-foreground font-semibold">
                    {APP_CONFIG.currencySymbol}{method.amount.toLocaleString()}
                  </Text>
                </View>
              ))
            ) : (
              <View className="p-6 items-center">
                <Text className="text-muted">No payment data available</Text>
              </View>
            )}
          </View>
        </View>

        {/* Pickup Statistics */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-medium text-muted mb-3 uppercase">
            Pickup Statistics
          </Text>
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <View className="flex-row flex-wrap">
              <View className="w-1/2 p-2">
                <View className="flex-row items-center mb-1">
                  <MaterialIcons name="local-shipping" size={18} color="#6B7280" />
                  <Text className="text-muted text-sm ml-2">Total Pickups</Text>
                </View>
                <Text className="text-xl font-bold text-foreground">{pickupStats.total}</Text>
              </View>
              <View className="w-1/2 p-2">
                <View className="flex-row items-center mb-1">
                  <MaterialIcons name="check-circle" size={18} color="#22C55E" />
                  <Text className="text-muted text-sm ml-2">Completed</Text>
                </View>
                <Text className="text-xl font-bold text-foreground">{pickupStats.completed}</Text>
              </View>
              <View className="w-1/2 p-2">
                <View className="flex-row items-center mb-1">
                  <MaterialIcons name="schedule" size={18} color="#F59E0B" />
                  <Text className="text-muted text-sm ml-2">Pending</Text>
                </View>
                <Text className="text-xl font-bold text-foreground">{pickupStats.pending}</Text>
              </View>
              <View className="w-1/2 p-2">
                <View className="flex-row items-center mb-1">
                  <MaterialIcons name="star" size={18} color="#F59E0B" />
                  <Text className="text-muted text-sm ml-2">Avg. Rating</Text>
                </View>
                <Text className="text-xl font-bold text-foreground">
                  {pickupStats.avgRating > 0 ? pickupStats.avgRating.toFixed(1) : "N/A"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Export Button */}
        <View className="px-6">
          <TouchableOpacity
            className="bg-primary/10 rounded-xl p-4 flex-row items-center justify-center"
            onPress={() => {
              // Future: Export functionality
              alert("Export feature coming soon!");
            }}
          >
            <MaterialIcons name="download" size={20} color="#22C55E" />
            <Text className="text-primary font-medium ml-2">Export Report</Text>
          </TouchableOpacity>
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
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
});
