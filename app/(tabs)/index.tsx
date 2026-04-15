import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { AppState, AppStateStatus, Platform, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StorageEventBus } from "@/lib/storage-event-bus";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  StyleSheet,
  Linking,
  RefreshControl,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { usePickups } from "@/lib/pickups-context";
import { useFeaturedUpdates } from "@/lib/featured-updates-context";
import { useNews } from "@/contexts/news-context";
import { NewsCarousel } from "@/components/news-carousel";
import { APP_CONFIG, CONTACTS, SUBSCRIPTION_PLANS } from "@/constants/app";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSubscriptionApproval } from "@/lib/subscription-approval-context";
import { useGlobalNotifications } from "@/lib/global-notification-context";

import { getStaticResponsive } from "@/hooks/use-responsive";
import {
  DRIVER_STATUS_KEY,
  type DriverStatusEntry,
  distanceMetres as calcDistMetres,
  etaMinutesFromMetres,
} from "@/lib/driver-tracking-service";
export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { pickups, refreshPickups } = usePickups();
  const { getUpdatesForRole, dismissUpdate } = useFeaturedUpdates();
  const { getActiveHomeNews } = useNews();
  const [refreshing, setRefreshing] = useState(false);
  const { getRequestsByUserId } = useSubscriptionApproval();

  // Live location for map card
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  // Zone name from user profile
  const zoneName = (user as any)?.assignedZoneName || (user as any)?.zoneName || null;

  // Driver real-time tracking state
  const [driverLocation, setDriverLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [driverEtaMinutes, setDriverEtaMinutes] = useState<number | null>(null);
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get featured updates for user's role
  const featuredUpdates = user ? getUpdatesForRole(user.role) : [];

  const isCollector = user?.role === "collector" || user?.role === "zone_manager";
  const isRecycler = user?.role === "recycler";
  const isCustomer = user?.role === "residential" || user?.role === "commercial";
  const isDriver = user?.role === "driver";

  // Notification unread count — from global real-time notification provider
  const { unreadCount: unreadNotifCount } = useGlobalNotifications();

  // Subscription approval status for the current customer
  const userSubscriptionRequests = user ? getRequestsByUserId(user.id) : [];
  const hasPendingApproval = !user?.subscription && userSubscriptionRequests.some(r => r.status === 'pending');
  const hasApprovedAwaitingActivation = !user?.subscription && userSubscriptionRequests.some(r => r.status === 'approved');
  const latestPendingRequest = userSubscriptionRequests.find(r => r.status === 'pending' || r.status === 'approved');

  // Get user's pickups
  const userPickups = pickups.filter((p) => p.userId === user?.id);
  const pendingPickups = userPickups.filter(
    (p) => p.status === "pending" || p.status === "assigned"
  );
  const completedPickups = userPickups.filter((p) => p.status === "completed");

  // For collectors - get all pending pickups
  const allPendingPickups = pickups.filter(
    (p) => p.status === "pending" || p.status === "assigned"
  );

  // Real-time: reload pickups AND the user session on every focus.
  // This ensures the subscription card reflects admin changes immediately
  // without requiring the customer to log out and back in.
  const reloadAll = useCallback(async () => {
    refreshPickups();
    // Re-read the user session directly from AsyncStorage so subscription
    // changes made by the admin (on the same or a different device) are visible.
    try {
      const raw = await AsyncStorage.getItem('@ltc_user');
      if (raw) {
        const fresh = JSON.parse(raw);
        // Emit the bus key so AuthProvider.loadUser() picks up the latest data
        StorageEventBus.emit('@ltc_user');
      }
    } catch { /* non-critical */ }
  }, [refreshPickups]);

  useFocusEffect(
    useCallback(() => {
      reloadAll();
    }, [reloadAll])
  );

  // Also reload when the app returns to foreground (cross-device scenario)
  useEffect(() => {
    let appStateRef: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.match(/inactive|background/) && next === 'active') {
        reloadAll();
      }
      appStateRef = next;
    });
    return () => sub.remove();
  }, [reloadAll]);

  // Request location permission and get current position for map card
  useEffect(() => {
    if (!isCustomer) return;
    let cancelled = false;
    const getLocation = async () => {
      setLocationLoading(true);
      setLocationError(null);
      try {
        if (Platform.OS === 'web') {
          // Web: use browser geolocation
          if (!navigator.geolocation) {
            setLocationError('Geolocation not supported');
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!cancelled) {
                setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              }
            },
            () => {
              if (!cancelled) setLocationError('Location unavailable');
            }
          );
        } else {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            if (!cancelled) setLocationError('Location permission denied');
            return;
          }
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!cancelled) {
            setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          }
        }
      } catch {
        if (!cancelled) setLocationError('Could not get location');
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    };
    getLocation();
    return () => { cancelled = true; };
  }, [isCustomer]);

  // Poll driver location every 5s when customer has an active (accepted/in_progress) pickup
  useEffect(() => {
    if (!isCustomer || !user?.id) return;

    const pollDriverLocation = async () => {
      try {
        // Find the most recent active pickup for this customer — use in-memory pickups from context
        const activePickup = pickups.find(
          (p) =>
            p.userId === user.id &&
            (p.status === 'assigned' || p.status === 'accepted' || p.status === 'in_progress')
        );

        if (!activePickup?.assignedDriverId && !activePickup?.collectorId) {
          // No active pickup with a driver — clear driver marker
          setDriverLocation(null);
          setDriverEtaMinutes(null);
          return;
        }

        const driverId = activePickup.assignedDriverId || activePickup.collectorId;

        // Read driver status from AsyncStorage
        const dsRaw = await AsyncStorage.getItem(DRIVER_STATUS_KEY);
        if (!dsRaw) {
          setDriverLocation(null);
          setDriverEtaMinutes(null);
          return;
        }
        const ds: Record<string, DriverStatusEntry> = JSON.parse(dsRaw);
        const entry = ds[driverId];

        if (!entry || !entry.isOnline) {
          setDriverLocation(null);
          setDriverEtaMinutes(null);
          return;
        }

        const newLoc = { latitude: entry.latitude, longitude: entry.longitude };
        setDriverLocation(newLoc);

        // Calculate ETA to pickup location
        if (activePickup.location?.latitude && activePickup.location?.longitude) {
          const dist = calcDistMetres(
            entry.latitude, entry.longitude,
            activePickup.location.latitude, activePickup.location.longitude
          );
          setDriverEtaMinutes(etaMinutesFromMetres(dist));
        }

        // Animate map to fit both pins
        if (mapRef.current && userLocation) {
          mapRef.current.fitToCoordinates(
            [
              { latitude: entry.latitude, longitude: entry.longitude },
              { latitude: userLocation.latitude, longitude: userLocation.longitude },
            ],
            { edgePadding: { top: 40, right: 40, bottom: 80, left: 40 }, animated: true }
          );
        }
      } catch {
        // Non-fatal
      }
    };

    // Poll immediately then every 5 seconds
    pollDriverLocation();
    trackingIntervalRef.current = setInterval(pollDriverLocation, 5000);

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    };
  }, [isCustomer, user?.id, userLocation]);

  // Subscribe to StorageEventBus for @ltc_user so the card updates
  // the instant the admin activates the subscription on the same device.
  useEffect(() => {
    return StorageEventBus.subscribe('@ltc_user', () => {
      refreshPickups();
    });
  }, [refreshPickups]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPickups();
    setRefreshing(false);
  };

  const openWhatsApp = () => {
    Linking.openURL(CONTACTS.whatsappSupport);
  };

  const makeCall = () => {
    Linking.openURL(`tel:${CONTACTS.mainPhone}`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="px-6 pt-4 pb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-base text-muted">{getGreeting()}</Text>
            <Text className="text-2xl font-bold text-foreground">
              {user.fullName?.split(" ")[0] || "User"}
            </Text>
            {/* Zone chip — shown for customers who have been assigned a zone */}
            {isCustomer && zoneName ? (
              <View style={styles.zoneChip}>
                <MaterialIcons name="location-on" size={12} color="#00796B" />
                <Text style={styles.zoneChipText}>{zoneName}</Text>
              </View>
            ) : null}
          </View>
          {isCustomer && (
            <TouchableOpacity
              onPress={() => router.push("/notifications" as any)}
              style={styles.bellBtn}
            >
              <MaterialIcons name="notifications" size={24} color="#fff" />
              {unreadNotifCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadNotifCount > 99 ? "99+" : String(unreadNotifCount)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Welcome Card */}
        <View className="px-6 mb-6">
          <View className="bg-primary rounded-2xl p-6">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="eco" size={24} color="#fff" />
              <Text className="text-white text-lg font-semibold ml-2">
                Welcome to {APP_CONFIG.name}
              </Text>
            </View>
            <Text className="text-white/90 text-base leading-6">
              {isCollector
                ? "View your assigned routes and complete pickups efficiently."
                : "Request garbage pickups, track your collections, and keep your environment clean!"}
            </Text>
          </View>
        </View>

        {/* 👉 Updates Section (moved above Carrier Services) */}
        <View className="mb-6">
          <View className="px-6 mb-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">
                👉 Updates
              </Text>
              <TouchableOpacity onPress={() => router.push("/news" as any)}>
                <Text className="text-primary font-medium">All News</Text>
              </TouchableOpacity>
            </View>
          </View>
          <NewsCarousel news={getActiveHomeNews()} />
        </View>

        {/* Trash Pickup Services Section (moved below Updates) */}
        {isCustomer && (
          <View className="px-6 mb-3">
            <Text className="text-lg font-semibold text-foreground">
              Trash Pickup Services
            </Text>
          </View>
        )}

        {/* Subscription Status (for customers) */}
        {isCustomer && (
          <View className="px-6 mb-6">


            {/* Pending approval banner — payment received, waiting for admin review */}
            {hasPendingApproval && (
              <View className="bg-primary/10 rounded-2xl p-4 mb-3 flex-row items-center border border-primary/30">
                <MaterialIcons name="hourglass-empty" size={20} color="#0a7ea4" />
                <View className="ml-3 flex-1">
                  <Text className="text-primary font-semibold text-sm">
                    Subscription Pending Approval
                  </Text>
                  <Text className="text-primary/80 text-xs mt-0.5">
                    Your payment has been received. An admin will activate your account shortly.
                  </Text>
                  {latestPendingRequest?.paymentReference ? (
                    <Text className="text-primary/60 text-xs mt-1">
                      Ref: {latestPendingRequest.paymentReference}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Approved but not yet activated banner */}
            {hasApprovedAwaitingActivation && (
              <View className="bg-success/10 rounded-2xl p-4 mb-3 flex-row items-center border border-success/30">
                <MaterialIcons name="check-circle-outline" size={20} color="#22C55E" />
                <View className="ml-3 flex-1">
                  <Text className="text-success font-semibold text-sm">
                    Subscription Approved!
                  </Text>
                  <Text className="text-success/80 text-xs mt-0.5">
                    Your subscription has been approved and is being activated. This may take a moment.
                  </Text>
                </View>
              </View>
            )}
            {/* Subscription card — always visible so customer can subscribe when ready */}
            <View className="bg-surface rounded-2xl p-5 border border-border">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-foreground">
                  Subscription
                </Text>
                <View
                  className={`px-3 py-1 rounded-full ${
                    user.subscription
                      ? "bg-success/20"
                      : hasPendingApproval
                      ? "bg-primary/20"
                      : hasApprovedAwaitingActivation
                      ? "bg-success/20"
                      : "bg-warning/20"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      user.subscription
                        ? "text-success"
                        : hasPendingApproval
                        ? "text-primary"
                        : hasApprovedAwaitingActivation
                        ? "text-success"
                        : "text-warning"
                    }`}
                  >
                    {user.subscription
                      ? "Active"
                      : hasPendingApproval
                      ? "Pending"
                      : hasApprovedAwaitingActivation
                      ? "Approved"
                      : "Not Subscribed"}
                  </Text>
                </View>
              </View>
              {user.subscription ? (
                <View>
                  <Text className="text-muted text-base">
                    {user.subscription.planName} Plan
                  </Text>
                  <Text className="text-sm text-muted mt-1">
                    {user.subscription.pickupsRemaining === -1
                      ? "Unlimited pickups"
                      : `${user.subscription.pickupsRemaining} pickups remaining`}
                  </Text>
                </View>
              ) : (
                <View>
                  <Text className="text-muted text-base mb-3">
                    {APP_CONFIG.requireSubscriptionForPickup
                      ? "Subscribe to start requesting pickups"
                      : "Subscribe to unlock priority pickups and more features"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/subscription-plans" as any)}
                    className="bg-primary py-3 rounded-xl"
                  >
                    <Text className="text-white text-center font-semibold">
                      View Plans
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Live Map Card + Pickup Actions (for customers) */}
        {isCustomer && (
          <View className="mb-6">
            {/* Section title */}
            <View className="px-6 mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-foreground">Your Location</Text>
              {zoneName ? (
                <View style={styles.zoneChip}>
                  <MaterialIcons name="location-on" size={12} color="#00796B" />
                  <Text style={styles.zoneChipText}>{zoneName}</Text>
                </View>
              ) : null}
            </View>

            {/* Map card */}
            <View style={styles.mapCard}>
              {locationLoading ? (
                <View style={styles.mapPlaceholder}>
                  <MaterialIcons name="location-searching" size={32} color="#9CA3AF" />
                  <Text style={{ color: '#9CA3AF', marginTop: 8, fontSize: 13 }}>Getting your location...</Text>
                </View>
              ) : locationError || !userLocation ? (
                <View style={styles.mapPlaceholder}>
                  <MaterialIcons name="location-off" size={32} color="#9CA3AF" />
                  <Text style={{ color: '#9CA3AF', marginTop: 8, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 }}>
                    {locationError || 'Location unavailable'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/request-pickup' as any)}
                    style={[styles.mapOverlayButton, { marginTop: 12 }]}
                  >
                    <MaterialIcons name="add-location" size={18} color="#fff" />
                    <Text style={styles.mapOverlayButtonText}>Request Pickup</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <MapView
                    ref={mapRef}
                    style={styles.mapView}
                    provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                    initialRegion={{
                      latitude: userLocation.latitude,
                      longitude: userLocation.longitude,
                      latitudeDelta: 0.012,
                      longitudeDelta: 0.012,
                    }}
                    showsUserLocation={false}
                    scrollEnabled={true}
                    zoomEnabled={true}
                    rotateEnabled={true}
                    pitchEnabled={true}
                    showsMyLocationButton={false}
                    showsCompass={true}
                    zoomControlEnabled={Platform.OS === "android"}
                  >
                    {/* Customer's pickup location — green pin */}
                    <Marker
                      coordinate={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
                      title="Your Pickup Location"
                      description={user.location?.address || 'Your pinned location'}
                      pinColor="#22C55E"
                    />

                    {/* Driver live location — truck icon */}
                    {driverLocation && (
                      <Marker
                        coordinate={driverLocation}
                        title="Driver"
                        description={driverEtaMinutes != null ? `ETA: ~${driverEtaMinutes} min` : 'On the way'}
                        pinColor="#EF4444"
                      />
                    )}

                    {/* Red route line from driver to pickup */}
                    {driverLocation && (
                      <Polyline
                        coordinates={[
                          { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
                          { latitude: userLocation.latitude, longitude: userLocation.longitude },
                        ]}
                        strokeColor="#EF4444"
                        strokeWidth={3}
                        lineDashPattern={[8, 4]}
                      />
                    )}
                  </MapView>

                  {/* Floating Recenter button — top-right corner of the map */}
                  <TouchableOpacity
                    style={styles.recenterButton}
                    onPress={() => {
                      if (mapRef.current && userLocation) {
                        mapRef.current.animateToRegion(
                          {
                            latitude: userLocation.latitude,
                            longitude: userLocation.longitude,
                            latitudeDelta: 0.012,
                            longitudeDelta: 0.012,
                          },
                          400
                        );
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="my-location" size={20} color="#1B4332" />
                  </TouchableOpacity>

                  {/* Overlay bar — dark green, white text */}
                  <View style={styles.mapOverlay}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      {driverLocation ? (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                            <View style={styles.trackingDot} />
                            <Text style={{ fontSize: 11, color: '#86EFAC', fontWeight: '600' }}>Driver is on the way</Text>
                          </View>
                          <Text style={{ fontSize: 13, color: '#fff', fontWeight: '700' }}>
                            {driverEtaMinutes != null ? `ETA: ~${driverEtaMinutes} min` : 'Locating driver...'}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>Pickup location</Text>
                          <Text style={{ fontSize: 13, color: '#fff', fontWeight: '600' }} numberOfLines={1}>
                            {user.location?.address || 'Current location'}
                          </Text>
                        </>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.mapOverlayButton}
                      onPress={() => router.push('/request-pickup' as any)}
                    >
                      <MaterialIcons name="add-location" size={16} color="#fff" />
                      <Text style={styles.mapOverlayButtonText}>Request Pickup</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Secondary action buttons: My Pickups + Report Issue */}
            <View className="px-6 flex-row gap-3">
              <TouchableOpacity
                onPress={() => router.push('/pickups' as any)}
                className="flex-1 bg-surface rounded-xl p-4 border border-border items-center"
              >
                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mb-2">
                  <MaterialIcons name="history" size={22} color="#3B82F6" />
                </View>
                <Text className="text-sm font-semibold text-foreground text-center">My Pickups</Text>
                <Text className="text-xs text-muted text-center mt-1">View history</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push('/report-issue' as any)}
                className="flex-1 bg-surface rounded-xl p-4 border border-border items-center"
              >
                <View className="w-10 h-10 rounded-full bg-orange-100 items-center justify-center mb-2">
                  <MaterialIcons name="camera-alt" size={22} color="#F59E0B" />
                </View>
                <Text className="text-sm font-semibold text-foreground text-center">Report Issue</Text>
                <Text className="text-xs text-muted text-center mt-1">Send photos</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Carrier Services Section (moved below pickup actions) */}
        <View className="mb-6">
          <View className="px-6 mb-3">
            <Text className="text-lg font-semibold text-foreground">Carrier Services</Text>
          </View>
          <View style={{ backgroundColor: '#1E3A8A' }} className="px-6 py-6 rounded-2xl mx-6">
            <View className="flex-row gap-3">
              {/* Book a Carrier Card */}
              <TouchableOpacity
                onPress={() => router.push("/carrier/book" as any)}
                style={{ backgroundColor: '#22C55E' }}
                className="flex-1 rounded-xl p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-white items-center justify-center mb-2">
                  <MaterialIcons name="local-shipping" size={24} color="#22C55E" />
                </View>
                <Text className="text-sm font-semibold text-white text-center">
                  Book a Carrier
                </Text>
                <Text className="text-xs text-white text-center mt-1">
                  Transport goods, households shifting, bulk items or goods & cargo
                </Text>
              </TouchableOpacity>

              {/* My Bookings Card */}
              <TouchableOpacity
                onPress={() => router.push("/carrier/my-bookings" as any)}
                style={{ backgroundColor: '#22C55E' }}
                className="flex-1 rounded-xl p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-white items-center justify-center mb-2">
                  <MaterialIcons name="receipt-long" size={24} color="#22C55E" />
                </View>
                <Text className="text-sm font-semibold text-white text-center">
                  My Bookings
                </Text>
                <Text className="text-xs text-white text-center mt-1">
                  View booking history
                </Text>
              </TouchableOpacity>

              {/* Track Shipment Card */}
              <TouchableOpacity
                onPress={() => router.push("/carrier/track" as any)}
                style={{ backgroundColor: '#22C55E' }}
                className="flex-1 rounded-xl p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-white items-center justify-center mb-2">
                  <MaterialIcons name="location-on" size={24} color="#22C55E" />
                </View>
                <Text className="text-sm font-semibold text-white text-center">
                  Track Shipment
                </Text>
                <Text className="text-xs text-white text-center mt-1">
                  Track active deliveries
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Recent Pickups */}
        {isCustomer && userPickups.length > 0 && (
          <View className="px-6 mb-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-foreground">
                Recent Pickups
              </Text>
              <TouchableOpacity onPress={() => router.push("/pickups" as any)}>
                <Text className="text-primary font-medium">See All</Text>
              </TouchableOpacity>
            </View>
            {userPickups.slice(0, 3).map((pickup) => (
              <View
                key={pickup.id}
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        pickup.status === "completed"
                          ? "bg-success/20"
                          : pickup.status === "pending"
                          ? "bg-warning/20"
                          : "bg-primary/20"
                      }`}
                    >
                      <MaterialIcons
                        name={
                          pickup.status === "completed"
                            ? "check-circle"
                            : pickup.status === "pending"
                            ? "schedule"
                            : "local-shipping"
                        }
                        size={20}
                        color={
                          pickup.status === "completed"
                            ? "#22C55E"
                            : pickup.status === "pending"
                            ? "#F59E0B"
                            : "#22C55E"
                        }
                      />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-foreground font-medium">
                        {pickup.binType.charAt(0).toUpperCase() + pickup.binType.slice(1)} Pickup
                      </Text>
                      <Text className="text-sm text-muted" numberOfLines={1}>
                        {pickup.location.address || "Location pinned"}
                      </Text>
                    </View>
                  </View>
                  <View
                    className={`px-3 py-1 rounded-full ${
                      pickup.status === "completed"
                        ? "bg-success/20"
                        : pickup.status === "pending"
                        ? "bg-warning/20"
                        : "bg-primary/20"
                    }`}
                  >
                    <Text
                      className={`text-xs font-medium capitalize ${
                        pickup.status === "completed"
                          ? "text-success"
                          : pickup.status === "pending"
                          ? "text-warning"
                          : "text-primary"
                      }`}
                    >
                      {pickup.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Collector Stats */}
        {isCollector && (
          <View className="px-6 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Today&apos;s Overview
            </Text>
            <View className="flex-row">
              <View className="flex-1 bg-surface rounded-xl p-4 mr-2 border border-border">
                <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mb-2">
                  <MaterialIcons name="pending-actions" size={20} color="#22C55E" />
                </View>
                <Text className="text-2xl font-bold text-foreground">
                  {allPendingPickups.length}
                </Text>
                <Text className="text-sm text-muted">Pending Pickups</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-4 ml-2 border border-border">
                <View className="w-10 h-10 rounded-full bg-success/20 items-center justify-center mb-2">
                  <MaterialIcons name="done-all" size={20} color="#22C55E" />
                </View>
                <Text className="text-2xl font-bold text-foreground">
                  {pickups.filter((p) => p.status === "completed").length}
                </Text>
                <Text className="text-sm text-muted">Completed</Text>
              </View>
            </View>
          </View>
        )}

        {/* Collector Quick Actions */}
        {isCollector && (
          <View className="px-6 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Quick Actions
            </Text>
            <View className="flex-row flex-wrap">
              <QuickActionButton
                icon="dashboard"
                label="Dashboard"
                color="#22C55E"
                onPress={() => router.push("/(collector)" as any)}
              />
              <QuickActionButton
                icon="map"
                label="View Map"
                color="#3B82F6"
                onPress={() => router.push("/(collector)" as any)}
              />
              <QuickActionButton
                icon="assignment"
                label="Pending"
                color="#F59E0B"
                badge={allPendingPickups.length}
                onPress={() => router.push("/(collector)" as any)}
              />
              <QuickActionButton
                icon="support-agent"
                label="Support"
                color="#8B5CF6"
                onPress={openWhatsApp}
              />
            </View>
          </View>
        )}

        {/* Recycler Quick Actions */}
        {isRecycler && (
          <View className="px-6 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-4">
              Quick Actions
            </Text>
            <View className="flex-row flex-wrap">
              <QuickActionButton
                icon="recycling"
                label="Dashboard"
                color="#22C55E"
                onPress={() => router.push("/recycler-dashboard" as any)}
              />
              <QuickActionButton
                icon="add-shopping-cart"
                label="New Order"
                color="#3B82F6"
                onPress={() => router.push("/recycler-order" as any)}
              />
              <QuickActionButton
                icon="support-agent"
                label="Support"
                color="#8B5CF6"
                onPress={openWhatsApp}
              />
              <QuickActionButton
                icon="phone"
                label="Call Us"
                color="#EC4899"
                onPress={makeCall}
              />
            </View>
          </View>
        )}

        {/* Contact Support (Need Help) */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-2xl p-5 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-2">
              Need Help?
            </Text>
            <Text className="text-muted text-base mb-4">
              Contact our support team via WhatsApp or phone call
            </Text>
            <View className="flex-row mb-3">
              <TouchableOpacity
                onPress={openWhatsApp}
                className="flex-1 bg-success py-3 rounded-xl mr-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="chat" size={18} color="#fff" />
                <Text className="text-white font-semibold ml-2">WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={makeCall}
                className="flex-1 bg-primary py-3 rounded-xl ml-2 flex-row items-center justify-center"
              >
                <MaterialIcons name="phone" size={18} color="#fff" />
                <Text className="text-white font-semibold ml-2">Call</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/contact-us" as any)}
              className="bg-surface border border-border py-3 rounded-xl flex-row items-center justify-center"
            >
              <MaterialIcons name="contacts" size={18} color="#687076" />
              <Text className="text-muted font-semibold ml-2">All Contact Info</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Logout */}
        <View className="px-6 mb-6">
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Logout",
                "Are you sure you want to logout?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                      await logout();
                      router.replace("/(auth)/welcome" as any);
                    },
                  },
                ]
              );
            }}
            className="bg-error/10 rounded-xl p-4 flex-row items-center justify-center border border-error/20"
          >
            <MaterialIcons name="logout" size={20} color="#EF4444" />
            <Text className="text-error font-semibold ml-2">Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function QuickActionButton({
  icon,
  label,
  color,
  badge,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="w-1/4 items-center mb-4"
      style={styles.quickAction}
    >
      <View
        className="w-14 h-14 rounded-2xl items-center justify-center mb-2"
        style={{ backgroundColor: `${color}15` }}
      >
        <MaterialIcons name={icon as any} size={26} color={color} />
        {badge !== undefined && badge > 0 && (
          <View className="absolute -top-1 -right-1 bg-error w-5 h-5 rounded-full items-center justify-center">
            <Text className="text-white text-xs font-bold">{badge}</Text>
          </View>
        )}
      </View>
      <Text className="text-xs text-muted text-center">{label}</Text>
    </TouchableOpacity>
  );
}

const _rs = getStaticResponsive();
const styles = StyleSheet.create({
  quickAction: {
    paddingHorizontal: _rs.sp(4),
  },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2F1',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    alignSelf: 'flex-start',
    gap: 3,
  },
  zoneChipText: {
    fontSize: 11,
    color: '#00796B',
    fontWeight: '600',
  },
  mapCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  mapView: {
    width: '100%',
    height: 220,
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1B4332',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapOverlayButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapOverlayButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  recenterButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  mapPlaceholder: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#86EFAC',
  },
  // Notification bell button
  bellBtn: {
    backgroundColor: '#1B4332',
    borderRadius: 24,
    padding: 10,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
