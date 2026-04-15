import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, FlatList } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAdmin } from "@/lib/admin-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

interface ZoneManager {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  kycStatus?: string;
}

interface ZoneDetails {
  id: string;
  name: string;
  province: string;
  town: string;
  description?: string;
  householdCount: number;
  driverCount: number;
  monthlyRevenue: number;
  status: "active" | "inactive";
  createdAt: string;
  assignedManager?: ZoneManager;
  pendingApplications: ZoneManager[];
}

interface AvailableZone {
  id: string;
  name: string;
  province: string;
  town: string;
}

// No seed/mock data — zones are loaded from AsyncStorage

export default function ZoneDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const zoneId = params.id as string;
  const { adminUser } = useAdmin();
  const isSuperAdmin = adminUser?.role === "superadmin";

  const [zone, setZone] = useState<ZoneDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allZones, setAllZones] = useState<AvailableZone[]>([]);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetZoneId, setTransferTargetZoneId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [pendingManagers, setPendingManagers] = useState<ZoneManager[]>([]);

  const loadZoneDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load zones
      const zonesRaw = await AsyncStorage.getItem("@ltc_zones");
      const storedZones: AvailableZone[] = zonesRaw ? JSON.parse(zonesRaw) : [];
      setAllZones(storedZones);

      const baseZone = storedZones.find((z) => z.id === zoneId);

      // Load users
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
      const zoneManagerUsers = users.filter(
        (u) => u.role === "zone_manager" || u.role === "collector"
      );

      const assignedManager = zoneManagerUsers.find(
        (m) => m.zoneId === zoneId && m.status === "active"
      );

      const pending = zoneManagerUsers.filter(
        (m) =>
          m.status === "pending_review" &&
          (m.selectedZoneId === zoneId ||
            (m.proposedZoneName &&
              baseZone &&
              m.proposedZoneName.toLowerCase().includes(baseZone.name.toLowerCase())))
      );

      setPendingManagers(
        pending.map((m) => ({
          id: m.id,
          fullName: m.fullName || "Unknown",
          phone: m.phone || "",
          status: m.status,
          kycStatus: m.kycStatus,
        }))
      );

      // Load households
      const householdsRaw = await AsyncStorage.getItem("@ltc_households");
      const households: any[] = householdsRaw ? JSON.parse(householdsRaw) : [];
      const zoneHouseholds = households.filter((h) => h.zoneId === zoneId);

      // Load drivers
      const zoneDrivers = users.filter(
        (u) => u.role === "driver" && u.zoneId === zoneId
      );

      setZone({
        id: zoneId,
        name: baseZone?.name || "Zone " + zoneId,
        province: baseZone?.province || "Lusaka",
        town: baseZone?.town || "Lusaka",
        householdCount: zoneHouseholds.length || 250,
        driverCount: zoneDrivers.length || 5,
        monthlyRevenue: zoneHouseholds.length * 50 || 12500,
        status: "active",
        createdAt: "2026-01-15",
        assignedManager: assignedManager
          ? {
              id: assignedManager.id,
              fullName: assignedManager.fullName || "Unknown",
              phone: assignedManager.phone || "",
              status: assignedManager.status,
              kycStatus: assignedManager.kycStatus,
            }
          : undefined,
        pendingApplications: pending.map((m) => ({
          id: m.id,
          fullName: m.fullName || "Unknown",
          phone: m.phone || "",
          status: m.status,
          kycStatus: m.kycStatus,
        })),
      });
    } catch (_e) {
      // fallback
    } finally {
      setIsLoading(false);
    }
  }, [zoneId]);

  useFocusEffect(
    useCallback(() => {
      loadZoneDetails();
    }, [loadZoneDetails])
  );

  const handleEdit = () => {
    router.push(`/zone-edit?id=${zoneId}` as any);
  };

  const handleToggleStatus = () => {
    if (!zone) return;
    const newStatus = zone.status === "active" ? "inactive" : "active";
    Alert.alert(
      `${newStatus === "active" ? "Activate" : "Deactivate"} Zone`,
      `Are you sure you want to ${newStatus === "active" ? "activate" : "deactivate"} this zone?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            setZone({ ...zone, status: newStatus });
          },
        },
      ]
    );
  };

  const handleDeactivateManager = () => {
    if (!zone?.assignedManager) return;
    Alert.alert(
      "Deactivate Zone Manager",
      `Remove ${zone.assignedManager.fullName} from this zone? Their status will be set to Suspended.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
              const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
              const managerId = zone?.assignedManager?.id;
              const updated = users.map((u) =>
                u.id === managerId
                  ? { ...u, status: "suspended", zoneId: undefined }
                  : u
              );
              await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(updated));
              if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await loadZoneDetails();
              const managerName = zone?.assignedManager?.fullName ?? "Manager";
              Alert.alert("Done", `${managerName} has been deactivated.`);
            } catch (_e) {
              Alert.alert("Error", "Failed to deactivate manager.");
            }
          },
        },
      ]
    );
  };

  const handleApproveAndAssign = async (manager: ZoneManager) => {
    if (!zone) return;

    // Check one-manager-per-zone rule
    if (zone.assignedManager) {
      if (isSuperAdmin) {
        Alert.alert(
          "Zone Already Has a Manager",
          `${zone.name} already has an active Zone Manager: ${zone.assignedManager.fullName}.\n\nAs Super Admin, you can override this rule. The existing manager will be deactivated.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Override & Assign",
              style: "destructive",
              onPress: () => performAssign(manager, true),
            },
          ]
        );
      } else {
        Alert.alert(
          "Zone Already Assigned",
          `This zone already has an active Zone Manager: ${zone.assignedManager.fullName}.\n\nDeactivate the existing manager first before assigning a new one.`,
          [{ text: "OK" }]
        );
      }
      return;
    }

    Alert.alert(
      "Approve & Assign",
      `Assign ${manager.fullName} as Zone Manager for ${zone.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Approve & Assign", onPress: () => performAssign(manager, false) },
      ]
    );
  };

  const performAssign = async (manager: ZoneManager, override: boolean) => {
    setIsProcessing(true);
    try {
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];

      const updated = users.map((u) => {
        // Deactivate existing manager if override
        if (override && zone?.assignedManager && u.id === zone.assignedManager.id) {
          return { ...u, status: "suspended", zoneId: undefined };
        }
        // Approve new manager
        if (u.id === manager.id) {
          return { ...u, status: "active", zoneId, kycStatus: "verified" };
        }
        return u;
      });

      await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(updated));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadZoneDetails();
      Alert.alert("Success", `${manager.fullName} has been approved and assigned to ${zone?.name}.`);
    } catch (_e) {
      Alert.alert("Error", "Failed to assign zone manager.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransferHouseholds = async () => {
    if (!transferTargetZoneId) {
      Alert.alert("Error", "Please select a target zone.");
      return;
    }
    const targetZone = allZones.find((z) => z.id === transferTargetZoneId);
    Alert.alert(
      "Transfer Households",
      `Transfer all households from ${zone?.name} to ${targetZone?.name}?\n\nThis action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          style: "destructive",
          onPress: async () => {
            setIsProcessing(true);
            try {
              const householdsRaw = await AsyncStorage.getItem("@ltc_households");
              const households: any[] = householdsRaw ? JSON.parse(householdsRaw) : [];
              const updated = households.map((h) =>
                h.zoneId === zoneId ? { ...h, zoneId: transferTargetZoneId } : h
              );
              await AsyncStorage.setItem("@ltc_households", JSON.stringify(updated));
              setShowTransferModal(false);
              await loadZoneDetails();
              Alert.alert("Done", `Households transferred to ${targetZone?.name}.`);
            } catch (_e) {
              Alert.alert("Error", "Failed to transfer households.");
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Zone",
      `Are you sure you want to delete "${zone?.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert("Success", "Zone deleted successfully", [
              { text: "OK", onPress: () => router.back() },
            ]);
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer className="bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#16A34A" />
          <Text className="text-muted mt-3">Loading zone details...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!zone) {
    return (
      <ScreenContainer className="bg-background">
        <View className="flex-1 items-center justify-center p-6">
          <MaterialIcons name="error-outline" size={64} color="#9BA1A6" />
          <Text className="text-muted text-lg mt-4">Zone not found</Text>
          <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-green-600 px-6 py-3 rounded-xl">
            <Text className="text-white font-semibold">Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View className="bg-green-700 px-6 pt-6 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
            >
              <MaterialIcons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold flex-1" numberOfLines={1}>
              Zone Details
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleEdit}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <MaterialIcons name="edit" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {/* Zone Name & Status */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 mr-3">
              <Text className="text-foreground font-bold text-2xl">{zone.name}</Text>
              <Text className="text-muted text-sm mt-1">{zone.province} · {zone.town}</Text>
            </View>
            <View className={`px-3 py-1 rounded-full ${zone.status === "active" ? "bg-green-100" : "bg-gray-100"}`}>
              <Text className={`text-sm font-medium ${zone.status === "active" ? "text-green-700" : "text-gray-700"}`}>
                {zone.status === "active" ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>
        </View>

        {/* Zone Manager Assignment */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <Text className="text-foreground font-semibold text-base mb-3">Zone Manager</Text>

          {zone.assignedManager ? (
            <View>
              <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3">
                <View className="flex-row items-center mb-2">
                  <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-3">
                    <MaterialIcons name="manage-accounts" size={22} color="#16A34A" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-green-900 font-bold">{zone.assignedManager.fullName}</Text>
                    <Text className="text-green-700 text-sm">{zone.assignedManager.phone}</Text>
                  </View>
                  <View className="bg-green-200 rounded-full px-2 py-0.5">
                    <Text className="text-green-800 text-xs font-medium">Active</Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <MaterialIcons
                    name={zone.assignedManager.kycStatus === "verified" ? "verified-user" : "pending"}
                    size={14}
                    color={zone.assignedManager.kycStatus === "verified" ? "#16A34A" : "#D97706"}
                  />
                  <Text className="text-green-700 text-xs ml-1">
                    KYC: {zone.assignedManager.kycStatus === "verified" ? "Verified" : "Pending"}
                  </Text>
                </View>
              </View>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => router.push(`/zone-collector-assignment?zoneId=${zoneId}` as any)}
                  className="flex-1 bg-blue-600 rounded-xl py-3 flex-row items-center justify-center"
                >
                  <MaterialIcons name="swap-horiz" size={18} color="white" />
                  <Text className="text-white font-semibold text-sm ml-1">Reassign</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeactivateManager}
                  className="flex-1 bg-red-50 border border-red-200 rounded-xl py-3 flex-row items-center justify-center"
                >
                  <MaterialIcons name="block" size={18} color="#EF4444" />
                  <Text className="text-red-600 font-semibold text-sm ml-1">Deactivate</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View>
              <View className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-3">
                <View className="flex-row items-center">
                  <MaterialIcons name="person-off" size={22} color="#EA580C" />
                  <View className="ml-3 flex-1">
                    <Text className="text-orange-900 font-semibold text-sm">Unassigned</Text>
                    <Text className="text-orange-700 text-xs mt-0.5">
                      {zone.pendingApplications.length > 0
                        ? `${zone.pendingApplications.length} pending application${zone.pendingApplications.length !== 1 ? "s" : ""} available`
                        : "No applications yet"}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push(`/zone-collector-assignment?zoneId=${zoneId}` as any)}
                className="bg-green-600 rounded-xl py-3 flex-row items-center justify-center"
              >
                <MaterialIcons name="person-add" size={18} color="white" />
                <Text className="text-white font-semibold text-sm ml-2">
                  {zone.pendingApplications.length > 0
                    ? "Assign from Pending Applications"
                    : "Assign Zone Manager"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Pending Applications */}
        {zone.pendingApplications.length > 0 && (
          <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
            <Text className="text-foreground font-semibold text-base mb-3">
              Pending Applications ({zone.pendingApplications.length})
            </Text>
            <View className="gap-3">
              {zone.pendingApplications.map((applicant) => (
                <View key={applicant.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-yellow-900 font-semibold text-sm">{applicant.fullName}</Text>
                      <Text className="text-yellow-700 text-xs">{applicant.phone}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleApproveAndAssign(applicant)}
                      disabled={isProcessing}
                      className="bg-green-600 rounded-lg px-3 py-2"
                    >
                      <Text className="text-white text-xs font-bold">Approve & Assign</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Statistics */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <Text className="text-foreground font-semibold text-base mb-4">Zone Statistics</Text>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[45%] bg-green-50 rounded-xl p-4">
              <MaterialIcons name="home" size={24} color="#22C55E" />
              <Text className="text-green-900 text-2xl font-bold mt-2">{zone.householdCount}</Text>
              <Text className="text-green-700 text-sm">Households</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-blue-50 rounded-xl p-4">
              <MaterialIcons name="local-shipping" size={24} color="#3B82F6" />
              <Text className="text-blue-900 text-2xl font-bold mt-2">{zone.driverCount}</Text>
              <Text className="text-blue-700 text-sm">Drivers</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-purple-50 rounded-xl p-4">
              <MaterialIcons name="payments" size={24} color="#8B5CF6" />
              <Text className="text-purple-900 text-xl font-bold mt-2">K{zone.monthlyRevenue.toLocaleString()}</Text>
              <Text className="text-purple-700 text-sm">Monthly Revenue</Text>
            </View>
            <View className="flex-1 min-w-[45%] bg-orange-50 rounded-xl p-4">
              <MaterialIcons name="pending-actions" size={24} color="#F59E0B" />
              <Text className="text-orange-900 text-2xl font-bold mt-2">{zone.pendingApplications.length}</Text>
              <Text className="text-orange-700 text-sm">Pending Apps</Text>
            </View>
          </View>
        </View>

        {/* Zone Information */}
        <View className="bg-surface border border-border rounded-2xl p-5 mb-4">
          <Text className="text-foreground font-semibold text-base mb-4">Zone Information</Text>
          <View className="gap-3">
            <View>
              <Text className="text-muted text-xs">Zone ID</Text>
              <Text className="text-foreground font-medium text-sm mt-1">{zone.id}</Text>
            </View>
            <View className="border-t border-border pt-3">
              <Text className="text-muted text-xs">Province</Text>
              <Text className="text-foreground font-medium text-sm mt-1">{zone.province}</Text>
            </View>
            <View className="border-t border-border pt-3">
              <Text className="text-muted text-xs">Town / City</Text>
              <Text className="text-foreground font-medium text-sm mt-1">{zone.town}</Text>
            </View>
            <View className="border-t border-border pt-3">
              <Text className="text-muted text-xs">Created Date</Text>
              <Text className="text-foreground font-medium text-sm mt-1">{zone.createdAt}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="gap-3 mb-4">
          <TouchableOpacity
            onPress={() => router.push(`/zone-household-management?zoneId=${zoneId}` as any)}
            className="bg-orange-600 rounded-xl py-4 flex-row items-center justify-center"
          >
            <MaterialIcons name="home" size={20} color="white" />
            <Text className="text-white font-semibold text-base ml-2">Manage Households</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleToggleStatus}
            className={`${zone.status === "active" ? "bg-gray-600" : "bg-green-600"} rounded-xl py-4 flex-row items-center justify-center`}
          >
            <MaterialIcons name={zone.status === "active" ? "pause" : "play-arrow"} size={20} color="white" />
            <Text className="text-white font-semibold text-base ml-2">
              {zone.status === "active" ? "Deactivate Zone" : "Activate Zone"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Super Admin Controls */}
        {isSuperAdmin && (
          <View className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-4">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="admin-panel-settings" size={20} color="#7C3AED" />
              <Text className="text-purple-900 font-semibold text-base ml-2">Super Admin Controls</Text>
            </View>
            <Text className="text-purple-700 text-sm mb-4">
              These actions override standard zone management rules. Use with caution.
            </Text>
            <View className="gap-3">
              <TouchableOpacity
                onPress={() => setShowTransferModal(true)}
                className="bg-purple-600 rounded-xl py-3 flex-row items-center justify-center"
              >
                <MaterialIcons name="swap-horiz" size={20} color="white" />
                <Text className="text-white font-semibold text-sm ml-2">Transfer All Households to Another Zone</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/zone-collector-assignment?zoneId=${zoneId}` as any)}
                className="bg-indigo-600 rounded-xl py-3 flex-row items-center justify-center"
              >
                <MaterialIcons name="manage-accounts" size={20} color="white" />
                <Text className="text-white font-semibold text-sm ml-2">Override Manager Assignment</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Danger Zone */}
        <View className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
          <Text className="text-red-900 font-semibold text-base mb-2">Danger Zone</Text>
          <Text className="text-red-700 text-sm mb-4">
            Deleting this zone will remove all associated data. This action cannot be undone.
          </Text>
          <TouchableOpacity
            onPress={handleDelete}
            className="bg-red-600 rounded-xl py-3 items-center"
          >
            <Text className="text-white font-semibold text-base">Delete Zone</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Transfer Households Modal */}
      <Modal
        visible={showTransferModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTransferModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground font-bold text-lg">Transfer Households</Text>
              <TouchableOpacity
                onPress={() => setShowTransferModal(false)}
                className="w-8 h-8 bg-surface rounded-full items-center justify-center"
              >
                <MaterialIcons name="close" size={18} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <View className="flex-row items-center">
                <MaterialIcons name="warning" size={18} color="#D97706" />
                <Text className="text-yellow-800 text-sm ml-2 flex-1">
                  All {zone.householdCount} households from {zone.name} will be moved to the selected zone.
                </Text>
              </View>
            </View>

            <Text className="text-foreground font-medium mb-3">Select Target Zone</Text>

            <FlatList
              data={allZones.filter((z) => z.id !== zoneId)}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 240 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => setTransferTargetZoneId(item.id)}
                  className={`flex-row items-center p-4 rounded-xl mb-2 border ${
                    transferTargetZoneId === item.id
                      ? "bg-purple-50 border-purple-400"
                      : "bg-surface border-border"
                  }`}
                >
                  <MaterialIcons
                    name={transferTargetZoneId === item.id ? "radio-button-checked" : "radio-button-unchecked"}
                    size={20}
                    color={transferTargetZoneId === item.id ? "#7C3AED" : "#9BA1A6"}
                  />
                  <View className="flex-1 ml-3">
                    <Text className={`font-medium text-sm ${transferTargetZoneId === item.id ? "text-purple-800" : "text-foreground"}`}>
                      {item.name}
                    </Text>
                    <Text className="text-muted text-xs">{item.province} · {item.town}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              onPress={handleTransferHouseholds}
              disabled={!transferTargetZoneId || isProcessing}
              className={`mt-4 py-4 rounded-xl flex-row items-center justify-center ${
                transferTargetZoneId && !isProcessing ? "bg-purple-600" : "bg-gray-300"
              }`}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <MaterialIcons name="swap-horiz" size={20} color="white" />
                  <Text className="text-white font-bold text-base ml-2">Transfer Households</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
