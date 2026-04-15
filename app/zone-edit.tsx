/**
 * Zone Edit Screen
 *
 * Loads the real zone from AsyncStorage using the zoneId param.
 * Supports two boundary editing methods:
 *   1. Map drawing — tap to add points, drag markers to adjust, Undo/Clear controls
 *   2. Manual JSON input — existing fallback, kept intact
 *
 * Zone intelligence:
 *   - Existing zone boundaries are pre-loaded as draggable markers
 *   - All other zones are shown as grey background polygons
 *   - Polygon is auto-closed (first point appended) on save if not already closed
 *   - Boundaries are validated (≥ 3 points, valid bounding box) before saving
 *
 * Auto-detect:
 *   - Search field + icon button calls fetchPlaceCoordinates → generateZonePolygon
 *   - Radius selector (7 steps: 0.5 km – 10 km) regenerates polygon on tap
 *   - Manual drawing still works independently
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBoundingBox } from "@/lib/zone-boundary";
import { fetchPlaceCoordinates, generateZonePolygon } from "@/lib/zone-google-maps";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrawnPoint {
  latitude: number;
  longitude: number;
}

interface StoredZone {
  id: string;
  name: string;
  boundaries?: { lat: number; lng: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert stored {lat,lng} format to MapView {latitude,longitude} format */
function toMapPoints(stored: { lat: number; lng: number }[]): DrawnPoint[] {
  return stored.map((p) => ({ latitude: p.lat, longitude: p.lng }));
}

/** Convert MapView {latitude,longitude} format back to stored {lat,lng} format */
function toStoredPoints(drawn: DrawnPoint[]): { lat: number; lng: number }[] {
  return drawn.map((p) => ({ lat: p.latitude, lng: p.longitude }));
}

/**
 * Ensure the polygon is closed: if first and last point differ, append first point.
 * Prevents double-closure if already closed.
 */
function ensureClosed(points: DrawnPoint[]): DrawnPoint[] {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.latitude === last.latitude && first.longitude === last.longitude) {
    return points; // already closed
  }
  return [...points, { ...first }];
}

// Lusaka city center — default map region when no existing boundaries
const LUSAKA_CENTER = { latitude: -15.4166, longitude: 28.2833 };

// Radius steps for the polygon size selector
const RADIUS_STEPS = [0.005, 0.01, 0.02, 0.04, 0.06, 0.08, 0.1];
const RADIUS_LABELS = ["0.5km", "1km", "2km", "4km", "6km", "8km", "10km"];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ZoneEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const zoneId = params.id as string;

  // ── Form state ────────────────────────────────────────────────────────────
  const [zoneName, setZoneName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [boundaries, setBoundaries] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // ── Map drawing state ─────────────────────────────────────────────────────
  const [points, setPoints] = useState<DrawnPoint[]>([]);
  const [otherZones, setOtherZones] = useState<StoredZone[]>([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: LUSAKA_CENTER.latitude,
    longitude: LUSAKA_CENTER.longitude,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // ── Auto-detect state ─────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  /** Polygon radius in degrees. Default 0.02 ≈ 2 km. */
  const [radiusDeg, setRadiusDeg] = useState(0.02);
  /** Last auto-detected center — used to regenerate polygon when radius changes. */
  const lastDetectedCenter = useRef<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<any>(null);

  // ── Sync drawn points → boundaries JSON input ─────────────────────────────
  useEffect(() => {
    if (points.length === 0) return;
    setBoundaries(JSON.stringify(toStoredPoints(points)));
  }, [points]);

  // ── Load zone data from AsyncStorage ──────────────────────────────────────
  useEffect(() => {
    const loadZone = async () => {
      try {
        const raw = await AsyncStorage.getItem("@ltc_zones");
        const zones: any[] = raw ? JSON.parse(raw) : [];
        const zone = zones.find((z) => z.id === zoneId);

        if (zone) {
          setZoneName(zone.name || "");
          setCity(zone.city || zone.town || "");
          setDescription(zone.description || "");

          // Load existing boundaries into map drawing state
          if (zone.boundaries && Array.isArray(zone.boundaries) && zone.boundaries.length > 0) {
            const mapped = toMapPoints(zone.boundaries);
            setPoints(mapped);
            setBoundaries(JSON.stringify(zone.boundaries));

            // Center map on the zone's first point
            setMapRegion({
              latitude: mapped[0].latitude,
              longitude: mapped[0].longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            });
          } else {
            setBoundaries("");
          }

          // Load all other zones for background overlay
          const others: StoredZone[] = zones
            .filter(
              (z) =>
                z.id !== zoneId &&
                z.boundaries &&
                Array.isArray(z.boundaries) &&
                z.boundaries.length >= 3
            )
            .map((z) => ({ id: z.id, name: z.name, boundaries: z.boundaries }));
          setOtherZones(others);
        } else {
          Alert.alert("Error", "Zone not found.", [{ text: "OK", onPress: () => router.back() }]);
        }
      } catch (_e) {
        Alert.alert("Error", "Failed to load zone data.");
      } finally {
        setIsFetching(false);
      }
    };
    if (zoneId) loadZone();
    else setIsFetching(false);
  }, [zoneId]);

  // ── Drawing controls ───────────────────────────────────────────────────────
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

  const handleMarkerDragEnd = useCallback((index: number, coordinate: DrawnPoint) => {
    setPoints((prev) => {
      const updated = [...prev];
      updated[index] = coordinate;
      return updated;
    });
  }, []);

  // ── Auto-detect handler ────────────────────────────────────────────────────
  const handleAutoDetect = async () => {
    if (!searchText.trim()) return;
    setIsLoadingLocation(true);
    try {
      const coords = await fetchPlaceCoordinates(searchText.trim());
      if (!coords) {
        Alert.alert("Location Not Found", `Could not find "${searchText.trim()}"`);
        return;
      }
      lastDetectedCenter.current = coords;
      const polygon = generateZonePolygon(coords, radiusDeg);
      setPoints(polygon);
      const region = {
        ...coords,
        latitudeDelta: radiusDeg * 3,
        longitudeDelta: radiusDeg * 3,
      };
      setMapRegion(region);
      if (mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion(region, 600);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Auto detect failed.");
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

  // ── Save logic (unchanged, with auto-close and validation) ────────────────
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
        try {
          parsedBoundaries = JSON.parse(boundaries);
        } catch (_e) {
          /* ignore malformed JSON */
        }
      }

      // Zone intelligence: validate boundary points before saving
      if (parsedBoundaries !== undefined) {
        if (!Array.isArray(parsedBoundaries) || parsedBoundaries.length < 3) {
          Alert.alert(
            "Invalid Boundaries",
            "Zone boundaries must include at least 3 coordinate points."
          );
          setIsLoading(false);
          return;
        }
        const box = getBoundingBox(parsedBoundaries);
        if (!box) {
          Alert.alert(
            "Invalid Boundaries",
            "Could not compute a valid bounding box from the provided coordinates."
          );
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

      const updated = zones.map((z) =>
        z.id === zoneId
          ? {
              ...z,
              name: zoneName.trim(),
              city: city.trim(),
              description: description.trim(),
              ...(parsedBoundaries !== undefined ? { boundaries: parsedBoundaries } : {}),
              updatedAt: new Date().toISOString(),
            }
          : z
      );
      await AsyncStorage.setItem("@ltc_zones", JSON.stringify(updated));
      Alert.alert("Success", "Zone updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (_e) {
      Alert.alert("Error", "Failed to update zone. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Map section (native only) ──────────────────────────────────────────────
  const renderMapSection = () => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.webMapPlaceholder}>
          <MaterialIcons name="map" size={32} color="#9BA1A6" />
          <Text style={styles.webMapText}>
            Map editing is available on iOS and Android.{"\n"}
            Use the JSON input below on web.
          </Text>
        </View>
      );
    }

    const MapView = require("react-native-maps").default;
    const { Polygon, Marker } = require("react-native-maps");

    const currentStepIdx = RADIUS_STEPS.findIndex((r) => Math.abs(r - radiusDeg) < 0.001);
    const displayRadius =
      currentStepIdx >= 0 ? RADIUS_LABELS[currentStepIdx] : `${(radiusDeg * 111).toFixed(1)}km`;

    return (
      <View>
        {/* ── Auto-detect search row ──────────────────────────────────────── */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search location to re-center zone…"
            placeholderTextColor="#9BA1A6"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            onSubmitEditing={handleAutoDetect}
          />
          <TouchableOpacity
            style={[styles.autoDetectBtn, isLoadingLocation && { opacity: 0.6 }]}
            onPress={handleAutoDetect}
            disabled={isLoadingLocation}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <MaterialIcons name="my-location" size={22} color="white" />
            )}
          </TouchableOpacity>
        </View>

        {/* ── Radius selector (visible only after auto-detect) ─────────────── */}
        {lastDetectedCenter.current !== null && (
          <View style={styles.radiusRow}>
            <MaterialIcons name="radio-button-unchecked" size={16} color="#6B7280" />
            <Text style={styles.radiusLabel}>Radius: {displayRadius}</Text>
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

        {/* ── Map ─────────────────────────────────────────────────────────── */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
            onPress={(e: any) => handleAddPoint(e.nativeEvent.coordinate)}
          >
            {/* Background polygons: all other zones in grey */}
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

            {/* Current zone polygon — highlighted green */}
            {points.length >= 3 && (
              <Polygon
                coordinates={ensureClosed(points)}
                strokeColor="#16A34A"
                strokeWidth={2.5}
                fillColor="rgba(22, 163, 74, 0.15)"
              />
            )}

            {/* Draggable markers for each point */}
            {points.map((point, index) => (
              <Marker
                key={`point-${index}`}
                coordinate={point}
                title={`Point ${index + 1}`}
                pinColor={index === 0 ? "#16A34A" : "#EA580C"}
                draggable
                onDragEnd={(e: any) => handleMarkerDragEnd(index, e.nativeEvent.coordinate)}
              />
            ))}
          </MapView>

          {/* Drawing controls */}
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
                <Text
                  style={[styles.controlBtnText, points.length === 0 && styles.disabledText]}
                >
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
                <Text
                  style={[
                    styles.controlBtnText,
                    points.length === 0 && styles.disabledText,
                    styles.clearBtnText,
                  ]}
                >
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tap hint */}
          <View style={styles.tapHint}>
            <MaterialIcons name="touch-app" size={14} color="#6B7280" />
            <Text style={styles.tapHintText}>Tap to add · Drag markers to adjust</Text>
          </View>
        </View>
      </View>
    );
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isFetching) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#16A34A" />
          <Text className="text-muted mt-3">Loading zone...</Text>
        </View>
      </ScreenContainer>
    );
  }

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
          <Text className="text-white text-2xl font-bold">Edit Zone</Text>
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
            returnKeyType="next"
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
            returnKeyType="next"
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

        {/* ── Map Drawing Section ──────────────────────────────────────────── */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-base mb-1">
            Edit Zone Boundary
          </Text>
          <Text className="text-muted text-sm mb-3">
            Search a location to auto-detect a zone, or tap the map to draw manually. Drag
            markers to adjust. Other zones shown in grey.
          </Text>
          {renderMapSection()}
        </View>

        {/* Boundaries — manual JSON fallback (kept intact) */}
        <View className="mb-5">
          <Text className="text-foreground font-semibold text-base mb-2">
            Boundaries (JSON — auto-filled from map)
          </Text>
          <Text className="text-muted text-sm mb-2">
            Auto-filled when you edit on the map above. You can also enter coordinates manually.
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

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isLoading}
          className={`bg-green-600 rounded-xl py-4 items-center ${isLoading ? "opacity-50" : ""}`}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-bold text-base">Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-surface border border-border rounded-xl py-4 items-center mt-3 mb-8"
        >
          <Text className="text-foreground font-semibold text-base">Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // ── Search row ───────────────────────────────────────────────────────────────
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#11181C",
  },
  autoDetectBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Radius selector ──────────────────────────────────────────────────────────
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  radiusLabel: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
    minWidth: 70,
  },
  radiusSteps: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
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
    fontWeight: "500",
  },
  radiusStepTextActive: {
    color: "#1D4ED8",
  },
  // ── Map container ────────────────────────────────────────────────────────────
  mapContainer: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  map: {
    width: "100%",
    height: 300,
  },
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
