import { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useRecycler, RecyclerOrder } from "@/lib/recycler-context";
import { RECYCLING_CATEGORIES, APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const getStatusColor = (status: RecyclerOrder["status"]) => {
  switch (status) {
    case "pending":
      return { bg: "bg-warning/10", text: "text-warning" };
    case "confirmed":
      return { bg: "bg-primary/10", text: "text-primary" };
    case "processing":
      return { bg: "bg-blue-500/10", text: "text-blue-500" };
    case "delivered":
      return { bg: "bg-success/10", text: "text-success" };
    case "cancelled":
      return { bg: "bg-error/10", text: "text-error" };
    default:
      return { bg: "bg-muted/10", text: "text-muted" };
  }
};

const getPaymentStatusColor = (status: RecyclerOrder["paymentStatus"]) => {
  switch (status) {
    case "paid":
      return { bg: "bg-success/10", text: "text-success" };
    case "pending":
      return { bg: "bg-warning/10", text: "text-warning" };
    case "failed":
      return { bg: "bg-error/10", text: "text-error" };
    default:
      return { bg: "bg-muted/10", text: "text-muted" };
  }
};

export default function RecyclerDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { getOrdersByRecycler, refreshOrders } = useRecycler();
  const [refreshing, setRefreshing] = useState(false);

  // Role guard - redirect non-recyclers
  useEffect(() => {
    if (user && user.role !== "recycler") {
      router.replace("/(auth)/welcome" as any);
    }
    if (!user) {
      router.replace("/(auth)/welcome" as any);
    }
  }, [user]);

  const myOrders = user ? getOrdersByRecycler(user.id) : [];
  const pendingOrders = myOrders.filter((o) => o.status === "pending" || o.status === "confirmed");
  const completedOrders = myOrders.filter((o) => o.status === "delivered");

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  const renderOrderItem = ({ item }: { item: RecyclerOrder }) => {
    const statusColors = getStatusColor(item.status);
    const paymentColors = getPaymentStatusColor(item.paymentStatus);
    const _category = RECYCLING_CATEGORIES.find((c) => c.id === item.category);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/recycler-order-detail?id=${item.id}` as any)}
        className="bg-surface rounded-xl p-4 mb-3 border border-border"
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-foreground font-semibold">{item.categoryName}</Text>
            <Text className="text-muted text-sm">Order #{item.id}</Text>
          </View>
          <View className={`px-3 py-1 rounded-full ${statusColors.bg}`}>
            <Text className={`text-xs font-medium capitalize ${statusColors.text}`}>
              {item.status}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-muted">
            {item.quantity} {item.unit}
          </Text>
          <Text className="text-foreground font-semibold">
            {APP_CONFIG.currencySymbol}{item.totalPrice.toLocaleString()}
          </Text>
        </View>

        <View className="flex-row justify-between items-center">
          <Text className="text-muted text-xs">
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
          <View className={`px-2 py-0.5 rounded ${paymentColors.bg}`}>
            <Text className={`text-xs capitalize ${paymentColors.text}`}>
              {item.paymentStatus}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!user || user.role !== "recycler") {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <MaterialIcons name="lock" size={48} color="#6B7280" />
        <Text className="text-foreground font-semibold text-lg mt-4">
          Recycler Access Only
        </Text>
        <Text className="text-muted text-center mt-2">
          This dashboard is only available for registered recycling companies.
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/(auth)/register-recycler" as any)}
          className="bg-primary px-6 py-3 rounded-full mt-6"
        >
          <Text className="text-white font-medium">Register as Recycler</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">
                Recycler Dashboard
              </Text>
              <Text className="text-muted">{user.fullName}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  "Logout",
                  "Are you sure you want to logout?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Logout",
                      style: "destructive",
                      onPress: async () => {
                        await logout();
                        router.replace("/(auth)/welcome" as any);
                      },
                    },
                  ]
                );
              }}
              className="w-10 h-10 rounded-full bg-red-50 items-center justify-center ml-2"
            >
              <MaterialIcons name="logout" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View className="px-6 mb-6">
          <View className="flex-row">
            <View className="flex-1 bg-primary/10 rounded-xl p-4 mr-2">
              <MaterialIcons name="pending-actions" size={24} color="#22C55E" />
              <Text className="text-2xl font-bold text-foreground mt-2">
                {pendingOrders.length}
              </Text>
              <Text className="text-muted text-sm">Pending Orders</Text>
            </View>
            <View className="flex-1 bg-success/10 rounded-xl p-4 ml-2">
              <MaterialIcons name="check-circle" size={24} color="#22C55E" />
              <Text className="text-2xl font-bold text-foreground mt-2">
                {completedOrders.length}
              </Text>
              <Text className="text-muted text-sm">Completed</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Quick Actions
          </Text>
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => router.push("/recycler-order" as any)}
              className="flex-1 bg-primary rounded-xl p-4 mr-2 items-center"
            >
              <MaterialIcons name="add-shopping-cart" size={28} color="#fff" />
              <Text className="text-white font-medium mt-2">New Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/recycler-payment" as any)}
              className="flex-1 bg-surface border border-border rounded-xl p-4 ml-2 items-center"
            >
              <MaterialIcons name="payment" size={28} color="#22C55E" />
              <Text className="text-foreground font-medium mt-2">Pay Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Orders */}
        <View className="px-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-foreground">
              Recent Orders
            </Text>
            {myOrders.length > 3 && (
              <TouchableOpacity onPress={() => router.push("/recycler-orders" as any)}>
                <Text className="text-primary font-medium">View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {myOrders.length === 0 ? (
            <View className="bg-surface rounded-xl p-8 items-center border border-border">
              <MaterialIcons name="inventory-2" size={48} color="#9CA3AF" />
              <Text className="text-foreground font-medium mt-4">
                No Orders Yet
              </Text>
              <Text className="text-muted text-center mt-2">
                Place your first bulk order for recyclable materials.
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/recycler-order" as any)}
                className="bg-primary px-6 py-3 rounded-full mt-4"
              >
                <Text className="text-white font-medium">Place Order</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myOrders.slice(0, 5).map((order) => (
              <View key={order.id}>{renderOrderItem({ item: order })}</View>
            ))
          )}
        </View>

        {/* Categories Info */}
        <View className="px-6 mt-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Available Categories
          </Text>
          <View className="flex-row flex-wrap">
            {RECYCLING_CATEGORIES.map((category) => (
              <View
                key={category.id}
                className="bg-surface border border-border rounded-lg px-3 py-2 mr-2 mb-2"
              >
                <Text className="text-foreground text-sm">{category.name}</Text>
                <Text className="text-muted text-xs">
                  Min: {category.minOrder} {category.unit}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
