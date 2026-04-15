/**
 * Council Admin — GPS Tracking Screen
 * Live map showing all active drivers in province/city
 */
import { useState, useCallback, useEffect } from "react";
import {
  Text, View, TouchableOpacity, FlatList, StyleSheet,
  RefreshControl, Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface DriverLocation {
  driverId: string;
  driverName: string;
  zoneName?: string;
  latitude?: number;
  longitude?: number;
  isOnline: boolean;
  lastUpdated?: string;
  currentPickupId?: string;
  status?: string;
}

export default function CouncilGPSScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");

  const loadDriverLocations = useCallback(async () => {
    if (!adminUser?.province) return;
    try {
      const statusRaw = await AsyncStorage.getItem("@ltc_driver_status");
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const zonesRaw = await AsyncStorage.getItem("@ltc_service_zones");

      const driverStatuses: Record<string, any> = statusRaw ? JSON.parse(statusRaw) : {};
      const allUsers: Record<string, any> = usersRaw ? JSON.parse(usersRaw) : {};
      const allZones: any[] = zonesRaw ? JSON.parse(zonesRaw) : [];

      const scopedZoneIds = new Set(
        allZones
          .filter((z) => z.province === adminUser.province || z.town === adminUser.city || z.city === adminUser.city)
          .map((z) => z.id)
      );

      const scopedDrivers = Object.values(allUsers).filter(
        (u: any) =>
          u.role === "garbage_driver" &&
          (u.province === adminUser.province || u.city === adminUser.city ||
            (u.zoneId && scopedZoneIds.has(u.zoneId)))
      );

      const locations: DriverLocation[] = scopedDrivers.map((driver: any) => {
        const status = driverStatuses[driver.id];
        const zone = allZones.find((z) => z.id === driver.zoneId);
        return {
          driverId: driver.id,
          driverName: driver.fullName || driver.name || "Unknown Driver",
          zoneName: zone?.name || driver.zone,
          latitude: status?.latitude,
          longitude: status?.longitude,
          isOnline: status?.isOnline || false,
          lastUpdated: status?.lastUpdated,
          currentPickupId: status?.currentPickupId,
          status: driver.driverStatus,
        };
      });

      locations.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
      setDrivers(locations);
    } catch (e) { console.error(e); }
  }, [adminUser]);

  useFocusEffect(useCallback(() => { loadDriverLocations(); }, [loadDriverLocations]));

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadDriverLocations, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadDriverLocations]);

  const onRefresh = async () => { setRefreshing(true); await loadDriverLocations(); setRefreshing(false); };

  const filtered = drivers.filter((d) => {
    if (filter === "online") return d.isOnline;
    if (filter === "offline") return !d.isOnline;
    return true;
  });

  const onlineCount = drivers.filter((d) => d.isOnline).length;

  const formatLastSeen = (ts?: string) => {
    if (!ts) return "Never";
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>GPS Tracking</Text>
        <TouchableOpacity
          style={[styles.liveBtn, autoRefresh && styles.liveBtnActive]}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <View style={[styles.liveDot, { backgroundColor: autoRefresh ? "#fff" : "#9CA3AF" }]} />
          <Text style={[styles.liveBtnText, autoRefresh && styles.liveBtnTextActive]}>
            {autoRefresh ? "Live" : "Paused"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Online Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: onlineCount > 0 ? "#F0FDF4" : "#F9FAFB" }]}>
        <MaterialIcons
          name="location-on"
          size={18}
          color={onlineCount > 0 ? "#059669" : "#9CA3AF"}
        />
        <Text style={[styles.statusText, { color: onlineCount > 0 ? "#059669" : "#6B7280" }]}>
          {onlineCount} driver{onlineCount !== 1 ? "s" : ""} currently online
          {" · "}{drivers.length} total in {adminUser?.city}
        </Text>
      </View>

      {/* Map Placeholder */}
      <View style={styles.mapPlaceholder}>
        <MaterialIcons name="map" size={48} color="#D1D5DB" />
        <Text style={styles.mapText}>Live Map View</Text>
        <Text style={styles.mapSubText}>
          {onlineCount > 0
            ? `${onlineCount} active driver${onlineCount !== 1 ? "s" : ""} in ${adminUser?.city}`
            : "No drivers currently online"}
        </Text>
        {onlineCount > 0 && (
          <View style={styles.mapDriverDots}>
            {drivers.filter((d) => d.isOnline).slice(0, 5).map((d) => (
              <View key={d.driverId} style={styles.mapDriverDot}>
                <MaterialIcons name="local-shipping" size={16} color="#059669" />
              </View>
            ))}
          </View>
        )}
        <Text style={styles.mapNote}>
          Full map integration available in production build
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(["all", "online", "offline"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "online" && ` (${onlineCount})`}
              {f === "offline" && ` (${drivers.length - onlineCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.driverId}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="location-off" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No drivers found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.driverCard}>
            <View style={styles.driverRow}>
              <View style={[styles.driverAvatar, { backgroundColor: item.isOnline ? "#F0FDF4" : "#F9FAFB" }]}>
                <MaterialIcons name="local-shipping" size={20} color={item.isOnline ? "#059669" : "#9CA3AF"} />
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{item.driverName}</Text>
                {item.zoneName && <Text style={styles.driverZone}>{item.zoneName}</Text>}
              </View>
              <View style={[styles.onlineBadge, { backgroundColor: item.isOnline ? "#DCFCE7" : "#F3F4F6" }]}>
                <View style={[styles.onlineDot, { backgroundColor: item.isOnline ? "#059669" : "#9CA3AF" }]} />
                <Text style={[styles.onlineText, { color: item.isOnline ? "#166534" : "#6B7280" }]}>
                  {item.isOnline ? "Online" : "Offline"}
                </Text>
              </View>
            </View>
            <View style={styles.locationRow}>
              {item.latitude && item.longitude ? (
                <>
                  <MaterialIcons name="gps-fixed" size={13} color="#059669" />
                  <Text style={styles.coordText}>
                    {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                  </Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="gps-not-fixed" size={13} color="#9CA3AF" />
                  <Text style={styles.noCoordText}>Location not available</Text>
                </>
              )}
              <Text style={styles.lastSeenText}>Last seen: {formatLastSeen(item.lastUpdated)}</Text>
            </View>
            {item.currentPickupId && (
              <View style={styles.pickupChip}>
                <MaterialIcons name="recycling" size={12} color="#1D4ED8" />
                <Text style={styles.pickupChipText}>Active pickup #{item.currentPickupId.slice(-6).toUpperCase()}</Text>
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
  liveBtn: { flexDirection: "row", alignItems: "center", gap: _rs.sp(6), paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  liveBtnActive: { backgroundColor: "#DC2626" },
  liveDot: { width: _rs.s(6), height: _rs.s(6), borderRadius: _rs.s(3) },
  liveBtnText: { fontSize: _rs.fs(12), color: "#6B7280", fontWeight: "600" },
  liveBtnTextActive: { color: "#fff" },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), marginHorizontal: _rs.sp(16), marginBottom: _rs.sp(12), padding: _rs.sp(10), borderRadius: _rs.s(10) },
  statusText: { fontSize: _rs.fs(13), fontWeight: "500" },
  mapPlaceholder: { marginHorizontal: _rs.sp(16), marginBottom: _rs.sp(12), backgroundColor: "#F9FAFB", borderRadius: _rs.s(16), padding: _rs.sp(24), alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB", borderStyle: "dashed" },
  mapText: { fontSize: _rs.fs(16), fontWeight: "600", color: "#374151", marginTop: _rs.sp(8) },
  mapSubText: { fontSize: _rs.fs(13), color: "#6B7280", marginTop: _rs.sp(4) },
  mapDriverDots: { flexDirection: "row", gap: _rs.sp(8), marginTop: _rs.sp(12) },
  mapDriverDot: { width: _rs.s(32), height: _rs.s(32), borderRadius: _rs.s(16), backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center" },
  mapNote: { fontSize: _rs.fs(11), color: "#D1D5DB", marginTop: _rs.sp(12), textAlign: "center" },
  filterRow: { flexDirection: "row", paddingHorizontal: _rs.sp(16), gap: _rs.sp(8), marginBottom: _rs.sp(8) },
  filterTab: { flex: 1, paddingVertical: _rs.sp(7), borderRadius: _rs.s(10), backgroundColor: "#F3F4F6", alignItems: "center" },
  filterTabActive: { backgroundColor: "#EA580C" },
  filterText: { fontSize: _rs.fs(13), color: "#6B7280", fontWeight: "500" },
  filterTextActive: { color: "#fff" },
  list: { padding: _rs.sp(16), paddingTop: _rs.sp(8), gap: _rs.sp(10) },
  empty: { alignItems: "center", paddingVertical: _rs.sp(40), gap: _rs.sp(10) },
  emptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  driverCard: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), marginBottom: _rs.sp(8) },
  driverAvatar: { width: _rs.s(42), height: _rs.s(42), borderRadius: _rs.s(21), alignItems: "center", justifyContent: "center" },
  driverInfo: { flex: 1 },
  driverName: { fontSize: _rs.fs(15), fontWeight: "600", color: "#111827" },
  driverZone: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: _rs.sp(5), paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(4), borderRadius: _rs.s(12) },
  onlineDot: { width: _rs.s(6), height: _rs.s(6), borderRadius: _rs.s(3) },
  onlineText: { fontSize: _rs.fs(12), fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(6), marginBottom: _rs.sp(4) },
  coordText: { fontSize: _rs.fs(12), color: "#059669", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  noCoordText: { fontSize: _rs.fs(12), color: "#9CA3AF" },
  lastSeenText: { fontSize: _rs.fs(11), color: "#D1D5DB", marginLeft: "auto" },
  pickupChip: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4), backgroundColor: "#EFF6FF", paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(4), borderRadius: _rs.s(8), alignSelf: "flex-start" },
  pickupChipText: { fontSize: _rs.fs(11), color: "#1D4ED8", fontWeight: "500" },
});
