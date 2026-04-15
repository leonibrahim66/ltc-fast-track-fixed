import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

/**
 * Zone Creation Component
 * Allows zone admins to create zones by:
 * 1. Drawing boundaries on a map
 * 2. Auto-detecting zone boundaries by name
 */

interface ZoneCreationProps {
  onZoneCreated?: (zoneId: number) => void;
  onCancel?: () => void;
}

type CreationMethod = "drawing" | "name_detection";

export function ZoneCreationScreen({ onZoneCreated, onCancel }: ZoneCreationProps) {
  const colors = useColors();
  const [method, setMethod] = useState<CreationMethod>("drawing");
  const [zoneName, setZoneName] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [drawnCoordinates, setDrawnCoordinates] = useState<[number, number][]>([]);
  const [geometryType, setGeometryType] = useState<"polygon" | "circle" | "point">("polygon");
  const [centerLat, setCenterLat] = useState("");
  const [centerLng, setCenterLng] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("");

  /**
   * Handle zone creation by drawing
   */
  const handleCreateByDrawing = async () => {
    if (!zoneName || !city || drawnCoordinates.length < 3) {
      Alert.alert("Error", "Please fill all required fields and draw at least 3 points");
      return;
    }

    setLoading(true);
    try {
      // Call API to create zone with drawn boundaries
      // const response = await trpc.zoneAdmin.createZoneByDrawing.mutate({
      //   name: zoneName,
      //   city,
      //   description,
      //   geometryType,
      //   coordinates: drawnCoordinates,
      //   centerLat: centerLat ? parseFloat(centerLat) : undefined,
      //   centerLng: centerLng ? parseFloat(centerLng) : undefined,
      //   radiusMeters: radiusMeters ? parseFloat(radiusMeters) : undefined,
      // });

      Alert.alert("Success", "Zone created successfully from map drawing");
      onZoneCreated?.(1); // Replace with actual zoneId from response
    } catch (error) {
      Alert.alert("Error", "Failed to create zone");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle zone creation by name detection
   */
  const handleCreateByNameDetection = async () => {
    if (!zoneName || !city) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      // Call API to create zone with auto-detected boundaries
      // const response = await trpc.zoneAdmin.createZoneByNameDetection.mutate({
      //   name: zoneName,
      //   city,
      //   description,
      //   detectedCoordinates: [], // Auto-detected by backend
      //   centerLat: parseFloat(centerLat),
      //   centerLng: parseFloat(centerLng),
      //   radiusMeters: parseFloat(radiusMeters),
      // });

      Alert.alert("Success", "Zone created successfully from name detection");
      onZoneCreated?.(1); // Replace with actual zoneId from response
    } catch (error) {
      Alert.alert("Error", "Failed to create zone");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add point to drawn coordinates
   */
  const handleAddPoint = (lat: number, lng: number) => {
    setDrawnCoordinates([...drawnCoordinates, [lat, lng]]);
  };

  /**
   * Undo last point
   */
  const handleUndoPoint = () => {
    if (drawnCoordinates.length > 0) {
      setDrawnCoordinates(drawnCoordinates.slice(0, -1));
    }
  };

  /**
   * Clear all points
   */
  const handleClearPoints = () => {
    setDrawnCoordinates([]);
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Create Zone</Text>
            <Text className="text-base text-muted">
              Define zone boundaries for garbage collection
            </Text>
          </View>

          {/* Method Selection */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Creation Method</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setMethod("drawing")}
                className={cn(
                  "flex-1 p-3 rounded-lg border-2",
                  method === "drawing"
                    ? "bg-primary border-primary"
                    : "bg-surface border-border"
                )}
              >
                <Text
                  className={cn(
                    "text-center font-semibold",
                    method === "drawing" ? "text-background" : "text-foreground"
                  )}
                >
                  Draw on Map
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMethod("name_detection")}
                className={cn(
                  "flex-1 p-3 rounded-lg border-2",
                  method === "name_detection"
                    ? "bg-primary border-primary"
                    : "bg-surface border-border"
                )}
              >
                <Text
                  className={cn(
                    "text-center font-semibold",
                    method === "name_detection" ? "text-background" : "text-foreground"
                  )}
                >
                  Auto Detect
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Basic Information */}
          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Zone Information</Text>

            <View className="gap-2">
              <Text className="text-sm font-medium text-muted">Zone Name *</Text>
              <TextInput
                placeholder="e.g., Central Lusaka"
                value={zoneName}
                onChangeText={setZoneName}
                className="bg-surface p-3 rounded-lg text-foreground border border-border"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-muted">City *</Text>
              <TextInput
                placeholder="e.g., Lusaka"
                value={city}
                onChangeText={setCity}
                className="bg-surface p-3 rounded-lg text-foreground border border-border"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-muted">Description</Text>
              <TextInput
                placeholder="Optional description"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                className="bg-surface p-3 rounded-lg text-foreground border border-border"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          {/* Drawing Method */}
          {method === "drawing" && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Draw Boundaries</Text>

              {/* Map Placeholder */}
              <View
                className="bg-surface border-2 border-border rounded-lg p-4 h-64 items-center justify-center"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-muted text-center">
                  Map Drawing Interface{"\n"}(Click to add points)
                </Text>
              </View>

              {/* Geometry Type */}
              <View className="gap-2">
                <Text className="text-sm font-medium text-muted">Geometry Type</Text>
                <View className="flex-row gap-2">
                  {["polygon", "circle", "point"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setGeometryType(type as any)}
                      className={cn(
                        "flex-1 p-2 rounded border",
                        geometryType === type
                          ? "bg-primary border-primary"
                          : "bg-surface border-border"
                      )}
                    >
                      <Text
                        className={cn(
                          "text-center text-sm font-medium",
                          geometryType === type ? "text-background" : "text-foreground"
                        )}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Circle Parameters */}
              {geometryType === "circle" && (
                <View className="gap-3">
                  <View className="gap-2">
                    <Text className="text-sm font-medium text-muted">Center Latitude</Text>
                    <TextInput
                      placeholder="-15.4067"
                      value={centerLat}
                      onChangeText={setCenterLat}
                      keyboardType="decimal-pad"
                      className="bg-surface p-3 rounded-lg text-foreground border border-border"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="text-sm font-medium text-muted">Center Longitude</Text>
                    <TextInput
                      placeholder="28.2733"
                      value={centerLng}
                      onChangeText={setCenterLng}
                      keyboardType="decimal-pad"
                      className="bg-surface p-3 rounded-lg text-foreground border border-border"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="text-sm font-medium text-muted">Radius (meters)</Text>
                    <TextInput
                      placeholder="5000"
                      value={radiusMeters}
                      onChangeText={setRadiusMeters}
                      keyboardType="number-pad"
                      className="bg-surface p-3 rounded-lg text-foreground border border-border"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>
              )}

              {/* Points Summary */}
              <View className="bg-surface p-3 rounded-lg border border-border">
                <Text className="text-sm font-medium text-foreground mb-2">
                  Points: {drawnCoordinates.length}
                </Text>
                {drawnCoordinates.map((coord, idx) => (
                  <Text key={idx} className="text-xs text-muted">
                    {idx + 1}. {coord[0].toFixed(6)}, {coord[1].toFixed(6)}
                  </Text>
                ))}
              </View>

              {/* Drawing Controls */}
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={handleUndoPoint}
                  className="flex-1 bg-warning p-3 rounded-lg"
                >
                  <Text className="text-center text-background font-semibold">Undo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleClearPoints}
                  className="flex-1 bg-error p-3 rounded-lg"
                >
                  <Text className="text-center text-background font-semibold">Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Name Detection Method */}
          {method === "name_detection" && (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-foreground">Auto-Detection</Text>

              <View className="gap-2">
                <Text className="text-sm font-medium text-muted">Center Latitude *</Text>
                <TextInput
                  placeholder="-15.4067"
                  value={centerLat}
                  onChangeText={setCenterLat}
                  keyboardType="decimal-pad"
                  className="bg-surface p-3 rounded-lg text-foreground border border-border"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-muted">Center Longitude *</Text>
                <TextInput
                  placeholder="28.2733"
                  value={centerLng}
                  onChangeText={setCenterLng}
                  keyboardType="decimal-pad"
                  className="bg-surface p-3 rounded-lg text-foreground border border-border"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-medium text-muted">Radius (meters) *</Text>
                <TextInput
                  placeholder="5000"
                  value={radiusMeters}
                  onChangeText={setRadiusMeters}
                  keyboardType="number-pad"
                  className="bg-surface p-3 rounded-lg text-foreground border border-border"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View className="bg-primary/10 p-3 rounded-lg border border-primary">
                <Text className="text-sm text-primary font-medium">
                  ℹ️ System will auto-detect zone boundaries based on the zone name and coordinates
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onCancel}
              className="flex-1 bg-surface border border-border p-3 rounded-lg"
            >
              <Text className="text-center text-foreground font-semibold">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={
                method === "drawing" ? handleCreateByDrawing : handleCreateByNameDetection
              }
              disabled={loading}
              className={cn(
                "flex-1 p-3 rounded-lg",
                loading ? "bg-muted" : "bg-primary"
              )}
            >
              <Text className="text-center text-background font-semibold">
                {loading ? "Creating..." : "Create Zone"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
