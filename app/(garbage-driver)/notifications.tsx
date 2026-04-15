/**
 * app/(garbage-driver)/notifications.tsx — Driver Notifications Screen
 *
 * Reads from GlobalNotificationProvider (Supabase) instead of the tRPC stub.
 * Notifications are fetched in real-time via Supabase Realtime subscription.
 *
 * Shows notifications from:
 *  - Zone managers (assignment, approval, suspension)
 *  - Customers (chat messages, pickup updates)
 *  - System (pickup status changes, reminders)
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

const DRIVER_ORANGE = "#EA580C";

// ─── Notification type config ──────────────────────────────────────────────────

type NotifType =
  | "pickup_assigned"
  | "pickup_update"
  | "pickup_completed"
  | "zone_manager_message"
  | "zone_assignment"
  | "driver_accepted"
  | "driver_arriving"
  | "driver_approved"
  | "driver_suspended"
  | "customer_chat"
  | "payment"
  | "subscription"
  | "support"
  | "system";

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  pickup_assigned:      { icon: "assignment",         color: "#2563EB" },
  pickup_update:        { icon: "recycling",           color: "#1B4332" },
  pickup_completed:     { icon: "done-all",            color: "#059669" },
  driver_accepted:      { icon: "check-circle",        color: "#16A34A" },
  driver_arriving:      { icon: "local-shipping",      color: "#2563EB" },
  zone_manager_message: { icon: "supervisor-account",  color: "#7C3AED" },
  zone_assignment:      { icon: "map",                 color: "#0891B2" },
  driver_approved:      { icon: "check-circle",        color: "#16A34A" },
  driver_suspended:     { icon: "block",               color: "#DC2626" },
  customer_chat:        { icon: "chat",                color: "#D97706" },
  payment:              { icon: "payments",            color: "#7C3AED" },
  subscription:         { icon: "card-membership",     color: "#0891B2" },
  support:              { icon: "support-agent",       color: "#D97706" },
  system:               { icon: "campaign",            color: "#6B7280" },
};

const DEFAULT_CONFIG = { icon: "campaign", color: "#6B7280" };

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

export default function DriverNotificationsScreen() {
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
      // Navigate to relevant screen based on notification type
      if (
        item.type === "pickup_assigned" ||
        item.type === "pickup_update" ||
        item.type === "pickup_completed" ||
        item.type === "driver_accepted" ||
        item.type === "driver_arriving"
      ) {
        router.back(); // Return to driver dashboard (My Pickups)
      } else if (item.type === "customer_chat") {
        const pickupId = item.pickupId ?? item.data?.pickupId;
        if (pickupId) {
          router.push({
            pathname: "/pickup-chat",
            params: { pickupId, role: "driver" },
          } as any);
        }
      }
    },
    [markAsRead, router]
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const config = TYPE_CONFIG[item.type] ?? DEFAULT_CONFIG;
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
        Zone manager assignments, customer messages, and pickup updates will appear here.
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
          <ActivityIndicator size="large" color={DRIVER_ORANGE} />
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
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(14),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(10),
    flex: 1,
  },
  backButton: {
    padding: _rs.sp(4),
  },
  headerTitles: { flex: 1 },
  headerTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "700",
    color: "#111827",
  },
  headerSub: {
    fontSize: _rs.fs(12),
    color: DRIVER_ORANGE,
    fontWeight: "600",
    marginTop: 1,
  },
  markAllBtn: {
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
    backgroundColor: "#FFF7ED",
    borderRadius: _rs.s(8),
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  markAllText: {
    fontSize: _rs.fs(12),
    fontWeight: "600",
    color: DRIVER_ORANGE,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: _rs.sp(12),
  },
  loadingText: {
    fontSize: _rs.fs(14),
    color: "#6B7280",
  },
  list: {
    padding: _rs.sp(16),
    gap: _rs.sp(8),
  },
  listEmpty: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: _rs.s(12),
    padding: _rs.sp(14),
    gap: _rs.sp(12),
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: _rs.sp(8),
    position: "relative",
  },
  cardUnread: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  unreadDot: {
    position: "absolute",
    top: _rs.sp(10),
    left: _rs.sp(6),
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DRIVER_ORANGE,
  },
  iconWrap: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  content: { flex: 1 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(6),
    marginBottom: _rs.sp(2),
  },
  title: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },
  titleUnread: {
    color: "#111827",
    fontWeight: "700",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: DRIVER_ORANGE,
    flexShrink: 0,
  },
  body: {
    fontSize: _rs.fs(13),
    color: "#6B7280",
    lineHeight: _rs.fs(18),
    marginBottom: _rs.sp(4),
  },
  time: {
    fontSize: _rs.fs(11),
    color: "#9CA3AF",
  },
  emptyWrap: {
    alignItems: "center",
    paddingHorizontal: _rs.sp(32),
    gap: _rs.sp(12),
  },
  emptyIcon: {
    width: _rs.s(72),
    height: _rs.s(72),
    borderRadius: _rs.s(36),
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: _rs.sp(4),
  },
  emptyTitle: {
    fontSize: _rs.fs(17),
    fontWeight: "700",
    color: "#374151",
  },
  emptyBody: {
    fontSize: _rs.fs(14),
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: _rs.fs(20),
  },
});
