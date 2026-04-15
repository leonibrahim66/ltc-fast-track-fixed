/**
 * Zone Household Management
 * Loads real zones and households from AsyncStorage — no mock data.
 */
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Household {
  id: string;
  address: string;
  customerName: string;
  phone: string;
  subscriptionType: "Residential" | "Commercial";
  zoneId: string;
  zoneName: string;
  status: "active" | "inactive";
}

interface Zone {
  id: string;
  name: string;
}

export default function ZoneHouseholdManagementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const preselectedZoneId = params.zoneId as string | undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedZone, setSelectedZone] = useState<string>(preselectedZoneId || "");
  const [showZoneSelector, setShowZoneSelector] = useState(false);
  const [selectedHouseholds, setSelectedHouseholds] = useState<string[]>([]);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [targetZone, setTargetZone] = useState<string>("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load zones
      const zonesRaw = await AsyncStorage.getItem("@ltc_zones");
      const storedZones: Zone[] = zonesRaw ? JSON.parse(zonesRaw) : [];
      setZones(storedZones);

      // Load users (customers) and map them to households
      const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
      const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
      const customers = users.filter(
        (u) => u.role === "residential" || u.role === "commercial"
      );

      const mapped: Household[] = customers.map((u) => {
        const zone = storedZones.find((z) => z.id === u.zoneId);
        return {
          id: u.id,
          address: u.location?.address || u.address || "No address",
          customerName: u.fullName || u.firstName || "Unknown",
          phone: u.phone || u.phoneNumber || "",
          subscriptionType: u.role === "commercial" ? "Commercial" : "Residential",
          zoneId: u.zoneId || "",
          zoneName: zone?.name || "Unassigned",
          status: u.status === "active" ? "active" : "inactive",
        };
      });
      setHouseholds(mapped);
    } catch (_e) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredHouseholds = households.filter((h) => {
    const matchesSearch =
      h.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.phone.includes(searchQuery);
    const matchesZone = !selectedZone || h.zoneId === selectedZone;
    return matchesSearch && matchesZone;
  });

  const toggleHouseholdSelection = (id: string) => {
    setSelectedHouseholds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleReassign = () => {
    if (selectedHouseholds.length === 0) {
      Alert.alert("Error", "Please select at least one household");
      return;
    }
    setShowReassignModal(true);
  };

  const confirmReassign = async () => {
    if (!targetZone) {
      Alert.alert("Error", "Please select a target zone");
      return;
    }
    const targetZoneName = zones.find((z) => z.id === targetZone)?.name;
    Alert.alert(
      "Confirm Reassignment",
      `Reassign ${selectedHouseholds.length} household(s) to ${targetZoneName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reassign",
          onPress: async () => {
            try {
              const usersRaw = await AsyncStorage.getItem("@ltc_users_db");
              const users: any[] = usersRaw ? JSON.parse(usersRaw) : [];
              const updated = users.map((u) =>
                selectedHouseholds.includes(u.id) ? { ...u, zoneId: targetZone } : u
              );
              await AsyncStorage.setItem("@ltc_users_db", JSON.stringify(updated));
              Alert.alert("Success", "Households reassigned successfully");
              setSelectedHouseholds([]);
              setShowReassignModal(false);
              setTargetZone("");
              loadData();
            } catch (_e) {
              Alert.alert("Error", "Failed to reassign households. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View className="bg-green-600 px-6 pt-6 pb-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
          >
            <MaterialIcons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold flex-1">
            Household Management
          </Text>
          {selectedHouseholds.length > 0 && (
            <View className="bg-white/20 rounded-full px-3 py-1">
              <Text className="text-white font-bold">{selectedHouseholds.length}</Text>
            </View>
          )}
        </View>

        {/* Zone Selector */}
        <TouchableOpacity
          onPress={() => setShowZoneSelector(!showZoneSelector)}
          className="bg-white/20 rounded-xl px-4 py-3 flex-row items-center justify-between mb-3"
        >
          <View className="flex-row items-center flex-1">
            <MaterialIcons name="location-on" size={20} color="white" />
            <Text className="text-white font-medium ml-2 flex-1" numberOfLines={1}>
              {selectedZone
                ? zones.find((z) => z.id === selectedZone)?.name || "Selected zone"
                : "All zones"}
            </Text>
          </View>
          <MaterialIcons
            name={showZoneSelector ? "expand-less" : "expand-more"}
            size={24}
            color="white"
          />
        </TouchableOpacity>

        {/* Zone Dropdown */}
        {showZoneSelector && (
          <View className="bg-white rounded-xl mb-3 overflow-hidden">
            <TouchableOpacity
              onPress={() => { setSelectedZone(""); setShowZoneSelector(false); }}
              className={`px-4 py-3 border-b border-border ${!selectedZone ? "bg-green-50" : ""}`}
            >
              <Text className={`font-medium ${!selectedZone ? "text-green-600" : "text-foreground"}`}>
                All zones
              </Text>
            </TouchableOpacity>
            {zones.length === 0 ? (
              <View className="px-4 py-3">
                <Text className="text-muted text-sm">No zones created yet</Text>
              </View>
            ) : (
              zones.map((zone) => (
                <TouchableOpacity
                  key={zone.id}
                  onPress={() => { setSelectedZone(zone.id); setShowZoneSelector(false); }}
                  className={`px-4 py-3 border-b border-border ${selectedZone === zone.id ? "bg-green-50" : ""}`}
                >
                  <Text className={`font-medium ${selectedZone === zone.id ? "text-green-600" : "text-foreground"}`}>
                    {zone.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Search Bar */}
        <View className="bg-white/20 rounded-xl px-4 py-2 flex-row items-center">
          <MaterialIcons name="search" size={20} color="white" />
          <TextInput
            placeholder="Search households..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 text-white"
          />
        </View>
      </View>

      {/* Household List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#16A34A" />
          <Text className="text-muted mt-3">Loading households...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
          {filteredHouseholds.length === 0 ? (
            <View className="items-center justify-center py-12">
              <MaterialIcons name="home-work" size={64} color="#9BA1A6" />
              <Text className="text-muted text-lg mt-4">No households found</Text>
              <Text className="text-muted text-sm mt-2">
                {households.length === 0
                  ? "No customers have registered yet."
                  : "Try adjusting your search or zone filter."}
              </Text>
            </View>
          ) : (
            <View className="gap-4 mb-20">
              {filteredHouseholds.map((household) => {
                const isSelected = selectedHouseholds.includes(household.id);
                return (
                  <TouchableOpacity
                    key={household.id}
                    onPress={() => toggleHouseholdSelection(household.id)}
                    className={`bg-surface border-2 rounded-2xl p-5 ${isSelected ? "border-green-600" : "border-border"}`}
                    style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }}
                  >
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1">
                        <Text className="text-foreground font-bold text-lg">{household.address}</Text>
                        <Text className="text-muted text-sm mt-1">{household.customerName}</Text>
                        {household.phone ? (
                          <Text className="text-muted text-sm">{household.phone}</Text>
                        ) : null}
                      </View>
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? "bg-green-600 border-green-600" : "border-gray-300"}`}>
                        {isSelected && <MaterialIcons name="check" size={16} color="white" />}
                      </View>
                    </View>

                    <View className="flex-row items-center gap-3 mb-2">
                      <View className={`px-2 py-1 rounded ${household.subscriptionType === "Commercial" ? "bg-purple-100" : "bg-blue-100"}`}>
                        <Text className={`text-xs font-medium ${household.subscriptionType === "Commercial" ? "text-purple-700" : "text-blue-700"}`}>
                          {household.subscriptionType}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <MaterialIcons name="location-on" size={14} color="#9BA1A6" />
                        <Text className="text-muted text-xs ml-1">{household.zoneName}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* Floating Action Button */}
      {selectedHouseholds.length > 0 && (
        <View className="absolute bottom-6 left-6 right-6">
          <TouchableOpacity
            onPress={handleReassign}
            className="bg-green-600 rounded-xl py-4 flex-row items-center justify-center"
            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          >
            <MaterialIcons name="swap-horiz" size={24} color="white" />
            <Text className="text-white font-bold text-base ml-2">
              Reassign {selectedHouseholds.length} Household(s)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reassignment Modal */}
      {showReassignModal && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center" style={{ zIndex: 1000 }}>
          <View className="bg-background rounded-2xl p-6 mx-6 w-full max-w-md">
            <Text className="text-foreground font-bold text-xl mb-4">Select Target Zone</Text>
            <Text className="text-muted text-sm mb-4">
              Choose the zone to reassign {selectedHouseholds.length} household(s) to:
            </Text>

            <ScrollView className="max-h-64 mb-4">
              {zones.length === 0 ? (
                <Text className="text-muted text-sm text-center py-4">No zones available</Text>
              ) : (
                zones.map((zone) => (
                  <TouchableOpacity
                    key={zone.id}
                    onPress={() => setTargetZone(zone.id)}
                    className={`px-4 py-3 rounded-xl mb-2 border ${targetZone === zone.id ? "bg-green-50 border-green-600" : "bg-surface border-border"}`}
                  >
                    <Text className={`font-medium ${targetZone === zone.id ? "text-green-600" : "text-foreground"}`}>
                      {zone.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setShowReassignModal(false); setTargetZone(""); }}
                className="flex-1 bg-surface border border-border rounded-xl py-3 items-center"
              >
                <Text className="text-foreground font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmReassign}
                disabled={!targetZone}
                className={`flex-1 rounded-xl py-3 items-center ${targetZone ? "bg-green-600" : "bg-gray-400"}`}
              >
                <Text className="text-white font-semibold">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
