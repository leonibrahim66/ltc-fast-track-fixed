/**
 * Zone Create Screen
 *
 * Supports two boundary input methods:
 *   1. Map drawing — tap points on the map to draw a polygon (primary)
 *   2. Manual JSON input — existing fallback, kept intact
 *
 * Zone intelligence: boundaries are validated (≥ 3 points, valid bounding box)
 * before saving to @ltc_zones via AsyncStorage.
 */
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBoundingBox } from "@/lib/zone-boundary";
import { fetchPlaceCoordinates, generateZonePolygon } from "@/lib/zone-google-maps";

// Lusaka city center — default map region
const LUSAKA_CENTER = { latitude: -15.4166, longitude: 28.2833 };

// Radius steps for the polygon size selector
const RADIUS_STEPS = [0.005, 0.01, 0.02, 0.04, 0.06, 0.08, 0.1];
const RADIUS_LABELS = ["0.5km", "1km", "2km", "4km", "6km", "8km", "10km"];

interface DrawnPoint {
  latitude: number;
  longitude: number;
}

interface StoredZone {
  id: string;
  name: string;
  boundaries?: { lat: number; lng: number }[];
}

/** Convert stored {lat,lng} to MapView {latitude,longitude} */
function toMapPoints(stored: { lat: number; lng: number }[]): DrawnPoint[] {
  return stored.map((p) => ({ latitude: p.lat, longitude: p.lng }));
}

export default function ZoneCreateScreen() {
  const router = useRouter();
  const [zoneName, setZoneName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [boundaries, setBoundaries] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ── Map drawing state ────────────────────────────────────────────────────────
  const [points, setPoints] = useState<DrawnPoint[]>([]);
  const [otherZones, setOtherZones] = useState<StoredZone[]>([]);

  // ── Auto detect state ────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  /** Polygon radius in degrees. Default 0.02 ≈ 2 km. */
  const [radiusDeg, setRadiusDeg] = useState(0.02);
  /** Last auto-detected center — used to regenerate polygon when radius changes. */
  const lastDetectedCenter = useRef<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<any>(null);

  // Load all existing zones for background overlay
  useEffect(() => {
    const loadOtherZones = async () => {
      try {
        const raw = await AsyncStorage.getItem("@ltc_zones");
        const zones: any[] = raw ? JSON.parse(raw) : [];
        const withBoundaries: StoredZone[] = zones
          .filter((z) => z.boundaries && Array.isArray(z.boundaries) && z.boundaries.length >= 3)
          .map((z) => ({ id: z.id, name: z.name, boundaries: z.boundaries }));
        setOtherZones(withBoundaries);
      } catch (_e) {
        // Non-fatal: overlays simply won't show
      }
    };
    loadOtherZones();
  }, []);

  // Sync drawn points → boundaries JSON input whenever points change
  useEffect(() => {
    if (points.length === 0) return;
    const asZoneBoundaries = points.map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
    }));
    setBoundaries(JSON.stringify(asZoneBoundaries));
  }, [points]);

  const handleAddPoint = (coordinate: DrawnPoint) => {
    setPoints((prev) => [...prev, coordinate]);
  };

  const handleUndoLastPoint = () => {
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleClearDrawing = () => {
    setPoints([]);
    setBoundaries("");
  };

  // ── Auto detect handler ──────────────────────────────────────────────────────
  const handleAutoDetect = async () => {
    if (!searchText.trim()) {
      Alert.alert("Search required", "Please enter a location name to search.");
      return;
    }
    setIsLoadingLocation(true);
    try {
      const coords = await fetchPlaceCoordinates(searchText.trim());
      if (!coords) {
        Alert.alert("Not found", `Could not find "${searchText}". Try a more specific name.`);
        return;
      }
      lastDetectedCenter.current = coords;
      const polygon = generateZonePolygon(coords, radiusDeg);
      setPoints(polygon);
      mapRef.current?.animateToRegion({
        ...coords,
        latitudeDelta: radiusDeg * 3,
        longitudeDelta: radiusDeg * 3,
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to detect location. Check your API key.");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  /** Regenerate polygon when radius changes (only if a center was auto-detected). */
  const handleRadiusChange = (newRadius: number) => {
    setRadiusDeg(newRadius);
    if (!lastDetectedCenter.current) return;
    const polygon = generateZonePolygon(lastDetectedCenter.current, newRadius);
    setPoints(polygon);
  };

  // ── Existing save logic (unchanged) ─────────────────────────────────────────
  const handleSubmit = async () => {
    if (!zoneName.trim() || !city.trim()) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem("@ltc_zones");
      const zones: any[] = raw ? JSON.parse(raw) : [];
      let parsedBoundaries: any = undefined;
      if (boundaries.trim()) {
        try { parsedBoundaries = JSON.parse(boundaries); } catch (_e) { /* ignore */ }
      }

      // Zone intelligence: validate boundary points before saving
      if (parsedBoundaries !== undefined) {
        if (!Array.isArray(parsedBoundaries) || parsedBoundaries.length < 3) {
          Alert.alert("Invalid Boundaries", "Zone boundaries must include at least 3 coordinate points.");
          setIsLoading(false);
          return;
        }
        const box = getBoundingBox(parsedBoundaries);
        if (!box) {
          Alert.alert("Invalid Boundaries", "Could not compute a valid bounding box from the provided coordinates.");
          setIsLoading(false);
          return;
        }

        // Auto-close: ensure polygon is closed (first point === last point)
        const first = parsedBoundaries[0];
        const last = parsedBoundaries[parsedBoundaries.length - 1];
        if (first.lat !== last.lat || first.lng !== last.lng) {
          parsedBoundaries = [...parsedBoundaries, { ...first }];
        }
      }

      const newZone = {
        id: `zone_${Date.now()}`,
        name: zoneName.trim(),
        city: city.trim(),
        description: description.trim(),
        ...(parsedBoundaries !== undefined ? { boundaries: parsedBoundaries } : {}),
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      zones.push(newZone);
      await AsyncStorage.setItem("@ltc_zones", JSON.stringify(zones));
      Alert.alert("Success", "Zone created successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (_e) {
      Alert.alert("Error", "Failed to create zone. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Map section (native only — react-native-maps crashes on web) ─────────────
  const renderMapSection = () => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.webMapPlaceholder}>
          <MaterialIcons name="map" size={32} color="#9BA1A6" />
          <Text style={styles.webMapText}>
            Map drawing is available on iOS and Android.{"\n"}
            Use the JSON input below on web.
          </Text>
        </View>
      );
    }

    // Dynamic import to avoid web crash
    const MapView = require("react-native-maps").default;
    const { Polygon, Marker } = require("react-native-maps");

    return (
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            ...LUSAKA_CENTER,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          onPress={(e: any) => handleAddPoint(e.nativeEvent.coordinate)}
        >
          {/* Background polygons: all existing zones in grey */}
          {otherZones.map((zone) =>
            zone.boundaries && zone.boundaries.length >= 3 ? (
              <Polygon
                key={`other-${zone.id}`}
                coordinates={toMapPoints(zone.boundaries)}
                strokeColor="#9CA3AF"
                strokeWidth={1.5}
                fillColor="rgba(100,100,100,0.1)"
              />
            ) : null
          )}

          {/* Current drawing polygon — highlighted green */}
          {points.length >= 3 && (
            <Polygon
              coordinates={points}
              strokeColor="#16A34A"
              strokeWidth={2}
              fillColor="rgba(22, 163, 74, 0.15)"
            />
          )}

          {/* Markers for each tapped point */}
          {points.map((point, index) => (
            <Marker
              key={`point-${index}`}
              coordinate={point}
              title={`Point ${index + 1}`}
              pinColor={index === 0 ? "#16A34A" : "#EA580C"}
            />
          ))}
        </MapView>

        {/* Drawing controls overlay */}
        <View style={styles.mapControls}>
          <View style={styles.pointCountBadge}>
            <MaterialIcons name="place" size={14} color="#16A34A" />
            <Text style={styles.pointCountText}>
              {points.length} point{points.length !== 1 ? "s" : ""}
              {points.length >= 3 ? " ✓" : ` (${3 - points.length} more needed)`}
            </Text>
          </View>

          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={[styles.controlBtn, styles.undoBtn]}
              onPress={handleUndoLastPoint}
              disabled={points.length === 0}
            >
              <MaterialIcons
                name="undo"
                size={16}
                color={points.length === 0 ? "#9BA1A6" : "#1E40AF"}
              />
              <Text style={[styles.controlBtnText, points.length === 0 && styles.disabledText]}>
                Undo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, styles.clearBtn]}
              onPress={handleClearDrawing}
              disabled={points.length === 0}
            >
              <MaterialIcons
                name="clear"
                size={16}
                color={points.length === 0 ? "#9BA1A6" : "#DC2626"}
              />
              <Text style={[styles.controlBtnText, points.length === 0 && styles.disabledText, styles.clearBtnText]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tap hint */}
        <View style={styles.tapHint}>
          <MaterialIcons name="touch-app" size={14} color="#6B7280" />
          <Text style={styles.tapHintText}>Tap the map to add boundary points</Text>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View className="bg-green-600 px-6 pt-6 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3"
          >
            <MaterialIcons name="arrow-back" size={20} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Create New Zone</Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        {/* Zone Name */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-base mb-2">
            Zone Name <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            placeholder="e.g., Lusaka Central Zone A"
            value={zoneName}
            onChangeText={setZoneName}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* City */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-base mb-2">
            City <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            placeholder="e.g., Lusaka"
            value={city}
            onChangeText={setCity}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
          />
        </View>

        {/* Description */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-base mb-2">Description</Text>
          <TextInput
            placeholder="Brief description of the zone coverage area"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            style={{ textAlignVertical: "top" }}
          />
        </View>

        {/* ── Map Drawing Section ─────────────────────────────────────────────── */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-base mb-1">
            Draw Zone Boundary
          </Text>
          <Text className="text-muted text-sm mb-3">
            Search a location to auto-generate a zone, or tap the map to draw manually.
          </Text>

          {/* Auto detect search row */}
          <View className="flex-row items-center gap-2 mb-3">
            <TextInput
              placeholder="Search location (e.g. Kabulonga)"
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              onSubmitEditing={handleAutoDetect}
              className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            />
            <TouchableOpacity
              onPress={handleAutoDetect}
              disabled={isLoadingLocation}
              style={[
                styles.autoDetectBtn,
                isLoadingLocation && { opacity: 0.6 },
              ]}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <MaterialIcons name="my-location" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>

          {/* Auto Detect Zone label button */}
          <TouchableOpacity
            onPress={handleAutoDetect}
            disabled={isLoadingLocation}
            className={`bg-blue-600 rounded-xl py-3 items-center mb-3 flex-row justify-center gap-2 ${isLoadingLocation ? "opacity-60" : ""}`}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialIcons name="search" size={18} color="white" />
            )}
            <Text className="text-white font-semibold text-sm">
              {isLoadingLocation ? "Detecting..." : "Auto Detect Zone"}
            </Text>
          </TouchableOpacity>

          {/* Radius selector (shown only after auto-detect) */}
          {lastDetectedCenter.current !== null && (
            <View style={styles.radiusRow}>
              <MaterialIcons name="radio-button-unchecked" size={16} color="#6B7280" />
              <Text style={styles.radiusLabel}>
                Radius: {RADIUS_LABELS[RADIUS_STEPS.findIndex((r) => Math.abs(r - radiusDeg) < 0.001)] ?? `${(radiusDeg * 111).toFixed(1)}km`}
              </Text>
              <View style={styles.radiusSteps}>
                {RADIUS_STEPS.map((step, idx) => (
                  <TouchableOpacity
                    key={step}
                    style={[
                      styles.radiusStep,
                      Math.abs(step - radiusDeg) < 0.001 && styles.radiusStepActive,
                    ]}
                    onPress={() => handleRadiusChange(step)}
                  >
                    <Text
                      style={[
                        styles.radiusStepText,
                        Math.abs(step - radiusDeg) < 0.001 && styles.radiusStepTextActive,
                      ]}
                    >
                      {RADIUS_LABELS[idx]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {renderMapSection()}
        </View>

        {/* Boundaries — manual JSON fallback (kept intact) */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-base mb-2">
            Boundaries (JSON — auto-filled from map)
          </Text>
          <Text className="text-muted text-sm mb-2">
            Auto-filled when you draw on the map above. You can also enter coordinates manually.
          </Text>
          <TextInput
            placeholder='e.g., [{"lat": -15.4167, "lng": 28.2833}, ...]'
            value={boundaries}
            onChangeText={setBoundaries}
            multiline
            numberOfLines={4}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground font-mono text-xs"
            style={{ textAlignVertical: "top" }}
          />
        </View>

        {/* Info Box */}
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <View className="flex-row items-start">
            <MaterialIcons name="info" size={20} color="#3B82F6" />
            <View className="flex-1 ml-3">
              <Text className="text-blue-900 font-medium text-sm mb-1">Zone Creation Tips</Text>
              <Text className="text-blue-700 text-xs leading-5">
                • Tap the map to draw the zone boundary polygon{"\n"}
                • At least 3 points are required to define a zone{"\n"}
                • Ensure boundaries don't overlap with existing zones{"\n"}
                • You can assign zone managers and households after creation
              </Text>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isLoading}
          className={`bg-green-600 rounded-xl py-4 items-center ${isLoading ? "opacity-50" : ""}`}
        >
          <Text className="text-white font-bold text-base">
            {isLoading ? "Creating Zone..." : "Create Zone"}
          </Text>
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface border border-border rounded-xl py-4 items-center mt-3 mb-6"
        >
          <Text className="text-foreground font-semibold text-base">Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // ── Map container ────────────────────────────────────────────────────────────
  mapContainer: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  map: {
    width: "100%",
    height: 280,
  },
  // ── Controls overlay ─────────────────────────────────────────────────────────
  mapControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  pointCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pointCountText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  controlButtons: {
    flexDirection: "row",
    gap: 8,
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  undoBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  clearBtn: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  controlBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E40AF",
  },
  clearBtnText: {
    color: "#DC2626",
  },
  disabledText: {
    color: "#9BA1A6",
  },
  // ── Tap hint ─────────────────────────────────────────────────────────────────
  tapHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  tapHintText: {
    fontSize: 11,
    color: "#6B7280",
  },
  // ── Auto detect icon button ───────────────────────────────────────────────
  autoDetectBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Radius selector ────────────────────────────────────────────────────────
  radiusRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap" as const,
  },
  radiusLabel: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500" as const,
    minWidth: 70,
  },
  radiusSteps: {
    flexDirection: "row" as const,
    gap: 4,
    flexWrap: "wrap" as const,
    flex: 1,
  },
  radiusStep: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
  },
  radiusStepActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  radiusStepText: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500" as const,
  },
  radiusStepTextActive: {
    color: "#1D4ED8",
  },
  // ── Web fallback ─────────────────────────────────────────────────────────────
  webMapPlaceholder: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  webMapText: {
    fontSize: 13,
    color: "#9BA1A6",
    textAlign: "center",
    lineHeight: 20,
  },
});
