/**
 * zone-auto-assignment.ts
 *
 * Zone intelligence utilities for driver assignment and pickup access control.
 *
 * - findNearestDriver(zoneId)  → first available online driver in the same zone
 * - isPickupAllowed(driverZoneId, pickupZoneId) → strict zone equality check
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DRIVER_STATUS_KEY,
  type DriverStatusEntry,
} from "@/lib/driver-tracking-service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvailableDriver {
  driverId: string;
  driverName: string;
  zoneId: string;
  latitude?: number;
  longitude?: number;
  lastUpdated: string;
}

// ─── findNearestDriver ────────────────────────────────────────────────────────

/**
 * Reads @ltc_driver_status and returns the first online driver
 * whose zoneId matches the given zoneId.
 *
 * Returns null if no matching driver is found.
 */
export async function findNearestDriver(
  zoneId: string
): Promise<AvailableDriver | null> {
  if (!zoneId) return null;
  try {
    const raw = await AsyncStorage.getItem(DRIVER_STATUS_KEY);
    if (!raw) return null;
    const statuses: Record<string, DriverStatusEntry> = JSON.parse(raw);
    const entries = Object.values(statuses);

    const match = entries.find(
      (entry) => entry.isOnline && entry.zoneId === zoneId
    );

    if (!match) return null;

    return {
      driverId: match.driverId,
      driverName: match.driverName,
      zoneId: match.zoneId,
      latitude: match.latitude,
      longitude: match.longitude,
      lastUpdated: match.lastUpdated,
    };
  } catch (_e) {
    return null;
  }
}

// ─── isPickupAllowed ──────────────────────────────────────────────────────────

/**
 * Returns true only when driverZoneId strictly equals pickupZoneId.
 * Both values must be non-empty strings.
 */
export function isPickupAllowed(
  driverZoneId: string | undefined,
  pickupZoneId: string | undefined
): boolean {
  if (!driverZoneId || !pickupZoneId) return false;
  return driverZoneId === pickupZoneId;
}
