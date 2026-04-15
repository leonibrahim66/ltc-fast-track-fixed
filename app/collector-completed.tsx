import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "expo-router";

const STORAGE_KEY = "garbage_pickups";

interface CompletedPickup {
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
  contactPhone?: string;
}

export default function CollectorCompletedScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const [pickups, setPickups] = useState<CompletedPickup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCompleted = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: CompletedPickup[] = raw ? JSON.parse(raw) : [];
      const completed = all.filter(
        (p) =>
          (p.status === "completed" || p.status === "confirmed") &&
          (p.assignedDriverId === user.id || (user as any).zoneId === p.zoneId)
      );
      // Sort by completedAt descending
      completed.sort((a, b) =>
        (b.completedAt || "").localeCompare(a.completedAt || "")
      );
      setPickups(completed);
    } catch (_e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, (user as any)?.zoneId]);

  useFocusEffect(
    useCallback(() => {
      loadCompleted();
    }, [loadCompleted])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompleted();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: CompletedPickup }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <MaterialIcons name="check-circle" size={20} color={colors.success} />
        <Text style={[styles.householdName, { color: colors.foreground }]} numberOfLines={1}>
          {item.householdName || "Household"}
        </Text>
        <Text style={[styles.statusBadge, { backgroundColor: colors.success + "22", color: colors.success }]}>
          Completed
        </Text>
      </View>
      <Text style={[styles.address, { color: colors.muted }]} numberOfLines={2}>
        {item.address}
      </Text>
      {item.completedAt && (
        <Text style={[styles.date, { color: colors.muted }]}>
          Completed: {new Date(item.completedAt).toLocaleDateString("en-ZM", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      )}
      {item.notes && (
        <Text style={[styles.notes, { color: colors.muted }]} numberOfLines={2}>
          Notes: {item.notes}
        </Text>
      )}
    </View>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Completed Pickups</Text>
        <Text style={[styles.count, { color: colors.muted }]}>{pickups.length}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>Loading...</Text>
        </View>
      ) : pickups.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="check-circle-outline" size={64} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Completed Pickups</Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Completed pickups in your zone will appear here.
          </Text>
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
  count: { fontSize: 14, fontWeight: "600" },
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
