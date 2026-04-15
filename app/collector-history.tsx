import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const STORAGE_KEY = "garbage_pickups";

interface HistoryPickup {
  id: string;
  householdName: string;
  address: string;
  zoneId: string;
  status: string;
  assignedDriverId?: string;
  completedAt?: string;
  scheduledDate?: string;
  notes?: string;
  contactName?: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "#22C55E",
  confirmed: "#16A34A",
  cancelled: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export default function CollectorHistoryScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [pickups, setPickups] = useState<HistoryPickup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: HistoryPickup[] = raw ? JSON.parse(raw) : [];
      const zoneId = (user as any).zoneId;
      const history = all.filter(
        (p) =>
          ["completed", "confirmed", "cancelled"].includes(p.status) &&
          (zoneId ? p.zoneId === zoneId : true)
      );
      // Sort by completedAt/scheduledDate descending
      history.sort((a, b) =>
        (b.completedAt || b.scheduledDate || "").localeCompare(
          a.completedAt || a.scheduledDate || ""
        )
      );
      setPickups(history);
    } catch (_e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, (user as any)?.zoneId]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const filtered = filter === "all" ? pickups : pickups.filter((p) => p.status === filter || (filter === "completed" && p.status === "confirmed"));

  const renderItem = ({ item }: { item: HistoryPickup }) => {
    const statusColor = STATUS_COLORS[item.status] || "#9BA1A6";
    const statusLabel = STATUS_LABELS[item.status] || item.status;
    const dateStr = item.completedAt || item.scheduledDate;
    const formattedDate = dateStr
      ? new Date(dateStr).toLocaleDateString("en-ZM", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Unknown date";

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <MaterialIcons
            name={item.status === "cancelled" ? "cancel" : "check-circle"}
            size={18}
            color={statusColor}
          />
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
        <Text style={[styles.date, { color: colors.muted }]}>{formattedDate}</Text>
        {item.notes && (
          <Text style={[styles.notes, { color: colors.muted }]} numberOfLines={1}>
            {item.notes}
          </Text>
        )}
      </View>
    );
  };

  const FILTERS: { key: "all" | "completed" | "cancelled"; label: string }[] = [
    { key: "all", label: "All" },
    { key: "completed", label: "Completed" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Pickup History</Text>
        <Text style={[styles.count, { color: colors.muted }]}>{filtered.length}</Text>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterLabel, { color: filter === f.key ? colors.primary : colors.muted }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>Loading history...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="history" size={64} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No History</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Completed and cancelled pickups in your zone will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
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
  count: { fontSize: 14, fontWeight: "600" },
  filterRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
  },
  filterTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
  },
  filterLabel: { fontSize: 13, fontWeight: "600" },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    gap: 6,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  householdName: { flex: 1, fontSize: 15, fontWeight: "600" },
  statusBadge: { fontSize: 11, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  address: { fontSize: 13 },
  date: { fontSize: 12 },
  notes: { fontSize: 12, fontStyle: "italic" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
});
