import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useWithdrawals, WithdrawalStatus } from "@/lib/withdrawals-context";

type FilterStatus = "all" | WithdrawalStatus;

const STATUS_COLORS = {
  pending: { bg: "bg-warning/20", text: "text-warning", label: "Pending" },
  approved: { bg: "bg-primary/20", text: "text-primary", label: "Approved" },
  paid: { bg: "bg-success/20", text: "text-success", label: "Paid" },
  rejected: { bg: "bg-error/20", text: "text-error", label: "Rejected" },
};

const METHOD_LABELS = {
  mtn: { name: "MTN Mobile Money", icon: "📱" },
  airtel: { name: "Airtel Money", icon: "📲" },
  bank: { name: "Bank Transfer", icon: "🏦" },
};

export default function WithdrawalHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getWithdrawalsByUser } = useWithdrawals();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [refreshing, setRefreshing] = useState(false);

  const userWithdrawals = user ? getWithdrawalsByUser(user.id) : [];
  
  const filteredWithdrawals = filter === "all" 
    ? userWithdrawals 
    : userWithdrawals.filter(w => w.status === filter);

  // Calculate totals
  const totalWithdrawn = userWithdrawals
    .filter(w => w.status === "paid")
    .reduce((sum, w) => sum + w.amount, 0);
  
  const pendingAmount = userWithdrawals
    .filter(w => w.status === "pending" || w.status === "approved")
    .reduce((sum, w) => sum + w.amount, 0);

  const onRefresh = () => {
    setRefreshing(true);
    // Data is from context, no async needed
    setRefreshing(false);
  };

  const renderFilterButton = (status: FilterStatus, label: string) => (
    <TouchableOpacity
      onPress={() => setFilter(status)}
      className={`px-4 py-2 rounded-full mr-2 ${
        filter === status ? "bg-primary" : "bg-surface"
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          filter === status ? "text-white" : "text-muted"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderWithdrawal = ({ item }: { item: typeof userWithdrawals[0] }) => {
    const statusInfo = STATUS_COLORS[item.status];
    const methodInfo = METHOD_LABELS[item.method];

    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-foreground font-bold text-lg">
              K{item.amount.toLocaleString()}
            </Text>
            <Text className="text-muted text-sm">
              {new Date(item.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
          <View className={`px-3 py-1 rounded-full ${statusInfo.bg}`}>
            <Text className={`text-xs font-medium ${statusInfo.text}`}>
              {statusInfo.label}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mb-2">
          <Text className="text-xl mr-2">{methodInfo.icon}</Text>
          <View>
            <Text className="text-foreground font-medium">{methodInfo.name}</Text>
            <Text className="text-muted text-sm">{item.accountNumber}</Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center pt-2 border-t border-border">
          <Text className="text-muted text-xs">Ref: {item.reference}</Text>
          {item.processedAt && (
            <Text className="text-muted text-xs">
              Processed: {new Date(item.processedAt).toLocaleDateString()}
            </Text>
          )}
        </View>

        {item.status === "rejected" && item.rejectionReason && (
          <View className="mt-2 bg-error/10 rounded-lg p-2">
            <Text className="text-error text-sm">
              Reason: {item.rejectionReason}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="flex-row items-center mb-4 mt-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-4 p-2 -ml-2"
        >
          <Text className="text-2xl">←</Text>
        </TouchableOpacity>
        <View>
          <Text className="text-2xl font-bold text-foreground">Withdrawal History</Text>
          <Text className="text-muted">Track your withdrawal requests</Text>
        </View>
      </View>

      {/* Summary Cards */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1 bg-success/10 rounded-xl p-4">
          <Text className="text-success text-2xl font-bold">
            K{totalWithdrawn.toLocaleString()}
          </Text>
          <Text className="text-muted text-sm">Total Withdrawn</Text>
        </View>
        <View className="flex-1 bg-warning/10 rounded-xl p-4">
          <Text className="text-warning text-2xl font-bold">
            K{pendingAmount.toLocaleString()}
          </Text>
          <Text className="text-muted text-sm">Pending</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="flex-row mb-4">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { status: "all" as FilterStatus, label: "All" },
            { status: "pending" as FilterStatus, label: "Pending" },
            { status: "approved" as FilterStatus, label: "Approved" },
            { status: "paid" as FilterStatus, label: "Paid" },
            { status: "rejected" as FilterStatus, label: "Rejected" },
          ]}
          keyExtractor={(item) => item.status}
          renderItem={({ item }) => renderFilterButton(item.status, item.label)}
        />
      </View>

      {/* Withdrawals List */}
      {filteredWithdrawals.length === 0 ? (
        <View className="flex-1 items-center justify-center py-12">
          <Text className="text-5xl mb-4">💸</Text>
          <Text className="text-foreground font-semibold text-lg mb-2">
            No Withdrawals Yet
          </Text>
          <Text className="text-muted text-center mb-6">
            {filter === "all"
              ? "Your withdrawal history will appear here"
              : `No ${filter} withdrawals found`}
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/withdraw" as any)}
            className="bg-primary px-6 py-3 rounded-full"
          >
            <Text className="text-white font-semibold">Make a Withdrawal</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredWithdrawals}
          keyExtractor={(item) => item.id}
          renderItem={renderWithdrawal}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </ScreenContainer>
  );
}
