import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

interface ZoneManagerInfo {
  id: string;
  fullName: string;
  phone: string;
  status: "active" | "pending_review" | "rejected";
}

interface Zone {
  id: string;
  name: string;
  province: string;
  town: string;
  householdCount: number;
  driverCount: number;
  monthlyRevenue: number;
  status: "active" | "inactive";
  createdAt: string;
  assignedManager?: ZoneManagerInfo;
  pendingApplicationsCount: number;
}

// No seed/mock data — zones are created by zone admins

export default function ZoneListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "unassigned">("all");
  const [zones, setZones] = useState<Zone[]>([]);

  const loadZonesWithManagers = useCallback(async () => {
    try {
      // Load zones from storage or use seed
      const zonesRaw = await AsyncStorage.getItem("@ltc_zones");
      let baseZones: Zone[] = zonesRaw ? JSON.parse(zonesRaw) : [];

      // Load all users to find zone managers
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
      const zoneManagers = users.filter(
        (u) => u.role === "zone_manager" || u.role === "collector"
      );

      // Enrich each zone with assigned manager and pending count
      const enriched = baseZones.map((zone) => {
        const assignedManager = zoneManagers.find(
          (m) => m.zoneId === zone.id && m.status === "active"
        );
        const pendingCount = zoneManagers.filter(
          (m) =>
            m.status === "pending_review" &&
            (m.selectedZoneId === zone.id ||
              (m.proposedZoneName &&
                m.proposedZoneName.toLowerCase().includes(zone.name.toLowerCase())))
        ).length;

        return {
          ...zone,
          assignedManager: assignedManager
            ? {
                id: assignedManager.id,
                fullName: assignedManager.fullName,
                phone: assignedManager.phone,
                status: assignedManager.status,
              }
            : undefined,
          pendingApplicationsCount: pendingCount,
        };
      });

      setZones(enriched);
    } catch (_e) {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadZonesWithManagers();
    }, [loadZonesWithManagers])
  );

  const filteredZones = zones.filter((zone) => {
    const matchesSearch =
      zone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      zone.province.toLowerCase().includes(searchQuery.toLowerCase()) ||
      zone.town.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "unassigned") return matchesSearch && !zone.assignedManager;
    return matchesSearch && zone.status === filterStatus;
  });

  const handleZonePress = (zoneId: string) => {
    router.push(`/zone-details?id=${zoneId}` as any);
  };

  const handleCreateZone = () => {
    router.push("/zone-create" as any);
  };

  const unassignedCount = zones.filter((z) => !z.assignedManager).length;
  const pendingTotal = zones.reduce((sum, z) => sum + z.pendingApplicationsCount, 0);

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View className="bg-green-700 px-6 pt-6 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
            >
              <MaterialIcons name="arrow-back" size={20} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-2xl font-bold">Zone Management</Text>
          </View>
          <TouchableOpacity
            onPress={handleCreateZone}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <MaterialIcons name="add" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="bg-white/20 rounded-xl px-4 py-2 flex-row items-center mb-3">
          <MaterialIcons name="search" size={20} color="white" />
          <TextInput
            placeholder="Search zones, province, town..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 text-white"
          />
        </View>

        {/* Filter Buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {[
              { key: "all", label: `All (${zones.length})` },
              { key: "active", label: `Active (${zones.filter((z) => z.status === "active").length})` },
              { key: "inactive", label: `Inactive (${zones.filter((z) => z.status === "inactive").length})` },
              { key: "unassigned", label: `Unassigned (${unassignedCount})` },
            ].map((f) => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilterStatus(f.key as any)}
                className={`px-4 py-2 rounded-full ${filterStatus === f.key ? "bg-white" : "bg-white/20"}`}
              >
                <Text className={`font-medium text-sm ${filterStatus === f.key ? "text-green-700" : "text-white"}`}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Pending Applications Banner */}
      {pendingTotal > 0 && (
        <TouchableOpacity
          onPress={() => router.push("/zone-collector-assignment" as any)}
          className="mx-4 mt-3 bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 flex-row items-center"
        >
          <MaterialIcons name="pending-actions" size={20} color="#D97706" />
          <Text className="text-yellow-800 text-sm font-medium ml-2 flex-1">
            {pendingTotal} pending Zone Manager application{pendingTotal !== 1 ? "s" : ""} awaiting review
          </Text>
          <MaterialIcons name="chevron-right" size={18} color="#D97706" />
        </TouchableOpacity>
      )}

      {/* Zone List */}
      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {filteredZones.length === 0 ? (
          <View className="items-center justify-center py-12">
            <MaterialIcons name="location-off" size={64} color="#9BA1A6" />
            <Text className="text-muted text-lg mt-4">No zones found</Text>
            <Text className="text-muted text-sm mt-2">Try adjusting your search or filters</Text>
          </View>
        ) : (
          <View className="gap-4">
            {filteredZones.map((zone) => (
              <TouchableOpacity
                key={zone.id}
                onPress={() => handleZonePress(zone.id)}
                className="bg-surface border border-border rounded-2xl p-5"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }}
              >
                {/* Zone Name & Status */}
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <Text className="text-foreground font-bold text-base">{zone.name}</Text>
                    <Text className="text-muted text-xs mt-0.5">
                      {zone.province} · {zone.town}
                    </Text>
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full ${zone.status === "active" ? "bg-green-100" : "bg-gray-100"}`}
                  >
                    <Text className={`text-xs font-medium ${zone.status === "active" ? "text-green-700" : "text-gray-700"}`}>
                      {zone.status === "active" ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>

                {/* Zone Manager Assignment */}
                <View className={`rounded-xl px-3 py-2 mb-3 ${zone.assignedManager ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
                  <View className="flex-row items-center">
                    <MaterialIcons
                      name={zone.assignedManager ? "manage-accounts" : "person-off"}
                      size={16}
                      color={zone.assignedManager ? "#16A34A" : "#EA580C"}
                    />
                    <View className="ml-2 flex-1">
                      {zone.assignedManager ? (
                        <>
                          <Text className="text-green-800 text-xs font-semibold">
                            Zone Manager: {zone.assignedManager.fullName}
                          </Text>
                          <Text className="text-green-600 text-xs">{zone.assignedManager.phone}</Text>
                        </>
                      ) : (
                        <>
                          <Text className="text-orange-800 text-xs font-semibold">
                            Unassigned – {zone.pendingApplicationsCount > 0 ? "Pending Applications Available" : "No Applications Yet"}
                          </Text>
                          {zone.pendingApplicationsCount > 0 && (
                            <Text className="text-orange-600 text-xs">
                              {zone.pendingApplicationsCount} applicant{zone.pendingApplicationsCount !== 1 ? "s" : ""} waiting
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                    {!zone.assignedManager && zone.pendingApplicationsCount > 0 && (
                      <View className="bg-orange-500 rounded-full w-5 h-5 items-center justify-center">
                        <Text className="text-white text-xs font-bold">{zone.pendingApplicationsCount}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Stats Row */}
                <View className="flex-row gap-3 mb-2">
                  <View className="flex-row items-center flex-1">
                    <MaterialIcons name="home" size={14} color="#9BA1A6" />
                    <Text className="text-muted text-xs ml-1">{zone.householdCount} households</Text>
                  </View>
                  <View className="flex-row items-center flex-1">
                    <MaterialIcons name="local-shipping" size={14} color="#9BA1A6" />
                    <Text className="text-muted text-xs ml-1">{zone.driverCount} drivers</Text>
                  </View>
                  <View className="flex-row items-center flex-1">
                    <MaterialIcons name="payments" size={14} color="#9BA1A6" />
                    <Text className="text-muted text-xs ml-1">K{zone.monthlyRevenue.toLocaleString()}/mo</Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between pt-2 border-t border-border">
                  <Text className="text-muted text-xs">Created {zone.createdAt}</Text>
                  <MaterialIcons name="chevron-right" size={20} color="#9BA1A6" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Create Button */}
      <TouchableOpacity
        onPress={handleCreateZone}
        className="absolute bottom-6 right-6 w-16 h-16 bg-green-700 rounded-full items-center justify-center"
        style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
      >
        <MaterialIcons name="add" size={32} color="white" />
      </TouchableOpacity>
    </ScreenContainer>
  );
}
