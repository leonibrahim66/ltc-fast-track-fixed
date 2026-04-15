/**
 * Council Admin — Data Export Center
 * CSV export for: Zones, Zone Managers, Drivers, Customers, Pickups, Activity Logs, Tonnage Reports
 * All exports respect province + city scoping.
 * Financial data (commission, wallet, payments) is EXCLUDED.
 */
import { useState, useCallback } from "react";
import {
  Text, View, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { useTonnage, WASTE_TYPE_LABELS } from "@/lib/tonnage-context";
import { convertToCSV, ExportColumn } from "@/lib/export-utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { getStaticResponsive } from "@/hooks/use-responsive";
type ExportType = "zones" | "managers" | "drivers" | "customers" | "pickups" | "activity" | "tonnage";

interface ExportItem {
  id: ExportType;
  title: string;
  description: string;
  icon: string;
  color: string;
  recordCount?: number;
}

interface ExportLog {
  type: ExportType;
  timestamp: string;
  recordCount: number;
  format: "csv";
}

export default function CouncilExportScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const { records: tonnageRecords } = useTonnage();
  const [exporting, setExporting] = useState<ExportType | null>(null);
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([]);
  const [counts, setCounts] = useState<Partial<Record<ExportType, number>>>({});

  const loadCounts = useCallback(async () => {
    if (!adminUser?.province) return;
    try {
      const [zonesRaw, usersRaw, pickupsRaw, activityRaw] = await Promise.all([
        AsyncStorage.getItem("@ltc_service_zones"),
        AsyncStorage.getItem("@ltc_users_db"),
        AsyncStorage.getItem("ltc_pickups"),
        AsyncStorage.getItem("@ltc_activity_logs"),
      ]);

      const allZones: any[] = zonesRaw ? JSON.parse(zonesRaw) : [];
      const allUsers: Record<string, any> = usersRaw ? JSON.parse(usersRaw) : {};
      const allPickups: any[] = pickupsRaw ? JSON.parse(pickupsRaw) : [];
      const allActivity: any[] = activityRaw ? JSON.parse(activityRaw) : [];

      const scopedZones = allZones.filter(
        (z) => z.province === adminUser.province || z.town === adminUser.city || z.city === adminUser.city
      );
      const scopedZoneIds = new Set(scopedZones.map((z) => z.id));

      const users = Object.values(allUsers);
      const scopedManagers = users.filter(
        (u: any) => (u.role === "zone_manager" || u.role === "collector") &&
          (u.province === adminUser.province || u.city === adminUser.city || (u.zoneId && scopedZoneIds.has(u.zoneId)))
      );
      const scopedDrivers = users.filter(
        (u: any) => u.role === "garbage_driver" &&
          (u.province === adminUser.province || u.city === adminUser.city || (u.zoneId && scopedZoneIds.has(u.zoneId)))
      );
      const scopedCustomers = users.filter(
        (u: any) => ["customer", "residential", "commercial", "industrial"].includes(u.role) &&
          (u.province === adminUser.province || u.city === adminUser.city)
      );
      const scopedPickups = allPickups.filter(
        (p: any) => p.province === adminUser.province || p.city === adminUser.city || (p.zoneId && scopedZoneIds.has(p.zoneId))
      );
      const scopedActivity = allActivity.filter(
        (a: any) => a.province === adminUser.province || a.city === adminUser.city || (a.zoneId && scopedZoneIds.has(a.zoneId))
      );
      const scopedTonnage = tonnageRecords.filter(
        (r) => r.province === adminUser.province && r.city === adminUser.city
      );

      setCounts({
        zones: scopedZones.length,
        managers: scopedManagers.length,
        drivers: scopedDrivers.length,
        customers: scopedCustomers.length,
        pickups: scopedPickups.length,
        activity: scopedActivity.length,
        tonnage: scopedTonnage.length,
      });
    } catch (e) { console.error(e); }
  }, [adminUser, tonnageRecords]);

  useFocusEffect(useCallback(() => { loadCounts(); }, [loadCounts]));

  const exportItems: ExportItem[] = [
    { id: "zones", title: "Zones", description: "All service zones in your area", icon: "map", color: "#1D4ED8", recordCount: counts.zones },
    { id: "managers", title: "Zone Managers", description: "Manager details and zone assignments", icon: "manage-accounts", color: "#7C3AED", recordCount: counts.managers },
    { id: "drivers", title: "Garbage Drivers", description: "Driver profiles and status", icon: "local-shipping", color: "#059669", recordCount: counts.drivers },
    { id: "customers", title: "Customers", description: "Registered households and businesses", icon: "people", color: "#D97706", recordCount: counts.customers },
    { id: "pickups", title: "Pickups", description: "All pickup records and statuses", icon: "recycling", color: "#DC2626", recordCount: counts.pickups },
    { id: "activity", title: "Activity Logs", description: "System events and audit trail", icon: "history", color: "#0891B2", recordCount: counts.activity },
    { id: "tonnage", title: "Tonnage Reports", description: "Waste collection tonnage data", icon: "inventory", color: "#7C3AED", recordCount: counts.tonnage },
  ];

  const doExport = async (type: ExportType) => {
    if (!adminUser?.province) return;
    setExporting(type);
    try {
      let csvData: string = "";
      let filename = `council_${type}_${(adminUser.city ?? "unknown").toLowerCase().replace(/\s+/g, "_")}`;

      const [zonesRaw, usersRaw, pickupsRaw, activityRaw] = await Promise.all([
        AsyncStorage.getItem("@ltc_service_zones"),
        AsyncStorage.getItem("@ltc_users_db"),
        AsyncStorage.getItem("ltc_pickups"),
        AsyncStorage.getItem("@ltc_activity_logs"),
      ]);

      const allZones: any[] = zonesRaw ? JSON.parse(zonesRaw) : [];
      const allUsers: Record<string, any> = usersRaw ? JSON.parse(usersRaw) : {};
      const allPickups: any[] = pickupsRaw ? JSON.parse(pickupsRaw) : [];
      const allActivity: any[] = activityRaw ? JSON.parse(activityRaw) : [];

      const scopedZones = allZones.filter(
        (z) => z.province === adminUser.province || z.town === adminUser.city || z.city === adminUser.city
      );
      const scopedZoneIds = new Set(scopedZones.map((z) => z.id));
      const users = Object.values(allUsers);

      switch (type) {
        case "zones": {
          const cols: ExportColumn[] = [
            { key: "id", header: "Zone ID" },
            { key: "name", header: "Zone Name" },
            { key: "province", header: "Province" },
            { key: "town", header: "City/Town" },
            { key: "status", header: "Status" },
            { key: "managerName", header: "Assigned Manager" },
            { key: "householdCount", header: "Households" },
            { key: "createdAt", header: "Created", formatter: (v) => v ? new Date(v).toLocaleDateString() : "N/A" },
          ];
          csvData = convertToCSV(scopedZones, cols);
          break;
        }
        case "managers": {
          const data = users.filter(
            (u: any) => (u.role === "zone_manager" || u.role === "collector") &&
              (u.province === adminUser.province || u.city === adminUser.city || (u.zoneId && scopedZoneIds.has(u.zoneId)))
          );
          const cols: ExportColumn[] = [
            { key: "id", header: "Manager ID" },
            { key: "fullName", header: "Full Name" },
            { key: "phone", header: "Phone" },
            { key: "province", header: "Province" },
            { key: "city", header: "City" },
            { key: "zoneId", header: "Zone ID" },
            { key: "status", header: "Status" },
            { key: "kycStatus", header: "KYC Status" },
            { key: "createdAt", header: "Registered", formatter: (v) => v ? new Date(v).toLocaleDateString() : "N/A" },
          ];
          csvData = convertToCSV(data, cols);
          break;
        }
        case "drivers": {
          const data = users.filter(
            (u: any) => u.role === "garbage_driver" &&
              (u.province === adminUser.province || u.city === adminUser.city || (u.zoneId && scopedZoneIds.has(u.zoneId)))
          );
          const cols: ExportColumn[] = [
            { key: "id", header: "Driver ID" },
            { key: "fullName", header: "Full Name" },
            { key: "phone", header: "Phone" },
            { key: "province", header: "Province" },
            { key: "city", header: "City" },
            { key: "zoneId", header: "Zone ID" },
            { key: "vehiclePlate", header: "Vehicle Plate" },
            { key: "licenseNumber", header: "License No." },
            { key: "driverStatus", header: "Status" },
            { key: "createdAt", header: "Registered", formatter: (v) => v ? new Date(v).toLocaleDateString() : "N/A" },
          ];
          csvData = convertToCSV(data, cols);
          break;
        }
        case "customers": {
          const data = users.filter(
            (u: any) => ["customer", "residential", "commercial", "industrial"].includes(u.role) &&
              (u.province === adminUser.province || u.city === adminUser.city)
          );
          const cols: ExportColumn[] = [
            { key: "id", header: "Customer ID" },
            { key: "fullName", header: "Full Name" },
            { key: "phone", header: "Phone" },
            { key: "province", header: "Province" },
            { key: "city", header: "City" },
            { key: "areaName", header: "Area" },
            { key: "fullAddress", header: "Address" },
            { key: "role", header: "Property Type" },
            { key: "zoneId", header: "Zone ID" },
            { key: "subscriptionPlan", header: "Subscription Plan" },
            { key: "subscriptionStatus", header: "Subscription Status" },
            { key: "createdAt", header: "Registered", formatter: (v) => v ? new Date(v).toLocaleDateString() : "N/A" },
          ];
          csvData = convertToCSV(data, cols);
          break;
        }
        case "pickups": {
          const data = allPickups.filter(
            (p: any) => p.province === adminUser.province || p.city === adminUser.city || (p.zoneId && scopedZoneIds.has(p.zoneId))
          );
          const cols: ExportColumn[] = [
            { key: "id", header: "Pickup ID" },
            { key: "customerId", header: "Customer ID" },
            { key: "driverId", header: "Driver ID" },
            { key: "zoneId", header: "Zone ID" },
            { key: "status", header: "Status" },
            { key: "address", header: "Address" },
            { key: "province", header: "Province" },
            { key: "city", header: "City" },
            { key: "scheduledDate", header: "Scheduled", formatter: (v) => v ? new Date(v).toLocaleDateString() : "N/A" },
            { key: "completedAt", header: "Completed", formatter: (v) => v ? new Date(v).toLocaleString() : "N/A" },
            { key: "rating", header: "Rating", formatter: (v) => v ? `${v}/5` : "N/A" },
            { key: "createdAt", header: "Created", formatter: (v) => v ? new Date(v).toLocaleString() : "N/A" },
          ];
          csvData = convertToCSV(data, cols);
          break;
        }
        case "activity": {
          const data = allActivity.filter(
            (a: any) => a.province === adminUser.province || a.city === adminUser.city || (a.zoneId && scopedZoneIds.has(a.zoneId))
          );
          const cols: ExportColumn[] = [
            { key: "id", header: "Log ID" },
            { key: "type", header: "Event Type" },
            { key: "actorId", header: "Actor ID" },
            { key: "actorRole", header: "Actor Role" },
            { key: "description", header: "Description" },
            { key: "zoneId", header: "Zone ID" },
            { key: "province", header: "Province" },
            { key: "city", header: "City" },
            { key: "createdAt", header: "Timestamp", formatter: (v) => v ? new Date(v).toLocaleString() : "N/A" },
          ];
          csvData = convertToCSV(data, cols);
          break;
        }
        case "tonnage": {
          const data = tonnageRecords.filter(
            (r) => r.province === adminUser.province && r.city === adminUser.city
          );
          const cols: ExportColumn[] = [
            { key: "id", header: "Record ID" },
            { key: "zoneId", header: "Zone ID" },
            { key: "zoneName", header: "Zone Name" },
            { key: "driverName", header: "Driver" },
            { key: "wasteType", header: "Waste Type", formatter: (v) => WASTE_TYPE_LABELS[v as keyof typeof WASTE_TYPE_LABELS] || v },
            { key: "estimatedWeight", header: "Est. Weight (kg)", formatter: (v) => v?.toFixed(2) || "0.00" },
            { key: "recordedWeight", header: "Recorded Weight (kg)", formatter: (v) => v != null ? v.toFixed(2) : "N/A" },
            { key: "area", header: "Area", formatter: (v) => v || "N/A" },
            { key: "vehicleType", header: "Vehicle", formatter: (v) => v || "N/A" },
            { key: "notes", header: "Notes", formatter: (v) => v || "" },
            { key: "recordedBy", header: "Recorded By" },
            { key: "province", header: "Province" },
            { key: "city", header: "City" },
            { key: "createdAt", header: "Date", formatter: (v) => v ? new Date(v).toLocaleString() : "N/A" },
          ];
          csvData = convertToCSV(data, cols);
          break;
        }
      }

      if (!csvData) {
        Alert.alert("No Data", "No records found to export for this selection.");
        return;
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const fullFilename = `${filename}_${timestamp}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fullFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const fileUri = `${FileSystem.documentDirectory}${fullFilename}`;
        await FileSystem.writeAsStringAsync(fileUri, csvData, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: `Export ${type}` });
        }
      }

      const log: ExportLog = {
        type,
        timestamp: new Date().toISOString(),
        recordCount: csvData.split("\n").length - 1,
        format: "csv",
      };
      setExportLogs((prev) => [log, ...prev.slice(0, 9)]);
      Alert.alert("Export Complete", `${log.recordCount} records exported as ${fullFilename}`);
    } catch (e) {
      console.error("Export error:", e);
      Alert.alert("Export Failed", "An error occurred while exporting. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    Alert.alert(
      "Export All Data",
      `This will export all 7 data types for ${adminUser?.city}, ${adminUser?.province} as separate CSV files.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export All",
          onPress: async () => {
            for (const item of exportItems) {
              await doExport(item.id);
              await new Promise((r) => setTimeout(r, 500));
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Data Export Center</Text>
          <Text style={styles.subtitle}>{adminUser?.city}, {adminUser?.province}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="info" size={18} color="#1D4ED8" />
          <Text style={styles.infoText}>
            All exports are scoped to <Text style={{ fontWeight: "700" }}>{adminUser?.city}, {adminUser?.province}</Text>.
            Financial data (commissions, payments, wallets) is excluded.
          </Text>
        </View>

        {/* Export All Button */}
        <TouchableOpacity style={styles.exportAllBtn} onPress={handleExportAll} disabled={!!exporting}>
          <MaterialIcons name="download" size={20} color="#fff" />
          <Text style={styles.exportAllText}>Export All Data (7 files)</Text>
        </TouchableOpacity>

        {/* Individual Export Items */}
        <Text style={styles.sectionTitle}>Export by Category</Text>
        {exportItems.map((item) => (
          <View key={item.id} style={styles.exportCard}>
            <View style={[styles.exportIcon, { backgroundColor: item.color + "15" }]}>
              <MaterialIcons name={item.icon as any} size={24} color={item.color} />
            </View>
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>{item.title}</Text>
              <Text style={styles.exportDesc}>{item.description}</Text>
              {item.recordCount !== undefined && (
                <Text style={styles.exportCount}>{item.recordCount} records available</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: item.color }, exporting === item.id && { opacity: 0.7 }]}
              onPress={() => doExport(item.id)}
              disabled={!!exporting}
            >
              {exporting === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="file-download" size={16} color="#fff" />
                  <Text style={styles.exportBtnText}>CSV</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ))}

        {/* Export Log */}
        {exportLogs.length > 0 && (
          <View style={styles.logSection}>
            <Text style={styles.sectionTitle}>Recent Exports</Text>
            {exportLogs.map((log, i) => (
              <View key={i} style={styles.logRow}>
                <MaterialIcons name="check-circle" size={16} color="#059669" />
                <Text style={styles.logText}>
                  {log.type.charAt(0).toUpperCase() + log.type.slice(1)} — {log.recordCount} records
                </Text>
                <Text style={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString()}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Format Note */}
        <View style={styles.formatNote}>
          <MaterialIcons name="table-chart" size={16} color="#9CA3AF" />
          <Text style={styles.formatNoteText}>
            CSV files can be opened in Microsoft Excel, Google Sheets, or any spreadsheet application.
            PDF export available in future update.
          </Text>
        </View>
      </ScrollView>
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
  scroll: { padding: _rs.sp(16), paddingBottom: _rs.sp(40) },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: _rs.sp(10), backgroundColor: "#EFF6FF", borderRadius: _rs.s(12), padding: _rs.sp(14), marginBottom: _rs.sp(16), borderWidth: 1, borderColor: "#BFDBFE" },
  infoText: { flex: 1, fontSize: _rs.fs(13), color: "#1D4ED8", lineHeight: _rs.fs(18) },
  exportAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: _rs.sp(8), backgroundColor: "#111827", paddingVertical: _rs.sp(14), borderRadius: _rs.s(12), marginBottom: _rs.sp(20) },
  exportAllText: { color: "#fff", fontSize: _rs.fs(15), fontWeight: "600" },
  sectionTitle: { fontSize: _rs.fs(14), fontWeight: "600", color: "#374151", marginBottom: _rs.sp(10) },
  exportCard: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12), backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), marginBottom: _rs.sp(10), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  exportIcon: { width: _rs.s(48), height: _rs.s(48), borderRadius: _rs.s(12), alignItems: "center", justifyContent: "center" },
  exportInfo: { flex: 1 },
  exportTitle: { fontSize: _rs.fs(14), fontWeight: "600", color: "#111827" },
  exportDesc: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  exportCount: { fontSize: _rs.fs(11), color: "#9CA3AF", marginTop: _rs.sp(2) },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: _rs.sp(4), paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(8), borderRadius: _rs.s(10), minWidth: 60, justifyContent: "center" },
  exportBtnText: { color: "#fff", fontSize: _rs.fs(12), fontWeight: "700" },
  logSection: { marginTop: _rs.sp(16), backgroundColor: "#F9FAFB", borderRadius: _rs.s(12), padding: _rs.sp(14) },
  logRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8), paddingVertical: _rs.sp(6), borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  logText: { flex: 1, fontSize: _rs.fs(13), color: "#374151" },
  logTime: { fontSize: _rs.fs(11), color: "#9CA3AF" },
  formatNote: { flexDirection: "row", alignItems: "flex-start", gap: _rs.sp(8), marginTop: _rs.sp(16), padding: _rs.sp(12), backgroundColor: "#F9FAFB", borderRadius: _rs.s(10) },
  formatNoteText: { flex: 1, fontSize: _rs.fs(12), color: "#9CA3AF", lineHeight: _rs.fs(17) },
});
