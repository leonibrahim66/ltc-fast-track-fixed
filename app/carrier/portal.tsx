import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, StyleSheet, Switch, Platform, Image } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-context";
import { CarrierBottomNav } from "@/components/carrier-bottom-nav";
import * as Haptics from "expo-haptics";

import { getStaticResponsive } from "@/hooks/use-responsive";
interface DriverData {
  id: string;
  fullName: string;
  phoneNumber: string;
  vehicleType: string;
  numberPlate: string;
  vehicleColor: string;
  vehicleModel: string;
  status: "approved" | "pending_approval" | "rejected" | "suspended";
  photos?: {
    driversLicense?: string | null;
    nrcFrontImage?: string | null;
    nrcBackImage?: string | null;
    vehiclePhoto?: string | null;
  };
}

interface DashboardStats {
  availableJobs: number;
  activeDeliveries: number;
  availableBalance: number;
  pendingEarnings: number;
  accountCredits: number;
}

export default function CarrierPortalScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [driverData, setDriverData] = useState<DriverData | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    availableJobs: 0,
    activeDeliveries: 0,
    availableBalance: 0,
    pendingEarnings: 0,
    accountCredits: 0,
  });

  // Load driver data
  useEffect(() => {
    loadDriverData();
    loadOnlineStatus();
  }, []);

  const loadDriverData = async () => {
    try {
      const activeDriverStr = await AsyncStorage.getItem("active_carrier_driver");
      if (activeDriverStr) {
        const driver = JSON.parse(activeDriverStr);
        setDriverData(driver);
        
        // DEV MODE: Allow access regardless of approval status
        // PRODUCTION: Uncomment below to restrict access
        // if (driver.status !== "approved") {
        //   router.replace("/carrier/application-status" as any);
        //   return;
        // }
      } else {
        // No driver data, redirect to registration
        router.replace("/carrier/create-account" as any);
      }
    } catch (error) {
      console.error("Error loading driver data:", error);
    }
  };

  const loadOnlineStatus = async () => {
    try {
      const status = await AsyncStorage.getItem("driver_online_status");
      setIsOnline(status === "true");
    } catch (error) {
      console.error("Error loading online status:", error);
    }
  };

  const loadStats = useCallback(async () => {
    try {
      // TODO: Replace with backend API calls
      // Available Jobs - fetch from backend
      const jobsStr = await AsyncStorage.getItem("carrier_available_jobs");
      const jobs = jobsStr ? JSON.parse(jobsStr) : [];
      
      // Active Deliveries - fetch from backend
      const deliveriesStr = await AsyncStorage.getItem("carrier_active_deliveries");
      const deliveries = deliveriesStr ? JSON.parse(deliveriesStr) : [];
      
      // Wallet Balance - fetch from backend
      const walletStr = await AsyncStorage.getItem("carrier_driver_wallet");
      const wallet = walletStr ? JSON.parse(walletStr) : { availableBalance: 0, pendingEarnings: 0 };

      // Account Credits - fetch from backend
      const creditsStr = await AsyncStorage.getItem("driver_account_credits");
      const credits = creditsStr ? parseFloat(creditsStr) : 0;

      setStats({
        availableJobs: jobs.length,
        activeDeliveries: deliveries.length,
        availableBalance: wallet.availableBalance || 0,
        pendingEarnings: wallet.pendingEarnings || 0,
        accountCredits: credits,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [loadStats]);

  const handleOnlineToggle = async (value: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setIsOnline(value);
    try {
      await AsyncStorage.setItem("driver_online_status", value.toString());
      // TODO: Update backend API with online status
    } catch (error) {
      console.error("Error saving online status:", error);
    }
  };

  const getVerificationStatus = () => {
    if (!driverData) return { label: "Unknown", color: "#9CA3AF" };
    
    // DEV MODE: Show status based on current state
    switch (driverData.status) {
      case "approved":
        return { label: "Verified", color: "#22C55E" };
      case "pending_approval":
        return { label: "Pending", color: "#F59E0B" };
      case "rejected":
        return { label: "Rejected", color: "#EF4444" };
      case "suspended":
        return { label: "Suspended", color: "#EF4444" };
      default:
        return { label: "Unknown", color: "#9CA3AF" };
    }
  };

  const verificationStatus = getVerificationStatus();

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Premium Header Section */}
        <View style={styles.headerSection}>
          {/* Top Row: Welcome + Profile */}
          <View className="px-6 pt-6 pb-4">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-muted uppercase tracking-wide">Welcome back</Text>
                <Text className="text-3xl font-bold text-foreground mt-2">
                  {driverData?.fullName || "Driver"}
                </Text>
              </View>
              
              {/* Profile Image */}
              <TouchableOpacity
                onPress={() => router.push("/carrier/driver-profile" as any)}
                activeOpacity={0.7}
                style={styles.profileImageContainer}
              >
                {driverData?.photos?.driversLicense ? (
                  <Image
                    source={{ uri: driverData.photos.driversLicense }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={[styles.profileImage, styles.profilePlaceholder]}>
                    <MaterialIcons name="person" size={32} color="#9CA3AF" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Stats Row: Rating + Today's Earnings */}
            <View className="flex-row gap-3 mb-4">
              {/* Driver Rating */}
              <View style={styles.statBadge}>
                <MaterialIcons name="star" size={16} color="#F59E0B" />
                <Text className="text-sm font-bold text-foreground ml-1">4.8</Text>
                <Text className="text-xs text-muted ml-1">(128)</Text>
              </View>
              
              {/* Today's Earnings */}
              <View style={styles.statBadge}>
                <MaterialIcons name="trending-up" size={16} color="#22C55E" />
                <Text className="text-sm font-bold text-foreground ml-1">K0.00</Text>
                <Text className="text-xs text-muted ml-1">Today</Text>
              </View>
            </View>
          </View>

          {/* Premium Online/Offline Toggle */}
          <View className="px-6 pb-6">
            <View style={styles.premiumOnlineToggleCard}>
              <View className="flex-row items-center flex-1">
                <View style={[styles.animatedStatusDot, { backgroundColor: isOnline ? "#22C55E" : "#EF4444" }]} />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold text-foreground">
                    {isOnline ? "Online & Available" : "Offline"}
                  </Text>
                  <Text className="text-xs text-muted mt-0.5">
                    {isOnline ? "Ready to accept jobs" : "Not accepting jobs"}
                  </Text>
                </View>
              </View>
              <Switch
                value={isOnline}
                onValueChange={handleOnlineToggle}
                trackColor={{ false: "#374151", true: "#22C55E40" }}
                thumbColor={isOnline ? "#22C55E" : "#EF4444"}
              />
            </View>
          </View>
        </View>

        {/* Account Credits Card - Prominent Display */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={() => router.push("/carrier/wallet" as any)}
            activeOpacity={0.7}
            style={styles.creditsCard}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center flex-1">
                <View style={styles.creditsIcon}>
                  <MaterialIcons name="card-giftcard" size={24} color="#fff" />
                </View>
                <Text className="text-sm font-semibold text-foreground ml-3">Account Credits</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#EC4899" />
            </View>
            <Text className="text-4xl font-bold" style={{ color: "#EC4899" }}>
              K{stats.accountCredits.toFixed(2)}
            </Text>
            <Text className="text-xs text-muted mt-2">
              Use credits to pay for platform services and fees
            </Text>
          </TouchableOpacity>
        </View>

        {/* Premium KPI Grid Section */}
        <View className="px-6 mb-6">
          <Text className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Key Metrics</Text>
          <View className="flex-row gap-3">
            {/* Available Jobs KPI Card */}
            <TouchableOpacity
              onPress={() => router.push("/carrier/job-feed" as any)}
              activeOpacity={0.7}
              style={[styles.kpiCard, { backgroundColor: "#3B82F610", borderColor: "#3B82F6" }]}
            >
              <View style={[styles.kpiIcon, { backgroundColor: "#3B82F6" }]}>
                <MaterialIcons name="work" size={20} color="#fff" />
              </View>
              <Text className="text-4xl font-bold" style={{ color: "#3B82F6", marginTop: 12 }}>
                {stats.availableJobs}
              </Text>
              <Text className="text-xs font-semibold text-muted mt-2">Available</Text>
              <Text className="text-xs text-muted mt-1">Booking requests</Text>
            </TouchableOpacity>

            {/* Active Deliveries KPI Card */}
            <TouchableOpacity
              onPress={() => router.push("/carrier/track" as any)}
              activeOpacity={0.7}
              style={[styles.kpiCard, { backgroundColor: "#8B5CF610", borderColor: "#8B5CF6" }]}
            >
              <View style={[styles.kpiIcon, { backgroundColor: "#8B5CF6" }]}>
                <MaterialIcons name="local-shipping" size={20} color="#fff" />
              </View>
              <Text className="text-4xl font-bold" style={{ color: "#8B5CF6", marginTop: 12 }}>
                {stats.activeDeliveries}
              </Text>
              <Text className="text-xs font-semibold text-muted mt-2">Active</Text>
              <Text className="text-xs text-muted mt-1">In progress</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Premium Earnings Overview Card */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={() => router.push("/carrier/wallet" as any)}
            activeOpacity={0.7}
            style={[styles.earningsCard, { backgroundColor: "#F59E0B10", borderColor: "#F59E0B" }]}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-xs font-semibold text-muted uppercase tracking-wide">Earnings Overview</Text>
                <Text className="text-3xl font-bold text-foreground mt-2" style={{ color: "#F59E0B" }}>
                  K{stats.availableBalance.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.cardIcon, { backgroundColor: "#F59E0B" }]}>
                <MaterialIcons name="trending-up" size={24} color="#fff" />
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: "65%", backgroundColor: "#F59E0B" }]} />
            </View>

            {/* Earnings Breakdown */}
            <View className="mt-4 gap-3">
              {/* Today */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View style={[styles.earningsIcon, { backgroundColor: "rgba(245,158,11,0.2)" }]}>
                    <MaterialIcons name="today" size={14} color="#F59E0B" />
                  </View>
                  <Text className="text-xs text-muted">Today</Text>
                </View>
                <Text className="text-sm font-bold text-foreground">K0.00</Text>
              </View>

              {/* This Week */}
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View style={[styles.earningsIcon, { backgroundColor: "rgba(245,158,11,0.2)" }]}>
                    <MaterialIcons name="date-range" size={14} color="#F59E0B" />
                  </View>
                  <Text className="text-xs text-muted">This Week</Text>
                </View>
                <Text className="text-sm font-bold text-foreground">K0.00</Text>
              </View>

              {/* Pending */}
              <View className="flex-row items-center justify-between pt-2" style={{ borderTopWidth: 1, borderTopColor: "rgba(245,158,11,0.15)" }}>
                <View className="flex-row items-center gap-2">
                  <View style={[styles.earningsIcon, { backgroundColor: "rgba(245,158,11,0.2)" }]}>
                    <MaterialIcons name="schedule" size={14} color="#F59E0B" />
                  </View>
                  <Text className="text-xs font-semibold text-muted">Pending Earnings</Text>
                </View>
                <Text className="text-sm font-bold" style={{ color: "#F59E0B" }}>
                  K{stats.pendingEarnings.toFixed(2)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Vehicle Information Card */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={() => router.push("/carrier/driver-profile" as any)}
            activeOpacity={0.7}
            style={[styles.dashboardCard, { backgroundColor: "#06B6D410", borderColor: "#06B6D4" }]}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View style={[styles.cardIcon, { backgroundColor: "#06B6D4" }]}>
                <MaterialIcons name="directions-car" size={24} color="#fff" />
              </View>
              <View style={[styles.verificationBadge, { backgroundColor: `${verificationStatus.color}20` }]}>
                <Text style={{ color: verificationStatus.color, fontSize: 10, fontWeight: "700" }}>
                  {verificationStatus.label}
                </Text>
              </View>
            </View>
            <Text className="text-xl font-bold text-foreground">
              {driverData?.vehicleType || "Vehicle"}
            </Text>
            <Text className="text-sm text-muted mt-1">{driverData?.numberPlate || "No Plate"}</Text>
            <View className="flex-row items-center mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: "rgba(6,182,212,0.2)" }}>
              <Text className="text-xs text-muted">Model: </Text>
              <Text className="text-xs font-semibold text-foreground">
                {driverData?.vehicleModel || "N/A"} • {driverData?.vehicleColor || "N/A"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View className="px-6 mb-6">
          <Text className="text-xs text-muted mb-3">QUICK ACTIONS</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.push("/carrier/notifications" as any)}
              style={styles.quickActionButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="notifications" size={20} color="#ECEDEE" />
              <Text className="text-xs text-foreground mt-1">Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/carrier/driver-reviews" as any)}
              style={styles.quickActionButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="star" size={20} color="#ECEDEE" />
              <Text className="text-xs text-foreground mt-1">Reviews</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/carrier/track" as any)}
              style={styles.quickActionButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="history" size={20} color="#ECEDEE" />
              <Text className="text-xs text-foreground mt-1">History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <CarrierBottomNav currentTab="home" />
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  headerSection: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: _rs.sp(6),
  },
  profileImageContainer: {
    width: _rs.s(56),
    height: _rs.s(56),
    borderRadius: _rs.s(28),
    borderWidth: 2,
    borderColor: "#22C55E",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: _rs.s(26),
  },
  profilePlaceholder: {
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  statBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: _rs.s(10),
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(8),
  },
  premiumOnlineToggleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: _rs.s(14),
    padding: _rs.sp(16),
  },
  animatedStatusDot: {
    width: _rs.s(12),
    height: _rs.s(12),
    borderRadius: _rs.s(6),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  creditsCard: {
    backgroundColor: "rgba(236,72,153,0.1)",
    borderWidth: 2,
    borderColor: "#EC4899",
    borderRadius: _rs.s(16),
    padding: _rs.sp(20),
  },
  creditsIcon: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(12),
    backgroundColor: "#EC4899",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiCard: {
    flex: 1,
    borderRadius: _rs.s(14),
    padding: _rs.sp(16),
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  kpiIcon: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(10),
    alignItems: "center",
    justifyContent: "center",
  },
  dashboardCard: {
    borderRadius: _rs.s(14),
    padding: _rs.sp(18),
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardIcon: {
    width: _rs.s(48),
    height: _rs.s(48),
    borderRadius: _rs.s(12),
    alignItems: "center",
    justifyContent: "center",
  },
  verificationBadge: {
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(4),
    borderRadius: _rs.s(12),
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: _rs.s(12),
    padding: _rs.sp(16),
    alignItems: "center",
  },
  earningsCard: {
    borderRadius: _rs.s(16),
    padding: _rs.sp(20),
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressBarContainer: {
    height: _rs.s(6),
    backgroundColor: "rgba(245,158,11,0.15)",
    borderRadius: _rs.s(3),
    overflow: "hidden" as const,
  },
  progressBar: {
    height: "100%" as any,
    borderRadius: _rs.s(3),
  },
  earningsIcon: {
    width: _rs.s(28),
    height: _rs.s(28),
    borderRadius: _rs.s(8),
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
});
