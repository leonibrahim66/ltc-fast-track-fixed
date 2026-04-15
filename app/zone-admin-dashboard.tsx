import { View, Text, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useAdmin } from "@/lib/admin-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface LivePickupEvent {
  id: string;
  type: string;
  action: string;
  description: string;
  adminName: string;
  timestamp: string;
}

interface ZoneStats {
  totalZones: number;
  assignedManagers: number;
  pendingApplications: number;
  totalHouseholds: number;
  unassignedHouseholds: number;
  totalDrivers: number;
}

export default function ZoneAdminDashboardScreen() {
  const router = useRouter();
  const { adminUser, logoutAdmin } = useAdmin();
  const [liveEvents, setLiveEvents] = useState<LivePickupEvent[]>([]);
  const [stats, setStats] = useState<ZoneStats>({
    totalZones: 0,
    assignedManagers: 0,
    pendingApplications: 0,
    totalHouseholds: 0,
    unassignedHouseholds: 0,
    totalDrivers: 0,
  });

  // Redirect if not authenticated or not zone manager/superadmin
  useEffect(() => {
    if (!adminUser || (adminUser.role !== "zonemanager" && adminUser.role !== "superadmin")) {
      router.replace("/(auth)/welcome" as any);
    }
  }, [adminUser]);

  // Load live stats from AsyncStorage
  useEffect(() => {
    const loadStats = async () => {
      try {
        const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
        const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];

        const zoneManagers = users.filter(
          (u) => u.role === "zone_manager" || u.role === "collector"
        );
        const assignedManagers = zoneManagers.filter(
          (u) => u.status === "active" && u.zoneId
        ).length;
        const pendingApplications = zoneManagers.filter(
          (u) => u.status === "pending_review"
        ).length;

        const drivers = users.filter((u) => u.role === "driver").length;

        // Zone count from stored zones
        const zonesRaw = await AsyncStorage.getItem("@ltc_zones");
        const zones: any[] = zonesRaw ? JSON.parse(zonesRaw) : [];

        // Household count from pickups context
        const householdsRaw = await AsyncStorage.getItem("@ltc_households");
        const households: any[] = householdsRaw ? JSON.parse(householdsRaw) : [];
        const unassigned = households.filter((h) => !h.zoneId).length;

        setStats({
          totalZones: zones.length,
          assignedManagers,
          pendingApplications,
          totalHouseholds: households.length,
          unassignedHouseholds: unassigned,
          totalDrivers: drivers,
        });
      } catch (_e) {
        // Keep defaults on error
      }
    };
    loadStats();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logoutAdmin();
            router.replace("/(auth)/welcome" as any);
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      id: "zones",
      title: "Zone Management",
      description: "Create, edit, and manage collection zones",
      icon: "location-on" as const,
      color: "#22C55E",
      route: "/zone-list",
    },
    {
      id: "managers",
      title: "Zone Manager Assignment",
      description: "Assign zone managers and review pending applications",
      icon: "manage-accounts" as const,
      color: "#3B82F6",
      route: "/zone-collector-assignment",
    },
    {
      id: "households",
      title: "Household Management",
      description: "Reassign households between zones",
      icon: "home" as const,
      color: "#F59E0B",
      route: "/zone-household-management",
    },
    {
      id: "reports",
      title: "Zone Reports",
      description: "View zone coverage and performance metrics",
      icon: "assessment" as const,
      color: "#8B5CF6",
      route: "/zone-reports",
    },
    {
      id: "invite-codes",
      title: "Driver Invite Codes",
      description: "View all invite codes across zones",
      icon: "vpn-key" as const,
      color: "#EA580C",
      route: "/admin-invite-codes",
    },
  ];

  const loadLiveEvents = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("@ltc_activity_logs");
      const all: LivePickupEvent[] = raw ? JSON.parse(raw) : [];
      const pickupEvents = all
        .filter((e) =>
          ["pickup_assigned", "pickup_started", "pickup_completed", "driver_registered", "driver_approved"].includes(e.type)
        )
        .slice(0, 10);
      setLiveEvents(pickupEvents);
    } catch (_e) {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLiveEvents();
      const interval = setInterval(loadLiveEvents, 8000);
      return () => clearInterval(interval);
    }, [loadLiveEvents])
  );

  const isSuperAdmin = adminUser?.role === "superadmin";

  return (
    <ScreenContainer className="bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-green-700 px-6 pt-6 pb-8">
          <View className="flex-row items-center justify-between mb-6">
            <View>
              <Text className="text-white text-2xl font-bold">Zone Management</Text>
              <Text className="text-white/80 text-sm mt-1">
                {isSuperAdmin ? "Super Admin" : "Zone Admin"} — {adminUser?.fullName}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleLogout}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            >
              <MaterialIcons name="logout" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Quick Stats */}
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[45%] bg-white/20 rounded-xl p-4">
              <Text className="text-white/80 text-xs font-medium">Total Zones</Text>
              <Text className="text-white text-2xl font-bold mt-1">{stats.totalZones}</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-white/20 rounded-xl p-4">
              <Text className="text-white/80 text-xs font-medium">Zone Managers</Text>
              <Text className="text-white text-2xl font-bold mt-1">{stats.assignedManagers}</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-white/20 rounded-xl p-4">
              <Text className="text-white/80 text-xs font-medium">Pending Applications</Text>
              <Text className="text-white text-2xl font-bold mt-1">{stats.pendingApplications}</Text>
              {stats.pendingApplications > 0 && (
                <View className="mt-1 bg-yellow-400 rounded-full px-2 py-0.5 self-start">
                  <Text className="text-yellow-900 text-xs font-bold">Action needed</Text>
                </View>
              )}
            </View>
            <View className="flex-1 min-w-[45%] bg-white/20 rounded-xl p-4">
              <Text className="text-white/80 text-xs font-medium">Total Households</Text>
              <Text className="text-white text-2xl font-bold mt-1">{stats.totalHouseholds}</Text>
            </View>
          </View>
        </View>

        {/* Pending Applications Alert */}
        {stats.pendingApplications > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/zone-collector-assignment" as any)}
            className="mx-6 mt-4 bg-yellow-50 border border-yellow-300 rounded-2xl p-4 flex-row items-center"
          >
            <View className="w-10 h-10 bg-yellow-100 rounded-full items-center justify-center mr-3">
              <MaterialIcons name="pending-actions" size={22} color="#D97706" />
            </View>
            <View className="flex-1">
              <Text className="text-yellow-900 font-semibold text-sm">
                {stats.pendingApplications} Pending Zone Manager Application{stats.pendingApplications !== 1 ? "s" : ""}
              </Text>
              <Text className="text-yellow-700 text-xs mt-0.5">
                Tap to review and assign to zones
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#D97706" />
          </TouchableOpacity>
        )}

        {/* Menu Items */}
        <View className="p-6 gap-4">
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => router.push(item.route as any)}
              className="bg-surface border border-border rounded-2xl p-5 flex-row items-center"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }}
            >
              <View
                className="w-14 h-14 rounded-full items-center justify-center"
                style={{ backgroundColor: `${item.color}20` }}
              >
                <MaterialIcons name={item.icon} size={28} color={item.color} />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-foreground font-semibold text-base">{item.title}</Text>
                <Text className="text-muted text-sm mt-1">{item.description}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9BA1A6" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View className="px-6 pb-6">
          <Text className="text-foreground font-semibold text-lg mb-4">Quick Actions</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.push("/zone-create" as any)}
              className="flex-1 bg-green-700 rounded-xl p-4 items-center"
            >
              <MaterialIcons name="add-location" size={24} color="white" />
              <Text className="text-white font-medium text-sm mt-2">Create Zone</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/zone-collector-assignment" as any)}
              className="flex-1 bg-blue-600 rounded-xl p-4 items-center"
            >
              <MaterialIcons name="manage-accounts" size={24} color="white" />
              <Text className="text-white font-medium text-sm mt-2">Assign Manager</Text>
            </TouchableOpacity>
          </View>

          {/* Activity Log */}
          <TouchableOpacity
            onPress={() => router.push("/admin-activity-log" as any)}
            className="mt-3 bg-slate-700 rounded-xl p-4 flex-row items-center"
          >
            <MaterialIcons name="history" size={22} color="white" />
            <View className="ml-3 flex-1">
              <Text className="text-white font-semibold text-sm">Driver Activity Log</Text>
              <Text className="text-slate-300 text-xs mt-0.5">View driver registrations, approvals &amp; pickups</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          {/* Live Pickup Feed */}
          {liveEvents.length > 0 && (
            <View className="mt-4">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-2 h-2 bg-green-400 rounded-full" />
                  <Text className="text-foreground font-semibold text-sm">Live Pickup Feed</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/admin-activity-log" as any)}>
                  <Text className="text-primary text-xs">View All</Text>
                </TouchableOpacity>
              </View>
              <View className="bg-surface border border-border rounded-xl overflow-hidden">
                {liveEvents.map((event, idx) => {
                  const iconMap: Record<string, { icon: string; color: string }> = {
                    pickup_assigned: { icon: "assignment", color: "#3B82F6" },
                    pickup_started: { icon: "local-shipping", color: "#F59E0B" },
                    pickup_completed: { icon: "check-circle", color: "#22C55E" },
                    driver_registered: { icon: "person-add", color: "#8B5CF6" },
                    driver_approved: { icon: "verified-user", color: "#22C55E" },
                  };
                  const cfg = iconMap[event.type] ?? { icon: "info", color: "#9BA1A6" };
                  return (
                    <View
                      key={event.id}
                      className={`flex-row items-start p-3 gap-3${
                        idx < liveEvents.length - 1 ? " border-b border-border" : ""
                      }`}
                    >
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center mt-0.5"
                        style={{ backgroundColor: cfg.color + "20" }}
                      >
                        <MaterialIcons name={cfg.icon as any} size={16} color={cfg.color} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-sm font-medium">{event.action}</Text>
                        <Text className="text-muted text-xs mt-0.5" numberOfLines={1}>{event.description}</Text>
                        <Text className="text-muted text-xs mt-1">
                          {event.adminName} · {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Super Admin Only */}
          {isSuperAdmin && (
            <View className="mt-3">
              <Text className="text-muted text-xs font-medium mb-2 uppercase tracking-wide">Super Admin Controls</Text>
              <TouchableOpacity
                onPress={() => router.push("/zone-household-management" as any)}
                className="bg-purple-600 rounded-xl p-4 flex-row items-center justify-center"
              >
                <MaterialIcons name="swap-horiz" size={22} color="white" />
                <Text className="text-white font-medium text-sm ml-2">Transfer Households Between Zones</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
