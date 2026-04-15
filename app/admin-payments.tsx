import { useState, useMemo, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  TextInput,
  Platform,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePayments, Payment } from "@/lib/payments-context";
import { useNotifications, createPaymentNotification } from "@/lib/notifications-context";
import { APP_CONFIG } from "@/constants/app";

import { getStaticResponsive } from "@/hooks/use-responsive";
type FilterTab = "pending" | "all";

export default function AdminPaymentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { payments, getAllPendingPayments, approvePayment, rejectPayment } = usePayments();
  const { addNotification } = useNotifications();
  
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Check if user is admin (for now, zone managers can verify payments)
  const isAdmin = user?.role === "collector" || user?.role === "zone_manager" || user?.role === "recycler";

  const filteredPayments = useMemo(() => {
    if (filter === "pending") {
      return getAllPendingPayments();
    }
    return payments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filter, payments, getAllPendingPayments]);

  const pendingCount = getAllPendingPayments().length;

  // Real-time: reload payments every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // payments context auto-reloads via StorageEventBus; trigger a manual check
      // by reading the latest payments from the context (already reactive)
    }, [payments])
  );

  const onRefresh = () => {
    setRefreshing(true);
    // payments context is reactive via StorageEventBus — just toggle refresh indicator
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleApprove = async (payment: Payment) => {
    Alert.alert(
      "Approve Payment",
      `Are you sure you want to approve this payment of ${APP_CONFIG.currencySymbol}${payment.amount}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            setIsProcessing(true);
            try {
              await approvePayment(payment.id);
              // Send notification to user
              await addNotification(
                createPaymentNotification("confirmed", payment.amount, payment.reference, payment.currency)
              );
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              Alert.alert("Success", "Payment has been approved.");
            } catch (_error) {
              Alert.alert("Error", "Failed to approve payment.");
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = (payment: Payment) => {
    setSelectedPayment(payment);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedPayment) return;
    if (!rejectReason.trim()) {
      Alert.alert("Error", "Please provide a reason for rejection.");
      return;
    }

    setIsProcessing(true);
    try {
      await rejectPayment(selectedPayment.id, rejectReason.trim());
      // Send notification to user
      await addNotification(
        createPaymentNotification("failed", selectedPayment.amount, selectedPayment.reference, selectedPayment.currency)
      );
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      setShowRejectModal(false);
      setSelectedPayment(null);
      Alert.alert("Rejected", "Payment has been rejected.");
    } catch (_error) {
      Alert.alert("Error", "Failed to reject payment.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "#F59E0B";
      case "confirmed": return "#22C55E";
      case "failed": return "#EF4444";
      default: return "#6B7280";
    }
  };

  const renderPaymentItem = ({ item }: { item: Payment }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View 
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <Text 
            className="text-xs font-semibold capitalize"
            style={{ color: getStatusColor(item.status) }}
          >
            {item.status}
          </Text>
        </View>
        <Text className="text-xs text-muted">{formatDate(item.createdAt)}</Text>
      </View>

      {/* Amount and Method */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-2xl font-bold text-foreground">
          {APP_CONFIG.currencySymbol}{item.amount.toLocaleString()}
        </Text>
        <Text className="text-muted">{item.methodName}</Text>
      </View>

      {/* Description */}
      <Text className="text-foreground mb-2">{item.description}</Text>

      {/* Reference Info */}
      <View className="bg-background rounded-lg p-3 mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xs text-muted">Reference</Text>
          <Text className="text-sm font-mono text-foreground">{item.reference}</Text>
        </View>
        {item.transactionId && (
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted">Transaction ID</Text>
            <Text className="text-sm font-mono text-foreground">{item.transactionId}</Text>
          </View>
        )}
      </View>

      {/* Screenshot */}
      {item.screenshotUri && (
        <TouchableOpacity 
          className="mb-3"
          onPress={() => setSelectedPayment(item)}
        >
          <Image
            source={{ uri: item.screenshotUri }}
            style={styles.screenshot}
            contentFit="cover"
          />
          <View className="absolute inset-0 bg-black/30 rounded-lg items-center justify-center">
            <MaterialIcons name="zoom-in" size={32} color="#fff" />
            <Text className="text-white text-sm mt-1">Tap to view</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Action Buttons (only for pending) */}
      {item.status === "pending" && (
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => handleReject(item)}
            disabled={isProcessing}
            className="flex-1 bg-error/10 py-3 rounded-xl flex-row items-center justify-center"
          >
            <MaterialIcons name="close" size={20} color="#EF4444" />
            <Text className="text-error font-semibold ml-2">Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleApprove(item)}
            disabled={isProcessing}
            className="flex-1 bg-success py-3 rounded-xl flex-row items-center justify-center"
          >
            <MaterialIcons name="check" size={20} color="#fff" />
            <Text className="text-white font-semibold ml-2">Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
        <MaterialIcons name="check-circle" size={40} color="#22C55E" />
      </View>
      <Text className="text-xl font-semibold text-foreground mb-2">
        {filter === "pending" ? "All Caught Up!" : "No Payments"}
      </Text>
      <Text className="text-muted text-center px-8">
        {filter === "pending"
          ? "There are no pending payments to review."
          : "No payment records found."}
      </Text>
    </View>
  );

  if (!isAdmin) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <MaterialIcons name="lock" size={64} color="#9CA3AF" />
        <Text className="text-xl font-semibold text-foreground mt-4 mb-2">
          Access Restricted
        </Text>
        <Text className="text-muted text-center mb-6">
          Only administrators can access payment verification.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-full"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View className="ml-4 flex-1">
            <Text className="text-2xl font-bold text-foreground">
              Payment Verification
            </Text>
            <Text className="text-muted">
              {pendingCount} pending {pendingCount === 1 ? "payment" : "payments"}
            </Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row mb-4">
          <TouchableOpacity
            onPress={() => setFilter("pending")}
            className={`flex-1 py-3 rounded-xl mr-2 ${
              filter === "pending" ? "bg-primary" : "bg-surface"
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                filter === "pending" ? "text-white" : "text-muted"
              }`}
            >
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilter("all")}
            className={`flex-1 py-3 rounded-xl ${
              filter === "all" ? "bg-primary" : "bg-surface"
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                filter === "all" ? "text-white" : "text-muted"
              }`}
            >
              All ({payments.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Payment List */}
      <FlatList
        data={filteredPayments}
        renderItem={renderPaymentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 100,
          flexGrow: filteredPayments.length === 0 ? 1 : undefined,
        }}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-6">
          <View className="bg-background rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-xl font-bold text-foreground mb-2">
              Reject Payment
            </Text>
            <Text className="text-muted mb-4">
              Please provide a reason for rejecting this payment.
            </Text>

            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Enter rejection reason..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-4"
              style={{ textAlignVertical: "top", minHeight: 80 }}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowRejectModal(false)}
                className="flex-1 bg-surface py-3 rounded-xl"
              >
                <Text className="text-center text-foreground font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmReject}
                disabled={isProcessing || !rejectReason.trim()}
                className="flex-1 bg-error py-3 rounded-xl"
                style={{ opacity: rejectReason.trim() ? 1 : 0.5 }}
              >
                <Text className="text-center text-white font-semibold">
                  Reject
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Screenshot Preview Modal */}
      {selectedPayment?.screenshotUri && !showRejectModal && (
        <Modal
          visible={!!selectedPayment}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedPayment(null)}
        >
          <TouchableOpacity
            className="flex-1 bg-black/90 items-center justify-center"
            activeOpacity={1}
            onPress={() => setSelectedPayment(null)}
          >
            <Image
              source={{ uri: selectedPayment.screenshotUri }}
              style={styles.fullScreenshot}
              contentFit="contain"
            />
            <TouchableOpacity
              onPress={() => setSelectedPayment(null)}
              className="absolute top-12 right-6 bg-white/20 rounded-full p-3"
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  backButton: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  screenshot: {
    width: "100%",
    height: _rs.s(150),
    borderRadius: _rs.s(12),
  },
  fullScreenshot: {
    width: "100%",
    height: "80%",
  },
});
