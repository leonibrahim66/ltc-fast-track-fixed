/**
 * Council Admin — Live City Map
 * Province/city-scoped real-time driver GPS tracking with zone filter,
 * online/offline status, and active pickup routes.
 *
 * Uses: @ltc_driver_status, ltc_pickups, @ltc_service_zones, @ltc_users_db
 * Security: All data filtered by adminUser.province + adminUser.city
 * Financial access: NONE
 */
import { useState, useCallback, useEffect, useRef } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Animated,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface DriverPin {
  driverId: string;
  driverName: string;
  phone?: string;
  zoneId?: string;
  zoneName?: string;
  latitude?: number;
  longitude?: number;
  isOnline: boolean;
  lastUpdated?: string;
  currentPickupId?: string;
  pickupStatus?: string;
  pickupAddress?: string;
  driverStatus?: string;
}

interface ZoneOption {
  id: string;
  name: string;
  driverCount: number;
  onlineCount: number;
}

const REFRESH_INTERVAL = 10000; // 10 seconds

export default function CouncilLiveMapScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const [drivers, setDrivers] = useState<DriverPin[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedDriver, setSelectedDriver] = useState<DriverPin | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for live indicator
  useEffect(() => {
    if (!autoRefresh) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [autoRefresh, pulseAnim]);

  const loadData = useCallback(async () => {
    if (!adminUser?.province) return;
    try {
      const [statusRaw, usersRaw, zonesRaw, pickupsRaw] = await Promise.all([
        AsyncStorage.getItem("@ltc_driver_status"),
        AsyncStorage.getItem("@ltc_users_db"),
        AsyncStorage.getItem("@ltc_service_zones"),
        AsyncStorage.getItem("ltc_pickups"),
      ]);

      const driverStatuses: Record<string, any> = statusRaw ? JSON.parse(statusRaw) : {};
      const allUsers: Record<string, any> = usersRaw ? JSON.parse(usersRaw) : {};
      const allZones: any[] = zonesRaw ? JSON.parse(zonesRaw) : [];
      const allPickups: any[] = pickupsRaw ? JSON.parse(pickupsRaw) : [];

      // Scope zones to this province/city
      const scopedZones = allZones.filter(
        (z) =>
          z.province === adminUser.province ||
          z.town === adminUser.city ||
          z.city === adminUser.city
      );
      const scopedZoneIds = new Set(scopedZones.map((z) => z.id));

      // Scope drivers
      const scopedDrivers = Object.values(allUsers).filter(
        (u: any) =>
          u.role === "garbage_driver" &&
          (u.province === adminUser.province ||
            u.city === adminUser.city ||
            (u.zoneId && scopedZoneIds.has(u.zoneId)))
      );

      // Build driver pins with GPS + pickup info
      const pins: DriverPin[] = scopedDrivers.map((driver: any) => {
        const status = driverStatuses[driver.id];
        const zone = allZones.find((z) => z.id === driver.zoneId);
        const activePickup = allPickups.find(
          (p) => p.driverId === driver.id && ["assigned", "accepted", "in_progress"].includes(p.status)
        );
        return {
          driverId: driver.id,
          driverName: driver.fullName || driver.name || "Unknown Driver",
          phone: driver.phone,
          zoneId: driver.zoneId,
          zoneName: zone?.name || driver.zone,
          latitude: status?.latitude ?? (driver.latitude ? parseFloat(driver.latitude) : undefined),
          longitude: status?.longitude ?? (driver.longitude ? parseFloat(driver.longitude) : undefined),
          isOnline: status?.isOnline || false,
          lastUpdated: status?.lastUpdated,
          currentPickupId: activePickup?.id,
          pickupStatus: activePickup?.status,
          pickupAddress: activePickup?.address || activePickup?.location,
          driverStatus: driver.driverStatus || driver.status,
        };
      });

      pins.sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
      setDrivers(pins);
      setLastRefresh(new Date());

      // Build zone options with counts
      const zoneOptions: ZoneOption[] = scopedZones.map((z) => {
        const zonePins = pins.filter((p) => p.zoneId === z.id);
        return {
          id: z.id,
          name: z.name,
          driverCount: zonePins.length,
          onlineCount: zonePins.filter((p) => p.isOnline).length,
        };
      });
      setZones(zoneOptions);
    } catch (e) {
      console.error("LiveMap load error:", e);
    }
  }, [adminUser]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredDrivers =
    selectedZoneId === "all"
      ? drivers
      : drivers.filter((d) => d.zoneId === selectedZoneId);

  const onlineCount = filteredDrivers.filter((d) => d.isOnline).length;
  const activePickupCount = filteredDrivers.filter((d) => d.currentPickupId).length;

  const formatLastSeen = (ts?: string) => {
    if (!ts) return "Never";
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const getStatusColor = (driver: DriverPin) => {
    if (!driver.isOnline) return "#9CA3AF";
    if (driver.currentPickupId) return "#DC2626";
    return "#059669";
  };

  const getStatusLabel = (driver: DriverPin) => {
    if (!driver.isOnline) return "Offline";
    if (driver.pickupStatus === "in_progress") return "On Route";
    if (driver.pickupStatus === "accepted") return "Accepted";
    if (driver.pickupStatus === "assigned") return "Assigned";
    return "Available";
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Live City Map</Text>
          <Text style={styles.subtitle}>{adminUser?.city}, {adminUser?.province}</Text>
        </View>
        <TouchableOpacity
          style={[styles.liveBtn, autoRefresh && styles.liveBtnActive]}
          onPress={() => setAutoRefresh(!autoRefresh)}
        >
          <Animated.View style={[styles.liveDot, { transform: [{ scale: autoRefresh ? pulseAnim : 1 }], backgroundColor: autoRefresh ? "#fff" : "#9CA3AF" }]} />
          <Text style={[styles.liveBtnText, autoRefresh && styles.liveBtnTextActive]}>
            {autoRefresh ? "Live" : "Paused"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{filteredDrivers.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={[styles.statNum, { color: "#059669" }]}>{onlineCount}</Text>
          <Text style={styles.statLabel}>Online</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={[styles.statNum, { color: "#DC2626" }]}>{activePickupCount}</Text>
          <Text style={styles.statLabel}>On Route</Text>
        </View>
        <View style={[styles.statItem, styles.statDivider]}>
          <Text style={[styles.statNum, { color: "#9CA3AF" }]}>{filteredDrivers.length - onlineCount}</Text>
          <Text style={styles.statLabel}>Offline</Text>
        </View>
      </View>

      {/* Zone Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.zoneScroll}
        contentContainerStyle={styles.zoneScrollContent}
      >
        <TouchableOpacity
          style={[styles.zoneChip, selectedZoneId === "all" && styles.zoneChipActive]}
          onPress={() => setSelectedZoneId("all")}
        >
          <Text style={[styles.zoneChipText, selectedZoneId === "all" && styles.zoneChipTextActive]}>
            All Zones ({drivers.length})
          </Text>
        </TouchableOpacity>
        {zones.map((z) => (
          <TouchableOpacity
            key={z.id}
            style={[styles.zoneChip, selectedZoneId === z.id && styles.zoneChipActive]}
            onPress={() => setSelectedZoneId(z.id)}
          >
            <View style={[styles.zoneDot, { backgroundColor: z.onlineCount > 0 ? "#059669" : "#9CA3AF" }]} />
            <Text style={[styles.zoneChipText, selectedZoneId === z.id && styles.zoneChipTextActive]}>
              {z.name} ({z.onlineCount}/{z.driverCount})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.viewBtn, viewMode === "map" && styles.viewBtnActive]}
          onPress={() => setViewMode("map")}
        >
          <MaterialIcons name="map" size={16} color={viewMode === "map" ? "#fff" : "#6B7280"} />
          <Text style={[styles.viewBtnText, viewMode === "map" && styles.viewBtnTextActive]}>Map View</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewBtn, viewMode === "list" && styles.viewBtnActive]}
          onPress={() => setViewMode("list")}
        >
          <MaterialIcons name="list" size={16} color={viewMode === "list" ? "#fff" : "#6B7280"} />
          <Text style={[styles.viewBtnText, viewMode === "list" && styles.viewBtnTextActive]}>List View</Text>
        </TouchableOpacity>
      </View>

      {viewMode === "map" ? (
        /* Map View */
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.mapContainer}
        >
          {/* Map Canvas */}
          <View style={styles.mapCanvas}>
            <View style={styles.mapBg}>
              {/* Grid lines for visual effect */}
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={`h${i}`} style={[styles.gridLine, styles.gridLineH, { top: `${i * 25}%` as any }]} />
              ))}
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={`v${i}`} style={[styles.gridLine, styles.gridLineV, { left: `${i * 25}%` as any }]} />
              ))}

              {/* City label */}
              <View style={styles.cityLabel}>
                <MaterialIcons name="location-city" size={14} color="#6B7280" />
                <Text style={styles.cityLabelText}>{adminUser?.city}</Text>
              </View>

              {/* Driver pins on map */}
              {filteredDrivers.map((driver, index) => {
                // Distribute pins visually across the map canvas
                const col = index % 4;
                const row = Math.floor(index / 4);
                const left = 12 + col * 22 + (row % 2 === 0 ? 0 : 11);
                const top = 15 + row * 20;
                const isSelected = selectedDriver?.driverId === driver.driverId;
                return (
                  <TouchableOpacity
                    key={driver.driverId}
                    style={[
                      styles.driverPin,
                      {
                        left: `${Math.min(left, 80)}%` as any,
                        top: `${Math.min(top, 75)}%` as any,
                        backgroundColor: getStatusColor(driver),
                        transform: [{ scale: isSelected ? 1.4 : 1 }],
                        zIndex: isSelected ? 10 : 1,
                      },
                    ]}
                    onPress={() => setSelectedDriver(isSelected ? null : driver)}
                  >
                    <MaterialIcons name="local-shipping" size={14} color="#fff" />
                    {driver.currentPickupId && (
                      <View style={styles.pinBadge} />
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Empty state */}
              {filteredDrivers.length === 0 && (
                <View style={styles.mapEmpty}>
                  <MaterialIcons name="location-off" size={32} color="#D1D5DB" />
                  <Text style={styles.mapEmptyText}>No drivers in this area</Text>
                </View>
              )}
            </View>

            {/* Map Legend */}
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#059669" }]} />
                <Text style={styles.legendText}>Available</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
                <Text style={styles.legendText}>On Route</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#9CA3AF" }]} />
                <Text style={styles.legendText}>Offline</Text>
              </View>
            </View>
          </View>

          {/* Selected Driver Detail Card */}
          {selectedDriver && (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={[styles.detailAvatar, { backgroundColor: getStatusColor(selectedDriver) + "20" }]}>
                  <MaterialIcons name="local-shipping" size={24} color={getStatusColor(selectedDriver)} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailName}>{selectedDriver.driverName}</Text>
                  <Text style={styles.detailZone}>{selectedDriver.zoneName || "No zone assigned"}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedDriver) + "20" }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(selectedDriver) }]} />
                  <Text style={[styles.statusText, { color: getStatusColor(selectedDriver) }]}>
                    {getStatusLabel(selectedDriver)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailGrid}>
                <View style={styles.detailGridItem}>
                  <MaterialIcons name="gps-fixed" size={14} color="#6B7280" />
                  <Text style={styles.detailGridLabel}>GPS</Text>
                  <Text style={styles.detailGridValue}>
                    {selectedDriver.latitude && selectedDriver.longitude
                      ? `${selectedDriver.latitude.toFixed(4)}, ${selectedDriver.longitude.toFixed(4)}`
                      : "Not available"}
                  </Text>
                </View>
                <View style={styles.detailGridItem}>
                  <MaterialIcons name="access-time" size={14} color="#6B7280" />
                  <Text style={styles.detailGridLabel}>Last Seen</Text>
                  <Text style={styles.detailGridValue}>{formatLastSeen(selectedDriver.lastUpdated)}</Text>
                </View>
              </View>

              {selectedDriver.currentPickupId && (
                <View style={styles.activePickupBanner}>
                  <MaterialIcons name="recycling" size={16} color="#DC2626" />
                  <View style={styles.activePickupInfo}>
                    <Text style={styles.activePickupLabel}>Active Pickup</Text>
                    <Text style={styles.activePickupAddr}>{selectedDriver.pickupAddress || "Address not available"}</Text>
                  </View>
                  <View style={[styles.pickupStatusBadge, { backgroundColor: "#FEE2E2" }]}>
                    <Text style={styles.pickupStatusText}>{selectedDriver.pickupStatus?.replace("_", " ")}</Text>
                  </View>
                </View>
              )}

              {selectedDriver.phone && (
                <TouchableOpacity style={styles.callBtn}>
                  <MaterialIcons name="phone" size={16} color="#059669" />
                  <Text style={styles.callBtnText}>Call {selectedDriver.phone}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Last refresh time */}
          <Text style={styles.refreshTime}>
            Last updated: {lastRefresh.toLocaleTimeString()} · {autoRefresh ? "Auto-refreshing every 10s" : "Auto-refresh paused"}
          </Text>
        </ScrollView>
      ) : (
        /* List View */
        <FlatList
          data={filteredDrivers}
          keyExtractor={(item) => item.driverId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.listEmpty}>
              <MaterialIcons name="location-off" size={40} color="#D1D5DB" />
              <Text style={styles.listEmptyText}>No drivers found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.listCard, selectedDriver?.driverId === item.driverId && styles.listCardSelected]}
              onPress={() => setSelectedDriver(selectedDriver?.driverId === item.driverId ? null : item)}
            >
              <View style={styles.listCardRow}>
                <View style={[styles.listAvatar, { backgroundColor: getStatusColor(item) + "15" }]}>
                  <MaterialIcons name="local-shipping" size={20} color={getStatusColor(item)} />
                </View>
                <View style={styles.listInfo}>
                  <Text style={styles.listName}>{item.driverName}</Text>
                  <Text style={styles.listZone}>{item.zoneName || "No zone"}</Text>
                </View>
                <View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item) + "15" }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(item) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(item) }]}>
                      {getStatusLabel(item)}
                    </Text>
                  </View>
                  <Text style={styles.listLastSeen}>{formatLastSeen(item.lastUpdated)}</Text>
                </View>
              </View>

              {item.currentPickupId && (
                <View style={styles.listPickupRow}>
                  <MaterialIcons name="recycling" size={12} color="#DC2626" />
                  <Text style={styles.listPickupText}>
                    {item.pickupAddress || `Pickup #${item.currentPickupId.slice(-6).toUpperCase()}`}
                  </Text>
                </View>
              )}

              {item.latitude && item.longitude && (
                <View style={styles.listCoordRow}>
                  <MaterialIcons name="gps-fixed" size={11} color="#059669" />
                  <Text style={styles.listCoord}>
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), padding: _rs.sp(16), paddingBottom: _rs.sp(8) },
  backBtn: { padding: _rs.sp(4) },
  headerCenter: { flex: 1 },
  title: { fontSize: _rs.fs(18), fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  liveBtn: { flexDirection: "row", alignItems: "center", gap: _rs.sp(5), paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  liveBtnActive: { backgroundColor: "#DC2626" },
  liveDot: { width: _rs.s(7), height: _rs.s(7), borderRadius: _rs.s(3.5) },
  liveBtnText: { fontSize: _rs.fs(12), color: "#6B7280", fontWeight: "600" },
  liveBtnTextActive: { color: "#fff" },
  statsBar: { flexDirection: "row", marginHorizontal: _rs.sp(16), marginBottom: _rs.sp(10), backgroundColor: "#F9FAFB", borderRadius: _rs.s(12), overflow: "hidden" },
  statItem: { flex: 1, alignItems: "center", paddingVertical: _rs.sp(10) },
  statDivider: { borderLeftWidth: 1, borderLeftColor: "#E5E7EB" },
  statNum: { fontSize: _rs.fs(18), fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: _rs.fs(11), color: "#9CA3AF", marginTop: _rs.sp(1) },
  zoneScroll: { maxHeight: 44 },
  zoneScrollContent: { paddingHorizontal: _rs.sp(16), gap: _rs.sp(8), paddingBottom: _rs.sp(4) },
  zoneChip: { flexDirection: "row", alignItems: "center", gap: _rs.sp(5), paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(7), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  zoneChipActive: { backgroundColor: "#1D4ED8" },
  zoneDot: { width: _rs.s(6), height: _rs.s(6), borderRadius: _rs.s(3) },
  zoneChipText: { fontSize: _rs.fs(12), color: "#6B7280", fontWeight: "500" },
  zoneChipTextActive: { color: "#fff" },
  viewToggle: { flexDirection: "row", gap: _rs.sp(8), marginHorizontal: _rs.sp(16), marginVertical: _rs.sp(8) },
  viewBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: _rs.sp(6), paddingVertical: _rs.sp(8), borderRadius: _rs.s(10), backgroundColor: "#F3F4F6" },
  viewBtnActive: { backgroundColor: "#1D4ED8" },
  viewBtnText: { fontSize: _rs.fs(13), color: "#6B7280", fontWeight: "500" },
  viewBtnTextActive: { color: "#fff" },
  mapContainer: { padding: _rs.sp(16), paddingBottom: _rs.sp(32) },
  mapCanvas: { borderRadius: _rs.s(16), overflow: "hidden", marginBottom: _rs.sp(12) },
  mapBg: { height: _rs.s(340), backgroundColor: "#EFF6FF", position: "relative", borderRadius: _rs.s(16), borderWidth: 1, borderColor: "#BFDBFE" },
  gridLine: { position: "absolute", backgroundColor: "#DBEAFE" },
  gridLineH: { left: 0, right: 0, height: 1 },
  gridLineV: { top: 0, bottom: 0, width: 1 },
  cityLabel: { position: "absolute", top: 10, left: 12, flexDirection: "row", alignItems: "center", gap: _rs.sp(4), backgroundColor: "rgba(255,255,255,0.8)", paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(4), borderRadius: _rs.s(8) },
  cityLabelText: { fontSize: _rs.fs(12), fontWeight: "600", color: "#374151" },
  driverPin: { position: "absolute", width: _rs.s(32), height: _rs.s(32), borderRadius: _rs.s(16), alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  pinBadge: { position: "absolute", top: -2, right: -2, width: _rs.s(8), height: _rs.s(8), borderRadius: _rs.s(4), backgroundColor: "#FCD34D", borderWidth: 1, borderColor: "#fff" },
  mapEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: _rs.sp(8) },
  mapEmptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  mapLegend: { flexDirection: "row", justifyContent: "center", gap: _rs.sp(16), paddingVertical: _rs.sp(10), backgroundColor: "rgba(255,255,255,0.9)", borderTopWidth: 1, borderTopColor: "#DBEAFE" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: _rs.sp(5) },
  legendDot: { width: _rs.s(8), height: _rs.s(8), borderRadius: _rs.s(4) },
  legendText: { fontSize: _rs.fs(11), color: "#6B7280" },
  detailCard: { backgroundColor: "#fff", borderRadius: _rs.s(16), padding: _rs.sp(16), marginBottom: _rs.sp(12), shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12), marginBottom: _rs.sp(12) },
  detailAvatar: { width: _rs.s(48), height: _rs.s(48), borderRadius: _rs.s(24), alignItems: "center", justifyContent: "center" },
  detailInfo: { flex: 1 },
  detailName: { fontSize: _rs.fs(16), fontWeight: "600", color: "#111827" },
  detailZone: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(2) },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4), paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(4), borderRadius: _rs.s(12) },
  statusDot: { width: _rs.s(6), height: _rs.s(6), borderRadius: _rs.s(3) },
  statusText: { fontSize: _rs.fs(12), fontWeight: "600" },
  detailGrid: { flexDirection: "row", gap: _rs.sp(12), marginBottom: _rs.sp(10) },
  detailGridItem: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: _rs.s(10), padding: _rs.sp(10), gap: _rs.sp(3) },
  detailGridLabel: { fontSize: _rs.fs(11), color: "#9CA3AF" },
  detailGridValue: { fontSize: _rs.fs(12), color: "#374151", fontWeight: "500" },
  activePickupBanner: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), backgroundColor: "#FEF2F2", borderRadius: _rs.s(10), padding: _rs.sp(10), marginBottom: _rs.sp(10) },
  activePickupInfo: { flex: 1 },
  activePickupLabel: { fontSize: _rs.fs(12), fontWeight: "600", color: "#DC2626" },
  activePickupAddr: { fontSize: _rs.fs(11), color: "#6B7280", marginTop: _rs.sp(1) },
  pickupStatusBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(8) },
  pickupStatusText: { fontSize: _rs.fs(11), color: "#DC2626", fontWeight: "600", textTransform: "capitalize" },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: _rs.sp(6), backgroundColor: "#F0FDF4", borderRadius: _rs.s(10), paddingVertical: _rs.sp(10) },
  callBtnText: { fontSize: _rs.fs(13), color: "#059669", fontWeight: "600" },
  refreshTime: { fontSize: _rs.fs(11), color: "#D1D5DB", textAlign: "center", marginTop: _rs.sp(4) },
  listContent: { padding: _rs.sp(16), gap: _rs.sp(10) },
  listEmpty: { alignItems: "center", paddingVertical: _rs.sp(40), gap: _rs.sp(10) },
  listEmptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  listCard: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  listCardSelected: { borderWidth: 2, borderColor: "#1D4ED8" },
  listCardRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), marginBottom: _rs.sp(4) },
  listAvatar: { width: _rs.s(42), height: _rs.s(42), borderRadius: _rs.s(21), alignItems: "center", justifyContent: "center" },
  listInfo: { flex: 1 },
  listName: { fontSize: _rs.fs(14), fontWeight: "600", color: "#111827" },
  listZone: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  listLastSeen: { fontSize: _rs.fs(10), color: "#D1D5DB", textAlign: "right", marginTop: _rs.sp(3) },
  listPickupRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(5), marginTop: _rs.sp(4) },
  listPickupText: { fontSize: _rs.fs(12), color: "#DC2626", flex: 1 },
  listCoordRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4), marginTop: _rs.sp(3) },
  listCoord: { fontSize: _rs.fs(11), color: "#059669", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
