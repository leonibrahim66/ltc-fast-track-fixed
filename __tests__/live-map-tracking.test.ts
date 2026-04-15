import { describe, it, expect, beforeEach } from 'vitest';
import { LocationTrackingService } from '../lib/location-tracking-service';
import { LocationPermissionsService } from '../lib/location-permissions-service';

describe('Live Map Tracking Features', () => {
  let trackingService: LocationTrackingService;
  let permissionsService: LocationPermissionsService;

  beforeEach(() => {
    trackingService = new LocationTrackingService();
    permissionsService = new LocationPermissionsService();
  });

  describe('Location Tracking Service', () => {
    it('should update user location', () => {
      const location = {
        userId: 'col-1',
        userName: 'John Collector',
        userRole: 'collector' as const,
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
        isActive: true,
      };

      trackingService.updateUserLocation(location);
      const retrieved = trackingService.getUserLocation('col-1');

      expect(retrieved).toBeDefined();
      expect(retrieved?.latitude).toBe(-10.3333);
      expect(retrieved?.longitude).toBe(28.2833);
    });

    it('should get active user locations', () => {
      // Add a location first
      trackingService.updateUserLocation({
        userId: 'test-col',
        userName: 'Test Collector',
        userRole: 'collector',
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
        isActive: true,
      });

      const locations = trackingService.getActiveUserLocations();

      expect(Array.isArray(locations)).toBe(true);
      expect(locations.length).toBeGreaterThan(0);
      expect(locations.every((l) => l.isActive)).toBe(true);
    });

    it('should filter users by role', () => {
      const collectors = trackingService.getActiveUserLocations('collector');

      expect(Array.isArray(collectors)).toBe(true);
      expect(collectors.every((l) => l.userRole === 'collector')).toBe(true);
    });

    it('should find nearby users', () => {
      // Add a location first
      trackingService.updateUserLocation({
        userId: 'test-col-2',
        userName: 'Test Collector 2',
        userRole: 'collector',
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
        isActive: true,
      });

      const center = { latitude: -10.3333, longitude: 28.2833, accuracy: 0 };
      const nearby = trackingService.getNearbyUsers(center, 5000); // 5km radius

      expect(Array.isArray(nearby)).toBe(true);
      expect(nearby.length).toBeGreaterThan(0);
    });

    it('should create collection point', () => {
      const point = trackingService.createCollectionPoint({
        id: 'cp-test',
        name: 'Test Collection Point',
        location: { latitude: -10.35, longitude: 28.29, accuracy: 5 },
        address: 'Test Address',
        type: 'residential',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(point).toBeDefined();
      expect(point.id).toBe('cp-test');
      expect(point.status).toBe('active');
    });

    it('should get nearby collection points', () => {
      const center = { latitude: -10.3333, longitude: 28.2833, accuracy: 0 };
      const nearby = trackingService.getNearbyCollectionPoints(center, 5000);

      expect(Array.isArray(nearby)).toBe(true);
      expect(nearby.length).toBeGreaterThan(0);
    });

    it('should create route segment', () => {
      const segment = trackingService.createRouteSegment({
        id: 'route-1',
        collectorId: 'col-1',
        startLocation: { latitude: -10.3333, longitude: 28.2833, accuracy: 5 },
        endLocation: { latitude: -10.35, longitude: 28.29, accuracy: 5 },
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
        distance: 5000,
        duration: 3600,
        waypoints: [],
        status: 'completed',
      });

      expect(segment).toBeDefined();
      expect(segment.status).toBe('completed');
    });

    it('should get collector routes', () => {
      const routes = trackingService.getCollectorRoutes('col-1');

      expect(Array.isArray(routes)).toBe(true);
    });

    it('should create geofence zone', () => {
      const zone = trackingService.createGeofenceZone({
        id: 'gf-test',
        name: 'Test Zone',
        center: { latitude: -10.3333, longitude: 28.2833, accuracy: 0 },
        radius: 1000,
        type: 'collection_zone',
        status: 'active',
        notifyOnEntry: true,
        notifyOnExit: true,
      });

      expect(zone).toBeDefined();
      expect(zone.radius).toBe(1000);
    });

    it('should check if location is in geofence', () => {
      const zone = trackingService.createGeofenceZone({
        id: 'gf-check',
        name: 'Check Zone',
        center: { latitude: -10.3333, longitude: 28.2833, accuracy: 0 },
        radius: 1000,
        type: 'collection_zone',
        status: 'active',
        notifyOnEntry: true,
        notifyOnExit: true,
      });

      const location = { latitude: -10.3333, longitude: 28.2833, accuracy: 5 };
      const isInZone = trackingService.isLocationInGeofence(location, zone.id);

      expect(isInZone).toBe(true);
    });

    it('should start tracking session', () => {
      const session = trackingService.startTrackingSession('col-1');

      expect(session).toBeDefined();
      expect(session.userId).toBe('col-1');
      expect(session.status).toBe('active');
    });

    it('should stop tracking session', () => {
      const session = trackingService.startTrackingSession('col-1');
      const stopped = trackingService.stopTrackingSession(session.id);

      expect(stopped).toBeDefined();
      expect(stopped?.status).toBe('stopped');
      expect(stopped?.endTime).toBeDefined();
    });

    it('should get movement analytics', () => {
      const now = Date.now();
      const analytics = trackingService.getMovementAnalytics('col-1', now - 3600000, now);

      expect(analytics).toBeDefined();
      expect(analytics.totalDistance).toBeGreaterThanOrEqual(0);
      expect(analytics.totalDuration).toBeGreaterThanOrEqual(0);
      expect(analytics.averageSpeed).toBeGreaterThanOrEqual(0);
      expect(analytics.efficiency).toBeGreaterThanOrEqual(0);
      expect(analytics.efficiency).toBeLessThanOrEqual(100);
    });

    it('should get superadmin dashboard data', () => {
      const data = trackingService.getSuperadminDashboardData();

      expect(data).toBeDefined();
      expect(data.activeCollectors).toBeGreaterThanOrEqual(0);
      expect(data.activeSubscribers).toBeGreaterThanOrEqual(0);
      expect(data.totalDistance).toBeGreaterThanOrEqual(0);
      expect(data.collectionPointsActive).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Location Permissions Service', () => {
    it('should grant location permission', () => {
      const permission = permissionsService.grantPermission({
        userId: 'col-1',
        grantedBy: 'admin-1',
        grantedTo: 'sub-1',
        permissionType: 'view_location',
        grantedAt: Date.now(),
      });

      expect(permission).toBeDefined();
      expect(permission.isActive).toBe(true);
    });

    it('should revoke location permission', () => {
      permissionsService.grantPermission({
        userId: 'col-1',
        grantedBy: 'admin-1',
        grantedTo: 'sub-1',
        permissionType: 'view_location',
        grantedAt: Date.now(),
      });

      const revoked = permissionsService.revokePermission('col-1', 'sub-1');
      expect(revoked).toBe(true);
    });

    it('should check if user has permission', () => {
      permissionsService.grantPermission({
        userId: 'col-1',
        grantedBy: 'admin-1',
        grantedTo: 'sub-1',
        permissionType: 'view_location',
        grantedAt: Date.now(),
      });

      const hasPermission = permissionsService.hasPermission('col-1', 'sub-1', 'view_location');
      expect(hasPermission).toBe(true);
    });

    it('should get or create sharing preference', () => {
      const preference = permissionsService.getOrCreatePreference('test-user');

      expect(preference).toBeDefined();
      expect(preference.userId).toBe('test-user');
      expect(preference.shareWith).toBeDefined();
    });

    it('should update sharing preference', () => {
      const updated = permissionsService.updatePreference('test-user', {
        shareWith: {
          subscribers: true,
          collectors: false,
          superadmins: true,
        },
      });

      expect(updated.shareWith.subscribers).toBe(true);
      expect(updated.shareWith.collectors).toBe(false);
    });

    it('should check if can access location data', () => {
      permissionsService.grantPermission({
        userId: 'col-1',
        grantedBy: 'admin-1',
        grantedTo: 'sub-1',
        permissionType: 'view_location',
        grantedAt: Date.now(),
      });

      permissionsService.updatePreference('col-1', {
        shareData: {
          currentLocation: true,
          locationHistory: false,
          movementAnalytics: false,
          collectionHistory: true,
        },
      });

      const canAccess = permissionsService.canAccessLocationData('col-1', 'sub-1', 'currentLocation');
      expect(canAccess).toBe(true);
    });

    it('should get access logs', () => {
      permissionsService.grantPermission({
        userId: 'col-1',
        grantedBy: 'admin-1',
        grantedTo: 'sub-1',
        permissionType: 'view_location',
        grantedAt: Date.now(),
      });

      const logs = permissionsService.getAccessLogs('col-1');
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should request data export', () => {
      const now = Date.now();
      const dataExport = permissionsService.requestDataExport(
        'col-1',
        'admin-1',
        'history',
        now - 86400000,
        now
      );

      expect(dataExport).toBeDefined();
      expect(dataExport.status).toBe('pending');
      expect(dataExport.exportType).toBe('history');
    });

    it('should get privacy compliance report', () => {
      const report = permissionsService.getPrivacyComplianceReport('col-1');

      expect(report).toBeDefined();
      expect(report.privacyScore).toBeGreaterThanOrEqual(0);
      expect(report.privacyScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should get permission statistics', () => {
      const stats = permissionsService.getPermissionStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalUsers).toBeGreaterThanOrEqual(0);
      expect(stats.usersWithPermissions).toBeGreaterThanOrEqual(0);
      expect(stats.totalPermissions).toBeGreaterThanOrEqual(0);
      expect(stats.permissionsByType).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should track collector movement and verify permissions', () => {
      // 1. Update collector location
      const location = {
        userId: 'col-1',
        userName: 'John Collector',
        userRole: 'collector' as const,
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
        isActive: true,
      };

      trackingService.updateUserLocation(location);

      // 2. Grant permission to subscriber
      permissionsService.grantPermission({
        userId: 'col-1',
        grantedBy: 'admin-1',
        grantedTo: 'sub-1',
        permissionType: 'view_location',
        grantedAt: Date.now(),
      });

      // 3. Verify subscriber can access location
      const hasPermission = permissionsService.hasPermission('col-1', 'sub-1', 'view_location');
      expect(hasPermission).toBe(true);

      // 4. Get collector location
      const collectorLocation = trackingService.getUserLocation('col-1');
      expect(collectorLocation).toBeDefined();
      expect(collectorLocation?.latitude).toBe(-10.3333);
    });

    it('should handle complete collection workflow with tracking', () => {
      // 1. Start tracking session
      const session = trackingService.startTrackingSession('col-1');
      expect(session.status).toBe('active');

      // 2. Update location multiple times
      for (let i = 0; i < 5; i++) {
        trackingService.updateUserLocation({
          userId: 'col-1',
          userName: 'John Collector',
          userRole: 'collector',
          latitude: -10.3333 + i * 0.001,
          longitude: 28.2833 + i * 0.001,
          accuracy: 5,
          timestamp: Date.now() + i * 60000,
          isActive: true,
        });
      }

      // 3. Get movement analytics
      const now = Date.now();
      const analytics = trackingService.getMovementAnalytics('col-1', now - 600000, now);
      // Distance should be calculated from the location updates
      expect(analytics).toBeDefined();
      expect(analytics.totalDistance).toBeGreaterThanOrEqual(0);

      // 4. Stop session
      const stopped = trackingService.stopTrackingSession(session.id);
      expect(stopped?.status).toBe('stopped');

      // 5. Get superadmin dashboard
      const dashboard = trackingService.getSuperadminDashboardData();
      expect(dashboard).toBeDefined();
      expect(dashboard.activeCollectors).toBeGreaterThanOrEqual(0);
    });

    it('should manage privacy and data access', () => {
      // 1. Create sharing preference
      const preference = permissionsService.getOrCreatePreference('col-1');
      expect(preference).toBeDefined();

      // 2. Update privacy settings
      permissionsService.updatePreference('col-1', {
        privacy: {
          anonymizeData: true,
          hideExactLocation: true,
          locationAccuracy: 'approximate',
          dataRetention: 7,
        },
      });

      // 3. Get privacy report
      const report = permissionsService.getPrivacyComplianceReport('col-1');
      expect(report.privacyScore).toBeGreaterThanOrEqual(0);

      // 4. Request data export
      const now = Date.now();
      const dataExport = permissionsService.requestDataExport(
        'col-1',
        'col-1',
        'full',
        now - 86400000,
        now
      );

      expect(dataExport).toBeDefined();
      expect(dataExport.status).toBe('pending');
    });
  });
});
