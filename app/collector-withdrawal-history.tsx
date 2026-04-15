import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
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
import type { WithdrawalRequest } from "@/types/commission";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function CollectorWithdrawalHistoryScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "paid" | "rejected">("all");

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async () => {
    try {
      const stored = await AsyncStorage.getItem("collector_withdrawal_requests");
      const allWithdrawals: WithdrawalRequest[] = stored ? JSON.parse(stored) : [];
      
      // Filter by current user
      const userWithdrawals = allWithdrawals.filter((w) => w.collectorId === user?.id);
      setWithdrawals(userWithdrawals);
    } catch (e) {
      console.error("Error loading withdrawals:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWithdrawals();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "approved":
        return "#3B82F6";
      case "paid":
        return "#10B981";
      case "rejected":
        return "#EF4444";
      default:
        return "#9BA1A6";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "hourglass-empty";
      case "approved":
        return "check-circle";
      case "paid":
        return "done-all";
      case "rejected":
        return "cancel";
      default:
        return "help";
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredWithdrawals = filter === "all"
    ? withdrawals
    : withdrawals.filter((w) => w.status === filter);

  const filterOptions: Array<{ key: typeof filter; label: string }> = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "paid", label: "Paid" },
    { key: "rejected", label: "Rejected" },
  ];

  const renderWithdrawal = ({ item }: { item: WithdrawalRequest }) => (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.statusIcon,
            { backgroundColor: `${getStatusColor(item.status)}15` },
          ]}
        >
          <MaterialIcons
            name={getStatusIcon(item.status) as any}
            size={20}
            color={getStatusColor(item.status)}
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.amount, { color: colors.foreground }]}>
            K{item.amount.toFixed(2)}
          </Text>
          <Text style={[styles.date, { color: colors.muted }]}>
            {formatDate(item.requestDate)}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${getStatusColor(item.status)}15` },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: getStatusColor(item.status) },
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <MaterialIcons
            name={item.paymentMethod === "mobile_money" ? "phone-android" : "account-balance"}
            size={16}
            color={colors.muted}
          />
          <Text style={[styles.detailText, { color: colors.muted }]}>
            {item.paymentMethod === "mobile_money"
              ? `${item.accountDetails.provider} ${item.accountDetails.mobileNumber}`
              : `${item.accountDetails.bankName} - ${item.accountDetails.accountNumber}`}
          </Text>
        </View>

        {item.status === "approved" && item.approvedDate && (
          <View style={styles.detailRow}>
            <MaterialIcons name="check" size={16} color="#3B82F6" />
            <Text style={[styles.detailText, { color: "#3B82F6" }]}>
              Approved on {formatDate(item.approvedDate)}
            </Text>
          </View>
        )}

        {item.status === "paid" && item.paidDate && (
          <View style={styles.detailRow}>
            <MaterialIcons name="done-all" size={16} color="#10B981" />
            <Text style={[styles.detailText, { color: "#10B981" }]}>
              Paid on {formatDate(item.paidDate)}
            </Text>
          </View>
        )}

        {item.status === "rejected" && item.rejectionReason && (
          <View style={styles.detailRow}>
            <MaterialIcons name="info" size={16} color="#EF4444" />
            <Text style={[styles.detailText, { color: "#EF4444" }]}>
              {item.rejectionReason}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdrawal History</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              onPress={() => setFilter(option.key)}
              style={[
                styles.filterButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                filter === option.key && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  { color: colors.muted },
                  filter === option.key && { color: "#FFFFFF" },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Withdrawals List */}
      <FlatList
        data={filteredWithdrawals}
        keyExtractor={(item) => item.id}
        renderItem={renderWithdrawal}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="receipt-long" size={64} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No withdrawal requests yet
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/collector-withdrawal-request" as any)}
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.emptyButtonText}>Request Withdrawal</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
    marginBottom: _rs.sp(16),
  },
  backButton: {
    padding: _rs.sp(4),
  },
  headerTitle: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  filterSection: {
    marginBottom: _rs.sp(16),
  },
  filterScroll: {
    paddingHorizontal: _rs.sp(16),
    gap: _rs.sp(12),
  },
  filterButton: {
    paddingHorizontal: _rs.sp(20),
    paddingVertical: _rs.sp(10),
    borderRadius: _rs.s(20),
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
  },
  card: {
    marginHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(12),
    padding: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: _rs.sp(12),
  },
  statusIcon: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    justifyContent: "center",
    alignItems: "center",
    marginRight: _rs.sp(12),
  },
  cardInfo: {
    flex: 1,
  },
  amount: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    marginBottom: _rs.sp(2),
  },
  date: {
    fontSize: _rs.fs(13),
  },
  statusBadge: {
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
    borderRadius: _rs.s(12),
  },
  statusText: {
    fontSize: _rs.fs(11),
    fontWeight: "700",
  },
  cardDetails: {
    gap: _rs.sp(8),
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(8),
  },
  detailText: {
    fontSize: _rs.fs(13),
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: _rs.sp(60),
    paddingHorizontal: _rs.sp(32),
  },
  emptyText: {
    fontSize: _rs.fs(16),
    marginTop: _rs.sp(16),
    marginBottom: _rs.sp(24),
  },
  emptyButton: {
    paddingHorizontal: _rs.sp(24),
    paddingVertical: _rs.sp(12),
    borderRadius: _rs.s(12),
  },
  emptyButtonText: {
    fontSize: _rs.fs(15),
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
