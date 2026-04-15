/**
 * Council Admin — Zones Screen
 * Province/city-scoped zone list with manager assignment status
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
interface Zone {
  id: string;
  name: string;
  province: string;
  town: string;
  city?: string;
  status: string;
  managerId?: string;
  managerName?: string;
  householdCount?: number;
  driverCount?: number;
}

const FILTER_TABS = ["All", "Active", "Unassigned", "Inactive"] as const;
type FilterTab = typeof FILTER_TABS[number];

export default function CouncilZonesScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("All");
  const [refreshing, setRefreshing] = useState(false);

  const loadZones = useCallback(async () => {
    if (!adminUser?.province || !adminUser?.city) return;
    try {
      const raw = await AsyncStorage.getItem("@ltc_service_zones");
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const allZones: Zone[] = raw ? JSON.parse(raw) : [];
      const allUsers: Record<string, any> = usersRaw ? JSON.parse(usersRaw) : {};

      const scoped = allZones.filter(
        (z) => z.province === adminUser.province || z.town === adminUser.city || z.city === adminUser.city
      );

      const enriched = scoped.map((z) => {
        const manager = z.managerId ? allUsers[z.managerId] : null;
        return { ...z, managerName: manager?.fullName || manager?.name || undefined };
      });

      setZones(enriched);
    } catch (e) { console.error(e); }
  }, [adminUser]);

  useFocusEffect(useCallback(() => { loadZones(); }, [loadZones]));

  const onRefresh = async () => { setRefreshing(true); await loadZones(); setRefreshing(false); };

  const filtered = zones.filter((z) => {
    const matchSearch = !search || z.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "All" ? true :
      filter === "Active" ? z.status === "active" :
      filter === "Unassigned" ? !z.managerId :
      filter === "Inactive" ? z.status !== "active" : true;
    return matchSearch && matchFilter;
  });

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Zones</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{adminUser?.city}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search zones..."
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
            <MaterialIcons name="map" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No zones found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={[styles.statusDot, { backgroundColor: item.status === "active" ? "#22C55E" : "#9CA3AF" }]} />
              <Text style={styles.zoneName}>{item.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: item.status === "active" ? "#DCFCE7" : "#F3F4F6" }]}>
                <Text style={[styles.statusText, { color: item.status === "active" ? "#166534" : "#6B7280" }]}>
                  {item.status || "unknown"}
                </Text>
              </View>
            </View>
            <Text style={styles.zoneLocation}>
              <MaterialIcons name="location-on" size={12} color="#9CA3AF" /> {item.town}, {item.province}
            </Text>
            {item.managerName ? (
              <View style={styles.managerRow}>
                <MaterialIcons name="person" size={14} color="#1D4ED8" />
                <Text style={styles.managerName}>{item.managerName}</Text>
              </View>
            ) : (
              <View style={styles.managerRow}>
                <MaterialIcons name="person-off" size={14} color="#DC2626" />
                <Text style={styles.noManager}>No manager assigned</Text>
              </View>
            )}
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12), padding: _rs.sp(16), paddingBottom: _rs.sp(8) },
  backBtn: { padding: _rs.sp(4) },
  title: { fontSize: _rs.fs(18), fontWeight: "700", color: "#111827", flex: 1 },
  badge: { backgroundColor: "#EFF6FF", paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(4), borderRadius: _rs.s(20) },
  badgeText: { fontSize: _rs.fs(12), color: "#1D4ED8", fontWeight: "500" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), margin: _rs.sp(16), marginTop: _rs.sp(8), backgroundColor: "#F9FAFB", borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(12), borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { flex: 1, height: _rs.s(40), fontSize: _rs.fs(14), color: "#111827" },
  tabs: { flexDirection: "row", paddingHorizontal: _rs.sp(16), gap: _rs.sp(8), marginBottom: _rs.sp(8) },
  tab: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  tabActive: { backgroundColor: "#1D4ED8" },
  tabText: { fontSize: _rs.fs(13), color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  list: { padding: _rs.sp(16), paddingTop: _rs.sp(8), gap: _rs.sp(10) },
  empty: { alignItems: "center", paddingVertical: _rs.sp(40), gap: _rs.sp(10) },
  emptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  card: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), marginBottom: _rs.sp(6) },
  statusDot: { width: _rs.s(8), height: _rs.s(8), borderRadius: _rs.s(4) },
  zoneName: { flex: 1, fontSize: _rs.fs(15), fontWeight: "600", color: "#111827" },
  statusBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(12) },
  statusText: { fontSize: _rs.fs(11), fontWeight: "500" },
  zoneLocation: { fontSize: _rs.fs(12), color: "#9CA3AF", marginBottom: _rs.sp(6) },
  managerRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(6) },
  managerName: { fontSize: _rs.fs(13), color: "#1D4ED8", fontWeight: "500" },
  noManager: { fontSize: _rs.fs(13), color: "#DC2626" },
});
