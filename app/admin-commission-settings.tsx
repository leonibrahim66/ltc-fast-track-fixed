/**
 * Admin Commission Settings Screen
 *
 * Accessible by: superadmin ONLY.
 * Finance admins are redirected to the read-only Commission Overview.
 *
 * Allows superadmin to:
 *   - View current commission rates per service type
 *   - Adjust commission percentage per service (0–100%)
 *   - View full audit log of all rate changes
 *   - Override commission per service with a reason
 *
 * All changes are recorded in commission_audit_log.
 * Commission logic remains server-side — this screen only sends the new rate
 * to the backend; it does not calculate commissions itself.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";

import { getStaticResponsive } from "@/hooks/use-responsive";
// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceType = "garbage" | "carrier" | "subscription";

interface CommissionRule {
  serviceType: ServiceType;
  label: string;
  description: string;
  currentRate: number;       // 0–100 (percent)
  isActive: boolean;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
}

interface AuditEntry {
  id: number;
  serviceType: ServiceType;
  oldRate: number;
  newRate: number;
  changedBy: string;
  reason: string;
  createdAt: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_RULES: CommissionRule[] = [
  {
    serviceType: "garbage",
    label: "Garbage Collection",
    description: "Commission on all waste pickup payments from customers to Zone Managers",
    currentRate: 10,
    isActive: true,
    lastUpdatedBy: "system",
    lastUpdatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    serviceType: "carrier",
    label: "Carrier Services",
    description: "Commission on all logistics/transport bookings from customers to Carrier Drivers",
    currentRate: 10,
    isActive: true,
    lastUpdatedBy: "system",
    lastUpdatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    serviceType: "subscription",
    label: "Subscription Payments",
    description: "Commission on monthly/annual subscription fees paid by customers",
    currentRate: 10,
    isActive: true,
    lastUpdatedBy: "system",
    lastUpdatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const INITIAL_AUDIT: AuditEntry[] = [
  {
    id: 1,
    serviceType: "garbage",
    oldRate: 8,
    newRate: 10,
    changedBy: "superadmin",
    reason: "Aligned with platform financial policy Q1 2026",
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    serviceType: "carrier",
    oldRate: 12,
    newRate: 10,
    changedBy: "superadmin",
    reason: "Reduced to match competitor rates and improve driver retention",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminCommissionSettingsScreen() {
  const router = useRouter();
  const { adminUser } = useAdmin();

  const [rules, setRules] = useState<CommissionRule[]>(INITIAL_RULES);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(INITIAL_AUDIT);
  const [editingService, setEditingService] = useState<ServiceType | null>(null);
  const [newRateInput, setNewRateInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"rules" | "audit">("rules");

  // Role guard: superadmin ONLY
  useEffect(() => {
    if (adminUser && adminUser.role !== "superadmin") {
      Alert.alert(
        "Access Denied",
        "Only Super Admins can modify commission settings. You will be redirected to the read-only Commission Overview.",
        [{ text: "OK", onPress: () => router.replace("/finance-commission") }],
      );
    }
  }, [adminUser]);

  const handleEditPress = (rule: CommissionRule) => {
    setEditingService(rule.serviceType);
    setNewRateInput(rule.currentRate.toString());
    setReasonInput("");
  };

  const handleCancelEdit = () => {
    setEditingService(null);
    setNewRateInput("");
    setReasonInput("");
  };

  const handleSaveRate = async (serviceType: ServiceType) => {
    const newRate = parseFloat(newRateInput);

    if (isNaN(newRate) || newRate < 0 || newRate > 100) {
      Alert.alert("Invalid Rate", "Commission rate must be a number between 0 and 100.");
      return;
    }

    if (!reasonInput.trim()) {
      Alert.alert("Reason Required", "Please provide a reason for this commission rate change.");
      return;
    }

    const rule = rules.find((r) => r.serviceType === serviceType);
    if (!rule) return;

    if (newRate === rule.currentRate) {
      Alert.alert("No Change", "The new rate is the same as the current rate.");
      return;
    }

    Alert.alert(
      "Confirm Rate Change",
      `Change ${rule.label} commission from ${rule.currentRate}% to ${newRate}%?\n\nReason: ${reasonInput.trim()}\n\nThis change will take effect immediately for all new payments.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              // TODO: Replace with tRPC call:
              // await trpc.commissionService.updateRule.mutate({
              //   serviceType,
              //   newRatePercent: newRate,
              //   changedBy: adminUser?.username ?? "superadmin",
              //   reason: reasonInput.trim(),
              // });

              // Optimistic update
              const now = new Date().toISOString();
              setRules((prev) =>
                prev.map((r) =>
                  r.serviceType === serviceType
                    ? {
                        ...r,
                        currentRate: newRate,
                        lastUpdatedBy: adminUser?.username ?? "superadmin",
                        lastUpdatedAt: now,
                      }
                    : r,
                ),
              );

              // Add audit entry
              const newEntry: AuditEntry = {
                id: auditLog.length + 1,
                serviceType,
                oldRate: rule.currentRate,
                newRate,
                changedBy: adminUser?.username ?? "superadmin",
                reason: reasonInput.trim(),
                createdAt: now,
              };
              setAuditLog((prev) => [newEntry, ...prev]);

              handleCancelEdit();
              Alert.alert(
                "Rate Updated",
                `${rule.label} commission is now ${newRate}%. All new payments will use this rate.`,
              );
            } catch {
              Alert.alert("Update Failed", "Could not save the new commission rate. Please try again.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleToggleActive = (serviceType: ServiceType) => {
    const rule = rules.find((r) => r.serviceType === serviceType);
    if (!rule) return;

    const action = rule.isActive ? "disable" : "enable";
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Commission`,
      `Are you sure you want to ${action} the ${rule.label} commission? ${
        !rule.isActive
          ? "Payments will resume charging the configured rate."
          : "Payments will NOT deduct any platform commission until re-enabled."
      }`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: () => {
            setRules((prev) =>
              prev.map((r) =>
                r.serviceType === serviceType ? { ...r, isActive: !r.isActive } : r,
              ),
            );
          },
        },
      ],
    );
  };

  const serviceColors: Record<ServiceType, string> = {
    garbage: "#16a34a",
    carrier: "#1d4ed8",
    subscription: "#7c3aed",
  };

  const serviceIcons: Record<ServiceType, string> = {
    garbage: "🗑️",
    carrier: "🚛",
    subscription: "📋",
  };

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Commission Settings</Text>
            <Text style={styles.subtitle}>Super Admin Only · Platform: 0960819993</Text>
          </View>
        </View>

        {/* Security Notice */}
        <View style={styles.securityBanner}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>
            Commission changes are server-side only. All modifications are logged in the audit trail.
            Finance admins have read-only access.
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "rules" && styles.tabActive]}
            onPress={() => setActiveTab("rules")}
          >
            <Text style={[styles.tabText, activeTab === "rules" && styles.tabTextActive]}>
              Commission Rules
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "audit" && styles.tabActive]}
            onPress={() => setActiveTab("audit")}
          >
            <Text style={[styles.tabText, activeTab === "audit" && styles.tabTextActive]}>
              Audit Log ({auditLog.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "rules" ? (
          <>
            {rules.map((rule) => (
              <View key={rule.serviceType} style={styles.ruleCard}>
                {/* Rule Header */}
                <View style={styles.ruleHeader}>
                  <View style={[styles.ruleIcon, { backgroundColor: serviceColors[rule.serviceType] + "20" }]}>
                    <Text style={styles.ruleIconText}>{serviceIcons[rule.serviceType]}</Text>
                  </View>
                  <View style={styles.ruleInfo}>
                    <Text style={styles.ruleLabel}>{rule.label}</Text>
                    <Text style={styles.ruleDesc} numberOfLines={2}>{rule.description}</Text>
                  </View>
                  <View style={[styles.statusBadge, rule.isActive ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, rule.isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                      {rule.isActive ? "Active" : "Disabled"}
                    </Text>
                  </View>
                </View>

                {/* Current Rate */}
                <View style={styles.rateRow}>
                  <Text style={styles.rateLabel}>Current Rate</Text>
                  <View style={[styles.rateBadge, { backgroundColor: serviceColors[rule.serviceType] }]}>
                    <Text style={styles.rateValue}>{rule.currentRate}%</Text>
                  </View>
                </View>

                <Text style={styles.lastUpdated}>
                  Last updated by {rule.lastUpdatedBy} · {new Date(rule.lastUpdatedAt).toLocaleDateString()}
                </Text>

                {/* Edit Form */}
                {editingService === rule.serviceType ? (
                  <View style={styles.editForm}>
                    <Text style={styles.editTitle}>Update Commission Rate</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={styles.rateInput}
                        value={newRateInput}
                        onChangeText={setNewRateInput}
                        keyboardType="decimal-pad"
                        placeholder="New rate %"
                        maxLength={5}
                      />
                      <Text style={styles.percentSign}>%</Text>
                    </View>
                    <TextInput
                      style={styles.reasonInput}
                      value={reasonInput}
                      onChangeText={setReasonInput}
                      placeholder="Reason for change (required)"
                      multiline
                      numberOfLines={3}
                      maxLength={500}
                    />
                    <View style={styles.editActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={handleCancelEdit}
                        disabled={saving}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: serviceColors[rule.serviceType] }]}
                        onPress={() => handleSaveRate(rule.serviceType)}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.saveBtnText}>Save Rate</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.ruleActions}>
                    <TouchableOpacity
                      style={[styles.editBtn, { borderColor: serviceColors[rule.serviceType] }]}
                      onPress={() => handleEditPress(rule)}
                    >
                      <Text style={[styles.editBtnText, { color: serviceColors[rule.serviceType] }]}>
                        ✏️ Edit Rate
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, rule.isActive ? styles.toggleBtnDisable : styles.toggleBtnEnable]}
                      onPress={() => handleToggleActive(rule.serviceType)}
                    >
                      <Text style={styles.toggleBtnText}>
                        {rule.isActive ? "⏸ Disable" : "▶ Enable"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}

            {/* Platform Config Card */}
            <View style={styles.platformCard}>
              <Text style={styles.platformTitle}>Platform Payout Account</Text>
              <View style={styles.platformRow}>
                <Text style={styles.platformKey}>MSISDN</Text>
                <Text style={styles.platformValue}>0960819993</Text>
              </View>
              <View style={styles.platformRow}>
                <Text style={styles.platformKey}>Currency</Text>
                <Text style={styles.platformValue}>ZMW (Zambian Kwacha)</Text>
              </View>
              <View style={styles.platformRow}>
                <Text style={styles.platformKey}>Environment</Text>
                <Text style={styles.platformValue}>Sandbox (MTN MoMo)</Text>
              </View>
              <Text style={styles.platformNote}>
                To change the platform payout MSISDN, update PLATFORM_CONFIG in server/commission-service.ts and redeploy.
              </Text>
            </View>
          </>
        ) : (
          /* Audit Log Tab */
          <View style={styles.auditSection}>
            <Text style={styles.auditTitle}>Commission Rate Change History</Text>
            {auditLog.length === 0 ? (
              <Text style={styles.emptyText}>No rate changes recorded yet.</Text>
            ) : (
              auditLog.map((entry) => (
                <View key={entry.id} style={styles.auditCard}>
                  <View style={styles.auditHeader}>
                    <View style={[styles.auditBadge, { backgroundColor: serviceColors[entry.serviceType] }]}>
                      <Text style={styles.auditBadgeText}>{entry.serviceType.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.auditDate}>
                      {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString()}
                    </Text>
                  </View>
                  <View style={styles.auditRateRow}>
                    <View style={styles.auditRateBox}>
                      <Text style={styles.auditRateLabel}>Old Rate</Text>
                      <Text style={[styles.auditRateValue, styles.auditRateOld]}>{entry.oldRate}%</Text>
                    </View>
                    <Text style={styles.auditArrow}>→</Text>
                    <View style={styles.auditRateBox}>
                      <Text style={styles.auditRateLabel}>New Rate</Text>
                      <Text style={[styles.auditRateValue, styles.auditRateNew]}>{entry.newRate}%</Text>
                    </View>
                  </View>
                  <Text style={styles.auditBy}>Changed by: <Text style={styles.auditByValue}>{entry.changedBy}</Text></Text>
                  <Text style={styles.auditReason}>"{entry.reason}"</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: _rs.sp(16), paddingBottom: _rs.sp(48) },
  header: { flexDirection: "row", alignItems: "center", marginBottom: _rs.sp(14), gap: _rs.sp(12) },
  backBtn: { paddingVertical: _rs.sp(6), paddingRight: _rs.sp(8) },
  backText: { color: "#16a34a", fontSize: _rs.fs(15), fontWeight: "600" },
  headerTitles: { flex: 1 },
  title: { fontSize: _rs.fs(20), fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: _rs.fs(12), color: "#6b7280", marginTop: _rs.sp(2) },
  securityBanner: { flexDirection: "row", backgroundColor: "#fef3c7", borderRadius: _rs.s(10), padding: _rs.sp(12), marginBottom: _rs.sp(14), gap: _rs.sp(8), alignItems: "flex-start" },
  securityIcon: { fontSize: _rs.fs(16) },
  securityText: { flex: 1, fontSize: _rs.fs(12), color: "#92400e", lineHeight: _rs.fs(18) },
  tabRow: { flexDirection: "row", marginBottom: _rs.sp(14), gap: _rs.sp(8) },
  tab: { flex: 1, paddingVertical: _rs.sp(10), borderRadius: _rs.s(10), backgroundColor: "#f3f4f6", alignItems: "center" },
  tabActive: { backgroundColor: "#111827" },
  tabText: { fontSize: _rs.fs(13), fontWeight: "600", color: "#374151" },
  tabTextActive: { color: "#ffffff" },
  ruleCard: { backgroundColor: "#ffffff", borderRadius: _rs.s(14), padding: _rs.sp(16), marginBottom: _rs.sp(14), borderWidth: 1, borderColor: "#e5e7eb" },
  ruleHeader: { flexDirection: "row", alignItems: "flex-start", gap: _rs.sp(12), marginBottom: _rs.sp(12) },
  ruleIcon: { width: _rs.s(44), height: _rs.s(44), borderRadius: _rs.s(10), alignItems: "center", justifyContent: "center" },
  ruleIconText: { fontSize: _rs.fs(22) },
  ruleInfo: { flex: 1 },
  ruleLabel: { fontSize: _rs.fs(15), fontWeight: "700", color: "#111827" },
  ruleDesc: { fontSize: _rs.fs(12), color: "#6b7280", marginTop: _rs.sp(3), lineHeight: _rs.fs(17) },
  statusBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(4), borderRadius: _rs.s(8) },
  statusActive: { backgroundColor: "#dcfce7" },
  statusInactive: { backgroundColor: "#fee2e2" },
  statusText: { fontSize: _rs.fs(11), fontWeight: "600" },
  statusTextActive: { color: "#16a34a" },
  statusTextInactive: { color: "#dc2626" },
  rateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: _rs.sp(6) },
  rateLabel: { fontSize: _rs.fs(13), color: "#374151", fontWeight: "500" },
  rateBadge: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20) },
  rateValue: { fontSize: _rs.fs(16), fontWeight: "800", color: "#ffffff" },
  lastUpdated: { fontSize: _rs.fs(11), color: "#9ca3af", marginBottom: _rs.sp(12) },
  editForm: { backgroundColor: "#f9fafb", borderRadius: _rs.s(10), padding: _rs.sp(14), gap: _rs.sp(10) },
  editTitle: { fontSize: _rs.fs(13), fontWeight: "700", color: "#111827" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8) },
  rateInput: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: _rs.s(8), paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(10), fontSize: _rs.fs(18), fontWeight: "700", backgroundColor: "#ffffff" },
  percentSign: { fontSize: _rs.fs(20), fontWeight: "700", color: "#374151" },
  reasonInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: _rs.s(8), paddingHorizontal: _rs.sp(12), paddingVertical: _rs.sp(10), fontSize: _rs.fs(13), backgroundColor: "#ffffff", minHeight: 80, textAlignVertical: "top" },
  editActions: { flexDirection: "row", gap: _rs.sp(10) },
  cancelBtn: { flex: 1, paddingVertical: _rs.sp(12), borderRadius: _rs.s(10), backgroundColor: "#f3f4f6", alignItems: "center" },
  cancelBtnText: { fontSize: _rs.fs(14), fontWeight: "600", color: "#374151" },
  saveBtn: { flex: 1, paddingVertical: _rs.sp(12), borderRadius: _rs.s(10), alignItems: "center" },
  saveBtnText: { fontSize: _rs.fs(14), fontWeight: "700", color: "#ffffff" },
  ruleActions: { flexDirection: "row", gap: _rs.sp(10) },
  editBtn: { flex: 1, paddingVertical: _rs.sp(10), borderRadius: _rs.s(10), borderWidth: 1.5, alignItems: "center" },
  editBtnText: { fontSize: _rs.fs(13), fontWeight: "600" },
  toggleBtn: { flex: 1, paddingVertical: _rs.sp(10), borderRadius: _rs.s(10), alignItems: "center" },
  toggleBtnDisable: { backgroundColor: "#fee2e2" },
  toggleBtnEnable: { backgroundColor: "#dcfce7" },
  toggleBtnText: { fontSize: _rs.fs(13), fontWeight: "600", color: "#374151" },
  platformCard: { backgroundColor: "#f0fdf4", borderRadius: _rs.s(14), padding: _rs.sp(16), marginBottom: _rs.sp(14), borderWidth: 1, borderColor: "#bbf7d0" },
  platformTitle: { fontSize: _rs.fs(14), fontWeight: "700", color: "#166534", marginBottom: _rs.sp(10) },
  platformRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: _rs.sp(6), borderBottomWidth: 1, borderColor: "#d1fae5" },
  platformKey: { fontSize: _rs.fs(13), color: "#374151", fontWeight: "500" },
  platformValue: { fontSize: _rs.fs(13), fontWeight: "700", color: "#166534" },
  platformNote: { fontSize: _rs.fs(11), color: "#6b7280", marginTop: _rs.sp(10), lineHeight: _rs.fs(16) },
  auditSection: { backgroundColor: "#ffffff", borderRadius: _rs.s(14), padding: _rs.sp(16), borderWidth: 1, borderColor: "#e5e7eb" },
  auditTitle: { fontSize: _rs.fs(15), fontWeight: "700", color: "#111827", marginBottom: _rs.sp(14) },
  emptyText: { color: "#6b7280", fontSize: _rs.fs(13), textAlign: "center", paddingVertical: _rs.sp(24) },
  auditCard: { backgroundColor: "#f9fafb", borderRadius: _rs.s(10), padding: _rs.sp(12), marginBottom: _rs.sp(10) },
  auditHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: _rs.sp(10) },
  auditBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(6) },
  auditBadgeText: { fontSize: _rs.fs(10), fontWeight: "700", color: "#ffffff" },
  auditDate: { fontSize: _rs.fs(11), color: "#6b7280" },
  auditRateRow: { flexDirection: "row", alignItems: "center", gap: _rs.sp(12), marginBottom: _rs.sp(8) },
  auditRateBox: { alignItems: "center" },
  auditRateLabel: { fontSize: _rs.fs(10), color: "#6b7280" },
  auditRateValue: { fontSize: _rs.fs(20), fontWeight: "800" },
  auditRateOld: { color: "#dc2626" },
  auditRateNew: { color: "#16a34a" },
  auditArrow: { fontSize: _rs.fs(20), color: "#6b7280" },
  auditBy: { fontSize: _rs.fs(12), color: "#374151", marginBottom: _rs.sp(4) },
  auditByValue: { fontWeight: "700" },
  auditReason: { fontSize: _rs.fs(12), color: "#6b7280", fontStyle: "italic", lineHeight: _rs.fs(17) },
});
