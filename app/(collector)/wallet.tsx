import { useFocusEffect } from 'expo-router';
/**
 * Zone Manager Dashboard — Earnings & Withdrawals (Section 5)
 *
 * Shows: Gross Revenue, Commission Already Deducted, Net Earnings,
 *        Available Balance, Transaction History, Withdrawal Request
 *
 * IMPORTANT: Commission is deducted at payment stage, NOT at withdrawal.
 * Withdrawal only transfers available net balance.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { supabase } from "@/lib/supabase";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface EarningsData {
  grossRevenue: number;
  commissionDeducted: number;
  netEarnings: number;
  availableBalance: number;
  commissionRate: number;
}

interface Transaction {
  id: string;
  type: "credit" | "debit" | "withdrawal";
  amount: number;
  description: string;
  createdAt: string;
  status: string;
}

const ZONE_GREEN = "#1B5E20";

function formatKwacha(amount: number): string {
  return `K${amount.toLocaleString("en-ZM", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  ).toISOString();
  return { start, end };
}

export default function EarningsWithdrawalsScreen() {
  const colors = useColors();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [earnings, setEarnings] = useState<EarningsData>({
    grossRevenue: 0,
    commissionDeducted: 0,
    netEarnings: 0,
    availableBalance: 0,
    commissionRate: 10,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [provider, setProvider] = useState<"MTN" | "Airtel" | "Zamtel">("MTN");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Resolve zone
      let resolvedZoneId = zoneId;
      if (!resolvedZoneId) {
        const { data: zoneRow } = await supabase
          .from("zone_collectors")
          .select("zoneId")
          .eq("collectorId", user.id)
          .maybeSingle();
        if (!zoneRow?.zoneId) {
          setLoading(false);
          return;
        }
        resolvedZoneId = zoneRow.zoneId;
        setZoneId(resolvedZoneId);
      }

      // Commission rate
      const { data: settings } = await supabase
        .from("financial_settings")
        .select("commission_rate")
        .maybeSingle();
      const commissionRate = parseFloat(settings?.commission_rate ?? "10");

      // This month's payments
      const { start, end } = getMonthRange();
      const { data: payments } = await supabase
        .from("payments")
        .select("amount")
        .eq("zoneId", resolvedZoneId)
        .eq("status", "completed")
        .gte("createdAt", start)
        .lte("createdAt", end);

      const grossRevenue = (payments ?? []).reduce(
        (sum: number, p: any) => sum + parseFloat(p.amount ?? "0"),
        0
      );
      const commissionDeducted = grossRevenue * (commissionRate / 100);
      const netEarnings = grossRevenue - commissionDeducted;

      // Available balance from user_wallets
      const { data: wallet } = await supabase
        .from("user_wallets")
        .select("available_balance")
        .eq("user_id", user.id)
        .maybeSingle();
      const availableBalance = parseFloat(
        wallet?.available_balance ?? "0"
      );

      setEarnings({
        grossRevenue,
        commissionDeducted,
        netEarnings,
        availableBalance,
        commissionRate,
      });

      // Transaction history from wallet_ledger
      const { data: ledger } = await supabase
        .from("wallet_ledger")
        .select("id, transaction_type, amount, description, created_at, status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      setTransactions(
        (ledger ?? []).map((t: any) => ({
          id: t.id.toString(),
          type: t.transaction_type as "credit" | "debit" | "withdrawal",
          amount: parseFloat(t.amount ?? "0"),
          description: t.description ?? "Transaction",
          createdAt: t.created_at ?? "",
          status: t.status ?? "completed",
        }))
      );
    } catch (err) {
      console.error("[EarningsWithdrawals] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, zoneId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const submitWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid withdrawal amount.");
      return;
    }
    if (amount > earnings.availableBalance) {
      Alert.alert(
        "Insufficient Balance",
        `Available balance is ${formatKwacha(earnings.availableBalance)}.`
      );
      return;
    }
    if (!mobileNumber.trim()) {
      Alert.alert("Missing Number", "Please enter your mobile money number.");
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from("withdrawals").insert({
        user_id: user?.id,
        amount: amount.toFixed(2),
        mobile_number: mobileNumber.trim(),
        provider,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      setWithdrawModalVisible(false);
      setWithdrawAmount("");
      setMobileNumber("");
      Alert.alert(
        "Withdrawal Requested",
        `Your withdrawal of ${formatKwacha(amount)} via ${provider} has been submitted and will be processed shortly.`
      );
      await fetchData();
    } catch {
      Alert.alert("Error", "Failed to submit withdrawal request.");
    } finally {
      setSubmitting(false);
    }
  };

  const txIcon = (type: string) => {
    if (type === "credit") return "add-circle";
    if (type === "withdrawal") return "account-balance-wallet";
    return "remove-circle";
  };

  const txColor = (type: string) => {
    if (type === "credit") return "#10B981";
    if (type === "withdrawal") return "#3B82F6";
    return "#EF4444";
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View
      style={[
        styles.txCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.txIcon,
          { backgroundColor: `${txColor(item.type)}18` },
        ]}
      >
        <MaterialIcons
          name={txIcon(item.type) as any}
          size={22}
          color={txColor(item.type)}
        />
      </View>
      <View style={styles.txInfo}>
        <Text style={[styles.txDesc, { color: colors.foreground }]}>
          {item.description}
        </Text>
        <Text style={[styles.txDate, { color: colors.muted }]}>
          {item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : "—"}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text
          style={[
            styles.txAmount,
            { color: txColor(item.type) },
          ]}
        >
          {item.type === "credit" ? "+" : "-"}
          {formatKwacha(item.amount)}
        </Text>
        <Text style={[styles.txStatus, { color: colors.muted }]}>
          {item.status}
        </Text>
      </View>
    </View>
  );
  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );


  return (
    <ScreenContainer containerClassName="bg-background">
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ZONE_GREEN}
          />
        }
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: ZONE_GREEN }]}>
              <Text style={styles.headerTitle}>Earnings & Withdrawals</Text>
              <Text style={styles.headerSub}>
                Commission auto-deducted at payment time
              </Text>
            </View>

            {loading ? (
              <ActivityIndicator
                color={ZONE_GREEN}
                style={{ marginTop: 40 }}
                size="large"
              />
            ) : (
              <>
                {/* Balance Card */}
                <View style={styles.balanceSection}>
                  <View
                    style={[
                      styles.balanceCard,
                      { backgroundColor: ZONE_GREEN },
                    ]}
                  >
                    <Text style={styles.balanceLabel}>Available Balance</Text>
                    <Text style={styles.balanceAmount}>
                      {formatKwacha(earnings.availableBalance)}
                    </Text>
                    <Text style={styles.balanceNote}>
                      Commission already deducted
                    </Text>
                    <TouchableOpacity
                      style={styles.withdrawBtn}
                      onPress={() => setWithdrawModalVisible(true)}
                    >
                      <MaterialIcons
                        name="account-balance-wallet"
                        size={18}
                        color={ZONE_GREEN}
                      />
                      <Text style={[styles.withdrawBtnText, { color: ZONE_GREEN }]}>
                        Withdraw Funds
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Revenue Breakdown */}
                <View style={styles.section}>
                  <Text
                    style={[styles.sectionTitle, { color: colors.foreground }]}
                  >
                    This Month's Breakdown
                  </Text>
                  <View
                    style={[
                      styles.breakdownCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.breakdownRow}>
                      <Text
                        style={[
                          styles.breakdownLabel,
                          { color: colors.muted },
                        ]}
                      >
                        Zone Gross Revenue
                      </Text>
                      <Text
                        style={[
                          styles.breakdownValue,
                          { color: colors.foreground },
                        ]}
                      >
                        {formatKwacha(earnings.grossRevenue)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <View style={styles.breakdownRow}>
                      <View style={styles.breakdownLabelRow}>
                        <MaterialIcons
                          name="remove-circle"
                          size={15}
                          color="#EF4444"
                        />
                        <Text
                          style={[
                            styles.breakdownLabel,
                            { color: "#EF4444", marginLeft: 5 },
                          ]}
                        >
                          Platform Commission ({earnings.commissionRate}%)
                        </Text>
                      </View>
                      <Text
                        style={[styles.breakdownValue, { color: "#EF4444" }]}
                      >
                        -{formatKwacha(earnings.commissionDeducted)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.divider,
                        { backgroundColor: colors.border },
                      ]}
                    />
                    <View style={styles.breakdownRow}>
                      <View style={styles.breakdownLabelRow}>
                        <MaterialIcons
                          name="check-circle"
                          size={15}
                          color="#10B981"
                        />
                        <Text
                          style={[
                            styles.breakdownLabel,
                            {
                              color: "#10B981",
                              marginLeft: 5,
                              fontWeight: "700",
                            },
                          ]}
                        >
                          Net Earnings
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.breakdownValue,
                          {
                            color: "#10B981",
                            fontWeight: "700",
                            fontSize: 17,
                          },
                        ]}
                      >
                        {formatKwacha(earnings.netEarnings)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.noteBox,
                        {
                          backgroundColor: "#FEF3C7",
                          borderColor: "#FCD34D",
                        },
                      ]}
                    >
                      <MaterialIcons name="info" size={14} color="#92400E" />
                      <Text style={[styles.noteText, { color: "#92400E" }]}>
                        Commission is auto-deducted when customers pay their
                        subscriptions. Your withdrawal only transfers net
                        balance.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Transaction History Header */}
                <View style={styles.section}>
                  <Text
                    style={[styles.sectionTitle, { color: colors.foreground }]}
                  >
                    Transaction History
                  </Text>
                </View>
              </>
            )}
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="receipt-long"
                size={48}
                color={colors.muted}
              />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No transactions yet
              </Text>
            </View>
          ) : null
        }
      />

      {/* Withdrawal Modal */}
      <Modal
        visible={withdrawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[styles.modalTitle, { color: colors.foreground }]}
              >
                Withdraw Funds
              </Text>
              <TouchableOpacity
                onPress={() => setWithdrawModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalBalance, { color: colors.muted }]}>
              Available:{" "}
              <Text style={{ color: "#10B981", fontWeight: "700" }}>
                {formatKwacha(earnings.availableBalance)}
              </Text>
            </Text>

            {/* Provider Selection */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Mobile Money Provider
            </Text>
            <View style={styles.providerRow}>
              {(["MTN", "Airtel", "Zamtel"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.providerBtn,
                    {
                      backgroundColor:
                        provider === p ? ZONE_GREEN : colors.surface,
                      borderColor:
                        provider === p ? ZONE_GREEN : colors.border,
                    },
                  ]}
                  onPress={() => setProvider(p)}
                >
                  <Text
                    style={[
                      styles.providerText,
                      { color: provider === p ? "#fff" : colors.foreground },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mobile Number */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Mobile Number
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              placeholder="e.g. 0971234567"
              placeholderTextColor={colors.muted}
              value={mobileNumber}
              onChangeText={setMobileNumber}
              keyboardType="phone-pad"
              returnKeyType="next"
            />

            {/* Amount */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Amount (ZMW)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: ZONE_GREEN }]}
              onPress={submitWithdrawal}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Withdrawal</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: _rs.sp(20),
    paddingTop: _rs.sp(20),
    paddingBottom: _rs.sp(20),
  },
  headerTitle: { fontSize: _rs.fs(20), fontWeight: "700", color: "#fff" },
  headerSub: {
    fontSize: _rs.fs(13),
    color: "rgba(255,255,255,0.8)",
    marginTop: _rs.sp(4),
  },
  balanceSection: { padding: _rs.sp(16) },
  balanceCard: {
    borderRadius: _rs.s(20),
    padding: _rs.sp(24),
    alignItems: "center",
    gap: _rs.sp(8),
  },
  balanceLabel: { fontSize: _rs.fs(14), color: "rgba(255,255,255,0.8)" },
  balanceAmount: { fontSize: _rs.fs(36), fontWeight: "700", color: "#fff" },
  balanceNote: { fontSize: _rs.fs(12), color: "rgba(255,255,255,0.7)" },
  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: _rs.sp(24),
    paddingVertical: _rs.sp(12),
    borderRadius: _rs.s(24),
    gap: _rs.sp(8),
    marginTop: _rs.sp(8),
  },
  withdrawBtnText: { fontSize: _rs.fs(15), fontWeight: "700" },
  section: { paddingHorizontal: _rs.sp(16), paddingTop: _rs.sp(8), paddingBottom: _rs.sp(8) },
  sectionTitle: { fontSize: _rs.fs(17), fontWeight: "700", marginBottom: _rs.sp(12) },
  breakdownCard: {
    borderRadius: _rs.s(16),
    borderWidth: 1,
    padding: _rs.sp(18),
    gap: _rs.sp(14),
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  breakdownLabelRow: { flexDirection: "row", alignItems: "center" },
  breakdownLabel: { fontSize: _rs.fs(14) },
  breakdownValue: { fontSize: _rs.fs(15), fontWeight: "600" },
  divider: { height: 1 },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: _rs.s(8),
    borderWidth: 1,
    padding: _rs.sp(10),
    gap: _rs.sp(8),
    marginTop: _rs.sp(4),
  },
  noteText: { fontSize: _rs.fs(12), flex: 1, lineHeight: _rs.fs(18) },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(10),
    padding: _rs.sp(14),
    borderRadius: _rs.s(14),
    borderWidth: 1,
    gap: _rs.sp(12),
  },
  txIcon: {
    width: _rs.s(44),
    height: _rs.s(44),
    borderRadius: _rs.s(22),
    justifyContent: "center",
    alignItems: "center",
  },
  txInfo: { flex: 1 },
  txDesc: { fontSize: _rs.fs(14), fontWeight: "600", marginBottom: _rs.sp(3) },
  txDate: { fontSize: _rs.fs(12) },
  txRight: { alignItems: "flex-end" },
  txAmount: { fontSize: _rs.fs(15), fontWeight: "700" },
  txStatus: { fontSize: _rs.fs(11), marginTop: _rs.sp(2), textTransform: "capitalize" },
  emptyState: { alignItems: "center", paddingTop: _rs.sp(40), gap: _rs.sp(12) },
  emptyText: { fontSize: _rs.fs(16) },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: _rs.s(24),
    borderTopRightRadius: _rs.s(24),
    padding: _rs.sp(24),
    gap: _rs.sp(12),
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: _rs.sp(4),
  },
  modalTitle: { fontSize: _rs.fs(18), fontWeight: "700" },
  modalBalance: { fontSize: _rs.fs(14), marginBottom: _rs.sp(4) },
  fieldLabel: { fontSize: _rs.fs(14), fontWeight: "600" },
  providerRow: { flexDirection: "row", gap: _rs.sp(10) },
  providerBtn: {
    flex: 1,
    paddingVertical: _rs.sp(10),
    borderRadius: _rs.s(10),
    borderWidth: 1.5,
    alignItems: "center",
  },
  providerText: { fontSize: _rs.fs(14), fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: _rs.s(12),
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(12),
    fontSize: _rs.fs(16),
  },
  submitBtn: {
    paddingVertical: _rs.sp(16),
    borderRadius: _rs.s(14),
    alignItems: "center",
    marginTop: _rs.sp(8),
  },
  submitBtnText: { color: "#fff", fontSize: _rs.fs(16), fontWeight: "700" },
});
