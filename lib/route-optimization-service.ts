/**
 * lib/route-optimization-service.ts
 *
 * Smart route optimization for garbage collection drivers.
 * Uses Google Maps Directions API with waypoint optimisation.
 * Falls back to nearest-neighbour greedy sort when API is unavailable.
 */

export interface Location {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  type: 'start' | 'stop' | 'depot';
  timeWindow?: { start: number; end: number }; // Unix timestamps
  priority?: number; // 1-10, higher = more important
  weight?: number; // For weighted optimization
}

export interface OptimizedRoute {
  id: string;
  stops: Location[];
  totalDistance: number;
  estimatedDuration: number;
  efficiency: number; // 0-100
  savings: number; // Distance saved vs naive route
  waypoints: Array<{ latitude: number; longitude: number }>;
  segments: Array<{
    from: Location;
    to: Location;
    distance: number;
    duration: number;
  }>;
  createdAt: number;
}

export interface RouteOptimizationOptions {
  startLocation: Location;
  endLocation?: Location;
  timeWindowConstraints?: boolean;
  priorityWeighting?: boolean;
  maxDistance?: number;
  maxDuration?: number;
  algorithm?: 'nearest_neighbor' | 'genetic' | 'simulated_annealing' | 'hybrid';
}

export class RouteOptimizationService {
  private distanceCache: Map<string, number> = new Map();
  private optimizedRoutes: Map<string, OptimizedRoute> = new Map();

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
   * Get cached distance or calculate
   */
  private getDistance(loc1: Location, loc2: Location): number {
    const cacheKey = `${loc1.id}-${loc2.id}`;
    let distance = this.distanceCache.get(cacheKey);

    if (!distance) {
      distance = this.calculateDistance(
        loc1.latitude,
        loc1.longitude,
        loc2.latitude,
        loc2.longitude
      );
      this.distanceCache.set(cacheKey, distance);
    }

    return distance;
  }

  /**
   * Estimate duration based on distance (average 15 m/s for urban driving)
   */
  private estimateDuration(distance: number): number {
    return Math.round(distance / 15) + 300; // Add 5 minutes for stop
  }

  /**
   * Nearest neighbor algorithm (fast, good for real-time)
   */
  private nearestNeighbor(locations: Location[], start: Location): Location[] {
    const unvisited = locations.filter((l) => l.id !== start.id);
    const route = [start];

    while (unvisited.length > 0) {
      const current = route[route.length - 1];
      let nearest = unvisited[0];
      let minDistance = this.getDistance(current, nearest);

      for (let i = 1; i < unvisited.length; i++) {
        const distance = this.getDistance(current, unvisited[i]);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = unvisited[i];
        }
      }

      route.push(nearest);
      unvisited.splice(unvisited.indexOf(nearest), 1);
    }

    return route;
  }

  /**
   * 2-opt local search improvement
   */
  private twoOptImprovement(route: Location[]): Location[] {
    let improved = true;
    let bestRoute = [...route];

    while (improved) {
      improved = false;

      for (let i = 1; i < bestRoute.length - 1; i++) {
        for (let j = i + 1; j < bestRoute.length; j++) {
          const newRoute = [
            ...bestRoute.slice(0, i),
            ...bestRoute.slice(i, j).reverse(),
            ...bestRoute.slice(j),
          ];

          const currentDistance = this.calculateRouteTotalDistance(bestRoute);
          const newDistance = this.calculateRouteTotalDistance(newRoute);

          if (newDistance < currentDistance) {
            bestRoute = newRoute;
            improved = true;
            break;
          }
        }
        if (improved) break;
      }
    }

    return bestRoute;
  }

  /**
   * Genetic algorithm for route optimization
   */
  private geneticAlgorithm(
    locations: Location[],
    start: Location,
    generations: number = 50
  ): Location[] {
    const populationSize = Math.min(20, Math.max(5, locations.length));
    let population: Location[][] = [];

    // Initialize population
    for (let i = 0; i < populationSize; i++) {
      const route = [...locations.filter((l) => l.id !== start.id)];
      for (let j = route.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [route[j], route[k]] = [route[k], route[j]];
      }
      population.push([start, ...route]);
    }

    // Evolution
    for (let gen = 0; gen < generations; gen++) {
      // Evaluate fitness
      const fitness = population.map((route) => 1 / this.calculateRouteTotalDistance(route));

      // Selection and crossover
      const newPopulation: Location[][] = [];
      for (let i = 0; i < populationSize; i++) {
        const parent1 = this.selectByFitness(population, fitness);
        const parent2 = this.selectByFitness(population, fitness);
        const child = this.crossover(parent1, parent2);
        newPopulation.push(this.mutate(child, 0.1));
      }

      population = newPopulation;
    }

    // Return best route
    const fitness = population.map((route) => 1 / this.calculateRouteTotalDistance(route));
    const bestIndex = fitness.indexOf(Math.max(...fitness));
    return population[bestIndex];
  }

  /**
   * Select route by fitness
   */
  private selectByFitness(population: Location[][], fitness: number[]): Location[] {
    const totalFitness = fitness.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalFitness;

    for (let i = 0; i < population.length; i++) {
      random -= fitness[i];
      if (random <= 0) {
        return population[i];
      }
    }

    return population[population.length - 1];
  }

  /**
   * Crossover two routes
   */
  private crossover(parent1: Location[], parent2: Location[]): Location[] {
    const start = parent1[0];
    const size = parent1.length - 1;
    const point = Math.floor(Math.random() * size);

    const child = [start];
    const used = new Set<string>([start.id]);

    for (let i = 1; i <= point; i++) {
      child.push(parent1[i]);
      used.add(parent1[i].id);
    }

    for (let i = 1; i < parent2.length; i++) {
      if (!used.has(parent2[i].id)) {
        child.push(parent2[i]);
        used.add(parent2[i].id);
      }
    }

    return child;
  }

  /**
   * Mutate route
   */
  private mutate(route: Location[], mutationRate: number): Location[] {
    const mutated = [...route];

    for (let i = 1; i < mutated.length; i++) {
      if (Math.random() < mutationRate) {
        const j = Math.floor(Math.random() * (mutated.length - 1)) + 1;
        [mutated[i], mutated[j]] = [mutated[j], mutated[i]];
      }
    }

    return mutated;
  }

  /**
   * Calculate total route distance
   */
  private calculateRouteTotalDistance(route: Location[]): number {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      total += this.getDistance(route[i], route[i + 1]);
    }
    return total;
  }

  /**
   * Check time window constraints
   */
  private checkTimeWindowConstraints(route: Location[], startTime: number): boolean {
    let currentTime = startTime;

    for (let i = 1; i < route.length; i++) {
      const segment = route[i];
      const duration = this.estimateDuration(this.getDistance(route[i - 1], segment));
      currentTime += duration;

      if (segment.timeWindow && currentTime > segment.timeWindow.end) {
        return false;
      }
    }

    return true;
  }

  /**
   * Optimize route
   */
  optimizeRoute(locations: Location[], options: RouteOptimizationOptions): OptimizedRoute {
    const routeId = `route-${Date.now()}`;
    const allLocations = [options.startLocation, ...locations];

    if (options.endLocation) {
      allLocations.push(options.endLocation);
    }

    let optimizedLocations: Location[];

    // Select algorithm
    const algorithm = options.algorithm || 'hybrid';

    if (algorithm === 'nearest_neighbor') {
      optimizedLocations = this.nearestNeighbor(allLocations, options.startLocation);
    } else if (algorithm === 'genetic') {
      optimizedLocations = this.geneticAlgorithm(allLocations, options.startLocation);
    } else if (algorithm === 'simulated_annealing') {
      // For now, use genetic as fallback
      optimizedLocations = this.geneticAlgorithm(allLocations, options.startLocation);
    } else {
      // Hybrid: nearest neighbor + 2-opt
      optimizedLocations = this.nearestNeighbor(allLocations, options.startLocation);
      optimizedLocations = this.twoOptImprovement(optimizedLocations);
    }

    // Calculate metrics
    const totalDistance = this.calculateRouteTotalDistance(optimizedLocations);
    const estimatedDuration = optimizedLocations.reduce((sum, loc, i) => {
      if (i < optimizedLocations.length - 1) {
        return sum + this.estimateDuration(this.getDistance(loc, optimizedLocations[i + 1]));
      }
      return sum;
    }, 0);

    // Calculate naive distance for comparison
    const naiveRoute = [options.startLocation, ...locations];
    if (options.endLocation) naiveRoute.push(options.endLocation);
    const naiveDistance = this.calculateRouteTotalDistance(naiveRoute);
    const savings = naiveDistance - totalDistance;
    const efficiency = Math.round((savings / naiveDistance) * 100);

    // Build waypoints
    const waypoints = optimizedLocations.map((loc) => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));

    // Build segments
    const segments = [];
    for (let i = 0; i < optimizedLocations.length - 1; i++) {
      const distance = this.getDistance(optimizedLocations[i], optimizedLocations[i + 1]);
      segments.push({
        from: optimizedLocations[i],
        to: optimizedLocations[i + 1],
        distance,
        duration: this.estimateDuration(distance),
      });
    }

    const optimizedRoute: OptimizedRoute = {
      id: routeId,
      stops: optimizedLocations,
      totalDistance,
      estimatedDuration,
      efficiency: Math.max(0, efficiency),
      savings,
      waypoints,
      segments,
      createdAt: Date.now(),
    };

    this.optimizedRoutes.set(routeId, optimizedRoute);
    return optimizedRoute;
  }

  /**
   * Get optimized route
   */
  getOptimizedRoute(routeId: string): OptimizedRoute | null {
    return this.optimizedRoutes.get(routeId) || null;
  }

  /**
   * Get all optimized routes
   */
  getAllOptimizedRoutes(): OptimizedRoute[] {
    return Array.from(this.optimizedRoutes.values());
  }

  /**
   * Compare routes
   */
  compareRoutes(route1: OptimizedRoute, route2: OptimizedRoute): {
    distanceDifference: number;
    timeDifference: number;
    efficiencyDifference: number;
    better: 'route1' | 'route2' | 'equal';
  } {
    const distanceDifference = route2.totalDistance - route1.totalDistance;
    const timeDifference = route2.estimatedDuration - route1.estimatedDuration;
    const efficiencyDifference = route1.efficiency - route2.efficiency;

    let better: 'route1' | 'route2' | 'equal' = 'equal';
    if (route1.totalDistance < route2.totalDistance) {
      better = 'route1';
    } else if (route2.totalDistance < route1.totalDistance) {
      better = 'route2';
    }

    return {
      distanceDifference,
      timeDifference,
      efficiencyDifference,
      better,
    };
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStatistics(): {
    totalRoutesOptimized: number;
    averageEfficiency: number;
    totalSavings: number;
    averageDistance: number;
  } {
    const routes = Array.from(this.optimizedRoutes.values());

    if (routes.length === 0) {
      return {
        totalRoutesOptimized: 0,
        averageEfficiency: 0,
        totalSavings: 0,
        averageDistance: 0,
      };
    }

    const averageEfficiency = routes.reduce((sum, r) => sum + r.efficiency, 0) / routes.length;
    const totalSavings = routes.reduce((sum, r) => sum + r.savings, 0);
    const averageDistance = routes.reduce((sum, r) => sum + r.totalDistance, 0) / routes.length;

    return {
      totalRoutesOptimized: routes.length,
      averageEfficiency,
      totalSavings,
      averageDistance,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.distanceCache.clear();
  }

  /**
   * Clear routes
   */
  clearRoutes(): void {
    this.optimizedRoutes.clear();
  }
}

export const routeOptimizationService = new RouteOptimizationService();

// ─── NEW: Google Maps Directions API Integration ──────────────────────────────

import { distanceMetres, etaMinutesFromMetres } from "./driver-tracking-service";

export interface RoutePickup {
  id: string;
  householdName: string;
  address: string;
  latitude: number;
  longitude: number;
  status: string;
}

export interface RouteLeg {
  pickupId: string;
  householdName: string;
  address: string;
  distanceMetres: number;
  distanceText: string;
  durationMinutes: number;
  durationText: string;
  sequence: number;
}

export interface GarbageOptimizedRoute {
  orderedPickups: RoutePickup[];
  legs: RouteLeg[];
  totalDistanceMetres: number;
  totalDurationMinutes: number;
  polylinePoints: string;
  optimizedByApi: boolean;
}

const DIRECTIONS_BASE = "https://maps.googleapis.com/maps/api/directions/json";

async function fetchGoogleDirections(
  origin: { latitude: number; longitude: number },
  destinations: RoutePickup[],
  apiKey: string
): Promise<{ status: string; routes: any[] } | null> {
  if (!apiKey || destinations.length === 0) return null;
  try {
    const originStr = `${origin.latitude},${origin.longitude}`;
    if (destinations.length === 1) {
      const dest = destinations[0];
      const url = `${DIRECTIONS_BASE}?origin=${originStr}&destination=${dest.latitude},${dest.longitude}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    }
    const last = destinations[destinations.length - 1];
    const waypoints = destinations
      .slice(0, -1)
      .map((p) => `${p.latitude},${p.longitude}`)
      .join("|");
    const url =
      `${DIRECTIONS_BASE}?origin=${originStr}` +
      `&destination=${last.latitude},${last.longitude}` +
      `&waypoints=optimize:true|${waypoints}` +
      `&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function nearestNeighbourSortPickups(
  origin: { latitude: number; longitude: number },
  pickups: RoutePickup[]
): RoutePickup[] {
  if (pickups.length <= 1) return [...pickups];
  const remaining = [...pickups];
  const ordered: RoutePickup[] = [];
  let current = origin;
  while (remaining.length > 0) {
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < remaining.length; i++) {
      const d = distanceMetres(current.latitude, current.longitude, remaining[i].latitude, remaining[i].longitude);
      if (d < minDist) { minDist = d; minIdx = i; }
    }
    const next = remaining.splice(minIdx, 1)[0];
    ordered.push(next);
    current = { latitude: next.latitude, longitude: next.longitude };
  }
  return ordered;
}

function buildFallbackLegs(
  origin: { latitude: number; longitude: number },
  orderedPickups: RoutePickup[]
): RouteLeg[] {
  const legs: RouteLeg[] = [];
  let prev = origin;
  for (let i = 0; i < orderedPickups.length; i++) {
    const p = orderedPickups[i];
    const dist = distanceMetres(prev.latitude, prev.longitude, p.latitude, p.longitude);
    const eta = etaMinutesFromMetres(dist);
    legs.push({
      pickupId: p.id,
      householdName: p.householdName,
      address: p.address,
      distanceMetres: dist,
      distanceText: dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`,
      durationMinutes: eta,
      durationText: eta < 60 ? `${eta} min` : `${Math.floor(eta / 60)}h ${eta % 60}min`,
      sequence: i + 1,
    });
    prev = { latitude: p.latitude, longitude: p.longitude };
  }
  return legs;
}

/**
 * Optimise the route for a driver with multiple pending pickups.
 * Uses Google Maps Directions API when an apiKey is provided.
 * Falls back to nearest-neighbour greedy sort otherwise.
 */
export async function optimizeGarbageRoute(
  driverLocation: { latitude: number; longitude: number },
  pickups: RoutePickup[],
  apiKey?: string
): Promise<GarbageOptimizedRoute> {
  const gpsPickups = pickups.filter((p) => p.latitude && p.longitude);
  if (gpsPickups.length === 0) {
    return { orderedPickups: [], legs: [], totalDistanceMetres: 0, totalDurationMinutes: 0, polylinePoints: "", optimizedByApi: false };
  }

  if (apiKey) {
    const apiResult = await fetchGoogleDirections(driverLocation, gpsPickups, apiKey);
    if (apiResult && apiResult.status === "OK" && apiResult.routes.length > 0) {
      const route = apiResult.routes[0];
      const waypointOrder: number[] = route.waypoint_order ?? [];
      let orderedPickups: RoutePickup[];
      if (gpsPickups.length === 1) {
        orderedPickups = gpsPickups;
      } else {
        const intermediates = gpsPickups.slice(0, -1);
        const last = gpsPickups[gpsPickups.length - 1];
        orderedPickups = [...waypointOrder.map((idx) => intermediates[idx]), last];
      }
      const legs: RouteLeg[] = route.legs.map((leg: any, i: number) => ({
        pickupId: orderedPickups[i].id,
        householdName: orderedPickups[i].householdName,
        address: orderedPickups[i].address,
        distanceMetres: leg.distance.value,
        distanceText: leg.distance.text,
        durationMinutes: Math.round(leg.duration.value / 60),
        durationText: leg.duration.text,
        sequence: i + 1,
      }));
      return {
        orderedPickups,
        legs,
        totalDistanceMetres: legs.reduce((s, l) => s + l.distanceMetres, 0),
        totalDurationMinutes: legs.reduce((s, l) => s + l.durationMinutes, 0),
        polylinePoints: route.overview_polyline.points,
        optimizedByApi: true,
      };
    }
  }

  const orderedPickups = nearestNeighbourSortPickups(driverLocation, gpsPickups);
  const legs = buildFallbackLegs(driverLocation, orderedPickups);
  return {
    orderedPickups,
    legs,
    totalDistanceMetres: legs.reduce((s, l) => s + l.distanceMetres, 0),
    totalDurationMinutes: legs.reduce((s, l) => s + l.durationMinutes, 0),
    polylinePoints: "",
    optimizedByApi: false,
  };
}

/**
 * Decode a Google Maps encoded polyline into lat/lng coordinates.
 */
export function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

export function formatRouteDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

export function formatRouteDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
