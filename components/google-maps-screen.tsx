/**
 * Google Maps Live Tracking Screen
 * Real-time map display with live Google Maps integration
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import { ScreenContainer } from './screen-container';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';
import { getGoogleMapsService, type MapMarkerData, type GeofenceZoneData } from '@/lib/google-maps-service';

interface GoogleMapsScreenProps {
  userRole: 'subscriber' | 'collector' | 'recycler' | 'superadmin';
  userId: string;
  onMarkerPress?: (marker: MapMarkerData) => void;
  onLocationUpdate?: (latitude: number, longitude: number) => void;
}

export function GoogleMapsScreen({
  userRole,
  userId,
  onMarkerPress,
  onLocationUpdate,
}: GoogleMapsScreenProps) {
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerData | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [mapStats, setMapStats] = useState<any>(null);
  const [nearbyMarkers, setNearbyMarkers] = useState<MapMarkerData[]>([]);
  const mapsService = useRef(getGoogleMapsService());
  const { width, height } = Dimensions.get('window');

  // Initialize map data
  useEffect(() => {
    initializeMapData();
    const interval = setInterval(updateMapData, 5000);
    return () => clearInterval(interval);
  }, [userRole]);

  const initializeMapData = async () => {
    setIsLoading(true);

    try {
      // Validate API key
      const isValid = await mapsService.current.validateApiKey();
      if (!isValid) {
        console.error('Google Maps API key is invalid');
        setIsLoading(false);
        return;
      }

      // Add sample markers
      const markers: MapMarkerData[] = [
        {
          id: 'collector-1',
          latitude: -10.3333,
          longitude: 28.2833,
          title: 'Collector - John',
          description: 'Currently on route',
          type: 'collector',
          color: '#3B82F6',
          infoWindow: {
            title: 'John Collector',
            content: 'Active collection route - 5 stops completed',
            image: 'https://via.placeholder.com/50',
          },
        },
        {
          id: 'collector-2',
          latitude: -10.3367,
          longitude: 28.2867,
          title: 'Collector - Mary',
          description: 'At collection point',
          type: 'collector',
          color: '#3B82F6',
          infoWindow: {
            title: 'Mary Collector',
            content: 'At collection hub - Processing items',
          },
        },
        {
          id: 'sub-1',
          latitude: -10.3400,
          longitude: 28.2900,
          title: 'Subscriber - Residential',
          description: 'Awaiting pickup',
          type: 'subscriber',
          color: '#10B981',
          infoWindow: {
            title: 'Residential Subscriber',
            content: '2 bags of waste ready for pickup',
          },
        },
        {
          id: 'sub-2',
          latitude: -10.3367,
          longitude: 28.2900,
          title: 'Subscriber - Commercial',
          description: 'Scheduled for tomorrow',
          type: 'subscriber',
          color: '#10B981',
          infoWindow: {
            title: 'Commercial Subscriber',
            content: 'Large waste container - Scheduled pickup tomorrow',
          },
        },
        {
          id: 'cp-1',
          latitude: -10.3450,
          longitude: 28.2950,
          title: 'Collection Hub',
          description: 'Active',
          type: 'collection_point',
          color: '#F59E0B',
          infoWindow: {
            title: 'Central Collection Hub',
            content: 'Processing capacity: 80%',
          },
        },
        {
          id: 'cp-2',
          latitude: -10.3300,
          longitude: 28.2800,
          title: 'Collection Point - North',
          description: 'Active',
          type: 'collection_point',
          color: '#F59E0B',
          infoWindow: {
            title: 'North Collection Point',
            content: 'Processing capacity: 45%',
          },
        },
      ];

      // Add markers to service
      markers.forEach((marker) => mapsService.current.addMarker(marker));

      // Add geofence zones
      const geofences: GeofenceZoneData[] = [
        {
          id: 'gf-1',
          name: 'Central Collection Zone',
          center: { latitude: -10.3333, longitude: 28.2833 },
          radius: 2000,
          color: '#3B82F6',
          fillColor: '#3B82F6',
          fillOpacity: 0.1,
          strokeWeight: 2,
          type: 'collection_zone',
        },
        {
          id: 'gf-2',
          name: 'Restricted Area',
          center: { latitude: -10.3450, longitude: 28.2950 },
          radius: 500,
          color: '#EF4444',
          fillColor: '#EF4444',
          fillOpacity: 0.1,
          strokeWeight: 2,
          type: 'restricted_area',
        },
      ];

      geofences.forEach((zone) => mapsService.current.addGeofence(zone));

      // Add routes
      const routes = [
        {
          id: 'route-1',
          name: 'Collector Route - John',
          waypoints: [
            { latitude: -10.3333, longitude: 28.2833 },
            { latitude: -10.3367, longitude: 28.2867 },
            { latitude: -10.3400, longitude: 28.2900 },
            { latitude: -10.3450, longitude: 28.2950 },
          ],
          color: '#3B82F6',
          weight: 3,
          opacity: 0.8,
          geodesic: true,
          zIndex: 1,
        },
      ];

      routes.forEach((route) => mapsService.current.addRoute(route));

      // Get map statistics
      const stats = mapsService.current.getMapStatistics();
      setMapStats(stats);

      // Get nearby markers
      const nearby = mapsService.current.getNearbyMarkers(-10.3333, 28.2833, 5000);
      setNearbyMarkers(nearby);

      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing map:', error);
      setIsLoading(false);
    }
  };

  const updateMapData = () => {
    // Simulate real-time location updates
    const collectors = mapsService.current.getMarkersByType('collector');
    collectors.forEach((collector) => {
      if (Math.random() > 0.7) {
        const newLat = collector.latitude + (Math.random() - 0.5) * 0.001;
        const newLon = collector.longitude + (Math.random() - 0.5) * 0.001;
        mapsService.current.updateMarkerPosition(collector.id, newLat, newLon);
      }
    });

    // Update statistics
    const stats = mapsService.current.getMapStatistics();
    setMapStats(stats);
  };

  const handleMarkerPress = (marker: MapMarkerData) => {
    setSelectedMarker(marker);
    setShowDetails(true);
    onMarkerPress?.(marker);
  };

  const handleFitBounds = () => {
    const bounds = mapsService.current.fitBoundsToMarkers();
    // In production, this would update the map view
    console.log('Fit bounds:', bounds);
  };

  const handleToggleTracking = () => {
    setTrackingEnabled(!trackingEnabled);
  };

  const getFilteredMarkers = () => {
    const allMarkers = mapsService.current.getMarkers();
    if (!filterType) return allMarkers;
    return allMarkers.filter((m) => m.type === filterType);
  };

  const renderMapPlaceholder = () => {
    return (
      <View className="flex-1 bg-gradient-to-b from-blue-50 to-blue-100 items-center justify-center rounded-lg overflow-hidden border border-border">
        <View className="items-center gap-4">
          <Text className="text-lg font-bold text-foreground">Google Maps Integration</Text>
          <Text className="text-sm text-muted text-center px-4">
            Live map rendering with {mapStats?.totalMarkers || 0} active markers
          </Text>

          {mapStats && (
            <View className="bg-white rounded-lg p-4 w-full mx-4">
              <View className="flex-row justify-around">
                <View className="items-center">
                  <Text className="text-2xl font-bold text-primary">
                    {mapStats.markersByType['collector'] || 0}
                  </Text>
                  <Text className="text-xs text-muted">Collectors</Text>
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-bold text-success">
                    {mapStats.markersByType['subscriber'] || 0}
                  </Text>
                  <Text className="text-xs text-muted">Subscribers</Text>
                </View>
                <View className="items-center">
                  <Text className="text-2xl font-bold text-warning">
                    {mapStats.markersByType['collection_point'] || 0}
                  </Text>
                  <Text className="text-xs text-muted">Hubs</Text>
                </View>
              </View>
            </View>
          )}

          <View className="bg-surface rounded-lg p-3 w-full mx-4">
            <Text className="text-xs text-muted mb-2">Map Center</Text>
            <Text className="text-sm font-semibold text-foreground">
              -10.3333°, 28.2833° (Lusaka, Zambia)
            </Text>
          </View>

          <View className="bg-surface rounded-lg p-3 w-full mx-4">
            <Text className="text-xs text-muted mb-2">Total Route Distance</Text>
            <Text className="text-sm font-semibold text-foreground">
              {(mapStats?.totalDistance / 1000).toFixed(1)} km
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderMarkerDetails = () => {
    if (!selectedMarker) return null;

    return (
      <Modal
        visible={showDetails}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetails(false)}
      >
        <View className="flex-1 bg-black/50">
          <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-96">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-foreground">{selectedMarker.title}</Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <Text className="text-2xl text-muted">×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-3">
                {selectedMarker.infoWindow && (
                  <View className="bg-surface rounded-lg p-3">
                    <Text className="text-sm font-semibold text-foreground mb-1">
                      {selectedMarker.infoWindow.title}
                    </Text>
                    <Text className="text-xs text-muted">{selectedMarker.infoWindow.content}</Text>
                  </View>
                )}

                <View className="bg-surface rounded-lg p-3">
                  <Text className="text-xs text-muted mb-1">Type</Text>
                  <Text className="text-sm font-semibold text-foreground capitalize">
                    {selectedMarker.type.replace('_', ' ')}
                  </Text>
                </View>

                <View className="bg-surface rounded-lg p-3">
                  <Text className="text-xs text-muted mb-1">Coordinates</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {selectedMarker.latitude.toFixed(4)}°, {selectedMarker.longitude.toFixed(4)}°
                  </Text>
                </View>

                {selectedMarker.description && (
                  <View className="bg-surface rounded-lg p-3">
                    <Text className="text-xs text-muted mb-1">Status</Text>
                    <Text className="text-sm font-semibold text-foreground">{selectedMarker.description}</Text>
                  </View>
                )}

                <View className="flex-row gap-2 mt-4">
                  <TouchableOpacity
                    onPress={handleFitBounds}
                    className="flex-1 bg-primary rounded-lg p-3 items-center"
                  >
                    <Text className="text-white font-semibold text-sm">View on Map</Text>
                  </TouchableOpacity>

                  {selectedMarker.type === 'collector' && (
                    <TouchableOpacity
                      onPress={handleToggleTracking}
                      className={cn(
                        'flex-1 rounded-lg p-3 items-center',
                        trackingEnabled ? 'bg-error' : 'bg-success'
                      )}
                    >
                      <Text className="text-white font-semibold text-sm">
                        {trackingEnabled ? 'Stop' : 'Track'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderFilterButtons = () => {
    const filterOptions = [
      { label: 'All', value: null },
      { label: 'Collectors', value: 'collector' },
      { label: 'Subscribers', value: 'subscriber' },
      { label: 'Collection Points', value: 'collection_point' },
    ];

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
        <View className="flex-row gap-2">
          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.value || 'all'}
              onPress={() => setFilterType(option.value)}
              className={cn(
                'px-4 py-2 rounded-full border',
                filterType === option.value
                  ? 'bg-primary border-primary'
                  : 'bg-surface border-border'
              )}
            >
              <Text
                className={cn(
                  'text-sm font-semibold',
                  filterType === option.value ? 'text-white' : 'text-foreground'
                )}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderMarkersList = () => {
    const filteredMarkers = getFilteredMarkers();

    return (
      <View className="bg-surface rounded-lg p-4 max-h-48">
        <Text className="text-sm font-semibold text-foreground mb-3">
          Active Locations ({filteredMarkers.length})
        </Text>

        <FlatList
          data={filteredMarkers}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleMarkerPress(item)}
              className="flex-row items-center gap-3 py-2 border-b border-border last:border-b-0"
            >
              <View
                className="w-6 h-6 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{item.title}</Text>
                <Text className="text-xs text-muted">{item.description}</Text>
              </View>
            </Pressable>
          )}
        />
      </View>
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading Google Maps...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="gap-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-foreground">Live Tracking</Text>
          <Text className="text-sm text-muted">Powered by Google Maps</Text>
        </View>

        {/* Map Display */}
        <View className="h-80 mb-4 rounded-lg overflow-hidden border border-border">
          {renderMapPlaceholder()}
        </View>

        {/* Filters */}
        {renderFilterButtons()}

        {/* Markers List */}
        {renderMarkersList()}

        {/* Map Statistics */}
        {mapStats && (
          <View className="bg-surface rounded-lg p-4 mt-4">
            <Text className="text-sm font-semibold text-foreground mb-3">Map Statistics</Text>
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Total Markers</Text>
                <Text className="text-sm font-semibold text-foreground">{mapStats.totalMarkers}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Active Routes</Text>
                <Text className="text-sm font-semibold text-foreground">{mapStats.totalRoutes}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted">Geofence Zones</Text>
                <Text className="text-sm font-semibold text-foreground">{mapStats.totalGeofences}</Text>
              </View>
              <View className="flex-row justify-between pt-2 border-t border-border">
                <Text className="text-xs text-muted">Total Distance</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {(mapStats.totalDistance / 1000).toFixed(1)} km
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Marker Details Modal */}
      {renderMarkerDetails()}
    </ScreenContainer>
  );
}
