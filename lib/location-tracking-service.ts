/**
 * Location Tracking Service
 * Real-time location tracking for subscribers, collectors, and superadmins
 */

export interface LocationCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number; // meters
  altitude?: number;
  heading?: number; // degrees
  speed?: number; // m/s
}

export interface UserLocation extends LocationCoordinate {
  userId: string;
  userName: string;
  userRole: 'subscriber' | 'collector' | 'recycler' | 'superadmin';
  timestamp: number;
  address?: string;
  isActive: boolean;
}

export interface CollectionPoint {
  id: string;
  name: string;
  location: LocationCoordinate;
  address: string;
  type: 'residential' | 'commercial' | 'collection_hub';
  status: 'active' | 'inactive' | 'maintenance';
  subscriberId?: string;
  collectorId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface RouteSegment {
  id: string;
  collectorId: string;
  startLocation: LocationCoordinate;
  endLocation: LocationCoordinate;
  startTime: number;
  endTime: number;
  distance: number; // meters
  duration: number; // seconds
  waypoints: LocationCoordinate[];
  status: 'in_progress' | 'completed' | 'cancelled';
}

export interface GeofenceZone {
  id: string;
  name: string;
  center: LocationCoordinate;
  radius: number; // meters
  type: 'collection_zone' | 'restricted' | 'priority';
  status: 'active' | 'inactive';
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
}

export interface LocationHistory {
  userId: string;
  locations: UserLocation[];
  startTime: number;
  endTime: number;
  totalDistance: number; // meters
  totalDuration: number; // seconds
  averageSpeed: number; // m/s
}

export interface TrackingSession {
  id: string;
  userId: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'paused' | 'stopped';
  totalDistance: number;
  totalDuration: number;
  locations: UserLocation[];
  collectionPoints: CollectionPoint[];
}

export class LocationTrackingService {
  private userLocations: Map<string, UserLocation> = new Map();
  private collectionPoints: Map<string, CollectionPoint> = new Map();
  private routeSegments: Map<string, RouteSegment> = new Map();
  private geofenceZones: Map<string, GeofenceZone> = new Map();
  private trackingSessions: Map<string, TrackingSession> = new Map();
  private locationHistory: Map<string, LocationHistory> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  /**
   * Initialize sample data
   */
  private initializeSampleData(): void {
    // Sample collection points
    const collectionPoints: CollectionPoint[] = [
      {
        id: 'cp-1',
        name: 'Residential Collection Point - Lusaka North',
        location: { latitude: -10.3333, longitude: 28.2833, accuracy: 5 },
        address: '123 Independence Avenue, Lusaka',
        type: 'residential',
        status: 'active',
        subscriberId: 'sub-1',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'cp-2',
        name: 'Commercial Collection Point - Cairo Road',
        location: { latitude: -10.3367, longitude: 28.2833, accuracy: 5 },
        address: 'Cairo Road, Lusaka',
        type: 'commercial',
        status: 'active',
        subscriberId: 'sub-2',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
      {
        id: 'cp-3',
        name: 'Collection Hub - Kalingalinga',
        location: { latitude: -10.3667, longitude: 28.3167, accuracy: 5 },
        address: 'Kalingalinga, Lusaka',
        type: 'collection_hub',
        status: 'active',
        collectorId: 'col-1',
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now(),
      },
    ];

    collectionPoints.forEach((cp) => {
      this.collectionPoints.set(cp.id, cp);
    });

    // Sample geofence zones
    const geofenceZones: GeofenceZone[] = [
      {
        id: 'gf-1',
        name: 'Lusaka City Center Collection Zone',
        center: { latitude: -10.3333, longitude: 28.2833, accuracy: 0 },
        radius: 5000,
        type: 'collection_zone',
        status: 'active',
        notifyOnEntry: true,
        notifyOnExit: true,
      },
      {
        id: 'gf-2',
        name: 'Restricted Industrial Area',
        center: { latitude: -10.4, longitude: 28.35, accuracy: 0 },
        radius: 2000,
        type: 'restricted',
        status: 'active',
        notifyOnEntry: true,
        notifyOnExit: false,
      },
    ];

    geofenceZones.forEach((zone) => {
      this.geofenceZones.set(zone.id, zone);
    });
  }

  /**
   * Update user location
   */
  updateUserLocation(location: UserLocation): void {
    this.userLocations.set(location.userId, location);

    // Add to location history
    const history = this.locationHistory.get(location.userId);
    if (history) {
      history.locations.push(location);
      history.endTime = location.timestamp;
    } else {
      this.locationHistory.set(location.userId, {
        userId: location.userId,
        locations: [location],
        startTime: location.timestamp,
        endTime: location.timestamp,
        totalDistance: 0,
        totalDuration: 0,
        averageSpeed: 0,
      });
    }

    // Check geofence triggers
    this.checkGeofenceTriggers(location);
  }

  /**
   * Get user location
   */
  getUserLocation(userId: string): UserLocation | null {
    return this.userLocations.get(userId) || null;
  }

  /**
   * Get all active user locations
   */
  getActiveUserLocations(role?: string): UserLocation[] {
    const locations = Array.from(this.userLocations.values()).filter((loc) => loc.isActive);

    if (role) {
      return locations.filter((loc) => loc.userRole === role);
    }

    return locations;
  }

  /**
   * Get nearby users
   */
  getNearbyUsers(center: LocationCoordinate, radiusMeters: number): UserLocation[] {
    return this.getActiveUserLocations().filter((loc) => {
      const distance = this.calculateDistance(center, loc);
      return distance <= radiusMeters;
    });
  }

  /**
   * Create collection point
   */
  createCollectionPoint(point: CollectionPoint): CollectionPoint {
    this.collectionPoints.set(point.id, point);
    return point;
  }

  /**
   * Get collection point
   */
  getCollectionPoint(pointId: string): CollectionPoint | null {
    return this.collectionPoints.get(pointId) || null;
  }

  /**
   * Get all collection points
   */
  getAllCollectionPoints(): CollectionPoint[] {
    return Array.from(this.collectionPoints.values());
  }

  /**
   * Get nearby collection points
   */
  getNearbyCollectionPoints(center: LocationCoordinate, radiusMeters: number): CollectionPoint[] {
    return this.getAllCollectionPoints().filter((point) => {
      const distance = this.calculateDistance(center, point.location);
      return distance <= radiusMeters;
    });
  }

  /**
   * Create route segment
   */
  createRouteSegment(segment: RouteSegment): RouteSegment {
    this.routeSegments.set(segment.id, segment);
    return segment;
  }

  /**
   * Get route segment
   */
  getRouteSegment(segmentId: string): RouteSegment | null {
    return this.routeSegments.get(segmentId) || null;
  }

  /**
   * Get collector routes
   */
  getCollectorRoutes(collectorId: string): RouteSegment[] {
    return Array.from(this.routeSegments.values()).filter((seg) => seg.collectorId === collectorId);
  }

  /**
   * Create geofence zone
   */
  createGeofenceZone(zone: GeofenceZone): GeofenceZone {
    this.geofenceZones.set(zone.id, zone);
    return zone;
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
   * Check if location is in geofence
   */
  isLocationInGeofence(location: LocationCoordinate, zoneId: string): boolean {
    const zone = this.getGeofenceZone(zoneId);
    if (!zone) return false;

    const distance = this.calculateDistance(location, zone.center);
    return distance <= zone.radius;
  }

  /**
   * Get geofences containing location
   */
  getGeofencesContainingLocation(location: LocationCoordinate): GeofenceZone[] {
    return this.getAllGeofenceZones().filter((zone) => this.isLocationInGeofence(location, zone.id));
  }

  /**
   * Check geofence triggers
   */
  private checkGeofenceTriggers(location: UserLocation): {
    entered: GeofenceZone[];
    exited: GeofenceZone[];
  } {
    const entered: GeofenceZone[] = [];
    const exited: GeofenceZone[] = [];

    this.getAllGeofenceZones().forEach((zone) => {
      const isInZone = this.isLocationInGeofence(location, zone.id);

      // For demo purposes, we'll track entry/exit
      if (isInZone && zone.notifyOnEntry) {
        entered.push(zone);
      } else if (!isInZone && zone.notifyOnExit) {
        exited.push(zone);
      }
    });

    return { entered, exited };
  }

  /**
   * Start tracking session
   */
  startTrackingSession(userId: string): TrackingSession {
    const session: TrackingSession = {
      id: `session-${Date.now()}`,
      userId,
      startTime: Date.now(),
      status: 'active',
      totalDistance: 0,
      totalDuration: 0,
      locations: [],
      collectionPoints: [],
    };

    this.trackingSessions.set(session.id, session);
    return session;
  }

  /**
   * Stop tracking session
   */
  stopTrackingSession(sessionId: string): TrackingSession | null {
    const session = this.trackingSessions.get(sessionId);
    if (!session) return null;

    session.endTime = Date.now();
    session.status = 'stopped';
    session.totalDuration = (session.endTime - session.startTime) / 1000;

    return session;
  }

  /**
   * Get tracking session
   */
  getTrackingSession(sessionId: string): TrackingSession | null {
    return this.trackingSessions.get(sessionId) || null;
  }

  /**
   * Get user tracking sessions
   */
  getUserTrackingSessions(userId: string): TrackingSession[] {
    return Array.from(this.trackingSessions.values()).filter((session) => session.userId === userId);
  }

  /**
   * Get location history
   */
  getLocationHistory(userId: string, startTime?: number, endTime?: number): LocationHistory | null {
    const history = this.locationHistory.get(userId);
    if (!history) return null;

    if (startTime || endTime) {
      const filtered = history.locations.filter((loc) => {
        if (startTime && loc.timestamp < startTime) return false;
        if (endTime && loc.timestamp > endTime) return false;
        return true;
      });

      return {
        ...history,
        locations: filtered,
        totalDistance: this.calculateTotalDistance(filtered),
        totalDuration: this.calculateTotalDuration(filtered),
        averageSpeed: this.calculateAverageSpeed(filtered),
      };
    }

    return history;
  }

  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(coord1: LocationCoordinate, coord2: LocationCoordinate): number {
    const R = 6371000; // Earth's radius in meters
    const lat1 = (coord1.latitude * Math.PI) / 180;
    const lat2 = (coord2.latitude * Math.PI) / 180;
    const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate total distance from locations
   */
  private calculateTotalDistance(locations: LocationCoordinate[]): number {
    let total = 0;
    for (let i = 1; i < locations.length; i++) {
      total += this.calculateDistance(locations[i - 1], locations[i]);
    }
    return total;
  }

  /**
   * Calculate total duration from locations
   */
  private calculateTotalDuration(locations: UserLocation[]): number {
    if (locations.length < 2) return 0;
    return (locations[locations.length - 1].timestamp - locations[0].timestamp) / 1000;
  }

  /**
   * Calculate average speed
   */
  private calculateAverageSpeed(locations: UserLocation[]): number {
    const distance = this.calculateTotalDistance(locations);
    const duration = this.calculateTotalDuration(locations);
    return duration > 0 ? distance / duration : 0;
  }

  /**
   * Get movement analytics
   */
  getMovementAnalytics(userId: string, startTime: number, endTime: number): {
    totalDistance: number;
    totalDuration: number;
    averageSpeed: number;
    maxSpeed: number;
    collectionPointsVisited: number;
    geofenceZonesEntered: number;
    efficiency: number; // percentage
  } {
    const history = this.getLocationHistory(userId, startTime, endTime);
    if (!history) {
      return {
        totalDistance: 0,
        totalDuration: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        collectionPointsVisited: 0,
        geofenceZonesEntered: 0,
        efficiency: 0,
      };
    }

    const maxSpeed = Math.max(...history.locations.map((loc) => loc.speed || 0));
    const collectionPointsVisited = history.locations.filter((loc) => {
      return this.getNearbyCollectionPoints(loc, 50).length > 0;
    }).length;

    const geofenceZonesEntered = new Set(
      history.locations.flatMap((loc) => this.getGeofencesContainingLocation(loc).map((z) => z.id))
    ).size;

    // Efficiency: actual distance vs straight line distance
    const straightLineDistance = this.calculateDistance(
      history.locations[0],
      history.locations[history.locations.length - 1]
    );

    const efficiency = straightLineDistance > 0 ? (straightLineDistance / history.totalDistance) * 100 : 0;

    return {
      totalDistance: history.totalDistance,
      totalDuration: history.totalDuration,
      averageSpeed: history.averageSpeed,
      maxSpeed,
      collectionPointsVisited,
      geofenceZonesEntered,
      efficiency: Math.min(100, efficiency),
    };
  }

  /**
   * Get superadmin dashboard data
   */
  getSuperadminDashboardData(): {
    activeCollectors: number;
    activeSubscribers: number;
    totalDistance: number;
    collectionPointsActive: number;
    geofenceAlerts: number;
    averageEfficiency: number;
  } {
    const allLocations = this.getActiveUserLocations();
    const collectors = allLocations.filter((loc) => loc.userRole === 'collector');
    const subscribers = allLocations.filter((loc) => loc.userRole === 'subscriber');

    const totalDistance = Array.from(this.locationHistory.values()).reduce(
      (sum, history) => sum + history.totalDistance,
      0
    );

    const activeCollectionPoints = this.getAllCollectionPoints().filter((cp) => cp.status === 'active').length;

    return {
      activeCollectors: collectors.length,
      activeSubscribers: subscribers.length,
      totalDistance,
      collectionPointsActive: activeCollectionPoints,
      geofenceAlerts: 0, // Would be populated from actual geofence triggers
      averageEfficiency: 75, // Demo value
    };
  }
}

export const locationTrackingService = new LocationTrackingService();
