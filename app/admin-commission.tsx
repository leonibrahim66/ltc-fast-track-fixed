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
import {useRouter, useFocusEffect} from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { getStaticResponsive } from "@/hooks/use-responsive";
const DEFAULT_COMMISSION_RATE = 10; // 10%
const DEFAULT_COLLECTOR_COMMISSION_RATE = 10; // 10% for garbage collectors

interface CommissionTransaction {
  id: string;
  bookingId: string;
  customerName: string;
  grossAmount: number;
  commission: number;
  netAmount: number;
  status: string;
  createdAt: string;
  description: string;
}

interface Dispute {
  id: string;
  bookingId: string;
  customerName: string;
  driverName: string;
  type: string;
  description: string;
  status: "open" | "investigating" | "resolved" | "closed";
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface DriverActivity {
  driverName: string;
  totalJobs: number;
  completedJobs: number;
  totalEarnings: number;
  totalCommission: number;
  averageRating: number;
  status: string;
  role: "carrier" | "collector" | "zone_manager";
}

export default function AdminCommissionScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"commission" | "disputes" | "activity">("commission");
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION_RATE);
  const [collectorCommissionRate, setCollectorCommissionRate] = useState(DEFAULT_COLLECTOR_COMMISSION_RATE);
  const [showCollectorRateModal, setShowCollectorRateModal] = useState(false);
  const [newCollectorRate, setNewCollectorRate] = useState(DEFAULT_COLLECTOR_COMMISSION_RATE.toString());
  const [commissionData, setCommissionData] = useState<CommissionTransaction[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [driverActivity, setDriverActivity] = useState<DriverActivity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [newRate, setNewRate] = useState(DEFAULT_COMMISSION_RATE.toString());
  const [resolution, setResolution] = useState("");
  const [totalCompanyEarnings, setTotalCompanyEarnings] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalDriverPayouts, setTotalDriverPayouts] = useState(0);

  const loadData = useCallback(async () => {
    try {
      // Load commission rates
      const rateStr = await AsyncStorage.getItem("admin_commission_rate");
      if (rateStr) setCommissionRate(parseFloat(rateStr));
      
      const collectorRateStr = await AsyncStorage.getItem("admin_collector_commission_rate");
      if (collectorRateStr) setCollectorCommissionRate(parseFloat(collectorRateStr));

      // Load commission data
      const commStr = await AsyncStorage.getItem("carrier_commission_data");
      const commissions: CommissionTransaction[] = commStr ? JSON.parse(commStr) : [];
      setCommissionData(commissions);

      // Also load from garbage collector commissions
      const gcCommStr = await AsyncStorage.getItem("gc_commission_data");
      const gcCommissions: CommissionTransaction[] = gcCommStr ? JSON.parse(gcCommStr) : [];

      const allCommissions = [...commissions, ...gcCommissions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setCommissionData(allCommissions);

      // Calculate totals
      const totalComm = allCommissions.reduce((sum, c) => sum + c.commission, 0);
      const totalGross = allCommissions.reduce((sum, c) => sum + c.grossAmount, 0);
      const totalNet = totalGross - totalComm;
      setTotalCompanyEarnings(Math.round(totalComm * 100) / 100);
      setTotalTransactions(allCommissions.length);
      setTotalDriverPayouts(Math.round(totalNet * 100) / 100);

      // Load disputes
      const dispStr = await AsyncStorage.getItem("admin_disputes");
      const loadedDisputes: Dispute[] = dispStr ? JSON.parse(dispStr) : [];
      setDisputes(loadedDisputes);

      // Build driver activity from active jobs and ratings
      const activeJobsStr = await AsyncStorage.getItem("carrier_active_jobs");
      const activeJobs = activeJobsStr ? JSON.parse(activeJobsStr) : [];
      const ratingsStr = await AsyncStorage.getItem("carrier_driver_ratings");
      const ratings = ratingsStr ? JSON.parse(ratingsStr) : [];

      // Build activity map for carrier drivers
      const activityMap: Record<string, DriverActivity> = {};

      // Process carrier jobs
      const walletTxStr = await AsyncStorage.getItem("carrier_wallet_transactions");
      const walletTx = walletTxStr ? JSON.parse(walletTxStr) : [];
      const earningTx = walletTx.filter((t: any) => t.type === "earning");

      // Group by driver (using "Driver" as default since we don't have individual driver tracking yet)
      const driverNames = new Set<string>();
      activeJobs.forEach((j: any) => driverNames.add("Carrier Driver"));
      earningTx.forEach((t: any) => driverNames.add("Carrier Driver"));

      driverNames.forEach((name) => {
        const driverJobs = activeJobs;
        const completedJobs = driverJobs.filter((j: any) => j.status === "delivered");
        const driverEarnings = earningTx.reduce((sum: number, t: any) => sum + t.netAmount, 0);
        const driverCommission = earningTx.reduce((sum: number, t: any) => sum + t.commission, 0);
        const driverRatings = ratings;
        const avgRating = driverRatings.length > 0
          ? driverRatings.reduce((sum: number, r: any) => sum + r.rating, 0) / driverRatings.length
          : 0;

        activityMap[name] = {
          driverName: name,
          totalJobs: driverJobs.length,
          completedJobs: completedJobs.length,
          totalEarnings: Math.round(driverEarnings * 100) / 100,
          totalCommission: Math.round(driverCommission * 100) / 100,
          averageRating: Math.round(avgRating * 10) / 10,
          status: "active",
          role: "carrier",
        };
      });

      // Add zone manager activity
      const gcJobsStr = await AsyncStorage.getItem("gc_completed_jobs");
      const gcJobs = gcJobsStr ? JSON.parse(gcJobsStr) : [];
      if (gcJobs.length > 0) {
        activityMap["Zone Manager"] = {
          driverName: "Zone Manager",
          totalJobs: gcJobs.length,
          completedJobs: gcJobs.filter((j: any) => j.status === "completed").length,
          totalEarnings: gcJobs.reduce((sum: number, j: any) => sum + (j.amount || 0) * 0.9, 0),
          totalCommission: gcJobs.reduce((sum: number, j: any) => sum + (j.amount || 0) * 0.1, 0),
          averageRating: 0,
          status: "active",
          role: "collector",
        };
      }

      setDriverActivity(Object.values(activityMap));
    } catch (e) {
      console.error("Error loading admin data:", e);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const updateCommissionRate = async () => {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 50) {
      Alert.alert("Error", "Commission rate must be between 0% and 50%.");
      return;
    }

    Alert.alert(
      "Update Commission Rate",
      `Change carrier commission rate from ${commissionRate}% to ${rate}%? This will apply to all future carrier transactions.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            await AsyncStorage.setItem("admin_commission_rate", rate.toString());
            setCommissionRate(rate);
            setShowRateModal(false);
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Success", `Carrier commission rate updated to ${rate}%.`);
          },
        },
      ]
    );
  };

  const updateCollectorCommissionRate = async () => {
    const rate = parseFloat(newCollectorRate);
    if (isNaN(rate) || rate < 0 || rate > 50) {
      Alert.alert("Error", "Commission rate must be between 0% and 50%.");
      return;
    }

    Alert.alert(
      "Update Collector Commission Rate",
      `Change collector commission rate from ${collectorCommissionRate}% to ${rate}%? This will apply to all future collector earnings.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            await AsyncStorage.setItem("admin_collector_commission_rate", rate.toString());
            setCollectorCommissionRate(rate);
            setShowCollectorRateModal(false);
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert("Success", `Collector commission rate updated to ${rate}%.`);
          },
        },
      ]
    );
  };

  const resolveDispute = async (status: "resolved" | "closed") => {
    if (!selectedDispute) return;
    if (status === "resolved" && !resolution.trim()) {
      Alert.alert("Error", "Please provide a resolution description.");
      return;
    }

    try {
      const stored = await AsyncStorage.getItem("admin_disputes");
      const allDisputes: Dispute[] = stored ? JSON.parse(stored) : [];
      const updated = allDisputes.map((d) =>
        d.id === selectedDispute.id
          ? { ...d, status, resolution: resolution.trim() || "Closed by admin", resolvedAt: new Date().toISOString() }
          : d
      );
      await AsyncStorage.setItem("admin_disputes", JSON.stringify(updated));

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setShowDisputeModal(false);
      setSelectedDispute(null);
      setResolution("");
      Alert.alert("Success", `Dispute ${status === "resolved" ? "resolved" : "closed"}.`);
      await loadData();
    } catch (e) {
      Alert.alert("Error", "Failed to update dispute.");
    }
  };

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

  const renderCommission = ({ item }: { item: CommissionTransaction }) => (
    <View style={styles.card}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View style={[styles.icon, { backgroundColor: "rgba(34,197,94,0.15)" }]}>
            <MaterialIcons name="percent" size={16} color="#22C55E" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {item.description}
            </Text>
            <Text className="text-xs text-muted mt-0.5">{getTimeAgo(item.createdAt)}</Text>
          </View>
        </View>
        <View className="items-end">
          <Text style={{ color: "#22C55E", fontWeight: "700", fontSize: 14 }}>
            +K{item.commission.toFixed(2)}
          </Text>
          <Text className="text-xs text-muted">of K{item.grossAmount.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );

  const renderDispute = ({ item }: { item: Dispute }) => (
    <TouchableOpacity
      onPress={() => {
        setSelectedDispute(item);
        setShowDisputeModal(true);
      }}
      activeOpacity={0.7}
      style={styles.card}
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center flex-1">
          <View
            style={[
              styles.icon,
              {
                backgroundColor:
                  item.status === "open"
                    ? "rgba(239,68,68,0.15)"
                    : item.status === "investigating"
                    ? "rgba(245,158,11,0.15)"
                    : "rgba(34,197,94,0.15)",
              },
            ]}
          >
            <MaterialIcons
              name={item.status === "open" ? "report-problem" : item.status === "investigating" ? "search" : "check-circle"}
              size={16}
              color={item.status === "open" ? "#EF4444" : item.status === "investigating" ? "#F59E0B" : "#22C55E"}
            />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {item.type}
            </Text>
            <Text className="text-xs text-muted mt-0.5">
              {item.customerName} vs {item.driverName}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                item.status === "open"
                  ? "rgba(239,68,68,0.15)"
                  : item.status === "investigating"
                  ? "rgba(245,158,11,0.15)"
                  : "rgba(34,197,94,0.15)",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 9,
              fontWeight: "700",
              color: item.status === "open" ? "#EF4444" : item.status === "investigating" ? "#F59E0B" : "#22C55E",
            }}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text className="text-xs text-muted" numberOfLines={2}>{item.description}</Text>
      <Text className="text-xs text-muted mt-1">{getTimeAgo(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  const renderActivity = ({ item }: { item: DriverActivity }) => (
    <View style={styles.card}>
      <View className="flex-row items-center mb-3">
        <View style={[styles.icon, { backgroundColor: item.role === "carrier" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)" }]}>
          <MaterialIcons
            name={item.role === "carrier" ? "local-shipping" : "delete"}
            size={16}
            color={item.role === "carrier" ? "#3B82F6" : "#22C55E"}
          />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-sm font-semibold text-foreground">{item.driverName}</Text>
          <View className="flex-row items-center mt-0.5">
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: item.role === "carrier" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)" },
              ]}
            >
              <Text style={{ fontSize: 9, fontWeight: "700", color: item.role === "carrier" ? "#3B82F6" : "#22C55E" }}>
                {item.role.toUpperCase()}
              </Text>
            </View>
            {item.averageRating > 0 && (
              <View className="flex-row items-center ml-2">
                <MaterialIcons name="star" size={12} color="#FBBF24" />
                <Text style={{ color: "#FBBF24", fontSize: 11, marginLeft: 2 }}>{item.averageRating}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 bg-background rounded-lg p-2 items-center">
          <Text style={{ color: "#9BA1A6", fontSize: 9 }}>JOBS</Text>
          <Text className="text-sm font-bold text-foreground">{item.totalJobs}</Text>
        </View>
        <View className="flex-1 bg-background rounded-lg p-2 items-center">
          <Text style={{ color: "#9BA1A6", fontSize: 9 }}>DONE</Text>
          <Text className="text-sm font-bold text-foreground">{item.completedJobs}</Text>
        </View>
        <View className="flex-1 bg-background rounded-lg p-2 items-center">
          <Text style={{ color: "#9BA1A6", fontSize: 9 }}>EARNED</Text>
          <Text style={{ color: "#22C55E", fontSize: 12, fontWeight: "700" }}>K{item.totalEarnings.toFixed(0)}</Text>
        </View>
        <View className="flex-1 bg-background rounded-lg p-2 items-center">
          <Text style={{ color: "#9BA1A6", fontSize: 9 }}>COMM</Text>
          <Text style={{ color: "#F59E0B", fontSize: 12, fontWeight: "700" }}>K{item.totalCommission.toFixed(0)}</Text>
        </View>
      </View>
    </View>
  );

  const tabs = [
    { key: "commission" as const, label: "Commission", icon: "percent" as const },
    { key: "disputes" as const, label: "Disputes", icon: "gavel" as const },
    { key: "activity" as const, label: "Activity", icon: "people" as const },
  ];

  const openDisputes = disputes.filter((d) => d.status === "open" || d.status === "investigating").length;

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <MaterialIcons name="arrow-back" size={24} color="#ECEDEE" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-foreground">Commission & Disputes</Text>
        </View>
        <View className="flex-row gap-3">
          <TouchableOpacity onPress={() => { setNewRate(commissionRate.toString()); setShowRateModal(true); }}>
            <MaterialIcons name="settings" size={22} color="#22C55E" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setNewCollectorRate(collectorCommissionRate.toString()); setShowCollectorRateModal(true); }}>
            <MaterialIcons name="delete" size={22} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View className="px-6 mb-4 flex-row gap-3">
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9 }}>COMPANY REVENUE</Text>
          <Text style={{ color: "#22C55E", fontSize: 18, fontWeight: "800" }}>K{totalCompanyEarnings.toFixed(2)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>{commissionRate}% rate</Text>
        </View>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9 }}>DRIVER PAYOUTS</Text>
          <Text style={{ color: "#3B82F6", fontSize: 18, fontWeight: "800" }}>K{totalDriverPayouts.toFixed(2)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>{totalTransactions} jobs</Text>
        </View>
        <View style={[styles.summaryCard, { flex: 1 }]}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9 }}>OPEN DISPUTES</Text>
          <Text style={{ color: openDisputes > 0 ? "#EF4444" : "#22C55E", fontSize: 18, fontWeight: "800" }}>
            {openDisputes}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 9 }}>{disputes.length} total</Text>
        </View>
      </View>

      {/* Tabs */}
      <View className="px-6 mb-3 flex-row gap-2">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          >
            <MaterialIcons
              name={tab.icon}
              size={14}
              color={activeTab === tab.key ? "#22C55E" : "#9BA1A6"}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === "commission" && (
        <FlatList
          data={commissionData}
          keyExtractor={(item) => item.id}
          renderItem={renderCommission}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <MaterialIcons name="receipt-long" size={48} color="#4B5563" />
              <Text className="text-muted mt-3 text-sm">No commission data yet</Text>
              <Text className="text-muted text-xs mt-1">Commission is earned when jobs are completed</Text>
            </View>
          }
        />
      )}

      {activeTab === "disputes" && (
        <FlatList
          data={disputes}
          keyExtractor={(item) => item.id}
          renderItem={renderDispute}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <MaterialIcons name="gavel" size={48} color="#4B5563" />
              <Text className="text-muted mt-3 text-sm">No disputes</Text>
              <Text className="text-muted text-xs mt-1">All transactions are running smoothly</Text>
            </View>
          }
        />
      )}

      {activeTab === "activity" && (
        <FlatList
          data={driverActivity}
          keyExtractor={(item) => item.driverName}
          renderItem={renderActivity}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center py-12">
              <MaterialIcons name="people" size={48} color="#4B5563" />
              <Text className="text-muted mt-3 text-sm">No driver activity</Text>
              <Text className="text-muted text-xs mt-1">Activity will appear when drivers complete jobs</Text>
            </View>
          }
        />
      )}

      {/* Carrier Commission Rate Modal */}
      <Modal visible={showRateModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
              Carrier Commission Rate
            </Text>
            <Text style={{ color: "#9BA1A6", fontSize: 12, marginBottom: 16 }}>
              Set the percentage deducted from carrier transport jobs. Current rate: {commissionRate}%
            </Text>
            <View style={styles.rateInputRow}>
              <TextInput
                style={styles.rateInput}
                value={newRate}
                onChangeText={setNewRate}
                keyboardType="decimal-pad"
                placeholder="10"
                placeholderTextColor="#666"
              />
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700", marginLeft: 8 }}>%</Text>
            </View>
            <Text style={{ color: "#9BA1A6", fontSize: 11, marginTop: 8, marginBottom: 16 }}>
              10% means: K100 job → K10 to company, K90 to driver/collector
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowRateModal(false)}
                style={[styles.modalBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
              >
                <Text style={{ color: "#9BA1A6", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={updateCommissionRate} style={[styles.modalBtn, { backgroundColor: "#22C55E" }]}>
                <Text style={{ color: "#166534", fontWeight: "700" }}>Update Rate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Dispute Resolution Modal */}
      <Modal visible={showDisputeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "70%" }]}>
            <View className="flex-row items-center justify-between mb-4">
              <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Dispute Details</Text>
              <TouchableOpacity onPress={() => { setShowDisputeModal(false); setSelectedDispute(null); setResolution(""); }}>
                <MaterialIcons name="close" size={24} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            {selectedDispute && (
              <>
                <View style={styles.disputeDetail}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{selectedDispute.type}</Text>
                </View>
                <View style={styles.disputeDetail}>
                  <Text style={styles.detailLabel}>Customer</Text>
                  <Text style={styles.detailValue}>{selectedDispute.customerName}</Text>
                </View>
                <View style={styles.disputeDetail}>
                  <Text style={styles.detailLabel}>Driver</Text>
                  <Text style={styles.detailValue}>{selectedDispute.driverName}</Text>
                </View>
                <View style={styles.disputeDetail}>
                  <Text style={styles.detailLabel}>Description</Text>
                  <Text style={styles.detailValue}>{selectedDispute.description}</Text>
                </View>
                <View style={styles.disputeDetail}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={[styles.detailValue, { color: selectedDispute.status === "open" ? "#EF4444" : "#F59E0B" }]}>
                    {selectedDispute.status.toUpperCase()}
                  </Text>
                </View>

                {(selectedDispute.status === "open" || selectedDispute.status === "investigating") && (
                  <>
                    <Text style={{ color: "#D1FAE5", fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 }}>
                      Resolution Notes
                    </Text>
                    <TextInput
                      style={[styles.input, { minHeight: 80 }]}
                      value={resolution}
                      onChangeText={setResolution}
                      placeholder="Describe the resolution..."
                      placeholderTextColor="#666"
                      multiline
                      textAlignVertical="top"
                    />
                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity
                        onPress={() => resolveDispute("closed")}
                        style={[styles.modalBtn, { backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }]}
                      >
                        <Text style={{ color: "#EF4444", fontWeight: "600" }}>Close</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => resolveDispute("resolved")}
                        style={[styles.modalBtn, { backgroundColor: "#22C55E" }]}
                      >
                        <Text style={{ color: "#166534", fontWeight: "700" }}>Resolve</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {selectedDispute.resolution && (
                  <View style={[styles.disputeDetail, { marginTop: 12 }]}>
                    <Text style={styles.detailLabel}>Resolution</Text>
                    <Text style={[styles.detailValue, { color: "#22C55E" }]}>{selectedDispute.resolution}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Collector Commission Rate Modal */}
      <Modal visible={showCollectorRateModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
              Collector Commission Rate
            </Text>
            <Text style={{ color: "#9BA1A6", fontSize: 12, marginBottom: 16 }}>
              Set the percentage deducted from Zone Manager earnings. Current rate: {collectorCommissionRate}%
            </Text>
            <View style={styles.rateInputRow}>
              <TextInput
                style={styles.rateInput}
                value={newCollectorRate}
                onChangeText={setNewCollectorRate}
                keyboardType="decimal-pad"
                placeholder="10"
                placeholderTextColor="#666"
              />
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700", marginLeft: 8 }}>%</Text>
            </View>
            <Text style={{ color: "#9BA1A6", fontSize: 11, marginTop: 8, marginBottom: 16 }}>
              10% means: K100 collected → K10 to platform, K90 to collector
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowCollectorRateModal(false)}
                style={[styles.modalBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
              >
                <Text style={{ color: "#9BA1A6", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={updateCollectorCommissionRate} style={[styles.modalBtn, { backgroundColor: "#F59E0B" }]}>
                <Text style={{ color: "#78350F", fontWeight: "700" }}>Update Rate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: _rs.s(14),
    padding: _rs.sp(12),
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: _rs.sp(8),
    borderRadius: _rs.s(10),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: _rs.sp(4),
  },
  tabActive: {
    backgroundColor: "rgba(34,197,94,0.15)",
    borderColor: "#22C55E",
  },
  tabText: {
    color: "#9BA1A6",
    fontSize: _rs.fs(11),
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#22C55E",
  },
  card: {
    marginHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(8),
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: _rs.s(14),
    padding: _rs.sp(14),
  },
  icon: {
    width: _rs.s(36),
    height: _rs.s(36),
    borderRadius: _rs.s(10),
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    paddingHorizontal: _rs.sp(6),
    paddingVertical: _rs.sp(2),
    borderRadius: _rs.s(6),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: _rs.sp(24),
  },
  modalContent: {
    backgroundColor: "#1A2E1A",
    borderRadius: _rs.s(20),
    padding: _rs.sp(24),
    width: "100%",
  },
  rateInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  rateInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: _rs.s(12),
    paddingHorizontal: _rs.sp(20),
    paddingVertical: _rs.sp(12),
    color: "#fff",
    fontSize: _rs.fs(24),
    fontWeight: "700",
    textAlign: "center",
    width: _rs.s(100),
  },
  modalBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: _rs.sp(12),
    borderRadius: _rs.s(12),
  },
  disputeDetail: {
    marginBottom: _rs.sp(10),
  },
  detailLabel: {
    color: "#9BA1A6",
    fontSize: _rs.fs(11),
    fontWeight: "600",
    marginBottom: _rs.sp(2),
  },
  detailValue: {
    color: "#fff",
    fontSize: _rs.fs(13),
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
});
