import { createContext, useContext, ReactNode } from "react";

export interface ServiceZone {
  id: string;
  name: string;
  description: string;
  tier: "standard" | "extended" | "premium";
  priceMultiplier: number; // 1.0 = standard, 1.5 = 50% surcharge, etc.
  estimatedResponseTime: string; // e.g., "30-60 mins"
  areas: string[]; // List of area names
  center: {
    latitude: number;
    longitude: number;
  };
  radius: number; // in kilometers
}

// Lusaka service zones
export const SERVICE_ZONES: ServiceZone[] = [
  {
    id: "zone_central",
    name: "Central Lusaka",
    description: "CBD and surrounding areas",
    tier: "standard",
    priceMultiplier: 1.0,
    estimatedResponseTime: "30-45 mins",
    areas: [
      "Cairo Road",
      "Longacres",
      "Northmead",
      "Kabulonga",
      "Rhodes Park",
      "Woodlands",
      "Olympia",
      "Fairview",
    ],
    center: { latitude: -15.4167, longitude: 28.2833 },
    radius: 8,
  },
  {
    id: "zone_east",
    name: "East Lusaka",
    description: "Eastern residential areas",
    tier: "standard",
    priceMultiplier: 1.0,
    estimatedResponseTime: "45-60 mins",
    areas: [
      "Chelston",
      "Kalingalinga",
      "Mtendere",
      "Garden Compound",
      "PHI",
      "Avondale",
    ],
    center: { latitude: -15.4000, longitude: 28.3500 },
    radius: 10,
  },
  {
    id: "zone_west",
    name: "West Lusaka",
    description: "Western residential areas",
    tier: "standard",
    priceMultiplier: 1.0,
    estimatedResponseTime: "45-60 mins",
    areas: [
      "Makeni",
      "Chilenje",
      "Libala",
      "Kabwata",
      "Kamwala",
      "John Howard",
    ],
    center: { latitude: -15.4500, longitude: 28.2500 },
    radius: 10,
  },
  {
    id: "zone_extended",
    name: "Extended Areas",
    description: "Outer Lusaka suburbs",
    tier: "extended",
    priceMultiplier: 1.25,
    estimatedResponseTime: "60-90 mins",
    areas: [
      "Roma",
      "Ibex Hill",
      "Meanwood",
      "Chamba Valley",
      "Silverest",
      "Foxdale",
      "Chalala",
    ],
    center: { latitude: -15.3800, longitude: 28.3200 },
    radius: 15,
  },
  {
    id: "zone_premium",
    name: "Premium Zones",
    description: "Remote and special access areas",
    tier: "premium",
    priceMultiplier: 1.5,
    estimatedResponseTime: "90-120 mins",
    areas: [
      "Leopards Hill",
      "Shimabala",
      "Chongwe",
      "Kafue Road",
      "Great East Road (beyond PHI)",
    ],
    center: { latitude: -15.3500, longitude: 28.4000 },
    radius: 25,
  },
];

interface ServiceZonesContextType {
  zones: ServiceZone[];
  getZoneByLocation: (latitude: number, longitude: number) => ServiceZone | null;
  getZoneById: (zoneId: string) => ServiceZone | undefined;
  calculatePrice: (basePrice: number, latitude: number, longitude: number) => {
    zone: ServiceZone | null;
    originalPrice: number;
    finalPrice: number;
    surcharge: number;
  };
  isInServiceArea: (latitude: number, longitude: number) => boolean;
  getZoneSurchargeText: (zone: ServiceZone) => string;
}

const ServiceZonesContext = createContext<ServiceZonesContextType | undefined>(undefined);

// Calculate distance between two points using Haversine formula
function calculateDistance(
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

export function ServiceZonesProvider({ children }: { children: ReactNode }) {
  const getZoneByLocation = (latitude: number, longitude: number): ServiceZone | null => {
    // Find the zone that contains this location
    // Check zones in order of tier (standard first, then extended, then premium)
    const sortedZones = [...SERVICE_ZONES].sort((a, b) => {
      const tierOrder = { standard: 0, extended: 1, premium: 2 };
      return tierOrder[a.tier] - tierOrder[b.tier];
    });

    for (const zone of sortedZones) {
      const distance = calculateDistance(
        latitude,
        longitude,
        zone.center.latitude,
        zone.center.longitude
      );
      if (distance <= zone.radius) {
        return zone;
      }
    }

    return null;
  };

  const getZoneById = (zoneId: string): ServiceZone | undefined => {
    return SERVICE_ZONES.find((z) => z.id === zoneId);
  };

  const calculatePrice = (basePrice: number, latitude: number, longitude: number) => {
    const zone = getZoneByLocation(latitude, longitude);
    
    if (!zone) {
      // Outside all service areas - apply maximum surcharge
      return {
        zone: null,
        originalPrice: basePrice,
        finalPrice: Math.round(basePrice * 2), // 100% surcharge for out-of-area
        surcharge: basePrice,
      };
    }

    const finalPrice = Math.round(basePrice * zone.priceMultiplier);
    const surcharge = finalPrice - basePrice;

    return {
      zone,
      originalPrice: basePrice,
      finalPrice,
      surcharge,
    };
  };

  const isInServiceArea = (latitude: number, longitude: number): boolean => {
    return getZoneByLocation(latitude, longitude) !== null;
  };

  const getZoneSurchargeText = (zone: ServiceZone): string => {
    if (zone.priceMultiplier === 1.0) {
      return "No surcharge";
    }
    const percentage = Math.round((zone.priceMultiplier - 1) * 100);
    return `+${percentage}% surcharge`;
  };

  return (
    <ServiceZonesContext.Provider
      value={{
        zones: SERVICE_ZONES,
        getZoneByLocation,
        getZoneById,
        calculatePrice,
        isInServiceArea,
        getZoneSurchargeText,
      }}
    >
      {children}
    </ServiceZonesContext.Provider>
  );
}

export function useServiceZones() {
  const context = useContext(ServiceZonesContext);
  if (context === undefined) {
    throw new Error("useServiceZones must be used within a ServiceZonesProvider");
  }
  return context;
}
