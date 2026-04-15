import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePickups } from "@/lib/pickups-context";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
export default function CollectorPickupsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { pickups, refreshPickups } = usePickups();
  const [refreshing, setRefreshing] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // Filter pickups by zone_id (zone-based filtering)
  const zonePickups = pickups.filter((pickup) => {
    // TODO: Replace with backend zone filtering
    // Backend should filter pickups where pickup.zone_id == collector.zone_id
    // For now, show all pickups assigned to this collector
    return pickup.collectorId === user?.id && pickup.status !== "completed" && pickup.status !== "cancelled";
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPickups();
    setRefreshing(false);
  };

  const handleOptimizeRoute = async () => {
    if (zonePickups.length === 0) {
      Alert.alert("No Pickups", "You don't have any pending pickups to optimize.");
      return;
    }

    setOptimizing(true);
    try {
      // TODO: Trigger backend route optimization endpoint
      // POST /api/collector/optimize-route
      // Body: { collector_id, zone_id, pickup_ids }
      // Returns: { optimized_route: [pickup_id_1, pickup_id_2, ...], estimated_distance, estimated_time }
      
      // TODO: Integrate with Google Maps API for route optimization
      // - Calculate optimal route based on pickup locations
      // - Display route on map with turn-by-turn directions
      // - Show estimated time and distance
      
      Alert.alert(
        "Route Optimization",
        "Backend integration required:\n\n" +
        "• POST /api/collector/optimize-route\n" +
        "• Google Maps Directions API\n" +
        "• Returns optimized pickup sequence",
        [{ text: "OK" }]
      );
    } catch (e) {
      console.error("Error optimizing route:", e);
      Alert.alert("Error", "Failed to optimize route. Please try again.");
    } finally {
      setOptimizing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "in_progress":
        return "#3B82F6";
      case "completed":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      default:
        return "#9BA1A6";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "schedule";
      case "in_progress":
        return "local-shipping";
      case "completed":
        return "check-circle";
      case "cancelled":
        return "cancel";
      default:
        return "help";
    }
  };

  const renderPickup = ({ item }: { item: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/pickup-details/${item.id}` as any)}
      activeOpacity={0.7}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: `${getStatusColor(item.status)}15` },
          ]}
        >
          <MaterialIcons
            name={getStatusIcon(item.status) as any}
            size={16}
            color={getStatusColor(item.status)}
          />
          <Text
            style={[
              styles.statusText,
              { color: getStatusColor(item.status) },
            ]}
          >
            {item.status.replace("_", " ").toUpperCase()}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.muted} />
      </View>

      <View style={styles.cardContent}>
        <View style={styles.infoRow}>
          <MaterialIcons name="person" size={18} color={colors.muted} />
          <Text style={[styles.infoText, { color: colors.foreground }]}>
            {item.customerName || "Customer"}
          </Text>
        </View>

        {item.address && (
          <View style={styles.infoRow}>
            <MaterialIcons name="location-on" size={18} color={colors.muted} />
            <Text style={[styles.infoText, { color: colors.muted }]} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        )}

        {item.scheduledDate && (
          <View style={styles.infoRow}>
            <MaterialIcons name="event" size={18} color={colors.muted} />
            <Text style={[styles.infoText, { color: colors.muted }]}>
              {new Date(item.scheduledDate).toLocaleDateString()}
            </Text>
          </View>
        )}

        {item.wasteType && (
          <View style={styles.infoRow}>
            <MaterialIcons name="delete" size={18} color={colors.muted} />
            <Text style={[styles.infoText, { color: colors.muted }]}>
              {item.wasteType}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Pickups</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Zone Info & Route Optimization */}
      <View style={styles.topSection}>
        <View
          style={[
            styles.zoneCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.zoneInfo}>
            <MaterialIcons name="location-city" size={20} color={colors.primary} />
            <View style={styles.zoneText}>
              <Text style={[styles.zoneLabel, { color: colors.muted }]}>
                Your Zone
              </Text>
              <Text style={[styles.zoneName, { color: colors.foreground }]}>
                {user?.zone || "Zone not assigned"}
              </Text>
            </View>
          </View>
          <View style={styles.pickupCount}>
            <Text style={[styles.countNumber, { color: colors.primary }]}>
              {zonePickups.length}
            </Text>
            <Text style={[styles.countLabel, { color: colors.muted }]}>
              Pickups
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleOptimizeRoute}
          disabled={optimizing || zonePickups.length === 0}
          style={[
            styles.optimizeButton,
            { backgroundColor: colors.primary },
            (optimizing || zonePickups.length === 0) && { opacity: 0.5 },
          ]}
        >
          <MaterialIcons name="route" size={20} color="#FFFFFF" />
          <Text style={styles.optimizeButtonText}>
            {optimizing ? "Optimizing..." : "Optimize Route"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Pickups List */}
      <FlatList
        data={zonePickups}
        keyExtractor={(item) => item.id}
        renderItem={renderPickup}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="local-shipping" size={64} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              No pending pickups in your zone
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.muted }]}>
              Backend will filter pickups by zone_id
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(20),
    paddingTop: _rs.sp(16),
    borderBottomLeftRadius: _rs.s(24),
    borderBottomRightRadius: _rs.s(24),
    marginBottom: _rs.sp(16),
  },
  backButton: {
    padding: _rs.sp(4),
  },
  headerTitle: {
    fontSize: _rs.fs(20),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  topSection: {
    paddingHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(16),
    gap: _rs.sp(12),
  },
  zoneCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 1,
  },
  zoneInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(12),
    flex: 1,
  },
  zoneText: {
    flex: 1,
  },
  zoneLabel: {
    fontSize: _rs.fs(12),
    marginBottom: _rs.sp(2),
  },
  zoneName: {
    fontSize: _rs.fs(16),
    fontWeight: "700",
  },
  pickupCount: {
    alignItems: "center",
  },
  countNumber: {
    fontSize: _rs.fs(24),
    fontWeight: "700",
  },
  countLabel: {
    fontSize: _rs.fs(11),
  },
  optimizeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: _rs.sp(16),
    borderRadius: _rs.s(12),
    gap: _rs.sp(8),
  },
  optimizeButtonText: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    color: "#FFFFFF",
  },
  card: {
    marginHorizontal: _rs.sp(16),
    marginBottom: _rs.sp(12),
    padding: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: _rs.sp(12),
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
    borderRadius: _rs.s(8),
    gap: _rs.sp(6),
  },
  statusText: {
    fontSize: _rs.fs(12),
    fontWeight: "600",
  },
  cardContent: {
    gap: _rs.sp(8),
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(8),
  },
  infoText: {
    fontSize: _rs.fs(14),
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: _rs.sp(60),
    paddingHorizontal: _rs.sp(32),
  },
  emptyText: {
    fontSize: _rs.fs(16),
    marginTop: _rs.sp(16),
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: _rs.fs(13),
    marginTop: _rs.sp(8),
    textAlign: "center",
  },
});
