import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, FlatList, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { cn } from "@/lib/utils";

interface Zone {
  id: number;
  name: string;
  city: string;
  status: "active" | "inactive";
  householdCount: number;
  collectorCount: number;
  createdAt: string;
}

interface ZoneAdmin {
  id: number;
  userId: number;
  fullName: string;
  phone: string;
  email?: string;
  isApproved: boolean;
  createdAt: string;
}

interface ZoneAdminZone {
  zoneAdminId: number;
  zoneId: number;
  assignedAt: string;
}

type TabType = "zones" | "admins" | "assignments";

export default function ZoneManagementPanel() {
  const [activeTab, setActiveTab] = useState<TabType>("zones");
  const [zones, setZones] = useState<Zone[]>([]);
  const [admins, setAdmins] = useState<ZoneAdmin[]>([]);
  const [assignments, setAssignments] = useState<ZoneAdminZone[]>([]);
  const [loading, setLoading] = useState(false);

  const loadZones = async () => {
    setLoading(true);
    try {
      setZones([
        {
          id: 1,
          name: "Central Lusaka",
          city: "Lusaka",
          status: "active",
          householdCount: 1250,
          collectorCount: 8,
          createdAt: "2026-04-01",
        },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to load zones");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    setLoading(true);
    try {
      setAdmins([
        {
          id: 1,
          userId: 1,
          fullName: "John Admin",
          phone: "+260971234567",
          email: "john@example.com",
          isApproved: true,
          createdAt: "2026-04-01",
        },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to load zone admins");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    setLoading(true);
    try {
      setAssignments([
        {
          zoneAdminId: 1,
          zoneId: 1,
          assignedAt: "2026-04-01",
        },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to load assignments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "zones") loadZones();
    if (activeTab === "admins") loadAdmins();
    if (activeTab === "assignments") loadAssignments();
  }, [activeTab]);

  const handleApproveAdmin = async (adminId: number) => {
    try {
      Alert.alert("Success", `Zone admin ${adminId} approved`);
      loadAdmins();
    } catch (error) {
      Alert.alert("Error", "Failed to approve zone admin");
      console.error(error);
    }
  };

  const handleDeleteZone = async (zoneId: number) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this zone?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          try {
            Alert.alert("Success", `Zone ${zoneId} deleted`);
            loadZones();
          } catch (error) {
            Alert.alert("Error", "Failed to delete zone");
            console.error(error);
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Zone Management</Text>
            <Text className="text-base text-muted">
              Manage zones, zone admins, and assignments
            </Text>
          </View>

          <View className="flex-row gap-2 bg-surface p-1 rounded-lg">
            {(["zones", "admins", "assignments"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={cn("flex-1 p-3 rounded", activeTab === tab ? "bg-primary" : "bg-transparent")}
              >
                <Text className={cn("text-center text-sm font-semibold", activeTab === tab ? "text-background" : "text-foreground")}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && (
            <View className="bg-surface p-4 rounded-lg">
              <Text className="text-center text-muted">Loading...</Text>
            </View>
          )}

          {activeTab === "zones" && (
            <FlatList
              data={zones}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View className="bg-surface p-4 rounded-lg mb-3 border border-border">
                  <Text className="text-lg font-semibold text-foreground">{item.name}</Text>
                  <Text className="text-sm text-muted mb-2">{item.city}</Text>
                  <Text className="text-sm text-foreground">Households: {item.householdCount}</Text>
                  <Text className="text-sm text-foreground mb-3">Collectors: {item.collectorCount}</Text>

                  <TouchableOpacity
                    onPress={() => handleDeleteZone(item.id)}
                    className="bg-error/20 p-2 rounded"
                  >
                    <Text className="text-center text-error font-semibold">Delete Zone</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          {activeTab === "admins" && (
            <FlatList
              data={admins}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View className="bg-surface p-4 rounded-lg mb-3 border border-border">
                  <Text className="text-lg font-semibold text-foreground">{item.fullName}</Text>
                  <Text className="text-sm text-muted">{item.phone}</Text>
                  {item.email && <Text className="text-sm text-muted">{item.email}</Text>}

                  {!item.isApproved && (
                    <TouchableOpacity
                      onPress={() => handleApproveAdmin(item.id)}
                      className="bg-success p-2 rounded mt-3"
                    >
                      <Text className="text-center text-background font-semibold">Approve</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}

          {activeTab === "assignments" && (
            <FlatList
              data={assignments}
              keyExtractor={(item) => `${item.zoneAdminId}-${item.zoneId}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View className="bg-surface p-4 rounded-lg mb-3 border border-border">
                  <Text className="text-foreground">Zone Admin ID: {item.zoneAdminId}</Text>
                  <Text className="text-foreground">Zone ID: {item.zoneId}</Text>
                  <Text className="text-sm text-muted">
                    Assigned: {new Date(item.assignedAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}