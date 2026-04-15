/**
 * Council Admin Dashboard
 * Province/city-scoped operational overview
 * NO financial access — commission, wallet, payments are hidden
 */
import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface CouncilStats {
  totalZones: number;
  activeZones: number;
  unassignedZones: number;
  totalZoneManagers: number;
  activeManagers: number;
  pendingManagers: number;
  totalDrivers: number;
  activeDrivers: number;
  pendingDrivers: number;
  totalCustomers: number;
  activeCustomers: number;
  totalPickups: number;
  pendingPickups: number;
  completedPickups: number;
  inProgressPickups: number;
}

const DEFAULT_STATS: CouncilStats = {
  totalZones: 0, activeZones: 0, unassignedZones: 0,
  totalZoneManagers: 0, activeManagers: 0, pendingManagers: 0,
  totalDrivers: 0, activeDrivers: 0, pendingDrivers: 0,
  totalCustomers: 0, activeCustomers: 0,
  totalPickups: 0, pendingPickups: 0, completedPickups: 0, inProgressPickups: 0,
};

const MENU_ITEMS = [
  { id: "zones", title: "Zones", icon: "map" as const, route: "/council-zones", color: "#1D4ED8", desc: "View all zones in your area" },
  { id: "managers", title: "Zone Managers", icon: "manage-accounts" as const, route: "/council-managers", color: "#7C3AED", desc: "Managers & applications" },
  { id: "drivers", title: "Garbage Drivers", icon: "local-shipping" as const, route: "/council-drivers", color: "#059669", desc: "Driver status & activity" },
  { id: "customers", title: "Customers", icon: "people" as const, route: "/council-customers", color: "#D97706", desc: "Registered households" },
  { id: "pickups", title: "Pickups", icon: "recycling" as const, route: "/council-pickups", color: "#DC2626", desc: "Pickup operations" },
  { id: "activity", title: "Activity Logs", icon: "history" as const, route: "/council-activity", color: "#0891B2", desc: "All system events" },
  { id: "sanitation", title: "Sanitation Reports", icon: "assignment" as const, route: "/council-sanitation", color: "#65A30D", desc: "Health & compliance data" },
  { id: "gps", title: "GPS Tracking", icon: "location-on" as const, route: "/council-gps", color: "#EA580C", desc: "Live driver locations" },
  { id: "tonnage", title: "Tonnage Records", icon: "inventory" as const, route: "/council-tonnage", color: "#7C3AED", desc: "Waste collection data" },
  { id: "livemap", title: "Live City Map", icon: "location-city" as const, route: "/council-live-map", color: "#0F766E", desc: "Real-time driver GPS tracking" },
  { id: "export", title: "Data Export", icon: "download" as const, route: "/council-export", color: "#374151", desc: "CSV export for all data types" },
];

export default function CouncilAdminDashboard() {
  const router = useRouter();
  const { adminUser, logoutAdmin } = useAdmin();
  const [stats, setStats] = useState<CouncilStats>(DEFAULT_STATS);
  const [refreshing, setRefreshing] = useState(false);

  // Redirect if not council_admin
  useEffect(() => {
    if (adminUser && adminUser.role !== "council_admin") {
      router.replace("/admin-panel" as any);
    }
    if (!adminUser) {
      router.replace("/council-admin-login" as any);
    }
  }, [adminUser]);

  const loadStats = useCallback(async () => {
    if (!adminUser?.province || !adminUser?.city) return;
    try {
      const usersDb = await AsyncStorage.getItem("@ltc_users_db");
      const pickupsData = await AsyncStorage.getItem("ltc_pickups");
      const zonesData = await AsyncStorage.getItem("@ltc_service_zones");

      const province = adminUser.province;
      const city = adminUser.city;

      let users: any[] = [];
      let pickups: any[] = [];
      let zones: any[] = [];

      if (usersDb) users = Object.values(JSON.parse(usersDb));
      if (pickupsData) pickups = JSON.parse(pickupsData);
      if (zonesData) zones = JSON.parse(zonesData);

      // Filter by province/city
      const scopedUsers = users.filter((u: any) =>
        u.province === province || u.city === city
      );
      const scopedZones = zones.filter((z: any) =>
        z.province === province || z.city === city || z.town === city
      );
      const scopedPickups = pickups.filter((p: any) =>
        scopedZones.some((z: any) => z.id === p.zoneId)
      );

      const managers = scopedUsers.filter((u: any) => u.role === "zone_manager");
      const drivers = scopedUsers.filter((u: any) => u.role === "garbage_driver");
      const customers = scopedUsers.filter((u: any) =>
        u.role === "residential" || u.role === "commercial" || u.role === "customer"
      );

      setStats({
        totalZones: scopedZones.length,
        activeZones: scopedZones.filter((z: any) => z.status === "active").length,
        unassignedZones: scopedZones.filter((z: any) => !z.managerId).length,
        totalZoneManagers: managers.length,
        activeManagers: managers.filter((m: any) => m.status === "active").length,
        pendingManagers: managers.filter((m: any) => m.status === "pending_review").length,
        totalDrivers: drivers.length,
        activeDrivers: drivers.filter((d: any) => d.driverStatus === "active").length,
        pendingDrivers: drivers.filter((d: any) => d.driverStatus === "pending_manager_approval").length,
        totalCustomers: customers.length,
        activeCustomers: customers.filter((c: any) => c.status === "active").length,
        totalPickups: scopedPickups.length,
        pendingPickups: scopedPickups.filter((p: any) => p.status === "pending").length,
        completedPickups: scopedPickups.filter((p: any) => p.status === "completed").length,
        inProgressPickups: scopedPickups.filter((p: any) => p.status === "in_progress").length,
      });
    } catch (err) {
      console.error("Failed to load council stats:", err);
    }
  }, [adminUser]);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of the Council Admin Portal?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
        await logoutAdmin();
        router.replace("/(auth)/welcome" as any);
      }},
    ]);
  };

  if (!adminUser || adminUser.role !== "council_admin") return null;

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="account-balance" size={28} color="#1D4ED8" />
            </View>
            <View>
              <Text style={styles.headerTitle}>{adminUser.fullName}</Text>
              <Text style={styles.headerSub}>
                {adminUser.province} Province · {adminUser.city}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialIcons name="logout" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>

        {/* Scope Badge */}
        <View style={styles.scopeBadge}>
          <MaterialIcons name="location-on" size={14} color="#1D4ED8" />
          <Text style={styles.scopeText}>
            Viewing: {adminUser.city}, {adminUser.province} Province only
          </Text>
        </View>

        {/* Stats Grid */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard label="Total Zones" value={stats.totalZones} sub={`${stats.activeZones} active`} color="#1D4ED8" icon="map" />
          <StatCard label="Zone Managers" value={stats.totalZoneManagers} sub={`${stats.pendingManagers} pending`} color="#7C3AED" icon="manage-accounts" />
          <StatCard label="Drivers" value={stats.totalDrivers} sub={`${stats.activeDrivers} active`} color="#059669" icon="local-shipping" />
          <StatCard label="Customers" value={stats.totalCustomers} sub={`${stats.activeCustomers} active`} color="#D97706" icon="people" />
          <StatCard label="Total Pickups" value={stats.totalPickups} sub={`${stats.inProgressPickups} in progress`} color="#DC2626" icon="recycling" />
          <StatCard label="Completed" value={stats.completedPickups} sub={`${stats.pendingPickups} pending`} color="#0891B2" icon="check-circle" />
        </View>

        {/* Alerts */}
        {(stats.pendingManagers > 0 || stats.unassignedZones > 0 || stats.pendingDrivers > 0) && (
          <View style={styles.alertsSection}>
            <Text style={styles.sectionTitle}>Attention Required</Text>
            {stats.pendingManagers > 0 && (
              <TouchableOpacity style={styles.alertCard} onPress={() => router.push("/council-managers" as any)}>
                <MaterialIcons name="warning" size={18} color="#D97706" />
                <Text style={styles.alertText}>{stats.pendingManagers} Zone Manager application(s) pending review</Text>
                <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            {stats.unassignedZones > 0 && (
              <TouchableOpacity style={styles.alertCard} onPress={() => router.push("/council-zones" as any)}>
                <MaterialIcons name="warning" size={18} color="#DC2626" />
                <Text style={styles.alertText}>{stats.unassignedZones} zone(s) have no assigned manager</Text>
                <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            {stats.pendingDrivers > 0 && (
              <TouchableOpacity style={styles.alertCard} onPress={() => router.push("/council-drivers" as any)}>
                <MaterialIcons name="info" size={18} color="#0891B2" />
                <Text style={styles.alertText}>{stats.pendingDrivers} driver(s) awaiting manager approval</Text>
                <MaterialIcons name="chevron-right" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Navigation Menu */}
        <Text style={styles.sectionTitle}>Management Modules</Text>
        <View style={styles.menuGrid}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + "15" }]}>
                <MaterialIcons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <MaterialIcons name="security" size={16} color="#6B7280" />
          <Text style={styles.securityText}>
            Financial data, commission settings, and platform wallet are restricted from Council Admin access.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: number; sub: string; color: string; icon: any }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  scroll: { padding: _rs.sp(16), paddingBottom: _rs.sp(32) },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: _rs.sp(12) },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12) },
  iconWrap: { width: _rs.s(48), height: _rs.s(48), borderRadius: _rs.s(12), backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: _rs.fs(16), fontWeight: "700", color: "#111827" },
  headerSub: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(2) },
  logoutBtn: { padding: _rs.sp(8) },
  scopeBadge: {
    flexDirection: "row", alignItems: "center", gap: _rs.sp(6),
    backgroundColor: "#EFF6FF", paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(8),
    borderRadius: _rs.s(10), borderWidth: 1, borderColor: "#BFDBFE", marginBottom: _rs.sp(20),
  },
  scopeText: { fontSize: _rs.fs(13), color: "#1D4ED8", fontWeight: "500" },
  sectionTitle: { fontSize: _rs.fs(15), fontWeight: "600", color: "#374151", marginBottom: _rs.sp(12), marginTop: _rs.sp(4) },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: _rs.sp(10), marginBottom: _rs.sp(20) },
  statCard: {
    width: "47%", backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14),
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statIcon: { width: _rs.s(40), height: _rs.s(40), borderRadius: _rs.s(10), alignItems: "center", justifyContent: "center", marginBottom: _rs.sp(8) },
  statValue: { fontSize: _rs.fs(24), fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: _rs.fs(12), color: "#6B7280", textAlign: "center", marginTop: _rs.sp(2) },
  statSub: { fontSize: _rs.fs(11), color: "#9CA3AF", textAlign: "center", marginTop: _rs.sp(2) },
  alertsSection: { marginBottom: _rs.sp(20) },
  alertCard: {
    flexDirection: "row", alignItems: "center", gap: _rs.sp(10),
    backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A",
    borderRadius: _rs.s(10), padding: _rs.sp(12), marginBottom: _rs.sp(8),
  },
  alertText: { flex: 1, fontSize: _rs.fs(13), color: "#92400E" },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: _rs.sp(10), marginBottom: _rs.sp(20) },
  menuCard: {
    width: "47%", backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14),
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  menuIcon: { width: _rs.s(44), height: _rs.s(44), borderRadius: _rs.s(11), alignItems: "center", justifyContent: "center", marginBottom: _rs.sp(10) },
  menuTitle: { fontSize: _rs.fs(13), fontWeight: "600", color: "#111827", marginBottom: _rs.sp(3) },
  menuDesc: { fontSize: _rs.fs(11), color: "#9CA3AF", lineHeight: _rs.fs(15) },
  securityNotice: {
    flexDirection: "row", gap: _rs.sp(8), alignItems: "flex-start",
    backgroundColor: "#F9FAFB", borderRadius: _rs.s(10), padding: _rs.sp(12),
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  securityText: { flex: 1, fontSize: _rs.fs(12), color: "#6B7280", lineHeight: _rs.fs(18) },
});
