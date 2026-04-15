import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';
import { GoogleMapsService } from '@/lib/google-maps-service';
import { LocationTrackingService } from '@/lib/location-tracking-service';
import { WebSocketService } from '@/lib/websocket-service';
import { RouteOptimizationService } from '@/lib/route-optimization-service';

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  type: 'collector' | 'subscriber' | 'collection_point';
  icon?: string;
  color?: string;
}

interface MapRoute {
  id: string;
  collectorId: string;
  waypoints: Array<{ latitude: number; longitude: number }>;
  color?: string;
  width?: number;
}

export function MapDisplayScreen() {
  const colors = useColors();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState({ latitude: -10.3333, longitude: 28.2833 });
  const [zoomLevel, setZoomLevel] = useState(13);
  const [showGeofences, setShowGeofences] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'collector' | 'subscriber' | 'collection_point'>('all');

  const googleMapsService = new GoogleMapsService(
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""
  );
  const locationService = new LocationTrackingService();
  const routeService = new RouteOptimizationService();

  // Load initial markers and routes
  useEffect(() => {
    loadMapData();
  }, []);

  const loadMapData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get current user location
      const userLocation = await locationService.getUserLocation('user-1');
      if (userLocation) {
        setMapCenter({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
      }

      // Load mock markers
      const mockMarkers: MapMarker[] = [
        {
          id: 'collector-1',
          latitude: -10.3350,
          longitude: 28.2850,
          title: 'Collector John',
          type: 'collector',
          color: '#FF6B6B',
        },
        {
          id: 'subscriber-1',
          latitude: -10.3370,
          longitude: 28.2870,
          title: 'Subscriber Home',
          type: 'subscriber',
          color: '#4ECDC4',
        },
        {
          id: 'collection-1',
          latitude: -10.3390,
          longitude: 28.2890,
          title: 'Collection Point',
          type: 'collection_point',
          color: '#FFE66D',
        },
      ];

      setMarkers(mockMarkers);

      // Load mock routes
      const mockRoutes: MapRoute[] = [
        {
          id: 'route-1',
          collectorId: 'collector-1',
          waypoints: [
            { latitude: -10.3350, longitude: 28.2850 },
            { latitude: -10.3370, longitude: 28.2870 },
            { latitude: -10.3390, longitude: 28.2890 },
          ],
          color: '#FF6B6B',
          width: 3,
        },
      ];

      setRoutes(mockRoutes);
    } catch (error) {
      console.error('Error loading map data:', error);
      Alert.alert('Error', 'Failed to load map data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleMarkerPress = useCallback((marker: MapMarker) => {
    setSelectedMarker(marker);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev + 1, 20));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleCenterMap = useCallback(async () => {
    try {
      const userLocation = await locationService.getUserLocation('user-1');
      if (userLocation) {
        setMapCenter({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
        });
      }
    } catch (error) {
      console.error('Error centering map:', error);
    }
  }, []);

  const filteredMarkers = filterType === 'all' ? markers : markers.filter((m) => m.type === filterType);

  return (
    <ScreenContainer className="bg-background">
      <View className="flex-1 gap-4 p-4">
        {/* Map Container */}
        <View className="flex-1 rounded-lg overflow-hidden bg-surface border border-border">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-2 text-muted">Loading map...</Text>
            </View>
          ) : (
            <View className="flex-1 bg-slate-100 items-center justify-center">
              {/* Map Placeholder - Replace with actual Google Maps component */}
              <Text className="text-muted text-center px-4">
                Google Maps View
                {'\n'}
                Center: {mapCenter.latitude.toFixed(4)}, {mapCenter.longitude.toFixed(4)}
                {'\n'}
                Zoom: {zoomLevel}x
                {'\n'}
                Markers: {filteredMarkers.length}
              </Text>
            </View>
          )}

          {/* Map Controls */}
          <View className="absolute bottom-4 right-4 gap-2">
            <Pressable
              onPress={handleZoomIn}
              className="w-10 h-10 rounded-full bg-primary items-center justify-center shadow-md"
            >
              <Text className="text-white font-bold text-lg">+</Text>
            </Pressable>
            <Pressable
              onPress={handleZoomOut}
              className="w-10 h-10 rounded-full bg-primary items-center justify-center shadow-md"
            >
              <Text className="text-white font-bold text-lg">−</Text>
            </Pressable>
            <Pressable
              onPress={handleCenterMap}
              className="w-10 h-10 rounded-full bg-primary items-center justify-center shadow-md"
            >
              <Text className="text-white font-bold">📍</Text>
            </Pressable>
          </View>
        </View>

        {/* Controls and Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
          <Pressable
            onPress={() => setFilterType('all')}
            className={cn(
              'px-4 py-2 rounded-full',
              filterType === 'all' ? 'bg-primary' : 'bg-surface border border-border'
            )}
          >
            <Text className={filterType === 'all' ? 'text-white font-semibold' : 'text-foreground'}>
              All
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterType('collector')}
            className={cn(
              'px-4 py-2 rounded-full',
              filterType === 'collector' ? 'bg-primary' : 'bg-surface border border-border'
            )}
          >
            <Text className={filterType === 'collector' ? 'text-white font-semibold' : 'text-foreground'}>
              Collectors
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterType('subscriber')}
            className={cn(
              'px-4 py-2 rounded-full',
              filterType === 'subscriber' ? 'bg-primary' : 'bg-surface border border-border'
            )}
          >
            <Text className={filterType === 'subscriber' ? 'text-white font-semibold' : 'text-foreground'}>
              Subscribers
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilterType('collection_point')}
            className={cn(
              'px-4 py-2 rounded-full',
              filterType === 'collection_point' ? 'bg-primary' : 'bg-surface border border-border'
            )}
          >
            <Text className={filterType === 'collection_point' ? 'text-white font-semibold' : 'text-foreground'}>
              Points
            </Text>
          </Pressable>
        </ScrollView>

        {/* Toggle Options */}
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setShowGeofences(!showGeofences)}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg border',
              showGeofences ? 'bg-primary border-primary' : 'bg-surface border-border'
            )}
          >
            <Text className={showGeofences ? 'text-white text-center font-semibold' : 'text-foreground text-center'}>
              {showGeofences ? '✓' : ''} Geofences
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowRoutes(!showRoutes)}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg border',
              showRoutes ? 'bg-primary border-primary' : 'bg-surface border-border'
            )}
          >
            <Text className={showRoutes ? 'text-white text-center font-semibold' : 'text-foreground text-center'}>
              {showRoutes ? '✓' : ''} Routes
            </Text>
          </Pressable>
        </View>

        {/* Markers List */}
        <View className="max-h-32 bg-surface rounded-lg border border-border p-3">
          <Text className="font-semibold text-foreground mb-2">
            Markers ({filteredMarkers.length})
          </Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {filteredMarkers.map((marker) => (
              <Pressable
                key={marker.id}
                onPress={() => handleMarkerPress(marker)}
                className={cn(
                  'p-2 mb-1 rounded-lg',
                  selectedMarker?.id === marker.id ? 'bg-primary/20' : 'bg-background'
                )}
              >
                <Text className="text-sm font-semibold text-foreground">{marker.title}</Text>
                <Text className="text-xs text-muted">
                  {marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Selected Marker Details */}
        {selectedMarker && (
          <View className="bg-surface rounded-lg border border-border p-4">
            <Text className="font-semibold text-foreground mb-2">{selectedMarker.title}</Text>
            <View className="gap-1">
              <Text className="text-sm text-muted">
                Type: <Text className="text-foreground font-semibold">{selectedMarker.type}</Text>
              </Text>
              <Text className="text-sm text-muted">
                Latitude: <Text className="text-foreground font-semibold">{selectedMarker.latitude.toFixed(6)}</Text>
              </Text>
              <Text className="text-sm text-muted">
                Longitude: <Text className="text-foreground font-semibold">{selectedMarker.longitude.toFixed(6)}</Text>
              </Text>
            </View>
            <Pressable
              onPress={() => setSelectedMarker(null)}
              className="mt-3 px-4 py-2 bg-primary rounded-lg"
            >
              <Text className="text-white text-center font-semibold">Close</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
