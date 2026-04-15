/**
 * Live Map Screen Component
 * Real-time map display for location tracking with pinning and movement visualization
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
} from 'react-native';
import { ScreenContainer } from './screen-container';
import { useColors } from '@/hooks/use-colors';
import { cn } from '@/lib/utils';

interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  type: 'collector' | 'subscriber' | 'collection_point' | 'geofence';
  color: string;
  isActive: boolean;
}

interface MapRoute {
  id: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  color: string;
  title: string;
}

interface LiveMapScreenProps {
  userRole: 'subscriber' | 'collector' | 'recycler' | 'superadmin';
  userId: string;
  onMarkerPress?: (marker: MapMarker) => void;
  onLocationUpdate?: (latitude: number, longitude: number) => void;
}

export function LiveMapScreen({
  userRole,
  userId,
  onMarkerPress,
  onLocationUpdate,
}: LiveMapScreenProps) {
  const colors = useColors();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [routes, setRoutes] = useState<MapRoute[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState({ latitude: -10.3333, longitude: 28.2833 });
  const [zoomLevel, setZoomLevel] = useState(13);
  const [showDetails, setShowDetails] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const mapRef = useRef<any>(null);

  // Initialize map data
  useEffect(() => {
    initializeMapData();
    const interval = setInterval(updateLocations, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [userRole]);

  const initializeMapData = () => {
    setIsLoading(true);

    // Sample markers based on user role
    const sampleMarkers: MapMarker[] = [
      {
        id: 'collector-1',
        latitude: -10.3333,
        longitude: 28.2833,
        title: 'Collector - John',
        description: 'Currently on route',
        type: 'collector',
        color: '#3B82F6',
        isActive: true,
      },
      {
        id: 'collector-2',
        latitude: -10.3367,
        longitude: 28.2867,
        title: 'Collector - Mary',
        description: 'At collection point',
        type: 'collector',
        color: '#3B82F6',
        isActive: true,
      },
      {
        id: 'sub-1',
        latitude: -10.3400,
        longitude: 28.2900,
        title: 'Subscriber - Residential',
        description: 'Awaiting pickup',
        type: 'subscriber',
        color: '#10B981',
        isActive: true,
      },
      {
        id: 'cp-1',
        latitude: -10.3450,
        longitude: 28.2950,
        title: 'Collection Hub',
        description: 'Active',
        type: 'collection_point',
        color: '#F59E0B',
        isActive: true,
      },
    ];

    // Sample routes
    const sampleRoutes: MapRoute[] = [
      {
        id: 'route-1',
        coordinates: [
          { latitude: -10.3333, longitude: 28.2833 },
          { latitude: -10.3367, longitude: 28.2867 },
          { latitude: -10.3400, longitude: 28.2900 },
          { latitude: -10.3450, longitude: 28.2950 },
        ],
        color: '#3B82F6',
        title: 'Collector Route - John',
      },
    ];

    setMarkers(sampleMarkers);
    setRoutes(sampleRoutes);
    setIsLoading(false);
  };

  const updateLocations = () => {
    // Simulate location updates
    setMarkers((prevMarkers) =>
      prevMarkers.map((marker) => {
        if (marker.type === 'collector' && Math.random() > 0.7) {
          return {
            ...marker,
            latitude: marker.latitude + (Math.random() - 0.5) * 0.001,
            longitude: marker.longitude + (Math.random() - 0.5) * 0.001,
          };
        }
        return marker;
      })
    );
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 1, 20));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 1, 1));
  };

  const handleMarkerPress = (marker: MapMarker) => {
    setSelectedMarker(marker);
    setShowDetails(true);
    onMarkerPress?.(marker);
  };

  const handleToggleTracking = () => {
    setTrackingEnabled(!trackingEnabled);
  };

  const handleCenterMap = () => {
    if (selectedMarker) {
      setMapCenter({
        latitude: selectedMarker.latitude,
        longitude: selectedMarker.longitude,
      });
    }
  };

  const getFilteredMarkers = () => {
    if (!filterType) return markers;
    return markers.filter((m) => m.type === filterType);
  };

  const renderMapSimulation = () => {
    return (
      <View className="flex-1 bg-slate-100 border border-border rounded-lg overflow-hidden">
        {/* Map placeholder */}
        <View className="flex-1 items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
          <Text className="text-muted text-sm mb-4">
            Map Center: {mapCenter.latitude.toFixed(4)}, {mapCenter.longitude.toFixed(4)}
          </Text>
          <Text className="text-muted text-sm mb-4">Zoom: {zoomLevel}x</Text>

          {/* Markers visualization */}
          <View className="w-full h-full items-center justify-center">
            {getFilteredMarkers().map((marker) => (
              <Pressable
                key={marker.id}
                onPress={() => handleMarkerPress(marker)}
                className="mb-2"
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center border-2 border-white shadow-lg"
                  style={{ backgroundColor: marker.color }}
                >
                  <Text className="text-white text-xs font-bold">
                    {marker.type === 'collector' ? 'C' : marker.type === 'subscriber' ? 'S' : 'P'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Map controls */}
        <View className="absolute top-4 right-4 gap-2">
          <TouchableOpacity
            onPress={handleZoomIn}
            className="w-10 h-10 bg-white rounded-lg items-center justify-center shadow-md border border-border"
          >
            <Text className="text-lg font-bold text-foreground">+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleZoomOut}
            className="w-10 h-10 bg-white rounded-lg items-center justify-center shadow-md border border-border"
          >
            <Text className="text-lg font-bold text-foreground">−</Text>
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View className="absolute bottom-4 left-4 bg-white rounded-lg p-3 shadow-md border border-border">
          <Text className="text-xs font-semibold text-foreground mb-2">Legend</Text>
          <View className="gap-1">
            <View className="flex-row items-center gap-2">
              <View className="w-4 h-4 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
              <Text className="text-xs text-muted">Collectors</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-4 h-4 rounded-full" style={{ backgroundColor: '#10B981' }} />
              <Text className="text-xs text-muted">Subscribers</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="w-4 h-4 rounded-full" style={{ backgroundColor: '#F59E0B' }} />
              <Text className="text-xs text-muted">Collection Points</Text>
            </View>
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
                <View className="bg-surface rounded-lg p-3">
                  <Text className="text-xs text-muted mb-1">Type</Text>
                  <Text className="text-sm font-semibold text-foreground capitalize">
                    {selectedMarker.type.replace('_', ' ')}
                  </Text>
                </View>

                <View className="bg-surface rounded-lg p-3">
                  <Text className="text-xs text-muted mb-1">Location</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {selectedMarker.latitude.toFixed(4)}, {selectedMarker.longitude.toFixed(4)}
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
                    onPress={handleCenterMap}
                    className="flex-1 bg-primary rounded-lg p-3 items-center"
                  >
                    <Text className="text-white font-semibold text-sm">Center Map</Text>
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
          Locations ({filteredMarkers.length})
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
              <View
                className={cn(
                  'w-2 h-2 rounded-full',
                  item.isActive ? 'bg-success' : 'bg-error'
                )}
              />
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
        <Text className="text-muted mt-4">Loading map...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="gap-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-foreground">Live Map</Text>
          <Text className="text-sm text-muted">Real-time location tracking</Text>
        </View>

        {/* Map */}
        <View className="h-80 mb-4 rounded-lg overflow-hidden border border-border">
          {renderMapSimulation()}
        </View>

        {/* Filters */}
        {renderFilterButtons()}

        {/* Markers List */}
        {renderMarkersList()}

        {/* Statistics */}
        <View className="bg-surface rounded-lg p-4 mt-4">
          <Text className="text-sm font-semibold text-foreground mb-3">Statistics</Text>
          <View className="flex-row justify-around">
            <View className="items-center">
              <Text className="text-2xl font-bold text-primary">
                {markers.filter((m) => m.type === 'collector').length}
              </Text>
              <Text className="text-xs text-muted">Active Collectors</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-success">
                {markers.filter((m) => m.type === 'subscriber').length}
              </Text>
              <Text className="text-xs text-muted">Subscribers</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl font-bold text-warning">
                {markers.filter((m) => m.type === 'collection_point').length}
              </Text>
              <Text className="text-xs text-muted">Collection Points</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Marker Details Modal */}
      {renderMarkerDetails()}
    </ScreenContainer>
  );
}
