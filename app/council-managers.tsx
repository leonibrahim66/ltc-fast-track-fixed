/**
 * Council Admin — Zone Managers Screen
 * Province/city-scoped zone manager list with approval status
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
interface Manager {
  id: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  province?: string;
  city?: string;
  zone?: string;
  status?: string;
  createdAt?: string;
}

const FILTER_TABS = ["All", "Active", "Pending", "Rejected"] as const;
type FilterTab = typeof FILTER_TABS[number];

export default function CouncilManagersScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("All");
  const [refreshing, setRefreshing] = useState(false);

  const loadManagers = useCallback(async () => {
    if (!adminUser?.province) return;
    try {
      const raw = await AsyncStorage.getItem("@ltc_users_db");
      const allUsers: Record<string, any> = raw ? JSON.parse(raw) : {};
      const scoped = Object.values(allUsers).filter(
        (u: any) =>
          (u.role === "zone_manager" || u.role === "collector") &&
          (u.province === adminUser.province || u.city === adminUser.city)
      );
      setManagers(scoped as Manager[]);
    } catch (e) { console.error(e); }
  }, [adminUser]);

  useFocusEffect(useCallback(() => { loadManagers(); }, [loadManagers]));

  const onRefresh = async () => { setRefreshing(true); await loadManagers(); setRefreshing(false); };

  const filtered = managers.filter((m) => {
    const name = m.fullName || m.name || "";
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "All" ? true :
      filter === "Active" ? m.status === "active" :
      filter === "Pending" ? m.status === "pending_review" :
      filter === "Rejected" ? m.status === "rejected" : true;
    return matchSearch && matchFilter;
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "active": return { bg: "#DCFCE7", text: "#166534" };
      case "pending_review": return { bg: "#FEF3C7", text: "#92400E" };
      case "rejected": return { bg: "#FEE2E2", text: "#991B1B" };
      default: return { bg: "#F3F4F6", text: "#6B7280" };
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Zone Managers</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{managers.length} total</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search managers..."
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
            <MaterialIcons name="manage-accounts" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No zone managers found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = getStatusColor(item.status);
          const displayName = item.fullName || item.name || "Unknown";
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.managerName}>{displayName}</Text>
                  {item.email && <Text style={styles.managerEmail}>{item.email}</Text>}
                  {item.phone && <Text style={styles.managerPhone}>{item.phone}</Text>}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>
                    {item.status === "pending_review" ? "Pending" : (item.status || "Unknown")}
                  </Text>
                </View>
              </View>
              {(item.province || item.zone) && (
                <View style={styles.locationRow}>
                  <MaterialIcons name="location-on" size={13} color="#9CA3AF" />
                  <Text style={styles.locationText}>
                    {[item.zone, item.city, item.province].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              )}
              {item.createdAt && (
                <Text style={styles.dateText}>
                  Registered: {new Date(item.createdAt).toLocaleDateString()}
                </Text>
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
  badge: { backgroundColor: "#F3F4F6", paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(4), borderRadius: _rs.s(20) },
  badgeText: { fontSize: _rs.fs(12), color: "#6B7280", fontWeight: "500" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), margin: _rs.sp(16), marginTop: _rs.sp(8), backgroundColor: "#F9FAFB", borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(12), borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { flex: 1, height: _rs.s(40), fontSize: _rs.fs(14), color: "#111827" },
  tabs: { flexDirection: "row", paddingHorizontal: _rs.sp(16), gap: _rs.sp(8), marginBottom: _rs.sp(8) },
  tab: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  tabActive: { backgroundColor: "#7C3AED" },
  tabText: { fontSize: _rs.fs(13), color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  list: { padding: _rs.sp(16), paddingTop: _rs.sp(8), gap: _rs.sp(10) },
  empty: { alignItems: "center", paddingVertical: _rs.sp(40), gap: _rs.sp(10) },
  emptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  card: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), marginBottom: _rs.sp(8) },
  avatar: { width: _rs.s(42), height: _rs.s(42), borderRadius: _rs.s(21), backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: _rs.fs(18), fontWeight: "700", color: "#7C3AED" },
  cardInfo: { flex: 1 },
  managerName: { fontSize: _rs.fs(15), fontWeight: "600", color: "#111827" },
  managerEmail: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  managerPhone: { fontSize: _rs.fs(12), color: "#6B7280" },
  statusBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(12) },
  statusText: { fontSize: _rs.fs(11), fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4), marginBottom: _rs.sp(4) },
  locationText: { fontSize: _rs.fs(12), color: "#9CA3AF" },
  dateText: { fontSize: _rs.fs(11), color: "#D1D5DB" },
});
