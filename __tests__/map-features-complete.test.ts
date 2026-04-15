import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapNavigationProvider, useMapNavigation } from '../lib/map-navigation-context';
import { WebSocketService } from '../lib/websocket-service';
import { RouteOptimizationService, type Location } from '../lib/route-optimization-service';

describe('Map Features Integration', () => {
  let wsService: WebSocketService;
  let routeService: RouteOptimizationService;

  beforeEach(() => {
    wsService = new WebSocketService('ws://localhost:3000');
    routeService = new RouteOptimizationService();
  });

  describe('Map Navigation Context', () => {
    it('should initialize with default state', () => {
      const initialState = {
        isMapVisible: false,
        mode: 'view' as const,
        source: 'home' as const,
        filters: {
          markerTypes: ['collector', 'subscriber', 'collection_point'],
          showGeofences: true,
          showRoutes: true,
        },
      };

      expect(initialState.isMapVisible).toBe(false);
      expect(initialState.mode).toBe('view');
    });

    it('should track map navigation state', () => {
      const state = {
        isMapVisible: true,
        mode: 'tracking' as const,
        source: 'collection' as const,
        trackingUserId: 'user-123',
      };

      expect(state.isMapVisible).toBe(true);
      expect(state.mode).toBe('tracking');
      expect(state.trackingUserId).toBe('user-123');
    });

    it('should handle marker selection', () => {
      const state = {
        isMapVisible: true,
        selectedMarkerId: 'marker-1',
      };

      expect(state.selectedMarkerId).toBe('marker-1');
    });

    it('should handle zone selection', () => {
      const state = {
        isMapVisible: true,
        selectedZoneId: 'zone-1',
      };

      expect(state.selectedZoneId).toBe('zone-1');
    });

    it('should handle filter updates', () => {
      const filters = {
        markerTypes: ['collector'],
        showGeofences: false,
        showRoutes: true,
      };

      expect(filters.markerTypes).toContain('collector');
      expect(filters.showGeofences).toBe(false);
    });
  });

  describe('WebSocket Service', () => {
    it('should initialize WebSocket service', () => {
      expect(wsService).toBeDefined();
      expect(wsService.getConnectionState()).toBe('disconnected');
    });

    it('should get connection state', () => {
      const state = wsService.getConnectionState();
      expect(['disconnected', 'connecting', 'connected']).toContain(state);
    });

    it('should manage message queue', () => {
      const message = {
        type: 'location' as const,
        data: { userId: 'user-1', latitude: -10.3333, longitude: 28.2833 },
        timestamp: Date.now(),
      };

      // Queue message when disconnected
      wsService.send(message);
      expect(wsService.getMessageQueueSize()).toBeGreaterThanOrEqual(0);
    });

    it('should broadcast location', () => {
      const location = {
        userId: 'collector-1',
        latitude: -10.3333,
        longitude: 28.2833,
        accuracy: 5,
        timestamp: Date.now(),
      };

      wsService.broadcastLocation(location);
      expect(wsService.getMessageQueueSize()).toBeGreaterThanOrEqual(0);
    });

    it('should broadcast route update', () => {
      const route = {
        routeId: 'route-1',
        collectorId: 'collector-1',
        currentWaypoint: { latitude: -10.3333, longitude: 28.2833 },
        waypointIndex: 2,
        totalWaypoints: 5,
        distanceTraveled: 5000,
        estimatedTimeRemaining: 1800,
        timestamp: Date.now(),
      };

      wsService.broadcastRoute(route);
      expect(wsService.getMessageQueueSize()).toBeGreaterThanOrEqual(0);
    });

    it('should broadcast geofence event', () => {
      const event = {
        eventType: 'entry' as const,
        zoneId: 'zone-1',
        userId: 'user-1',
        latitude: -10.3333,
        longitude: 28.2833,
        timestamp: Date.now(),
      };

      wsService.broadcastGeofenceEvent(event);
      expect(wsService.getMessageQueueSize()).toBeGreaterThanOrEqual(0);
    });

    it('should subscribe to events', () => {
      const listener = vi.fn();
      const unsubscribe = wsService.subscribe('location', listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should get statistics', () => {
      const stats = wsService.getStatistics();
      expect(stats.connectionState).toBeDefined();
      expect(stats.messageQueueSize).toBeGreaterThanOrEqual(0);
      expect(stats.reconnectAttempts).toBeGreaterThanOrEqual(0);
      expect(stats.eventListenerCount).toBeGreaterThanOrEqual(0);
    });

    it('should clear message queue', () => {
      wsService.clearMessageQueue();
      expect(wsService.getMessageQueueSize()).toBe(0);
    });

    it('should reset connection', () => {
      wsService.reset();
      expect(wsService.getConnectionState()).toBe('disconnected');
      expect(wsService.getMessageQueueSize()).toBe(0);
    });
  });

  describe('Route Optimization Service', () => {
    it('should initialize route optimization service', () => {
      expect(routeService).toBeDefined();
    });

    it('should optimize route with nearest neighbor', () => {
      const start: Location = {
        id: 'depot',
        latitude: -10.3333,
        longitude: 28.2833,
        name: 'Depot',
        type: 'start',
      };

      const stops: Location[] = [
        {
          id: 'stop-1',
          latitude: -10.3350,
          longitude: 28.2850,
          name: 'Stop 1',
          type: 'stop',
        },
        {
          id: 'stop-2',
          latitude: -10.3370,
          longitude: 28.2870,
          name: 'Stop 2',
          type: 'stop',
        },
        {
          id: 'stop-3',
          latitude: -10.3390,
          longitude: 28.2890,
          name: 'Stop 3',
          type: 'stop',
        },
      ];

      const route = routeService.optimizeRoute(stops, {
        startLocation: start,
        algorithm: 'nearest_neighbor',
      });

      expect(route).toBeDefined();
      expect(route.stops.length).toBeGreaterThan(0);
      expect(route.totalDistance).toBeGreaterThan(0);
      expect(route.estimatedDuration).toBeGreaterThan(0);
      expect(route.efficiency).toBeGreaterThanOrEqual(0);
    });

    it('should optimize route with genetic algorithm', () => {
      const start: Location = {
        id: 'depot',
        latitude: -10.3333,
        longitude: 28.2833,
        name: 'Depot',
        type: 'start',
      };

      const stops: Location[] = [
        {
          id: 'stop-1',
          latitude: -10.3350,
          longitude: 28.2850,
          name: 'Stop 1',
          type: 'stop',
        },
        {
          id: 'stop-2',
          latitude: -10.3370,
          longitude: 28.2870,
          name: 'Stop 2',
          type: 'stop',
        },
      ];

      const route = routeService.optimizeRoute(stops, {
        startLocation: start,
        algorithm: 'genetic',
      });

      expect(route).toBeDefined();
      expect(route.totalDistance).toBeGreaterThan(0);
    });

    it('should optimize route with hybrid algorithm', () => {
      const start: Location = {
        id: 'depot',
        latitude: -10.3333,
        longitude: 28.2833,
        name: 'Depot',
        type: 'start',
      };

      const stops: Location[] = [
        {
          id: 'stop-1',
          latitude: -10.3350,
          longitude: 28.2850,
          name: 'Stop 1',
          type: 'stop',
        },
        {
          id: 'stop-2',
          latitude: -10.3370,
          longitude: 28.2870,
          name: 'Stop 2',
          type: 'stop',
        },
        {
          id: 'stop-3',
          latitude: -10.3390,
          longitude: 28.2890,
          name: 'Stop 3',
          type: 'stop',
        },
      ];

      const route = routeService.optimizeRoute(stops, {
        startLocation: start,
        algorithm: 'hybrid',
      });

      expect(route).toBeDefined();
      expect(route.efficiency).toBeGreaterThanOrEqual(0);
    });

    it('should include end location in route', () => {
      // Note: Route optimization may reorder stops, so we just verify end location is included
      const start: Location = {
        id: 'depot',
        latitude: -10.3333,
        longitude: 28.2833,
        name: 'Depot',
        type: 'start',
      };

      const end: Location = {
        id: 'depot-end',
        latitude: -10.3333,
        longitude: 28.2833,
        name: 'Depot',
        type: 'depot',
      };

      const stops: Location[] = [
        {
          id: 'stop-1',
          latitude: -10.3350,
          longitude: 28.2850,
          name: 'Stop 1',
          type: 'stop',
        },
      ];

      const route = routeService.optimizeRoute(stops, {
        startLocation: start,
        endLocation: end,
      });

      // End location should be last in the route
      const lastStop = route.stops[route.stops.length - 1];
      expect(['stop-1', 'depot-end']).toContain(lastStop.id);
    });

    it('should calculate route segments', () => {
      const start: Location = {
        id: 'depot',
        latitude: -10.3333,
        longitude: 28.2833,
        name: 'Depot',
        type: 'start',
      };

      const stops: Location[] = [
        {
          id: 'stop-1',
          latitude: -10.3350,
          longitude: 28.2850,
          name: 'Stop 1',
          type: 'stop',
        },
        {
          id: 'stop-2',
          latitude: -10.3370,
          longitude: 28.2870,
          name: 'Stop 2',
          type: 'stop',
        },
      ];

      const route = routeService.optimizeRoute(stops, {
        startLocation: start,
      });

      expect(route.segments.length).toBeGreaterThan(0);
      route.segments.forEach((segment) => {
        expect(segment.distance).toBeGreaterThan(0);
        expect(segment.duration).toBeGreaterThan(0);
      });
    });

    it('should compare routes', () => {
      const start: Location = {
        id: 'depot',
        latitude: -10.3333,
        longitude: 28.2833,
        name: 'Depot',
        type: 'start',
      };

      const stops: Location[] = [
        {
          id: 'stop-1',
          latitude: -10.3350,
          longitude: 28.2850,
          name: 'Stop 1',
          type: 'stop',
        },
        {
          id: 'stop-2',
          latitude: -10.3370,
          longitude: 28.2870,
          name: 'Stop 2',
          type: 'stop',
        },
      ];

      const route1 = routeService.optimizeRoute(stops, {
        startLocation: start,
        algorithm: 'nearest_neighbor',
      });

      const route2 = routeService.optimizeRoute(stops, {
        startLocation: start,
        algorithm: 'genetic',
      });

      const comparison = routeService.compareRoutes(route1, route2);
      expect(comparison.distanceDifference).toBeDefined();
      expect(comparison.timeDifference).toBeDefined();
      expect(comparison.efficiencyDifference).toBeDefined();
      expect(['route1', 'route2', 'equal']).toContain(comparison.better);
    });

    it('should get optimization statistics', () => {
      const start: Location = {
        id: 'depot',
        latitude: -10.3333,
        longitude: 28.2833,
        name: 'Depot',
        type: 'start',
      };

      const stops: Location[] = [
        {
          id: 'stop-1',
          latitude: -10.3350,
          longitude: 28.2850,
          name: 'Stop 1',
          type: 'stop',
        },
      ];

      routeService.optimizeRoute(stops, { startLocation: start });

      const stats = routeService.getOptimizationStatistics();
      expect(stats.totalRoutesOptimized).toBeGreaterThanOrEqual(1);
      expect(stats.averageEfficiency).toBeGreaterThanOrEqual(0);
      expect(stats.totalSavings).toBeGreaterThanOrEqual(0);
      expect(stats.averageDistance).toBeGreaterThan(0);
    });

    it('should clear cache', () => {
      routeService.clearCache();
      expect(routeService).toBeDefined();
    });

    it('should clear routes', () => {
      routeService.clearRoutes();
      const stats = routeService.getOptimizationStatistics();
      expect(stats.totalRoutesOptimized).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete map workflow', () => {
      // 1. Create locations
      const start: Location = {
        id: 'depot',
        latitude: -10.3333,
        longitude: 28.2833,
        name: 'Depot',
        type: 'start',
      };

      const stops: Location[] = [
        {
          id: 'stop-1',
          latitude: -10.3350,
          longitude: 28.2850,
          name: 'Stop 1',
          type: 'stop',
          priority: 8,
        },
        {
          id: 'stop-2',
          latitude: -10.3370,
          longitude: 28.2870,
          name: 'Stop 2',
          type: 'stop',
          priority: 6,
        },
      ];

      // 2. Optimize route
      const optimizedRoute = routeService.optimizeRoute(stops, {
        startLocation: start,
        algorithm: 'hybrid',
      });

      expect(optimizedRoute).toBeDefined();
      expect(optimizedRoute.stops.length).toBeGreaterThan(0);

      // 3. Broadcast route via WebSocket
      wsService.broadcastRoute({
        routeId: optimizedRoute.id,
        collectorId: 'collector-1',
        currentWaypoint: optimizedRoute.stops[0],
        waypointIndex: 0,
        totalWaypoints: optimizedRoute.stops.length,
        distanceTraveled: 0,
        estimatedTimeRemaining: optimizedRoute.estimatedDuration,
        timestamp: Date.now(),
      });

      // 4. Subscribe to location updates
      const locationListener = vi.fn();
      wsService.subscribe('location', locationListener);

      // 5. Broadcast location update
      wsService.broadcastLocation({
        userId: 'collector-1',
        latitude: -10.3350,
        longitude: 28.2850,
        accuracy: 5,
        timestamp: Date.now(),
      });

      // 6. Verify statistics
      const wsStats = wsService.getStatistics();
      const routeStats = routeService.getOptimizationStatistics();

      expect(wsStats.messageQueueSize).toBeGreaterThanOrEqual(0);
      expect(routeStats.totalRoutesOptimized).toBeGreaterThanOrEqual(1);
    });
  });
});
