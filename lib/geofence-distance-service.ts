/**
 * Geofence and Distance Matrix Service
 * Handles geofence visualization, entry/exit detection, and distance calculations
 */

export interface GeofenceEvent {
  id: string;
  zoneId: string;
  userId: string;
  eventType: 'entry' | 'exit' | 'dwell';
  latitude: number;
  longitude: number;
  timestamp: number;
  duration?: number; // for dwell events
}

export interface DistanceMatrixElement {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  distance: number; // meters
  duration: number; // seconds
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';
}

export interface GeofenceZone {
  id: string;
  name: string;
  center: { latitude: number; longitude: number };
  radius: number; // meters
  type: 'collection_zone' | 'restricted_area' | 'service_area';
  color: string;
  fillColor: string;
  fillOpacity: number;
  strokeWeight: number;
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserGeofenceState {
  userId: string;
  currentZones: string[]; // Zone IDs user is currently in
  lastUpdate: number;
  dwellStartTime?: number; // When user entered current zone
}

export class GeofenceDistanceService {
  private geofenceZones: Map<string, GeofenceZone> = new Map();
  private geofenceEvents: GeofenceEvent[] = [];
  private userGeofenceStates: Map<string, UserGeofenceState> = new Map();
  private geofenceEventListeners: Array<(event: GeofenceEvent) => void> = [];
  private distanceCache: Map<string, DistanceMatrixElement> = new Map();

  constructor() {
    this.initializeSampleGeofences();
  }

  /**
   * Initialize sample geofences
   */
  private initializeSampleGeofences(): void {
    const zones: GeofenceZone[] = [
      {
        id: 'zone-1',
        name: 'Central Collection Zone',
        center: { latitude: -10.3333, longitude: 28.2833 },
        radius: 2000,
        type: 'collection_zone',
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        strokeWeight: 2,
        notifyOnEntry: true,
        notifyOnExit: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'zone-2',
        name: 'Restricted Area',
        center: { latitude: -10.3450, longitude: 28.2950 },
        radius: 500,
        type: 'restricted_area',
        color: '#EF4444',
        fillColor: '#EF4444',
        fillOpacity: 0.15,
        strokeWeight: 2,
        notifyOnEntry: true,
        notifyOnExit: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'zone-3',
        name: 'Service Area - North',
        center: { latitude: -10.3300, longitude: 28.2800 },
        radius: 3000,
        type: 'service_area',
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: 0.08,
        strokeWeight: 1,
        notifyOnEntry: false,
        notifyOnExit: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    zones.forEach((zone) => this.geofenceZones.set(zone.id, zone));
  }

  /**
   * Create geofence zone
   */
  createGeofenceZone(zone: Omit<GeofenceZone, 'createdAt' | 'updatedAt'>): GeofenceZone {
    const newZone: GeofenceZone = {
      ...zone,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.geofenceZones.set(zone.id, newZone);
    return newZone;
  }

  /**
   * Get geofence zone
   */
  getGeofenceZone(zoneId: string): GeofenceZone | null {
    return this.geofenceZones.get(zoneId) || null;
  }

  /**
   * Get all geofence zones
   */
  getAllGeofenceZones(): GeofenceZone[] {
    return Array.from(this.geofenceZones.values());
  }

  /**
   * Update geofence zone
   */
  updateGeofenceZone(zoneId: string, updates: Partial<GeofenceZone>): GeofenceZone | null {
    const zone = this.geofenceZones.get(zoneId);
    if (!zone) return null;

    const updated: GeofenceZone = {
      ...zone,
      ...updates,
      id: zone.id, // Don't allow ID change
      createdAt: zone.createdAt, // Don't allow creation time change
      updatedAt: Date.now(),
    };

    this.geofenceZones.set(zoneId, updated);
    return updated;
  }

  /**
   * Delete geofence zone
   */
  deleteGeofenceZone(zoneId: string): boolean {
    return this.geofenceZones.delete(zoneId);
  }

  /**
   * Check if point is in geofence
   */
  isPointInGeofence(
    latitude: number,
    longitude: number,
    zoneId: string
  ): boolean {
    const zone = this.geofenceZones.get(zoneId);
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
   * Get zones containing point
   */
  getZonesContainingPoint(latitude: number, longitude: number): GeofenceZone[] {
    return Array.from(this.geofenceZones.values()).filter((zone) =>
      this.isPointInGeofence(latitude, longitude, zone.id)
    );
  }

  /**
   * Update user location and check geofence events
   */
  updateUserLocation(
    userId: string,
    latitude: number,
    longitude: number
  ): GeofenceEvent[] {
    const events: GeofenceEvent[] = [];
    const currentZones = this.getZonesContainingPoint(latitude, longitude);
    const currentZoneIds = currentZones.map((z) => z.id);

    const userState = this.userGeofenceStates.get(userId) || {
      userId,
      currentZones: [],
      lastUpdate: Date.now(),
    };

    // Detect entry events
    for (const zone of currentZones) {
      if (!userState.currentZones.includes(zone.id)) {
        const event: GeofenceEvent = {
          id: `event-${Date.now()}`,
          zoneId: zone.id,
          userId,
          eventType: 'entry',
          latitude,
          longitude,
          timestamp: Date.now(),
        };

        events.push(event);
        this.geofenceEvents.push(event);

        if (zone.notifyOnEntry) {
          this.notifyGeofenceEvent(event);
        }
      }
    }

    // Detect exit events
    for (const zoneId of userState.currentZones) {
      if (!currentZoneIds.includes(zoneId)) {
        const zone = this.geofenceZones.get(zoneId);
        if (zone) {
          const event: GeofenceEvent = {
            id: `event-${Date.now()}`,
            zoneId,
            userId,
            eventType: 'exit',
            latitude,
            longitude,
            timestamp: Date.now(),
            duration: Date.now() - (userState.dwellStartTime || Date.now()),
          };

          events.push(event);
          this.geofenceEvents.push(event);

          if (zone.notifyOnExit) {
            this.notifyGeofenceEvent(event);
          }
        }
      }
    }

    // Update user state
    userState.currentZones = currentZoneIds;
    userState.lastUpdate = Date.now();
    if (currentZoneIds.length > 0) {
      userState.dwellStartTime = userState.dwellStartTime || Date.now();
    } else {
      userState.dwellStartTime = undefined;
    }

    this.userGeofenceStates.set(userId, userState);

    return events;
  }

  /**
   * Get user geofence state
   */
  getUserGeofenceState(userId: string): UserGeofenceState | null {
    return this.userGeofenceStates.get(userId) || null;
  }

  /**
   * Subscribe to geofence events
   */
  subscribeToGeofenceEvents(callback: (event: GeofenceEvent) => void): () => void {
    this.geofenceEventListeners.push(callback);

    return () => {
      const index = this.geofenceEventListeners.indexOf(callback);
      if (index > -1) {
        this.geofenceEventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify geofence event
   */
  private notifyGeofenceEvent(event: GeofenceEvent): void {
    this.geofenceEventListeners.forEach((callback) => callback(event));
  }

  /**
   * Get geofence events for user
   */
  getUserGeofenceEvents(userId: string, limit: number = 100): GeofenceEvent[] {
    return this.geofenceEvents
      .filter((event) => event.userId === userId)
      .slice(-limit);
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
   * Calculate distance matrix
   */
  calculateDistanceMatrix(
    origins: Array<{ latitude: number; longitude: number }>,
    destinations: Array<{ latitude: number; longitude: number }>,
    travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' = 'DRIVING'
  ): DistanceMatrixElement[] {
    const elements: DistanceMatrixElement[] = [];

    for (const origin of origins) {
      for (const destination of destinations) {
        const cacheKey = `${origin.latitude},${origin.longitude}-${destination.latitude},${destination.longitude}-${travelMode}`;

        let element = this.distanceCache.get(cacheKey);

        if (!element) {
          const distance = this.calculateDistance(
            origin.latitude,
            origin.longitude,
            destination.latitude,
            destination.longitude
          );

          // Estimate duration based on travel mode
          let speedMs = 15; // Default: 15 m/s (54 km/h for driving)
          if (travelMode === 'WALKING') speedMs = 1.4; // 5 km/h
          else if (travelMode === 'BICYCLING') speedMs = 5; // 18 km/h
          else if (travelMode === 'TRANSIT') speedMs = 10; // 36 km/h

          element = {
            origin,
            destination,
            distance: Math.round(distance),
            duration: Math.round(distance / speedMs),
            travelMode,
          };

          this.distanceCache.set(cacheKey, element);
        }

        elements.push(element);
      }
    }

    return elements;
  }

  /**
   * Get distance between two points
   */
  getDistance(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): { distance: number; duration: number } {
    const distance = this.calculateDistance(
      origin.latitude,
      origin.longitude,
      destination.latitude,
      destination.longitude
    );

    // Estimate duration (average 15 m/s for driving)
    const duration = Math.round(distance / 15);

    return {
      distance: Math.round(distance),
      duration,
    };
  }

  /**
   * Get geofence statistics
   */
  getGeofenceStatistics(): {
    totalZones: number;
    zonesByType: Record<string, number>;
    totalEvents: number;
    eventsByType: Record<string, number>;
    usersInGeofences: number;
  } {
    const zonesByType: Record<string, number> = {};
    const eventsByType: Record<string, number> = {};

    for (const zone of this.geofenceZones.values()) {
      zonesByType[zone.type] = (zonesByType[zone.type] || 0) + 1;
    }

    for (const event of this.geofenceEvents) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
    }

    const usersInGeofences = new Set(
      Array.from(this.userGeofenceStates.values())
        .filter((state) => state.currentZones.length > 0)
        .map((state) => state.userId)
    ).size;

    return {
      totalZones: this.geofenceZones.size,
      zonesByType,
      totalEvents: this.geofenceEvents.length,
      eventsByType,
      usersInGeofences,
    };
  }

  /**
   * Clear old events
   */
  clearOldEvents(olderThanMs: number = 86400000): void {
    const cutoffTime = Date.now() - olderThanMs;
    this.geofenceEvents = this.geofenceEvents.filter((event) => event.timestamp > cutoffTime);
  }

  /**
   * Clear distance cache
   */
  clearDistanceCache(): void {
    this.distanceCache.clear();
  }
}

export const geofenceDistanceService = new GeofenceDistanceService();
