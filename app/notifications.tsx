/**
 * app/notifications.tsx — Customer Notifications Screen
 *
 * Reads from GlobalNotificationProvider (Supabase) instead of the tRPC stub.
 * Notifications are fetched in real-time via Supabase Realtime subscription.
 */
import { useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useGlobalNotifications } from "@/lib/global-notification-context";
import { getStaticResponsive } from "@/hooks/use-responsive";

// ─── Notification type config ──────────────────────────────────────────────────

type NotifType =
  | "pickup_update"
  | "driver_accepted"
  | "driver_arriving"
  | "pickup_completed"
  | "payment"
  | "subscription"
  | "system"
  | "support";

const TYPE_CONFIG: Record<NotifType, { icon: string; color: string }> = {
  pickup_update:    { icon: "recycling",         color: "#1B4332" },
  driver_accepted:  { icon: "check-circle",      color: "#16A34A" },
  driver_arriving:  { icon: "local-shipping",    color: "#2563EB" },
  pickup_completed: { icon: "done-all",          color: "#059669" },
  payment:          { icon: "payments",          color: "#7C3AED" },
  subscription:     { icon: "card-membership",   color: "#0891B2" },
  support:          { icon: "support-agent",     color: "#D97706" },
  system:           { icon: "campaign",          color: "#6B7280" },
};

function formatDate(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1)  return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24)  return `${diffHr}h ago`;
  if (diffDay < 7)  return `${diffDay}d ago`;
  return date.toLocaleDateString("en-ZM", { month: "short", day: "numeric" });
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    refresh,
  } = useGlobalNotifications();

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    await markAllAsRead();
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [unreadCount, markAllAsRead]);

  const handlePress = useCallback(
    async (item: any) => {
      if (!item.isRead) {
        await markAsRead(item.id);
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (item.type === "payment") {
        router.push("/payment-history" as any);
      } else if (
        item.type === "pickup_update" ||
        item.type === "driver_accepted" ||
        item.type === "driver_arriving" ||
        item.type === "pickup_completed"
      ) {
        router.push("/(tabs)/pickups");
      }
    },
    [markAsRead, router]
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const type = (item.type as NotifType) in TYPE_CONFIG ? (item.type as NotifType) : "system";
      const config = TYPE_CONFIG[type];
      return (
        <TouchableOpacity
          onPress={() => handlePress(item)}
          style={[styles.card, !item.isRead && styles.cardUnread]}
          activeOpacity={0.75}
        >
          {/* Unread indicator */}
          {!item.isRead && <View style={styles.unreadDot} />}

          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: `${config.color}20` }]}>
            <MaterialIcons name={config.icon as any} size={20} color={config.color} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, !item.isRead && styles.titleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
              {!item.isRead && <View style={styles.dot} />}
            </View>
            <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
            <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handlePress]
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <MaterialIcons name="notifications-none" size={40} color="#9CA3AF" />
      </View>
      <Text style={styles.emptyTitle}>No Notifications</Text>
      <Text style={styles.emptyBody}>
        You&apos;re all caught up! Pickup updates, driver alerts, payment confirmations, and more will appear here.
      </Text>
    </View>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.headerSub}>{unreadCount} unread</Text>
            )}
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading state */}
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1B4332" />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item: any) => String(item.id)}
          contentContainerStyle={[
            styles.list,
            notifications.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={renderEmpty}
          onRefresh={refresh}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const _rs = getStaticResponsive();

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitles: {
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSub: {
    fontSize: 13,
    color: "#6B7280",
  },
  markAllBtn: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllText: {
    color: "#1B4332",
    fontSize: 13,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    gap: 10,
  },
  listEmpty: {
    flexGrow: 1,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  cardUnread: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  unreadDot: {
    position: "absolute",
    top: 16,
    left: 5,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
    lineHeight: 18,
  },
  titleUnread: {
    color: "#1B4332",
    fontWeight: "700",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1B4332",
    flexShrink: 0,
  },
  body: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 14,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#374151",
  },
  emptyBody: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
