/**
 * useDriverZone
 *
 * Returns the current garbage driver's zone information and a helper
 * to strictly compare a pickup's zone against the driver's zone.
 *
 * Usage:
 *   const { zoneId, isInZone } = useDriverZone();
 *   if (!isInZone(pickup.zoneId)) return; // skip pickups outside driver's zone
 */
import { useAuth } from "@/lib/auth-context";

export interface DriverZone {
  /** The driver's assigned zone ID (undefined if not yet assigned). */
  zoneId: string | undefined;
  /**
   * Returns true only when pickupZoneId strictly equals the driver's zoneId.
   * Both values must be non-empty strings for the comparison to pass.
   */
  isInZone: (pickupZoneId: string | undefined) => boolean;
}

export function useDriverZone(): DriverZone {
  const { user } = useAuth();
  const zoneId = user?.zoneId;

  const isInZone = (pickupZoneId: string | undefined): boolean => {
    if (!zoneId || !pickupZoneId) return false;
    return zoneId === pickupZoneId;
  };

  return { zoneId, isInZone };
}
