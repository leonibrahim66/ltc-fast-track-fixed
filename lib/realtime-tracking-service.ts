/**
 * Real-time Tracking Service
 * Handles real-time marker updates and route tracking with WebSocket support
 */

export interface RealtimeLocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface RouteUpdate {
  routeId: string;
  collectorId: string;
  waypoint: { latitude: number; longitude: number };
  timestamp: number;
  distanceTraveled: number;
  estimatedTimeRemaining: number;
}

export interface TrackingSession {
  id: string;
  userId: string;
  startTime: number;
  endTime?: number;
  totalDistance: number;
  averageSpeed: number;
  maxSpeed: number;
  waypoints: Array<{ latitude: number; longitude: number; timestamp: number }>;
  status: 'active' | 'paused' | 'completed';
}

export interface LocationUpdateListener {
  userId: string;
  callback: (update: RealtimeLocationUpdate) => void;
}

export interface RouteUpdateListener {
  routeId: string;
  callback: (update: RouteUpdate) => void;
}

export class RealtimeTrackingService {
  private locationUpdates: Map<string, RealtimeLocationUpdate> = new Map();
  private routeUpdates: Map<string, RouteUpdate> = new Map();
  private trackingSessions: Map<string, TrackingSession> = new Map();
  private locationListeners: LocationUpdateListener[] = [];
  private routeListeners: RouteUpdateListener[] = [];
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private wsConnections: Map<string, any> = new Map();

  constructor() {
    this.startUpdateBroadcasting();
  }

  /**
   * Start broadcasting location updates
   */
  private startUpdateBroadcasting(): void {
    this.updateInterval = setInterval(() => {
      this.broadcastLocationUpdates();
      this.broadcastRouteUpdates();
    }, 1000); // Broadcast every second
  }

  /**
   * Stop broadcasting
   */
  stopBroadcasting(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update user location in real-time
   */
  updateUserLocation(update: RealtimeLocationUpdate): void {
    this.locationUpdates.set(update.userId, update);

    // Update active tracking session if exists
    const session = this.getActiveTrackingSession(update.userId);
    if (session && session.waypoints.length > 0) {
      const lastWaypoint = session.waypoints[session.waypoints.length - 1];
      const distance = this.calculateDistance(
        lastWaypoint.latitude,
        lastWaypoint.longitude,
        update.latitude,
        update.longitude
      );

      session.totalDistance += distance;
      session.waypoints.push({
        latitude: update.latitude,
        longitude: update.longitude,
        timestamp: update.timestamp,
      });

      // Update average speed
      const duration = (update.timestamp - session.startTime) / 1000; // seconds
      session.averageSpeed = session.totalDistance / duration;

      // Update max speed
      if (update.speed && update.speed > session.maxSpeed) {
        session.maxSpeed = update.speed;
      }
    } else if (session && session.waypoints.length === 0) {
      // Initialize first waypoint
      session.waypoints.push({
        latitude: update.latitude,
        longitude: update.longitude,
        timestamp: update.timestamp,
      });
    }
  }

  /**
   * Get latest location for user
   */
  getUserLocation(userId: string): RealtimeLocationUpdate | null {
    return this.locationUpdates.get(userId) || null;
  }

  /**
   * Get all active locations
   */
  getActiveLocations(): RealtimeLocationUpdate[] {
    const now = Date.now();
    return Array.from(this.locationUpdates.values()).filter(
      (update) => now - update.timestamp < 60000 // Last update within 60 seconds
    );
  }

  /**
   * Subscribe to location updates
   */
  subscribeToLocationUpdates(
    userId: string,
    callback: (update: RealtimeLocationUpdate) => void
  ): () => void {
    const listener: LocationUpdateListener = { userId, callback };
    this.locationListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.locationListeners.indexOf(listener);
      if (index > -1) {
        this.locationListeners.splice(index, 1);
      }
    };
  }

  /**
   * Broadcast location updates to subscribers
   */
  private broadcastLocationUpdates(): void {
    this.locationUpdates.forEach((update) => {
      this.locationListeners
        .filter((listener) => listener.userId === update.userId)
        .forEach((listener) => {
          listener.callback(update);
        });
    });
  }

  /**
   * Update route progress
   */
  updateRouteProgress(update: RouteUpdate): void {
    this.routeUpdates.set(update.routeId, update);
  }

  /**
   * Get route update
   */
  getRouteUpdate(routeId: string): RouteUpdate | null {
    return this.routeUpdates.get(routeId) || null;
  }

  /**
   * Subscribe to route updates
   */
  subscribeToRouteUpdates(
    routeId: string,
    callback: (update: RouteUpdate) => void
  ): () => void {
    const listener: RouteUpdateListener = { routeId, callback };
    this.routeListeners.push(listener);

    return () => {
      const index = this.routeListeners.indexOf(listener);
      if (index > -1) {
        this.routeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Broadcast route updates
   */
  private broadcastRouteUpdates(): void {
    this.routeUpdates.forEach((update) => {
      this.routeListeners
        .filter((listener) => listener.routeId === update.routeId)
        .forEach((listener) => {
          listener.callback(update);
        });
    });
  }

  /**
   * Start tracking session
   */
  startTrackingSession(userId: string, collectorId?: string): TrackingSession {
    const sessionId = `session-${Date.now()}`;
    const currentLocation = this.getUserLocation(userId);

    const session: TrackingSession = {
      id: sessionId,
      userId,
      startTime: Date.now(),
      totalDistance: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      waypoints: currentLocation
        ? [
            {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              timestamp: currentLocation.timestamp,
            },
          ]
        : [],
      status: 'active',
    };

    this.trackingSessions.set(sessionId, session);
    return session;
  }

  /**
   * Get active tracking session
   */
  getActiveTrackingSession(userId: string): TrackingSession | null {
    for (const session of this.trackingSessions.values()) {
      if (session.userId === userId && session.status === 'active') {
        return session;
      }
    }
    return null;
  }

  /**
   * Pause tracking session
   */
  pauseTrackingSession(sessionId: string): TrackingSession | null {
    const session = this.trackingSessions.get(sessionId);
    if (session) {
      session.status = 'paused';
    }
    return session || null;
  }

  /**
   * Resume tracking session
   */
  resumeTrackingSession(sessionId: string): TrackingSession | null {
    const session = this.trackingSessions.get(sessionId);
    if (session) {
      session.status = 'active';
    }
    return session || null;
  }

  /**
   * Stop tracking session
   */
  stopTrackingSession(sessionId: string): TrackingSession | null {
    const session = this.trackingSessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.endTime = Date.now();
    }
    return session || null;
  }

  /**
   * Get tracking session
   */
  getTrackingSession(sessionId: string): TrackingSession | null {
    return this.trackingSessions.get(sessionId) || null;
  }

  /**
   * Get all tracking sessions for user
   */
  getUserTrackingSessions(userId: string): TrackingSession[] {
    return Array.from(this.trackingSessions.values()).filter((s) => s.userId === userId);
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
   * Get tracking statistics
   */
  getTrackingStatistics(userId: string): {
    activeSessions: number;
    completedSessions: number;
    totalDistance: number;
    averageSpeed: number;
    lastLocation?: RealtimeLocationUpdate;
  } {
    const sessions = this.getUserTrackingSessions(userId);
    const lastLocation = this.getUserLocation(userId);

    const activeSessions = sessions.filter((s) => s.status === 'active').length;
    const completedSessions = sessions.filter((s) => s.status === 'completed').length;
    const totalDistance = sessions.reduce((sum, s) => sum + s.totalDistance, 0);
    const averageSpeed =
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.averageSpeed, 0) / sessions.length
        : 0;

    return {
      activeSessions,
      completedSessions,
      totalDistance,
      averageSpeed,
      lastLocation: lastLocation || undefined,
    };
  }

  /**
   * Get nearby users
   */
  getNearbyUsers(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): RealtimeLocationUpdate[] {
    return this.getActiveLocations().filter((update) => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        update.latitude,
        update.longitude
      );
      return distance <= radiusMeters;
    });
  }

  /**
   * Get route efficiency
   */
  getRouteEfficiency(sessionId: string): number {
    const session = this.getTrackingSession(sessionId);
    if (!session || session.waypoints.length < 2) return 0;

    // Calculate straight-line distance
    const straightLineDistance = this.calculateDistance(
      session.waypoints[0].latitude,
      session.waypoints[0].longitude,
      session.waypoints[session.waypoints.length - 1].latitude,
      session.waypoints[session.waypoints.length - 1].longitude
    );

    if (straightLineDistance === 0) return 100;

    // Efficiency = (straight line distance / actual distance) * 100
    return Math.min(100, (straightLineDistance / session.totalDistance) * 100);
  }

  /**
   * Get estimated time of arrival
   */
  getEstimatedTimeOfArrival(
    currentLat: number,
    currentLon: number,
    destinationLat: number,
    destinationLon: number,
    averageSpeed: number = 15 // km/h
  ): number {
    const distance = this.calculateDistance(currentLat, currentLon, destinationLat, destinationLon);
    const speedMs = (averageSpeed * 1000) / 3600; // Convert km/h to m/s
    return Math.round(distance / speedMs); // seconds
  }

  /**
   * Clear old tracking data
   */
  clearOldData(olderThanMs: number = 86400000): void {
    // Default: 24 hours
    const cutoffTime = Date.now() - olderThanMs;

    // Clear old location updates
    for (const [userId, update] of this.locationUpdates.entries()) {
      if (update.timestamp < cutoffTime) {
        this.locationUpdates.delete(userId);
      }
    }

    // Clear old tracking sessions
    for (const [sessionId, session] of this.trackingSessions.entries()) {
      if (session.endTime && session.endTime < cutoffTime) {
        this.trackingSessions.delete(sessionId);
      }
    }
  }

  /**
   * Get real-time dashboard data
   */
  getRealtimeDashboardData(): {
    activeTrackers: number;
    totalDistance: number;
    averageSpeed: number;
    activeSessions: number;
    recentLocations: RealtimeLocationUpdate[];
  } {
    const activeLocations = this.getActiveLocations();
    const activeSessions = Array.from(this.trackingSessions.values()).filter(
      (s) => s.status === 'active'
    ).length;

    let totalDistance = 0;
    let totalSpeed = 0;

    for (const session of this.trackingSessions.values()) {
      totalDistance += session.totalDistance;
      totalSpeed += session.averageSpeed;
    }

    const sessions = Array.from(this.trackingSessions.values());
    const averageSpeed = sessions.length > 0 ? totalSpeed / sessions.length : 0;

    return {
      activeTrackers: activeLocations.length,
      totalDistance,
      averageSpeed,
      activeSessions,
      recentLocations: activeLocations.slice(0, 10),
    };
  }
}

export const realtimeTrackingService = new RealtimeTrackingService();
