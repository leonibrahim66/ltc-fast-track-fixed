import React, { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { apiGet } from "@/lib/api-client";
import { getOrCreateBackendUserId } from "@/lib/user-session";

type TransactionType = "recharge" | "withdrawal" | "referral" | "payment";

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  status: "completed" | "pending" | "failed";
  description: string;
}

/**
 * Wallet tab screen - main wallet interface
 */
export default function WalletTabScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { wallet, refreshWallet, isLoading: walletLoading } = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawalPin, setWithdrawalPin] = useState("");

  // Auto-refresh wallet and transactions when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (user?.phone) {
        getOrCreateBackendUserId(user.phone, {
          country: (user as any).country,
          province: user.province,
          city: user.city,
        }).then((backendUserId) => {
          refreshWallet(backendUserId);
          // Fetch real transactions from backend
          apiGet<{ data: Transaction[] }>(`/api/transactions/${backendUserId}`)
            .then((res) => {
              if (res.data && Array.isArray(res.data)) {
                setTransactions(res.data);
              }
            })
            .catch(() => {
              // Non-fatal — keep existing transactions state
            });
        }).catch(() => {});
      }
    }, [user?.phone, refreshWallet])
  );

  // Wallet data from global state
  const walletData = {
    totalBalance: wallet?.totalBalance || 0,
    rechargedBalance: wallet?.rechargedBalance || 0,
    referralBalance: wallet?.referralBalance || 0,
    hasLinkedAccount: !!wallet?.linkedAccount,
    linkedPhoneNumber: wallet?.linkedAccount?.phoneNumber || "",
    linkedProvider: wallet?.linkedAccount?.provider || "",
  };

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Fetch linked account on mount and refresh




  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.phone) {
        const backendUserId = await getOrCreateBackendUserId(user.phone);
        await refreshWallet(backendUserId);
        try {
          const res = await apiGet<{ data: Transaction[] }>(`/api/transactions/${backendUserId}`);
          if (res.data && Array.isArray(res.data)) {
            setTransactions(res.data);
          }
        } catch {
          // Non-fatal
        }
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleRecharge = () => {
    const amount = parseFloat(rechargeAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    // TODO: Integrate with payment gateway API
    Alert.alert(
      "Recharge Initiated",
      `Recharging K${amount.toFixed(2)}. You will be redirected to payment gateway.`,
      [
        {
          text: "OK",
          onPress: () => {
            setShowRechargeModal(false);
            setRechargeAmount("");
          },
        },
      ]
    );
  };

  const handleWithdraw = () => {
    if (!walletData.hasLinkedAccount) {
      Alert.alert(
        "Link Account Required",
        "Please link your mobile money account first to withdraw funds.",
        [
          {
            text: "Link Account",
            onPress: () => {
              setShowWithdrawModal(false);
              router.push("/link-account" as any);
            },
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    if (amount > walletData.totalBalance) {
      Alert.alert("Insufficient Balance", "You don't have enough balance to withdraw");
      return;
    }

    if (!withdrawalPin || withdrawalPin.length < 4) {
      Alert.alert("PIN Required", "Please enter your 4-digit withdrawal PIN");
      return;
    }

    // TODO: Verify PIN and submit withdrawal request to API
    Alert.alert(
      "Withdrawal Requested",
      `Withdrawal of K${amount.toFixed(2)} to ${walletData.linkedPhoneNumber} has been submitted. It will be processed within 24-48 hours.`,
      [
        {
          text: "OK",
          onPress: () => {
            setShowWithdrawModal(false);
            setWithdrawAmount("");
            setWithdrawalPin("");
          },
        },
      ]
    );
  };

  const getTransactionIcon = (type: TransactionType) => {
    switch (type) {
      case "recharge":
        return "add-circle";
      case "withdrawal":
        return "remove-circle";
      case "referral":
        return "card-giftcard";
      case "payment":
        return "payment";
      default:
        return "attach-money";
    }
  };

  const getTransactionColor = (type: TransactionType) => {
    switch (type) {
      case "recharge":
        return "#22C55E";
      case "withdrawal":
        return "#EF4444";
      case "referral":
        return "#8B5CF6";
      case "payment":
        return "#F59E0B";
      default:
        return "#6B7280";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#22C55E";
      case "pending":
        return "#F59E0B";
      case "failed":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <Text className="text-base text-muted">My Wallet</Text>
          <Text className="text-2xl font-bold text-foreground">
            K{walletData.totalBalance.toFixed(2)}
          </Text>
        </View>

        {/* Balance Cards */}
        <View className="px-6 mb-6">
          <View className="bg-primary rounded-2xl p-6 mb-4">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-white text-sm opacity-80">Total Balance</Text>
                <Text className="text-white text-3xl font-bold mt-1">
                  K{walletData.totalBalance.toFixed(2)}
                </Text>
              </View>
              <MaterialIcons name="account-balance-wallet" size={48} color="rgba(255,255,255,0.3)" />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push("/deposit" as any)}
                disabled={walletLoading}
                className="flex-1 bg-primary rounded-xl py-3 items-center mr-2"
              >
                <MaterialIcons name="add" size={20} color="#fff" />
                <Text className="text-white font-semibold text-sm mt-1">Add Funds</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/withdraw" as any)}
                disabled={walletLoading}
                className="flex-1 bg-success rounded-xl py-3 items-center ml-2"
              >
                <MaterialIcons name="send" size={20} color="#fff" />
                <Text className="text-white font-semibold text-sm mt-1">Withdraw</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/link-account" as any)}
              disabled={walletLoading}
              className="w-full bg-warning rounded-xl py-3 items-center mt-3"
            >
              <MaterialIcons name="link" size={20} color="#fff" />
              <Text className="text-white font-semibold text-sm mt-1">Link Account</Text>
            </TouchableOpacity>
          </View>

          {/* Balance Breakdown */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-muted text-xs mb-1">Recharged</Text>
              <Text className="text-foreground text-lg font-bold">
                K{walletData.rechargedBalance.toFixed(2)}
              </Text>
            </View>

            <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
              <Text className="text-muted text-xs mb-1">Referral</Text>
              <Text className="text-foreground text-lg font-bold">
                K{walletData.referralBalance.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Link Account Button */}
          <TouchableOpacity
            onPress={() => router.push("/link-account" as any)}
            className="bg-surface rounded-xl p-4 border border-border flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1">
              <MaterialIcons
                name={walletData.hasLinkedAccount ? "check-circle" : "link"}
                size={24}
                color={walletData.hasLinkedAccount ? "#22C55E" : "#0a7ea4"}
              />
              <View className="ml-3 flex-1">
                <Text className="text-foreground font-semibold">
                  {walletData.hasLinkedAccount ? "Manage Linked Account" : "Link Your Account"}
                </Text>
                <Text className="text-muted text-xs mt-1">
                  {walletData.hasLinkedAccount
                    ? `${walletData.linkedProvider?.replace(/_/g, " ").toUpperCase()}: ${walletData.linkedPhoneNumber}`
                    : "Required for withdrawals"}
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Transaction History */}
        <View className="px-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Transaction History
          </Text>

          {transactions.length === 0 ? (
            <View className="bg-surface rounded-xl p-8 items-center">
              <MaterialIcons name="receipt-long" size={48} color="#9CA3AF" />
              <Text className="text-muted text-center mt-2">No transactions yet</Text>
            </View>
          ) : (
            <View className="gap-3">
              {transactions.map((transaction) => (
                <View
                  key={transaction.id}
                  className="bg-surface rounded-xl p-4 border border-border flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1">
                    <View
                      style={{ backgroundColor: `${getTransactionColor(transaction.type)}20` }}
                      className="w-12 h-12 rounded-full items-center justify-center mr-3"
                    >
                      <MaterialIcons
                        name={getTransactionIcon(transaction.type) as any}
                        size={20}
                        color={getTransactionColor(transaction.type)}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold">{transaction.description}</Text>
                      <Text className="text-muted text-xs mt-1">{transaction.date}</Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text
                      className={`font-bold text-base ${
                        transaction.amount > 0 ? "text-success" : "text-error"
                      }`}
                    >
                      {transaction.amount > 0 ? "+" : ""}K{Math.abs(transaction.amount).toFixed(2)}
                    </Text>
                    <View
                      style={{ backgroundColor: getStatusColor(transaction.status) }}
                      className="px-2 py-1 rounded mt-1"
                    >
                      <Text className="text-white text-xs font-semibold capitalize">
                        {transaction.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Recharge Modal */}
      <Modal visible={showRechargeModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 pb-8">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-foreground">Recharge Wallet</Text>
              <TouchableOpacity onPress={() => setShowRechargeModal(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text className="text-foreground font-semibold mb-2">Amount (K)</Text>
            <TextInput
              value={rechargeAmount}
              onChangeText={setRechargeAmount}
              placeholder="Enter amount"
              keyboardType="decimal-pad"
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-6"
            />

            <TouchableOpacity
              onPress={handleRecharge}
              className="bg-primary rounded-xl py-4 items-center"
            >
              <Text className="text-white font-bold text-base">Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Withdraw Modal */}
      <Modal visible={showWithdrawModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 pb-8">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-foreground">Withdraw Funds</Text>
              <TouchableOpacity onPress={() => setShowWithdrawModal(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text className="text-foreground font-semibold mb-2">Amount (K)</Text>
            <TextInput
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder="Enter amount"
              keyboardType="decimal-pad"
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-4"
            />

            <Text className="text-foreground font-semibold mb-2 mt-4">Withdrawal PIN</Text>
            <TextInput
              value={withdrawalPin}
              onChangeText={setWithdrawalPin}
              placeholder="Enter 4-digit PIN"
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-6"
            />

            <TouchableOpacity
              onPress={handleWithdraw}
              className="bg-primary rounded-xl py-4 items-center"
            >
              <Text className="text-white font-bold text-base">Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
