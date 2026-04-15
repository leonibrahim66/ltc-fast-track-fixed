import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Text,
  View,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { getStaticResponsive } from "@/hooks/use-responsive";
const COMMISSION_RATE = 0.10; // 10% company commission

interface Transaction {
  id: string;
  bookingId: string;
  customerName: string;
  type: "earning" | "withdrawal" | "commission";
  grossAmount: number;
  commission: number;
  netAmount: number;
  status: "completed" | "pending" | "processing" | "failed";
  method?: "mobile_money" | "bank_transfer";
  accountDetails?: string;
  createdAt: string;
  description: string;
}

interface WalletData {
  balance: number;
  totalEarnings: number;
  totalCommission: number;
  pendingEarnings: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  transactions: Transaction[];
}

interface WithdrawalForm {
  amount: string;
  method: "mobile_money" | "bank_transfer";
  accountName: string;
  accountNumber: string;
  bankName: string;
  mobileProvider: string;
}

export default function DriverWalletScreen() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletData>({
    balance: 0,
    totalEarnings: 0,
    totalCommission: 0,
    pendingEarnings: 0,
    totalWithdrawn: 0,
    pendingWithdrawals: 0,
    transactions: [],
  });
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "earnings" | "withdrawals">("all");
  const [form, setForm] = useState<WithdrawalForm>({
    amount: "",
    method: "mobile_money",
    accountName: "",
    accountNumber: "",
    bankName: "",
    mobileProvider: "MTN",
  });

  const loadWallet = useCallback(async () => {
    try {
      // Load completed jobs to calculate earnings
      const activeJobsStr = await AsyncStorage.getItem("carrier_active_jobs");
      const activeJobs = activeJobsStr ? JSON.parse(activeJobsStr) : [];
      const completedJobs = activeJobs.filter((j: any) => j.status === "delivered");
      const pendingJobs = activeJobs.filter((j: any) => j.status !== "delivered" && j.status !== "rejected");

      // Load existing transactions
      const txStr = await AsyncStorage.getItem("carrier_wallet_transactions");
      let transactions: Transaction[] = txStr ? JSON.parse(txStr) : [];

      // Auto-generate earning transactions for completed jobs that don't have one
      const existingEarningIds = new Set(transactions.filter(t => t.type === "earning").map(t => t.bookingId));
      let newTransactions = false;

      for (const job of completedJobs) {
        if (!existingEarningIds.has(job.id)) {
          const gross = job.estimatedPrice || 0;
          const commission = Math.round(gross * COMMISSION_RATE * 100) / 100;
          const net = Math.round((gross - commission) * 100) / 100;

          transactions.unshift({
            id: `tx_earn_${job.id}`,
            bookingId: job.id,
            customerName: job.customerName || "Customer",
            type: "earning",
            grossAmount: gross,
            commission: commission,
            netAmount: net,
            status: "completed",
            createdAt: job.deliveredAt || new Date().toISOString(),
            description: `Delivery: ${job.pickupLocation} → ${job.dropoffLocation}`,
          });

          // Also record commission transaction for company
          transactions.unshift({
            id: `tx_comm_${job.id}`,
            bookingId: job.id,
            customerName: job.customerName || "Customer",
            type: "commission",
            grossAmount: gross,
            commission: commission,
            netAmount: commission,
            status: "completed",
            createdAt: job.deliveredAt || new Date().toISOString(),
            description: `10% commission on booking #${job.id.slice(-6).toUpperCase()}`,
          });

          newTransactions = true;
        }
      }

      if (newTransactions) {
        await AsyncStorage.setItem("carrier_wallet_transactions", JSON.stringify(transactions));
      }

      // Also save commission data for admin dashboard
      const commissionTransactions = transactions.filter(t => t.type === "commission");
      await AsyncStorage.setItem("carrier_commission_data", JSON.stringify(commissionTransactions));

      // Calculate totals
      const earningTx = transactions.filter(t => t.type === "earning" && t.status === "completed");
      const withdrawalTx = transactions.filter(t => t.type === "withdrawal");
      const completedWithdrawals = withdrawalTx.filter(t => t.status === "completed");
      const pendingWithdrawals = withdrawalTx.filter(t => t.status === "pending" || t.status === "processing");

      const totalNet = earningTx.reduce((sum, t) => sum + t.netAmount, 0);
      const totalCommission = earningTx.reduce((sum, t) => sum + t.commission, 0);
      const totalWithdrawn = completedWithdrawals.reduce((sum, t) => sum + Math.abs(t.netAmount), 0);
      const pendingWithdrawalAmt = pendingWithdrawals.reduce((sum, t) => sum + Math.abs(t.netAmount), 0);
      const pendingEarnings = pendingJobs.reduce((sum: number, j: any) => sum + (j.estimatedPrice || 0) * (1 - COMMISSION_RATE), 0);

      setWallet({
        balance: Math.round((totalNet - totalWithdrawn - pendingWithdrawalAmt) * 100) / 100,
        totalEarnings: Math.round(totalNet * 100) / 100,
        totalCommission: Math.round(totalCommission * 100) / 100,
        pendingEarnings: Math.round(pendingEarnings * 100) / 100,
        totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        pendingWithdrawals: Math.round(pendingWithdrawalAmt * 100) / 100,
        transactions: transactions.filter(t => t.type !== "commission"), // Don't show commission in driver view
      });
    } catch (e) {
      console.error("Error loading wallet:", e);
    }
  }, []);

  useEffect(() => {
    loadWallet();
    const interval = setInterval(loadWallet, 5000);
    return () => clearInterval(interval);
  }, [loadWallet]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWallet();
    setRefreshing(false);
  }, [loadWallet]);

  const handleWithdraw = async () => {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount.");
      return;
    }
    if (amount > wallet.balance) {
      Alert.alert("Error", "Insufficient balance.");
      return;
    }
    if (amount < 10) {
      Alert.alert("Error", "Minimum withdrawal is K10.00");
      return;
    }
    if (!form.accountName.trim()) {
      Alert.alert("Error", "Please enter account holder name.");
      return;
    }
    if (!form.accountNumber.trim()) {
      Alert.alert("Error", "Please enter account/phone number.");
      return;
    }
    if (form.method === "bank_transfer" && !form.bankName.trim()) {
      Alert.alert("Error", "Please enter bank name.");
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const accountDetails = form.method === "mobile_money"
      ? `${form.mobileProvider} - ${form.accountNumber}`
      : `${form.bankName} - ${form.accountNumber}`;

    Alert.alert(
      "Confirm Withdrawal",
      `Withdraw K${amount.toFixed(2)} via ${form.method === "mobile_money" ? "Mobile Money" : "Bank Transfer"} to ${accountDetails}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              const txStr = await AsyncStorage.getItem("carrier_wallet_transactions");
              const transactions: Transaction[] = txStr ? JSON.parse(txStr) : [];

              const withdrawal: Transaction = {
                id: `tx_wd_${Date.now()}`,
                bookingId: "",
                customerName: "",
                type: "withdrawal",
                grossAmount: amount,
                commission: 0,
                netAmount: -amount,
                status: "pending",
                method: form.method,
                accountDetails,
                createdAt: new Date().toISOString(),
                description: `Withdrawal to ${accountDetails}`,
              };

              transactions.unshift(withdrawal);
              await AsyncStorage.setItem("carrier_wallet_transactions", JSON.stringify(transactions));

              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              setShowWithdrawModal(false);
              setForm({
                amount: "",
                method: "mobile_money",
                accountName: "",
                accountNumber: "",
                bankName: "",
                mobileProvider: "MTN",
              });

              Alert.alert(
                "Withdrawal Submitted",
                `K${amount.toFixed(2)} withdrawal request submitted. Processing typically takes 1-3 business days.`
              );

              await loadWallet();
            } catch (e) {
              Alert.alert("Error", "Failed to process withdrawal.");
            }
          },
        },
      ]
    );
  };

  const filteredTransactions = wallet.transactions.filter(t => {
    if (activeTab === "earnings") return t.type === "earning";
    if (activeTab === "withdrawals") return t.type === "withdrawal";
    return true;
  });

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isEarning = item.type === "earning";
    const isWithdrawal = item.type === "withdrawal";

    return (
      <View style={styles.txCard}>
        <View className="flex-row items-center">
          <View
            style={[
              styles.txIcon,
              {
                backgroundColor: isEarning
                  ? "rgba(34,197,94,0.15)"
                  : isWithdrawal
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(245,158,11,0.15)",
              },
            ]}
          >
            <MaterialIcons
              name={isEarning ? "arrow-downward" : isWithdrawal ? "arrow-upward" : "percent"}
              size={18}
              color={isEarning ? "#22C55E" : isWithdrawal ? "#EF4444" : "#F59E0B"}
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {isEarning ? "Job Earning" : isWithdrawal ? "Withdrawal" : "Commission"}
            </Text>
            <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
              {item.description}
            </Text>
            <Text className="text-xs text-muted mt-0.5">{getTimeAgo(item.createdAt)}</Text>
          </View>
          <View className="items-end">
            {isEarning ? (
              <>
                <Text style={{ color: "#22C55E", fontWeight: "700", fontSize: 14 }}>
                  +K{item.netAmount.toFixed(2)}
                </Text>
                <Text className="text-xs text-muted mt-0.5">
                  Gross: K{item.grossAmount.toFixed(2)}
                </Text>
                <Text style={{ color: "#F59E0B", fontSize: 10 }}>
                  -K{item.commission.toFixed(2)} (10%)
                </Text>
              </>
            ) : (
              <>
                <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 14 }}>
                  -K{Math.abs(item.netAmount).toFixed(2)}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === "completed"
                          ? "rgba(34,197,94,0.15)"
                          : item.status === "failed"
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(245,158,11,0.15)",
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color:
                        item.status === "completed"
                          ? "#22C55E"
                          : item.status === "failed"
                          ? "#EF4444"
                          : "#F59E0B",
                    }}
                  >
                    {item.status.toUpperCase()}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  const MOBILE_PROVIDERS = ["MTN", "Airtel", "Zamtel"];

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground">Driver Wallet</Text>
        </View>
      </View>

      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            {/* Balance Card */}
            <View className="px-6 mb-4">
              <View style={styles.balanceCard}>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>
                  AVAILABLE BALANCE
                </Text>
                <Text style={{ color: "#fff", fontSize: 36, fontWeight: "800", marginTop: 4 }}>
                  K{wallet.balance.toFixed(2)}
                </Text>
                <View className="flex-row mt-4 gap-4">
                  <View className="flex-1">
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>Total Earned</Text>
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                      K{wallet.totalEarnings.toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>Commission (10%)</Text>
                    <Text style={{ color: "#FBBF24", fontSize: 14, fontWeight: "700" }}>
                      K{wallet.totalCommission.toFixed(2)}
                    </Text>
                  </View>
                </View>
                <View className="flex-row mt-2 gap-4">
                  <View className="flex-1">
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>Withdrawn</Text>
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
                      K{wallet.totalWithdrawn.toFixed(2)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>Pending</Text>
                    <Text style={{ color: "#F59E0B", fontSize: 14, fontWeight: "700" }}>
                      K{(wallet.pendingEarnings + wallet.pendingWithdrawals).toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Withdraw Button */}
                <TouchableOpacity
                  onPress={() => setShowWithdrawModal(true)}
                  activeOpacity={0.8}
                  style={styles.withdrawBtn}
                >
                  <MaterialIcons name="account-balance-wallet" size={18} color="#166534" />
                  <Text style={{ color: "#166534", fontWeight: "700", fontSize: 14, marginLeft: 6 }}>
                    Withdraw Funds
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Commission Info */}
            <View className="px-6 mb-4">
              <View style={styles.infoCard}>
                <MaterialIcons name="info" size={16} color="#F59E0B" />
                <Text style={{ color: "#D1FAE5", fontSize: 11, marginLeft: 8, flex: 1 }}>
                  A 10% commission is automatically deducted from each completed job. 90% goes to your wallet, 10% goes to the company account.
                </Text>
              </View>
            </View>

            {/* Tabs */}
            <View className="px-6 mb-3 flex-row gap-2">
              {(["all", "earnings", "withdrawals"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tab,
                    activeTab === tab && styles.tabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === tab && styles.tabTextActive,
                    ]}
                  >
                    {tab === "all" ? "All" : tab === "earnings" ? "Earnings" : "Withdrawals"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="px-6 mb-2">
              <Text className="text-xs text-muted">TRANSACTION HISTORY</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <MaterialIcons name="receipt-long" size={48} color="#4B5563" />
            <Text className="text-muted mt-3 text-sm">No transactions yet</Text>
            <Text className="text-muted text-xs mt-1">Complete jobs to start earning</Text>
          </View>
        }
      />

      {/* Withdrawal Modal */}
      <Modal visible={showWithdrawModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Withdraw Funds</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: "#9BA1A6", fontSize: 12, marginBottom: 4 }}>
              Available: K{wallet.balance.toFixed(2)}
            </Text>

            {/* Amount */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (K)</Text>
              <TextInput
                style={styles.input}
                value={form.amount}
                onChangeText={(t) => setForm({ ...form, amount: t })}
                placeholder="Enter amount"
                placeholderTextColor="#666"
                keyboardType="decimal-pad"
              />
            </View>

            {/* Method */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Withdrawal Method</Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setForm({ ...form, method: "mobile_money" })}
                  style={[
                    styles.methodBtn,
                    form.method === "mobile_money" && styles.methodBtnActive,
                  ]}
                >
                  <MaterialIcons
                    name="phone-android"
                    size={16}
                    color={form.method === "mobile_money" ? "#22C55E" : "#666"}
                  />
                  <Text
                    style={[
                      styles.methodText,
                      form.method === "mobile_money" && styles.methodTextActive,
                    ]}
                  >
                    Mobile Money
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setForm({ ...form, method: "bank_transfer" })}
                  style={[
                    styles.methodBtn,
                    form.method === "bank_transfer" && styles.methodBtnActive,
                  ]}
                >
                  <MaterialIcons
                    name="account-balance"
                    size={16}
                    color={form.method === "bank_transfer" ? "#22C55E" : "#666"}
                  />
                  <Text
                    style={[
                      styles.methodText,
                      form.method === "bank_transfer" && styles.methodTextActive,
                    ]}
                  >
                    Bank Transfer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Mobile Money Provider */}
            {form.method === "mobile_money" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Mobile Provider</Text>
                <View className="flex-row gap-2">
                  {MOBILE_PROVIDERS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setForm({ ...form, mobileProvider: p })}
                      style={[
                        styles.providerBtn,
                        form.mobileProvider === p && styles.providerBtnActive,
                      ]}
                    >
                      <Text
                        style={{
                          color: form.mobileProvider === p ? "#22C55E" : "#9BA1A6",
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Bank Name */}
            {form.method === "bank_transfer" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bank Name</Text>
                <TextInput
                  style={styles.input}
                  value={form.bankName}
                  onChangeText={(t) => setForm({ ...form, bankName: t })}
                  placeholder="e.g. Zanaco, Stanbic, FNB"
                  placeholderTextColor="#666"
                />
              </View>
            )}

            {/* Account Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Account Holder Name</Text>
              <TextInput
                style={styles.input}
                value={form.accountName}
                onChangeText={(t) => setForm({ ...form, accountName: t })}
                placeholder="Full name on account"
                placeholderTextColor="#666"
              />
            </View>

            {/* Account Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {form.method === "mobile_money" ? "Phone Number" : "Account Number"}
              </Text>
              <TextInput
                style={styles.input}
                value={form.accountNumber}
                onChangeText={(t) => setForm({ ...form, accountNumber: t })}
                placeholder={form.method === "mobile_money" ? "e.g. 0960123456" : "e.g. 1234567890"}
                placeholderTextColor="#666"
                keyboardType="number-pad"
              />
            </View>

            {/* Submit */}
            <TouchableOpacity onPress={handleWithdraw} activeOpacity={0.8} style={styles.submitBtn}>
              <MaterialIcons name="send" size={18} color="#166534" />
              <Text style={{ color: "#166534", fontWeight: "700", fontSize: 15, marginLeft: 6 }}>
                Submit Withdrawal
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  balanceCard: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    borderRadius: _rs.s(20),
    padding: _rs.sp(20),
  },
  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
    borderRadius: _rs.s(12),
    paddingVertical: _rs.sp(12),
    marginTop: _rs.sp(16),
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    borderRadius: _rs.s(12),
    padding: _rs.sp(12),
  },
  tab: {
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(8),
    borderRadius: _rs.s(20),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tabActive: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderColor: "#22C55E",
  },
  tabText: {
    color: "#9BA1A6",
    fontSize: _rs.fs(12),
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#22C55E",
  },
  txCard: {
    marginHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(8),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: _rs.s(14),
    padding: _rs.sp(14),
  },
  txIcon: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(12),
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    marginTop: _rs.sp(4),
    paddingHorizontal: _rs.sp(6),
    paddingVertical: _rs.sp(2),
    borderRadius: _rs.s(6),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1A2E1A",
    borderTopLeftRadius: _rs.s(24),
    borderTopRightRadius: _rs.s(24),
    padding: _rs.sp(24),
    maxHeight: "85%",
  },
  inputGroup: {
    marginBottom: _rs.sp(14),
  },
  inputLabel: {
    color: "#D1FAE5",
    fontSize: _rs.fs(12),
    fontWeight: "600",
    marginBottom: _rs.sp(6),
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: _rs.s(12),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(12),
    color: "#fff",
    fontSize: _rs.fs(14),
  },
  methodBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: _rs.sp(10),
    borderRadius: _rs.s(10),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  methodBtnActive: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "#22C55E",
  },
  methodText: {
    color: "#9BA1A6",
    fontSize: _rs.fs(12),
    fontWeight: "600",
    marginLeft: _rs.sp(6),
  },
  methodTextActive: {
    color: "#22C55E",
  },
  providerBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: _rs.sp(8),
    borderRadius: _rs.s(8),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  providerBtnActive: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "#22C55E",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
    borderRadius: _rs.s(12),
    paddingVertical: _rs.sp(14),
    marginTop: _rs.sp(8),
  },
});
