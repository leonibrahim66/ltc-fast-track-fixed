import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  bookingId?: string;
  recipientType: string;
  recipientId: string;
  read: boolean;
  createdAt: string;
}

const NOTIF_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  new_booking: { icon: "add-circle", color: "#3B82F6", bg: "rgba(59,130,246,0.15)" },
  booking_accepted: { icon: "check-circle", color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  booking_rejected: { icon: "cancel", color: "#EF4444", bg: "rgba(239,68,68,0.15)" },
  status_update: { icon: "local-shipping", color: "#8B5CF6", bg: "rgba(139,92,246,0.15)" },
  delivery_complete: { icon: "done-all", color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
  rating_received: { icon: "star", color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
  default: { icon: "notifications", color: "#9BA1A6", bg: "rgba(155,161,166,0.15)" },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const loadNotifications = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem("carrier_notifications");
      const notifs: Notification[] = stored ? JSON.parse(stored) : [];
      // Sort by newest first
      notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(notifs);
    } catch (e) {
      console.error("Error loading notifications:", e);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const markAsRead = async (notifId: string) => {
    try {
      const stored = await AsyncStorage.getItem("carrier_notifications");
      const notifs: Notification[] = stored ? JSON.parse(stored) : [];
      const updated = notifs.map((n) => (n.id === notifId ? { ...n, read: true } : n));
      await AsyncStorage.setItem("carrier_notifications", JSON.stringify(updated));
      setNotifications(updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error("Error marking as read:", e);
    }
  };

  const markAllAsRead = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const stored = await AsyncStorage.getItem("carrier_notifications");
      const notifs: Notification[] = stored ? JSON.parse(stored) : [];
      const updated = notifs.map((n) => ({ ...n, read: true }));
      await AsyncStorage.setItem("carrier_notifications", JSON.stringify(updated));
      setNotifications(updated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e) {
      console.error("Error marking all as read:", e);
    }
  };

  const clearAll = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await AsyncStorage.setItem("carrier_notifications", JSON.stringify([]));
    setNotifications([]);
  };

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

  const filteredNotifs = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotifPress = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.type === "new_booking") {
      router.push("/carrier/job-feed" as any);
    } else if (notif.type === "booking_accepted" || notif.type === "status_update") {
      router.push("/carrier/track" as any);
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const config = NOTIF_ICONS[item.type] || NOTIF_ICONS.default;
    return (
      <TouchableOpacity
        onPress={() => handleNotifPress(item)}
        activeOpacity={0.7}
        style={{ marginHorizontal: 16, marginBottom: 8 }}
      >
        <View
          className="rounded-xl p-4 flex-row"
          style={{
            backgroundColor: item.read ? "rgba(255,255,255,0.03)" : "rgba(34,197,94,0.06)",
            borderWidth: 1,
            borderColor: item.read ? "rgba(255,255,255,0.06)" : "rgba(34,197,94,0.15)",
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: config.bg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <MaterialIcons name={config.icon as any} size={20} color={config.color} />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-sm font-semibold text-foreground flex-1" numberOfLines={1}>
                {item.title}
              </Text>
              <Text className="text-xs text-muted ml-2">{getTimeAgo(item.createdAt)}</Text>
            </View>
            <Text className="text-xs text-muted leading-4" numberOfLines={2}>
              {item.message}
            </Text>
          </View>
          {!item.read && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#22C55E",
                marginLeft: 8,
                alignSelf: "center",
              }}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-8 pt-20">
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: "rgba(155,161,166,0.15)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <MaterialIcons name="notifications-none" size={40} color="#9BA1A6" />
      </View>
      <Text className="text-lg font-semibold text-foreground text-center mb-2">
        {filter === "unread" ? "No Unread Notifications" : "No Notifications"}
      </Text>
      <Text className="text-sm text-muted text-center leading-5">
        {filter === "unread"
          ? "All caught up! Switch to 'All' to see past notifications."
          : "Notifications about bookings, deliveries, and updates will appear here."}
      </Text>
    </View>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <View>
            <Text className="text-xl font-bold text-foreground">Notifications</Text>
            {unreadCount > 0 && (
              <Text className="text-xs text-muted">{unreadCount} unread</Text>
            )}
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: "rgba(34,197,94,0.15)" }}>
              <Text style={{ color: "#22C55E", fontSize: 11, fontWeight: "600" }}>Read All</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={clearAll} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: "rgba(239,68,68,0.1)" }}>
              <Text style={{ color: "#EF4444", fontSize: 11, fontWeight: "600" }}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View className="flex-row px-6 mb-3 gap-2">
        {(["all", "unread"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: filter === f ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: filter === f ? "#22C55E" : "rgba(255,255,255,0.1)",
            }}
          >
            <Text style={{ color: filter === f ? "#22C55E" : "#9BA1A6", fontSize: 13, fontWeight: "600" }}>
              {f === "all" ? "All" : `Unread (${unreadCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredNotifs}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        ListEmptyComponent={renderEmptyState}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 }}
      />
    </ScreenContainer>
  );
}
