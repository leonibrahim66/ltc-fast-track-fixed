import { View, Text, Platform } from "react-native";
import { useState, useEffect, forwardRef } from "react";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// Only import MapView on native platforms
let NativeMapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== "web") {
  const Maps = require("react-native-maps");
  NativeMapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

interface MapViewProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onPress?: (event: any) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  children?: React.ReactNode;
  style?: any;
}

interface MarkerProps {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

// Web fallback map component
function WebMapView({
  initialRegion,
  onPress,
  children,
  style,
}: MapViewProps) {
  const [markerPosition, setMarkerPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    initialRegion
      ? { latitude: initialRegion.latitude, longitude: initialRegion.longitude }
      : null
  );

  const handleClick = (e: any) => {
    // For web, we simulate a tap at center or use a simple click handler
    if (onPress && initialRegion) {
      // Simulate coordinate from click
      const event = {
        nativeEvent: {
          coordinate: markerPosition || {
            latitude: initialRegion.latitude,
            longitude: initialRegion.longitude,
          },
        },
      };
      onPress(event);
    }
  };

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: "#E8F5E9",
          borderRadius: 12,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {/* Map placeholder for web */}
      <View className="flex-1 items-center justify-center p-4">
        <View className="bg-primary/20 w-20 h-20 rounded-full items-center justify-center mb-4">
          <MaterialIcons name="map" size={40} color="#22C55E" />
        </View>
        <Text className="text-foreground font-semibold text-center mb-2">
          Map View
        </Text>
        {initialRegion && (
          <Text className="text-muted text-sm text-center mb-4">
            Location: {initialRegion.latitude.toFixed(4)}, {initialRegion.longitude.toFixed(4)}
          </Text>
        )}
        <Text className="text-muted text-xs text-center">
          Interactive map available on mobile devices.{"\n"}
          Your location will be used for pickup requests.
        </Text>
        {children}
      </View>
    </View>
  );
}

// Web fallback marker component
function WebMarker({ coordinate, title, children }: MarkerProps) {
  return (
    <View className="absolute items-center justify-center" style={{ top: "40%", left: "45%" }}>
      {children || (
        <View className="bg-primary p-2 rounded-full">
          <MaterialIcons name="location-on" size={24} color="#fff" />
        </View>
      )}
      {title && (
        <Text className="text-xs text-foreground mt-1 bg-white px-2 py-1 rounded">
          {title}
        </Text>
      )}
    </View>
  );
}

// Export cross-platform components
export const CrossPlatformMapView = forwardRef<any, MapViewProps>(
  (props, ref) => {
    if (Platform.OS === "web") {
      return <WebMapView {...props} />;
    }

    return (
      <NativeMapView
        ref={ref}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        {...props}
      />
    );
  }
);

export const CrossPlatformMarker = (props: MarkerProps) => {
  if (Platform.OS === "web") {
    return <WebMarker {...props} />;
  }

  return <Marker {...props} />;
};

CrossPlatformMapView.displayName = "CrossPlatformMapView";
