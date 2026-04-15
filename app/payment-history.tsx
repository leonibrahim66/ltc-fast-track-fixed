import { useState, useMemo } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
// Image import available if needed
// import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePayments, Payment, PaymentStatus } from "@/lib/payments-context";
import { APP_CONFIG } from "@/constants/app";

import { getStaticResponsive } from "@/hooks/use-responsive";
type FilterStatus = "all" | PaymentStatus;

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  pending: { label: "Pending", color: "#F59E0B", bgColor: "bg-warning/20", icon: "schedule" },
  confirmed: { label: "Confirmed", color: "#22C55E", bgColor: "bg-success/20", icon: "check-circle" },
  failed: { label: "Failed", color: "#EF4444", bgColor: "bg-error/20", icon: "cancel" },
  cancelled: { label: "Cancelled", color: "#6B7280", bgColor: "bg-muted/20", icon: "block" },
};

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { getPaymentsByUser } = usePayments();
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [refreshing, setRefreshing] = useState(false);

  const payments = useMemo(() => {
    const userPayments = getPaymentsByUser(user?.id || "");
    if (filter === "all") return userPayments;
    return userPayments.filter((p) => p.status === filter);
  }, [getPaymentsByUser, user?.id, filter]);

  const onRefresh = () => {
    setRefreshing(true);
    // payments context is reactive via StorageEventBus — just toggle refresh indicator
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderPaymentItem = ({ item }: { item: Payment }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    
    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        {/* Header Row */}
        <View className="flex-row items-center justify-between mb-3">
          <View className={`px-3 py-1 rounded-full ${statusConfig.bgColor}`}>
            <View className="flex-row items-center">
              <MaterialIcons 
                name={statusConfig.icon as any} 
                size={14} 
                color={statusConfig.color} 
              />
              <Text 
                className="text-xs font-semibold ml-1"
                style={{ color: statusConfig.color }}
              >
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <Text className="text-xs text-muted">
            {formatDate(item.createdAt)}
          </Text>
        </View>

        {/* Amount and Method */}
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-2xl font-bold text-foreground">
            {APP_CONFIG.currencySymbol}{item.amount.toLocaleString()}
          </Text>
          <View className="flex-row items-center">
            <MaterialIcons name="phone-android" size={16} color="#6B7280" />
            <Text className="text-muted ml-1">{item.methodName}</Text>
          </View>
        </View>

        {/* Description */}
        <Text className="text-foreground mb-2">{item.description}</Text>

        {/* Reference */}
        <View className="bg-background rounded-lg p-3 mb-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted">Reference</Text>
            <Text className="text-sm font-mono text-foreground">{item.reference}</Text>
          </View>
          {item.transactionId && (
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-xs text-muted">Transaction ID</Text>
              <Text className="text-sm font-mono text-foreground">{item.transactionId}</Text>
            </View>
          )}
        </View>

        {/* Screenshot Indicator */}
        {item.screenshotUri && (
          <View className="flex-row items-center mt-2">
            <MaterialIcons name="image" size={16} color="#22C55E" />
            <Text className="text-primary text-sm ml-1">Screenshot attached</Text>
          </View>
        )}

        {/* View Receipt Button */}
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/payment-receipt" as any, params: { paymentId: item.id } })}
          className="mt-3 bg-primary/10 py-2 rounded-lg flex-row items-center justify-center"
        >
          <MaterialIcons name="receipt" size={18} color="#22C55E" />
          <Text className="text-primary font-medium ml-2">View Receipt</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
        <MaterialIcons name="receipt-long" size={40} color="#9CA3AF" />
      </View>
      <Text className="text-xl font-semibold text-foreground mb-2">
        No Payments Yet
      </Text>
      <Text className="text-muted text-center px-8">
        {filter === "all"
          ? "Your payment history will appear here once you make a payment."
          : `No ${filter} payments found.`}
      </Text>
    </View>
  );

  const filters: { key: FilterStatus; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "confirmed", label: "Confirmed" },
    { key: "failed", label: "Failed" },
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground ml-4">
            Payment History
          </Text>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row mb-4">
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-full mr-2 ${
                filter === f.key ? "bg-primary" : "bg-surface"
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  filter === f.key ? "text-white" : "text-muted"
                }`}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Stats */}
        {payments.length > 0 && (
          <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm text-muted">Total Payments</Text>
                <Text className="text-2xl font-bold text-foreground">
                  {payments.length}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-sm text-muted">Total Amount</Text>
                <Text className="text-2xl font-bold text-primary">
                  {APP_CONFIG.currencySymbol}
                  {payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Payment List */}
      <FlatList
        data={payments}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ 
          paddingHorizontal: 24, 
          paddingBottom: 100,
          flexGrow: payments.length === 0 ? 1 : undefined,
        }}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
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
