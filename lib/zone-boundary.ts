/**
 * zone-boundary.ts
 *
 * Utility for checking whether a GPS coordinate falls inside a zone boundary.
 *
 * Uses a simple axis-aligned bounding box (AABB) derived from the zone's
 * boundary coordinate array.  This is intentionally lightweight — no external
 * mapping library required.
 *
 * Usage:
 *   const inside = isInsideZone(-15.42, 28.29, zone.boundaries);
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single lat/lng coordinate as stored in zone.boundaries. */
export interface BoundaryPoint {
  lat: number;
  lng: number;
}

// ─── isInsideZone ─────────────────────────────────────────────────────────────

/**
 * Returns true when the given (lat, lng) point falls within the bounding box
 * formed by the min/max extents of the provided boundary points.
 *
 * @param lat        Latitude of the point to test.
 * @param lng        Longitude of the point to test.
 * @param zoneBounds Array of {lat, lng} boundary coordinates for the zone.
 *                   Must contain at least 2 points.  Returns false if empty.
 */
export function isInsideZone(
  lat: number,
  lng: number,
  zoneBounds: BoundaryPoint[]
): boolean {
  if (!zoneBounds || zoneBounds.length < 2) return false;

  const lats = zoneBounds.map((p) => p.lat);
  const lngs = zoneBounds.map((p) => p.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

// ─── getBoundingBox ───────────────────────────────────────────────────────────

/**
 * Derives the axis-aligned bounding box from a set of boundary points.
 * Useful for map viewport fitting.
 */
export function getBoundingBox(zoneBounds: BoundaryPoint[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} | null {
  if (!zoneBounds || zoneBounds.length === 0) return null;

  const lats = zoneBounds.map((p) => p.lat);
  const lngs = zoneBounds.map((p) => p.lng);

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}
