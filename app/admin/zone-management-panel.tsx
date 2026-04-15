import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, FlatList, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

/**
 * Zone Management Panel Component
 * Super Admin dashboard for managing zones and zone admins
 * Integrated into existing zone management section
 */

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

export function ZoneManagementPanel() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<TabType>("zones");
  const [zones, setZones] = useState<Zone[]>([]);
  const [admins, setAdmins] = useState<ZoneAdmin[]>([]);
  const [assignments, setAssignments] = useState<ZoneAdminZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateZone, setShowCreateZone] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);

  /**
   * Load zones
   */
  const loadZones = async () => {
    setLoading(true);
    try {
      // const response = await trpc.zone.list.query({ status: "all" });
      // setZones(response.data);
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

  /**
   * Load zone admins
   */
  const loadAdmins = async () => {
    setLoading(true);
    try {
      // const response = await trpc.zoneAdmin.getAllZoneAdmins.query();
      // setAdmins(response.admins);
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

  /**
   * Load zone admin assignments
   */
  const loadAssignments = async () => {
    setLoading(true);
    try {
      // Fetch assignments from API
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
    if (activeTab === "zones") {
      loadZones();
    } else if (activeTab === "admins") {
      loadAdmins();
    } else if (activeTab === "assignments") {
      loadAssignments();
    }
  }, [activeTab]);

  /**
   * Approve zone admin
   */
  const handleApproveAdmin = async (adminId: number) => {
    try {
      // await trpc.zoneAdmin.approveZoneAdmin.mutate({ zoneAdminId: adminId });
      Alert.alert("Success", "Zone admin approved");
      loadAdmins();
    } catch (error) {
      Alert.alert("Error", "Failed to approve zone admin");
      console.error(error);
    }
  };

  /**
   * Delete zone
   */
  const handleDeleteZone = async (zoneId: number) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this zone?",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Delete",
          onPress: async () => {
            try {
              // await trpc.zone.delete.mutate({ id: zoneId.toString() });
              Alert.alert("Success", "Zone deleted");
              loadZones();
            } catch (error) {
              Alert.alert("Error", "Failed to delete zone");
              console.error(error);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Zone Management</Text>
            <Text className="text-base text-muted">
              Manage zones, zone admins, and assignments
            </Text>
          </View>

          {/* Tabs */}
          <View className="flex-row gap-2 bg-surface p-1 rounded-lg">
            {(["zones", "admins", "assignments"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={cn(
                  "flex-1 p-3 rounded",
                  activeTab === tab ? "bg-primary" : "bg-transparent"
                )}
              >
                <Text
                  className={cn(
                    "text-center text-sm font-semibold",
                    activeTab === tab ? "text-background" : "text-foreground"
                  )}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Zones Tab */}
          {activeTab === "zones" && (
            <View className="gap-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-semibold text-foreground">Zones</Text>
                <TouchableOpacity
                  onPress={() => setShowCreateZone(true)}
                  className="bg-primary px-4 py-2 rounded-lg"
                >
                  <Text className="text-background font-semibold text-sm">+ New Zone</Text>
                </TouchableOpacity>
              </View>

              {zones.length === 0 ? (
                <View className="bg-surface p-4 rounded-lg items-center">
                  <Text className="text-muted">No zones created yet</Text>
                </View>
              ) : (
                <FlatList
                  data={zones}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View className="bg-surface p-4 rounded-lg mb-3 border border-border">
                      <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1">
                          <Text className="text-lg font-semibold text-foreground">
                            {item.name}
                          </Text>
                          <Text className="text-sm text-muted">{item.city}</Text>
                        </View>
                        <View
                          className={cn(
                            "px-3 py-1 rounded",
                            item.status === "active"
                              ? "bg-success/20"
                              : "bg-error/20"
                          )}
                        >
                          <Text
                            className={cn(
                              "text-xs font-semibold",
                              item.status === "active"
                                ? "text-success"
                                : "text-error"
                            )}
                          >
                            {item.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row gap-4 mb-3">
                        <View>
                          <Text className="text-xs text-muted">Households</Text>
                          <Text className="text-lg font-bold text-foreground">
                            {item.householdCount}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-xs text-muted">Collectors</Text>
                          <Text className="text-lg font-bold text-foreground">
                            {item.collectorCount}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row gap-2">
                        <TouchableOpacity className="flex-1 bg-primary/20 p-2 rounded">
                          <Text className="text-center text-primary text-sm font-semibold">
                            Edit
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteZone(item.id)}
                          className="flex-1 bg-error/20 p-2 rounded"
                        >
                          <Text className="text-center text-error text-sm font-semibold">
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                />
              )}
            </View>
          )}

          {/* Admins Tab */}
          {activeTab === "admins" && (
            <View className="gap-3">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-semibold text-foreground">Zone Admins</Text>
                <TouchableOpacity
                  onPress={() => setShowCreateAdmin(true)}
                  className="bg-primary px-4 py-2 rounded-lg"
                >
                  <Text className="text-background font-semibold text-sm">+ New Admin</Text>
                </TouchableOpacity>
              </View>

              {admins.length === 0 ? (
                <View className="bg-surface p-4 rounded-lg items-center">
                  <Text className="text-muted">No zone admins created yet</Text>
                </View>
              ) : (
                <FlatList
                  data={admins}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View className="bg-surface p-4 rounded-lg mb-3 border border-border">
                      <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1">
                          <Text className="text-lg font-semibold text-foreground">
                            {item.fullName}
                          </Text>
                          <Text className="text-sm text-muted">{item.phone}</Text>
                          {item.email && (
                            <Text className="text-sm text-muted">{item.email}</Text>
                          )}
                        </View>
                        <View
                          className={cn(
                            "px-3 py-1 rounded",
                            item.isApproved
                              ? "bg-success/20"
                              : "bg-warning/20"
                          )}
                        >
                          <Text
                            className={cn(
                              "text-xs font-semibold",
                              item.isApproved
                                ? "text-success"
                                : "text-warning"
                            )}
                          >
                            {item.isApproved ? "APPROVED" : "PENDING"}
                          </Text>
                        </View>
                      </View>

                      {!item.isApproved && (
                        <TouchableOpacity
                          onPress={() => handleApproveAdmin(item.id)}
                          className="bg-success p-2 rounded"
                        >
                          <Text className="text-center text-background text-sm font-semibold">
                            Approve
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                />
              )}
            </View>
          )}

          {/* Assignments Tab */}
          {activeTab === "assignments" && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Assignments</Text>

              {assignments.length === 0 ? (
                <View className="bg-surface p-4 rounded-lg items-center">
                  <Text className="text-muted">No assignments yet</Text>
                </View>
              ) : (
                <FlatList
                  data={assignments}
                  keyExtractor={(item) => `${item.zoneAdminId}-${item.zoneId}`}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View className="bg-surface p-4 rounded-lg mb-3 border border-border">
                      <Text className="text-foreground font-semibold mb-1">
                        Zone Admin ID: {item.zoneAdminId}
                      </Text>
                      <Text className="text-foreground font-semibold mb-2">
                        Zone ID: {item.zoneId}
                      </Text>
                      <Text className="text-sm text-muted">
                        Assigned: {new Date(item.assignedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
