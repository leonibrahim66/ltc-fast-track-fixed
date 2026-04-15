import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { usePayments, Payment, PaymentStatus } from "@/lib/payments-context";
import { APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type StatusFilter = "all" | PaymentStatus;
type TimeFilter = "all" | "today" | "week" | "month";

export default function AdminTransactionsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, stats } = useAdmin();
  const { payments } = usePayments();
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    filterPayments();
  }, [payments, searchQuery, statusFilter, timeFilter]);

  const filterPayments = () => {
    let filtered = [...payments];

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    // Apply time filter
    const now = new Date();
    if (timeFilter === "today") {
      filtered = filtered.filter((p) => {
        const paymentDate = new Date(p.createdAt);
        return paymentDate.toDateString() === now.toDateString();
      });
    } else if (timeFilter === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((p) => new Date(p.createdAt) >= weekAgo);
    } else if (timeFilter === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((p) => new Date(p.createdAt) >= monthAgo);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.id.toLowerCase().includes(query) ||
          p.reference?.toLowerCase().includes(query) ||
          p.method?.toLowerCase().includes(query)
      );
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredPayments(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Payments are auto-loaded from context
    setRefreshing(false);
  };

  const getStatusStyle = (status: PaymentStatus) => {
    switch (status) {
      case "confirmed":
        return { bg: "bg-success/10", text: "text-success", color: "#22C55E" };
      case "pending":
        return { bg: "bg-warning/10", text: "text-warning", color: "#F59E0B" };
      case "failed":
        return { bg: "bg-error/10", text: "text-error", color: "#EF4444" };
      case "cancelled":
        return { bg: "bg-muted/10", text: "text-muted", color: "#9BA1A6" };
      default:
        return { bg: "bg-muted/10", text: "text-muted", color: "#9BA1A6" };
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "mobile_money":
        return "smartphone";
      case "bank_transfer":
        return "account-balance";
      case "card":
        return "credit-card";
      default:
        return "payments";
    }
  };

  // Calculate totals
  const totalAmount = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const completedAmount = filteredPayments
    .filter((p) => p.status === "confirmed")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "confirmed", label: "Confirmed" },
    { id: "pending", label: "Pending" },
    { id: "failed", label: "Failed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const timeFilters: { id: TimeFilter; label: string }[] = [
    { id: "all", label: "All Time" },
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
  ];

  const renderPaymentItem = ({ item }: { item: Payment }) => {
    const statusStyle = getStatusStyle(item.status);
    const methodIcon = getMethodIcon(item.method);

    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-row items-center flex-1">
            <View
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: `${statusStyle.color}20` }}
            >
              <MaterialIcons name={methodIcon as any} size={20} color={statusStyle.color} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-semibold">
                {APP_CONFIG.currencySymbol}{item.amount?.toLocaleString()}
              </Text>
              <Text className="text-muted text-xs">{item.description || "Payment"}</Text>
            </View>
          </View>
          <View className={`px-3 py-1 rounded-full ${statusStyle.bg}`}>
            <Text className={`text-xs font-medium capitalize ${statusStyle.text}`}>
              {item.status}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between pt-2 border-t border-border">
          <View>
            <Text className="text-muted text-xs">Reference</Text>
            <Text className="text-foreground text-sm">{item.reference || item.id}</Text>
          </View>
          <View className="items-end">
            <Text className="text-muted text-xs">Date</Text>
            <Text className="text-foreground text-sm">
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {item.method && (
          <View className="mt-2">
            <Text className="text-muted text-xs capitalize">
              Method: {item.method.replace("_", " ")}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
          >
            <MaterialIcons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Transactions</Text>
            <Text className="text-muted">{filteredPayments.length} transactions</Text>
          </View>
        </View>

        {/* Revenue Summary */}
        <View className="flex-row mb-4">
          <View className="flex-1 bg-surface rounded-xl p-4 mr-2 border border-border">
            <Text className="text-muted text-xs mb-1">Total</Text>
            <Text className="text-xl font-bold text-foreground">
              {APP_CONFIG.currencySymbol}{totalAmount.toLocaleString()}
            </Text>
          </View>
          <View className="flex-1 bg-success/10 rounded-xl p-4 ml-2 border border-success/20">
            <Text className="text-success text-xs mb-1">Completed</Text>
            <Text className="text-xl font-bold text-success">
              {APP_CONFIG.currencySymbol}{completedAmount.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface rounded-xl border border-border px-4 mb-4">
          <MaterialIcons name="search" size={20} color="#9BA1A6" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by ID or reference..."
            placeholderTextColor="#9BA1A6"
            className="flex-1 py-3 px-3 text-foreground"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialIcons name="close" size={20} color="#9BA1A6" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          <View className="flex-row">
            {statusFilters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setStatusFilter(filter.id)}
                className={`px-4 py-2 rounded-full mr-2 ${
                  statusFilter === filter.id ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`font-medium ${
                    statusFilter === filter.id ? "text-white" : "text-muted"
                  }`}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Time Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {timeFilters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setTimeFilter(filter.id)}
                className={`px-4 py-2 rounded-full mr-2 ${
                  timeFilter === filter.id ? "bg-blue-500" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`font-medium ${
                    timeFilter === filter.id ? "text-white" : "text-muted"
                  }`}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Transactions List */}
      <FlatList
        data={filteredPayments}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <MaterialIcons name="receipt-long" size={48} color="#9BA1A6" />
            <Text className="text-muted text-center mt-4">No transactions found</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
