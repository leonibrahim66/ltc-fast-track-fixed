import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { CrossPlatformMap } from "@/components/CrossPlatformMap";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { getStaticResponsive } from "@/hooks/use-responsive";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CollectorMapScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  
  const [region, setRegion] = useState({
    latitude: -15.4167,
    longitude: 28.2833,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Fetch zone details from backend
  const { data: zoneData, isLoading: zoneLoading, error: zoneError } = trpc.collector.getZoneDetails.useQuery(
    { collectorId: user?.id?.toString() || "0" },
    { enabled: !!user?.id }
  );

  // Fetch households in zone from backend
  const { data: householdsData, isLoading: householdsLoading } = trpc.collector.getZoneHouseholds.useQuery(
    { collectorId: user?.id?.toString() || "0" },
    { enabled: !!user?.id && zoneData?.assigned }
  );

  // Check if collector has assigned zone
  const hasAssignedZone = zoneData?.assigned || false;

  // Zone boundaries from backend
  const zoneCoordinates = zoneData?.zone?.boundaries || [];

  // Household markers from backend
  const householdMarkers = householdsData?.households || [];

  // Update map region when zone data is loaded
  useEffect(() => {
    if (zoneData?.zone?.center) {
      setRegion({
        latitude: zoneData.zone.center.latitude,
        longitude: zoneData.zone.center.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [zoneData]);

  useEffect(() => {
    if (!zoneLoading && !hasAssignedZone) {
      Alert.alert(
        "Zone Not Assigned",
        "You have not been assigned a collection zone yet. Please contact support for zone assignment.",
        [{ text: "OK" }]
      );
    }
  }, [hasAssignedZone, zoneLoading]);

  // Show loading state
  if (zoneLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { backgroundColor: colors.primary }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Route Map</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 16, color: colors.muted }}>Loading zone data...</Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Route Map</Text>
          <View style={{ width: 24 }} />
        </View>

        {hasAssignedZone ? (
          <>
            {/* Map */}
            <CrossPlatformMap
              latitude={region.latitude}
              longitude={region.longitude}
              latitudeDelta={region.latitudeDelta}
              longitudeDelta={region.longitudeDelta}
              markers={householdMarkers.map((marker: any) => ({
                id: marker.id,
                latitude: marker.latitude,
                longitude: marker.longitude,
                title: marker.name,
                description: "Tap for details",
              }))}
              polygonCoordinates={zoneCoordinates}
              onMarkerPress={(markerId) => {
                // Handle marker press
                console.log("Marker pressed:", markerId);
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
              style={styles.map}
            />

            {/* Zone Info Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: colors.primary + "20" }]}>
                  <MaterialIcons name="location-city" size={20} color={colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>
                    Your Assigned Zone
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {zoneData?.zone?.name || "N/A"}
                  </Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={[styles.infoIconContainer, { backgroundColor: "#10B981" + "20" }]}>
                  <MaterialIcons name="home-work" size={20} color="#10B981" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: colors.muted }]}>
                    Households in Zone
                  </Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {householdMarkers.length}
                  </Text>
                </View>
              </View>
            </View>

            {/* Legend */}
            <View style={[styles.legend, { backgroundColor: colors.surface }]}>
              <Text style={[styles.legendTitle, { color: colors.text }]}>Legend</Text>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#3B82F6", opacity: 0.3 }]} />
                <Text style={[styles.legendText, { color: colors.muted }]}>
                  Your assigned zone
                </Text>
              </View>
              <View style={styles.legendItem}>
                <MaterialIcons name="home" size={16} color="#10B981" />
                <Text style={[styles.legendText, { color: colors.muted, marginLeft: 4 }]}>
                  Household locations
                </Text>
              </View>
            </View>
          </>
        ) : (
          // No Zone Assigned View
          <View style={styles.noZoneContainer}>
            <View style={[styles.noZoneCard, { backgroundColor: colors.surface }]}>
              <View style={[styles.noZoneIconContainer, { backgroundColor: "#EF4444" + "20" }]}>
                <MaterialIcons name="location-off" size={48} color="#EF4444" />
              </View>
              <Text style={[styles.noZoneTitle, { color: colors.text }]}>
                Zone Not Assigned
              </Text>
              <Text style={[styles.noZoneDescription, { color: colors.muted }]}>
                You have not been assigned a collection zone yet. Please contact support or wait for zone assignment from the admin.
              </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.noZoneButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.noZoneButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(16),
  },
  backButton: {
    padding: _rs.sp(4),
  },
  headerTitle: {
    fontSize: _rs.fs(18),
    fontWeight: "600",
    color: "#fff",
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    backgroundColor: "#fff",
    padding: _rs.sp(4),
    borderRadius: _rs.s(20),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  infoCard: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    borderRadius: _rs.s(12),
    padding: _rs.sp(16),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: _rs.sp(12),
  },
  infoIconContainer: {
    width: _rs.s(40),
    height: _rs.s(40),
    borderRadius: _rs.s(20),
    alignItems: "center",
    justifyContent: "center",
    marginRight: _rs.sp(12),
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: _rs.fs(12),
    marginBottom: _rs.sp(2),
  },
  infoValue: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
  },
  legend: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: _rs.s(12),
    padding: _rs.sp(12),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontSize: _rs.fs(14),
    fontWeight: "600",
    marginBottom: _rs.sp(8),
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: _rs.sp(4),
  },
  legendColor: {
    width: _rs.s(16),
    height: _rs.s(16),
    borderRadius: _rs.s(4),
    marginRight: _rs.sp(8),
    borderWidth: 1,
    borderColor: "#3B82F6",
  },
  legendText: {
    fontSize: _rs.fs(12),
  },
  noZoneContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: _rs.sp(24),
  },
  noZoneCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: _rs.s(16),
    padding: _rs.sp(32),
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noZoneIconContainer: {
    width: _rs.s(96),
    height: _rs.s(96),
    borderRadius: _rs.s(48),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: _rs.sp(24),
  },
  noZoneTitle: {
    fontSize: _rs.fs(24),
    fontWeight: "700",
    marginBottom: _rs.sp(12),
    textAlign: "center",
  },
  noZoneDescription: {
    fontSize: _rs.fs(14),
    textAlign: "center",
    lineHeight: _rs.fs(20),
    marginBottom: _rs.sp(24),
  },
  noZoneButton: {
    paddingHorizontal: _rs.sp(32),
    paddingVertical: _rs.sp(12),
    borderRadius: _rs.s(24),
  },
  noZoneButtonText: {
    fontSize: _rs.fs(16),
    fontWeight: "600",
    color: "#fff",
  },
});
