import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getStaticResponsive } from "@/hooks/use-responsive";
type PeriodType = "daily" | "weekly" | "monthly";

export default function CollectorEarningsBreakdownScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("monthly");
  const [commissionRate, setCommissionRate] = useState(10); // Default 10%

  // TODO: Replace with real data from backend
  const [earningsData, setEarningsData] = useState({
    totalSubscriptionCollected: 5420.00,
    platformCommission: 542.00,
    netEarnings: 4878.00,
    pendingPayout: 1850.50,
    paidAmount: 3027.50,
  });

  useEffect(() => {
    loadCommissionRate();
  }, []);

  const loadCommissionRate = async () => {
    try {
      const rateStr = await AsyncStorage.getItem("admin_collector_commission_rate");
      if (rateStr) {
        const rate = parseFloat(rateStr);
        setCommissionRate(rate);
        // Recalculate commission with new rate
        const total = earningsData.totalSubscriptionCollected;
        const commission = (total * rate) / 100;
        const net = total - commission;
        setEarningsData({
          ...earningsData,
          platformCommission: commission,
          netEarnings: net,
        });
      }
    } catch (e) {
      console.error("Error loading commission rate:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCommissionRate();
    // TODO: Fetch latest earnings data from backend
    setRefreshing(false);
  };

  const periods: { key: PeriodType; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
  ];

  const breakdownItems = [
    {
      id: "total",
      label: "Total Subscription Collected",
      sublabel: "Zone total from all subscriptions",
      amount: earningsData.totalSubscriptionCollected,
      icon: "attach-money",
      color: "#3B82F6",
      bgColor: "#EFF6FF",
    },
    {
      id: "commission",
      label: "Platform Commission",
      sublabel: `${commissionRate}% deducted by platform`,
      amount: -earningsData.platformCommission,
      icon: "percent",
      color: "#EF4444",
      bgColor: "#FEE2E2",
    },
    {
      id: "net",
      label: "Collector Net Earnings",
      sublabel: "Total - Commission",
      amount: earningsData.netEarnings,
      icon: "account-balance-wallet",
      color: "#10B981",
      bgColor: "#ECFDF5",
    },
  ];

  const payoutItems = [
    {
      id: "pending",
      label: "Pending Payout Balance",
      sublabel: "Available for withdrawal",
      amount: earningsData.pendingPayout,
      icon: "hourglass-empty",
      color: "#F59E0B",
      bgColor: "#FEF3C7",
    },
    {
      id: "paid",
      label: "Paid Amount History",
      sublabel: "Total amount already paid out",
      amount: earningsData.paidAmount,
      icon: "check-circle",
      color: "#8B5CF6",
      bgColor: "#F3E8FF",
    },
  ];

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Earnings Breakdown</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Period Selector */}
        <View style={styles.periodSection}>
          <View style={styles.periodButtons}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period.key}
                onPress={() => setSelectedPeriod(period.key)}
                style={[
                  styles.periodButton,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selectedPeriod === period.key && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    { color: colors.muted },
                    selectedPeriod === period.key && { color: "#FFFFFF" },
                  ]}
                >
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Earnings Breakdown */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Earnings Breakdown
          </Text>
          {breakdownItems.map((item) => (
            <View
              key={item.id}
              style={[
                styles.breakdownCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.breakdownIcon, { backgroundColor: item.bgColor }]}>
                <MaterialIcons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.breakdownInfo}>
                <Text style={[styles.breakdownLabel, { color: colors.foreground }]}>
                  {item.label}
                </Text>
                <Text style={[styles.breakdownSublabel, { color: colors.muted }]}>
                  {item.sublabel}
                </Text>
              </View>
              <Text
                style={[
                  styles.breakdownAmount,
                  {
                    color:
                      item.amount > 0
                        ? item.color
                        : item.amount < 0
                        ? "#EF4444"
                        : colors.foreground,
                  },
                ]}
              >
                {item.amount > 0 ? "+" : ""}K{Math.abs(item.amount).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Calculation Formula */}
        <View style={styles.section}>
          <View
            style={[
              styles.formulaCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialIcons name="calculate" size={20} color={colors.primary} />
            <Text style={[styles.formulaText, { color: colors.muted }]}>
              Net Earnings = Total Collected - ({commissionRate}% × Total)
            </Text>
          </View>
        </View>

        {/* Payout Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Payout Status
          </Text>
          {payoutItems.map((item) => (
            <View
              key={item.id}
              style={[
                styles.breakdownCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.breakdownIcon, { backgroundColor: item.bgColor }]}>
                <MaterialIcons name={item.icon as any} size={24} color={item.color} />
              </View>
              <View style={styles.breakdownInfo}>
                <Text style={[styles.breakdownLabel, { color: colors.foreground }]}>
                  {item.label}
                </Text>
                <Text style={[styles.breakdownSublabel, { color: colors.muted }]}>
                  {item.sublabel}
                </Text>
              </View>
              <Text style={[styles.breakdownAmount, { color: item.color }]}>
                K{item.amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            onPress={() => router.push("/collector-withdrawal-request" as any)}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <MaterialIcons name="arrow-upward" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Request Withdrawal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/collector-withdrawal-history" as any)}
            style={[
              styles.actionButton,
              { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <MaterialIcons name="history" size={20} color={colors.foreground} />
            <Text style={[styles.actionButtonText, { color: colors.foreground }]}>
              Withdrawal History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Commission Info */}
        <View style={styles.section}>
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <MaterialIcons name="info" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.muted }]}>
              Commission rate is set by platform admin and may change. Current rate: {commissionRate}%
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(20),
    paddingTop: _rs.sp(16),
    borderBottomLeftRadius: _rs.s(24),
    borderBottomRightRadius: _rs.s(24),
    marginBottom: _rs.sp(20),
  },
  backButton: {
    padding: _rs.sp(4),
  },
  headerTitle: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  periodSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
  },
  periodButtons: {
    flexDirection: "row",
    gap: _rs.sp(12),
  },
  periodButton: {
    flex: 1,
    padding: _rs.sp(12),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    alignItems: "center",
  },
  periodButtonText: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
  },
  sectionTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    marginBottom: _rs.sp(16),
  },
  breakdownCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    marginBottom: _rs.sp(12),
  },
  breakdownIcon: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(24),
    justifyContent: "center",
    alignItems: "center",
    marginRight: _rs.sp(12),
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: _rs.fs(15),
    fontWeight: "600",
    marginBottom: _rs.sp(2),
  },
  breakdownSublabel: {
    fontSize: _rs.fs(12),
  },
  breakdownAmount: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
  },
  formulaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    gap: _rs.sp(12),
  },
  formulaText: {
    flex: 1,
    fontSize: _rs.fs(13),
    fontWeight: "600",
  },
  actionsSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(20),
    gap: _rs.sp(12),
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    gap: _rs.sp(8),
  },
  actionButtonText: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    color: "#FFFFFF",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    borderWidth: 1,
    gap: _rs.sp(12),
  },
  infoText: {
    flex: 1,
    fontSize: _rs.fs(13),
    lineHeight: _rs.fs(18),
  },
});
