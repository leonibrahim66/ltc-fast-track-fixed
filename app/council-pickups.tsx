/**
 * Council Admin — Pickups Monitoring Screen
 * Province/city-scoped real-time pickup feed
 */
import { useState, useCallback, useEffect } from "react";
import {
  Text, View, TouchableOpacity, FlatList, StyleSheet,
  TextInput, RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface Pickup {
  id: string;
  customerId?: string;
  customerName?: string;
  driverId?: string;
  driverName?: string;
  zoneId?: string;
  zoneName?: string;
  status?: string;
  address?: string;
  scheduledAt?: string;
  createdAt?: string;
  completedAt?: string;
  notes?: string;
}

const STATUS_TABS = ["All", "Pending", "Assigned", "In Progress", "Completed"] as const;
type StatusTab = typeof STATUS_TABS[number];

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: "#FEF3C7", text: "#92400E", icon: "schedule" },
  assigned: { bg: "#DBEAFE", text: "#1E40AF", icon: "assignment-ind" },
  accepted: { bg: "#EDE9FE", text: "#5B21B6", icon: "thumb-up" },
  in_progress: { bg: "#FEF3C7", text: "#92400E", icon: "directions-car" },
  completed: { bg: "#DCFCE7", text: "#166534", icon: "check-circle" },
  confirmed: { bg: "#D1FAE5", text: "#065F46", icon: "verified" },
};

export default function CouncilPickupsScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusTab>("All");
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadPickups = useCallback(async () => {
    if (!adminUser?.province) return;
    try {
      const pickupsRaw = await AsyncStorage.getItem("ltc_pickups");
      const zonesRaw = await AsyncStorage.getItem("@ltc_service_zones");
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");

      const allPickups: Pickup[] = pickupsRaw ? JSON.parse(pickupsRaw) : [];
      const allZones: any[] = zonesRaw ? JSON.parse(zonesRaw) : [];
      const allUsers: Record<string, any> = usersRaw ? JSON.parse(usersRaw) : {};

      // Get zone IDs scoped to this council's province/city
      const scopedZoneIds = new Set(
        allZones
          .filter((z) => z.province === adminUser.province || z.town === adminUser.city || z.city === adminUser.city)
          .map((z) => z.id)
      );

      const scoped = allPickups
        .filter((p) => !p.zoneId || scopedZoneIds.has(p.zoneId))
        .map((p) => {
          const zone = allZones.find((z) => z.id === p.zoneId);
          const customer = p.customerId ? allUsers[p.customerId] : null;
          const driver = p.driverId ? allUsers[p.driverId] : null;
          return {
            ...p,
            zoneName: zone?.name || p.zoneName,
            customerName: customer?.fullName || customer?.name || p.customerName,
            driverName: driver?.fullName || driver?.name || p.driverName,
          };
        })
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      setPickups(scoped);
    } catch (e) { console.error(e); }
  }, [adminUser]);

  useFocusEffect(useCallback(() => { loadPickups(); }, [loadPickups]));

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadPickups, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadPickups]);

  const onRefresh = async () => { setRefreshing(true); await loadPickups(); setRefreshing(false); };

  const filtered = pickups.filter((p) => {
    const matchSearch = !search ||
      (p.customerName || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.driverName || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.zoneName || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.address || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "All" ? true :
      filter === "Pending" ? p.status === "pending" :
      filter === "Assigned" ? (p.status === "assigned" || p.status === "accepted") :
      filter === "In Progress" ? p.status === "in_progress" :
      filter === "Completed" ? (p.status === "completed" || p.status === "confirmed") : true;
    return matchSearch && matchFilter;
  });

  const counts = {
    pending: pickups.filter((p) => p.status === "pending").length,
    inProgress: pickups.filter((p) => p.status === "in_progress").length,
    completed: pickups.filter((p) => p.status === "completed" || p.status === "confirmed").length,
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Pickups</Text>
        <TouchableOpacity
          style={[styles.autoRefreshBtn, autoRefresh && styles.autoRefreshActive]}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <MaterialIcons name="refresh" size={16} color={autoRefresh ? "#fff" : "#6B7280"} />
          <Text style={[styles.autoRefreshText, autoRefresh && styles.autoRefreshTextActive]}>
            {autoRefresh ? "Live" : "Paused"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: "#FEF3C7" }]}>
          <Text style={[styles.summaryNum, { color: "#92400E" }]}>{counts.pending}</Text>
          <Text style={[styles.summaryLabel, { color: "#92400E" }]}>Pending</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#FEF3C7" }]}>
          <Text style={[styles.summaryNum, { color: "#92400E" }]}>{counts.inProgress}</Text>
          <Text style={[styles.summaryLabel, { color: "#92400E" }]}>In Progress</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#DCFCE7" }]}>
          <Text style={[styles.summaryNum, { color: "#166534" }]}>{counts.completed}</Text>
          <Text style={[styles.summaryLabel, { color: "#166534" }]}>Completed</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search pickups..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.tabs}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, filter === t && styles.tabActive]}
            onPress={() => setFilter(t)}
          >
            <Text style={[styles.tabText, filter === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="recycling" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No pickups found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = STATUS_CONFIG[item.status || "pending"] || STATUS_CONFIG.pending;
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.statusIcon, { backgroundColor: sc.bg }]}>
                  <MaterialIcons name={sc.icon as any} size={18} color={sc.text} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.pickupId}>#{item.id.slice(-6).toUpperCase()}</Text>
                  {item.customerName && <Text style={styles.customerName}>{item.customerName}</Text>}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>
                    {(item.status || "pending").replace("_", " ")}
                  </Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                {item.zoneName && (
                  <View style={styles.detailChip}>
                    <MaterialIcons name="map" size={12} color="#6B7280" />
                    <Text style={styles.detailText}>{item.zoneName}</Text>
                  </View>
                )}
                {item.driverName && (
                  <View style={styles.detailChip}>
                    <MaterialIcons name="local-shipping" size={12} color="#6B7280" />
                    <Text style={styles.detailText}>{item.driverName}</Text>
                  </View>
                )}
              </View>
              {item.address && <Text style={styles.address}>{item.address}</Text>}
              {item.createdAt && (
                <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleString()}</Text>
              )}
            </View>
          );
        }}
      />
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12), padding: _rs.sp(16), paddingBottom: _rs.sp(8) },
  backBtn: { padding: _rs.sp(4) },
  title: { fontSize: _rs.fs(18), fontWeight: "700", color: "#111827", flex: 1 },
  autoRefreshBtn: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4), paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(5), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  autoRefreshActive: { backgroundColor: "#DC2626" },
  autoRefreshText: { fontSize: _rs.fs(12), color: "#6B7280", fontWeight: "500" },
  autoRefreshTextActive: { color: "#fff" },
  summaryRow: { flexDirection: "row", gap: _rs.sp(8), paddingHorizontal: _rs.sp(16), marginBottom: _rs.sp(8) },
  summaryCard: { flex: 1, borderRadius: _rs.s(10), padding: _rs.sp(10), alignItems: "center" },
  summaryNum: { fontSize: _rs.fs(20), fontWeight: "700" },
  summaryLabel: { fontSize: _rs.fs(11), fontWeight: "500", marginTop: _rs.sp(2) },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), margin: _rs.sp(16), marginTop: _rs.sp(8), backgroundColor: "#F9FAFB", borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(12), borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { flex: 1, height: _rs.s(40), fontSize: _rs.fs(14), color: "#111827" },
  tabs: { flexDirection: "row", paddingHorizontal: _rs.sp(16), gap: _rs.sp(6), marginBottom: _rs.sp(8) },
  tab: { paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  tabActive: { backgroundColor: "#DC2626" },
  tabText: { fontSize: _rs.fs(12), color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  list: { padding: _rs.sp(16), paddingTop: _rs.sp(8), gap: _rs.sp(10) },
  empty: { alignItems: "center", paddingVertical: _rs.sp(40), gap: _rs.sp(10) },
  emptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  card: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), marginBottom: _rs.sp(8) },
  statusIcon: { width: _rs.s(38), height: _rs.s(38), borderRadius: _rs.s(10), alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  pickupId: { fontSize: _rs.fs(13), fontWeight: "700", color: "#111827" },
  customerName: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  statusBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(12) },
  statusText: { fontSize: _rs.fs(11), fontWeight: "600", textTransform: "capitalize" },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: _rs.sp(6), marginBottom: _rs.sp(4) },
  detailChip: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4), backgroundColor: "#F9FAFB", paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(8) },
  detailText: { fontSize: _rs.fs(11), color: "#6B7280" },
  address: { fontSize: _rs.fs(12), color: "#9CA3AF", marginBottom: _rs.sp(4) },
  dateText: { fontSize: _rs.fs(11), color: "#D1D5DB" },
});
