import { describe, it, expect, beforeEach } from 'vitest';
import { GoogleMapsService, initializeGoogleMapsService, getGoogleMapsService } from '../lib/google-maps-service';
import { RealtimeTrackingService } from '../lib/realtime-tracking-service';
import { GeofenceDistanceService } from '../lib/geofence-distance-service';

describe('Google Maps Integration', () => {
  let mapsService: GoogleMapsService;
  let realtimeService: RealtimeTrackingService;
  let geofenceService: GeofenceDistanceService;

  beforeEach(() => {
    mapsService = new GoogleMapsService('AIzaSyBEOn1Y96vn6HQ2xWqZzPGsHLrII1Mdk8k');
    realtimeService = new RealtimeTrackingService();
    geofenceService = new GeofenceDistanceService();
  });

  describe('Google Maps Service', () => {
    it('should initialize with API key', () => {
      const config = mapsService.getMapConfig();
      expect(config.apiKey).toBeDefined();
      expect(config.center).toBeDefined();
      expect(config.zoom).toBe(13);
    });

    it('should add marker to map', () => {
      const marker = {
        id: 'test-marker',
        latitude: -10.3333,
        longitude: 28.2833,
        title: 'Test Marker',
        type: 'collector' as const,
        color: '#3B82F6',
      };

      mapsService.addMarker(marker);
      const markers = mapsService.getMarkers();

      expect(markers.length).toBeGreaterThan(0);
      expect(markers.some((m) => m.id === 'test-marker')).toBe(true);
    });

    it('should update marker position', () => {
      const marker = {
        id: 'test-marker-2',
        latitude: -10.3333,
        longitude: 28.2833,
        title: 'Test Marker',
        type: 'collector' as const,
        color: '#3B82F6',
      };

      mapsService.addMarker(marker);
      const updated = mapsService.updateMarkerPosition('test-marker-2', -10.35, 28.29);

      expect(updated).toBe(true);

      const markers = mapsService.getMarkers();
      const updatedMarker = markers.find((m) => m.id === 'test-marker-2');

      expect(updatedMarker?.latitude).toBe(-10.35);
      expect(updatedMarker?.longitude).toBe(28.29);
    });

    it('should remove marker', () => {
      const marker = {
        id: 'test-marker-3',
        latitude: -10.3333,
        longitude: 28.2833,
        title: 'Test Marker',
        type: 'collector' as const,
        color: '#3B82F6',
      };

      mapsService.addMarker(marker);
      const removed = mapsService.removeMarker('test-marker-3');

      expect(removed).toBe(true);
      expect(mapsService.getMarkers().some((m) => m.id === 'test-marker-3')).toBe(false);
    });

    it('should get markers by type', () => {
      const collectorMarker = {
        id: 'collector-1',
        latitude: -10.3333,
        longitude: 28.2833,
        title: 'Collector',
        type: 'collector' as const,
        color: '#3B82F6',
      };

      const subscriberMarker = {
        id: 'subscriber-1',
        latitude: -10.35,
        longitude: 28.29,
        title: 'Subscriber',
        type: 'subscriber' as const,
        color: '#10B981',
      };

      mapsService.addMarker(collectorMarker);
      mapsService.addMarker(subscriberMarker);

      const collectors = mapsService.getMarkersByType('collector');
      const subscribers = mapsService.getMarkersByType('subscriber');

      expect(collectors.length).toBeGreaterThan(0);
      expect(subscribers.length).toBeGreaterThan(0);
      expect(collectors.every((m) => m.type === 'collector')).toBe(true);
      expect(subscribers.every((m) => m.type === 'subscriber')).toBe(true);
    });

    it('should calculate route distance', () => {
      const waypoints = [
        { latitude: -10.3333, longitude: 28.2833 },
        { latitude: -10.35, longitude: 28.29 },
        { latitude: -10.37, longitude: 28.31 },
      ];

      const distance = mapsService.calculateRouteDistance(waypoints);
      expect(distance).toBeGreaterThan(0);
    });

    it('should get nearby markers', () => {
      const marker1 = {
        id: 'nearby-1',
        latitude: -10.3333,
        longitude: 28.2833,
        title: 'Nearby',
        type: 'collector' as const,
        color: '#3B82F6',
      };

      const marker2 = {
        id: 'nearby-2',
        latitude: -10.3335,
        longitude: 28.2835,
        title: 'Nearby 2',
        type: 'subscriber' as const,
        color: '#10B981',
      };

      mapsService.addMarker(marker1);
      mapsService.addMarker(marker2);

      const nearby = mapsService.getNearbyMarkers(-10.3333, 28.2833, 5000);
      expect(nearby.length).toBeGreaterThan(0);
    });

    it('should fit bounds to markers', () => {
      const marker1 = {
        id: 'bounds-1',
        latitude: -10.3,
        longitude: 28.28,
        title: 'Bounds 1',
        type: 'collector' as const,
        color: '#3B82F6',
      };

      const marker2 = {
        id: 'bounds-2',
        latitude: -10.37,
        longitude: 28.31,
        title: 'Bounds 2',
        type: 'subscriber' as const,
        color: '#10B981',
      };

      mapsService.addMarker(marker1);
      mapsService.addMarker(marker2);

      const bounds = mapsService.fitBoundsToMarkers();
      expect(bounds.center).toBeDefined();
      expect(bounds.zoom).toBeGreaterThan(0);
    });

    it('should validate API key', async () => {
      const isValid = await mapsService.validateApiKey();
      expect(typeof isValid).toBe('boolean');
    });

    it('should get API key status', () => {
      const status = mapsService.getApiKeyStatus();
      expect(status.isValid).toBe(true);
      expect(status.apiKey).toBeDefined();
      expect(status.lastValidated).toBeGreaterThan(0);
    });

    it('should get map statistics', () => {
      const stats = mapsService.getMapStatistics();
      expect(stats.totalMarkers).toBeGreaterThanOrEqual(0);
      expect(stats.markersByType).toBeDefined();
      expect(stats.totalRoutes).toBeGreaterThanOrEqual(0);
      expect(stats.totalGeofences).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Realtime Tracking Service', () => {
    it('should update user location', () => {
      realtimeService.updateUserLocation({
        userId: 'user-1',
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
      });

      const location = realtimeService.getUserLocation('user-1');
      expect(location).toBeDefined();
      expect(location?.latitude).toBe(-10.3333);
    });

    it('should get active locations', () => {
      realtimeService.updateUserLocation({
        userId: 'user-2',
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
      });

      const active = realtimeService.getActiveLocations();
      expect(active.length).toBeGreaterThan(0);
    });

    it('should start tracking session', () => {
      const session = realtimeService.startTrackingSession('user-3');
      expect(session).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.totalDistance).toBe(0);
    });

    it('should pause and resume tracking session', () => {
      const session = realtimeService.startTrackingSession('user-4');
      const paused = realtimeService.pauseTrackingSession(session.id);

      expect(paused?.status).toBe('paused');

      const resumed = realtimeService.resumeTrackingSession(session.id);
      expect(resumed?.status).toBe('active');
    });

    it('should stop tracking session', () => {
      const session = realtimeService.startTrackingSession('user-5');
      const stopped = realtimeService.stopTrackingSession(session.id);

      expect(stopped?.status).toBe('completed');
      expect(stopped?.endTime).toBeDefined();
    });

    it('should get tracking statistics', () => {
      realtimeService.startTrackingSession('user-6');

      const stats = realtimeService.getTrackingStatistics('user-6');
      expect(stats.activeSessions).toBeGreaterThanOrEqual(0);
      expect(stats.completedSessions).toBeGreaterThanOrEqual(0);
      expect(stats.totalDistance).toBeGreaterThanOrEqual(0);
      expect(stats.averageSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should get nearby users', () => {
      realtimeService.updateUserLocation({
        userId: 'user-7',
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
      });

      const nearby = realtimeService.getNearbyUsers(-10.3333, 28.2833, 5000);
      expect(Array.isArray(nearby)).toBe(true);
    });

    it('should get realtime dashboard data', () => {
      realtimeService.updateUserLocation({
        userId: 'user-8',
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
      });

      const dashboard = realtimeService.getRealtimeDashboardData();
      expect(dashboard.activeTrackers).toBeGreaterThanOrEqual(0);
      expect(dashboard.totalDistance).toBeGreaterThanOrEqual(0);
      expect(dashboard.averageSpeed).toBeGreaterThanOrEqual(0);
      expect(dashboard.activeSessions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Geofence and Distance Service', () => {
    it('should create geofence zone', () => {
      const zone = geofenceService.createGeofenceZone({
        id: 'zone-test',
        name: 'Test Zone',
        center: { latitude: -10.3333, longitude: 28.2833 },
        radius: 1000,
        type: 'collection_zone',
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        strokeWeight: 2,
        notifyOnEntry: true,
        notifyOnExit: true,
      });

      expect(zone).toBeDefined();
      expect(zone.id).toBe('zone-test');
      expect(zone.createdAt).toBeDefined();
    });

    it('should check if point is in geofence', () => {
      geofenceService.createGeofenceZone({
        id: 'zone-check',
        name: 'Check Zone',
        center: { latitude: -10.3333, longitude: 28.2833 },
        radius: 1000,
        type: 'collection_zone',
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        strokeWeight: 2,
        notifyOnEntry: true,
        notifyOnExit: true,
      });

      const isInside = geofenceService.isPointInGeofence(-10.3333, 28.2833, 'zone-check');
      expect(isInside).toBe(true);

      const isOutside = geofenceService.isPointInGeofence(-10.5, 28.5, 'zone-check');
      expect(isOutside).toBe(false);
    });

    it('should get zones containing point', () => {
      geofenceService.createGeofenceZone({
        id: 'zone-1',
        name: 'Zone 1',
        center: { latitude: -10.3333, longitude: 28.2833 },
        radius: 2000,
        type: 'collection_zone',
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        strokeWeight: 2,
        notifyOnEntry: true,
        notifyOnExit: true,
      });

      const zones = geofenceService.getZonesContainingPoint(-10.3333, 28.2833);
      expect(zones.length).toBeGreaterThan(0);
    });

    it('should detect geofence entry event', () => {
      geofenceService.createGeofenceZone({
        id: 'zone-entry',
        name: 'Entry Zone',
        center: { latitude: -10.3333, longitude: 28.2833 },
        radius: 1000,
        type: 'collection_zone',
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        strokeWeight: 2,
        notifyOnEntry: true,
        notifyOnExit: true,
      });

      const events = geofenceService.updateUserLocation('user-entry', -10.3333, 28.2833);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.eventType === 'entry')).toBe(true);
    });

    it('should calculate distance matrix', () => {
      const origins = [{ latitude: -10.3333, longitude: 28.2833 }];
      const destinations = [{ latitude: -10.35, longitude: 28.29 }];

      const matrix = geofenceService.calculateDistanceMatrix(origins, destinations, 'DRIVING');
      expect(matrix.length).toBeGreaterThan(0);
      expect(matrix[0].distance).toBeGreaterThan(0);
      expect(matrix[0].duration).toBeGreaterThan(0);
    });

    it('should get distance between two points', () => {
      const result = geofenceService.getDistance(
        { latitude: -10.3333, longitude: 28.2833 },
        { latitude: -10.35, longitude: 28.29 }
      );

      expect(result.distance).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should get geofence statistics', () => {
      const stats = geofenceService.getGeofenceStatistics();
      expect(stats.totalZones).toBeGreaterThanOrEqual(0);
      expect(stats.zonesByType).toBeDefined();
      expect(stats.totalEvents).toBeGreaterThanOrEqual(0);
      expect(stats.eventsByType).toBeDefined();
      expect(stats.usersInGeofences).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete tracking workflow with geofencing', () => {
      // 1. Add marker to map
      const marker = {
        id: 'workflow-collector',
        latitude: -10.3333,
        longitude: 28.2833,
        title: 'Workflow Collector',
        type: 'collector' as const,
        color: '#3B82F6',
      };

      mapsService.addMarker(marker);

      // 2. Start tracking session
      const session = realtimeService.startTrackingSession('workflow-user');
      expect(session.status).toBe('active');

      // 3. Update location
      realtimeService.updateUserLocation({
        userId: 'workflow-user',
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
      });

      // 4. Create geofence zone
      geofenceService.createGeofenceZone({
        id: 'workflow-zone',
        name: 'Workflow Zone',
        center: { latitude: -10.3333, longitude: 28.2833 },
        radius: 1000,
        type: 'collection_zone',
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
        strokeWeight: 2,
        notifyOnEntry: true,
        notifyOnExit: true,
      });

      // 5. Check geofence events
      const events = geofenceService.updateUserLocation('workflow-user', -10.3333, 28.2833);
      expect(events.length).toBeGreaterThan(0);

      // 6. Get statistics
      const mapStats = mapsService.getMapStatistics();
      const trackingStats = realtimeService.getTrackingStatistics('workflow-user');
      const geofenceStats = geofenceService.getGeofenceStatistics();

      expect(mapStats.totalMarkers).toBeGreaterThan(0);
      expect(trackingStats.activeSessions).toBeGreaterThan(0);
      expect(geofenceStats.totalZones).toBeGreaterThan(0);
    });
  });
});
