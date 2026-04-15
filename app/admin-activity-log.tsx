/**
 * Admin Activity Log Screen
 *
 * Shows all logged driver/zone events:
 * - driver_registered
 * - driver_approved
 * - driver_rejected
 * - pickup_assigned
 * - pickup_started
 * - pickup_completed
 *
 * Visible in Admin Zone Panel and Super Admin Panel.
 * Filterable by event type and zone.
 */
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

import { getStaticResponsive } from "@/hooks/use-responsive";
const ADMIN_BLUE = "#1E3A5F";

type EventType =
  | "all"
  | "driver_registered"
  | "driver_approved"
  | "driver_rejected"
  | "pickup_assigned"
  | "pickup_started"
  | "pickup_completed";

interface ActivityLog {
  id: string;
  type: string;
  driverName?: string;
  driverId?: string;
  managerId?: string;
  managerName?: string;
  zoneId?: string;
  pickupId?: string;
  householdName?: string;
  timestamp: string;
}

const EVENT_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  driver_registered: { label: "Driver Registered", icon: "person-add", color: "#2563EB", bg: "#DBEAFE" },
  driver_approved: { label: "Driver Approved", icon: "verified-user", color: "#16A34A", bg: "#DCFCE7" },
  driver_rejected: { label: "Driver Rejected", icon: "person-off", color: "#EF4444", bg: "#FEE2E2" },
  pickup_assigned: { label: "Pickup Assigned", icon: "assignment", color: "#D97706", bg: "#FEF3C7" },
  pickup_started: { label: "Pickup Started", icon: "local-shipping", color: "#7C3AED", bg: "#EDE9FE" },
  pickup_completed: { label: "Pickup Completed", icon: "check-circle", color: "#16A34A", bg: "#DCFCE7" },
};

const FILTER_TYPES: { key: EventType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "driver_registered", label: "Registered" },
  { key: "driver_approved", label: "Approved" },
  { key: "driver_rejected", label: "Rejected" },
  { key: "pickup_started", label: "Started" },
  { key: "pickup_completed", label: "Completed" },
];

export default function AdminActivityLogScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<EventType>("all");
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    try {
      const logsRaw = await AsyncStorage.getItem("@ltc_activity_logs");
      const allLogs: ActivityLog[] = logsRaw ? JSON.parse(logsRaw) : [];
      setLogs(allLogs);
    } catch (_e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLogs();
    }, [fetchLogs])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filter === "all" || log.type === filter;
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      log.driverName?.toLowerCase().includes(searchLower) ||
      log.managerName?.toLowerCase().includes(searchLower) ||
      log.zoneId?.toLowerCase().includes(searchLower) ||
      log.householdName?.toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return ts;
    }
  };

  const renderLog = ({ item }: { item: ActivityLog }) => {
    const config = EVENT_CONFIG[item.type] ?? {
      label: item.type.replace(/_/g, " "),
      icon: "info",
      color: "#6B7280",
      bg: "#F3F4F6",
    };

    return (
      <View style={styles.logCard}>
        <View style={[styles.iconWrap, { backgroundColor: config.bg }]}>
          <MaterialIcons name={config.icon as any} size={20} color={config.color} />
        </View>
        <View style={styles.logContent}>
          <View style={styles.logHeader}>
            <Text style={[styles.logType, { color: config.color }]}>{config.label}</Text>
            <Text style={styles.logTime}>{formatTimestamp(item.timestamp)}</Text>
          </View>
          {item.driverName && (
            <Text style={styles.logDetail}>
              <Text style={styles.logLabel}>Driver: </Text>
              {item.driverName}
            </Text>
          )}
          {item.managerName && (
            <Text style={styles.logDetail}>
              <Text style={styles.logLabel}>Zone Manager: </Text>
              {item.managerName}
            </Text>
          )}
          {item.zoneId && (
            <Text style={styles.logDetail}>
              <Text style={styles.logLabel}>Zone: </Text>
              {item.zoneId}
            </Text>
          )}
          {item.householdName && (
            <Text style={styles.logDetail}>
              <Text style={styles.logLabel}>Household: </Text>
              {item.householdName}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View style={[styles.header, { backgroundColor: ADMIN_BLUE }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <MaterialIcons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Activity Log</Text>
          <Text style={styles.headerSubtitle}>{filteredLogs.length} events</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={18} color="#9BA1A6" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by driver, manager, zone..."
          placeholderTextColor="#9BA1A6"
          style={styles.searchInput}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <MaterialIcons name="close" size={18} color="#9BA1A6" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTER_TYPES.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Log list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ADMIN_BLUE} />
          <Text style={styles.loadingText}>Loading activity log...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          keyExtractor={(item) => item.id}
          renderItem={renderLog}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ADMIN_BLUE} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="history" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No activity logs</Text>
              <Text style={styles.emptySubtext}>
                Events will appear here as drivers register, get approved, and complete pickups.
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(16),
    paddingTop: _rs.sp(16),
    paddingBottom: _rs.sp(16),
  },
  backBtn: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: _rs.sp(12),
  },
  headerText: { flex: 1 },
  headerTitle: { color: "white", fontSize: _rs.fs(20), fontWeight: "700" },
  headerSubtitle: { color: "rgba(255,255,255,0.75)", fontSize: _rs.fs(13), marginTop: _rs.sp(2) },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(10),
    gap: _rs.sp(8),
  },
  searchInput: {
    flex: 1,
    fontSize: _rs.fs(14),
    color: "#11181C",
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(10),
    gap: _rs.sp(8),
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "white",
  },
  filterChip: {
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(5),
    borderRadius: _rs.s(20),
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: ADMIN_BLUE,
    borderColor: ADMIN_BLUE,
  },
  filterChipText: { fontSize: _rs.fs(12), fontWeight: "600", color: "#6B7280" },
  filterChipTextActive: { color: "white" },
  listContent: { padding: _rs.sp(16), paddingBottom: _rs.sp(32) },
  logCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: _rs.s(14),
    padding: _rs.sp(14),
    marginBottom: _rs.sp(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  iconWrap: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    alignItems: "center",
    justifyContent: "center",
    marginRight: _rs.sp(12),
    flexShrink: 0,
  },
  logContent: { flex: 1 },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: _rs.sp(4),
  },
  logType: { fontSize: _rs.fs(13), fontWeight: "700" },
  logTime: { fontSize: _rs.fs(11), color: "#9BA1A6" },
  logDetail: { fontSize: _rs.fs(12), color: "#687076", marginTop: _rs.sp(2) },
  logLabel: { fontWeight: "600", color: "#374151" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: _rs.sp(32) },
  loadingText: { color: "#9BA1A6", marginTop: _rs.sp(12), fontSize: _rs.fs(14) },
  emptyContainer: { alignItems: "center", paddingTop: _rs.sp(60), paddingHorizontal: _rs.sp(32) },
  emptyTitle: { fontSize: _rs.fs(18), fontWeight: "700", color: "#6B7280", marginTop: _rs.sp(16) },
  emptySubtext: {
    fontSize: _rs.fs(14),
    color: "#9BA1A6",
    textAlign: "center",
    marginTop: _rs.sp(8),
    lineHeight: _rs.fs(20),
  },
});
