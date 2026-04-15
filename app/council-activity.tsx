/**
 * Council Admin — Activity Logs Screen
 * Province/city-scoped event log with filtering
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
interface ActivityLog {
  id: string;
  eventType: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  zoneId?: string;
  zoneName?: string;
  province?: string;
  city?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
}

const EVENT_CATEGORIES = ["All", "Pickups", "Drivers", "Managers", "Customers", "Zones"] as const;
type EventCategory = typeof EVENT_CATEGORIES[number];

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  pickup_requested: { icon: "add-circle", color: "#1D4ED8" },
  pickup_assigned: { icon: "assignment-ind", color: "#7C3AED" },
  pickup_completed: { icon: "check-circle", color: "#059669" },
  driver_registered: { icon: "person-add", color: "#D97706" },
  driver_approved: { icon: "verified-user", color: "#059669" },
  driver_rejected: { icon: "person-remove", color: "#DC2626" },
  driver_suspended: { icon: "block", color: "#DC2626" },
  manager_registered: { icon: "person-add", color: "#7C3AED" },
  manager_approved: { icon: "verified-user", color: "#059669" },
  zone_created: { icon: "add-location", color: "#1D4ED8" },
  zone_updated: { icon: "edit-location", color: "#D97706" },
  customer_registered: { icon: "person-add", color: "#059669" },
};

function getEventIcon(eventType: string) {
  return EVENT_ICONS[eventType] || { icon: "info", color: "#6B7280" };
}

function getEventCategory(eventType: string): EventCategory {
  if (eventType.includes("pickup")) return "Pickups";
  if (eventType.includes("driver")) return "Drivers";
  if (eventType.includes("manager")) return "Managers";
  if (eventType.includes("customer")) return "Customers";
  if (eventType.includes("zone")) return "Zones";
  return "All";
}

export default function CouncilActivityScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EventCategory>("All");
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!adminUser?.province) return;
    try {
      const raw = await AsyncStorage.getItem("@ltc_activity_logs");
      const allLogs: ActivityLog[] = raw ? JSON.parse(raw) : [];
      const scoped = allLogs
        .filter((l) =>
          l.province === adminUser.province ||
          l.city === adminUser.city ||
          !l.province // include logs without province scoping
        )
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 200); // limit to recent 200
      setLogs(scoped);
    } catch (e) { console.error(e); }
  }, [adminUser]);

  useFocusEffect(useCallback(() => { loadLogs(); }, [loadLogs]));

  const onRefresh = async () => { setRefreshing(true); await loadLogs(); setRefreshing(false); };

  const filtered = logs.filter((l) => {
    const matchSearch = !search ||
      (l.eventType || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.userName || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      category === "All" ? true :
      getEventCategory(l.eventType) === category;
    return matchSearch && matchCategory;
  });

  const formatEventType = (type: string) =>
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const formatTime = (ts?: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>Activity Logs</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{logs.length} events</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.categoryScroll}>
        {EVENT_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.catTab, category === c && styles.catTabActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
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
            <MaterialIcons name="history" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No activity logs found</Text>
            <Text style={styles.emptySubText}>Events will appear here as operations occur</Text>
          </View>
        }
        renderItem={({ item }) => {
          const { icon, color } = getEventIcon(item.eventType);
          return (
            <View style={styles.logItem}>
              <View style={[styles.logIcon, { backgroundColor: color + "15" }]}>
                <MaterialIcons name={icon as any} size={16} color={color} />
              </View>
              <View style={styles.logContent}>
                <Text style={styles.logEvent}>{formatEventType(item.eventType)}</Text>
                {item.userName && (
                  <Text style={styles.logUser}>
                    {item.userName}
                    {item.userRole && <Text style={styles.logRole}> · {item.userRole}</Text>}
                  </Text>
                )}
                {item.description && <Text style={styles.logDesc}>{item.description}</Text>}
                {item.zoneName && (
                  <Text style={styles.logZone}>
                    <MaterialIcons name="map" size={11} color="#9CA3AF" /> {item.zoneName}
                  </Text>
                )}
              </View>
              <Text style={styles.logTime}>{formatTime(item.createdAt)}</Text>
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
  badge: { backgroundColor: "#F0F9FF", paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(4), borderRadius: _rs.s(20) },
  badgeText: { fontSize: _rs.fs(12), color: "#0891B2", fontWeight: "500" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), margin: _rs.sp(16), marginTop: _rs.sp(8), backgroundColor: "#F9FAFB", borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(12), borderWidth: 1, borderColor: "#E5E7EB" },
  searchInput: { flex: 1, height: _rs.s(40), fontSize: _rs.fs(14), color: "#111827" },
  categoryScroll: { flexDirection: "row", paddingHorizontal: _rs.sp(16), gap: _rs.sp(8), marginBottom: _rs.sp(8) },
  catTab: { paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  catTabActive: { backgroundColor: "#0891B2" },
  catText: { fontSize: _rs.fs(12), color: "#6B7280", fontWeight: "500" },
  catTextActive: { color: "#fff" },
  list: { padding: _rs.sp(16), paddingTop: _rs.sp(8), gap: _rs.sp(2) },
  empty: { alignItems: "center", paddingVertical: _rs.sp(40), gap: _rs.sp(8) },
  emptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  emptySubText: { fontSize: _rs.fs(12), color: "#D1D5DB", textAlign: "center" },
  logItem: { flexDirection: "row", alignItems: "flex-start", gap: _rs.sp(10), paddingVertical: _rs.sp(10), borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  logIcon: { width: _rs.s(32), height: _rs.s(32), borderRadius: _rs.s(8), alignItems: "center", justifyContent: "center", marginTop: _rs.sp(2) },
  logContent: { flex: 1 },
  logEvent: { fontSize: _rs.fs(13), fontWeight: "600", color: "#111827" },
  logUser: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  logRole: { fontSize: _rs.fs(11), color: "#9CA3AF" },
  logDesc: { fontSize: _rs.fs(12), color: "#9CA3AF", marginTop: _rs.sp(2) },
  logZone: { fontSize: _rs.fs(11), color: "#9CA3AF", marginTop: _rs.sp(2) },
  logTime: { fontSize: _rs.fs(11), color: "#D1D5DB", marginTop: _rs.sp(3) },
});
