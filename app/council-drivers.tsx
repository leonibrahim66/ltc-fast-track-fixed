/**
 * Council Admin — Garbage Drivers Screen
 * Province/city-scoped driver list with status and zone info
 */
import { useState, useCallback } from "react";
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
interface Driver {
  id: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  province?: string;
  city?: string;
  zone?: string;
  zoneId?: string;
  driverStatus?: string;
  vehicleType?: string;
  licenseNumber?: string;
  nrcNumber?: string;
  createdAt?: string;
}

const FILTER_TABS = ["All", "Active", "Pending", "Suspended"] as const;
type FilterTab = typeof FILTER_TABS[number];

export default function CouncilDriversScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("All");
  const [refreshing, setRefreshing] = useState(false);

  const loadDrivers = useCallback(async () => {
    if (!adminUser?.province) return;
    try {
      const raw = await AsyncStorage.getItem("@ltc_users_db");
      const allUsers: Record<string, any> = raw ? JSON.parse(raw) : {};
      const scoped = Object.values(allUsers).filter(
        (u: any) =>
          u.role === "garbage_driver" &&
          (u.province === adminUser.province || u.city === adminUser.city)
      );
      setDrivers(scoped as Driver[]);
    } catch (e) { console.error(e); }
  }, [adminUser]);

  useFocusEffect(useCallback(() => { loadDrivers(); }, [loadDrivers]));

  const onRefresh = async () => { setRefreshing(true); await loadDrivers(); setRefreshing(false); };

  const filtered = drivers.filter((d) => {
    const name = d.fullName || d.name || "";
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) ||
      (d.licenseNumber || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "All" ? true :
      filter === "Active" ? d.driverStatus === "active" :
      filter === "Pending" ? (d.driverStatus === "pending_manager_approval" || d.driverStatus === "pending") :
      filter === "Suspended" ? d.driverStatus === "suspended" : true;
    return matchSearch && matchFilter;
  });

  const getStatusInfo = (status?: string) => {
    switch (status) {
      case "active": return { bg: "#DCFCE7", text: "#166534", label: "Active" };
      case "pending_manager_approval": return { bg: "#FEF3C7", text: "#92400E", label: "Pending" };
      case "suspended": return { bg: "#FEE2E2", text: "#991B1B", label: "Suspended" };
      default: return { bg: "#F3F4F6", text: "#6B7280", label: status || "Unknown" };
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Garbage Drivers</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{drivers.length} total</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or license..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.tabs}>
        {FILTER_TABS.map((t) => (
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
            <MaterialIcons name="local-shipping" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No drivers found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const si = getStatusInfo(item.driverStatus);
          const displayName = item.fullName || item.name || "Unknown";
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <MaterialIcons name="local-shipping" size={20} color="#059669" />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.driverName}>{displayName}</Text>
                  {item.phone && <Text style={styles.driverSub}>{item.phone}</Text>}
                  {item.vehicleType && <Text style={styles.driverSub}>Vehicle: {item.vehicleType}</Text>}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: si.bg }]}>
                  <Text style={[styles.statusText, { color: si.text }]}>{si.label}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                {item.licenseNumber && (
                  <View style={styles.detailChip}>
                    <MaterialIcons name="badge" size={12} color="#6B7280" />
                    <Text style={styles.detailText}>License: {item.licenseNumber}</Text>
                  </View>
                )}
                {item.zone && (
                  <View style={styles.detailChip}>
                    <MaterialIcons name="map" size={12} color="#6B7280" />
                    <Text style={styles.detailText}>{item.zone}</Text>
                  </View>
                )}
              </View>
              {item.createdAt && (
                <Text style={styles.dateText}>Joined: {new Date(item.createdAt).toLocaleDateString()}</Text>
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
  badge: { backgroundColor: "#F0FDF4", paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(4), borderRadius: _rs.s(20) },
  badgeText: { fontSize: _rs.fs(12), color: "#059669", fontWeight: "500" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), margin: _rs.sp(16), marginTop: _rs.sp(8), backgroundColor: "#F9FAFB", borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(12), borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { flex: 1, height: _rs.s(40), fontSize: _rs.fs(14), color: "#111827" },
  tabs: { flexDirection: "row", paddingHorizontal: _rs.sp(16), gap: _rs.sp(8), marginBottom: _rs.sp(8) },
  tab: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  tabActive: { backgroundColor: "#059669" },
  tabText: { fontSize: _rs.fs(13), color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  list: { padding: _rs.sp(16), paddingTop: _rs.sp(8), gap: _rs.sp(10) },
  empty: { alignItems: "center", paddingVertical: _rs.sp(40), gap: _rs.sp(10) },
  emptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  card: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), marginBottom: _rs.sp(8) },
  avatar: { width: _rs.s(42), height: _rs.s(42), borderRadius: _rs.s(21), backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  driverName: { fontSize: _rs.fs(15), fontWeight: "600", color: "#111827" },
  driverSub: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  statusBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(12) },
  statusText: { fontSize: _rs.fs(11), fontWeight: "600" },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: _rs.sp(8), marginBottom: _rs.sp(4) },
  detailChip: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4), backgroundColor: "#F9FAFB", paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(8) },
  detailText: { fontSize: _rs.fs(11), color: "#6B7280" },
  dateText: { fontSize: _rs.fs(11), color: "#D1D5DB" },
});
