/**
 * lib/driver-tracking-service.ts
 *
 * Live GPS tracking service for LTC Fast Track garbage collection drivers.
 *
 * Responsibilities:
 *  - Request foreground location permission
 *  - Watch device GPS at 15–30 second intervals (20s default)
 *  - Persist location to AsyncStorage (@ltc_driver_status) for offline/local use
 *  - Sync location to backend driver_status table via tRPC
 *  - Detect when driver is within ARRIVAL_THRESHOLD_M metres of a pickup
 *  - Emit typed events for: location_updated, arrival_near, arrival_reached
 *
 * Usage:
 *   const tracker = new DriverTrackingService(user, onEvent);
 *   await tracker.start();
 *   tracker.stop();
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Location from "expo-location";

// ─── Constants ────────────────────────────────────────────────────────────────

export const DRIVER_STATUS_KEY = "@ltc_driver_status";
export const LOCATION_INTERVAL_MS = 20_000; // 20 seconds
export const ARRIVAL_NEAR_THRESHOLD_M = 500; // 500 m → "driver is near"
export const ARRIVAL_REACHED_THRESHOLD_M = 100; // 100 m → "driver arrived"

// Lusaka city centre — used as fallback in devMode / web
export const LUSAKA_CENTER = { latitude: -15.4166, longitude: 28.2833 };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriverLocation {
  latitude: number;
  longitude: number;
  headingDegrees?: number;
  speedKmh?: number;
  timestamp: string;
}

export interface DriverStatusEntry {
  driverId: string;
  driverName: string;
  zoneId: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
  activePickupId?: string;
  headingDegrees?: number;
  speedKmh?: number;
  lastUpdated: string;
}

export type TrackingEventType =
  | "location_updated"
  | "arrival_near"       // driver within 500 m of pickup
  | "arrival_reached"    // driver within 100 m of pickup
  | "tracking_started"
  | "tracking_stopped"
  | "permission_denied";

export interface TrackingEvent {
  type: TrackingEventType;
  location?: DriverLocation;
  pickupId?: string;
  distanceMetres?: number;
  etaMinutes?: number;
}

export type TrackingEventHandler = (event: TrackingEvent) => void;

export interface TrackedPickup {
  id: string;
  latitude: number;
  longitude: number;
  householdName: string;
  address: string;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Haversine distance in metres between two GPS coordinates.
 */
export function distanceMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000; // Earth radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimated travel time in minutes given distance in metres.
 * Assumes 30 km/h average speed in urban Zambia.
 */
export function etaMinutesFromMetres(metres: number): number {
  return Math.max(1, Math.round((metres / 1000 / 30) * 60));
}

// ─── Service Class ────────────────────────────────────────────────────────────

export class DriverTrackingService {
  private userId: string;
  private userName: string;
  private zoneId: string;
  private onEvent: TrackingEventHandler;
  private pickups: TrackedPickup[] = [];
  private locationSubscription: Location.LocationSubscription | null = null;
  private webIntervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  // Track which pickups have already triggered near/arrived alerts
  private nearAlertSent = new Set<string>();
  private arrivedAlertSent = new Set<string>();

  constructor(
    userId: string,
    userName: string,
    zoneId: string,
    onEvent: TrackingEventHandler
  ) {
    this.userId = userId;
    this.userName = userName;
    this.zoneId = zoneId;
    this.onEvent = onEvent;
  }

  /**
   * Update the list of pickups to monitor for proximity alerts.
   */
  setPickups(pickups: TrackedPickup[]): void {
    this.pickups = pickups;
    // Reset alert state for pickups no longer in the list
    const ids = new Set(pickups.map((p) => p.id));
    this.nearAlertSent.forEach((id) => { if (!ids.has(id)) this.nearAlertSent.delete(id); });
    this.arrivedAlertSent.forEach((id) => { if (!ids.has(id)) this.arrivedAlertSent.delete(id); });
  }

  /**
   * Start GPS tracking. Must be called after the component mounts.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    if (Platform.OS === "web") {
      await this._startWeb();
    } else {
      await this._startNative();
    }

    this.onEvent({ type: "tracking_started" });
  }

  /**
   * Stop GPS tracking and mark driver offline.
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    this.locationSubscription?.remove();
    this.locationSubscription = null;

    if (this.webIntervalId !== null) {
      clearInterval(this.webIntervalId);
      this.webIntervalId = null;
    }

    // Mark driver offline in AsyncStorage
    await this._persistStatus(null, false);
    this.onEvent({ type: "tracking_stopped" });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _startNative(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      this.onEvent({ type: "permission_denied" });
      return;
    }

    // Get initial position immediately
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await this._handlePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.heading ?? undefined, pos.coords.speed ?? undefined);
    } catch (_e) {
      // Non-fatal — watch will provide updates
    }

    // Watch for continuous updates
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LOCATION_INTERVAL_MS,
        distanceInterval: 30, // also update if moved 30 m
      },
      async (pos) => {
        await this._handlePosition(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.heading ?? undefined,
          pos.coords.speed ?? undefined
        );
      }
    );
  }

  private async _startWeb(): Promise<void> {
    if (!navigator.geolocation) {
      // Fallback to Lusaka centre
      await this._handlePosition(LUSAKA_CENTER.latitude, LUSAKA_CENTER.longitude);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await this._handlePosition(pos.coords.latitude, pos.coords.longitude);
      },
      async () => {
        await this._handlePosition(LUSAKA_CENTER.latitude, LUSAKA_CENTER.longitude);
      }
    );

    this.webIntervalId = setInterval(() => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        await this._handlePosition(pos.coords.latitude, pos.coords.longitude);
      });
    }, LOCATION_INTERVAL_MS);
  }

  private async _handlePosition(
    latitude: number,
    longitude: number,
    headingDegrees?: number,
    speedMs?: number
  ): Promise<void> {
    if (!this.isRunning) return;

    const speedKmh = speedMs != null ? speedMs * 3.6 : undefined;
    const location: DriverLocation = {
      latitude,
      longitude,
      headingDegrees,
      speedKmh,
      timestamp: new Date().toISOString(),
    };

    // Persist to AsyncStorage
    await this._persistStatus(location, true);

    // Emit location_updated event
    this.onEvent({ type: "location_updated", location });

    // Check proximity to each tracked pickup
    for (const pickup of this.pickups) {
      if (!pickup.latitude || !pickup.longitude) continue;

      const dist = distanceMetres(latitude, longitude, pickup.latitude, pickup.longitude);
      const eta = etaMinutesFromMetres(dist);

      if (dist <= ARRIVAL_REACHED_THRESHOLD_M && !this.arrivedAlertSent.has(pickup.id)) {
        this.arrivedAlertSent.add(pickup.id);
        this.nearAlertSent.add(pickup.id); // suppress near alert too
        this.onEvent({
          type: "arrival_reached",
          pickupId: pickup.id,
          distanceMetres: dist,
          etaMinutes: eta,
        });
      } else if (
        dist <= ARRIVAL_NEAR_THRESHOLD_M &&
        !this.nearAlertSent.has(pickup.id)
      ) {
        this.nearAlertSent.add(pickup.id);
        this.onEvent({
          type: "arrival_near",
          pickupId: pickup.id,
          distanceMetres: dist,
          etaMinutes: eta,
        });
      }
    }
  }

  private async _persistStatus(
    location: DriverLocation | null,
    isOnline: boolean
  ): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(DRIVER_STATUS_KEY);
      const ds: Record<string, DriverStatusEntry> = raw ? JSON.parse(raw) : {};

      if (location) {
        ds[this.userId] = {
          driverId: this.userId,
          driverName: this.userName,
          zoneId: this.zoneId,
          latitude: location.latitude,
          longitude: location.longitude,
          isOnline,
          headingDegrees: location.headingDegrees,
          speedKmh: location.speedKmh,
          lastUpdated: location.timestamp,
        };
      } else if (ds[this.userId]) {
        ds[this.userId] = {
          ...ds[this.userId],
          isOnline: false,
          lastUpdated: new Date().toISOString(),
        };
      }

      await AsyncStorage.setItem(DRIVER_STATUS_KEY, JSON.stringify(ds));
    } catch (_e) {
      // Non-fatal
    }
  }
}

// ─── Standalone Helpers ───────────────────────────────────────────────────────

/**
 * Read all driver status entries from AsyncStorage.
 * Used by Zone Manager and Admin dashboards.
 */
export async function getAllDriverStatuses(): Promise<DriverStatusEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(DRIVER_STATUS_KEY);
    if (!raw) return [];
    const ds: Record<string, DriverStatusEntry> = JSON.parse(raw);
    return Object.values(ds);
  } catch {
    return [];
  }
}

/**
 * Read a single driver's status entry.
 */
export async function getDriverStatus(driverId: string): Promise<DriverStatusEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(DRIVER_STATUS_KEY);
    if (!raw) return null;
    const ds: Record<string, DriverStatusEntry> = JSON.parse(raw);
    return ds[driverId] ?? null;
  } catch {
    return null;
  }
}
