/**
 * Map Navigation Context
 * Manages map screen navigation and state across the app
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

export type MapScreenMode = 'view' | 'tracking' | 'optimization' | 'admin';
export type MapFlowSource = 'subscription' | 'collection' | 'admin-dashboard' | 'home';

export interface MapNavigationState {
  isMapVisible: boolean;
  mode: MapScreenMode;
  source: MapFlowSource;
  selectedMarkerId?: string;
  selectedZoneId?: string;
  trackingUserId?: string;
  routeId?: string;
  filters?: {
    markerTypes?: string[];
    showGeofences?: boolean;
    showRoutes?: boolean;
  };
}

export interface MapNavigationContextType {
  state: MapNavigationState;
  openMap: (mode: MapScreenMode, source: MapFlowSource, options?: Partial<MapNavigationState>) => void;
  closeMap: () => void;
  selectMarker: (markerId: string) => void;
  selectZone: (zoneId: string) => void;
  startTracking: (userId: string) => void;
  stopTracking: () => void;
  selectRoute: (routeId: string) => void;
  updateFilters: (filters: MapNavigationState['filters']) => void;
  resetState: () => void;
}

const MapNavigationContext = createContext<MapNavigationContextType | undefined>(undefined);

const initialState: MapNavigationState = {
  isMapVisible: false,
  mode: 'view',
  source: 'home',
  filters: {
    markerTypes: ['collector', 'subscriber', 'collection_point'],
    showGeofences: true,
    showRoutes: true,
  },
};

export function MapNavigationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MapNavigationState>(initialState);

  const openMap = useCallback(
    (mode: MapScreenMode, source: MapFlowSource, options?: Partial<MapNavigationState>) => {
      setState((prev) => ({
        ...prev,
        isMapVisible: true,
        mode,
        source,
        ...options,
      }));
    },
    []
  );

  const closeMap = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isMapVisible: false,
    }));
  }, []);

  const selectMarker = useCallback((markerId: string) => {
    setState((prev) => ({
      ...prev,
      selectedMarkerId: markerId,
    }));
  }, []);

  const selectZone = useCallback((zoneId: string) => {
    setState((prev) => ({
      ...prev,
      selectedZoneId: zoneId,
    }));
  }, []);

  const startTracking = useCallback((userId: string) => {
    setState((prev) => ({
      ...prev,
      trackingUserId: userId,
      mode: 'tracking',
    }));
  }, []);

  const stopTracking = useCallback(() => {
    setState((prev) => ({
      ...prev,
      trackingUserId: undefined,
      mode: 'view',
    }));
  }, []);

  const selectRoute = useCallback((routeId: string) => {
    setState((prev) => ({
      ...prev,
      routeId,
    }));
  }, []);

  const updateFilters = useCallback((filters: MapNavigationState['filters']) => {
    setState((prev) => ({
      ...prev,
      filters: {
        ...prev.filters,
        ...filters,
      },
    }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  const value: MapNavigationContextType = {
    state,
    openMap,
    closeMap,
    selectMarker,
    selectZone,
    startTracking,
    stopTracking,
    selectRoute,
    updateFilters,
    resetState,
  };

  return (
    <MapNavigationContext.Provider value={value}>
      {children}
    </MapNavigationContext.Provider>
  );
}

export function useMapNavigation(): MapNavigationContextType {
  const context = useContext(MapNavigationContext);
  if (!context) {
    throw new Error('useMapNavigation must be used within MapNavigationProvider');
  }
  return context;
}
