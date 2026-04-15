import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useGeofencing, ServiceZone } from "@/lib/geofencing-context";
import { useAdmin } from "@/lib/admin-context";

type ZoneType = "standard" | "extended" | "premium" | "restricted";

const ZONE_COLORS: Record<ZoneType, string> = {
  standard: "#3B82F6",
  extended: "#F59E0B",
  premium: "#22C55E",
  restricted: "#EF4444",
};

export default function AdminGeofencingScreen() {
  const router = useRouter();
  const { isAdminAuthenticated } = useAdmin();
  const {
    zones,
    events,
    collectorLocations,
    unreadEventsCount,
    addZone,
    updateZone,
    deleteZone,
    toggleZoneActive,
    markEventAsRead,
    markAllEventsAsRead,
    clearEvents,
  } = useGeofencing();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"zones" | "events" | "collectors">("zones");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingZone, setEditingZone] = useState<ServiceZone | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<ZoneType>("standard");
  const [formRadius, setFormRadius] = useState("2000");
  const [formLatitude, setFormLatitude] = useState("-15.4167");
  const [formLongitude, setFormLongitude] = useState("28.2833");

  const onRefresh = () => {
    setRefreshing(true);
    // Data is from context, no async needed
    setRefreshing(false);
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormType("standard");
    setFormRadius("2000");
    setFormLatitude("-15.4167");
    setFormLongitude("28.2833");
    setEditingZone(null);
  };

  const openEditModal = (zone: ServiceZone) => {
    setEditingZone(zone);
    setFormName(zone.name);
    setFormDescription(zone.description);
    setFormType(zone.type);
    setFormRadius(zone.radius.toString());
    setFormLatitude(zone.center.latitude.toString());
    setFormLongitude(zone.center.longitude.toString());
    setShowAddModal(true);
  };

  const handleSaveZone = () => {
    if (!formName.trim()) {
      Alert.alert("Error", "Please enter a zone name");
      return;
    }

    const zoneData = {
      name: formName.trim(),
      description: formDescription.trim(),
      color: ZONE_COLORS[formType],
      center: {
        latitude: parseFloat(formLatitude) || -15.4167,
        longitude: parseFloat(formLongitude) || 28.2833,
      },
      radius: parseInt(formRadius) || 2000,
      type: formType,
      isActive: true,
    };

    if (editingZone) {
      updateZone(editingZone.id, zoneData);
      Alert.alert("Success", "Zone updated successfully");
    } else {
      addZone(zoneData);
      Alert.alert("Success", "Zone added successfully");
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setShowAddModal(false);
    resetForm();
  };

  const handleDeleteZone = (zone: ServiceZone) => {
    Alert.alert(
      "Delete Zone",
      `Are you sure you want to delete "${zone.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteZone(zone.id);
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6 bg-primary">
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-bold">Geofencing</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
            >
              <MaterialIcons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white/20 rounded-xl p-3">
              <Text className="text-white/70 text-xs">Zones</Text>
              <Text className="text-white text-xl font-bold">{zones.length}</Text>
            </View>
            <View className="flex-1 bg-white/20 rounded-xl p-3">
              <Text className="text-white/70 text-xs">Active</Text>
              <Text className="text-white text-xl font-bold">
                {zones.filter((z) => z.isActive).length}
              </Text>
            </View>
            <View className="flex-1 bg-white/20 rounded-xl p-3">
              <Text className="text-white/70 text-xs">Events</Text>
              <Text className="text-white text-xl font-bold">{unreadEventsCount}</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="flex-row px-6 py-4 gap-2">
          {(["zones", "events", "collectors"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl ${
                activeTab === tab ? "bg-primary" : "bg-surface"
              }`}
            >
              <Text
                className={`text-center font-medium capitalize ${
                  activeTab === tab ? "text-white" : "text-muted"
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <View className="px-6">
          {activeTab === "zones" && (
            <View className="gap-4">
              {zones.map((zone) => (
                <View
                  key={zone.id}
                  className="bg-surface rounded-2xl p-4 border border-border"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-3">
                      <View
                        className="w-12 h-12 rounded-full items-center justify-center"
                        style={{ backgroundColor: zone.color + "20" }}
                      >
                        <MaterialIcons
                          name="location-on"
                          size={24}
                          color={zone.color}
                        />
                      </View>
                      <View>
                        <Text className="text-foreground font-semibold">
                          {zone.name}
                        </Text>
                        <Text className="text-muted text-sm capitalize">
                          {zone.type} Zone
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleZoneActive(zone.id)}
                      className={`px-3 py-1 rounded-full ${
                        zone.isActive ? "bg-success/20" : "bg-muted/20"
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium ${
                          zone.isActive ? "text-success" : "text-muted"
                        }`}
                      >
                        {zone.isActive ? "Active" : "Inactive"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text className="text-muted text-sm mb-3">
                    {zone.description}
                  </Text>

                  <View className="flex-row gap-4 mb-3">
                    <View className="flex-row items-center gap-1">
                      <MaterialIcons name="straighten" size={16} color="#687076" />
                      <Text className="text-muted text-sm">
                        {(zone.radius / 1000).toFixed(1)} km radius
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      <MaterialIcons name="gps-fixed" size={16} color="#687076" />
                      <Text className="text-muted text-sm">
                        {zone.center.latitude.toFixed(4)}, {zone.center.longitude.toFixed(4)}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => openEditModal(zone)}
                      className="flex-1 bg-primary/10 py-2 rounded-lg flex-row items-center justify-center gap-1"
                    >
                      <MaterialIcons name="edit" size={18} color="#22C55E" />
                      <Text className="text-primary font-medium">Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteZone(zone)}
                      className="flex-1 bg-error/10 py-2 rounded-lg flex-row items-center justify-center gap-1"
                    >
                      <MaterialIcons name="delete" size={18} color="#EF4444" />
                      <Text className="text-error font-medium">Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === "events" && (
            <View className="gap-4">
              {events.length > 0 && (
                <View className="flex-row gap-2 mb-2">
                  <TouchableOpacity
                    onPress={markAllEventsAsRead}
                    className="flex-1 bg-primary py-2 rounded-lg"
                  >
                    <Text className="text-white text-center font-medium">
                      Mark All Read
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        "Clear Events",
                        "Are you sure you want to clear all events?",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Clear", style: "destructive", onPress: clearEvents },
                        ]
                      );
                    }}
                    className="flex-1 bg-error py-2 rounded-lg"
                  >
                    <Text className="text-white text-center font-medium">
                      Clear All
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {events.length === 0 ? (
                <View className="bg-surface rounded-2xl p-8 items-center">
                  <MaterialIcons name="notifications-none" size={48} color="#687076" />
                  <Text className="text-muted text-center mt-4">
                    No geofence events yet
                  </Text>
                </View>
              ) : (
                events.map((event) => (
                  <TouchableOpacity
                    key={event.id}
                    onPress={() => markEventAsRead(event.id)}
                    className={`bg-surface rounded-xl p-4 border ${
                      event.isRead ? "border-border" : "border-primary"
                    }`}
                  >
                    <View className="flex-row items-center gap-3">
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center ${
                          event.eventType === "enter" ? "bg-success/20" : "bg-warning/20"
                        }`}
                      >
                        <MaterialIcons
                          name={event.eventType === "enter" ? "login" : "logout"}
                          size={20}
                          color={event.eventType === "enter" ? "#22C55E" : "#F59E0B"}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground font-medium">
                          {event.collectorName}{" "}
                          <Text className="text-muted font-normal">
                            {event.eventType === "enter" ? "entered" : "exited"}
                          </Text>{" "}
                          {event.zoneName}
                        </Text>
                        <Text className="text-muted text-sm">
                          {formatDate(event.timestamp)} at {formatTime(event.timestamp)}
                        </Text>
                      </View>
                      {!event.isRead && (
                        <View className="w-3 h-3 rounded-full bg-primary" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {activeTab === "collectors" && (
            <View className="gap-4">
              {collectorLocations.length === 0 ? (
                <View className="bg-surface rounded-2xl p-8 items-center">
                  <MaterialIcons name="people" size={48} color="#687076" />
                  <Text className="text-muted text-center mt-4">
                    No active collectors tracked
                  </Text>
                  <Text className="text-muted text-center text-sm mt-2">
                    Collector locations will appear here when they are active
                  </Text>
                </View>
              ) : (
                collectorLocations.map((collector) => {
                  const zone = zones.find((z) => z.id === collector.currentZone);
                  return (
                    <View
                      key={collector.collectorId}
                      className="bg-surface rounded-xl p-4 border border-border"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                          <MaterialIcons name="person" size={24} color="#22C55E" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-foreground font-semibold">
                            {collector.collectorName}
                          </Text>
                          <Text className="text-muted text-sm">
                            {zone ? `In ${zone.name}` : "Outside service zones"}
                          </Text>
                        </View>
                        <View
                          className={`px-3 py-1 rounded-full ${
                            zone ? "bg-success/20" : "bg-warning/20"
                          }`}
                        >
                          <Text
                            className={`text-sm font-medium ${
                              zone ? "text-success" : "text-warning"
                            }`}
                          >
                            {zone ? "In Zone" : "Outside"}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row gap-4 mt-3 pt-3 border-t border-border">
                        <View className="flex-row items-center gap-1">
                          <MaterialIcons name="gps-fixed" size={14} color="#687076" />
                          <Text className="text-muted text-xs">
                            {collector.latitude.toFixed(4)}, {collector.longitude.toFixed(4)}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <MaterialIcons name="access-time" size={14} color="#687076" />
                          <Text className="text-muted text-xs">
                            {formatTime(collector.lastUpdated)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Zone Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-foreground text-xl font-bold">
                {editingZone ? "Edit Zone" : "Add Zone"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <MaterialIcons name="close" size={24} color="#687076" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Zone Name */}
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Zone Name</Text>
                <TextInput
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="e.g., Lusaka CBD"
                  placeholderTextColor="#687076"
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                />
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Description</Text>
                <TextInput
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Zone description"
                  placeholderTextColor="#687076"
                  multiline
                  numberOfLines={2}
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                />
              </View>

              {/* Zone Type */}
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">Zone Type</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(["standard", "extended", "premium", "restricted"] as ZoneType[]).map(
                    (type) => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setFormType(type)}
                        className={`px-4 py-2 rounded-full border ${
                          formType === type
                            ? "border-primary bg-primary/10"
                            : "border-border bg-surface"
                        }`}
                      >
                        <Text
                          className={`capitalize ${
                            formType === type ? "text-primary font-medium" : "text-muted"
                          }`}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>

              {/* Radius */}
              <View className="mb-4">
                <Text className="text-foreground font-medium mb-2">
                  Radius (meters)
                </Text>
                <TextInput
                  value={formRadius}
                  onChangeText={setFormRadius}
                  placeholder="2000"
                  placeholderTextColor="#687076"
                  keyboardType="numeric"
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                />
              </View>

              {/* Coordinates */}
              <View className="flex-row gap-4 mb-6">
                <View className="flex-1">
                  <Text className="text-foreground font-medium mb-2">Latitude</Text>
                  <TextInput
                    value={formLatitude}
                    onChangeText={setFormLatitude}
                    placeholder="-15.4167"
                    placeholderTextColor="#687076"
                    keyboardType="numeric"
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-medium mb-2">Longitude</Text>
                  <TextInput
                    value={formLongitude}
                    onChangeText={setFormLongitude}
                    placeholder="28.2833"
                    placeholderTextColor="#687076"
                    keyboardType="numeric"
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  />
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSaveZone}
                className="bg-primary py-4 rounded-xl mb-4"
              >
                <Text className="text-white text-center font-semibold text-lg">
                  {editingZone ? "Update Zone" : "Add Zone"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
