/**
 * Council Admin — Tonnage Records
 * Full waste_tonnage_records management: zone view, area view, monthly totals, add record.
 * Province/city scoped. No financial access.
 */
import { useState, useCallback, useEffect } from "react";
import {
  Text, View, TouchableOpacity, ScrollView, StyleSheet,
  RefreshControl, TextInput, Alert, Modal, FlatList,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { useTonnage, WASTE_TYPE_LABELS, WASTE_TYPE_COLORS, WasteType, WasteTonnageRecord } from "@/lib/tonnage-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
type ViewTab = "zone" | "area" | "monthly" | "records";

interface ZoneOption { id: string; name: string; }

const WASTE_TYPES: WasteType[] = ["general", "recyclable", "organic", "hazardous", "construction", "medical", "electronic"];

export default function CouncilTonnageScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();
  const { records, loadRecords, addRecord, getSummary, getMonthlyTotals } = useTonnage();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("zone");
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add record form state
  const [formZoneId, setFormZoneId] = useState("");
  const [formWasteType, setFormWasteType] = useState<WasteType>("general");
  const [formEstWeight, setFormEstWeight] = useState("");
  const [formRecWeight, setFormRecWeight] = useState("");
  const [formArea, setFormArea] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formVehicle, setFormVehicle] = useState("");
  const [formSaving, setFormSaving] = useState(false);

  const loadZones = useCallback(async () => {
    if (!adminUser?.province) return;
    const raw = await AsyncStorage.getItem("@ltc_service_zones");
    const all: any[] = raw ? JSON.parse(raw) : [];
    const scoped = all.filter(
      (z) => z.province === adminUser.province || z.town === adminUser.city || z.city === adminUser.city
    );
    setZones(scoped.map((z) => ({ id: z.id, name: z.name })));
    if (scoped.length > 0 && !formZoneId) setFormZoneId(scoped[0].id);
  }, [adminUser, formZoneId]);

  useFocusEffect(useCallback(() => {
    loadRecords();
    loadZones();
  }, [loadRecords, loadZones]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  };

  const scopedRecords = adminUser
    ? records.filter((r) => r.province === adminUser.province && r.city === adminUser.city)
    : [];

  const summary = adminUser
    ? getSummary({ province: adminUser.province, city: adminUser.city })
    : null;

  const monthlyTotals = adminUser
    ? getMonthlyTotals(adminUser.province!, adminUser.city ?? undefined, 6)
    : [];

  const totalKg = summary ? summary.totalRecordedKg || summary.totalEstimatedKg : 0;
  const totalTonnes = (totalKg / 1000).toFixed(2);

  const handleSaveRecord = async () => {
    const estKg = parseFloat(formEstWeight);
    const recKg = formRecWeight ? parseFloat(formRecWeight) : undefined;
    if (!formZoneId || isNaN(estKg) || estKg <= 0) {
      Alert.alert("Validation Error", "Please select a zone and enter a valid estimated weight.");
      return;
    }
    setFormSaving(true);
    try {
      const zone = zones.find((z) => z.id === formZoneId);
      await addRecord({
        zoneId: formZoneId,
        zoneName: zone?.name || "Unknown Zone",
        wasteType: formWasteType,
        estimatedWeight: estKg,
        recordedWeight: recKg,
        province: adminUser?.province || "",
        city: adminUser?.city || "",
        area: formArea.trim() || undefined,
        notes: formNotes.trim() || undefined,
        vehicleType: formVehicle.trim() || undefined,
        recordedBy: adminUser?.fullName || "Council Admin",
        recordedByRole: "council_admin",
      });
      setShowAddModal(false);
      setFormEstWeight("");
      setFormRecWeight("");
      setFormArea("");
      setFormNotes("");
      setFormVehicle("");
      Alert.alert("Success", "Tonnage record saved successfully.");
    } catch (e) {
      Alert.alert("Error", "Failed to save record. Please try again.");
    } finally {
      setFormSaving(false);
    }
  };

  const maxZoneKg = summary
    ? Math.max(...Object.values(summary.byZone).map((z) => z.totalKg), 1)
    : 1;

  const maxMonthKg = monthlyTotals.length > 0
    ? Math.max(...monthlyTotals.map((m) => m.totalKg), 1)
    : 1;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Tonnage Records</Text>
          <Text style={styles.subtitle}>{adminUser?.city}, {adminUser?.province}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <MaterialIcons name="add" size={22} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryScroll} contentContainerStyle={styles.summaryContent}>
        <View style={[styles.summaryCard, { backgroundColor: "#F5F3FF" }]}>
          <MaterialIcons name="inventory" size={24} color="#7C3AED" />
          <Text style={[styles.summaryNum, { color: "#7C3AED" }]}>{totalTonnes}t</Text>
          <Text style={styles.summaryLabel}>Total Waste</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#F0FDF4" }]}>
          <MaterialIcons name="assignment" size={24} color="#059669" />
          <Text style={[styles.summaryNum, { color: "#059669" }]}>{scopedRecords.length}</Text>
          <Text style={styles.summaryLabel}>Records</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#EFF6FF" }]}>
          <MaterialIcons name="map" size={24} color="#1D4ED8" />
          <Text style={[styles.summaryNum, { color: "#1D4ED8" }]}>{Object.keys(summary?.byZone || {}).length}</Text>
          <Text style={styles.summaryLabel}>Active Zones</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: "#FEF3C7" }]}>
          <MaterialIcons name="recycling" size={24} color="#D97706" />
          <Text style={[styles.summaryNum, { color: "#D97706" }]}>
            {summary ? ((summary.totalRecordedKg / 1000)).toFixed(1) : "0.0"}t
          </Text>
          <Text style={styles.summaryLabel}>Recorded</Text>
        </View>
      </ScrollView>

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContent}>
        {(["zone", "area", "monthly", "records"] as ViewTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "zone" ? "By Zone" : tab === "area" ? "By Area" : tab === "monthly" ? "Monthly" : "All Records"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        {/* By Zone Tab */}
        {activeTab === "zone" && (
          <View style={styles.section}>
            {Object.entries(summary?.byZone || {}).length === 0 ? (
              <EmptyState icon="map" text="No zone data yet" sub="Add tonnage records to see zone breakdown" />
            ) : (
              Object.entries(summary!.byZone)
                .sort((a, b) => b[1].totalKg - a[1].totalKg)
                .map(([zoneId, data]) => (
                  <View key={zoneId} style={styles.barCard}>
                    <View style={styles.barCardHeader}>
                      <Text style={styles.barCardName}>{data.zoneName}</Text>
                      <Text style={styles.barCardValue}>{(data.totalKg / 1000).toFixed(2)}t</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${(data.totalKg / maxZoneKg) * 100}%` as any, backgroundColor: "#7C3AED" }]} />
                    </View>
                    <Text style={styles.barCardSub}>{data.recordCount} records · {data.totalKg.toFixed(0)} kg</Text>
                  </View>
                ))
            )}

            {/* Waste Type Breakdown */}
            {summary && Object.keys(summary.byWasteType).length > 0 && (
              <View style={styles.wasteTypeSection}>
                <Text style={styles.sectionTitle}>Waste Type Breakdown</Text>
                {Object.entries(summary.byWasteType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, kg]) => (
                    <View key={type} style={styles.wasteTypeRow}>
                      <View style={[styles.wasteTypeDot, { backgroundColor: WASTE_TYPE_COLORS[type as WasteType] }]} />
                      <Text style={styles.wasteTypeLabel}>{WASTE_TYPE_LABELS[type as WasteType]}</Text>
                      <Text style={styles.wasteTypeKg}>{(kg / 1000).toFixed(2)}t</Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        )}

        {/* By Area Tab */}
        {activeTab === "area" && (
          <View style={styles.section}>
            {Object.entries(summary?.byArea || {}).length === 0 ? (
              <EmptyState icon="location-on" text="No area data yet" sub="Include area names when recording tonnage" />
            ) : (
              Object.entries(summary!.byArea)
                .sort((a, b) => b[1] - a[1])
                .map(([area, kg]) => (
                  <View key={area} style={styles.areaCard}>
                    <View style={styles.areaIcon}>
                      <MaterialIcons name="location-on" size={18} color="#EA580C" />
                    </View>
                    <View style={styles.areaInfo}>
                      <Text style={styles.areaName}>{area}</Text>
                      <Text style={styles.areaKg}>{kg.toFixed(0)} kg collected</Text>
                    </View>
                    <Text style={styles.areaTonnes}>{(kg / 1000).toFixed(2)}t</Text>
                  </View>
                ))
            )}
          </View>
        )}

        {/* Monthly Tab */}
        {activeTab === "monthly" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last 6 Months</Text>
            {monthlyTotals.map((m) => (
              <View key={m.month} style={styles.barCard}>
                <View style={styles.barCardHeader}>
                  <Text style={styles.barCardName}>{m.month}</Text>
                  <Text style={styles.barCardValue}>{(m.totalKg / 1000).toFixed(2)}t</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, {
                    width: `${(m.totalKg / maxMonthKg) * 100}%` as any,
                    backgroundColor: m.totalKg > 0 ? "#059669" : "#E5E7EB",
                  }]} />
                </View>
                <Text style={styles.barCardSub}>{m.recordCount} records · {m.totalKg.toFixed(0)} kg</Text>
              </View>
            ))}
          </View>
        )}

        {/* All Records Tab */}
        {activeTab === "records" && (
          <View style={styles.section}>
            {scopedRecords.length === 0 ? (
              <EmptyState icon="inventory" text="No records yet" sub="Tap + to add the first tonnage record" />
            ) : (
              scopedRecords.map((r) => (
                <View key={r.id} style={styles.recordCard}>
                  <View style={styles.recordRow}>
                    <View style={[styles.recordIcon, { backgroundColor: WASTE_TYPE_COLORS[r.wasteType] + "15" }]}>
                      <MaterialIcons name="inventory" size={18} color={WASTE_TYPE_COLORS[r.wasteType]} />
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordZone}>{r.zoneName}</Text>
                      <Text style={styles.recordType}>{WASTE_TYPE_LABELS[r.wasteType]}</Text>
                    </View>
                    <View style={styles.recordWeights}>
                      <Text style={styles.recordKg}>{((r.recordedWeight ?? r.estimatedWeight) / 1000).toFixed(3)}t</Text>
                      {r.recordedWeight && r.recordedWeight !== r.estimatedWeight && (
                        <Text style={styles.recordEstKg}>est. {(r.estimatedWeight / 1000).toFixed(3)}t</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.recordMeta}>
                    <Text style={styles.recordMetaText}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                    {r.area && <Text style={styles.recordMetaText}>{r.area}</Text>}
                    <Text style={styles.recordMetaText}>by {r.recordedBy}</Text>
                  </View>
                  {r.notes && <Text style={styles.recordNotes}>{r.notes}</Text>}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Record Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Tonnage Record</Text>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <MaterialIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.formLabel}>Zone *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {zones.map((z) => (
                  <TouchableOpacity
                    key={z.id}
                    style={[styles.optionChip, formZoneId === z.id && styles.optionChipActive]}
                    onPress={() => setFormZoneId(z.id)}
                  >
                    <Text style={[styles.optionChipText, formZoneId === z.id && styles.optionChipTextActive]}>{z.name}</Text>
                  </TouchableOpacity>
                ))}
                {zones.length === 0 && <Text style={styles.formHint}>No zones available for {adminUser?.city}</Text>}
              </View>
            </ScrollView>

            <Text style={styles.formLabel}>Waste Type *</Text>
            <View style={styles.wasteTypeGrid}>
              {WASTE_TYPES.map((wt) => (
                <TouchableOpacity
                  key={wt}
                  style={[styles.wasteTypeChip, formWasteType === wt && { backgroundColor: WASTE_TYPE_COLORS[wt] + "20", borderColor: WASTE_TYPE_COLORS[wt] }]}
                  onPress={() => setFormWasteType(wt)}
                >
                  <View style={[styles.wasteTypeChipDot, { backgroundColor: WASTE_TYPE_COLORS[wt] }]} />
                  <Text style={[styles.wasteTypeChipText, formWasteType === wt && { color: WASTE_TYPE_COLORS[wt] }]}>
                    {WASTE_TYPE_LABELS[wt]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Estimated Weight (kg) *</Text>
            <TextInput style={styles.formInput} placeholder="e.g. 250" placeholderTextColor="#9CA3AF" value={formEstWeight} onChangeText={setFormEstWeight} keyboardType="decimal-pad" />

            <Text style={styles.formLabel}>Recorded Weight (kg) — optional</Text>
            <TextInput style={styles.formInput} placeholder="Actual weighed value" placeholderTextColor="#9CA3AF" value={formRecWeight} onChangeText={setFormRecWeight} keyboardType="decimal-pad" />

            <Text style={styles.formLabel}>Area / Neighbourhood — optional</Text>
            <TextInput style={styles.formInput} placeholder="e.g. Northmead, Woodlands" placeholderTextColor="#9CA3AF" value={formArea} onChangeText={setFormArea} />

            <Text style={styles.formLabel}>Vehicle Type / Plate — optional</Text>
            <TextInput style={styles.formInput} placeholder="e.g. Compactor ABZ 1234" placeholderTextColor="#9CA3AF" value={formVehicle} onChangeText={setFormVehicle} />

            <Text style={styles.formLabel}>Notes — optional</Text>
            <TextInput style={[styles.formInput, { height: 70, textAlignVertical: "top" }]} placeholder="Additional notes..." placeholderTextColor="#9CA3AF" value={formNotes} onChangeText={setFormNotes} multiline />

            <TouchableOpacity
              style={[styles.saveBtn, formSaving && { opacity: 0.7 }]}
              onPress={handleSaveRecord}
              disabled={formSaving}
            >
              <MaterialIcons name="save" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>{formSaving ? "Saving..." : "Save Record"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function EmptyState({ icon, text, sub }: { icon: string; text: string; sub: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, gap: 8 }}>
      <MaterialIcons name={icon as any} size={40} color="#D1D5DB" />
      <Text style={{ fontSize: 14, color: "#9CA3AF", fontWeight: "600" }}>{text}</Text>
      <Text style={{ fontSize: 12, color: "#D1D5DB", textAlign: "center" }}>{sub}</Text>
    </View>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), padding: _rs.sp(16), paddingBottom: _rs.sp(8) },
  backBtn: { padding: _rs.sp(4) },
  headerCenter: { flex: 1 },
  title: { fontSize: _rs.fs(18), fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  addBtn: { padding: _rs.sp(8), backgroundColor: "#F5F3FF", borderRadius: _rs.s(10) },
  summaryScroll: { maxHeight: 90 },
  summaryContent: { paddingHorizontal: _rs.sp(16), gap: _rs.sp(10), paddingBottom: _rs.sp(8) },
  summaryCard: { width: _rs.s(100), borderRadius: _rs.s(14), padding: _rs.sp(12), alignItems: "center", gap: _rs.sp(4) },
  summaryNum: { fontSize: _rs.fs(20), fontWeight: "700" },
  summaryLabel: { fontSize: _rs.fs(11), color: "#6B7280" },
  tabScroll: { maxHeight: 44, marginBottom: _rs.sp(4) },
  tabContent: { paddingHorizontal: _rs.sp(16), gap: _rs.sp(8) },
  tab: { paddingHorizontal: _rs.sp(16), paddingVertical: _rs.sp(8), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6" },
  tabActive: { backgroundColor: "#7C3AED" },
  tabText: { fontSize: _rs.fs(13), color: "#6B7280", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  scroll: { padding: _rs.sp(16), paddingBottom: _rs.sp(32) },
  section: { gap: _rs.sp(10) },
  sectionTitle: { fontSize: _rs.fs(14), fontWeight: "600", color: "#374151", marginBottom: _rs.sp(4) },
  barCard: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  barCardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: _rs.sp(8) },
  barCardName: { fontSize: _rs.fs(14), fontWeight: "600", color: "#111827" },
  barCardValue: { fontSize: _rs.fs(14), fontWeight: "700", color: "#7C3AED" },
  barTrack: { height: _rs.s(8), backgroundColor: "#F3F4F6", borderRadius: _rs.s(4), overflow: "hidden", marginBottom: _rs.sp(6) },
  barFill: { height: "100%", borderRadius: _rs.s(4) },
  barCardSub: { fontSize: _rs.fs(11), color: "#9CA3AF" },
  wasteTypeSection: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), marginTop: _rs.sp(4) },
  wasteTypeRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), paddingVertical: _rs.sp(6), borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  wasteTypeDot: { width: _rs.s(10), height: _rs.s(10), borderRadius: _rs.s(5) },
  wasteTypeLabel: { flex: 1, fontSize: _rs.fs(13), color: "#374151" },
  wasteTypeKg: { fontSize: _rs.fs(13), fontWeight: "600", color: "#111827" },
  areaCard: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12), backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  areaIcon: { width: _rs.s(40), height: _rs.s(40), borderRadius: _rs.s(10), backgroundColor: "#FFF7ED", alignItems: "center", justifyContent: "center" },
  areaInfo: { flex: 1 },
  areaName: { fontSize: _rs.fs(14), fontWeight: "600", color: "#111827" },
  areaKg: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(2) },
  areaTonnes: { fontSize: _rs.fs(16), fontWeight: "700", color: "#EA580C" },
  recordCard: { backgroundColor: "#fff", borderRadius: _rs.s(12), padding: _rs.sp(14), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  recordRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(10), marginBottom: _rs.sp(6) },
  recordIcon: { width: _rs.s(40), height: _rs.s(40), borderRadius: _rs.s(10), alignItems: "center", justifyContent: "center" },
  recordInfo: { flex: 1 },
  recordZone: { fontSize: _rs.fs(14), fontWeight: "600", color: "#111827" },
  recordType: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(1) },
  recordWeights: { alignItems: "flex-end" },
  recordKg: { fontSize: _rs.fs(16), fontWeight: "700", color: "#7C3AED" },
  recordEstKg: { fontSize: _rs.fs(10), color: "#9CA3AF" },
  recordMeta: { flexDirection: "row", gap: _rs.sp(12), flexWrap: "wrap" },
  recordMetaText: { fontSize: _rs.fs(11), color: "#9CA3AF" },
  recordNotes: { fontSize: _rs.fs(12), color: "#6B7280", marginTop: _rs.sp(4), fontStyle: "italic" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: _rs.sp(20), borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  modalTitle: { fontSize: _rs.fs(18), fontWeight: "700", color: "#111827" },
  modalScroll: { padding: _rs.sp(20), paddingBottom: _rs.sp(40) },
  formLabel: { fontSize: _rs.fs(13), fontWeight: "600", color: "#374151", marginBottom: _rs.sp(8), marginTop: _rs.sp(12) },
  formHint: { fontSize: _rs.fs(12), color: "#9CA3AF", paddingVertical: _rs.sp(8) },
  formInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(12), fontSize: _rs.fs(14), color: "#111827", backgroundColor: "#F9FAFB" },
  optionChip: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(8), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "transparent" },
  optionChipActive: { backgroundColor: "#EDE9FE", borderColor: "#7C3AED" },
  optionChipText: { fontSize: _rs.fs(13), color: "#6B7280" },
  optionChipTextActive: { color: "#7C3AED", fontWeight: "600" },
  wasteTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: _rs.sp(8), marginBottom: _rs.sp(4) },
  wasteTypeChip: { flexDirection: "row", alignItems: "center", gap: _rs.sp(6), paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(7), borderRadius: _rs.s(20), backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "transparent" },
  wasteTypeChipDot: { width: _rs.s(8), height: _rs.s(8), borderRadius: _rs.s(4) },
  wasteTypeChipText: { fontSize: _rs.fs(12), color: "#6B7280" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: _rs.sp(8), backgroundColor: "#7C3AED", paddingVertical: _rs.sp(14), borderRadius: _rs.s(12), marginTop: _rs.sp(20) },
  saveBtnText: { color: "#fff", fontSize: _rs.fs(15), fontWeight: "600" },
});
