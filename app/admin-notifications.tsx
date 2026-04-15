import { useEffect, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin, AdminNotification } from "@/lib/admin-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

type FilterType = "all" | "unread" | "subscription" | "dispute" | "pickup" | "user";

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, notifications, markNotificationRead, markAllNotificationsRead, refreshStats } = useAdmin();
  const [filteredNotifications, setFilteredNotifications] = useState<AdminNotification[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    filterNotifications();
  }, [notifications, filter]);

  const filterNotifications = () => {
    let filtered = [...notifications];

    if (filter === "unread") {
      filtered = filtered.filter((n) => !n.read);
    } else if (filter !== "all") {
      filtered = filtered.filter((n) => n.type === filter);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredNotifications(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshStats();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification: AdminNotification) => {
    if (!notification.read) {
      await markNotificationRead(notification.id);
    }

    // Navigate based on notification type and data
    if (notification.data?.route) {
      router.push(notification.data.route as any);
    }
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case "subscription":
        return { bg: "bg-success/10", color: "#22C55E", icon: "card-membership" };
      case "dispute":
        return { bg: "bg-error/10", color: "#EF4444", icon: "gavel" };
      case "pickup":
        return { bg: "bg-blue-500/10", color: "#3B82F6", icon: "local-shipping" };
      case "user":
        return { bg: "bg-purple-500/10", color: "#8B5CF6", icon: "person-add" };
      case "payment":
        return { bg: "bg-warning/10", color: "#F59E0B", icon: "payments" };
      default:
        return { bg: "bg-muted/10", color: "#9BA1A6", icon: "notifications" };
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filters: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: `Unread (${unreadCount})` },
    { id: "subscription", label: "Subscriptions" },
    { id: "dispute", label: "Disputes" },
    { id: "pickup", label: "Pickups" },
    { id: "user", label: "Users" },
  ];

  const renderNotificationItem = ({ item }: { item: AdminNotification }) => {
    const style = getNotificationStyle(item.type);

    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        className={`bg-surface rounded-xl p-4 mb-3 border ${
          item.read ? "border-border" : "border-primary"
        }`}
      >
        <View className="flex-row items-start">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center ${style.bg}`}
          >
            <MaterialIcons name={style.icon as any} size={20} color={style.color} />
          </View>
          <View className="flex-1 ml-3">
            <View className="flex-row items-center justify-between">
              <Text
                className={`font-semibold ${
                  item.read ? "text-foreground" : "text-primary"
                }`}
              >
                {item.title}
              </Text>
              {!item.read && (
                <View className="w-2 h-2 rounded-full bg-primary" />
              )}
            </View>
            <Text className="text-muted text-sm mt-1">{item.message}</Text>
            <Text className="text-muted text-xs mt-2">
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
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
            <Text className="text-2xl font-bold text-foreground">Notifications</Text>
            <Text className="text-muted">{unreadCount} unread</Text>
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllNotificationsRead}
              className="bg-primary/10 px-4 py-2 rounded-full"
            >
              <Text className="text-primary font-medium">Mark All Read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row">
            {filters.map((f) => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-full mr-2 ${
                  filter === f.id ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`font-medium ${
                    filter === f.id ? "text-white" : "text-muted"
                  }`}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Notifications List */}
      <FlatList
        data={filteredNotifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <MaterialIcons name="notifications-none" size={48} color="#9BA1A6" />
            <Text className="text-muted text-center mt-4">No notifications</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
