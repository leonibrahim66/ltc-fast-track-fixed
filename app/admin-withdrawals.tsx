/**
 * Admin Withdrawal Management Screen
 *
 * Available to: super_admin, finance_admin
 * Located under: Admin Finance Panel
 *
 * Features:
 * - View all withdrawal requests (pending / approved / rejected / completed / failed)
 * - Approve or reject requests with admin notes
 * - View full transaction log per request
 * - All admin actions are recorded (reviewedBy, reviewedAt, adminNotes)
 *
 * Data source: withdrawal_requests table (via tRPC paymentService)
 */

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAdmin } from "@/lib/admin-context";
import { useWithdrawals } from "@/lib/withdrawals-context";

import { getStaticResponsive } from "@/hooks/use-responsive";
// ─── Types ────────────────────────────────────────────────────────────────────

type WithdrawalStatus = "pending" | "approved" | "rejected" | "completed" | "failed";
type WithdrawalMethod = "mtn_momo" | "airtel_money" | "zamtel_money" | "bank_transfer";
type ProviderRole = "zone_manager" | "carrier_driver";

interface WithdrawalRequest {
  id: number;
  providerId: number;
  providerRole: ProviderRole;
  providerName: string;
  providerPhone: string;
  amount: string;
  withdrawalMethod: WithdrawalMethod;
  accountNumber: string;
  accountName?: string;
  status: WithdrawalStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  adminNotes?: string | null;
  withdrawalReference?: string | null;
  mtnDisbursementAccepted?: boolean | null;
  requestedAt: string;
  completedAt?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatZMW(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "ZMW 0.00";
  return `ZMW ${num.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("en-ZM", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function methodLabel(method: WithdrawalMethod): string {
  const map: Record<WithdrawalMethod, string> = {
    mtn_momo: "MTN MoMo",
    airtel_money: "Airtel Money",
    zamtel_money: "Zamtel Money",
    bank_transfer: "Bank Transfer",
  };
  return map[method] ?? method;
}

function statusConfig(status: WithdrawalStatus, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case "pending": return { color: colors.warning, label: "PENDING", bg: colors.warning + "22" };
    case "approved": return { color: colors.primary, label: "APPROVED", bg: colors.primary + "22" };
    case "completed": return { color: colors.success, label: "COMPLETED", bg: colors.success + "22" };
    case "rejected": return { color: colors.error, label: "REJECTED", bg: colors.error + "22" };
    case "failed": return { color: colors.error, label: "FAILED", bg: colors.error + "22" };
    default: return { color: colors.muted, label: (status as string).toUpperCase(), bg: colors.muted + "22" };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminWithdrawalsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { adminUser } = useAdmin();

  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | WithdrawalStatus>("all");
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const { withdrawals, updateWithdrawalStatus } = useWithdrawals();

  // Map context Withdrawal objects to the screen's WithdrawalRequest type
  const mapContextWithdrawals = (ws: typeof withdrawals): WithdrawalRequest[] =>
    ws.map((w, idx) => ({
      id: idx + 1000,
      providerId: parseInt(w.userId.replace(/\D/g, "").slice(-6) || "0", 10) || idx + 100,
      providerRole: "zone_manager" as ProviderRole,
      providerName: w.accountName || w.userId,
      providerPhone: w.accountNumber,
      amount: w.amount.toFixed(2),
      withdrawalMethod: (w.method === "mtn" ? "mtn_momo" : w.method === "airtel" ? "airtel_money" : "bank_transfer") as WithdrawalMethod,
      accountNumber: w.accountNumber,
      accountName: w.accountName,
      status: (w.status === "paid" ? "completed" : w.status) as WithdrawalStatus,
      rejectionReason: w.rejectionReason,
      requestedAt: w.createdAt,
      completedAt: w.processedAt,
      withdrawalReference: w.reference,
      _contextId: w.id,
    } as WithdrawalRequest & { _contextId: string }));

  // Fix 6: Always use real context data — no mock fallback
  const [requests, setRequests] = useState<WithdrawalRequest[]>(
    mapContextWithdrawals(withdrawals)
  );

  // Sync whenever context withdrawals change
  useEffect(() => {
    setRequests(mapContextWithdrawals(withdrawals));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawals.length, withdrawals]);

  // Access control — only super_admin and finance_admin
  const canAccess = adminUser?.role === "superadmin" || adminUser?.role === "finance";

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRequests(mapContextWithdrawals(withdrawals));
    setRefreshing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawals]);

  const filteredRequests = requests.filter((r) =>
    activeFilter === "all" ? true : r.status === activeFilter,
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const openAction = (request: WithdrawalRequest, type: "approve" | "reject") => {
    setSelectedRequest(request);
    setActionType(type);
    setAdminNotes("");
  };

  const handleAction = () => {
    if (!selectedRequest || !actionType || !adminUser) return;

    if (actionType === "reject" && !adminNotes.trim()) {
      Alert.alert("Notes Required", "Please provide a reason for rejection.");
      return;
    }

    setProcessing(true);
    const newStatus: WithdrawalStatus = actionType === "approve" ? "approved" : "rejected";
    // Fix 6: Persist status update to WithdrawalsContext (AsyncStorage)
    const contextId = (selectedRequest as WithdrawalRequest & { _contextId?: string })._contextId;
    if (contextId) {
      updateWithdrawalStatus(
        contextId,
        newStatus === "approved" ? "approved" : "rejected",
        adminNotes.trim() || undefined
      ).catch((e) => console.error("Failed to update withdrawal status:", e));
    }
    setRequests((prev) =>
      prev.map((r) =>
        r.id === selectedRequest.id
          ? {
              ...r,
              status: newStatus,
              reviewedBy: adminUser.username,
              reviewedAt: new Date().toISOString(),
              adminNotes: adminNotes.trim() || undefined,
            }
          : r,
      ),
    );
    setProcessing(false);
    setSelectedRequest(null);
    setActionType(null);
    Alert.alert(
      actionType === "approve" ? "Request Approved" : "Request Rejected",
      actionType === "approve"
        ? `Withdrawal of ${formatZMW(selectedRequest.amount)} has been approved. Payout will be processed via ${methodLabel(selectedRequest.withdrawalMethod)}.`
        : `Withdrawal request has been rejected. Provider will be notified.`,
    );
  };

  if (!canAccess) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text style={[styles.accessDeniedTitle, { color: colors.error }]}>Access Denied</Text>
        <Text style={[styles.accessDeniedText, { color: colors.muted }]}>
          Withdrawal management is restricted to Super Admin and Finance Admin roles.
        </Text>
        <TouchableOpacity
          style={[styles.backBtnLarge, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnLargeText}>Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Withdrawal Management</Text>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
              </View>
            )}
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Summary Row */}
        <View style={styles.summaryRow}>
          {(["pending", "approved", "completed", "rejected"] as WithdrawalStatus[]).map((s) => {
            const count = requests.filter((r) => r.status === s).length;
            const cfg = statusConfig(s, colors);
            return (
              <TouchableOpacity
                key={s}
                style={[styles.summaryCard, { backgroundColor: cfg.bg, borderColor: cfg.color + "44" }]}
                onPress={() => setActiveFilter(s)}
              >
                <Text style={[styles.summaryCount, { color: cfg.color }]}>{count}</Text>
                <Text style={[styles.summaryLabel, { color: cfg.color }]}>{cfg.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <View style={styles.tabsRow}>
            {(["all", "pending", "approved", "completed", "rejected", "failed"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  { borderColor: colors.border },
                  activeFilter === tab && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                onPress={() => setActiveFilter(tab)}
              >
                <Text style={[styles.tabText, { color: activeFilter === tab ? "#fff" : colors.muted }]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Request List */}
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No withdrawal requests found</Text>
          </View>
        ) : (
          filteredRequests.map((req) => {
            const cfg = statusConfig(req.status, colors);
            return (
              <View key={req.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={[styles.providerName, { color: colors.foreground }]}>{req.providerName}</Text>
                    <Text style={[styles.providerRole, { color: colors.muted }]}>
                      {req.providerRole === "zone_manager" ? "Zone Manager" : "Carrier Driver"}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                {/* Amount & Method */}
                <View style={styles.cardRow}>
                  <View>
                    <Text style={[styles.cardLabel, { color: colors.muted }]}>Amount</Text>
                    <Text style={[styles.cardAmount, { color: colors.foreground }]}>{formatZMW(req.amount)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.cardLabel, { color: colors.muted }]}>Method</Text>
                    <Text style={[styles.cardValue, { color: colors.foreground }]}>{methodLabel(req.withdrawalMethod)}</Text>
                  </View>
                </View>

                {/* Account */}
                <View style={styles.cardRow}>
                  <View>
                    <Text style={[styles.cardLabel, { color: colors.muted }]}>Account</Text>
                    <Text style={[styles.cardValue, { color: colors.foreground }]}>{req.accountNumber}</Text>
                    {req.accountName && (
                      <Text style={[styles.cardSubValue, { color: colors.muted }]}>{req.accountName}</Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.cardLabel, { color: colors.muted }]}>Requested</Text>
                    <Text style={[styles.cardSubValue, { color: colors.muted }]}>{formatDateTime(req.requestedAt)}</Text>
                  </View>
                </View>

                {/* Admin Review Info */}
                {req.reviewedBy && (
                  <View style={[styles.reviewInfo, { backgroundColor: colors.background }]}>
                    <Text style={[styles.reviewLabel, { color: colors.muted }]}>
                      Reviewed by <Text style={{ color: colors.foreground, fontWeight: "600" }}>{req.reviewedBy}</Text>
                      {req.reviewedAt ? ` · ${formatDateTime(req.reviewedAt)}` : ""}
                    </Text>
                    {req.adminNotes && (
                      <Text style={[styles.reviewNotes, { color: colors.muted }]}>Note: {req.adminNotes}</Text>
                    )}
                    {req.withdrawalReference && (
                      <Text style={[styles.reviewNotes, { color: colors.muted }]}>Ref: {req.withdrawalReference}</Text>
                    )}
                  </View>
                )}

                {/* Action Buttons — only for pending requests */}
                {req.status === "pending" && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, { borderColor: colors.error }]}
                      onPress={() => openAction(req, "reject")}
                    >
                      <Text style={[styles.rejectBtnText, { color: colors.error }]}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, { backgroundColor: colors.success }]}
                      onPress={() => openAction(req, "approve")}
                    >
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Action Modal */}
      <Modal
        visible={!!selectedRequest && !!actionType}
        animationType="slide"
        transparent
        onRequestClose={() => { setSelectedRequest(null); setActionType(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {actionType === "approve" ? "Approve Withdrawal" : "Reject Withdrawal"}
            </Text>

            {selectedRequest && (
              <View style={[styles.modalSummary, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalSummaryText, { color: colors.foreground }]}>
                  {selectedRequest.providerName} — {formatZMW(selectedRequest.amount)}
                </Text>
                <Text style={[styles.modalSummarySubtext, { color: colors.muted }]}>
                  {methodLabel(selectedRequest.withdrawalMethod)} · {selectedRequest.accountNumber}
                </Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Admin Notes {actionType === "reject" ? "(required)" : "(optional)"}
            </Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder={actionType === "approve" ? "Add notes (optional)..." : "Reason for rejection..."}
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              value={adminNotes}
              onChangeText={setAdminNotes}
            />

            {actionType === "approve" && (
              <View style={[styles.approvalNote, { backgroundColor: colors.success + "15" }]}>
                <Text style={[styles.approvalNoteText, { color: colors.success }]}>
                  Approving will queue the payout via MTN MoMo Disbursement API. The provider will receive funds after processing.
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => { setSelectedRequest(null); setActionType(null); }}
              >
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: actionType === "approve" ? colors.success : colors.error },
                  processing && { opacity: 0.6 },
                ]}
                onPress={handleAction}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    {actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: _rs.sp(32) },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(14),
    paddingTop: _rs.sp(20),
  },
  backBtn: { padding: _rs.sp(4) },
  backText: { color: "#fff", fontSize: _rs.fs(15), fontWeight: "600" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: _rs.fs(18), fontWeight: "700", color: "#fff" },
  pendingBadge: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(2), marginTop: _rs.sp(2) },
  pendingBadgeText: { color: "#fff", fontSize: _rs.fs(11), fontWeight: "600" },
  headerSpacer: { width: _rs.s(48) },

  summaryRow: { flexDirection: "row", paddingHorizontal: _rs.sp(16), paddingTop: _rs.sp(16), gap: _rs.sp(8) },
  summaryCard: { flex: 1, borderRadius: _rs.s(10), padding: _rs.sp(10), alignItems: "center", borderWidth: 1 },
  summaryCount: { fontSize: _rs.fs(20), fontWeight: "800" },
  summaryLabel: { fontSize: _rs.fs(10), fontWeight: "600", marginTop: _rs.sp(2) },

  tabsScroll: { paddingLeft: _rs.sp(16), marginTop: _rs.sp(12), marginBottom: _rs.sp(4) },
  tabsRow: { flexDirection: "row", gap: _rs.sp(8), paddingRight: _rs.sp(16) },
  tab: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), borderWidth: 1 },
  tabText: { fontSize: _rs.fs(13), fontWeight: "600" },

  emptyContainer: { alignItems: "center", paddingVertical: _rs.sp(40) },
  emptyText: { fontSize: _rs.fs(14) },

  card: { marginHorizontal: _rs.sp(16), marginTop: _rs.sp(10), borderRadius: _rs.s(14), borderWidth: 1, padding: _rs.sp(16) },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardHeaderLeft: {},
  providerName: { fontSize: _rs.fs(15), fontWeight: "700" },
  providerRole: { fontSize: _rs.fs(12), marginTop: _rs.sp(2) },
  statusBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(3), borderRadius: _rs.s(8) },
  statusText: { fontSize: _rs.fs(11), fontWeight: "700" },
  divider: { height: 1, marginVertical: _rs.sp(12) },
  cardRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: _rs.sp(10) },
  cardLabel: { fontSize: _rs.fs(11), marginBottom: _rs.sp(2) },
  cardAmount: { fontSize: _rs.fs(18), fontWeight: "800" },
  cardValue: { fontSize: _rs.fs(14), fontWeight: "600" },
  cardSubValue: { fontSize: _rs.fs(12), marginTop: _rs.sp(2) },

  reviewInfo: { borderRadius: _rs.s(8), padding: _rs.sp(10), marginTop: _rs.sp(4), marginBottom: _rs.sp(8) },
  reviewLabel: { fontSize: _rs.fs(12) },
  reviewNotes: { fontSize: _rs.fs(12), marginTop: _rs.sp(4) },

  actionRow: { flexDirection: "row", gap: _rs.sp(10), marginTop: _rs.sp(8) },
  rejectBtn: { flex: 1, borderWidth: 1.5, borderRadius: _rs.s(10), paddingVertical: _rs.sp(10), alignItems: "center" },
  rejectBtnText: { fontSize: _rs.fs(14), fontWeight: "700" },
  approveBtn: { flex: 2, borderRadius: _rs.s(10), paddingVertical: _rs.sp(10), alignItems: "center" },
  approveBtnText: { color: "#fff", fontSize: _rs.fs(14), fontWeight: "700" },

  bottomPad: { height: _rs.s(32) },

  // Access denied
  accessDeniedTitle: { fontSize: _rs.fs(22), fontWeight: "800", marginBottom: _rs.sp(8) },
  accessDeniedText: { fontSize: _rs.fs(14), textAlign: "center", lineHeight: _rs.fs(22), marginBottom: _rs.sp(24) },
  backBtnLarge: { borderRadius: _rs.s(12), paddingHorizontal: _rs.sp(32), paddingVertical: _rs.sp(14) },
  backBtnLargeText: { color: "#fff", fontSize: _rs.fs(16), fontWeight: "700" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: _rs.s(24), borderTopRightRadius: _rs.s(24), padding: _rs.sp(24), paddingBottom: _rs.sp(40) },
  modalHandle: { width: _rs.s(40), height: _rs.s(4), backgroundColor: "#ccc", borderRadius: _rs.s(2), alignSelf: "center", marginBottom: _rs.sp(16) },
  modalTitle: { fontSize: _rs.fs(20), fontWeight: "800", marginBottom: _rs.sp(12) },
  modalSummary: { borderRadius: _rs.s(10), padding: _rs.sp(14), marginBottom: _rs.sp(16) },
  modalSummaryText: { fontSize: _rs.fs(15), fontWeight: "700" },
  modalSummarySubtext: { fontSize: _rs.fs(13), marginTop: _rs.sp(4) },
  fieldLabel: { fontSize: _rs.fs(13), fontWeight: "600", marginBottom: _rs.sp(6) },
  notesInput: { borderWidth: 1, borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(12), fontSize: _rs.fs(14), minHeight: 80, textAlignVertical: "top" },
  approvalNote: { borderRadius: _rs.s(10), padding: _rs.sp(12), marginTop: _rs.sp(12) },
  approvalNoteText: { fontSize: _rs.fs(12), lineHeight: _rs.fs(18) },
  modalActions: { flexDirection: "row", gap: _rs.sp(12), marginTop: _rs.sp(20) },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: _rs.s(12), paddingVertical: _rs.sp(14), alignItems: "center" },
  cancelBtnText: { fontSize: _rs.fs(15), fontWeight: "600" },
  confirmBtn: { flex: 2, borderRadius: _rs.s(12), paddingVertical: _rs.sp(14), alignItems: "center" },
  confirmBtnText: { color: "#fff", fontSize: _rs.fs(15), fontWeight: "700" },
});
