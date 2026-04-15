/**
 * Google Maps Integration Service
 * Handles real-time map rendering, markers, routes, geofencing, and distance calculations
 */

export interface MapMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  type: 'collector' | 'subscriber' | 'collection_point' | 'geofence';
  icon?: string;
  color?: string;
  infoWindow?: {
    title: string;
    content: string;
    image?: string;
  };
}

export interface RouteData {
  id: string;
  name: string;
  waypoints: Array<{ latitude: number; longitude: number }>;
  color: string;
  weight: number;
  opacity: number;
  geodesic: boolean;
  zIndex: number;
}

export interface GeofenceZoneData {
  id: string;
  name: string;
  center: { latitude: number; longitude: number };
  radius: number; // in meters
  color: string;
  fillColor: string;
  fillOpacity: number;
  strokeWeight: number;
  type: 'collection_zone' | 'restricted_area' | 'service_area';
}

export interface DistanceMatrixRequest {
  origins: Array<{ latitude: number; longitude: number }>;
  destinations: Array<{ latitude: number; longitude: number }>;
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
  avoidHighways?: boolean;
  avoidTolls?: boolean;
}

export interface DistanceMatrixResponse {
  rows: Array<{
    elements: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      status: string;
    }>;
  }>;
  status: string;
}

export interface MapConfig {
  apiKey: string;
  center: { latitude: number; longitude: number };
  zoom: number;
  mapType: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  styles?: any[];
  gestureHandling: 'auto' | 'cooperative' | 'greedy' | 'none';
}

export class GoogleMapsService {
  private apiKey: string;
  private mapConfig: MapConfig;
  private markers: Map<string, MapMarkerData> = new Map();
  private routes: Map<string, RouteData> = new Map();
  private geofences: Map<string, GeofenceZoneData> = new Map();
  private mapInstance: any = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.mapConfig = {
      apiKey,
      center: { latitude: -10.3333, longitude: 28.2833 },
      zoom: 13,
      mapType: 'roadmap',
      gestureHandling: 'auto',
    };
    this.initializeMapStyles();
  }

  /**
   * Initialize map styles
   */
  private initializeMapStyles(): void {
    this.mapConfig.styles = [
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#e9e9e9' }, { lightness: 17 }],
      },
      {
        featureType: 'landscape',
        elementType: 'geometry',
        stylers: [{ color: '#f3f3f3' }, { lightness: 20 }],
      },
      {
        featureType: 'road.highway',
        elementType: 'geometry.fill',
        stylers: [{ color: '#ffd89b' }, { lightness: 27 }],
      },
      {
        featureType: 'road.arterial',
        elementType: 'geometry.fill',
        stylers: [{ color: '#ffe4b6' }, { lightness: 31 }],
      },
      {
        featureType: 'road.local',
        elementType: 'geometry.fill',
        stylers: [{ color: '#ffffff' }, { lightness: 100 }],
      },
      {
        featureType: 'poi',
        elementType: 'geometry',
        stylers: [{ color: '#ffe4b6' }, { lightness: 21 }],
      },
    ];
  }

  /**
   * Get map configuration
   */
  getMapConfig(): MapConfig {
    return this.mapConfig;
  }

  /**
   * Update map center
   */
  updateMapCenter(latitude: number, longitude: number, zoom?: number): void {
    this.mapConfig.center = { latitude, longitude };
    if (zoom) {
      this.mapConfig.zoom = zoom;
    }
  }

  /**
   * Add marker to map
   */
  addMarker(marker: MapMarkerData): void {
    this.markers.set(marker.id, marker);
  }

  /**
   * Update marker position
   */
  updateMarkerPosition(markerId: string, latitude: number, longitude: number): boolean {
    const marker = this.markers.get(markerId);
    if (!marker) return false;

    marker.latitude = latitude;
    marker.longitude = longitude;
    return true;
  }

  /**
   * Remove marker
   */
  removeMarker(markerId: string): boolean {
    return this.markers.delete(markerId);
  }

  /**
   * Get all markers
   */
  getMarkers(): MapMarkerData[] {
    return Array.from(this.markers.values());
  }

  /**
   * Get markers by type
   */
  getMarkersByType(type: string): MapMarkerData[] {
    return Array.from(this.markers.values()).filter((m) => m.type === type);
  }

  /**
   * Add route to map
   */
  addRoute(route: RouteData): void {
    this.routes.set(route.id, route);
  }

  /**
   * Remove route
   */
  removeRoute(routeId: string): boolean {
    return this.routes.delete(routeId);
  }

  /**
   * Get all routes
   */
  getRoutes(): RouteData[] {
    return Array.from(this.routes.values());
  }

  /**
   * Add geofence zone
   */
  addGeofence(zone: GeofenceZoneData): void {
    this.geofences.set(zone.id, zone);
  }

  /**
   * Remove geofence
   */
  removeGeofence(zoneId: string): boolean {
    return this.geofences.delete(zoneId);
  }

  /**
   * Get all geofences
   */
  getGeofences(): GeofenceZoneData[] {
    return Array.from(this.geofences.values());
  }

  /**
   * Check if point is in geofence
   */
  isPointInGeofence(
    latitude: number,
    longitude: number,
    zoneId: string
  ): boolean {
    const zone = this.geofences.get(zoneId);
    if (!zone) return false;

    const distance = this.calculateDistance(
      latitude,
      longitude,
      zone.center.latitude,
      zone.center.longitude
    );

    return distance <= zone.radius;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate route distance
   */
  calculateRouteDistance(waypoints: Array<{ latitude: number; longitude: number }>): number {
    if (waypoints.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalDistance += this.calculateDistance(
        waypoints[i].latitude,
        waypoints[i].longitude,
        waypoints[i + 1].latitude,
        waypoints[i + 1].longitude
      );
    }

    return totalDistance;
  }

  /**
   * Calculate distance matrix (mock implementation)
   */
  async calculateDistanceMatrix(request: DistanceMatrixRequest): Promise<DistanceMatrixResponse> {
    // Mock implementation - in production, this would call Google Distance Matrix API
    const rows = request.origins.map((origin) => ({
      elements: request.destinations.map((destination) => {
        const distance = this.calculateDistance(
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude
        );

        // Estimate duration based on distance (average 50 km/h)
        const duration = Math.round(distance / 50000 * 3600);

        return {
          distance: {
            text: `${(distance / 1000).toFixed(1)} km`,
            value: Math.round(distance),
          },
          duration: {
            text: `${Math.round(duration / 60)} mins`,
            value: duration,
          },
          status: 'OK',
        };
      }),
    }));

    return {
      rows,
      status: 'OK',
    };
  }

  /**
   * Get nearby markers
   */
  getNearbyMarkers(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): MapMarkerData[] {
    return this.getMarkers().filter((marker) => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        marker.latitude,
        marker.longitude
      );
      return distance <= radiusMeters;
    });
  }

  /**
   * Fit bounds to show all markers
   */
  fitBoundsToMarkers(): { center: { latitude: number; longitude: number }; zoom: number } {
    const markers = this.getMarkers();
    if (markers.length === 0) {
      return { center: this.mapConfig.center, zoom: this.mapConfig.zoom };
    }

    const latitudes = markers.map((m) => m.latitude);
    const longitudes = markers.map((m) => m.longitude);

    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;

    // Calculate zoom level based on bounds
    const maxDistance = Math.max(
      this.calculateDistance(minLat, minLon, maxLat, maxLon),
      this.calculateDistance(minLat, maxLon, maxLat, minLon)
    );

    let zoom = 13;
    if (maxDistance > 50000) zoom = 10;
    else if (maxDistance > 20000) zoom = 11;
    else if (maxDistance > 10000) zoom = 12;
    else if (maxDistance > 5000) zoom = 13;
    else if (maxDistance > 2000) zoom = 14;
    else if (maxDistance > 1000) zoom = 15;
    else zoom = 16;

    return {
      center: { latitude: centerLat, longitude: centerLon },
      zoom,
    };
  }

  /**
   * Get map statistics
   */
  getMapStatistics(): {
    totalMarkers: number;
    markersByType: Record<string, number>;
    totalRoutes: number;
    totalGeofences: number;
    totalDistance: number;
  } {
    const markersByType: Record<string, number> = {};
    this.getMarkers().forEach((marker) => {
      markersByType[marker.type] = (markersByType[marker.type] || 0) + 1;
    });

    let totalDistance = 0;
    this.getRoutes().forEach((route) => {
      totalDistance += this.calculateRouteDistance(route.waypoints);
    });

    return {
      totalMarkers: this.markers.size,
      markersByType,
      totalRoutes: this.routes.size,
      totalGeofences: this.geofences.size,
      totalDistance,
    };
  }

  /**
   * Clear all map data
   */
  clearAllData(): void {
    this.markers.clear();
    this.routes.clear();
    this.geofences.clear();
  }

  /**
   * Validate API key (mock implementation)
   */
  async validateApiKey(): Promise<boolean> {
    // In production, this would make a real API call to validate the key
    return !!(this.apiKey && this.apiKey.length > 0);
  }

  /**
   * Get API key status
   */
  getApiKeyStatus(): {
    isValid: boolean;
    apiKey: string;
    lastValidated: number;
  } {
    return {
      isValid: !!(this.apiKey && this.apiKey.length > 0),
      apiKey: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'Not set',
      lastValidated: Date.now(),
    };
  }
}

// Create singleton instance
let googleMapsService: GoogleMapsService | null = null;

export function initializeGoogleMapsService(apiKey: string): GoogleMapsService {
  if (!googleMapsService) {
    googleMapsService = new GoogleMapsService(apiKey);
  }
  return googleMapsService;
}

export function getGoogleMapsService(): GoogleMapsService {
  if (!googleMapsService) {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    googleMapsService = new GoogleMapsService(apiKey);
  }
  return googleMapsService;
}
