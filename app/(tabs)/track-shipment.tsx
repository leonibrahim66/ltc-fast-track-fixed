import { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

interface Shipment {
  id: string;
  trackingNumber: string;
  customerName: string;
  pickupLocation: string;
  dropoffLocation: string;
  status: "pending" | "picked-up" | "in-transit" | "delivered" | "cancelled";
  estimatedDelivery: string;
  currentLocation: string;
  driver: string;
  vehicle: string;
  distance: number;
  duration: string;
  lastUpdate: string;
  cargoType: string;
}

export default function TrackShipmentScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  useEffect(() => {
    loadShipments();
  }, []);

  useEffect(() => {
    filterShipments();
  }, [searchQuery, shipments]);

  const loadShipments = async () => {
    try {
      // Mock data - replace with actual API call
      const mockShipments: Shipment[] = [
        {
          id: "1",
          trackingNumber: "TRK-2026-001",
          customerName: "John Doe",
          pickupLocation: "Lusaka, Zambia",
          dropoffLocation: "Ndola, Zambia",
          status: "in-transit",
          estimatedDelivery: "2026-01-23 14:00",
          currentLocation: "Kabwe, Zambia",
          driver: "James Mwale",
          vehicle: "Toyota Hilux - ZMB 123",
          distance: 45,
          duration: "1h 30m",
          lastUpdate: "2 minutes ago",
          cargoType: "General Cargo",
        },
        {
          id: "2",
          trackingNumber: "TRK-2026-002",
          customerName: "Jane Smith",
          pickupLocation: "Kitwe, Zambia",
          dropoffLocation: "Livingstone, Zambia",
          status: "delivered",
          estimatedDelivery: "2026-01-22 16:30",
          currentLocation: "Livingstone, Zambia",
          driver: "Peter Banda",
          vehicle: "Motorbike - ZMB 456",
          distance: 0,
          duration: "Completed",
          lastUpdate: "1 hour ago",
          cargoType: "Documents",
        },
        {
          id: "3",
          trackingNumber: "TRK-2026-003",
          customerName: "ABC Company",
          pickupLocation: "Lusaka Industrial",
          dropoffLocation: "Copperbelt",
          status: "picked-up",
          estimatedDelivery: "2026-01-24 10:00",
          currentLocation: "Lusaka, Zambia",
          driver: "Michael Chanda",
          vehicle: "Heavy Truck - ZMB 789",
          distance: 120,
          duration: "4h 15m",
          lastUpdate: "5 minutes ago",
          cargoType: "Industrial Equipment",
        },
      ];

      setShipments(mockShipments);
    } catch (error) {
      console.error("Error loading shipments:", error);
      Alert.alert("Error", "Failed to load shipments");
    }
  };

  const filterShipments = () => {
    if (!searchQuery.trim()) {
      setFilteredShipments(shipments);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = shipments.filter(
      (shipment) =>
        shipment.trackingNumber.toLowerCase().includes(query) ||
        shipment.customerName.toLowerCase().includes(query) ||
        shipment.pickupLocation.toLowerCase().includes(query) ||
        shipment.dropoffLocation.toLowerCase().includes(query)
    );
    setFilteredShipments(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadShipments();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "picked-up":
        return "#3B82F6";
      case "in-transit":
        return "#8B5CF6";
      case "delivered":
        return "#22C55E";
      case "cancelled":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "schedule";
      case "picked-up":
        return "check-circle";
      case "in-transit":
        return "directions";
      case "delivered":
        return "done-all";
      case "cancelled":
        return "cancel";
      default:
        return "help";
    }
  };

  const renderShipmentCard = ({ item }: { item: Shipment }) => (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedShipment(item);
      }}
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-muted mb-1">{item.trackingNumber}</Text>
          <Text className="text-base font-bold text-foreground">{item.customerName}</Text>
        </View>
        <View
          className="rounded-full px-3 py-1 flex-row items-center"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <MaterialIcons
            name={getStatusIcon(item.status) as any}
            size={14}
            color={getStatusColor(item.status)}
          />
          <Text
            className="text-xs font-semibold ml-1 capitalize"
            style={{ color: getStatusColor(item.status) }}
          >
            {item.status.replace("-", " ")}
          </Text>
        </View>
      </View>

      <View className="mb-3 gap-2">
        <View className="flex-row items-center">
          <MaterialIcons name="location-on" size={16} color="#9BA1A6" />
          <Text className="text-sm text-muted ml-2 flex-1">{item.pickupLocation}</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons name="location-on" size={16} color="#9BA1A6" />
          <Text className="text-sm text-muted ml-2 flex-1">{item.dropoffLocation}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between pt-3 border-t border-border">
        <View>
          <Text className="text-xs text-muted mb-1">Driver</Text>
          <Text className="text-sm font-semibold text-foreground">{item.driver}</Text>
        </View>
        <View>
          <Text className="text-xs text-muted mb-1">Distance</Text>
          <Text className="text-sm font-semibold text-foreground">{item.distance} km</Text>
        </View>
        <View>
          <Text className="text-xs text-muted mb-1">ETA</Text>
          <Text className="text-sm font-semibold text-primary">{item.duration}</Text>
        </View>
      </View>

      {item.status === "in-transit" && (
        <TouchableOpacity className="bg-primary rounded-lg py-2 items-center mt-3">
          <View className="flex-row items-center">
            <MaterialIcons name="my-location" size={16} color="#fff" />
            <Text className="text-white font-semibold text-sm ml-2">Live Tracking</Text>
          </View>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-6 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Track Shipment</Text>
            <Text className="text-sm text-muted mt-1">Real-time tracking</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center"
          >
            <MaterialIcons name="close" size={20} color="#11181C" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
            <MaterialIcons name="search" size={20} color="#9BA1A6" />
            <TextInput
              placeholder="Search by tracking number or name"
              placeholderTextColor="#9BA1A6"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-3 text-foreground"
              style={{ fontSize: 16 }}
            />
            {searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MaterialIcons name="close" size={20} color="#9BA1A6" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Shipments List */}
        <View className="px-6">
          {filteredShipments.length > 0 ? (
            <>
              <Text className="text-lg font-semibold text-foreground mb-3">
                {filteredShipments.length} Shipment{filteredShipments.length !== 1 ? "s" : ""}
              </Text>
              <FlatList
                data={filteredShipments}
                renderItem={renderShipmentCard}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </>
          ) : (
            <View className="items-center justify-center py-12">
              <MaterialIcons name="inbox" size={48} color="#9BA1A6" />
              <Text className="text-muted text-base mt-4">
                {searchQuery ? "No shipments found" : "No shipments to track"}
              </Text>
              {searchQuery && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  className="mt-4"
                >
                  <Text className="text-primary font-semibold">Clear search</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Shipment Detail Modal */}
      {selectedShipment && (
        <View className="absolute inset-0 bg-black/50 items-end">
          <TouchableOpacity
            className="absolute inset-0"
            onPress={() => setSelectedShipment(null)}
          />
          <View className="bg-background w-full rounded-t-3xl p-6 max-h-4/5">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-bold text-foreground">
                {selectedShipment.trackingNumber}
              </Text>
              <TouchableOpacity onPress={() => setSelectedShipment(null)}>
                <MaterialIcons name="close" size={24} color="#11181C" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Status */}
              <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                <View
                  className="rounded-full px-3 py-1 flex-row items-center w-fit mb-3"
                  style={{
                    backgroundColor: `${getStatusColor(selectedShipment.status)}20`,
                  }}
                >
                  <MaterialIcons
                    name={getStatusIcon(selectedShipment.status) as any}
                    size={16}
                    color={getStatusColor(selectedShipment.status)}
                  />
                  <Text
                    className="text-sm font-semibold ml-2 capitalize"
                    style={{ color: getStatusColor(selectedShipment.status) }}
                  >
                    {selectedShipment.status.replace("-", " ")}
                  </Text>
                </View>
                <Text className="text-sm text-muted">
                  Last updated: {selectedShipment.lastUpdate}
                </Text>
              </View>

              {/* Locations */}
              <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                <Text className="text-sm font-semibold text-foreground mb-3">Locations</Text>
                <View className="gap-3">
                  <View>
                    <Text className="text-xs text-muted mb-1">Pickup</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {selectedShipment.pickupLocation}
                    </Text>
                  </View>
                  <View className="h-8 items-center">
                    <View className="w-1 h-full bg-primary" />
                  </View>
                  <View>
                    <Text className="text-xs text-muted mb-1">Current Location</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {selectedShipment.currentLocation}
                    </Text>
                  </View>
                  <View className="h-8 items-center">
                    <View className="w-1 h-full bg-primary" />
                  </View>
                  <View>
                    <Text className="text-xs text-muted mb-1">Dropoff</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {selectedShipment.dropoffLocation}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Driver & Vehicle */}
              <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                <Text className="text-sm font-semibold text-foreground mb-3">
                  Driver & Vehicle
                </Text>
                <View className="gap-3">
                  <View>
                    <Text className="text-xs text-muted mb-1">Driver</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {selectedShipment.driver}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-xs text-muted mb-1">Vehicle</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {selectedShipment.vehicle}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Delivery Details */}
              <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
                <Text className="text-sm font-semibold text-foreground mb-3">
                  Delivery Details
                </Text>
                <View className="gap-3">
                  <View className="flex-row justify-between">
                    <View>
                      <Text className="text-xs text-muted mb-1">Cargo Type</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {selectedShipment.cargoType}
                      </Text>
                    </View>
                    <View>
                      <Text className="text-xs text-muted mb-1">Distance</Text>
                      <Text className="text-sm font-semibold text-foreground">
                        {selectedShipment.distance} km
                      </Text>
                    </View>
                  </View>
                  <View>
                    <Text className="text-xs text-muted mb-1">Estimated Delivery</Text>
                    <Text className="text-sm font-semibold text-foreground">
                      {selectedShipment.estimatedDelivery}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              {selectedShipment.status === "in-transit" && (
                <TouchableOpacity className="bg-primary rounded-xl py-3 items-center mb-3">
                  <View className="flex-row items-center">
                    <MaterialIcons name="my-location" size={20} color="#fff" />
                    <Text className="text-white font-semibold text-base ml-2">
                      Live Tracking
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity className="bg-surface border border-border rounded-xl py-3 items-center">
                <View className="flex-row items-center">
                  <MaterialIcons name="phone" size={20} color="#0a7ea4" />
                  <Text className="text-primary font-semibold text-base ml-2">
                    Contact Driver
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
