/**
 * Provider Earnings Screen — "My Earnings"
 *
 * Available to Zone Managers and Carrier Drivers.
 * Shows wallet balance, total earnings, pending payouts, and transaction history.
 * Allows submitting a withdrawal request (goes through admin approval).
 *
 * Data source: AsyncStorage via WithdrawalsContext
 */

import React, { useState, useCallback } from "react";
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
import { useAuth } from "@/lib/auth-context";
import { useWithdrawals, Withdrawal } from "@/lib/withdrawals-context";

import { getStaticResponsive } from "@/hooks/use-responsive";
// ─── Types ────────────────────────────────────────────────────────────────────

type WithdrawalMethod = "mtn_momo" | "airtel_money" | "zamtel_money" | "bank_transfer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatZMW(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "ZMW 0.00";
  return `ZMW ${num.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-ZM", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function statusColor(status: string, colors: ReturnType<typeof useColors>): string {
  switch (status) {
    case "paid":
    case "approved": return colors.success;
    case "rejected": return colors.error;
    case "pending": return colors.warning;
    default: return colors.muted;
  }
}

// ─── Withdrawal Methods ───────────────────────────────────────────────────────

const WITHDRAWAL_METHODS: { value: WithdrawalMethod; label: string; hint: string; contextMethod: "mtn" | "airtel" | "bank" }[] = [
  { value: "mtn_momo", label: "MTN MoMo", hint: "Enter MTN phone number (e.g. 0971234567)", contextMethod: "mtn" },
  { value: "airtel_money", label: "Airtel Money", hint: "Enter Airtel phone number", contextMethod: "airtel" },
  { value: "zamtel_money", label: "Zamtel Money", hint: "Enter Zamtel phone number", contextMethod: "airtel" },
  { value: "bank_transfer", label: "Bank Transfer", hint: "Enter bank account number", contextMethod: "bank" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProviderEarningsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { withdrawals, createWithdrawal, getWithdrawalsByUser } = useWithdrawals();

  const [refreshing, setRefreshing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawalMethod>("mtn_momo");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "paid" | "pending" | "rejected">("all");

  // Real data from AsyncStorage via WithdrawalsContext
  const userWithdrawals: Withdrawal[] = user ? getWithdrawalsByUser(user.id) : [];

  const totalPaid = userWithdrawals
    .filter((w) => w.status === "paid")
    .reduce((sum, w) => sum + w.amount, 0);

  const totalPending = userWithdrawals
    .filter((w) => w.status === "pending" || w.status === "approved")
    .reduce((sum, w) => sum + w.amount, 0);

  // Available balance = total withdrawals requested but not yet paid (pending/approved)
  // For a real system this would come from a wallet balance; here we derive from withdrawals
  const availableBalance = 0; // No backend balance — show 0 until real wallet is wired

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // withdrawals context is reactive via StorageEventBus — just toggle refresh indicator
    setRefreshing(false);
  }, []);

  const filteredWithdrawals = userWithdrawals.filter((w) => {
    if (activeTab === "all") return true;
    if (activeTab === "paid") return w.status === "paid" || w.status === "approved";
    if (activeTab === "pending") return w.status === "pending";
    if (activeTab === "rejected") return w.status === "rejected";
    return true;
  });

  const handleWithdrawSubmit = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to request a withdrawal.");
      return;
    }
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid withdrawal amount.");
      return;
    }
    if (!accountNumber.trim()) {
      Alert.alert("Account Required", "Please enter your account number.");
      return;
    }

    const selectedMethodConfig = WITHDRAWAL_METHODS.find((m) => m.value === withdrawMethod);
    setSubmitting(true);
    try {
      await createWithdrawal({
        userId: user.id,
        amount,
        method: selectedMethodConfig?.contextMethod ?? "mtn",
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim() || undefined,
      });
      setSubmitting(false);
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setAccountNumber("");
      setAccountName("");
      Alert.alert(
        "Withdrawal Requested",
        `Your withdrawal of ${formatZMW(amount)} via ${selectedMethodConfig?.label} has been submitted for admin approval.`,
      );
    } catch (_error) {
      setSubmitting(false);
      Alert.alert("Error", "Failed to submit withdrawal request. Please try again.");
    }
  };

  const selectedMethod = WITHDRAWAL_METHODS.find((m) => m.value === withdrawMethod);

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
            <Text style={[styles.backText, { color: "#fff" }]}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Earnings</Text>
          <View style={styles.headerSpacer} />
        </View>

        <>
          {/* Balance Cards */}
          <View style={styles.cardsRow}>
            <View style={[styles.balanceCard, styles.balanceCardMain, { backgroundColor: colors.primary }]}>
              <Text style={styles.balanceLabelLight}>Available Balance</Text>
              <Text style={styles.balanceAmountLarge}>{formatZMW(availableBalance)}</Text>
              <TouchableOpacity
                style={styles.withdrawBtn}
                onPress={() => setShowWithdrawModal(true)}
              >
                <Text style={styles.withdrawBtnText}>Request Withdrawal</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Total Paid</Text>
              <Text style={[styles.statValue, { color: colors.success }]}>{formatZMW(totalPaid)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Total Requests</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{userWithdrawals.length}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Pending</Text>
              <Text style={[styles.statValue, { color: colors.warning }]}>{formatZMW(totalPending)}</Text>
            </View>
          </View>

          {/* Commission Info Banner */}
          <View style={[styles.commissionBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.commissionText, { color: colors.muted }]}>
              Platform commission: <Text style={{ color: colors.foreground, fontWeight: "600" }}>10%</Text> deducted automatically.
              You receive <Text style={{ color: colors.success, fontWeight: "600" }}>90%</Text> of each payment.
            </Text>
          </View>

          {/* Withdrawal History */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Withdrawal History</Text>
            <Text style={[styles.txnCount, { color: colors.muted }]}>{filteredWithdrawals.length} records</Text>
          </View>

          {/* Filter Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
            <View style={styles.tabsRow}>
              {(["all", "paid", "pending", "rejected"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    { borderColor: colors.border },
                    activeTab === tab && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[
                    styles.tabText,
                    { color: activeTab === tab ? "#fff" : colors.muted },
                  ]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {filteredWithdrawals.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>No withdrawal records found</Text>
            </View>
          ) : (
            filteredWithdrawals.map((w) => (
              <View
                key={w.id}
                style={[styles.txnCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.txnTop}>
                  <View style={styles.txnLeft}>
                    <Text style={[styles.txnService, { color: colors.foreground }]}>
                      Withdrawal Request
                    </Text>
                    <Text style={[styles.txnDate, { color: colors.muted }]}>{formatDate(w.createdAt)}</Text>
                    <Text style={[styles.txnRef, { color: colors.muted }]}>Ref: {w.reference}</Text>
                  </View>
                  <View style={styles.txnRight}>
                    <Text style={[styles.txnAmount, { color: colors.success }]}>
                      {formatZMW(w.amount)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(w.status, colors) + "22" }]}>
                      <Text style={[styles.statusText, { color: statusColor(w.status, colors) }]}>
                        {w.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.txnDivider, { backgroundColor: colors.border }]} />
                <View style={styles.txnBottom}>
                  <Text style={[styles.txnDetail, { color: colors.muted }]}>
                    Method: {w.method.toUpperCase()} · Account: {w.accountNumber}
                  </Text>
                </View>
              </View>
            ))
          )}

          <View style={styles.bottomPad} />
        </>
      </ScrollView>

      {/* Withdrawal Modal */}
      <Modal
        visible={showWithdrawModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Request Withdrawal</Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              Submit a withdrawal request for admin approval
            </Text>

            {/* Amount */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Amount (ZMW)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Enter amount"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              returnKeyType="done"
            />

            {/* Method */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Withdrawal Method</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.methodScroll}>
              <View style={styles.methodRow}>
                {WITHDRAWAL_METHODS.map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    style={[
                      styles.methodBtn,
                      { borderColor: colors.border },
                      withdrawMethod === m.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setWithdrawMethod(m.value)}
                  >
                    <Text style={[
                      styles.methodBtnText,
                      { color: withdrawMethod === m.value ? "#fff" : colors.foreground },
                    ]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Account Number */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Account Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder={selectedMethod?.hint ?? "Enter account number"}
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              value={accountNumber}
              onChangeText={setAccountNumber}
              returnKeyType="done"
            />

            {/* Account Name (optional) */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Account Name (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Full name on account"
              placeholderTextColor={colors.muted}
              value={accountName}
              onChangeText={setAccountName}
              returnKeyType="done"
            />

            <View style={[styles.commissionNote, { backgroundColor: colors.surface }]}>
              <Text style={[styles.commissionNoteText, { color: colors.muted }]}>
                Withdrawal requests are reviewed by an admin before processing. Approved payouts are sent via your selected method.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowWithdrawModal(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }, submitting && { opacity: 0.6 }]}
                onPress={handleWithdrawSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Request</Text>
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
  backText: { fontSize: _rs.fs(15), fontWeight: "600" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: _rs.fs(18), fontWeight: "700", color: "#fff" },
  headerSpacer: { width: _rs.s(48) },

  cardsRow: { paddingHorizontal: _rs.sp(16), paddingTop: _rs.sp(16) },
  balanceCard: { borderRadius: _rs.s(16), padding: _rs.sp(20), marginBottom: _rs.sp(4) },
  balanceCardMain: {},
  balanceLabelLight: { fontSize: _rs.fs(13), color: "rgba(255,255,255,0.8)", marginBottom: _rs.sp(4) },
  balanceAmountLarge: { fontSize: _rs.fs(32), fontWeight: "800", color: "#fff", marginBottom: _rs.sp(16) },
  withdrawBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: _rs.s(10),
    paddingVertical: _rs.sp(10),
    alignItems: "center",
  },
  withdrawBtnText: { color: "#fff", fontWeight: "700", fontSize: _rs.fs(15) },

  statsRow: { flexDirection: "row", paddingHorizontal: _rs.sp(16), paddingTop: _rs.sp(12), gap: _rs.sp(8) },
  statCard: { flex: 1, borderRadius: _rs.s(12), padding: _rs.sp(12), borderWidth: 1 },
  statLabel: { fontSize: _rs.fs(11), marginBottom: _rs.sp(4) },
  statValue: { fontSize: _rs.fs(13), fontWeight: "700" },

  commissionBanner: { marginHorizontal: _rs.sp(16), marginTop: _rs.sp(12), borderRadius: _rs.s(10), padding: _rs.sp(12), borderWidth: 1 },
  commissionText: { fontSize: _rs.fs(12), lineHeight: _rs.fs(18) },

  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: _rs.sp(16), paddingTop: _rs.sp(20), paddingBottom: _rs.sp(8) },
  sectionTitle: { fontSize: _rs.fs(16), fontWeight: "700" },
  txnCount: { fontSize: _rs.fs(12) },

  tabsScroll: { paddingLeft: _rs.sp(16), marginBottom: _rs.sp(8) },
  tabsRow: { flexDirection: "row", gap: _rs.sp(8), paddingRight: _rs.sp(16) },
  tab: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(6), borderRadius: _rs.s(20), borderWidth: 1 },
  tabText: { fontSize: _rs.fs(13), fontWeight: "600" },

  emptyContainer: { alignItems: "center", paddingVertical: _rs.sp(32) },
  emptyText: { fontSize: _rs.fs(14) },

  txnCard: { marginHorizontal: _rs.sp(16), marginBottom: _rs.sp(8), borderRadius: _rs.s(12), borderWidth: 1, padding: _rs.sp(14) },
  txnTop: { flexDirection: "row", justifyContent: "space-between" },
  txnLeft: { flex: 1 },
  txnRight: { alignItems: "flex-end" },
  txnService: { fontSize: _rs.fs(14), fontWeight: "600", marginBottom: _rs.sp(2) },
  txnDate: { fontSize: _rs.fs(12), marginBottom: _rs.sp(2) },
  txnRef: { fontSize: _rs.fs(11) },
  txnAmount: { fontSize: _rs.fs(16), fontWeight: "700", marginBottom: _rs.sp(4) },
  statusBadge: { paddingHorizontal: _rs.sp(8), paddingVertical: _rs.sp(2), borderRadius: _rs.s(6) },
  statusText: { fontSize: _rs.fs(10), fontWeight: "700" },
  txnDivider: { height: 1, marginVertical: _rs.sp(10) },
  txnBottom: { flexDirection: "row", justifyContent: "space-between" },
  txnDetail: { fontSize: _rs.fs(11) },

  bottomPad: { height: _rs.s(32) },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: _rs.s(24), borderTopRightRadius: _rs.s(24), padding: _rs.sp(24), paddingBottom: _rs.sp(40) },
  modalHandle: { width: _rs.s(40), height: _rs.s(4), backgroundColor: "#ccc", borderRadius: _rs.s(2), alignSelf: "center", marginBottom: _rs.sp(16) },
  modalTitle: { fontSize: _rs.fs(20), fontWeight: "800", marginBottom: _rs.sp(4) },
  modalSubtitle: { fontSize: _rs.fs(13), marginBottom: _rs.sp(20) },
  fieldLabel: { fontSize: _rs.fs(13), fontWeight: "600", marginBottom: _rs.sp(6), marginTop: _rs.sp(12) },
  input: { borderWidth: 1, borderRadius: _rs.s(10), paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(12), fontSize: _rs.fs(15) },
  methodScroll: { marginBottom: _rs.sp(4) },
  methodRow: { flexDirection: "row", gap: _rs.sp(8), paddingBottom: _rs.sp(4) },
  methodBtn: { paddingHorizontal: _rs.sp(14), paddingVertical: _rs.sp(8), borderRadius: _rs.s(20), borderWidth: 1 },
  methodBtnText: { fontSize: _rs.fs(13), fontWeight: "600" },
  commissionNote: { borderRadius: _rs.s(10), padding: _rs.sp(12), marginTop: _rs.sp(16) },
  commissionNoteText: { fontSize: _rs.fs(12), lineHeight: _rs.fs(18) },
  modalActions: { flexDirection: "row", gap: _rs.sp(12), marginTop: _rs.sp(20) },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: _rs.s(12), paddingVertical: _rs.sp(14), alignItems: "center" },
  cancelBtnText: { fontSize: _rs.fs(15), fontWeight: "600" },
  submitBtn: { flex: 2, borderRadius: _rs.s(12), paddingVertical: _rs.sp(14), alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: _rs.fs(15), fontWeight: "700" },
});
