import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Service Zone Definition
export interface ServiceZone {
  id: string;
  name: string;
  description: string;
  color: string;
  // Center point
  center: {
    latitude: number;
    longitude: number;
  };
  // Radius in meters
  radius: number;
  // Zone type
  type: "standard" | "extended" | "premium" | "restricted";
  // Is zone active
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Geofence Event
export interface GeofenceEvent {
  id: string;
  zoneId: string;
  zoneName: string;
  collectorId: string;
  collectorName: string;
  eventType: "enter" | "exit";
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
  };
  isRead: boolean;
}

// Collector Location
export interface CollectorLocation {
  collectorId: string;
  collectorName: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
  currentZone: string | null;
}

interface GeofencingContextType {
  zones: ServiceZone[];
  events: GeofenceEvent[];
  collectorLocations: CollectorLocation[];
  unreadEventsCount: number;
  addZone: (zone: Omit<ServiceZone, "id" | "createdAt" | "updatedAt">) => void;
  updateZone: (id: string, updates: Partial<ServiceZone>) => void;
  deleteZone: (id: string) => void;
  toggleZoneActive: (id: string) => void;
  checkCollectorInZone: (latitude: number, longitude: number) => ServiceZone | null;
  simulateCollectorMovement: (collectorId: string, collectorName: string, latitude: number, longitude: number) => void;
  markEventAsRead: (eventId: string) => void;
  markAllEventsAsRead: () => void;
  clearEvents: () => void;
}

const GeofencingContext = createContext<GeofencingContextType | undefined>(undefined);

const STORAGE_KEY = "@ltc_geofencing";
const EVENTS_KEY = "@ltc_geofence_events";

// Default Lusaka service zones
const DEFAULT_ZONES: ServiceZone[] = [
  {
    id: "zone-1",
    name: "Lusaka CBD",
    description: "Central Business District - Premium service area",
    color: "#22C55E",
    center: { latitude: -15.4167, longitude: 28.2833 },
    radius: 3000,
    type: "premium",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "zone-2",
    name: "Kabulonga",
    description: "Residential area - Standard service",
    color: "#3B82F6",
    center: { latitude: -15.4000, longitude: 28.3200 },
    radius: 2500,
    type: "standard",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "zone-3",
    name: "Woodlands",
    description: "Residential area - Standard service",
    color: "#3B82F6",
    center: { latitude: -15.4300, longitude: 28.3100 },
    radius: 2000,
    type: "standard",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "zone-4",
    name: "Chilenje",
    description: "Extended service area",
    color: "#F59E0B",
    center: { latitude: -15.4500, longitude: 28.2700 },
    radius: 2000,
    type: "extended",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "zone-5",
    name: "Matero",
    description: "Extended service area",
    color: "#F59E0B",
    center: { latitude: -15.3800, longitude: 28.2500 },
    radius: 2500,
    type: "extended",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "zone-6",
    name: "Industrial Area",
    description: "Restricted zone - Heavy trucks only",
    color: "#EF4444",
    center: { latitude: -15.4100, longitude: 28.2400 },
    radius: 1500,
    type: "restricted",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Calculate distance between two points using Haversine formula
function calculateDistance(
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

export function GeofencingProvider({ children }: { children: ReactNode }) {
  const [zones, setZones] = useState<ServiceZone[]>(DEFAULT_ZONES);
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [collectorLocations, setCollectorLocations] = useState<CollectorLocation[]>([]);

  // Load data from storage
  useEffect(() => {
    const loadData = async () => {
      try {
        const [zonesData, eventsData] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(EVENTS_KEY),
        ]);
        
        if (zonesData) {
          setZones(JSON.parse(zonesData));
        }
        if (eventsData) {
          setEvents(JSON.parse(eventsData));
        }
      } catch (error) {
        console.error("Error loading geofencing data:", error);
      }
    };
    loadData();
  }, []);

  // Save zones to storage
  const saveZones = async (newZones: ServiceZone[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newZones));
    } catch (error) {
      console.error("Error saving zones:", error);
    }
  };

  // Save events to storage
  const saveEvents = async (newEvents: GeofenceEvent[]) => {
    try {
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(newEvents));
    } catch (error) {
      console.error("Error saving events:", error);
    }
  };

  // Check if a point is inside any zone
  const checkCollectorInZone = useCallback(
    (latitude: number, longitude: number): ServiceZone | null => {
      for (const zone of zones) {
        if (!zone.isActive) continue;
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
    },
    [zones]
  );

  // Simulate collector movement and trigger geofence events
  const simulateCollectorMovement = useCallback(
    (collectorId: string, collectorName: string, latitude: number, longitude: number) => {
      const currentZone = checkCollectorInZone(latitude, longitude);
      
      setCollectorLocations((prev) => {
        const existingIndex = prev.findIndex((c) => c.collectorId === collectorId);
        const previousLocation = existingIndex >= 0 ? prev[existingIndex] : null;
        const previousZoneId = previousLocation?.currentZone;
        const currentZoneId = currentZone?.id || null;

        // Check for zone transitions
        if (previousZoneId !== currentZoneId) {
          const newEvents: GeofenceEvent[] = [];

          // Exit event
          if (previousZoneId) {
            const exitedZone = zones.find((z) => z.id === previousZoneId);
            if (exitedZone) {
              newEvents.push({
                id: `event-${Date.now()}-exit`,
                zoneId: previousZoneId,
                zoneName: exitedZone.name,
                collectorId,
                collectorName,
                eventType: "exit",
                timestamp: new Date().toISOString(),
                location: { latitude, longitude },
                isRead: false,
              });
            }
          }

          // Enter event
          if (currentZone) {
            newEvents.push({
              id: `event-${Date.now()}-enter`,
              zoneId: currentZone.id,
              zoneName: currentZone.name,
              collectorId,
              collectorName,
              eventType: "enter",
              timestamp: new Date().toISOString(),
              location: { latitude, longitude },
              isRead: false,
            });
          }

          if (newEvents.length > 0) {
            // Haptic feedback for zone transition
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }

            setEvents((prevEvents) => {
              const updated = [...newEvents, ...prevEvents].slice(0, 100); // Keep last 100 events
              saveEvents(updated);
              return updated;
            });
          }
        }

        // Update collector location
        const newLocation: CollectorLocation = {
          collectorId,
          collectorName,
          latitude,
          longitude,
          lastUpdated: new Date().toISOString(),
          currentZone: currentZoneId,
        };

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newLocation;
          return updated;
        } else {
          return [...prev, newLocation];
        }
      });
    },
    [checkCollectorInZone, zones]
  );

  // Add a new zone
  const addZone = useCallback(
    (zone: Omit<ServiceZone, "id" | "createdAt" | "updatedAt">) => {
      const newZone: ServiceZone = {
        ...zone,
        id: `zone-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setZones((prev) => {
        const updated = [...prev, newZone];
        saveZones(updated);
        return updated;
      });
    },
    []
  );

  // Update a zone
  const updateZone = useCallback((id: string, updates: Partial<ServiceZone>) => {
    setZones((prev) => {
      const updated = prev.map((zone) =>
        zone.id === id
          ? { ...zone, ...updates, updatedAt: new Date().toISOString() }
          : zone
      );
      saveZones(updated);
      return updated;
    });
  }, []);

  // Delete a zone
  const deleteZone = useCallback((id: string) => {
    setZones((prev) => {
      const updated = prev.filter((zone) => zone.id !== id);
      saveZones(updated);
      return updated;
    });
  }, []);

  // Toggle zone active status
  const toggleZoneActive = useCallback((id: string) => {
    setZones((prev) => {
      const updated = prev.map((zone) =>
        zone.id === id
          ? { ...zone, isActive: !zone.isActive, updatedAt: new Date().toISOString() }
          : zone
      );
      saveZones(updated);
      return updated;
    });
  }, []);

  // Mark event as read
  const markEventAsRead = useCallback((eventId: string) => {
    setEvents((prev) => {
      const updated = prev.map((event) =>
        event.id === eventId ? { ...event, isRead: true } : event
      );
      saveEvents(updated);
      return updated;
    });
  }, []);

  // Mark all events as read
  const markAllEventsAsRead = useCallback(() => {
    setEvents((prev) => {
      const updated = prev.map((event) => ({ ...event, isRead: true }));
      saveEvents(updated);
      return updated;
    });
  }, []);

  // Clear all events
  const clearEvents = useCallback(() => {
    setEvents([]);
    saveEvents([]);
  }, []);

  const unreadEventsCount = events.filter((e) => !e.isRead).length;

  return (
    <GeofencingContext.Provider
      value={{
        zones,
        events,
        collectorLocations,
        unreadEventsCount,
        addZone,
        updateZone,
        deleteZone,
        toggleZoneActive,
        checkCollectorInZone,
        simulateCollectorMovement,
        markEventAsRead,
        markAllEventsAsRead,
        clearEvents,
      }}
    >
      {children}
    </GeofencingContext.Provider>
  );
}

export function useGeofencing() {
  const context = useContext(GeofencingContext);
  if (!context) {
    throw new Error("useGeofencing must be used within a GeofencingProvider");
  }
  return context;
}
