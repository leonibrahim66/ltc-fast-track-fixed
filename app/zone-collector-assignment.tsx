import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { findNearestDriver } from "@/lib/zone-auto-assignment";

interface ZoneManager {
  id: string;
  fullName: string;
  phone: string;
  status: "active" | "pending_review" | "rejected" | "suspended";
  zoneId?: string;
  zoneName?: string;
  kycStatus?: string;
  provinceId?: string;
  townId?: string;
  selectedZoneId?: string;
  proposedZoneName?: string;
  role: string;
}

interface Zone {
  id: string;
  name: string;
  province: string;
  town: string;
}

// No seed/mock data — zones are loaded from AsyncStorage

type TabType = "pending" | "active" | "all";

export default function ZoneManagerAssignmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const preselectedZoneId = params.zoneId as string | undefined;

  const [activeTab, setActiveTab] = useState<TabType>(preselectedZoneId ? "pending" : "pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState<string>(preselectedZoneId || "");
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [managers, setManagers] = useState<ZoneManager[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedManager, setSelectedManager] = useState<ZoneManager | null>(null);
  const [assignToZoneId, setAssignToZoneId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  // Auto-driver suggestion: nearest available driver in the selected zone
  const [suggestedDriver, setSuggestedDriver] = useState<{ driverId: string; driverName: string; zoneId: string } | null>(null);
  const [isFindingDriver, setIsFindingDriver] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load zones
      const zonesRaw = await AsyncStorage.getItem("@ltc_zones");
      const storedZones: Zone[] = zonesRaw ? JSON.parse(zonesRaw) : [];
      setZones(storedZones);

      // Load users
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];

      const zoneManagers: ZoneManager[] = users
        .filter((u) => u.role === "zone_manager" || u.role === "collector")
        .map((u) => {
          const assignedZone = storedZones.find((z) => z.id === u.zoneId);
          return {
            id: u.id,
            fullName: u.fullName || u.firstName + " " + u.lastName || "Unknown",
            phone: u.phone || "",
            status: u.status || "pending_review",
            zoneId: u.zoneId,
            zoneName: assignedZone?.name,
            kycStatus: u.kycStatus || "pending",
            provinceId: u.provinceId,
            townId: u.townId,
            selectedZoneId: u.selectedZoneId,
            proposedZoneName: u.proposedZoneName,
            role: u.role,
          };
        });

      setManagers(zoneManagers);
    } catch (_e) {
      // keep empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredManagers = managers.filter((m) => {
    const matchesSearch =
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.phone.includes(searchQuery) ||
      (m.proposedZoneName || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "pending") return matchesSearch && m.status === "pending_review";
    if (activeTab === "active") return matchesSearch && m.status === "active";
    return matchesSearch;
  });

  const pendingCount = managers.filter((m) => m.status === "pending_review").length;
  const activeCount = managers.filter((m) => m.status === "active").length;

  const openAssignModal = (manager: ZoneManager) => {
    setSelectedManager(manager);
    // Pre-select zone if manager applied for one
    const initialZoneId = manager.selectedZoneId || preselectedZoneId || "";
    setAssignToZoneId(initialZoneId);
    setSuggestedDriver(null);
    setShowAssignModal(true);
    // Auto-suggest nearest driver for the pre-selected zone
    if (initialZoneId) {
      setIsFindingDriver(true);
      findNearestDriver(initialZoneId)
        .then((d) => setSuggestedDriver(d))
        .catch(() => setSuggestedDriver(null))
        .finally(() => setIsFindingDriver(false));
    }
  };

  // Called when zone manager selects a different zone in the assign modal
  const handleZoneSelect = (zoneId: string) => {
    setAssignToZoneId(zoneId);
    setSuggestedDriver(null);
    if (zoneId) {
      setIsFindingDriver(true);
      findNearestDriver(zoneId)
        .then((d) => setSuggestedDriver(d))
        .catch(() => setSuggestedDriver(null))
        .finally(() => setIsFindingDriver(false));
    }
  };

  const handleApproveAndAssign = async () => {
    if (!selectedManager || !assignToZoneId) {
      Alert.alert("Error", "Please select a zone to assign this manager to.");
      return;
    }

    // Enforce one-manager-per-zone rule
    const existingActiveManager = managers.find(
      (m) => m.zoneId === assignToZoneId && m.status === "active" && m.id !== selectedManager.id
    );

    if (existingActiveManager) {
      Alert.alert(
        "Zone Already Assigned",
        `Zone already has an active Zone Manager: ${existingActiveManager.fullName}.\n\nOnly one active Zone Manager is allowed per zone. Please deactivate the existing manager first, or choose a different zone.`,
        [{ text: "OK" }]
      );
      return;
    }

    const zoneName = zones.find((z) => z.id === assignToZoneId)?.name;

    Alert.alert(
      "Approve & Assign Zone Manager",
      `Assign ${selectedManager.fullName} to ${zoneName}?\n\nThis will:\n• Set status = Active\n• Assign zone_id\n• Set KYC = Verified`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve & Assign",
          onPress: async () => {
            setIsProcessing(true);
            try {
              const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
              const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];

              const updated = users.map((u) => {
                if (u.id === selectedManager.id) {
                  return {
                    ...u,
                    status: "active",
                    zoneId: assignToZoneId,
                    kycStatus: "verified",
                  };
                }
                return u;
              });

              await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(updated));

              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              setShowAssignModal(false);
              setSelectedManager(null);
              await loadData();

              Alert.alert(
                "Success",
                `${selectedManager.fullName} has been approved and assigned to ${zoneName}.`
              );
            } catch (_e) {
              Alert.alert("Error", "Failed to assign zone manager. Please try again.");
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleDeactivate = (manager: ZoneManager) => {
    Alert.alert(
      "Deactivate Zone Manager",
      `Deactivate ${manager.fullName}? They will lose access to their zone dashboard.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: async () => {
            try {
              const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
              const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
              const updated = users.map((u) =>
                u.id === manager.id ? { ...u, status: "suspended", zoneId: undefined } : u
              );
              await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(updated));
              await loadData();
              Alert.alert("Done", `${manager.fullName} has been deactivated.`);
            } catch (_e) {
              Alert.alert("Error", "Failed to deactivate manager.");
            }
          },
        },
      ]
    );
  };

  const handleReject = (manager: ZoneManager) => {
    Alert.alert(
      "Reject Application",
      `Reject ${manager.fullName}'s Zone Manager application?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
              const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
              const updated = users.map((u) =>
                u.id === manager.id ? { ...u, status: "rejected" } : u
              );
              await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(updated));
              await loadData();
            } catch (_e) {
              Alert.alert("Error", "Failed to reject application.");
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { bg: "bg-green-100", text: "text-green-700", label: "Active" };
      case "pending_review":
        return { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending Review" };
      case "rejected":
        return { bg: "bg-red-100", text: "text-red-700", label: "Rejected" };
      case "suspended":
        return { bg: "bg-gray-100", text: "text-gray-700", label: "Suspended" };
      default:
        return { bg: "bg-gray-100", text: "text-gray-700", label: status };
    }
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View className="bg-green-700 px-6 pt-6 pb-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
          >
            <MaterialIcons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-bold">Zone Manager Assignment</Text>
            <Text className="text-white/70 text-xs mt-0.5">
              {pendingCount} pending · {activeCount} active
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View className="bg-white/20 rounded-xl px-4 py-2 flex-row items-center">
          <MaterialIcons name="search" size={20} color="white" />
          <TextInput
            placeholder="Search by name, phone, or zone..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 text-white"
          />
        </View>

        {/* Tabs */}
        <View className="flex-row gap-2 mt-3">
          {[
            { key: "pending", label: `Pending (${pendingCount})` },
            { key: "active", label: `Active (${activeCount})` },
            { key: "all", label: `All (${managers.length})` },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key as TabType)}
              className={`px-4 py-2 rounded-full ${activeTab === tab.key ? "bg-white" : "bg-white/20"}`}
            >
              <Text
                className={`font-medium text-sm ${activeTab === tab.key ? "text-green-700" : "text-white"}`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#16A34A" />
          <Text className="text-muted mt-3">Loading zone managers...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
          {filteredManagers.length === 0 ? (
            <View className="items-center justify-center py-16">
              <MaterialIcons
                name={activeTab === "pending" ? "pending-actions" : "manage-accounts"}
                size={64}
                color="#9BA1A6"
              />
              <Text className="text-muted text-lg mt-4 font-medium">
                {activeTab === "pending"
                  ? "No Pending Applications"
                  : activeTab === "active"
                  ? "No Active Zone Managers"
                  : "No Zone Managers Found"}
              </Text>
              <Text className="text-muted text-sm mt-2 text-center px-8">
                {activeTab === "pending"
                  ? "Zone Manager applications will appear here when users register."
                  : "Try adjusting your search or filters."}
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {filteredManagers.map((manager) => {
                const badge = getStatusBadge(manager.status);
                return (
                  <View
                    key={manager.id}
                    className="bg-surface border border-border rounded-2xl p-5"
                    style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }}
                  >
                    {/* Name & Status */}
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1 mr-3">
                        <Text className="text-foreground font-bold text-base">{manager.fullName}</Text>
                        <Text className="text-muted text-sm mt-0.5">{manager.phone}</Text>
                      </View>
                      <View className={`px-3 py-1 rounded-full ${badge.bg}`}>
                        <Text className={`text-xs font-medium ${badge.text}`}>{badge.label}</Text>
                      </View>
                    </View>

                    {/* Zone Application Info */}
                    <View className="bg-background rounded-xl p-3 mb-3">
                      <Text className="text-muted text-xs font-medium mb-1 uppercase tracking-wide">Zone Application</Text>
                      {manager.proposedZoneName ? (
                        <View className="flex-row items-center">
                          <MaterialIcons name="edit-location" size={14} color="#9BA1A6" />
                          <Text className="text-foreground text-sm ml-1">Proposed: {manager.proposedZoneName}</Text>
                        </View>
                      ) : manager.selectedZoneId ? (
                        <View className="flex-row items-center">
                          <MaterialIcons name="location-on" size={14} color="#16A34A" />
                          <Text className="text-foreground text-sm ml-1">
                            Applied for: {zones.find((z) => z.id === manager.selectedZoneId)?.name || manager.selectedZoneId}
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-muted text-sm">No zone preference specified</Text>
                      )}
                      {manager.provinceId && (
                        <View className="flex-row items-center mt-1">
                          <MaterialIcons name="map" size={14} color="#9BA1A6" />
                          <Text className="text-muted text-xs ml-1">
                            {manager.provinceId}{manager.townId ? ` · ${manager.townId}` : ""}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Currently Assigned Zone (active managers) */}
                    {manager.status === "active" && manager.zoneName && (
                      <View className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-3 flex-row items-center">
                        <MaterialIcons name="check-circle" size={16} color="#16A34A" />
                        <Text className="text-green-800 text-sm ml-2 font-medium">
                          Assigned to: {manager.zoneName}
                        </Text>
                      </View>
                    )}

                    {/* KYC Status */}
                    <View className="flex-row items-center mb-3">
                      <MaterialIcons
                        name={manager.kycStatus === "verified" ? "verified-user" : "pending"}
                        size={14}
                        color={manager.kycStatus === "verified" ? "#16A34A" : "#D97706"}
                      />
                      <Text className="text-muted text-xs ml-1">
                        KYC: {manager.kycStatus === "verified" ? "Verified" : "Pending Verification"}
                      </Text>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row gap-2">
                      {manager.status === "pending_review" && (
                        <>
                          <TouchableOpacity
                            onPress={() => openAssignModal(manager)}
                            className="flex-1 bg-green-600 rounded-xl py-3 flex-row items-center justify-center"
                          >
                            <MaterialIcons name="check" size={18} color="white" />
                            <Text className="text-white font-semibold text-sm ml-1">Approve & Assign</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleReject(manager)}
                            className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 items-center"
                          >
                            <MaterialIcons name="close" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </>
                      )}
                      {manager.status === "active" && (
                        <>
                          <TouchableOpacity
                            onPress={() => openAssignModal(manager)}
                            className="flex-1 bg-blue-600 rounded-xl py-3 flex-row items-center justify-center"
                          >
                            <MaterialIcons name="swap-horiz" size={18} color="white" />
                            <Text className="text-white font-semibold text-sm ml-1">Reassign Zone</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeactivate(manager)}
                            className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 items-center"
                          >
                            <MaterialIcons name="block" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </>
                      )}
                      {(manager.status === "rejected" || manager.status === "suspended") && (
                        <TouchableOpacity
                          onPress={() => openAssignModal(manager)}
                          className="flex-1 bg-gray-600 rounded-xl py-3 flex-row items-center justify-center"
                        >
                          <MaterialIcons name="restore" size={18} color="white" />
                          <Text className="text-white font-semibold text-sm ml-1">Reinstate & Assign</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Assign Zone Modal */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground font-bold text-lg">
                {selectedManager?.status === "active" ? "Reassign Zone" : "Approve & Assign Zone"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowAssignModal(false)}
                className="w-8 h-8 bg-surface rounded-full items-center justify-center"
              >
                <MaterialIcons name="close" size={18} color="#9BA1A6" />
              </TouchableOpacity>
            </View>

            {selectedManager && (
              <View className="bg-surface rounded-xl p-4 mb-4">
                <Text className="text-foreground font-semibold">{selectedManager.fullName}</Text>
                <Text className="text-muted text-sm">{selectedManager.phone}</Text>
              </View>
            )}

            <Text className="text-foreground font-medium mb-3">Select Zone to Assign</Text>

            <FlatList
              data={zones}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 280 }}
              renderItem={({ item }) => {
                const hasActiveManager = managers.some(
                  (m) => m.zoneId === item.id && m.status === "active" && m.id !== selectedManager?.id
                );
                return (
                  <TouchableOpacity
                    onPress={() => handleZoneSelect(item.id)}
                    className={`flex-row items-center p-4 rounded-xl mb-2 border ${
                      assignToZoneId === item.id
                        ? "bg-green-50 border-green-400"
                        : "bg-surface border-border"
                    }`}
                  >
                    <MaterialIcons
                      name={assignToZoneId === item.id ? "radio-button-checked" : "radio-button-unchecked"}
                      size={20}
                      color={assignToZoneId === item.id ? "#16A34A" : "#9BA1A6"}
                    />
                    <View className="flex-1 ml-3">
                      <Text className={`font-medium text-sm ${assignToZoneId === item.id ? "text-green-800" : "text-foreground"}`}>
                        {item.name}
                      </Text>
                      <Text className="text-muted text-xs">{item.province} · {item.town}</Text>
                    </View>
                    {hasActiveManager && (
                      <View className="bg-orange-100 rounded-full px-2 py-0.5">
                        <Text className="text-orange-700 text-xs">Has Manager</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />

            {/* Zone intelligence: auto-driver suggestion */}
            {assignToZoneId ? (
              <View className="mt-3 mb-1 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl flex-row items-center">
                <MaterialIcons name="directions-car" size={16} color="#2563EB" />
                <View className="flex-1 ml-2">
                  {isFindingDriver ? (
                    <Text className="text-blue-700 text-xs">Finding nearest available driver...</Text>
                  ) : suggestedDriver ? (
                    <>
                      <Text className="text-blue-900 text-xs font-semibold">Auto-assign suggestion</Text>
                      <Text className="text-blue-700 text-xs">{suggestedDriver.driverName} · online in this zone</Text>
                    </>
                  ) : (
                    <Text className="text-blue-700 text-xs">No online driver available in this zone — pickups will be queued as pending</Text>
                  )}
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleApproveAndAssign}
              disabled={!assignToZoneId || isProcessing}
              className={`mt-4 py-4 rounded-xl flex-row items-center justify-center ${
                assignToZoneId && !isProcessing ? "bg-green-600" : "bg-gray-300"
              }`}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <MaterialIcons name="check-circle" size={20} color="white" />
                  <Text className="text-white font-bold text-base ml-2">
                    {selectedManager?.status === "active" ? "Reassign Zone" : "Approve & Assign"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
