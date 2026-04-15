import {useEffect, useState, useCallback} from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from "react-native";
import {useRouter, useFocusEffect} from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { APP_CONFIG } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGlobalNotifications } from "@/lib/global-notification-context";

const screenWidth = Dimensions.get("window").width;

interface ChartData {
  label: string;
  value: number;
  color: string;
}

interface ActivityItem {
  id: string;
  type: "pickup" | "payment" | "registration" | "dispute";
  title: string;
  subtitle: string;
  status: string;
  createdAt: string;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { isAdminAuthenticated, stats, refreshStats } = useAdmin();
  const [refreshing, setRefreshing] = useState(false);
  const [pickupsByStatus, setPickupsByStatus] = useState<ChartData[]>([]);
  const [usersByRole, setUsersByRole] = useState<ChartData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [todayCommission, setTodayCommission] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const { unreadCount: unreadNotifCount } = useGlobalNotifications();

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login" as any);
      return;
    }
    loadDashboardData();
  }, [isAdminAuthenticated]);

  const loadDashboardData = async () => {
    await refreshStats();

    const activities: ActivityItem[] = [];

    // Load pickups data
    try {
      const pickupsData = await AsyncStorage.getItem("ltc_pickups");
      if (pickupsData) {
        const pickups = JSON.parse(pickupsData);
        const pending = pickups.filter((p: any) => p.status === "pending").length;
        const assigned = pickups.filter((p: any) => p.status === "assigned").length;
        const inProgress = pickups.filter((p: any) => p.status === "in_progress").length;
        const completed = pickups.filter((p: any) => p.status === "completed").length;
        const cancelled = pickups.filter((p: any) => p.status === "cancelled").length;

        setPickupsByStatus([
          { label: "Pending", value: pending, color: "#F59E0B" },
          { label: "Assigned", value: assigned, color: "#3B82F6" },
          { label: "In Progress", value: inProgress, color: "#8B5CF6" },
          { label: "Completed", value: completed, color: "#22C55E" },
          { label: "Cancelled", value: cancelled, color: "#EF4444" },
        ]);

        // Add recent pickups to activity feed
        const sortedPickups = [...pickups].sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        sortedPickups.slice(0, 5).forEach((p: any) => {
          activities.push({
            id: `pickup_${p.id}`,
            type: "pickup",
            title: `${(p.binType || "General")?.charAt(0).toUpperCase() + (p.binType || "General")?.slice(1)} Pickup`,
            subtitle: p.location?.address || p.userName || "Location pinned",
            status: p.status,
            createdAt: p.createdAt,
          });
        });
      }
    } catch (error) {
      console.error("Failed to load pickups:", error);
    }

    // Load payments data — Fix 8: include payments in recent activity
    try {
      const paymentsData = await AsyncStorage.getItem("ltc_payments");
      if (paymentsData) {
        const payments = JSON.parse(paymentsData);
        const sortedPayments = [...payments].sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        sortedPayments.slice(0, 3).forEach((p: any) => {
          activities.push({
            id: `payment_${p.id}`,
            type: "payment",
            title: `Payment — ${APP_CONFIG.currencySymbol}${p.amount}`,
            subtitle: p.userName || p.userId || "Customer",
            status: p.status || "completed",
            createdAt: p.createdAt,
          });
        });

        // Fix 9: Commission widget — 10% of total payments
        const today = new Date().toDateString();
        const todayPay = payments.filter((p: any) => new Date(p.createdAt).toDateString() === today);
        setTodayCommission(todayPay.reduce((s: number, p: any) => s + (p.amount || 0) * 0.1, 0));
        setTotalCommission(payments.reduce((s: number, p: any) => s + (p.amount || 0) * 0.1, 0));
      }
    } catch (error) {
      console.error("Failed to load payments:", error);
    }

    // Load registrations — Fix 8: include registrations in recent activity
    try {
      const usersDb = await AsyncStorage.getItem("@ltc_users_db");
      if (usersDb) {
        const usersMap = JSON.parse(usersDb);
        const users: any[] = Object.values(usersMap);
        const sortedUsers = [...users].sort(
          (a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        sortedUsers.slice(0, 3).forEach((u: any) => {
          if (u.createdAt) {
            activities.push({
              id: `reg_${u.id}`,
              type: "registration",
              title: `New Registration — ${u.fullName || u.phone}`,
              subtitle: u.role?.charAt(0).toUpperCase() + (u.role?.slice(1) || "") + " account",
              status: "new",
              createdAt: u.createdAt,
            });
          }
        });
      }
    } catch (error) {
      console.error("Failed to load users:", error);
    }

    // Load disputes — Fix 8: include disputes in recent activity
    try {
      const disputesData = await AsyncStorage.getItem("ltc_disputes");
      if (disputesData) {
        const disputes = JSON.parse(disputesData);
        const sortedDisputes = [...disputes].sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        sortedDisputes.slice(0, 2).forEach((d: any) => {
          activities.push({
            id: `dispute_${d.id}`,
            type: "dispute",
            title: `Dispute — ${d.type || "General"}`,
            subtitle: d.description?.slice(0, 40) || d.userId || "User dispute",
            status: d.status,
            createdAt: d.createdAt,
          });
        });
      }
    } catch (error) {
      console.error("Failed to load disputes:", error);
    }

    // Load subscription approval requests — include in recent activity
    try {
      const approvalData = await AsyncStorage.getItem("ltc_subscription_approval_requests");
      if (approvalData) {
        const approvals = JSON.parse(approvalData);
        const sortedApprovals = [...approvals].sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        sortedApprovals.slice(0, 3).forEach((a: any) => {
          activities.push({
            id: `approval_${a.id}`,
            type: "payment",
            title: `Subscription Request — ${a.planName || "Plan"}`,
            subtitle: a.userName || a.userId || "Customer",
            status: a.status === "pending" ? "pending" : a.status === "approved" ? "approved" : "completed",
            createdAt: a.createdAt,
          });
        });
      }
    } catch (error) {
      console.error("Failed to load subscription approvals:", error);
    }

    // Sort all activities by date and take top 8
    activities.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setRecentActivity(activities.slice(0, 8));

    // Fix 7: Use real residential/commercial counts from stats (set after refreshStats)
    // Note: stats is updated by refreshStats above; we read it after the async call
  };

  // Fix 7: Update usersByRole whenever stats changes (stats.totalResidential is now real)
  useEffect(() => {
    setUsersByRole([
      { label: "Residential", value: stats.totalResidential, color: "#3B82F6" },
      { label: "Commercial", value: stats.totalCommercial, color: "#8B5CF6" },
      { label: "Zone Managers", value: stats.totalCollectors, color: "#22C55E" },
      { label: "Recyclers", value: stats.totalRecyclers, color: "#F59E0B" },
    ]);
  }, [stats.totalResidential, stats.totalCommercial, stats.totalCollectors, stats.totalRecyclers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const maxPickupValue = Math.max(...pickupsByStatus.map((d) => d.value), 1);

  const getActivityIcon = (type: ActivityItem["type"], status: string) => {
    if (type === "payment") return { icon: "payments", color: "#8B5CF6" };
    if (type === "registration") return { icon: "person-add", color: "#3B82F6" };
    if (type === "dispute") return { icon: "gavel", color: "#EF4444" };
    if (status === "completed") return { icon: "check-circle", color: "#22C55E" };
    if (status === "pending") return { icon: "schedule", color: "#F59E0B" };
    return { icon: "local-shipping", color: "#22C55E" };
  };

  const getStatusColor = (status: string) => {
    if (status === "completed" || status === "approved") return "#22C55E";
    if (status === "pending" || status === "open") return "#F59E0B";
    if (status === "cancelled" || status === "rejected") return "#EF4444";
    if (status === "new") return "#3B82F6";
    return "#22C55E";
  };

  if (!isAdminAuthenticated) {
    return null;
  }
  // Real-time: reload data every time this screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );


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
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4"
            >
              <MaterialIcons name="arrow-back" size={24} color="#374151" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground">
                Dashboard Overview
              </Text>
              <Text className="text-muted">Real-time app statistics</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/admin-notifications" as any)}
              className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-2"
              style={{ position: 'relative' }}
            >
              <MaterialIcons name="notifications" size={24} color="#22C55E" />
              {unreadNotifCount > 0 && (
                <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{unreadNotifCount > 99 ? '99+' : String(unreadNotifCount)}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onRefresh}
              className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center"
            >
              <MaterialIcons name="refresh" size={24} color="#22C55E" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Key Metrics */}
        <View className="px-6 mb-6">
          <Text className="text-foreground font-semibold mb-3">Key Metrics</Text>
          <View className="flex-row flex-wrap -mx-1">
            {[
              { label: "Total Users", value: stats.totalUsers, icon: "people", color: "#3B82F6" },
              { label: "Active Pickups", value: stats.activePickups, icon: "local-shipping", color: "#F59E0B" },
              { label: "Completed Today", value: stats.completedPickups, icon: "check-circle", color: "#22C55E" },
              { label: "Open Disputes", value: stats.pendingDisputes, icon: "gavel", color: "#EF4444" },
              { label: "Today Revenue", value: `${APP_CONFIG.currencySymbol}${stats.todayRevenue.toFixed(2)}`, icon: "payments", color: "#8B5CF6" },
              { label: "Total Revenue", value: `${APP_CONFIG.currencySymbol}${stats.totalRevenue.toFixed(2)}`, icon: "account-balance", color: "#22C55E" },
            ].map((metric, index) => (
              <View key={index} className="w-1/2 p-1">
                <View className="bg-surface rounded-xl p-4 border border-border">
                  <View className="flex-row items-center mb-2">
                    <View
                      className="w-8 h-8 rounded-lg items-center justify-center"
                      style={{ backgroundColor: `${metric.color}20` }}
                    >
                      <MaterialIcons name={metric.icon as any} size={18} color={metric.color} />
                    </View>
                  </View>
                  <Text className="text-xl font-bold text-foreground">{metric.value}</Text>
                  <Text className="text-xs text-muted">{metric.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Fix 9: Commission Widget */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-foreground font-semibold">Platform Commission</Text>
              <TouchableOpacity onPress={() => router.push("/admin-commission-dashboard" as any)}>
                <Text className="text-primary text-sm">Full Report</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row">
              <View className="flex-1 items-center py-3 bg-background rounded-xl mr-2">
                <Text className="text-xs text-muted mb-1">Today</Text>
                <Text className="text-lg font-bold text-success">
                  {APP_CONFIG.currencySymbol}{todayCommission.toFixed(2)}
                </Text>
              </View>
              <View className="flex-1 items-center py-3 bg-background rounded-xl">
                <Text className="text-xs text-muted mb-1">All Time</Text>
                <Text className="text-lg font-bold text-primary">
                  {APP_CONFIG.currencySymbol}{totalCommission.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pickups by Status Chart */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-foreground font-semibold mb-4">Pickups by Status</Text>
            {pickupsByStatus.length === 0 ? (
              <Text className="text-muted text-center py-4">No pickup data yet</Text>
            ) : (
              pickupsByStatus.map((item, index) => (
                <View key={index} className="mb-3">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-muted text-sm">{item.label}</Text>
                    <Text className="text-foreground font-medium">{item.value}</Text>
                  </View>
                  <View className="h-3 bg-background rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${(item.value / maxPickupValue) * 100}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Users by Role — Fix 7: real residential/commercial counts */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-foreground font-semibold mb-4">Users by Role</Text>
            <View className="flex-row flex-wrap">
              {usersByRole.map((item, index) => (
                <View key={index} className="w-1/2 p-2">
                  <View className="flex-row items-center">
                    <View
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: item.color }}
                    />
                    <View className="flex-1">
                      <Text className="text-muted text-xs">{item.label}</Text>
                      <Text className="text-foreground font-semibold">{item.value}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            <View className="mt-4 h-4 flex-row rounded-full overflow-hidden">
              {usersByRole.map((item, index) => {
                const total = usersByRole.reduce((sum, i) => sum + i.value, 0) || 1;
                const width = (item.value / total) * 100;
                return (
                  <View
                    key={index}
                    style={{
                      width: `${width}%`,
                      backgroundColor: item.color,
                    }}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {/* System Health */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-2xl p-4 border border-border">
            <Text className="text-foreground font-semibold mb-4">System Health</Text>
            {[
              { label: "Database", status: "Operational", color: "#22C55E" },
              { label: "Payment Gateway", status: "Operational", color: "#22C55E" },
              { label: "Push Notifications", status: "Operational", color: "#22C55E" },
              { label: "File Storage", status: "Operational", color: "#22C55E" },
            ].map((item, index) => (
              <View key={index} className="flex-row items-center justify-between py-2 border-b border-border last:border-b-0">
                <Text className="text-foreground">{item.label}</Text>
                <View className="flex-row items-center">
                  <View
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: item.color }}
                  />
                  <Text style={{ color: item.color }} className="font-medium">
                    {item.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Activity — Fix 8: multi-source (pickups + payments + registrations + disputes) */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-foreground font-semibold">Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push("/admin-pickups" as any)}>
              <Text className="text-primary text-sm">View Pickups</Text>
            </TouchableOpacity>
          </View>
          {recentActivity.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 border border-border items-center">
              <MaterialIcons name="inbox" size={32} color="#9BA1A6" />
              <Text className="text-muted mt-2">No recent activity</Text>
            </View>
          ) : (
            recentActivity.map((activity, index) => {
              const { icon, color } = getActivityIcon(activity.type, activity.status);
              const statusColor = getStatusColor(activity.status);
              return (
                <View
                  key={activity.id}
                  className="bg-surface rounded-xl p-4 mb-2 border border-border flex-row items-center"
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <MaterialIcons name={icon as any} size={20} color={color} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium" numberOfLines={1}>
                      {activity.title}
                    </Text>
                    <Text className="text-muted text-sm" numberOfLines={1}>
                      {activity.subtitle}
                    </Text>
                  </View>
                  <View
                    className="px-2 py-1 rounded-full"
                    style={{ backgroundColor: `${statusColor}20` }}
                  >
                    <Text
                      className="text-xs font-medium capitalize"
                      style={{ color: statusColor }}
                    >
                      {activity.status}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
