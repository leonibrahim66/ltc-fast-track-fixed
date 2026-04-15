/**
 * Council Admin — Sanitation Reports Screen
 * Health & compliance data, zone performance metrics
 */
import { useState, useCallback } from "react";
import {
  Text, View, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface ZoneReport {
  zoneId: string;
  zoneName: string;
  totalPickups: number;
  completedPickups: number;
  pendingPickups: number;
  completionRate: number;
  activeDrivers: number;
  activeCustomers: number;
  lastPickupDate?: string;
}

interface SanitationSummary {
  totalZones: number;
  zonesWithActivity: number;
  overallCompletionRate: number;
  totalPickupsThisMonth: number;
  completedThisMonth: number;
  pendingPickups: number;
}

export default function CouncilSanitationScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const [zoneReports, setZoneReports] = useState<ZoneReport[]>([]);
  const [summary, setSummary] = useState<SanitationSummary>({
    totalZones: 0, zonesWithActivity: 0, overallCompletionRate: 0,
    totalPickupsThisMonth: 0, completedThisMonth: 0, pendingPickups: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "all">("month");

  const loadReports = useCallback(async () => {
    if (!adminUser?.province) return;
    try {
      const zonesRaw = await AsyncStorage.getItem("@ltc_service_zones");
      const pickupsRaw = await AsyncStorage.getItem("ltc_pickups");
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");

      const allZones: any[] = zonesRaw ? JSON.parse(zonesRaw) : [];
      const allPickups: any[] = pickupsRaw ? JSON.parse(pickupsRaw) : [];
      const allUsers: Record<string, any> = usersRaw ? JSON.parse(usersRaw) : {};

      const scopedZones = allZones.filter(
        (z) => z.province === adminUser.province || z.town === adminUser.city || z.city === adminUser.city
      );

      const now = new Date();
      const periodStart = new Date();
      if (selectedPeriod === "week") periodStart.setDate(now.getDate() - 7);
      else if (selectedPeriod === "month") periodStart.setMonth(now.getMonth() - 1);
      else periodStart.setFullYear(2000);

      const reports: ZoneReport[] = scopedZones.map((zone) => {
        const zonePickups = allPickups.filter((p) => {
          if (p.zoneId !== zone.id) return false;
          const pickupDate = new Date(p.createdAt || 0);
          return pickupDate >= periodStart;
        });

        const completed = zonePickups.filter((p) => p.status === "completed" || p.status === "confirmed").length;
        const pending = zonePickups.filter((p) => p.status === "pending").length;
        const total = zonePickups.length;

        const zoneDrivers = Object.values(allUsers).filter(
          (u: any) => u.role === "garbage_driver" && u.zoneId === zone.id && u.driverStatus === "active"
        );
        const zoneCustomers = Object.values(allUsers).filter(
          (u: any) => ["residential", "commercial", "industrial"].includes(u.role) && u.zoneId === zone.id
        );

        const lastPickup = zonePickups
          .filter((p) => p.completedAt)
          .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];

        return {
          zoneId: zone.id,
          zoneName: zone.name,
          totalPickups: total,
          completedPickups: completed,
          pendingPickups: pending,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
          activeDrivers: zoneDrivers.length,
          activeCustomers: zoneCustomers.length,
          lastPickupDate: lastPickup?.completedAt,
        };
      });

      reports.sort((a, b) => b.completionRate - a.completionRate);
      setZoneReports(reports);

      const totalPickups = reports.reduce((s, r) => s + r.totalPickups, 0);
      const totalCompleted = reports.reduce((s, r) => s + r.completedPickups, 0);
      const totalPending = reports.reduce((s, r) => s + r.pendingPickups, 0);

      setSummary({
        totalZones: scopedZones.length,
        zonesWithActivity: reports.filter((r) => r.totalPickups > 0).length,
        overallCompletionRate: totalPickups > 0 ? Math.round((totalCompleted / totalPickups) * 100) : 0,
        totalPickupsThisMonth: totalPickups,
        completedThisMonth: totalCompleted,
        pendingPickups: totalPending,
      });
    } catch (e) { console.error(e); }
  }, [adminUser, selectedPeriod]);

  useFocusEffect(useCallback(() => { loadReports(); }, [loadReports]));

  const onRefresh = async () => { setRefreshing(true); await loadReports(); setRefreshing(false); };

  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return "#059669";
    if (rate >= 50) return "#D97706";
    return "#DC2626";
  };

  return (
    <ScreenContainer>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.title}>Sanitation Reports</Text>
        </View>

        {/* Period Selector */}
        <View style={styles.periodRow}>
          {(["week", "month", "all"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, selectedPeriod === p && styles.periodBtnActive]}
              onPress={() => setSelectedPeriod(p)}
            >
              <Text style={[styles.periodText, selectedPeriod === p && styles.periodTextActive]}>
                {p === "week" ? "This Week" : p === "month" ? "This Month" : "All Time"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{summary.totalZones}</Text>
            <Text style={styles.summaryLabel}>Total Zones</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNum, { color: "#059669" }]}>{summary.overallCompletionRate}%</Text>
            <Text style={styles.summaryLabel}>Completion Rate</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{summary.totalPickupsThisMonth}</Text>
            <Text style={styles.summaryLabel}>Total Pickups</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNum, { color: "#D97706" }]}>{summary.pendingPickups}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
        </View>

        {/* Compliance Indicator */}
        <View style={styles.complianceCard}>
          <View style={styles.complianceHeader}>
            <MaterialIcons name="health-and-safety" size={20} color="#059669" />
            <Text style={styles.complianceTitle}>Sanitation Compliance</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${summary.overallCompletionRate}%` as any,
              backgroundColor: getCompletionColor(summary.overallCompletionRate),
            }]} />
          </View>
          <Text style={styles.complianceText}>
            {summary.completedThisMonth} of {summary.totalPickupsThisMonth} pickups completed
            ({summary.overallCompletionRate}% compliance rate)
          </Text>
        </View>

        {/* Zone-by-Zone Reports */}
        <Text style={styles.sectionTitle}>Zone Performance</Text>
        {zoneReports.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="assignment" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>No zone data available</Text>
          </View>
        ) : (
          zoneReports.map((report) => (
            <View key={report.zoneId} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <Text style={styles.zoneName}>{report.zoneName}</Text>
                <View style={[styles.rateBadge, { backgroundColor: getCompletionColor(report.completionRate) + "20" }]}>
                  <Text style={[styles.rateText, { color: getCompletionColor(report.completionRate) }]}>
                    {report.completionRate}%
                  </Text>
                </View>
              </View>
              <View style={styles.zoneProgressBar}>
                <View style={[styles.zoneProgressFill, {
                  width: `${report.completionRate}%` as any,
                  backgroundColor: getCompletionColor(report.completionRate),
                }]} />
              </View>
              <View style={styles.zoneStats}>
                <View style={styles.zoneStat}>
                  <MaterialIcons name="recycling" size={14} color="#6B7280" />
                  <Text style={styles.zoneStatText}>{report.completedPickups}/{report.totalPickups} pickups</Text>
                </View>
                <View style={styles.zoneStat}>
                  <MaterialIcons name="local-shipping" size={14} color="#6B7280" />
                  <Text style={styles.zoneStatText}>{report.activeDrivers} drivers</Text>
                </View>
                <View style={styles.zoneStat}>
                  <MaterialIcons name="people" size={14} color="#6B7280" />
                  <Text style={styles.zoneStatText}>{report.activeCustomers} customers</Text>
                </View>
              </View>
              {report.lastPickupDate && (
                <Text style={styles.lastPickup}>
                  Last pickup: {new Date(report.lastPickupDate).toLocaleDateString()}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  scroll: { padding: _rs.sp(16), paddingBottom: _rs.sp(32) },
  header: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12), marginBottom: _rs.sp(16) },
  backBtn: { padding: _rs.sp(4) },
  title: { fontSize: _rs.fs(18), fontWeight: "700", color: "#111827" },
  periodRow: { flexDirection: "row", gap: _rs.sp(8), marginBottom: _rs.sp(16) },
  periodBtn: { flex: 1, paddingVertical: _rs.sp(8), borderRadius: _rs.s(10), backgroundColor: "#F3F4F6", alignItems: "center" },
  periodBtnActive: { backgroundColor: "#65A30D" },
  periodText: { fontSize: _rs.fs(13), color: "#6B7280", fontWeight: "500" },
  periodTextActive: { color: "#fff" },
  sectionTitle: { fontSize: _rs.fs(15), fontWeight: "600", color: "#374151", marginBottom: _rs.sp(10), marginTop: _rs.sp(4) },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: _rs.sp(10), marginBottom: _rs.sp(16) },
  summaryCard: { width: "47%", backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  summaryNum: { fontSize: _rs.fs(24), fontWeight: "700", color: "#111827" },
  summaryLabel: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(2) },
  complianceCard: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(16), marginBottom: _rs.sp(16), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  complianceHeader: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), marginBottom: _rs.sp(12) },
  complianceTitle: { fontSize: _rs.fs(15), fontWeight: "600", color: "#111827" },
  progressBar: { height: _rs.s(10), backgroundColor: "#F3F4F6", borderRadius: _rs.s(5), marginBottom: _rs.sp(8), overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: _rs.s(5) },
  complianceText: { fontSize: _rs.fs(13), color: "#6B7280" },
  empty: { alignItems: "center", paddingVertical: _rs.sp(40), gap: _rs.sp(10) },
  emptyText: { fontSize: _rs.fs(14), color: "#9CA3AF" },
  zoneCard: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), marginBottom: _rs.sp(10), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  zoneHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: _rs.sp(8) },
  zoneName: { fontSize: _rs.fs(14), fontWeight: "600", color: "#111827", flex: 1 },
  rateBadge: { paddingHorizontal: _rs.sp(10), paddingVertical: _rs.sp(4), borderRadius: _rs.s(12) },
  rateText: { fontSize: _rs.fs(13), fontWeight: "700" },
  zoneProgressBar: { height: _rs.s(6), backgroundColor: "#F3F4F6", borderRadius: _rs.s(3), marginBottom: _rs.sp(10), overflow: "hidden" },
  zoneProgressFill: { height: "100%", borderRadius: _rs.s(3) },
  zoneStats: { flexDirection: "row", gap: _rs.sp(12), marginBottom: _rs.sp(4) },
  zoneStat: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4) },
  zoneStatText: { fontSize: _rs.fs(12), color: "#6B7280" },
  lastPickup: { fontSize: _rs.fs(11), color: "#D1D5DB", marginTop: _rs.sp(4) },
});
