import { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAdmin } from "@/lib/admin-context";
import { usePickups, Pickup } from "@/lib/pickups-context";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");

// Simulated collector locations
const COLLECTOR_LOCATIONS = [
  { id: "c1", name: "John M.", lat: -15.4067, lng: 28.2871, status: "active", pickups: 3 },
  { id: "c2", name: "Peter K.", lat: -15.4120, lng: 28.2950, status: "active", pickups: 2 },
  { id: "c3", name: "Mary S.", lat: -15.3980, lng: 28.3020, status: "busy", pickups: 5 },
  { id: "c4", name: "David L.", lat: -15.4200, lng: 28.2800, status: "offline", pickups: 0 },
];

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  pending: { color: "#F59E0B", label: "Pending", icon: "schedule" },
  accepted: { color: "#3B82F6", label: "Accepted", icon: "check-circle" },
  "in-progress": { color: "#8B5CF6", label: "In Progress", icon: "local-shipping" },
  completed: { color: "#22C55E", label: "Completed", icon: "done-all" },
  cancelled: { color: "#EF4444", label: "Cancelled", icon: "cancel" },
};

const COLLECTOR_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: "#22C55E", label: "Active" },
  busy: { color: "#F59E0B", label: "Busy" },
  offline: { color: "#6B7280", label: "Offline" },
};

export default function AdminPickupsMapScreen() {
  const router = useRouter();
  const { isAdminAuthenticated } = useAdmin();
  const { pickups } = usePickups();
  // Get user info from pickup data directly

  const [selectedPickup, setSelectedPickup] = useState<Pickup | null>(null);
  const [selectedCollector, setSelectedCollector] = useState<typeof COLLECTOR_LOCATIONS[0] | null>(null);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showCollectorModal, setShowCollectorModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showLegend, setShowLegend] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simulated map center (Lusaka)
  const mapCenter = { lat: -15.4067, lng: 28.2871 };

  useEffect(() => {
    if (!isAdminAuthenticated) {
      router.replace("/admin-login");
    }
    // Set loading to false immediately since data comes from context
    setIsLoading(false);
  }, [isAdminAuthenticated]);

  const activePickups = pickups.filter((p) => 
    p.status !== "completed" && p.status !== "cancelled"
  );

  const filteredPickups = filterStatus === "all" 
    ? activePickups 
    : activePickups.filter((p) => p.status === filterStatus);

  const handlePickupPress = (pickup: Pickup) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedPickup(pickup);
    setShowPickupModal(true);
  };

  const handleCollectorPress = (collector: typeof COLLECTOR_LOCATIONS[0]) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedCollector(collector);
    setShowCollectorModal(true);
  };

  const getPickupPosition = (index: number, total: number) => {
    // Distribute pickups in a grid pattern on the simulated map
    const cols = Math.ceil(Math.sqrt(total));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const cellWidth = (width - 80) / cols;
    const cellHeight = (height * 0.5) / Math.ceil(total / cols);
    return {
      left: 40 + col * cellWidth + cellWidth / 2 - 15,
      top: 60 + row * cellHeight + cellHeight / 2 - 15,
    };
  };

  const getCollectorPosition = (index: number) => {
    // Position collectors around the edges
    const positions = [
      { left: 60, top: 100 },
      { left: width - 100, top: 150 },
      { left: 80, top: height * 0.35 },
      { left: width - 120, top: height * 0.4 },
    ];
    return positions[index % positions.length];
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-4 pb-2 bg-primary">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center mr-3"
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text className="text-white text-xl font-bold">Live Pickups Map</Text>
              <Text className="text-white/80 text-sm">
                {filteredPickups.length} active pickups • {COLLECTOR_LOCATIONS.filter(c => c.status !== "offline").length} collectors online
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowLegend(!showLegend)}
            className="w-10 h-10 rounded-full bg-white/20 items-center justify-center"
          >
            <MaterialIcons name="info" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="px-4 py-3 border-b border-border bg-background"
      >
        <TouchableOpacity
          onPress={() => setFilterStatus("all")}
          className={`px-4 py-2 rounded-full mr-2 ${
            filterStatus === "all" ? "bg-primary" : "bg-surface border border-border"
          }`}
        >
          <Text className={filterStatus === "all" ? "text-white font-semibold" : "text-foreground"}>
            All ({activePickups.length})
          </Text>
        </TouchableOpacity>
        {Object.entries(STATUS_CONFIG).slice(0, 3).map(([status, config]) => {
          const count = activePickups.filter(p => p.status === status).length;
          return (
            <TouchableOpacity
              key={status}
              onPress={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
                filterStatus === status ? "bg-primary" : "bg-surface border border-border"
              }`}
            >
              <View
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: config.color }}
              />
              <Text className={filterStatus === status ? "text-white font-semibold" : "text-foreground"}>
                {config.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Map View (Simulated) */}
      <View className="flex-1 bg-surface relative">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#22C55E" />
            <Text className="text-muted mt-2">Loading map...</Text>
          </View>
        ) : (
          <>
            {/* Grid background to simulate map */}
            <View className="absolute inset-0 opacity-10">
              {[...Array(10)].map((_, i) => (
                <View
                  key={`h-${i}`}
                  className="absolute left-0 right-0 border-t border-foreground"
                  style={{ top: i * (height * 0.06) }}
                />
              ))}
              {[...Array(8)].map((_, i) => (
                <View
                  key={`v-${i}`}
                  className="absolute top-0 bottom-0 border-l border-foreground"
                  style={{ left: i * (width / 7) }}
                />
              ))}
            </View>

            {/* Map Label */}
            <View className="absolute top-4 left-4 bg-background/90 px-3 py-2 rounded-lg">
              <Text className="text-foreground font-semibold">Lusaka, Zambia</Text>
              <Text className="text-muted text-xs">Real-time tracking view</Text>
            </View>

            {/* Pickup Markers */}
            {filteredPickups.map((pickup, index) => {
              const position = getPickupPosition(index, filteredPickups.length);
              const config = STATUS_CONFIG[pickup.status] || STATUS_CONFIG.pending;
              return (
                <TouchableOpacity
                  key={pickup.id}
                  onPress={() => handlePickupPress(pickup)}
                  className="absolute items-center"
                  style={{ left: position.left, top: position.top }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center shadow-lg"
                    style={{ backgroundColor: config.color }}
                  >
                    <MaterialIcons name="delete" size={20} color="#fff" />
                  </View>
                  <View
                    className="absolute -bottom-1 w-0 h-0"
                    style={{
                      borderLeftWidth: 6,
                      borderRightWidth: 6,
                      borderTopWidth: 8,
                      borderLeftColor: "transparent",
                      borderRightColor: "transparent",
                      borderTopColor: config.color,
                    }}
                  />
                </TouchableOpacity>
              );
            })}

            {/* Collector Markers */}
            {COLLECTOR_LOCATIONS.map((collector, index) => {
              const position = getCollectorPosition(index);
              const config = COLLECTOR_STATUS_CONFIG[collector.status];
              return (
                <TouchableOpacity
                  key={collector.id}
                  onPress={() => handleCollectorPress(collector)}
                  className="absolute items-center"
                  style={{ left: position.left, top: position.top }}
                >
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center border-3 bg-background shadow-lg"
                    style={{ borderColor: config.color, borderWidth: 3 }}
                  >
                    <MaterialIcons name="local-shipping" size={22} color={config.color} />
                  </View>
                  <View className="bg-background px-2 py-0.5 rounded-full mt-1 shadow">
                    <Text className="text-foreground text-xs font-medium">{collector.name}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Legend Panel */}
            {showLegend && (
              <View className="absolute top-4 right-4 bg-background rounded-xl p-4 shadow-lg w-48">
                <Text className="text-foreground font-bold mb-3">Map Legend</Text>
                
                <Text className="text-muted text-xs mb-2">PICKUP STATUS</Text>
                {Object.entries(STATUS_CONFIG).slice(0, 4).map(([status, config]) => (
                  <View key={status} className="flex-row items-center mb-2">
                    <View
                      className="w-4 h-4 rounded-full mr-2"
                      style={{ backgroundColor: config.color }}
                    />
                    <Text className="text-foreground text-sm">{config.label}</Text>
                  </View>
                ))}

                <Text className="text-muted text-xs mb-2 mt-3">COLLECTOR STATUS</Text>
                {Object.entries(COLLECTOR_STATUS_CONFIG).map(([status, config]) => (
                  <View key={status} className="flex-row items-center mb-2">
                    <View
                      className="w-4 h-4 rounded-full border-2 mr-2"
                      style={{ borderColor: config.color }}
                    />
                    <Text className="text-foreground text-sm">{config.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Stats Bar */}
            <View className="absolute bottom-4 left-4 right-4 bg-background rounded-xl p-4 shadow-lg">
              <View className="flex-row justify-between">
                <View className="items-center flex-1">
                  <Text className="text-2xl font-bold text-primary">{filteredPickups.length}</Text>
                  <Text className="text-muted text-xs">Active Pickups</Text>
                </View>
                <View className="items-center flex-1 border-l border-border">
                  <Text className="text-2xl font-bold text-green-500">
                    {COLLECTOR_LOCATIONS.filter(c => c.status === "active").length}
                  </Text>
                  <Text className="text-muted text-xs">Available</Text>
                </View>
                <View className="items-center flex-1 border-l border-border">
                  <Text className="text-2xl font-bold text-yellow-500">
                    {COLLECTOR_LOCATIONS.filter(c => c.status === "busy").length}
                  </Text>
                  <Text className="text-muted text-xs">Busy</Text>
                </View>
                <View className="items-center flex-1 border-l border-border">
                  <Text className="text-2xl font-bold text-foreground">
                    {activePickups.filter(p => p.status === "pending").length}
                  </Text>
                  <Text className="text-muted text-xs">Unassigned</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </View>

      {/* Pickup Detail Modal */}
      <Modal
        visible={showPickupModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPickupModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl p-6 max-h-[70%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground text-xl font-bold">Pickup Details</Text>
              <TouchableOpacity onPress={() => setShowPickupModal(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedPickup && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Status Badge */}
                <View className="flex-row items-center mb-4">
                  <View
                    className="px-3 py-1 rounded-full flex-row items-center"
                    style={{ backgroundColor: `${STATUS_CONFIG[selectedPickup.status]?.color}20` }}
                  >
                    <MaterialIcons
                      name={STATUS_CONFIG[selectedPickup.status]?.icon as any}
                      size={16}
                      color={STATUS_CONFIG[selectedPickup.status]?.color}
                    />
                    <Text
                      className="ml-1 font-semibold"
                      style={{ color: STATUS_CONFIG[selectedPickup.status]?.color }}
                    >
                      {STATUS_CONFIG[selectedPickup.status]?.label}
                    </Text>
                  </View>
                  <Text className="text-muted text-sm ml-auto">
                    {formatTimeAgo(selectedPickup.createdAt)}
                  </Text>
                </View>

                {/* Customer Info */}
                <View className="bg-surface rounded-xl p-4 mb-4">
                  <Text className="text-muted text-xs mb-1">CUSTOMER</Text>
                  <Text className="text-foreground font-semibold text-lg">
                    {selectedPickup.userName || "Unknown Customer"}
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <MaterialIcons name="location-on" size={14} color="#6B7280" />
                    <Text className="text-muted text-sm ml-1">{selectedPickup.location?.address || `${selectedPickup.location?.latitude?.toFixed(4)}, ${selectedPickup.location?.longitude?.toFixed(4)}`}</Text>
                  </View>
                </View>

                {/* Pickup Info */}
                <View className="bg-surface rounded-xl p-4 mb-4">
                  <View className="flex-row justify-between mb-3">
                    <View>
                      <Text className="text-muted text-xs">BIN TYPE</Text>
                      <Text className="text-foreground font-semibold">{selectedPickup.binType}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-muted text-xs">SCHEDULED</Text>
                      <Text className="text-foreground font-semibold">
                        {selectedPickup.scheduledDate || "ASAP"}
                      </Text>
                    </View>
                  </View>
                  {selectedPickup.notes && (
                    <View>
                      <Text className="text-muted text-xs">NOTES</Text>
                      <Text className="text-foreground">{selectedPickup.notes}</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setShowPickupModal(false)}
                    className="flex-1 bg-primary py-3 rounded-xl items-center"
                  >
                    <Text className="text-white font-semibold">Assign Collector</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowPickupModal(false)}
                    className="flex-1 bg-surface border border-border py-3 rounded-xl items-center"
                  >
                    <Text className="text-foreground font-semibold">View Full Details</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Collector Detail Modal */}
      <Modal
        visible={showCollectorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCollectorModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-foreground text-xl font-bold">Collector Details</Text>
              <TouchableOpacity onPress={() => setShowCollectorModal(false)}>
                <MaterialIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedCollector && (
              <>
                <View className="flex-row items-center mb-4">
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${COLLECTOR_STATUS_CONFIG[selectedCollector.status].color}20` }}
                  >
                    <MaterialIcons
                      name="person"
                      size={32}
                      color={COLLECTOR_STATUS_CONFIG[selectedCollector.status].color}
                    />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text className="text-foreground text-xl font-bold">{selectedCollector.name}</Text>
                    <View
                      className="px-2 py-1 rounded-full self-start mt-1"
                      style={{ backgroundColor: `${COLLECTOR_STATUS_CONFIG[selectedCollector.status].color}20` }}
                    >
                      <Text
                        className="text-xs font-semibold"
                        style={{ color: COLLECTOR_STATUS_CONFIG[selectedCollector.status].color }}
                      >
                        {COLLECTOR_STATUS_CONFIG[selectedCollector.status].label}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="bg-surface rounded-xl p-4 mb-4">
                  <View className="flex-row justify-between">
                    <View className="items-center flex-1">
                      <Text className="text-2xl font-bold text-primary">{selectedCollector.pickups}</Text>
                      <Text className="text-muted text-xs">Active Pickups</Text>
                    </View>
                    <View className="items-center flex-1 border-l border-border">
                      <Text className="text-2xl font-bold text-foreground">4.8</Text>
                      <Text className="text-muted text-xs">Rating</Text>
                    </View>
                    <View className="items-center flex-1 border-l border-border">
                      <Text className="text-2xl font-bold text-foreground">156</Text>
                      <Text className="text-muted text-xs">Completed</Text>
                    </View>
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setShowCollectorModal(false)}
                    className="flex-1 bg-primary py-3 rounded-xl items-center"
                  >
                    <Text className="text-white font-semibold">Contact Collector</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowCollectorModal(false)}
                    className="flex-1 bg-surface border border-border py-3 rounded-xl items-center"
                  >
                    <Text className="text-foreground font-semibold">View Profile</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
