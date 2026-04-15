/**
 * Garbage Collection Driver — Live Map Screen
 *
 * Shows:
 *   - Driver's current GPS location (blue dot)
 *   - Pickup location pins (orange for in_progress, grey for assigned)
 *   - ETA estimate based on distance
 *
 * Updates driver location every 15-30s when a pickup is in_progress.
 * Persists location to @ltc_driver_status for Zone Manager / Admin visibility.
 *
 * Security: only shows pickups in driver's zone, assigned to this driver.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Location from "expo-location";
import { APP_CONFIG } from "@/constants/app";
import type { Pickup } from "./index";
import {
  DriverTrackingService,
  type DriverLocation,
  type TrackingEvent,
  type TrackedPickup,
  distanceMetres as calcDistMetres,
  etaMinutesFromMetres,
} from "@/lib/driver-tracking-service";
import { triggerDriverArrivalAlert } from "@/lib/driver-arrival-alerts";
import { getStaticResponsive } from "@/hooks/use-responsive";
import {
  optimizeGarbageRoute,
  decodePolyline,
  formatRouteDistance,
  formatRouteDuration,
  type GarbageOptimizedRoute,
  type RoutePickup,
} from "@/lib/route-optimization-service";
import { isInsideZone, getBoundingBox } from "@/lib/zone-boundary";

const DRIVER_ORANGE = "#EA580C";
const STORAGE_KEY = "@ltc_pickups";
const DRIVER_STATUS_KEY = "@ltc_driver_status";
const LOCATION_INTERVAL_MS = 5000; // 5s — zone intelligence requirement
const GMAPS_API_KEY_STORAGE = "@ltc_gmaps_api_key";

// Fallback Lusaka center for devMode / web
const LUSAKA_CENTER = { latitude: -15.4166, longitude: 28.2833 };

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMinutes(distKm: number): number {
  return Math.round((distKm / 30) * 60); // assume 30 km/h average
}

export default function GarbageDriverMapScreen() {
  const { user } = useAuth();
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [activePickup, setActivePickup] = useState<Pickup | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [optimizedRoute, setOptimizedRoute] = useState<GarbageOptimizedRoute | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routePolyline, setRoutePolyline] = useState<{ latitude: number; longitude: number }[]>([]);
  // Zone outside-boundary detection
  const [isOutsideZone, setIsOutsideZone] = useState(false);
  // Store raw BoundaryPoint[] so isInsideZone receives the correct type
  const zoneBoundsRef = useRef<{ lat: number; lng: number }[] | null>(null);

  // Load driver's assigned zone boundaries once
  useEffect(() => {
    const loadZoneBounds = async () => {
      if (!user?.zoneId) return;
      try {
        const raw = await AsyncStorage.getItem("@ltc_zones");
        const zones: any[] = raw ? JSON.parse(raw) : [];
        const zone = zones.find((z: any) => z.id === user.zoneId);
        if (zone?.boundaries && Array.isArray(zone.boundaries) && zone.boundaries.length >= 2) {
          zoneBoundsRef.current = zone.boundaries as { lat: number; lng: number }[];
        }
      } catch (_e) {
        // Non-fatal: zone boundary check will be skipped
      }
    };
    loadZoneBounds();
  }, [user?.zoneId]);

  // Track which pickups have had near/arrived alerts sent
  const nearAlertSentRef = useRef<Set<string>>(new Set());
  const arrivedAlertSentRef = useRef<Set<string>>(new Set());

  const isDevMode = APP_CONFIG.devMode;

  // Load pickups assigned to this driver
  const loadPickups = useCallback(async () => {
    if (!user?.id) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: Pickup[] = raw ? JSON.parse(raw) : [];
      // Zone intelligence: strictly enforce zone boundary
      const driverZoneId = user.zoneId;
      const mine = all.filter(
        (p) =>
          p.assignedDriverId === user.id &&
          driverZoneId != null &&
          driverZoneId !== "" &&
          p.zoneId === driverZoneId &&
          p.status !== "completed" &&
          p.status !== "confirmed" &&
          p.status !== "cancelled"
      );
      setPickups(mine);
      const inProgress = mine.find((p) => p.status === "in_progress");
      setActivePickup(inProgress ?? mine[0] ?? null);
    } catch (_e) {
      // ignore
    }
  }, [user?.id, user?.zoneId]);

  // Persist driver location to AsyncStorage
  const persistLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!user?.id) return;
      try {
        const dsRaw = await AsyncStorage.getItem(DRIVER_STATUS_KEY);
        const ds = dsRaw ? JSON.parse(dsRaw) : {};
        ds[user.id] = {
          driverId: user.id,
          driverName: user.fullName || user.firstName || "Driver",
          zoneId: user.zoneId || "unknown",
          latitude: lat,
          longitude: lng,
          isOnline: true,
          lastUpdated: new Date().toISOString(),
        };
        await AsyncStorage.setItem(DRIVER_STATUS_KEY, JSON.stringify(ds));
        setLastUpdated(new Date());

        // Zone intelligence: check if driver is outside their assigned zone boundary
        if (zoneBoundsRef.current && zoneBoundsRef.current.length >= 2) {
          const inside = isInsideZone(lat, lng, zoneBoundsRef.current);
          setIsOutsideZone(!inside);
        }
      } catch (_e) {
        // ignore
      }
    },
    [user?.id, user?.zoneId, user?.fullName, user?.firstName]
  );

  // Check proximity to pickups and fire arrival alerts
  const checkProximityAlerts = useCallback(async (
    lat: number,
    lng: number,
    currentPickups: Pickup[]
  ) => {
    if (!user) return;
    const driverName = user.fullName || user.firstName || "Driver";
    for (const p of currentPickups) {
      if (!p.latitude || !p.longitude) continue;
      const dist = calcDistMetres(lat, lng, p.latitude, p.longitude);
      if (dist <= 100 && !arrivedAlertSentRef.current.has(p.id)) {
        arrivedAlertSentRef.current.add(p.id);
        nearAlertSentRef.current.add(p.id);
        await triggerDriverArrivalAlert("reached", {
          pickupId: p.id,
          householdName: p.householdName,
          address: p.address,
          driverName,
          distanceMetres: dist,
          etaMinutes: 1,
        });
      } else if (dist <= 500 && !nearAlertSentRef.current.has(p.id)) {
        nearAlertSentRef.current.add(p.id);
        await triggerDriverArrivalAlert("near", {
          pickupId: p.id,
          householdName: p.householdName,
          address: p.address,
          driverName,
          distanceMetres: dist,
          etaMinutes: etaMinutesFromMetres(dist),
        });
      }
    }
  }, [user]);

  // Optimise route from current location
  const handleOptimizeRoute = useCallback(async (currentLoc: { latitude: number; longitude: number }) => {
    const gpsPickups = pickups.filter((p) => p.latitude && p.longitude);
    if (gpsPickups.length === 0) return;
    setIsOptimizing(true);
    try {
      const storedKey = await AsyncStorage.getItem(GMAPS_API_KEY_STORAGE);
      const routePickups: RoutePickup[] = gpsPickups.map((p) => ({
        id: p.id,
        householdName: p.householdName,
        address: p.address,
        latitude: p.latitude!,
        longitude: p.longitude!,
        status: p.status,
      }));
      const result = await optimizeGarbageRoute(currentLoc, routePickups, storedKey || undefined);
      setOptimizedRoute(result);
      if (result.polylinePoints) {
        setRoutePolyline(decodePolyline(result.polylinePoints));
      } else {
        // Build simple straight-line waypoints for fallback
        setRoutePolyline([
          currentLoc,
          ...result.orderedPickups.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        ]);
      }
    } catch (_e) {
      // Non-fatal
    } finally {
      setIsOptimizing(false);
    }
  }, [pickups]);

  // Start location tracking
  const startTracking = useCallback(async () => {
    if (Platform.OS === "web") {
      // Web: use browser geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setDriverLocation(loc);
            persistLocation(loc.latitude, loc.longitude);
            setIsLoading(false);
          },
          () => {
            // Fallback to Lusaka center in devMode
            if (isDevMode) {
              setDriverLocation(LUSAKA_CENTER);
              persistLocation(LUSAKA_CENTER.latitude, LUSAKA_CENTER.longitude);
            } else {
              setLocationError("Location permission denied.");
            }
            setIsLoading(false);
          }
        );
        // Periodic updates on web
        intervalRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition((pos) => {
            const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setDriverLocation(loc);
            persistLocation(loc.latitude, loc.longitude);
            checkProximityAlerts(loc.latitude, loc.longitude, pickups);
          });
        }, LOCATION_INTERVAL_MS);
      } else {
        if (isDevMode) setDriverLocation(LUSAKA_CENTER);
        setIsLoading(false);
      }
      return;
    }

    // Native: expo-location
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      if (isDevMode) {
        setDriverLocation(LUSAKA_CENTER);
        persistLocation(LUSAKA_CENTER.latitude, LUSAKA_CENTER.longitude);
        setIsLoading(false);
      } else {
        setLocationError("Location permission is required for the map.");
        setIsLoading(false);
      }
      return;
    }

    // Get initial position
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const loc = { latitude: current.coords.latitude, longitude: current.coords.longitude };
    setDriverLocation(loc);
    persistLocation(loc.latitude, loc.longitude);
    setIsLoading(false);

    // Watch for updates
    locationWatchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: LOCATION_INTERVAL_MS,
        distanceInterval: 30,
      },
      (position) => {
        const updated = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setDriverLocation(updated);
        persistLocation(updated.latitude, updated.longitude);
        checkProximityAlerts(updated.latitude, updated.longitude, pickups);
      }
    );
  }, [isDevMode, persistLocation]);

  useFocusEffect(
    useCallback(() => {
      loadPickups();
      startTracking();
      return () => {
        locationWatchRef.current?.remove();
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [loadPickups, startTracking])
  );

  const activePickupDistance =
    driverLocation && activePickup?.latitude && activePickup?.longitude
      ? haversineKm(
          driverLocation.latitude,
          driverLocation.longitude,
          activePickup.latitude,
          activePickup.longitude
        )
      : null;

  const eta = activePickupDistance != null ? etaMinutes(activePickupDistance) : null;

  // Render a web-compatible map fallback (react-native-maps only works on native)
  if (Platform.OS === "web") {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Live Map</Text>
          {lastUpdated && (
            <Text style={styles.headerSub}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          )}
        </View>

        {isDevMode && (
          <View style={styles.devBanner}>
            <MaterialIcons name="warning" size={14} color="#92400E" />
            <Text style={styles.devBannerText}>Development Mode: Location may be simulated.</Text>
          </View>
        )}

        {/* Zone intelligence: outside-zone warning banner */}
        {isOutsideZone && (
          <View style={styles.outsideZoneBanner}>
            <MaterialIcons name="warning" size={14} color="#7C2D12" />
            <Text style={styles.outsideZoneBannerText}>You are outside your assigned zone</Text>
          </View>
        )}

        <View style={styles.webMapPlaceholder}>
          <MaterialIcons name="map" size={64} color="#334155" />
          <Text style={styles.webMapTitle}>Live Map</Text>
          <Text style={styles.webMapSubtitle}>
            Interactive map is available on iOS and Android devices.
          </Text>
          {driverLocation && (
            <View style={styles.coordCard}>
              <MaterialIcons name="my-location" size={16} color={DRIVER_ORANGE} />
              <Text style={styles.coordText}>
                Your location: {driverLocation.latitude.toFixed(4)},{" "}
                {driverLocation.longitude.toFixed(4)}
              </Text>
            </View>
          )}
        </View>

        {/* Active Pickup Info Card */}
        {activePickup && (
          <View style={styles.pickupInfoCard}>
            <View style={styles.pickupInfoHeader}>
              <MaterialIcons name="local-shipping" size={20} color={DRIVER_ORANGE} />
              <Text style={styles.pickupInfoTitle}>Active Pickup</Text>
              {eta != null && (
                <View style={styles.etaBadge}>
                  <Text style={styles.etaText}>~{eta} min</Text>
                </View>
              )}
            </View>
            <Text style={styles.pickupInfoName}>{activePickup.householdName}</Text>
            <Text style={styles.pickupInfoAddress}>{activePickup.address}</Text>
            {activePickupDistance != null && (
              <Text style={styles.pickupInfoDistance}>
                {activePickupDistance < 1
                  ? `${Math.round(activePickupDistance * 1000)} m away`
                  : `${activePickupDistance.toFixed(1)} km away`}
              </Text>
            )}
          </View>
        )}

        {/* All assigned pickups list */}
        <View style={styles.pickupsList}>
          <Text style={styles.pickupsListTitle}>Pickups on Route ({pickups.length})</Text>
          {pickups.map((p) => (
            <View key={p.id} style={styles.pickupRow}>
              <View
                style={[
                  styles.pickupRowDot,
                  {
                    backgroundColor:
                      p.status === "in_progress"
                        ? DRIVER_ORANGE
                        : p.status === "accepted"
                        ? "#8B5CF6"
                        : "#3B82F6",
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickupRowName}>{p.householdName}</Text>
                <Text style={styles.pickupRowAddress} numberOfLines={1}>{p.address}</Text>
              </View>
              {p.latitude && p.longitude && driverLocation && (
                <Text style={styles.pickupRowDist}>
                  {haversineKm(
                    driverLocation.latitude,
                    driverLocation.longitude,
                    p.latitude,
                    p.longitude
                  ).toFixed(1)}{" "}
                  km
                </Text>
              )}
            </View>
          ))}
          {pickups.length === 0 && (
            <Text style={styles.noPickupsText}>No active pickups on route.</Text>
          )}
        </View>
      </ScreenContainer>
    );
  }

  // Native map (react-native-maps)
  // Dynamic import to avoid web crash
  const MapView = require("react-native-maps").default;
  const { Marker, Callout, Polyline } = require("react-native-maps");

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={DRIVER_ORANGE} />
          <Text style={styles.loadingText}>Getting your location...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (locationError) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <MaterialIcons name="location-off" size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Location Required</Text>
          <Text style={styles.errorSubtitle}>{locationError}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLocationError(null);
              setIsLoading(true);
              startTracking();
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const region = driverLocation
    ? {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: LUSAKA_CENTER.latitude,
        longitude: LUSAKA_CENTER.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <View style={styles.nativeContainer}>
      {isDevMode && (
        <View style={styles.devBannerAbsolute}>
          <MaterialIcons name="warning" size={12} color="#92400E" />
          <Text style={styles.devBannerAbsoluteText}>Dev Mode — Location may be simulated</Text>
        </View>
      )}

      {/* Zone intelligence: outside-zone warning banner (native overlay) */}
      {isOutsideZone && (
        <View style={styles.outsideZoneBannerAbsolute}>
          <MaterialIcons name="warning" size={14} color="#7C2D12" />
          <Text style={styles.outsideZoneBannerText}>You are outside your assigned zone</Text>
        </View>
      )}

      <MapView style={styles.nativeMap} initialRegion={region} showsUserLocation showsMyLocationButton>
        {/* Driver location marker */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            title="You"
            description="Your current location"
            pinColor={DRIVER_ORANGE}
          />
        )}

        {/* Pickup markers — numbered by optimised sequence if available */}
        {pickups.map((p, idx) => {
          const seqNum = optimizedRoute
            ? (optimizedRoute.orderedPickups.findIndex((op) => op.id === p.id) + 1) || null
            : null;
          return p.latitude && p.longitude ? (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              pinColor={p.status === "in_progress" ? DRIVER_ORANGE : seqNum ? "#22C55E" : "#3B82F6"}
            >
              <Callout>
                <View style={styles.callout}>
                  {seqNum && <Text style={styles.calloutSeq}>Stop {seqNum}</Text>}
                  <Text style={styles.calloutTitle}>{p.householdName}</Text>
                  <Text style={styles.calloutAddress}>{p.address}</Text>
                  <Text style={[styles.calloutStatus, { color: p.status === "in_progress" ? DRIVER_ORANGE : "#3B82F6" }]}>
                    {p.status.replace("_", " ").toUpperCase()}
                  </Text>
                </View>
              </Callout>
            </Marker>
          ) : null;
        })}

        {/* Route polyline */}
        {routePolyline.length >= 2 && (
          <Polyline
            coordinates={routePolyline}
            strokeColor={DRIVER_ORANGE}
            strokeWidth={3}
            lineDashPattern={[8, 4]}
          />
        )}
      </MapView>

      {/* Active pickup info overlay */}
      {activePickup && (
        <View style={styles.nativePickupCard}>
          <View style={styles.pickupInfoHeader}>
            <MaterialIcons name="local-shipping" size={18} color={DRIVER_ORANGE} />
            <Text style={styles.pickupInfoTitle}>{activePickup.householdName}</Text>
            {eta != null && (
              <View style={styles.etaBadge}>
                <Text style={styles.etaText}>~{eta} min</Text>
              </View>
            )}
          </View>
          <Text style={styles.pickupInfoAddress}>{activePickup.address}</Text>
          {activePickupDistance != null && (
            <Text style={styles.pickupInfoDistance}>
              {activePickupDistance < 1
                ? `${Math.round(activePickupDistance * 1000)} m away`
                : `${activePickupDistance.toFixed(1)} km away`}
            </Text>
          )}
        </View>
      )}

      {/* Last updated */}
      {lastUpdated && (
        <View style={styles.lastUpdatedBadge}>
          <MaterialIcons name="gps-fixed" size={12} color="#22C55E" />
          <Text style={styles.lastUpdatedText}>
            {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      )}

      {/* Route info badge (shown after optimisation) */}
      {optimizedRoute && (
        <View style={styles.routeInfoBadge}>
          <MaterialIcons name="alt-route" size={14} color={DRIVER_ORANGE} />
          <View>
            <Text style={styles.routeInfoText}>
              {formatRouteDistance(optimizedRoute.totalDistanceMetres)} · {formatRouteDuration(optimizedRoute.totalDurationMinutes)}
            </Text>
            <Text style={styles.routeInfoMuted}>
              {optimizedRoute.orderedPickups.length} stops{optimizedRoute.optimizedByApi ? " · Google Maps" : " · estimated"}
            </Text>
          </View>
        </View>
      )}

      {/* Start Route / Optimise button */}
      {pickups.some((p) => p.latitude && p.longitude) && (
        <TouchableOpacity
          style={styles.startRouteBtn}
          onPress={() => driverLocation && handleOptimizeRoute(driverLocation)}
          disabled={isOptimizing}
        >
          {isOptimizing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialIcons name="alt-route" size={18} color="white" />
          )}
          <Text style={styles.startRouteBtnText}>
            {optimizedRoute ? "Re-optimise" : "Start Route"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  devBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(6),
    gap: _rs.sp(6),
  },
  devBannerText: { color: "#92400E", fontSize: _rs.fs(11), flex: 1 },
  devBannerAbsolute: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(4),
    gap: _rs.sp(4),
    zIndex: 10,
  },
  devBannerAbsoluteText: { color: "#92400E", fontSize: _rs.fs(11) },
  outsideZoneBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(8),
    gap: _rs.sp(6),
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
  },
  outsideZoneBannerAbsolute: {
    position: "absolute",
    top: 48,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
    gap: _rs.sp(6),
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  outsideZoneBannerText: { color: "#7C2D12", fontSize: _rs.fs(12), fontWeight: "600" },
  header: {
    paddingHorizontal: _rs.sp(16),
    paddingVertical: _rs.sp(14),
    borderBottomWidth: 0.5,
    borderBottomColor: "#334155",
  },
  headerTitle: { color: "#ECEDEE", fontSize: _rs.fs(20), fontWeight: "700" },
  headerSub: { color: "#9BA1A6", fontSize: _rs.fs(12), marginTop: _rs.sp(2) },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: _rs.sp(12) },
  loadingText: { color: "#9BA1A6", fontSize: _rs.fs(14) },
  errorTitle: { color: "#ECEDEE", fontSize: _rs.fs(16), fontWeight: "600" },
  errorSubtitle: { color: "#9BA1A6", fontSize: _rs.fs(13), textAlign: "center", paddingHorizontal: _rs.sp(32) },
  retryBtn: {
    backgroundColor: DRIVER_ORANGE,
    borderRadius: _rs.s(10),
    paddingHorizontal: _rs.sp(24),
    paddingVertical: _rs.sp(10),
    marginTop: _rs.sp(8),
  },
  retryBtnText: { color: "white", fontWeight: "600" },
  webMapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: _rs.sp(12),
    minHeight: 200,
    backgroundColor: "#1e2022",
    margin: _rs.sp(16),
    borderRadius: _rs.s(16),
    borderWidth: 0.5,
    borderColor: "#334155",
  },
  webMapTitle: { color: "#ECEDEE", fontSize: _rs.fs(18), fontWeight: "700" },
  webMapSubtitle: { color: "#9BA1A6", fontSize: _rs.fs(13), textAlign: "center", paddingHorizontal: _rs.sp(32) },
  coordCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(6),
    backgroundColor: "#334155",
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(12),
    paddingVertical: _rs.sp(6),
  },
  coordText: { color: "#ECEDEE", fontSize: _rs.fs(12) },
  pickupInfoCard: {
    margin: _rs.sp(16),
    backgroundColor: "#1e2022",
    borderRadius: _rs.s(14),
    padding: _rs.sp(14),
    borderWidth: 0.5,
    borderColor: DRIVER_ORANGE + "60",
    gap: _rs.sp(6),
  },
  pickupInfoHeader: { flexDirection: "row", alignItems: "center", gap: _rs.sp(8) },
  pickupInfoTitle: { color: "#ECEDEE", fontSize: _rs.fs(15), fontWeight: "700", flex: 1 },
  etaBadge: {
    backgroundColor: DRIVER_ORANGE,
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(8),
    paddingVertical: _rs.sp(3),
  },
  etaText: { color: "white", fontSize: _rs.fs(12), fontWeight: "700" },
  pickupInfoName: { color: "#ECEDEE", fontSize: _rs.fs(14), fontWeight: "600" },
  pickupInfoAddress: { color: "#9BA1A6", fontSize: _rs.fs(13) },
  pickupInfoDistance: { color: DRIVER_ORANGE, fontSize: _rs.fs(13), fontWeight: "600" },
  pickupsList: { paddingHorizontal: _rs.sp(16), paddingBottom: _rs.sp(24) },
  pickupsListTitle: {
    color: "#9BA1A6",
    fontSize: _rs.fs(12),
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: _rs.sp(10),
  },
  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(10),
    paddingVertical: _rs.sp(8),
    borderBottomWidth: 0.5,
    borderBottomColor: "#334155",
  },
  pickupRowDot: { width: _rs.s(10), height: _rs.s(10), borderRadius: _rs.s(5) },
  pickupRowName: { color: "#ECEDEE", fontSize: _rs.fs(13), fontWeight: "600" },
  pickupRowAddress: { color: "#9BA1A6", fontSize: _rs.fs(11) },
  pickupRowDist: { color: "#9BA1A6", fontSize: _rs.fs(12) },
  noPickupsText: { color: "#9BA1A6", fontSize: _rs.fs(13), textAlign: "center", paddingVertical: _rs.sp(16) },
  // Native map
  nativeContainer: { flex: 1 },
  nativeMap: { flex: 1 },
  nativePickupCard: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#151718",
    borderRadius: _rs.s(14),
    padding: _rs.sp(14),
    borderWidth: 0.5,
    borderColor: DRIVER_ORANGE + "60",
    gap: _rs.sp(4),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  lastUpdatedBadge: {
    position: "absolute",
    top: 50,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(4),
    backgroundColor: "#151718",
    borderRadius: _rs.s(8),
    paddingHorizontal: _rs.sp(8),
    paddingVertical: _rs.sp(4),
    borderWidth: 0.5,
    borderColor: "#334155",
  },
  lastUpdatedText: { color: "#9BA1A6", fontSize: _rs.fs(11) },
  callout: { padding: _rs.sp(8), maxWidth: 200 },
  calloutSeq: { fontSize: _rs.fs(10), fontWeight: "700", color: DRIVER_ORANGE, marginBottom: _rs.sp(2), textTransform: "uppercase" },
  calloutTitle: { fontWeight: "700", fontSize: _rs.fs(13), marginBottom: _rs.sp(2) },
  calloutAddress: { fontSize: _rs.fs(11), color: "#687076", marginBottom: _rs.sp(4) },
  calloutStatus: { fontSize: _rs.fs(11), fontWeight: "600" },
  startRouteBtn: {
    position: "absolute",
    bottom: 140,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(6),
    backgroundColor: "#22C55E",
    borderRadius: _rs.s(24),
    paddingHorizontal: _rs.sp(14),
    paddingVertical: _rs.sp(10),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  startRouteBtnText: { color: "white", fontSize: _rs.fs(13), fontWeight: "700" },
  routeInfoBadge: {
    position: "absolute",
    top: 50,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: _rs.sp(6),
    backgroundColor: "#151718",
    borderRadius: _rs.s(10),
    paddingHorizontal: _rs.sp(10),
    paddingVertical: _rs.sp(6),
    borderWidth: 0.5,
    borderColor: "#334155",
  },
  routeInfoText: { color: "#ECEDEE", fontSize: _rs.fs(11), fontWeight: "600" },
  routeInfoMuted: { color: "#9BA1A6", fontSize: _rs.fs(10) },
});
