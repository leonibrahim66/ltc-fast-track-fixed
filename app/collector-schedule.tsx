import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const STORAGE_KEY = "garbage_pickups";

interface ScheduledPickup {
  id: string;
  householdName: string;
  address: string;
  zoneId: string;
  status: string;
  assignedDriverId?: string;
  scheduledDate?: string;
  notes?: string;
  contactName?: string;
  contactPhone?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#9BA1A6",
  assigned: "#3B82F6",
  accepted: "#8B5CF6",
  in_progress: "#F59E0B",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  accepted: "Accepted",
  in_progress: "In Progress",
};

export default function CollectorScheduleScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [pickups, setPickups] = useState<ScheduledPickup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadScheduled = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: ScheduledPickup[] = raw ? JSON.parse(raw) : [];
      const zoneId = (user as any).zoneId;
      // Show all upcoming/active pickups in the zone
      const scheduled = all.filter(
        (p) =>
          ["pending", "assigned", "accepted", "in_progress"].includes(p.status) &&
          (zoneId ? p.zoneId === zoneId : true)
      );
      // Sort by scheduledDate ascending
      scheduled.sort((a, b) =>
        (a.scheduledDate || "").localeCompare(b.scheduledDate || "")
      );
      setPickups(scheduled);
    } catch (_e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, (user as any)?.zoneId]);

  useFocusEffect(
    useCallback(() => {
      loadScheduled();
    }, [loadScheduled])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadScheduled();
    setRefreshing(false);
  };

  const handleReschedule = (pickup: ScheduledPickup) => {
    Alert.alert(
      "Reschedule Pickup",
      `Reschedule pickup for ${pickup.householdName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reschedule",
          onPress: () => {
            // Navigate to pickups screen where manager can reassign/reschedule
            router.push("/(collector)/pickups" as any);
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ScheduledPickup }) => {
    const statusColor = STATUS_COLORS[item.status] || "#9BA1A6";
    const statusLabel = STATUS_LABELS[item.status] || item.status;
    const scheduledDate = item.scheduledDate
      ? new Date(item.scheduledDate).toLocaleDateString("en-ZM", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Not scheduled";

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.householdName, { color: colors.foreground }]} numberOfLines={1}>
            {item.householdName || "Household"}
          </Text>
          <Text style={[styles.statusBadge, { backgroundColor: statusColor + "22", color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
        <Text style={[styles.address, { color: colors.muted }]} numberOfLines={2}>
          {item.address}
        </Text>
        <View style={styles.dateRow}>
          <MaterialIcons name="schedule" size={14} color={colors.muted} />
          <Text style={[styles.date, { color: colors.muted }]}>{scheduledDate}</Text>
        </View>
        {item.assignedDriverId && (
          <View style={styles.driverRow}>
            <MaterialIcons name="person" size={14} color={colors.primary} />
            <Text style={[styles.driverText, { color: colors.primary }]}>Driver assigned</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.rescheduleBtn, { borderColor: colors.border }]}
          onPress={() => handleReschedule(item)}
        >
          <MaterialIcons name="edit-calendar" size={14} color={colors.muted} />
          <Text style={[styles.rescheduleBtnText, { color: colors.muted }]}>Manage</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Schedule</Text>
        <Text style={[styles.count, { color: colors.muted }]}>{pickups.length} upcoming</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>Loading schedule...</Text>
        </View>
      ) : pickups.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="event-available" size={64} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Upcoming Pickups</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Scheduled pickups in your zone will appear here.
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(collector)/pickups" as any)}
          >
            <Text style={styles.actionBtnText}>View All Pickups</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={pickups}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  count: { fontSize: 13, fontWeight: "500" },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    gap: 6,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  householdName: { flex: 1, fontSize: 15, fontWeight: "600" },
  statusBadge: { fontSize: 11, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  address: { fontSize: 13 },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  date: { fontSize: 12 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  driverText: { fontSize: 12, fontWeight: "600" },
  rescheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  rescheduleBtnText: { fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
