import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface ZoneReport {
  id: string;
  name: string;
  managerName?: string;
  totalHouseholds: number;
  activeDrivers: number;
  completedPickups: number;
  pendingPickups: number;
  cancelledPickups: number;
}

interface SummaryStats {
  totalZones: number;
  totalManagers: number;
  totalDrivers: number;
  totalPickups: number;
  completedPickups: number;
  pendingPickups: number;
}

export default function ZoneReportsScreen() {
  const router = useRouter();
  const colors = useColors();
  const [zones, setZones] = useState<ZoneReport[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    totalZones: 0,
    totalManagers: 0,
    totalDrivers: 0,
    totalPickups: 0,
    completedPickups: 0,
    pendingPickups: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const [zonesRaw, usersRaw, pickupsRaw, householdsRaw] = await Promise.all([
        AsyncStorage.getItem("@ltc_zones"),
        AsyncStorage.getItem("@ltc_users_db"),
        AsyncStorage.getItem("@ltc_pickups"),
        AsyncStorage.getItem("@ltc_households"),
      ]);

      const zonesData: any[] = zonesRaw ? JSON.parse(zonesRaw) : [];
      const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
      const pickups: any[] = pickupsRaw ? JSON.parse(pickupsRaw) : [];
      const households: any[] = householdsRaw ? JSON.parse(householdsRaw) : [];

      const managers = users.filter((u) => u.role === "zone_manager" || u.role === "collector");
      const drivers = users.filter((u) => u.role === "garbage_driver" || u.role === "driver");

      const zoneReports: ZoneReport[] = zonesData.map((zone) => {
        const zoneManager = managers.find((m) => m.zoneId === zone.id);
        const zoneDrivers = drivers.filter((d) => d.zoneId === zone.id);
        const zoneHouseholds = households.filter((h) => h.zoneId === zone.id);
        const zonePickups = pickups.filter((p) => p.zoneId === zone.id);
        const completed = zonePickups.filter((p) => ["completed", "confirmed"].includes(p.status)).length;
        const pending = zonePickups.filter((p) => ["pending", "assigned", "accepted", "in_progress"].includes(p.status)).length;
        const cancelled = zonePickups.filter((p) => p.status === "cancelled").length;

        return {
          id: zone.id,
          name: zone.name || zone.zoneName || "Unnamed Zone",
          managerName: zoneManager?.fullName || zoneManager?.firstName,
          totalHouseholds: zoneHouseholds.length,
          activeDrivers: zoneDrivers.filter((d) => d.status === "active").length,
          completedPickups: completed,
          pendingPickups: pending,
          cancelledPickups: cancelled,
        };
      });

      setZones(zoneReports);
      setSummary({
        totalZones: zonesData.length,
        totalManagers: managers.filter((m) => m.status === "active").length,
        totalDrivers: drivers.filter((d) => d.status === "active").length,
        totalPickups: pickups.length,
        completedPickups: pickups.filter((p) => ["completed", "confirmed"].includes(p.status)).length,
        pendingPickups: pickups.filter((p) => ["pending", "assigned", "accepted", "in_progress"].includes(p.status)).length,
      });
    } catch (_e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const completionRate = summary.totalPickups > 0
    ? Math.round((summary.completedPickups / summary.totalPickups) * 100)
    : 0;

  const renderZone = ({ item }: { item: ZoneReport }) => {
    const total = item.completedPickups + item.pendingPickups + item.cancelledPickups;
    const rate = total > 0 ? Math.round((item.completedPickups / total) * 100) : 0;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.zoneIcon, { backgroundColor: colors.primary + "22" }]}>
            <MaterialIcons name="location-on" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.zoneName, { color: colors.foreground }]}>{item.name}</Text>
            <Text style={[styles.managerName, { color: colors.muted }]}>
              {item.managerName ? `Manager: ${item.managerName}` : "No manager assigned"}
            </Text>
          </View>
          <View style={[styles.rateBadge, { backgroundColor: rate >= 80 ? colors.success + "22" : rate >= 50 ? "#F59E0B22" : colors.error + "22" }]}>
            <Text style={[styles.rateText, { color: rate >= 80 ? colors.success : rate >= 50 ? "#F59E0B" : colors.error }]}>
              {rate}%
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{item.totalHouseholds}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Households</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{item.activeDrivers}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Drivers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>{item.completedPickups}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: "#F59E0B" }]}>{item.pendingPickups}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Pending</Text>
          </View>
        </View>
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Zone Reports</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <MaterialIcons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: "#166534" }]}>
          <Text style={styles.summaryTitle}>System Overview</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.totalZones}</Text>
              <Text style={styles.summaryLabel}>Zones</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.totalManagers}</Text>
              <Text style={styles.summaryLabel}>Managers</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{summary.totalDrivers}</Text>
              <Text style={styles.summaryLabel}>Drivers</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{completionRate}%</Text>
              <Text style={styles.summaryLabel}>Completion</Text>
            </View>
          </View>
          <View style={styles.pickupRow}>
            <View style={styles.pickupStat}>
              <MaterialIcons name="check-circle" size={16} color="#4ADE80" />
              <Text style={styles.pickupStatText}>{summary.completedPickups} completed</Text>
            </View>
            <View style={styles.pickupStat}>
              <MaterialIcons name="schedule" size={16} color="#FCD34D" />
              <Text style={styles.pickupStatText}>{summary.pendingPickups} pending</Text>
            </View>
          </View>
        </View>

        {/* Zone List */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Zone Breakdown</Text>
          <Text style={[styles.sectionCount, { color: colors.muted }]}>{zones.length} zones</Text>
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>Loading reports...</Text>
          </View>
        ) : zones.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="assessment" size={64} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Zones Yet</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Create zones to see performance reports.
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/zone-create" as any)}
            >
              <Text style={styles.actionBtnText}>Create First Zone</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={zones}
            keyExtractor={(item) => item.id}
            renderItem={renderZone}
            contentContainerStyle={styles.list}
            scrollEnabled={false}
          />
        )}
      </ScrollView>
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
  refreshBtn: { padding: 4 },
  summaryCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  summaryTitle: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600", marginBottom: 12 },
  summaryGrid: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { color: "#fff", fontSize: 22, fontWeight: "800" },
  summaryLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  pickupRow: { flexDirection: "row", gap: 16 },
  pickupStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  pickupStatText: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionCount: { fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 0.5,
    gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  zoneIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  zoneName: { fontSize: 15, fontWeight: "700" },
  managerName: { fontSize: 12, marginTop: 1 },
  rateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  rateText: { fontSize: 13, fontWeight: "800" },
  statsRow: { flexDirection: "row" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 11, marginTop: 2 },
  center: { alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  actionBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
