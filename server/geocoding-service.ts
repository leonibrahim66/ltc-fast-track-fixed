import axios from "axios";

/**
 * Geocoding Service
 * Handles zone name to coordinates conversion and reverse geocoding
 * Supports both Google Maps Geocoding API and fallback local database
 */

interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  boundingBox?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  confidence: "high" | "medium" | "low";
}

interface ReverseGeocodeResult {
  address: string;
  city: string;
  district: string;
  country: string;
  latitude: number;
  longitude: number;
}

// Fallback zone database for areas without API access
const FALLBACK_ZONES: Record<string, GeocodeResult> = {
  "central lusaka": {
    name: "Central Lusaka",
    latitude: -15.4067,
    longitude: 28.2733,
    radiusMeters: 5000,
    confidence: "high",
  },
  "north lusaka": {
    name: "North Lusaka",
    latitude: -15.35,
    longitude: 28.28,
    radiusMeters: 6000,
    confidence: "high",
  },
  "south lusaka": {
    name: "South Lusaka",
    latitude: -15.45,
    longitude: 28.27,
    radiusMeters: 6000,
    confidence: "high",
  },
  "east lusaka": {
    name: "East Lusaka",
    latitude: -15.4,
    longitude: 28.35,
    radiusMeters: 5500,
    confidence: "high",
  },
  "west lusaka": {
    name: "West Lusaka",
    latitude: -15.42,
    longitude: 28.2,
    radiusMeters: 5500,
    confidence: "high",
  },
  "kitwe": {
    name: "Kitwe",
    latitude: -12.8,
    longitude: 28.65,
    radiusMeters: 4000,
    confidence: "medium",
  },
  "ndola": {
    name: "Ndola",
    latitude: -12.95,
    longitude: 28.65,
    radiusMeters: 4000,
    confidence: "medium",
  },
  "livingstone": {
    name: "Livingstone",
    latitude: -17.85,
    longitude: 25.87,
    radiusMeters: 3000,
    confidence: "medium",
  },
  "kabwe": {
    name: "Kabwe",
    latitude: -14.47,
    longitude: 28.45,
    radiusMeters: 3500,
    confidence: "medium",
  },
};

export class GeocodingService {
  private googleMapsApiKey: string;
  private useGoogleMaps: boolean;

  constructor(googleMapsApiKey?: string) {
    this.googleMapsApiKey = googleMapsApiKey || "";
    this.useGoogleMaps = !!googleMapsApiKey;
  }

  /**
   * Geocode zone name to coordinates
   * Returns zone center and suggested radius
   */
  async geocodeZoneName(zoneName: string, city?: string): Promise<GeocodeResult> {
    // Try Google Maps API first
    if (this.useGoogleMaps) {
      try {
        return await this.geocodeWithGoogleMaps(zoneName, city);
      } catch (error) {
        console.warn(`[Geocoding] Google Maps API failed, using fallback:`, error);
      }
    }

    // Fallback to local database
    return this.geocodeWithFallback(zoneName, city);
  }

  /**
   * Geocode using Google Maps API
   */
  private async geocodeWithGoogleMaps(
    zoneName: string,
    city?: string
  ): Promise<GeocodeResult> {
    const address = city ? `${zoneName}, ${city}` : zoneName;

    try {
      const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
        params: {
          address,
          key: this.googleMapsApiKey,
        },
      });

      if (response.data.results.length === 0) {
        throw new Error("No results found");
      }

      const result = response.data.results[0];
      const location = result.geometry.location;
      const bounds = result.geometry.bounds;

      // Calculate radius from bounding box
      const radius = this.calculateRadiusFromBounds(bounds);

      return {
        name: result.formatted_address,
        latitude: location.lat,
        longitude: location.lng,
        radiusMeters: radius,
        boundingBox: bounds,
        confidence: "high",
      };
    } catch (error) {
      console.error(`[Geocoding] Google Maps error:`, error);
      throw error;
    }
  }

  /**
   * Geocode using fallback database
   */
  private geocodeWithFallback(zoneName: string, city?: string): GeocodeResult {
    const searchKey = zoneName.toLowerCase();

    // Try exact match
    if (FALLBACK_ZONES[searchKey]) {
      return FALLBACK_ZONES[searchKey];
    }

    // Try partial match
    for (const [key, zone] of Object.entries(FALLBACK_ZONES)) {
      if (key.includes(searchKey) || searchKey.includes(key)) {
        return { ...zone, confidence: "medium" };
      }
    }

    // If city is provided, try to find zone in that city
    if (city) {
      const cityKey = city.toLowerCase();
      for (const [key, zone] of Object.entries(FALLBACK_ZONES)) {
        if (key.includes(cityKey)) {
          return { ...zone, confidence: "low" };
        }
      }
    }

    // Default fallback - Lusaka center
    return {
      name: zoneName,
      latitude: -15.4167,
      longitude: 28.2833,
      radiusMeters: 5000,
      confidence: "low",
    };
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    // Try Google Maps API first
    if (this.useGoogleMaps) {
      try {
        return await this.reverseGeocodeWithGoogleMaps(latitude, longitude);
      } catch (error) {
        console.warn(`[Geocoding] Google Maps reverse geocoding failed:`, error);
      }
    }

    // Fallback to simple approximation
    return this.reverseGeocodeWithFallback(latitude, longitude);
  }

  /**
   * Reverse geocode using Google Maps API
   */
  private async reverseGeocodeWithGoogleMaps(
    latitude: number,
    longitude: number
  ): Promise<ReverseGeocodeResult> {
    try {
      const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
        params: {
          latlng: `${latitude},${longitude}`,
          key: this.googleMapsApiKey,
        },
      });

      if (response.data.results.length === 0) {
        throw new Error("No results found");
      }

      const result = response.data.results[0];
      const addressComponents = result.address_components;

      let city = "";
      let district = "";
      let country = "";

      for (const component of addressComponents) {
        if (component.types.includes("locality")) {
          city = component.long_name;
        }
        if (component.types.includes("administrative_area_level_2")) {
          district = component.long_name;
        }
        if (component.types.includes("country")) {
          country = component.long_name;
        }
      }

      return {
        address: result.formatted_address,
        city,
        district,
        country,
        latitude,
        longitude,
      };
    } catch (error) {
      console.error(`[Geocoding] Google Maps reverse geocoding error:`, error);
      throw error;
    }
  }

  /**
   * Reverse geocode using fallback
   */
  private reverseGeocodeWithFallback(
    latitude: number,
    longitude: number
  ): ReverseGeocodeResult {
    // Find nearest zone
    let nearestZone: GeocodeResult | null = null;
    let minDistance = Infinity;

    for (const zone of Object.values(FALLBACK_ZONES)) {
      const distance = this.calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
      if (distance < minDistance) {
        minDistance = distance;
        nearestZone = zone;
      }
    }

    const city = nearestZone?.name || "Unknown";

    return {
      address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      city,
      district: city,
      country: "Zambia",
      latitude,
      longitude,
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
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
   * Calculate radius from bounding box
   */
  private calculateRadiusFromBounds(bounds: any): number {
    if (!bounds) return 5000; // Default 5km

    const northeast = bounds.northeast;
    const southwest = bounds.southwest;

    const distance = this.calculateDistance(
      southwest.lat,
      southwest.lng,
      northeast.lat,
      northeast.lng
    );

    // Return half the diagonal distance as radius
    return Math.round((distance * 1000) / 2);
  }

  /**
   * Check if point is within zone
   */
  isPointInZone(
    latitude: number,
    longitude: number,
    zoneCenter: [number, number],
    radiusMeters: number
  ): boolean {
    const distance = this.calculateDistance(
      latitude,
      longitude,
      zoneCenter[0],
      zoneCenter[1]
    );

    return distance * 1000 <= radiusMeters;
  }

  /**
   * Get nearby zones for a location
   */
  getNearbyZones(latitude: number, longitude: number, radiusKm: number = 10): GeocodeResult[] {
    const nearby: GeocodeResult[] = [];

    for (const zone of Object.values(FALLBACK_ZONES)) {
      const distance = this.calculateDistance(latitude, longitude, zone.latitude, zone.longitude);
      if (distance <= radiusKm) {
        nearby.push(zone);
      }
    }

    // Sort by distance
    nearby.sort((a, b) => {
      const distA = this.calculateDistance(latitude, longitude, a.latitude, a.longitude);
      const distB = this.calculateDistance(latitude, longitude, b.latitude, b.longitude);
      return distA - distB;
    });

    return nearby;
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(latitude: number, longitude: number): boolean {
    return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  }

  /**
   * Format coordinates for display
   */
  formatCoordinates(latitude: number, longitude: number, precision: number = 4): string {
    return `${latitude.toFixed(precision)}, ${longitude.toFixed(precision)}`;
  }

  /**
   * Parse coordinates from string
   */
  parseCoordinates(coordinateString: string): [number, number] | null {
    const parts = coordinateString.split(",").map((p) => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return [parts[0], parts[1]];
    }
    return null;
  }
}

// Export singleton instance
let geocodingService: GeocodingService | null = null;

export function getGeocodingService(googleMapsApiKey?: string): GeocodingService {
  if (!geocodingService) {
    geocodingService = new GeocodingService(googleMapsApiKey);
  }
  return geocodingService;
}
