export interface Waypoint {
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
  estimatedArrivalTime?: number;
  completedAt?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

export interface RouteExecution {
  id: string;
  routeId: string;
  collectorId: string;
  startedAt: number;
  completedAt?: number;
  currentWaypointIndex: number;
  waypoints: Waypoint[];
  totalDistance: number;
  distanceTraveled: number;
  estimatedDuration: number;
  actualDuration?: number;
  deviations: RouteDeviation[];
  performance: RoutePerformance;
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
}

export interface RouteDeviation {
  id: string;
  type: 'off_route' | 'time_delay' | 'missed_stop' | 'unauthorized_stop';
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  location?: { latitude: number; longitude: number };
  description: string;
  resolved: boolean;
}

export interface RoutePerformance {
  onTimePercentage: number;
  completionRate: number;
  averageSpeedKmh: number;
  fuelEfficiency: number;
  customersServed: number;
  customersSkipped: number;
  totalDeviations: number;
  score: number; // 0-100
}

export interface WaypointCompletion {
  waypointId: string;
  completedAt: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  durationAtStop: number;
  notes?: string;
}

export class RouteExecutionService {
  private activeRoutes: Map<string, RouteExecution> = new Map();
  private completedRoutes: RouteExecution[] = [];
  private deviationThresholds = {
    offRouteDistance: 500, // meters
    timeDelayMinutes: 15,
  };

  /**
   * Start route execution
   */
  startRouteExecution(
    routeId: string,
    collectorId: string,
    waypoints: Waypoint[],
    totalDistance: number,
    estimatedDuration: number
  ): RouteExecution {
    const execution: RouteExecution = {
      id: `exec-${routeId}-${Date.now()}`,
      routeId,
      collectorId,
      startedAt: Date.now(),
      currentWaypointIndex: 0,
      waypoints: waypoints.map((wp) => ({
        ...wp,
        status: 'pending',
      })),
      totalDistance,
      distanceTraveled: 0,
      estimatedDuration,
      deviations: [],
      performance: {
        onTimePercentage: 0,
        completionRate: 0,
        averageSpeedKmh: 0,
        fuelEfficiency: 0,
        customersServed: 0,
        customersSkipped: 0,
        totalDeviations: 0,
        score: 0,
      },
      status: 'in_progress',
    };

    this.activeRoutes.set(execution.id, execution);
    return execution;
  }

  /**
   * Complete a waypoint
   */
  completeWaypoint(executionId: string, completion: WaypointCompletion): RouteExecution | null {
    const execution = this.activeRoutes.get(executionId);
    if (!execution) return null;

    const waypoint = execution.waypoints[execution.currentWaypointIndex];
    if (!waypoint || waypoint.id !== completion.waypointId) {
      return null;
    }

    // Update waypoint
    waypoint.status = 'completed';
    waypoint.completedAt = completion.completedAt;

    // Update execution
    execution.distanceTraveled += this.calculateDistance(
      execution.waypoints[execution.currentWaypointIndex - 1] || { latitude: 0, longitude: 0 },
      waypoint
    );

    // Check for deviations
    this.checkForDeviations(execution, completion);

    // Move to next waypoint
    execution.currentWaypointIndex++;

    // Check if route is complete
    if (execution.currentWaypointIndex >= execution.waypoints.length) {
      this.completeRouteExecution(executionId);
    }

    this.updatePerformanceMetrics(execution);
    return execution;
  }

  /**
   * Skip a waypoint
   */
  skipWaypoint(executionId: string, waypointId: string, reason: string): RouteExecution | null {
    const execution = this.activeRoutes.get(executionId);
    if (!execution) return null;

    const waypoint = execution.waypoints.find((wp) => wp.id === waypointId);
    if (!waypoint) return null;

    waypoint.status = 'skipped';

    // Record as deviation
    execution.deviations.push({
      id: `dev-${Date.now()}`,
      type: 'missed_stop',
      severity: 'high',
      timestamp: Date.now(),
      description: `Waypoint skipped: ${reason}`,
      resolved: false,
    });

    this.updatePerformanceMetrics(execution);
    return execution;
  }

  /**
   * Record location update during route
   */
  recordLocationUpdate(
    executionId: string,
    latitude: number,
    longitude: number,
    accuracy: number
  ): { execution: RouteExecution; nextWaypoint: Waypoint | null } | null {
    const execution = this.activeRoutes.get(executionId);
    if (!execution) return null;

    const currentWaypoint = execution.waypoints[execution.currentWaypointIndex];
    if (!currentWaypoint) return null;

    // Check if collector is approaching next waypoint
    const distance = this.calculateDistance(
      { latitude, longitude },
      { latitude: currentWaypoint.latitude, longitude: currentWaypoint.longitude }
    );

    // If within 100m, suggest next waypoint
    if (distance < 100) {
      const nextWaypoint = execution.waypoints[execution.currentWaypointIndex + 1];
      return { execution, nextWaypoint: nextWaypoint || null };
    }

    return { execution, nextWaypoint: null };
  }

  /**
   * Complete route execution
   */
  completeRouteExecution(executionId: string): RouteExecution | null {
    const execution = this.activeRoutes.get(executionId);
    if (!execution) return null;

    execution.completedAt = Date.now();
    execution.actualDuration = execution.completedAt - execution.startedAt;
    execution.status = 'completed';

    this.updatePerformanceMetrics(execution);
    this.activeRoutes.delete(executionId);
    this.completedRoutes.push(execution);

    return execution;
  }

  /**
   * Abandon route
   */
  abandonRoute(executionId: string, reason: string): RouteExecution | null {
    const execution = this.activeRoutes.get(executionId);
    if (!execution) return null;

    execution.completedAt = Date.now();
    execution.actualDuration = execution.completedAt - execution.startedAt;
    execution.status = 'abandoned';

    execution.deviations.push({
      id: `dev-${Date.now()}`,
      type: 'off_route',
      severity: 'high',
      timestamp: Date.now(),
      description: `Route abandoned: ${reason}`,
      resolved: false,
    });

    this.updatePerformanceMetrics(execution);
    this.activeRoutes.delete(executionId);
    this.completedRoutes.push(execution);

    return execution;
  }

  /**
   * Get active route execution
   */
  getActiveExecution(executionId: string): RouteExecution | null {
    return this.activeRoutes.get(executionId) || null;
  }

  /**
   * Get all active executions for a collector
   */
  getActiveExecutionsForCollector(collectorId: string): RouteExecution[] {
    return Array.from(this.activeRoutes.values()).filter((e) => e.collectorId === collectorId);
  }

  /**
   * Get completed route execution
   */
  getCompletedExecution(executionId: string): RouteExecution | null {
    return this.completedRoutes.find((r) => r.id === executionId) || null;
  }

  /**
   * Get collector performance analytics
   */
  getCollectorPerformance(collectorId: string, days: number = 30): any {
    const now = Date.now();
    const timeWindow = days * 24 * 60 * 60 * 1000;
    const startTime = now - timeWindow;

    const routes = this.completedRoutes.filter(
      (r) => r.collectorId === collectorId && r.completedAt && r.completedAt >= startTime
    );

    if (routes.length === 0) {
      return {
        collectorId,
        routesCompleted: 0,
        averagePerformanceScore: 0,
        totalCustomersServed: 0,
        averageOnTimePercentage: 0,
        totalDeviations: 0,
      };
    }

    const avgScore = routes.reduce((sum, r) => sum + r.performance.score, 0) / routes.length;
    const avgOnTime = routes.reduce((sum, r) => sum + r.performance.onTimePercentage, 0) / routes.length;
    const totalCustomers = routes.reduce((sum, r) => sum + r.performance.customersServed, 0);
    const totalDeviations = routes.reduce((sum, r) => sum + r.performance.totalDeviations, 0);

    return {
      collectorId,
      routesCompleted: routes.length,
      averagePerformanceScore: Math.round(avgScore),
      totalCustomersServed: totalCustomers,
      averageOnTimePercentage: Math.round(avgOnTime),
      totalDeviations,
      routes: routes.map((r) => ({
        id: r.id,
        completedAt: r.completedAt,
        score: r.performance.score,
        customersServed: r.performance.customersServed,
      })),
    };
  }

  /**
   * Check for route deviations
   */
  private checkForDeviations(execution: RouteExecution, completion: WaypointCompletion): void {
    const waypoint = execution.waypoints[execution.currentWaypointIndex];
    if (!waypoint) return;

    // Check distance deviation
    const distance = this.calculateDistance(
      { latitude: completion.latitude, longitude: completion.longitude },
      { latitude: waypoint.latitude, longitude: waypoint.longitude }
    );

    if (distance > this.deviationThresholds.offRouteDistance) {
      execution.deviations.push({
        id: `dev-${Date.now()}`,
        type: 'off_route',
        severity: 'medium',
        timestamp: completion.completedAt,
        location: { latitude: completion.latitude, longitude: completion.longitude },
        description: `Off-route deviation: ${distance}m from waypoint`,
        resolved: false,
      });
    }

    // Check time deviation
    if (waypoint.estimatedArrivalTime) {
      const delay = (completion.completedAt - waypoint.estimatedArrivalTime) / 60000; // minutes
      if (delay > this.deviationThresholds.timeDelayMinutes) {
        execution.deviations.push({
          id: `dev-${Date.now()}`,
          type: 'time_delay',
          severity: delay > 60 ? 'high' : 'medium',
          timestamp: completion.completedAt,
          description: `Time delay: ${Math.round(delay)} minutes late`,
          resolved: false,
        });
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(execution: RouteExecution): void {
    const completedWaypoints = execution.waypoints.filter((wp) => wp.status === 'completed');
    const skippedWaypoints = execution.waypoints.filter((wp) => wp.status === 'skipped');

    const completionRate = (completedWaypoints.length / execution.waypoints.length) * 100;
    const averageSpeed = execution.distanceTraveled / ((execution.actualDuration || execution.estimatedDuration) / 3600000); // km/h

    // Calculate on-time percentage
    let onTimeCount = 0;
    completedWaypoints.forEach((wp) => {
      if (wp.estimatedArrivalTime && wp.completedAt && wp.completedAt <= wp.estimatedArrivalTime + 5 * 60000) {
        onTimeCount++;
      }
    });
    const onTimePercentage = (onTimeCount / completedWaypoints.length) * 100;

    // Calculate performance score (0-100)
    const deviationPenalty = execution.deviations.reduce((sum, d) => {
      return sum + (d.severity === 'high' ? 10 : d.severity === 'medium' ? 5 : 2);
    }, 0);

    const score = Math.max(0, 100 - deviationPenalty - (100 - completionRate) * 0.5);

    execution.performance = {
      onTimePercentage: Math.round(onTimePercentage),
      completionRate: Math.round(completionRate),
      averageSpeedKmh: Math.round(averageSpeed),
      fuelEfficiency: Math.round(averageSpeed * 0.8), // Simplified calculation
      customersServed: completedWaypoints.length,
      customersSkipped: skippedWaypoints.length,
      totalDeviations: execution.deviations.length,
      score: Math.round(score),
    };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // Earth's radius in meters
    const lat1 = (point1.latitude * Math.PI) / 180;
    const lat2 = (point2.latitude * Math.PI) / 180;
    const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get execution statistics
   */
  getExecutionStatistics() {
    return {
      activeExecutions: this.activeRoutes.size,
      completedExecutions: this.completedRoutes.length,
      averagePerformanceScore:
        this.completedRoutes.length > 0
          ? Math.round(this.completedRoutes.reduce((sum, r) => sum + r.performance.score, 0) / this.completedRoutes.length)
          : 0,
      totalDeviations: this.completedRoutes.reduce((sum, r) => sum + r.performance.totalDeviations, 0),
    };
  }

  /**
   * Clear completed routes (for testing)
   */
  clearCompletedRoutes(): void {
    this.completedRoutes = [];
  }

  /**
   * Clear all data (for testing)
   */
  clearAll(): void {
    this.activeRoutes.clear();
    this.completedRoutes = [];
  }
}
