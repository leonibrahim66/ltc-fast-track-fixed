/**
 * Zone Manager Dashboard — Redesigned
 *
 * Sections:
 *  1. Header with Notification Bell
 *  2. Zone Overview (real-time stats)
 *  3. Revenue Analytics (today / weekly / monthly)
 *  4. Zone Live Map (driver GPS + pickup pins + pickup request markers)
 *  5. Quick Actions (Assign Driver, Approve Households, Driver Status, Pickup Queue)
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DRIVER_STATUS_KEY, DriverStatusEntry } from "@/lib/driver-tracking-service";
import { usePickups } from "@/lib/pickups-context";
import { useGlobalNotifications } from "@/lib/global-notification-context";
import { getStaticResponsive } from "@/hooks/use-responsive";

// ─── Constants ────────────────────────────────────────────────────────────────

const ZONE_GREEN = "#1B5E20";
const ZONE_GREEN_LIGHT = "#2E7D32";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ZoneInfo {
  id: number;
  name: string;
  city: string;
  status: string;
  householdCount: number;
  collectorCount: number;
}

interface DashboardStats {
  totalHouseholds: number;
  activeSubscribers: number;
  totalPickups: number;
  totalActiveDrivers: number;
}

interface RevenueStats {
  today: number;
  weekly: number;
  monthly: number;
  commissionRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatKwacha(amount: number): string {
  return `K${amount.toLocaleString("en-ZM", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  return { start, end };
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { start, end };
}

// ─── Zone Live Map Component ──────────────────────────────────────────────────

interface ZoneMapProps {
  zoneId: number;
  zonePickups: any[];
}

function ZoneLiveMap({ zoneId, zonePickups }: ZoneMapProps) {
  const [driverStatuses, setDriverStatuses] = useState<DriverStatusEntry[]>([]);
  const colors = useColors();

  const loadDriverStatuses = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(DRIVER_STATUS_KEY);
      if (!raw) return;
      const ds: Record<string, DriverStatusEntry> = JSON.parse(raw);
      const zoneDrivers = Object.values(ds).filter(
        (d) => d.zoneId === String(zoneId) && d.isOnline
      );
      setDriverStatuses(zoneDrivers);
    } catch (e) {
      console.error("[ZoneLiveMap] load driver statuses:", e);
    }
  }, [zoneId]);

  // Poll driver locations every 5 seconds
  useEffect(() => {
    loadDriverStatuses();
    const interval = setInterval(loadDriverStatuses, 5000);
    return () => clearInterval(interval);
  }, [loadDriverStatuses]);

  // Web fallback
  if (Platform.OS === "web") {
    return (
      <View style={[mapStyles.webFallback, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialIcons name="map" size={40} color={ZONE_GREEN} />
        <Text style={[mapStyles.webFallbackTitle, { color: colors.foreground }]}>Zone Live Map</Text>
        <Text style={[mapStyles.webFallbackSub, { color: colors.muted }]}>
          {driverStatuses.length} driver{driverStatuses.length !== 1 ? "s" : ""} online ·{" "}
          {zonePickups.filter((p) => p.status === "pending").length} pending pickups
        </Text>
      </View>
    );
  }

  // Native map
  const MapView = require("react-native-maps").default;
  const { Marker } = require("react-native-maps");

  // Compute initial region from first driver or first pickup
  const firstDriver = driverStatuses[0];
  const firstPickup = zonePickups.find((p) => p.location?.latitude);
  const initialRegion = firstDriver
    ? {
        latitude: firstDriver.latitude,
        longitude: firstDriver.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : firstPickup
    ? {
        latitude: firstPickup.location.latitude,
        longitude: firstPickup.location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: -15.4167,
        longitude: 28.2833,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <View style={mapStyles.mapContainer}>
      <MapView style={mapStyles.map} initialRegion={initialRegion}>
        {/* Driver markers (truck icon) */}
        {driverStatuses.map((driver) => (
          <Marker
            key={`driver-${driver.driverId}`}
            coordinate={{ latitude: driver.latitude, longitude: driver.longitude }}
            title={driver.driverName}
            description={driver.activePickupId ? "On a pickup" : "Available"}
            pinColor="#F59E0B"
          />
        ))}

        {/* Customer pickup location pins */}
        {zonePickups
          .filter((p) => p.status !== "pending" && p.location?.latitude)
          .map((pickup) => (
            <Marker
              key={`pickup-${pickup.id}`}
              coordinate={{
                latitude: pickup.location.latitude,
                longitude: pickup.location.longitude,
              }}
              title={pickup.userName ?? "Customer"}
              description={`Status: ${pickup.status}`}
              pinColor="#3B82F6"
            />
          ))}

        {/* Pending pickup request markers (trash icon = red) */}
        {zonePickups
          .filter((p) => p.status === "pending" && p.location?.latitude)
          .map((pickup) => (
            <Marker
              key={`req-${pickup.id}`}
              coordinate={{
                latitude: pickup.location.latitude,
                longitude: pickup.location.longitude,
              }}
              title="Pickup Request"
              description={pickup.userName ?? "Customer"}
              pinColor="#EF4444"
            />
          ))}
      </MapView>

      {/* Legend */}
      <View style={[mapStyles.legend, { backgroundColor: "rgba(27,94,32,0.92)" }]}>
        <View style={mapStyles.legendRow}>
          <View style={[mapStyles.legendDot, { backgroundColor: "#F59E0B" }]} />
          <Text style={mapStyles.legendText}>Driver ({driverStatuses.length} online)</Text>
        </View>
        <View style={mapStyles.legendRow}>
          <View style={[mapStyles.legendDot, { backgroundColor: "#EF4444" }]} />
          <Text style={mapStyles.legendText}>
            Pending ({zonePickups.filter((p) => p.status === "pending").length})
          </Text>
        </View>
        <View style={mapStyles.legendRow}>
          <View style={[mapStyles.legendDot, { backgroundColor: "#3B82F6" }]} />
          <Text style={mapStyles.legendText}>Active Pickup</Text>
        </View>
      </View>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  mapContainer: { height: 240, borderRadius: 16, overflow: "hidden", position: "relative" },
  map: { flex: 1 },
  legend: {
    position: "absolute",
    bottom: 10,
    left: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  webFallback: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  webFallbackTitle: { fontSize: 16, fontWeight: "700" },
  webFallbackSub: { fontSize: 13 },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ZoneManagerDashboard() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { pickups } = usePickups();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [zoneInfo, setZoneInfo] = useState<ZoneInfo | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalHouseholds: 0,
    activeSubscribers: 0,
    totalPickups: 0,
    totalActiveDrivers: 0,
  });
  const [revenue, setRevenue] = useState<RevenueStats>({
    today: 0,
    weekly: 0,
    monthly: 0,
    commissionRate: 10,
  });

  // Notification bell — from global real-time notification provider
  const { unreadCount: unreadNotifCount } = useGlobalNotifications();

  // Zone pickups (filtered by zoneId)
  const zonePickups = zoneId
    ? pickups.filter((p) => p.zoneId === String(zoneId))
    : [];

  const pendingPickupsCount = zonePickups.filter((p) => p.status === "pending").length;

  const fetchDashboardData = useCallback(async () => {
    if (!user?.id) return;
    try {
      // 1. Resolve zone for this collector
      const { data: zoneCollectorRow } = await supabase
        .from("zone_collectors")
        .select("zoneId")
        .eq("collectorId", user.id)
        .maybeSingle();

      if (!zoneCollectorRow?.zoneId) {
        setLoading(false);
        return;
      }
      const resolvedZoneId = zoneCollectorRow.zoneId;
      setZoneId(resolvedZoneId);

      // 2. Zone details
      const { data: zone } = await supabase
        .from("zones")
        .select("id, name, city, status, householdCount, collectorCount")
        .eq("id", resolvedZoneId)
        .maybeSingle();

      if (zone) {
        setZoneInfo({
          id: zone.id,
          name: zone.name,
          city: zone.city,
          status: zone.status,
          householdCount: zone.householdCount ?? 0,
          collectorCount: zone.collectorCount ?? 0,
        });
      }

      // 3. Commission rate
      const { data: settings } = await supabase
        .from("financial_settings")
        .select("commission_rate")
        .maybeSingle();
      const commissionRate = parseFloat(settings?.commission_rate ?? "10");

      // 4. Subscriber counts
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("zoneId", resolvedZoneId);
      const activeSubscribers = (subs ?? []).filter((s: any) => s.status === "active").length;

      // 5. Active drivers in zone
      const { data: drivers } = await supabase
        .from("driver_profiles")
        .select("id")
        .eq("zoneId", resolvedZoneId)
        .eq("status", "approved");
      const totalActiveDrivers = (drivers ?? []).length;

      // 6. Total pickups in zone
      const totalPickups = zonePickups.length;

      setStats({
        totalHouseholds: zone?.householdCount ?? 0,
        activeSubscribers,
        totalPickups,
        totalActiveDrivers,
      });

      // 7. Revenue: today / weekly / monthly
      const todayRange = getTodayRange();
      const weekRange = getWeekRange();
      const monthRange = getMonthRange();

      const fetchRevenue = async (start: string, end: string) => {
        const { data } = await supabase
          .from("payments")
          .select("amount")
          .eq("zoneId", resolvedZoneId)
          .eq("status", "completed")
          .gte("createdAt", start)
          .lte("createdAt", end);
        return (data ?? []).reduce((sum: number, p: any) => sum + parseFloat(p.amount ?? "0"), 0);
      };

      const [todayRev, weeklyRev, monthlyRev] = await Promise.all([
        fetchRevenue(todayRange.start, todayRange.end),
        fetchRevenue(weekRange.start, weekRange.end),
        fetchRevenue(monthRange.start, monthRange.end),
      ]);

      setRevenue({
        today: todayRev,
        weekly: weeklyRev,
        monthly: monthlyRev,
        commissionRate,
      });
    } catch (err) {
      console.error("[ZoneManagerDashboard] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, zonePickups.length]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  // Auto-refresh stats every 30s
  useEffect(() => {
    const interval = setInterval(fetchDashboardData, 30_000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  const overviewCards = [
    {
      title: "Total Households",
      value: stats.totalHouseholds.toString(),
      icon: "home" as const,
      color: "#3B82F6",
    },
    {
      title: "Active Subscribers",
      value: stats.activeSubscribers.toString(),
      icon: "check-circle" as const,
      color: "#10B981",
    },
    {
      title: "Active Drivers",
      value: stats.totalActiveDrivers.toString(),
      icon: "local-shipping" as const,
      color: "#F59E0B",
    },
    {
      title: "Total Pickups",
      value: stats.totalPickups.toString(),
      icon: "delete-sweep" as const,
      color: "#8B5CF6",
    },
  ];

  const revenueCards = [
    { label: "Today", value: revenue.today, icon: "today" as const, color: "#3B82F6" },
    { label: "This Week", value: revenue.weekly, icon: "date-range" as const, color: "#10B981" },
    { label: "This Month", value: revenue.monthly, icon: "calendar-month" as const, color: "#8B5CF6" },
  ];

  const quickActions = [
    {
      title: "Assign Driver",
      subtitle: `${pendingPickupsCount} pending`,
      icon: "assignment-ind" as const,
      color: "#3B82F6",
      route: "/(collector)/pickups",
    },
    {
      title: "Approve Households",
      subtitle: "Review new customers",
      icon: "how-to-reg" as const,
      color: "#10B981",
      route: "/(collector)/households",
    },
    {
      title: "Driver Status",
      subtitle: `${stats.totalActiveDrivers} active drivers`,
      icon: "local-shipping" as const,
      color: "#F59E0B",
      route: "/(collector)/drivers",
    },
    {
      title: "Pickup Queue",
      subtitle: `${pendingPickupsCount} awaiting assignment`,
      icon: "queue" as const,
      color: "#EF4444",
      route: "/(collector)/pickups",
    },
  ];

  const _rs = getStaticResponsive();

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ZONE_GREEN}
          />
        }
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={[styles.header, { backgroundColor: ZONE_GREEN }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerLabel}>Zone Manager Dashboard</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {user?.fullName ?? "Manager"}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {/* Notification Bell */}
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => router.push("/notifications" as any)}
              >
                <MaterialIcons name="notifications" size={24} color="#fff" />
                {unreadNotifCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {/* Settings */}
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => router.push("/(collector)/settings" as any)}
              >
                <MaterialIcons name="settings" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Zone Info Card */}
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
          ) : zoneInfo ? (
            <View style={styles.zoneCard}>
              <View style={styles.zoneCardRow}>
                <View style={[styles.zoneIconWrap, { backgroundColor: `${ZONE_GREEN}18` }]}>
                  <MaterialIcons name="place" size={22} color={ZONE_GREEN} />
                </View>
                <View style={styles.zoneCardInfo}>
                  <Text style={styles.zoneCardLabel}>Assigned Zone</Text>
                  <Text style={styles.zoneCardName}>{zoneInfo.name}</Text>
                  <Text style={styles.zoneCardSub}>{zoneInfo.city}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: zoneInfo.status === "active" ? "#D1FAE5" : "#FEE2E2" },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: zoneInfo.status === "active" ? "#10B981" : "#EF4444" },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: zoneInfo.status === "active" ? "#065F46" : "#991B1B" },
                    ]}
                  >
                    {zoneInfo.status === "active" ? "Active" : "Pending"}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noZoneCard}>
              <MaterialIcons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.noZoneText}>No zone assigned yet. Contact admin.</Text>
            </View>
          )}
        </View>

        {/* ── Dev Mode Banner ──────────────────────────────────────── */}
        {user?.status === "pending_review" && (
          <View style={styles.devBanner}>
            <MaterialIcons name="developer-mode" size={18} color="#92400E" />
            <Text style={styles.devBannerText}>
              <Text style={{ fontWeight: "700" }}>Development Mode:</Text>{" "}
              Zone Manager approval pending. Dashboard access is temporarily enabled for testing.
            </Text>
          </View>
        )}

        {/* ── Zone Overview ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Zone Overview</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>
          <View style={styles.cardsGrid}>
            {overviewCards.map((card) => (
              <View
                key={card.title}
                style={[
                  styles.overviewCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.cardIconWrap, { backgroundColor: `${card.color}18` }]}>
                  <MaterialIcons name={card.icon} size={24} color={card.color} />
                </View>
                <Text style={[styles.cardValue, { color: colors.foreground }]}>{card.value}</Text>
                <Text style={[styles.cardTitle, { color: colors.muted }]}>{card.title}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Revenue Analytics ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Revenue Analytics</Text>
          <View style={styles.revenueGrid}>
            {revenueCards.map((card) => (
              <View
                key={card.label}
                style={[
                  styles.revenueCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.revIconWrap, { backgroundColor: `${card.color}18` }]}>
                  <MaterialIcons name={card.icon} size={20} color={card.color} />
                </View>
                <Text style={[styles.revLabel, { color: colors.muted }]}>{card.label}</Text>
                <Text style={[styles.revValue, { color: colors.foreground }]}>
                  {formatKwacha(card.value)}
                </Text>
              </View>
            ))}
          </View>
          <View
            style={[
              styles.commissionNote,
              { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" },
            ]}
          >
            <MaterialIcons name="info" size={14} color="#92400E" />
            <Text style={[styles.commissionNoteText, { color: "#92400E" }]}>
              Platform commission ({revenue.commissionRate}%) is auto-deducted. Values shown are gross revenue from customer subscription payments.
            </Text>
          </View>
        </View>

        {/* ── Zone Live Map ────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Zone Live Map</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>GPS</Text>
            </View>
          </View>
          {zoneId ? (
            <ZoneLiveMap zoneId={zoneId} zonePickups={zonePickups} />
          ) : (
            <View
              style={[
                styles.mapPlaceholder,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MaterialIcons name="map" size={36} color={colors.muted} />
              <Text style={[styles.mapPlaceholderText, { color: colors.muted }]}>
                Assign a zone to view the live map
              </Text>
            </View>
          )}
        </View>

        {/* ── Quick Actions ────────────────────────────────────────── */}
        <View style={[styles.section, { paddingBottom: 32 }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.title}
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                activeOpacity={0.7}
                onPress={() => router.push(action.route as any)}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: `${action.color}18` }]}>
                  <MaterialIcons name={action.icon} size={26} color={action.color} />
                </View>
                <View style={styles.actionTextBlock}>
                  <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                    {action.title}
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: colors.muted }]}>
                    {action.subtitle}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const _rs = getStaticResponsive();

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: _rs.sp(20),
    paddingTop: _rs.sp(20),
    paddingBottom: _rs.sp(24),
    borderBottomLeftRadius: _rs.s(24),
    borderBottomRightRadius: _rs.s(24),
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: _rs.sp(16),
  },
  headerLeft: { flex: 1 },
  headerLabel: {
    fontSize: _rs.fs(12),
    color: "rgba(255,255,255,0.8)",
    marginBottom: _rs.sp(2),
    letterSpacing: 0.5,
  },
  headerName: { fontSize: _rs.fs(20), fontWeight: "700", color: "#fff" },
  headerActions: { flexDirection: "row", gap: _rs.sp(8) },
  headerIconBtn: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  zoneCard: {
    backgroundColor: "#fff",
    borderRadius: _rs.s(14),
    padding: _rs.sp(16),
  },
  zoneCardRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12) },
  zoneIconWrap: {
    width: _rs.s(44),
    height: _rs.s(44),
    borderRadius: _rs.s(22),
    justifyContent: "center",
    alignItems: "center",
  },
  zoneCardInfo: { flex: 1 },
  zoneCardLabel: { fontSize: _rs.fs(11), color: "#687076", marginBottom: _rs.sp(2) },
  zoneCardName: { fontSize: _rs.fs(16), fontWeight: "700", color: "#11181C", marginBottom: _rs.sp(2) },
  zoneCardSub: { fontSize: _rs.fs(13), color: "#687076" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(5),
    borderRadius: _rs.s(20),
    gap: _rs.sp(5),
  },
  statusDot: { width: _rs.s(8), height: _rs.s(8), borderRadius: _rs.s(4) },
  statusText: { fontSize: _rs.fs(12), fontWeight: "600" },
  noZoneCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: _rs.s(12),
    padding: _rs.sp(14),
    gap: _rs.sp(10),
  },
  noZoneText: { color: "#92400E", fontSize: _rs.fs(14), flex: 1 },
  devBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFBEB",
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(12),
    gap: _rs.sp(10),
  },
  devBannerText: { fontSize: _rs.fs(13), color: "#92400E", flex: 1, lineHeight: _rs.fs(20) },
  section: { paddingHorizontal: _rs.sp(16), paddingTop: _rs.sp(20) },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: _rs.sp(14),
  },
  sectionTitle: { fontSize: _rs.fs(17), fontWeight: "700" },
  liveIndicator: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  liveText: { fontSize: _rs.fs(12), color: "#10B981", fontWeight: "600" },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: _rs.sp(12) },
  overviewCard: {
    width: "47%",
    padding: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 1,
    alignItems: "center",
  },
  cardIconWrap: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(24),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: _rs.sp(10),
  },
  cardValue: { fontSize: _rs.fs(26), fontWeight: "700", marginBottom: _rs.sp(4) },
  cardTitle: { fontSize: _rs.fs(12), textAlign: "center" },
  revenueGrid: { flexDirection: "row", gap: _rs.sp(10), marginBottom: _rs.sp(12) },
  revenueCard: {
    flex: 1,
    padding: _rs.sp(14),
    borderRadius: _rs.s(14),
    borderWidth: 1,
    alignItems: "center",
    gap: _rs.sp(6),
  },
  revIconWrap: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    justifyContent: "center",
    alignItems: "center",
  },
  revLabel: { fontSize: _rs.fs(11), textAlign: "center" },
  revValue: { fontSize: _rs.fs(14), fontWeight: "700", textAlign: "center" },
  commissionNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: _rs.s(8),
    borderWidth: 1,
    padding: _rs.sp(10),
    gap: _rs.sp(8),
  },
  commissionNoteText: { fontSize: _rs.fs(12), flex: 1, lineHeight: _rs.fs(18) },
  mapPlaceholder: {
    height: 160,
    borderRadius: _rs.s(16),
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: _rs.sp(10),
  },
  mapPlaceholderText: { fontSize: _rs.fs(14) },
  actionsGrid: { gap: _rs.sp(10) },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(14),
    borderWidth: 1,
    gap: _rs.sp(14),
  },
  actionIconWrap: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(24),
    justifyContent: "center",
    alignItems: "center",
  },
  actionTextBlock: { flex: 1 },
  actionTitle: { fontSize: _rs.fs(16), fontWeight: "600" },
  actionSubtitle: { fontSize: _rs.fs(12), marginTop: 2 },
});
