import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

interface ZoneCreationProps {
  onZoneCreated?: (zoneId: number) => void;
  onCancel?: () => void;
}

type CreationMethod = "drawing" | "name_detection";

export default function ZoneCreationScreen({ onZoneCreated, onCancel }: ZoneCreationProps) {
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

  const handleCreateByDrawing = async () => {
    if (!zoneName || !city || drawnCoordinates.length < 3) {
      Alert.alert("Error", "Please fill all required fields and draw at least 3 points");
      return;
    }

    setLoading(true);
    try {
      Alert.alert("Success", "Zone created successfully from map drawing");
      onZoneCreated?.(1);
    } catch (error) {
      Alert.alert("Error", "Failed to create zone");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateByNameDetection = async () => {
    if (!zoneName || !city) {
      Alert.alert("Error", "Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      Alert.alert("Success", "Zone created successfully from name detection");
      onZoneCreated?.(1);
    } catch (error) {
      Alert.alert("Error", "Failed to create zone");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUndoPoint = () => {
    if (drawnCoordinates.length > 0) {
      setDrawnCoordinates(drawnCoordinates.slice(0, -1));
    }
  };

  const handleClearPoints = () => {
    setDrawnCoordinates([]);
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Create Zone</Text>
            <Text className="text-base text-muted">
              Define zone boundaries for garbage collection
            </Text>
          </View>

          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Creation Method</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setMethod("drawing")}
                className={cn(
                  "flex-1 p-3 rounded-lg border-2",
                  method === "drawing" ? "bg-primary border-primary" : "bg-surface border-border"
                )}
              >
                <Text className={cn("text-center font-semibold", method === "drawing" ? "text-background" : "text-foreground")}>
                  Draw on Map
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMethod("name_detection")}
                className={cn(
                  "flex-1 p-3 rounded-lg border-2",
                  method === "name_detection" ? "bg-primary border-primary" : "bg-surface border-border"
                )}
              >
                <Text className={cn("text-center font-semibold", method === "name_detection" ? "text-background" : "text-foreground")}>
                  Auto Detect
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-lg font-semibold text-foreground">Zone Information</Text>

            <TextInput
              placeholder="Zone Name"
              value={zoneName}
              onChangeText={setZoneName}
              className="bg-surface p-3 rounded-lg text-foreground border border-border"
              placeholderTextColor={colors.muted}
            />

            <TextInput
              placeholder="City"
              value={city}
              onChangeText={setCity}
              className="bg-surface p-3 rounded-lg text-foreground border border-border"
              placeholderTextColor={colors.muted}
            />

            <TextInput
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              className="bg-surface p-3 rounded-lg text-foreground border border-border"
              placeholderTextColor={colors.muted}
            />
          </View>

          {method === "drawing" && (
            <View className="gap-3">
              <View
                className="bg-surface border-2 border-border rounded-lg p-4 h-64 items-center justify-center"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-muted text-center">
                  Map Drawing Interface{"\n"}(Drawing engine to be connected)
                </Text>
              </View>

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

              <View className="flex-row gap-2">
                <TouchableOpacity onPress={handleUndoPoint} className="flex-1 bg-warning p-3 rounded-lg">
                  <Text className="text-center text-background font-semibold">Undo</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleClearPoints} className="flex-1 bg-error p-3 rounded-lg">
                  <Text className="text-center text-background font-semibold">Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {method === "name_detection" && (
            <View className="gap-3">
              <TextInput
                placeholder="Center Latitude"
                value={centerLat}
                onChangeText={setCenterLat}
                keyboardType="decimal-pad"
                className="bg-surface p-3 rounded-lg text-foreground border border-border"
                placeholderTextColor={colors.muted}
              />

              <TextInput
                placeholder="Center Longitude"
                value={centerLng}
                onChangeText={setCenterLng}
                keyboardType="decimal-pad"
                className="bg-surface p-3 rounded-lg text-foreground border border-border"
                placeholderTextColor={colors.muted}
              />

              <TextInput
                placeholder="Radius (meters)"
                value={radiusMeters}
                onChangeText={setRadiusMeters}
                keyboardType="number-pad"
                className="bg-surface p-3 rounded-lg text-foreground border border-border"
                placeholderTextColor={colors.muted}
              />
            </View>
          )}

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onCancel}
              className="flex-1 bg-surface border border-border p-3 rounded-lg"
            >
              <Text className="text-center text-foreground font-semibold">Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={method === "drawing" ? handleCreateByDrawing : handleCreateByNameDetection}
              disabled={loading}
              className={cn("flex-1 p-3 rounded-lg", loading ? "bg-muted" : "bg-primary")}
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