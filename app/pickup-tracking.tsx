import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ScreenContainer } from "@/components/screen-container";
import { usePickups } from "@/lib/pickups-context";
import { useColors } from "@/hooks/use-colors";

// Simulated collector movement for demo
const COLLECTOR_SPEEDS = {
  fast: 0.0005,
  medium: 0.0003,
  slow: 0.0001,
};

export default function PickupTrackingScreen() {
  const router = useRouter();
  const colors = useColors();
  const { pickupId } = useLocalSearchParams<{ pickupId: string }>();
  const { getPickupById } = usePickups();
  
  const pickup = pickupId ? getPickupById(pickupId) : undefined;
  
  // Collector location state (simulated)
  const [collectorLocation, setCollectorLocation] = useState({
    latitude: pickup ? pickup.location.latitude + 0.01 : -15.4067,
    longitude: pickup ? pickup.location.longitude + 0.008 : 28.2733,
  });
  
  const [eta, setEta] = useState(15); // minutes
  const [status, setStatus] = useState<"en_route" | "nearby" | "arrived">("en_route");
  
  // Animation for pulsing dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    
    return () => pulse.stop();
  }, [pulseAnim]);
  
  // Simulate collector movement
  useEffect(() => {
    if (!pickup) return;
    
    const interval = setInterval(() => {
      setCollectorLocation((prev) => {
        const targetLat = pickup.location.latitude;
        const targetLng = pickup.location.longitude;
        
        const latDiff = targetLat - prev.latitude;
        const lngDiff = targetLng - prev.longitude;
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
        
        // Update status based on distance
        if (distance < 0.001) {
          setStatus("arrived");
          setEta(0);
          clearInterval(interval);
          return prev;
        } else if (distance < 0.003) {
          setStatus("nearby");
          setEta(2);
        } else {
          setStatus("en_route");
          // Rough ETA calculation (1 degree ≈ 111km, assuming 30km/h average)
          const distanceKm = distance * 111;
          setEta(Math.max(1, Math.round(distanceKm * 2)));
        }
        
        // Move towards target
        const speed = COLLECTOR_SPEEDS.medium;
        const newLat = prev.latitude + (latDiff > 0 ? speed : -speed) * Math.abs(latDiff / distance);
        const newLng = prev.longitude + (lngDiff > 0 ? speed : -speed) * Math.abs(lngDiff / distance);
        
        return { latitude: newLat, longitude: newLng };
      });
    }, 2000);
    
    return () => clearInterval(interval);
  }, [pickup]);
  
  const getStatusColor = () => {
    switch (status) {
      case "arrived": return "#22C55E";
      case "nearby": return "#F59E0B";
      default: return "#3B82F6";
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case "arrived": return "Collector Has Arrived!";
      case "nearby": return "Collector is Nearby";
      default: return "Collector En Route";
    }
  };
  
  const openInMaps = () => {
    if (!pickup) return;
    
    const { latitude, longitude } = collectorLocation;
    const url = Platform.select({
      ios: `maps://app?saddr=${latitude},${longitude}&daddr=${pickup.location.latitude},${pickup.location.longitude}`,
      android: `google.navigation:q=${pickup.location.latitude},${pickup.location.longitude}`,
      default: `https://www.google.com/maps/dir/${latitude},${longitude}/${pickup.location.latitude},${pickup.location.longitude}`,
    });
    
    Linking.openURL(url);
  };
  
  const callCollector = () => {
    // In a real app, this would use the collector's actual phone number
    Linking.openURL("tel:+260960819993");
  };
  
  if (!pickup) {
    return (
      <ScreenContainer className="items-center justify-center">
        <MaterialIcons name="error-outline" size={64} color="#9CA3AF" />
        <Text className="text-muted text-center mt-4">Pickup not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 bg-primary px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }
  
  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-6 pt-4 pb-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center mb-4"
        >
          <MaterialIcons name="arrow-back" size={24} color="#687076" />
          <Text className="text-muted ml-2">Back</Text>
        </TouchableOpacity>
        
        <Text className="text-2xl font-bold text-foreground">
          Track Your Pickup
        </Text>
      </View>
      
      {/* Map Placeholder */}
      <View className="mx-6 h-64 bg-surface rounded-2xl border border-border overflow-hidden">
        <View className="flex-1 bg-blue-50 items-center justify-center relative">
          {/* Simple visual map representation */}
          <View className="absolute inset-0 opacity-20">
            {/* Grid lines */}
            {[...Array(10)].map((_, i) => (
              <View
                key={`h-${i}`}
                className="absolute left-0 right-0 h-px bg-gray-400"
                style={{ top: `${i * 10}%` }}
              />
            ))}
            {[...Array(10)].map((_, i) => (
              <View
                key={`v-${i}`}
                className="absolute top-0 bottom-0 w-px bg-gray-400"
                style={{ left: `${i * 10}%` }}
              />
            ))}
          </View>
          
          {/* Your Location Marker */}
          <View className="absolute" style={{ top: "60%", left: "50%" }}>
            <View className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg" />
            <Text className="text-xs text-primary font-medium mt-1 -ml-4">You</Text>
          </View>
          
          {/* Collector Marker */}
          <Animated.View 
            className="absolute"
            style={{ 
              top: status === "arrived" ? "60%" : status === "nearby" ? "45%" : "25%",
              left: status === "arrived" ? "50%" : status === "nearby" ? "48%" : "40%",
              transform: [{ scale: pulseAnim }],
            }}
          >
            <View 
              className="w-10 h-10 rounded-full items-center justify-center shadow-lg"
              style={{ backgroundColor: getStatusColor() }}
            >
              <MaterialIcons name="local-shipping" size={24} color="#fff" />
            </View>
          </Animated.View>
          
          {/* Route Line */}
          {status !== "arrived" && (
            <View 
              className="absolute w-1 bg-blue-400 opacity-50"
              style={{
                top: status === "nearby" ? "48%" : "30%",
                left: "49%",
                height: status === "nearby" ? "12%" : "30%",
                transform: [{ rotate: status === "nearby" ? "5deg" : "15deg" }],
              }}
            />
          )}
          
          {/* Map Label */}
          <View className="absolute bottom-2 right-2 bg-white/80 px-2 py-1 rounded">
            <Text className="text-xs text-gray-600">Live Tracking</Text>
          </View>
        </View>
      </View>
      
      {/* Status Card */}
      <View className="mx-6 mt-4 bg-surface rounded-2xl p-4 border border-border">
        <View className="flex-row items-center mb-3">
          <View 
            className="w-3 h-3 rounded-full mr-3"
            style={{ backgroundColor: getStatusColor() }}
          />
          <Text className="text-lg font-semibold text-foreground">
            {getStatusText()}
          </Text>
        </View>
        
        {status !== "arrived" && (
          <View className="flex-row items-center bg-background rounded-xl p-3 mb-3">
            <MaterialIcons name="schedule" size={24} color={colors.primary} />
            <View className="ml-3">
              <Text className="text-muted text-sm">Estimated Arrival</Text>
              <Text className="text-foreground text-xl font-bold">
                {eta} {eta === 1 ? "minute" : "minutes"}
              </Text>
            </View>
          </View>
        )}
        
        {/* Collector Info */}
        <View className="flex-row items-center py-3 border-t border-border">
          <View className="w-12 h-12 bg-primary/10 rounded-full items-center justify-center">
            <MaterialIcons name="person" size={24} color={colors.primary} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-foreground font-medium">
              {pickup.collectorName || "Assigned Driver"}
            </Text>
            <Text className="text-muted text-sm">
              {pickup.binType === "commercial" ? "Commercial" : "Residential"} Pickup
            </Text>
          </View>
          <TouchableOpacity
            onPress={callCollector}
            className="w-10 h-10 bg-success/10 rounded-full items-center justify-center"
          >
            <MaterialIcons name="phone" size={20} color="#22C55E" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Pickup Details */}
      <View className="mx-6 mt-4 bg-surface rounded-2xl p-4 border border-border">
        <Text className="text-muted text-sm mb-2">Pickup Location</Text>
        <View className="flex-row items-start">
          <MaterialIcons name="location-on" size={20} color="#EF4444" />
          <Text className="text-foreground ml-2 flex-1">
            {pickup.location.address || "Location pinned on map"}
          </Text>
        </View>
        
        {pickup.notes && (
          <View className="mt-3 pt-3 border-t border-border">
            <Text className="text-muted text-sm mb-1">Notes</Text>
            <Text className="text-foreground">{pickup.notes}</Text>
          </View>
        )}
      </View>
      
      {/* Action Buttons */}
      <View className="mx-6 mt-4 flex-row gap-3">
        <TouchableOpacity
          onPress={openInMaps}
          className="flex-1 bg-primary py-4 rounded-xl flex-row items-center justify-center"
        >
          <MaterialIcons name="map" size={20} color="#fff" />
          <Text className="text-white font-semibold ml-2">Open in Maps</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={callCollector}
          className="flex-1 bg-success py-4 rounded-xl flex-row items-center justify-center"
        >
          <MaterialIcons name="phone" size={20} color="#fff" />
          <Text className="text-white font-semibold ml-2">Call Collector</Text>
        </TouchableOpacity>
      </View>
      
      {/* Status Timeline */}
      <View className="mx-6 mt-4 mb-6 bg-surface rounded-2xl p-4 border border-border">
        <Text className="text-foreground font-semibold mb-3">Pickup Progress</Text>
        
        <View className="flex-row items-center mb-2">
          <View className="w-6 h-6 bg-success rounded-full items-center justify-center">
            <MaterialIcons name="check" size={16} color="#fff" />
          </View>
          <Text className="text-foreground ml-3">Pickup Requested</Text>
        </View>
        
        <View className="w-px h-4 bg-border ml-3" />
        
        <View className="flex-row items-center mb-2">
          <View className="w-6 h-6 bg-success rounded-full items-center justify-center">
            <MaterialIcons name="check" size={16} color="#fff" />
          </View>
          <Text className="text-foreground ml-3">Collector Assigned</Text>
        </View>
        
        <View className="w-px h-4 bg-border ml-3" />
        
        <View className="flex-row items-center mb-2">
          <View 
            className="w-6 h-6 rounded-full items-center justify-center"
            style={{ backgroundColor: status !== "en_route" ? "#22C55E" : "#3B82F6" }}
          >
            {status !== "en_route" ? (
              <MaterialIcons name="check" size={16} color="#fff" />
            ) : (
              <View className="w-2 h-2 bg-white rounded-full" />
            )}
          </View>
          <Text className="text-foreground ml-3">En Route to You</Text>
        </View>
        
        <View className="w-px h-4 bg-border ml-3" />
        
        <View className="flex-row items-center">
          <View 
            className="w-6 h-6 rounded-full items-center justify-center"
            style={{ backgroundColor: status === "arrived" ? "#22C55E" : "#E5E7EB" }}
          >
            {status === "arrived" ? (
              <MaterialIcons name="check" size={16} color="#fff" />
            ) : (
              <View className="w-2 h-2 bg-gray-400 rounded-full" />
            )}
          </View>
          <Text className={status === "arrived" ? "text-foreground ml-3" : "text-muted ml-3"}>
            Collector Arrived
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
