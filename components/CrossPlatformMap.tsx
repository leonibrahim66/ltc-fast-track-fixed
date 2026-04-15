import React, { useState, useCallback, useMemo } from 'react';
import { Platform, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';

// Conditional imports for web-only dependencies
let GoogleMap: any;
let GoogleMarker: any;
let GooglePolygon: any;
let useJsApiLoader: any;

if (Platform.OS === 'web') {
  try {
    const googleMapsApi = require('@react-google-maps/api');
    GoogleMap = googleMapsApi.GoogleMap;
    GoogleMarker = googleMapsApi.Marker;
    GooglePolygon = googleMapsApi.Polygon;
    useJsApiLoader = googleMapsApi.useJsApiLoader;
  } catch (e) {
    console.warn('Google Maps API not available');
  }
}

export interface CrossPlatformMapProps {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
  markers?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
  }>;
  polygonCoordinates?: Array<{
    latitude: number;
    longitude: number;
  }>;
  onMarkerPress?: (markerId: string) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  style?: any;
  zoomLevel?: number;
}

// Web Map Component
function WebMapComponent({
  // Use any type to avoid TypeScript errors when module not available
  latitude,
  longitude,
  markers = [],
  polygonCoordinates = [],
  onMarkerPress,
  zoomLevel = 15,
  style,
}: CrossPlatformMapProps) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey || '',
    libraries: ['places'],
  });

  const center = useMemo(
    () => ({
      lat: latitude,
      lng: longitude,
    }),
    [latitude, longitude]
  );

  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: false,
      clickableIcons: true,
      scrollwheel: true,
      zoom: zoomLevel,
    }),
    [zoomLevel]
  );

  if (loadError) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.errorText}>Error loading map: {loadError.message}</Text>
      </View>
    );
  }

  if (!isLoaded) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={[styles.mapContainer, style]}
      center={center}
      zoom={zoomLevel}
      options={mapOptions}
    >
      {/* Zone Boundary Polygon */}
      {polygonCoordinates.length > 0 && (
        <GooglePolygon
          paths={polygonCoordinates.map((coord) => ({
            lat: coord.latitude,
            lng: coord.longitude,
          }))}
          options={{
            fillColor: 'rgba(59, 130, 246, 0.2)',
            strokeColor: '#3B82F6',
            strokeWeight: 2,
          }}
        />
      )}

      {/* Main Location Marker */}
      <GoogleMarker
        position={center}
        title="Current Location"
        icon={{
          path: 'M0,-24c-13.255,0 -24,10.745 -24,24c0,20 24,44 24,44s24,-24 24,-44c0,-13.255 -10.745,-24 -24,-24zm0,32c-4.418,0 -8,-3.582 -8,-8s3.582,-8 8,-8s8,3.582 8,8s-3.582,8 -8,8z',
          fillColor: '#0a7ea4',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 1,
        }}
      />

      {/* Additional Markers */}
      {markers.map((marker) => (
        <GoogleMarker
          key={marker.id}
          position={{
            lat: marker.latitude,
            lng: marker.longitude,
          }}
          title={marker.title}
          onClick={() => onMarkerPress?.(marker.id)}
          icon={{
            path: 'M0,-24c-13.255,0 -24,10.745 -24,24c0,20 24,44 24,44s24,-24 24,-44c0,-13.255 -10.745,-24 -24,-24zm0,32c-4.418,0 -8,-3.582 -8,-8s3.582,-8 8,-8s8,3.582 8,8s-3.582,8 -8,8z',
            fillColor: '#10B981',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
            scale: 0.8,
          }}
        />
      ))}
    </GoogleMap>
  );
}

// Mobile Map Component
function MobileMapComponent({
  latitude,
  longitude,
  latitudeDelta = 0.05,
  longitudeDelta = 0.05,
  markers = [],
  polygonCoordinates = [],
  onMarkerPress,
  showsUserLocation = true,
  showsMyLocationButton = true,
  style,
}: CrossPlatformMapProps) {
  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={[styles.mapContainer, style]}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta,
        longitudeDelta,
      }}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsMyLocationButton}
    >
      {/* Zone Boundary Polygon */}
      {polygonCoordinates.length > 0 && (
        <Polygon
          coordinates={polygonCoordinates}
          fillColor="rgba(59, 130, 246, 0.2)"
          strokeColor="#3B82F6"
          strokeWidth={2}
        />
      )}

      {/* Additional Markers */}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{
            latitude: marker.latitude,
            longitude: marker.longitude,
          }}
          title={marker.title}
          description={marker.description}
          onPress={() => onMarkerPress?.(marker.id)}
        />
      ))}
    </MapView>
  );
}

/**
 * CrossPlatformMap Component
 * 
 * Renders a map that works on both web and mobile:
 * - Web: Uses Google Maps API via @react-google-maps/api
 * - Mobile: Uses react-native-maps
 * 
 * Props:
 * - latitude, longitude: Center of map
 * - markers: Array of markers to display
 * - polygonCoordinates: Array of coordinates for zone boundary
 * - onMarkerPress: Callback when marker is clicked
 * - style: Container style
 */
export function CrossPlatformMap(props: CrossPlatformMapProps) {
  if (Platform.OS === 'web') {
    return <WebMapComponent {...props} />;
  }

  return <MobileMapComponent {...props} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
