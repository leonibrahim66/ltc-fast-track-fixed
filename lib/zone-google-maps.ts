/**
 * Zone Google Maps Utilities
 *
 * Provides two utilities for automatic zone detection and polygon generation:
 *
 *   fetchPlaceCoordinates(placeName)
 *     — Geocodes a place name using the Google Maps Geocoding API.
 *       The API key is read from AsyncStorage (@ltc_gmaps_api_key) at call time
 *       so it can be set by the admin without requiring an app restart.
 *
 *   generateZonePolygon(center, radius, sides)
 *     — Generates a regular polygon (default: hexagon) around a lat/lng center.
 *       The returned points are in MapView {latitude, longitude} format and are
 *       compatible with react-native-maps <Polygon> and the zone boundary system.
 *
 * Usage:
 *   import { fetchPlaceCoordinates, generateZonePolygon } from "@/lib/zone-google-maps";
 *
 *   const center = await fetchPlaceCoordinates("Lusaka, Zambia");
 *   if (center) {
 *     const polygon = generateZonePolygon(center, 0.01, 6);
 *     // polygon is DrawnPoint[] — pass directly to setPoints() in zone-create / zone-edit
 *   }
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Coordinate in MapView / react-native-maps format */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Shape of a successful Geocoding API result entry */
interface GeocodeResult {
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

/** Full Geocoding API response shape */
interface GeocodeResponse {
  status: string;
  results: GeocodeResult[];
  error_message?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GMAPS_API_KEY_STORAGE = "@ltc_gmaps_api_key";
const GEOCODE_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

// ─── fetchPlaceCoordinates ────────────────────────────────────────────────────

/**
 * Geocode a place name to a latitude/longitude coordinate using the Google Maps
 * Geocoding API. The API key is read from AsyncStorage at call time.
 *
 * @param placeName - Human-readable place name, e.g. "Lusaka Central, Zambia"
 * @returns LatLng if the place was found, or null if not found / API error
 * @throws Error if the network request fails or the API key is missing
 *
 * @example
 * const coords = await fetchPlaceCoordinates("Lusaka, Zambia");
 * // { latitude: -15.4167, longitude: 28.2833 }
 */
export async function fetchPlaceCoordinates(placeName: string): Promise<LatLng | null> {
  if (!placeName || !placeName.trim()) {
    return null;
  }

  const key = await AsyncStorage.getItem(GMAPS_API_KEY_STORAGE);
  if (!key || !key.trim()) {
    throw new Error(
      "Google Maps API key not configured. Please set it in the app settings."
    );
  }

  const url = `${GEOCODE_BASE_URL}?address=${encodeURIComponent(placeName.trim())}&key=${key.trim()}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Geocoding request failed with HTTP ${res.status}`);
  }

  const data: GeocodeResponse = await res.json();

  if (data.status !== "OK" || !data.results?.length) {
    // ZERO_RESULTS is a valid "not found" — return null instead of throwing
    if (data.status === "ZERO_RESULTS") return null;
    throw new Error(
      data.error_message ?? `Geocoding API returned status: ${data.status}`
    );
  }

  const location = data.results[0].geometry.location;
  return {
    latitude: location.lat,
    longitude: location.lng,
  };
}

// ─── generateZonePolygon ──────────────────────────────────────────────────────

/**
 * Generate a regular polygon around a center coordinate.
 *
 * The polygon is computed in geographic degrees, which gives a reasonable
 * approximation for small radii (< 0.1°, roughly < 11 km). For larger zones
 * the shape will be slightly distorted due to latitude projection — use the
 * map drawing tool for precise boundaries in those cases.
 *
 * @param center - Center coordinate in {latitude, longitude} format
 * @param radius - Radius in degrees (default 0.01 ≈ ~1.1 km)
 * @param sides  - Number of polygon sides (default 6 = hexagon)
 * @returns Array of LatLng points forming the polygon (NOT auto-closed)
 *
 * @example
 * const polygon = generateZonePolygon({ latitude: -15.4167, longitude: 28.2833 });
 * // 6-point hexagon, ~1.1 km radius, ready for setPoints() in zone-create
 *
 * @example
 * // Larger area with 8 sides
 * const polygon = generateZonePolygon(center, 0.05, 8);
 */
export function generateZonePolygon(
  center: LatLng,
  radius: number = 0.01,
  sides: number = 6
): LatLng[] {
  if (sides < 3) {
    throw new Error("A polygon must have at least 3 sides.");
  }
  if (radius <= 0) {
    throw new Error("Radius must be a positive number.");
  }

  const points: LatLng[] = [];

  for (let i = 0; i < sides; i++) {
    // Start from the top (subtract π/2) so the first point is at the top
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    points.push({
      latitude: center.latitude + radius * Math.cos(angle),
      longitude: center.longitude + radius * Math.sin(angle),
    });
  }

  return points;
}
