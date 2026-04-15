/**
 * Council Admin — Customers Screen
 * Province/city-scoped customer list with zone assignments
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
interface Customer {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  province?: string;
  city?: string;
  area?: string;
  zone?: string;
  zoneId?: string;
  role?: string;
  status?: string;
  subscriptionStatus?: string;
  createdAt?: string;
}

const FILTER_TABS = ["All", "Active", "Residential", "Commercial", "Industrial"] as const;
type FilterTab = typeof FILTER_TABS[number];

export default function CouncilCustomersScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("All");
  const [refreshing, setRefreshing] = useState(false);

  const loadCustomers = useCallback(async () => {
    if (!adminUser?.province) return;
    try {
      const raw = await AsyncStorage.getItem("@ltc_users_db");
      const allUsers: Record<string, any> = raw ? JSON.parse(raw) : {};
      const customerRoles = ["residential", "commercial", "industrial", "customer"];
      const scoped = Object.values(allUsers).filter(
        (u: any) =>
          customerRoles.includes(u.role) &&
          (u.province === adminUser.province || u.city === adminUser.city)
      );
      setCustomers(scoped as Customer[]);
    } catch (e) { console.error(e); }
  }, [adminUser]);

  useFocusEffect(useCallback(() => { loadCustomers(); }, [loadCustomers]));

  const onRefresh = async () => { setRefreshing(true); await loadCustomers(); setRefreshing(false); };

  const filtered = customers.filter((c) => {
    const name = c.fullName || `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || "";
    const matchSearch = !search ||
      name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search) ||
      (c.area || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "All" ? true :
      filter === "Active" ? c.status === "active" :
      filter === "Residential" ? c.role === "residential" :
      filter === "Commercial" ? c.role === "commercial" :
      filter === "Industrial" ? c.role === "industrial" : true;
    return matchSearch && matchFilter;
  });

  const getRoleIcon = (role?: string) => {
    switch (role) {
      case "commercial": return "business";
      case "industrial": return "factory";
      default: return "home";
    }
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case "commercial": return "#1D4ED8";
      case "industrial": return "#7C3AED";
      default: return "#D97706";
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Customers</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{customers.length} total</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, area..."
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
            <MaterialIcons name="people" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No customers found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const displayName = item.fullName ||
            `${item.firstName || ""} ${item.lastName || ""}`.trim() ||
            item.name || "Unknown";
          const roleColor = getRoleColor(item.role);
          const roleIcon = getRoleIcon(item.role);
          return (
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: roleColor + "15" }]}>
                  <MaterialIcons name={roleIcon as any} size={20} color={roleColor} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.customerName}>{displayName}</Text>
                  {item.phone && <Text style={styles.customerSub}>{item.phone}</Text>}
                  {item.email && <Text style={styles.customerSub}>{item.email}</Text>}
                </View>
                <View style={[styles.roleBadge, { backgroundColor: roleColor + "15" }]}>
                  <Text style={[styles.roleText, { color: roleColor }]}>
                    {item.role ? item.role.charAt(0).toUpperCase() + item.role.slice(1) : "Customer"}
                  </Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                {item.area && (
                  <View style={styles.detailChip}>
                    <MaterialIcons name="location-on" size={12} color="#6B7280" />
                    <Text style={styles.detailText}>{item.area}</Text>
                  </View>
                )}
                {item.zone && (
                  <View style={styles.detailChip}>
                    <MaterialIcons name="map" size={12} color="#6B7280" />
                    <Text style={styles.detailText}>{item.zone}</Text>
                  </View>
                )}
                {item.subscriptionStatus && (
                  <View style={[styles.detailChip, { backgroundColor: item.subscriptionStatus === "active" ? "#DCFCE7" : "#FEF3C7" }]}>
                    <Text style={[styles.detailText, { color: item.subscriptionStatus === "active" ? "#166534" : "#92400E" }]}>
                      {item.subscriptionStatus === "active" ? "Subscribed" : "No subscription"}
                    </Text>
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
  badge: { backgroundColor: "#FFFBEB", paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(4), borderRadius: _rs.s(20) },
  badgeText: { fontSize: _rs.fs(12), color: "#D97706", fontWeight: "500" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), margin: _rs.sp(16), marginTop: _rs.sp(8), backgroundColor: "#F9FAFB", borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(12), borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { flex: 1, height: _rs.s(40), fontSize: _rs.fs(14), color: "#111827" },
  tabs: { flexDirection: "row", paddingHorizontal: _rs.sp(16), gap: _rs.sp(6), marginBottom: _rs.sp(8) },
  tab: { paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  tabActive: { backgroundColor: "#D97706" },
  tabText: { fontSize: _rs.fs(12), color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  list: { padding: _rs.sp(16), paddingTop: _rs.sp(8), gap: _rs.sp(10) },
  empty: { alignItems: "center", paddingVertical: _rs.sp(40), gap: _rs.sp(10) },
  emptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  card: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), marginBottom: _rs.sp(8) },
  avatar: { width: _rs.s(42), height: _rs.s(42), borderRadius: _rs.s(21), alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  customerName: { fontSize: _rs.fs(15), fontWeight: "600", color: "#111827" },
  customerSub: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  roleBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(12) },
  roleText: { fontSize: _rs.fs(11), fontWeight: "600" },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: _rs.sp(6), marginBottom: _rs.sp(4) },
  detailChip: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4), backgroundColor: "#F9FAFB", paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(8) },
  detailText: { fontSize: _rs.fs(11), color: "#6B7280" },
  dateText: { fontSize: _rs.fs(11), color: "#D1D5DB" },
});
